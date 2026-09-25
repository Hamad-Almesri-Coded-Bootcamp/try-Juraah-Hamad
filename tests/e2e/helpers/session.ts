/**
 * Test-only session cookies for the role walks (verification 11 and 12) — P2-WP2 (D-018): the
 * cookie is now SIGNED exactly as `lib/session/verify.ts` signs it,
 *   base64url(JSON{ session, sid, exp }) + "." + base64url(HMAC-SHA256(JURAH_SESSION_SECRET, first part)),
 * so proxy.ts and the session module accept it and a hand-edited cookie is refused. It never carries
 * a Civil ID. Signing is synchronous here (`node:crypto`'s HMAC, same bytes as Web Crypto's —
 * `tests/unit/session/verify.test.ts` proves verify.ts accepts this helper's output) because every
 * spec calls `sessionCookieFor(...)` inline as an argument to `context.addCookies([...])`.
 *
 * The secret comes from the environment Playwright runs in (playwright.config.ts loads .env.local).
 *
 * With JURAH_DATABASE_URL set, every call ALSO gets its own fresh `sessions` row (the data layer
 * refuses a cookie whose row is missing or revoked — E-26), so one test signing out (identity.spec
 * signs out حمد, roles.spec signs out د. خالد) never revokes a row another parallel test uses. Rows
 * are created in batches by a child process running the product's own insert path
 * (`lib/session/pg` → `withSession` → the `session_row_ok` insert policy) — this file never holds a
 * database connection (guard 8). Without the URL (mock backend) no row exists or is needed.
 *
 * Subject ids follow the seed's cast order (D-005): pt-01 حمد · pt-02 فاطمة · pt-03 سارة · pt-04 بدر;
 * caregivers cg-01..cg-08 in the seed table's order.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { SESSION_COOKIE } from '../../../lib/config';
import { canonicalSession, sessionExpiry } from '../../../lib/session/verify';

export type TestSession = {
  subjectId: string;
  role: 'patient' | 'caregiver' | 'reviewer' | 'admin';
  linkedPatientId?: string;
  pendingInvitationOnly?: true;
};

export const TEST_SESSIONS = {
  hamad: { subjectId: 'pt-01', role: 'patient' },
  fatima: { subjectId: 'pt-02', role: 'patient' },
  sara_patient: { subjectId: 'pt-03', role: 'patient' },
  sara_caregiver: { subjectId: 'cg-02', role: 'caregiver', linkedPatientId: 'pt-01' },
  badr: { subjectId: 'pt-04', role: 'patient' },
  abdullah: { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' },
  khalid_reviewer: { subjectId: 'acc-10', role: 'reviewer' },
  khalid_admin: { subjectId: 'acc-10', role: 'admin' },
  dana: { subjectId: 'acc-11', role: 'admin' },
} as const satisfies Record<string, TestSession>;

type Who = keyof typeof TEST_SESSIONS;
type PendingSession = { subjectId: string; pendingInvitationOnly: true };
interface Issued { sid: string; exp: number }

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function secret(): string {
  const s = (process.env.JURAH_SESSION_SECRET ?? '').trim();
  if (!s) throw new Error('tests/e2e/helpers/session.ts: JURAH_SESSION_SECRET is not set — cannot mint a signed session cookie (D-018)');
  return s;
}

/** The signed cookie value for any session payload — the same bytes lib/session/verify.ts signs. */
export function signedCookieValue(session: TestSession | PendingSession, issued: Issued): string {
  const body = b64url(Buffer.from(JSON.stringify({ session: canonicalSession(session), sid: issued.sid, exp: issued.exp }), 'utf8'));
  const mac = b64url(createHmac('sha256', secret()).update(body).digest());
  return `${body}.${mac}`;
}

// ---- sessions rows (postgres backend only) ----
const BATCH = 10;
const pool = new Map<string, Issued[]>();

function databaseConfigured(): boolean {
  return (process.env.JURAH_DATABASE_URL ?? '').trim() !== '';
}

/** Opens BATCH fresh rows for one persona through lib/session/pg's openSessionRows, in a child process. */
function refill(key: string, session: TestSession | PendingSession): void {
  const code = [
    "const { loadLocalEnv } = await import('./scripts/db/env.ts'); loadLocalEnv();",
    "process.env.JURAH_DATA_BACKEND = 'postgres';",
    "const m = await import('./lib/session/pg/index.ts');",
    'const out = await m.openSessionRows(JSON.parse(process.env.JURAH_E2E_SESSIONS));',
    'process.stdout.write(JSON.stringify(out)); process.exit(0);',
  ].join('\n');
  const sessions = Array.from({ length: BATCH }, () => session);
  const stdout = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, JURAH_E2E_SESSIONS: JSON.stringify(sessions) },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const issued = JSON.parse(stdout) as Issued[];
  if (!Array.isArray(issued) || issued.length !== BATCH) throw new Error(`e2e session rows: expected ${BATCH} rows for ${key}, got ${stdout.slice(0, 200)}`);
  pool.set(key, [...(pool.get(key) ?? []), ...issued]);
}

function issue(key: string, session: TestSession | PendingSession): Issued {
  if (!databaseConfigured()) return { sid: `ses_e2e_${b64url(randomBytes(16))}`, exp: sessionExpiry() };
  if (!pool.get(key)?.length) refill(key, session);
  const next = pool.get(key)!.shift();
  if (!next) throw new Error(`e2e session rows: none left for ${key}`);
  return next;
}

export function sessionCookieFor(who: Who, base: URL) {
  return {
    name: SESSION_COOKIE,
    value: signedCookieValue(TEST_SESSIONS[who], issue(who, TEST_SESSIONS[who])),
    domain: base.hostname,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  };
}

/** Which backend this run's server uses (playwright.config.ts pins it the same way). */
export function e2eBackend(): 'postgres' | 'mock' {
  return databaseConfigured() ? 'postgres' : 'mock';
}

/**
 * AP-09: a signed CAREGIVER-role cookie for a caregiver who is NOT active (طلال, `cg-06`, revoked):
 * the session a caregiver still holds in the browser after the patient revoked them. Mock backend
 * only, and it says so: under the database the sessions insert policy (0007 session_row_ok) already
 * refuses a row for a caregiver who is not active, so no such session can be issued there at all.
 */
export function inactiveCaregiverCookieFor(subjectId: string, linkedPatientId: string, base: URL) {
  if (databaseConfigured()) {
    throw new Error('inactiveCaregiverCookieFor: the database refuses a sessions row for a caregiver who is not active (session_row_ok); mock backend only');
  }
  const session: TestSession = { subjectId, role: 'caregiver', linkedPatientId };
  return {
    name: SESSION_COOKIE,
    value: signedCookieValue(session, issue(`caregiver:${subjectId}`, session)),
    domain: base.hostname,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  };
}

/**
 * A signed PENDING-INVITATION-ONLY cookie (ناصر, `cg-03`), for the three specs that minted an
 * unsigned one inline (identity.spec.ts:86, roles.spec.ts:117 — docs/backend-notes/p2-wp2.md CR-WP2-1;
 * caregiving.spec.ts, found at WPfinal — D-038).
 * With the database configured, the row is admitted only while that invitation is pending and unexpired.
 */
export function pendingInvitationCookieFor(subjectId: string, base: URL) {
  const session: PendingSession = { subjectId, pendingInvitationOnly: true };
  return {
    name: SESSION_COOKIE,
    value: signedCookieValue(session, issue(`pending:${subjectId}`, session)),
    domain: base.hostname,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  };
}
