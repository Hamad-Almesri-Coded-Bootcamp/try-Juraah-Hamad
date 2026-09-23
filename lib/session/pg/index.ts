/**
 * The Postgres session implementation (D-018, P2-WP2). Selected by lib/session/index.ts when
 * JURAH_DATA_BACKEND=postgres. Every statement runs inside withSession() (guard 8).
 *
 *   signIn        ROLES.md steps 2–4 server-side: ONE claims query (`signin_claims`, migration 0007)
 *                 for every listed Civil ID — the two no_claims IDs run the identical statement and
 *                 get byte-identical claims (E-27) — then the PURE algorithm of ../resolve.ts over a
 *                 store-shaped adapter (never a fork of it). A `sessions` row + signed cookie only
 *                 for single_role / multiple_roles / pending_invitation_only; `signed_in` audit for
 *                 single_role, as the mock. Signing in never touches `caregivers` (E-18).
 *   getSession    the signed cookie, verified, AND its `sessions` row live (cookie.ts).
 *   getRoleOptions the same claims query, keyed by the session's own Civil ID INSIDE SQL
 *                 (`jurah_session()->>'civilId'`, set by withSession) — it never reaches TypeScript.
 *   chooseRole    re-derives the caller's options server-side; an option the caller does not hold
 *                 returns the current session unchanged (E-36). Otherwise: old row revoked, new
 *                 row + cookie, `accounts.last_chosen_role` remembered (BACKEND-NOTES §2).
 *   signOut       revokes the row (replay → no session, E-26), `signed_out`, clears the cookie.
 *
 * Also exported for other packages: `insertSessionRow` / `issueSession` (WP5's acceptInvitation),
 * `revokeSessionRow` (WP5's declineInvitation), `isSessionLive` (cookie.ts), `openSessionRows`
 * (the e2e helper's child process).
 */
import { kuwaitNow } from '@/lib/config';
import { append } from '@/lib/db/audit';
import { withSession, type Tx } from '@/lib/db/withSession';
import type { StoreState } from '@/lib/data/mock/types';
import type { Account, Caregiver, Patient } from '@/types/contracts';
import type { Role, RoleOption, Session, SignInOutcome } from '@/types/views';
import type { SessionApi } from '../api';
import { clearSessionCookie, readSessionClaims, readSessionCookie, writeSessionCookie } from '../cookie';
import { resolveCivilId, roleOptionsFor, sessionForOption } from '../resolve';
import { canonicalSession, newSessionId, sessionExpiry } from '../verify';

// ---------------------------------------------------------------------------------------------
// The claims query and its adapter onto resolve.ts
// ---------------------------------------------------------------------------------------------

/** What `signin_claims()` returns (0007). Never a Civil ID. */
export interface SignInClaims {
  inList: boolean;
  patient?: { id: string } | null;
  caregiver?: { id: string; linkedPatientId: string; relationship: string; patientFirstName: string } | null;
  accountId?: string | null;
  clinicRoles?: string[];
  lastChosenRole?: Role | null;
  pending?: { id: string; expiresAt: string }[];
}

/** The SQL, exported so a gate proof can run the very same text through the MCP connector. */
export const SESSION_SQL = {
  claimsFor: 'select signin_claims($1, $2::timestamptz) as claims',
  claimsForSelf: "select signin_claims(jurah_session()->>'civilId', $1::timestamptz) as claims",
  live: `select 1 as live from sessions
          where id = $1 and subject_id = $2 and role is not distinct from $3::role_t
            and linked_patient_id is not distinct from $4::text and pending_invitation_only = $5
            and revoked_at is null and expires_at > jurah_now()`,
} as const;

async function claimsFor(sql: Tx, civilId: string, nowIso: string): Promise<SignInClaims> {
  const rows = await sql.unsafe(SESSION_SQL.claimsFor, [civilId, nowIso]);
  return (rows[0]?.claims as SignInClaims | undefined) ?? { inList: false };
}

async function claimsForSelf(sql: Tx, nowIso: string): Promise<SignInClaims> {
  const rows = await sql.unsafe(SESSION_SQL.claimsForSelf, [nowIso]);
  return (rows[0]?.claims as SignInClaims | undefined) ?? { inList: false };
}

/**
 * The claims as the store shape resolve.ts reads (patients, caregivers, accounts — nothing else is
 * touched by roleOptionsFor/resolveCivilId). Every row is stamped with `civilKey`: the real Civil
 * ID in signIn (the caller typed it), an opaque placeholder in getRoleOptions (the Civil ID never
 * leaves SQL there). The rows carry only the fields the algorithm reads.
 */
export function claimsStore(claims: SignInClaims, civilKey: string): StoreState {
  const patients = new Map<string, Pick<Patient, 'id' | 'civilId' | 'name'>>();
  const caregivers: Pick<Caregiver, 'id' | 'civilId' | 'status' | 'linkedPatientId' | 'relationship' | 'expiresAt'>[] = [];
  const accounts: Pick<Account, 'id' | 'civilId' | 'name' | 'roles'>[] = [];
  if (claims.caregiver) {
    const cg = claims.caregiver;
    patients.set(cg.linkedPatientId, { id: cg.linkedPatientId, civilId: '', name: cg.patientFirstName });
    caregivers.push({ id: cg.id, civilId: civilKey, status: 'active', linkedPatientId: cg.linkedPatientId, relationship: cg.relationship, expiresAt: '' });
  }
  if (claims.patient) {
    const existing = patients.get(claims.patient.id);
    patients.set(claims.patient.id, { id: claims.patient.id, civilId: civilKey, name: existing?.name ?? '' });
  }
  for (const p of claims.pending ?? []) {
    caregivers.push({ id: p.id, civilId: civilKey, status: 'pending', linkedPatientId: '', relationship: '', expiresAt: p.expiresAt });
  }
  if (claims.accountId) {
    accounts.push({ id: claims.accountId, civilId: civilKey, name: '', roles: (claims.clinicRoles ?? []) as Account['roles'] });
  }
  return {
    accounts: accounts as Account[], patients: [...patients.values()] as Patient[], caregivers: caregivers as Caregiver[],
    prescriptions: [], doses: [], alerts: [], settings: [], messagingLinks: [], pushSubscriptions: [],
    refillRequests: [], calendarSubscriptions: [], auditEvents: [], drafts: [],
  };
}

/** getRoleOptions' placeholder key — not a Civil ID (not twelve digits), never persisted. */
const SELF = 'session-self';

// ---------------------------------------------------------------------------------------------
// Session rows
// ---------------------------------------------------------------------------------------------

function patientIdForSession(session: Session): string | undefined {
  if (session.role === 'patient') return session.subjectId;
  if (session.role === 'caregiver') return session.linkedPatientId;
  return undefined;
}

/**
 * Inserts the `sessions` row for `session` inside the caller's transaction. The insert policy
 * (`session_row_ok`, 0007) admits it only when the transaction's own session GUC is the SAME
 * person (same Civil ID) and the subject still holds that role — so run it under `session`
 * itself (signIn) or under the same person's current session (chooseRole, acceptInvitation).
 */
export async function insertSessionRow(sql: Tx, session: Session, nowIso: string = kuwaitNow()): Promise<{ sid: string; exp: number }> {
  const s = canonicalSession(session);
  const sid = newSessionId();
  const exp = sessionExpiry(nowIso);
  await sql`
    insert into sessions (id, subject_id, role, linked_patient_id, pending_invitation_only, created_at, expires_at)
    values (${sid}, ${s.subjectId}, ${s.role ?? null}::role_t, ${s.linkedPatientId ?? null}::text,
            ${!!s.pendingInvitationOnly}, ${nowIso}::timestamptz, ${new Date(exp).toISOString()}::timestamptz)`;
  return { sid, exp };
}

/** Revokes one row (`revoked_at = jurah_now()`); returns whether a live row was revoked. */
export async function revokeSessionRow(sql: Tx, sid: string): Promise<boolean> {
  const res = await sql`update sessions set revoked_at = jurah_now() where id = ${sid} and revoked_at is null`;
  return res.count > 0;
}

/** A new row + its signed cookie, in one transaction under the new session itself. */
export async function issueSession(session: Session): Promise<Session> {
  const s = canonicalSession(session);
  const issued = await withSession(s, (sql) => insertSessionRow(sql, s));
  await writeSessionCookie(s, issued);
  return s;
}

/** cookie.ts's liveness check: the verified cookie's row exists, matches it, and is live. */
export async function isSessionLive(session: Session, sid: string): Promise<boolean> {
  const s = canonicalSession(session);
  const rows = await withSession(s, (sql) =>
    sql.unsafe(SESSION_SQL.live, [sid, s.subjectId, s.role ?? null, s.linkedPatientId ?? null, !!s.pendingInvitationOnly]),
  );
  return rows.length === 1;
}

/**
 * The e2e helper's rows (tests/e2e/helpers/session.ts, via a child process when
 * JURAH_DATABASE_URL is set): one fresh row per requested session, each under its own session —
 * so the insert policy still decides (a session whose subject does not hold the role is refused).
 */
export async function openSessionRows(sessions: Session[]): Promise<{ sid: string; exp: number }[]> {
  const out: { sid: string; exp: number }[] = [];
  for (const session of sessions) {
    const s = canonicalSession(session);
    out.push(await withSession(s, (sql) => insertSessionRow(sql, s)));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The five seam functions
// ---------------------------------------------------------------------------------------------

/** signIn at an explicit clock (D-021) — the seam passes kuwaitNow(); E-20's test a later one. */
export async function signInAt(civilId: string, nowIso: string): Promise<SignInOutcome> {
  if (typeof civilId !== 'string') return { kind: 'not_in_test_list' };
  // ONE statement for every Civil ID — no branch before it, none inside it (E-27).
  const claims = await withSession(null, (sql) => claimsFor(sql, civilId, nowIso));
  if (!claims.inList) return { kind: 'not_in_test_list' };
  const outcome = resolveCivilId(civilId, claimsStore(claims, civilId), nowIso);

  if (outcome.kind === 'single_role') {
    const s = canonicalSession(outcome.session);
    const issued = await withSession(s, async (sql) => {
      const row = await insertSessionRow(sql, s, nowIso);
      const patientId = patientIdForSession(s);
      await append(sql, {
        scope: patientId ? 'patient' : 'system', patientId,
        actor: { role: s.role ?? 'system', id: s.subjectId },
        type: 'signed_in', message: 'دخول عن طريق هويّاتي', createdAt: nowIso, relatedId: s.subjectId,
      });
      return row;
    });
    await writeSessionCookie(s, issued);
  } else if (outcome.kind === 'multiple_roles') {
    // D-17: the remembered role is the default when the caller still holds it, else the first.
    const chosen = outcome.options.find((o) => o.role === claims.lastChosenRole) ?? outcome.options[0];
    if (chosen) {
      const s = canonicalSession(sessionForOption(chosen));
      const issued = await withSession(s, (sql) => insertSessionRow(sql, s, nowIso));
      await writeSessionCookie(s, issued);
    }
  } else if (outcome.kind === 'pending_invitation_only') {
    const s: Session = { subjectId: outcome.invitationId, pendingInvitationOnly: true };
    const issued = await withSession(s, (sql) => insertSessionRow(sql, s, nowIso));
    await writeSessionCookie(s, issued);
  }
  return outcome;
}

export const signIn: SessionApi['signIn'] = async (civilId) => signInAt(civilId, kuwaitNow());

export const getSession: SessionApi['getSession'] = async () => readSessionCookie();

async function roleOptionsForSession(session: Session | null): Promise<RoleOption[]> {
  // The mock: no role (none, or pending-only) → no Civil ID resolved → [].
  if (!session || !session.role) return [];
  const claims = await withSession(session, (sql) => claimsForSelf(sql, kuwaitNow()));
  if (!claims.inList) return [];
  return roleOptionsFor(claimsStore(claims, SELF), SELF);
}

export const getRoleOptions: SessionApi['getRoleOptions'] = async () => roleOptionsForSession(await readSessionCookie());

const sameOption = (a: RoleOption, b: RoleOption) =>
  a.role === b.role && a.subjectId === b.subjectId && (a.linkedPatientId ?? null) === (b.linkedPatientId ?? null);

export const chooseRole: SessionApi['chooseRole'] = async (option) => {
  const current = await readSessionClaims();
  // No verified session: nothing can be held, nothing is written. The frozen signature returns a
  // Session, so the requested one is echoed WITHOUT a cookie or a row (divergence D-32) — the next
  // navigation finds no session and proxy.ts sends it to sign-in.
  if (!current) return canonicalSession(sessionForOption(option));
  const held = (await roleOptionsForSession(current.session)).find((o) => option && sameOption(o, option));
  if (!held) return current.session; // E-36: a role in the body is ignored
  const next = canonicalSession(sessionForOption(held)); // built from the server's option, not the body
  const issued = await withSession(current.session, async (sql) => {
    if (current.sid) await revokeSessionRow(sql, current.sid);
    const row = await insertSessionRow(sql, next);
    await sql`update accounts set last_chosen_role = ${held.role}::role_t`; // RLS: the caller's own account row only
    return row;
  });
  await writeSessionCookie(next, issued);
  return next;
};

export const signOut: SessionApi['signOut'] = async () => {
  const current = await readSessionClaims();
  if (current) {
    const s = current.session;
    await withSession(s, async (sql) => {
      if (current.sid) await revokeSessionRow(sql, current.sid);
      const patientId = patientIdForSession(s);
      await append(sql, {
        scope: patientId ? 'patient' : 'system', patientId,
        actor: { role: s.role ?? 'system', id: s.subjectId },
        type: 'signed_out', message: 'خروج', createdAt: kuwaitNow(), relatedId: s.subjectId,
      });
    });
  }
  await clearSessionCookie();
};
