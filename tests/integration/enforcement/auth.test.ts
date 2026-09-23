/**
 * ENFORCEMENT.md — the `auth` rows owned by P2-WP2 (auth, sessions, role resolution), each test
 * titled by its row id, against the REAL database (tests/integration/setup.ts re-seeds before this
 * file and FAILS loudly without JURAH_DATABASE_URL — never skipped-as-pass).
 *
 * The session functions are called straight from lib/session/pg (the postgres implementation) in
 * script context: `cookies()` has no request here, so lib/session/cookie.ts keeps the SIGNED cookie
 * value in its script jar and verifies it exactly as it verifies a request cookie (signature, exp,
 * and the live `sessions` row). `getScriptCookie()` is "copy the cookie"; `setScriptCookie(v)` is
 * "replay it".
 *
 * Rows proved here: E-13 (session half) · E-16 · E-17 · E-18 · E-19 · E-20 (read-time half) · E-21 ·
 * E-22 · E-24 · E-25 · E-26 · E-27 · E-36 · E-37 — plus ROLES.md's twelve-ID table against Postgres.
 * The seam halves that belong to other packages (inviteCaregiver / acceptInvitation — WP5; the 24
 * patient-scoped reads — WP3; the lookup's rate limit — WP5) are proved here at the database level,
 * under sessions this module issues; each test says which.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { REFERENCE_NOW } from '@/lib/config';
import { reset, getStore } from '@/lib/data/mock/store';
import { resolveCivilId } from '@/lib/session/resolve';
import { claimsFromCookieValue, getScriptCookie, readSessionClaims, readSessionCookie, setScriptCookie, setScriptSession } from '@/lib/session/cookie';
import * as pg from '@/lib/session/pg';
import { signSession, sessionExpiry } from '@/lib/session/verify';
import { withSession } from '@/lib/db/withSession';
import { proxy } from '@/proxy';
import { S, SYSTEM, app, probe, rejects, type As } from '../helpers';

beforeAll(() => {
  // cookie.ts checks the sessions row only on the postgres backend.
  process.env.JURAH_DATA_BACKEND = 'postgres';
  reset(); // the mock store — the reference the twelve-ID table is compared with
});

const secret = () => (process.env.JURAH_SESSION_SECRET ?? '').trim();

const ID = {
  hamad: '255031200187', fatima: '258071100342', sara: '290022500654', abdullah: '285061400412',
  naser: '288110300229', mona: '292043000517', noAccount: '277091900873', khalid: '280012000961',
  dana: '293080700148', badr: '268110500413', talal: '298052000731', dalal: '285092200664',
} as const;

async function ownerValue<T = unknown>(query: string): Promise<T> {
  return probe(SYSTEM, async (tx) => {
    await tx`reset role`;
    const [row] = await tx.unsafe(query);
    return (row ? Object.values(row)[0] : undefined) as T;
  });
}
const sessionCount = () => ownerValue<number>('select count(*)::int from sessions');

async function asApp(as: As, query: string): Promise<unknown> {
  return probe(as, async (tx) => {
    const [row] = await tx.unsafe(query);
    return row ? Object.values(row)[0] : undefined;
  });
}

/** Every patient-scoped table a read function serves from, for patient pt-01. */
const PT01_READS: Record<string, string> = {
  can_read_patient: "select can_read_patient('pt-01')::int",
  patients: "select count(id)::int from patients where id = 'pt-01'",
  prescriptions: "select count(id)::int from prescriptions where patient_id = 'pt-01'",
  doses: "select count(d.id)::int from doses d join prescriptions p on p.id = d.prescription_id where p.patient_id = 'pt-01'",
  interaction_alerts: "select count(id)::int from interaction_alerts where patient_id = 'pt-01'",
  refill_requests: "select count(id)::int from refill_requests where patient_id = 'pt-01'",
  settings: "select count(patient_id)::int from settings where patient_id = 'pt-01'",
  audit_events: "select count(id)::int from audit_events where patient_id = 'pt-01'",
  calendar_subscriptions: "select count(patient_id)::int from calendar_subscriptions where patient_id = 'pt-01'",
  messaging_links: "select count(id)::int from messaging_links where subject_type = 'patient' and subject_id = 'pt-01'",
  push_subscriptions: "select count(id)::int from push_subscriptions_view where subject_type = 'patient' and subject_id = 'pt-01'",
  prescription_drafts: "select count(draft_id)::int from prescription_drafts where patient_id = 'pt-01'",
  caregiverIds: "select coalesce(cardinality(caregiver_ids_for_patient('pt-01')), 0)::int",
};

async function readTable(as: As, extraCaregiverFilter?: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const [name, q] of Object.entries(PT01_READS)) out[name] = Number(await asApp(as, q));
  // the caregiver may see its OWN caregivers row (ROLES.md: "own Caregiver record"); nobody else's
  out.caregivers_others = Number(await asApp(as, `select count(id)::int from caregivers where linked_patient_id = 'pt-01'${extraCaregiverFilter ?? ''}`));
  return out;
}

// ---------------------------------------------------------------------------------------------
describe('ROLES.md — the twelve seed Civil IDs resolve against Postgres exactly as the table says', () => {
  const expected: Record<keyof typeof ID, string> = {
    hamad: 'single_role', fatima: 'single_role', sara: 'multiple_roles', abdullah: 'single_role',
    naser: 'pending_invitation_only', mona: 'no_claims', noAccount: 'no_claims', khalid: 'multiple_roles',
    dana: 'single_role', badr: 'single_role', talal: 'no_claims', dalal: 'no_claims',
  };
  it('each outcome is byte-identical to the mock reference; a sessions row only for the three session kinds', async () => {
    const rows: string[] = [];
    for (const [who, civil] of Object.entries(ID) as [keyof typeof ID, string][]) {
      setScriptSession(null);
      const before = await sessionCount();
      const outcome = await pg.signIn(civil);
      const after = await sessionCount();
      const mock = resolveCivilId(civil, getStore(), REFERENCE_NOW);
      expect(outcome.kind, who).toBe(expected[who]);
      expect(JSON.stringify(outcome), who).toBe(JSON.stringify(mock));
      const wantsRow = ['single_role', 'multiple_roles', 'pending_invitation_only'].includes(outcome.kind);
      expect(after - before, who).toBe(wantsRow ? 1 : 0);
      if (wantsRow) {
        expect(await readSessionCookie(), who).not.toBeNull();
        expect(JSON.stringify(outcome)).not.toMatch(/\d{12}/);
      }
      rows.push(`${who.padEnd(9)} ${outcome.kind.padEnd(24)} rows+${after - before}  ${JSON.stringify(outcome)}`);
    }
    console.log(['ROLES.md twelve-ID table, Postgres:', ...rows].join('\n'));
  });

  it('getRoleOptions under سارة’s issued session equals the mock’s; a pending-only session gets []', async () => {
    setScriptSession(null);
    await pg.signIn(ID.sara);
    expect(JSON.stringify(await pg.getRoleOptions())).toBe(
      '[{"role":"patient","subjectId":"pt-03"},{"role":"caregiver","subjectId":"cg-02","linkedPatientId":"pt-01","patientFirstName":"حمد","relationship":"ابنتي"}]',
    );
    await pg.signIn(ID.naser);
    expect(await pg.getRoleOptions()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('G9 — identity and the invitation gate (auth rows)', () => {
  it('E-13', async () => {
    // Session half: the masked-name lookup (WP5) reads the session through cookie.ts; with no cookie,
    // an unsigned cookie or a forged one, there is NO session — and a null-session transaction
    // cannot read accounts at all, so no name can be derived without one.
    setScriptCookie(null);
    expect(await readSessionCookie()).toBeNull();
    expect(await claimsFromCookieValue(encodeURIComponent(JSON.stringify({ subjectId: 'pt-01', role: 'patient' })))).toBeNull();
    const forged = await signSession({ session: { subjectId: 'pt-01', role: 'patient' }, sid: 'ses_forged', exp: sessionExpiry() }, secret());
    expect(await claimsFromCookieValue(forged)).toBeNull(); // valid signature, no sessions row
    await rejects({ role: 'jurah_app', session: null }, 'select name from accounts', 'permission denied');
    await rejects(app(S.hamad), 'select name from accounts', 'permission denied');
  });

  it('E-16', async () => {
    // Creating an invitation grants nothing. inviteCaregiver is WP5's; the insert it performs is made
    // here under حمد's session (RLS-admitted), then — same transaction — the invitee's claims and a
    // forged caregiver session for the new row are read.
    const result = await probe(app(S.hamad), async (tx) => {
      await tx.unsafe(`insert into caregivers (id, civil_id, name, relationship, linked_patient_id, status, invited_at, expires_at)
                       values ('cg_e16', '${ID.mona}', 'x', 'قريبة', 'pt-01', 'pending', jurah_now(), jurah_now() + interval '14 days')`);
      const claims = (await tx.unsafe(`select signin_claims('${ID.mona}', jurah_now()) as claims`))[0]?.claims;
      await tx.unsafe(`select set_config('jurah.session', '${JSON.stringify({ subjectId: 'cg_e16', role: 'caregiver', linkedPatientId: 'pt-01', civilId: ID.mona })}', true)`);
      const n = (await tx.unsafe(`select count(id)::int as n from prescriptions where patient_id = 'pt-01'`))[0]?.n;
      const ok = (await tx.unsafe(`select session_row_ok('cg_e16', 'caregiver', false, 'pt-01') as ok`))[0]?.ok;
      return { claims, n, ok };
    });
    const outcome = resolveCivilId(ID.mona, pg.claimsStore(result.claims as pg.SignInClaims, ID.mona), REFERENCE_NOW);
    expect(outcome).toEqual({ kind: 'pending_invitation_only', invitationId: 'cg_e16' }); // a notice, not a role
    expect(result.n).toBe(0); // RLS: 0 rows
    expect(result.ok).toBe(false); // no caregiver session row may even be created for it
  });

  it('E-17', async () => {
    // Only the invited Civil ID's own acceptance: حمد (inviter), م. دانة (admin), عبدالله (another
    // caregiver) and the owner with a system session all fail to move cg-03 to active.
    const accept = "update caregivers set status = 'active', accepted_at = jurah_now() where id = 'cg-03'";
    await rejects(app(S.hamad), accept, 'caregiver_transitions: only the invited civil id may accept');
    await rejects(SYSTEM, accept, 'caregiver_transitions: only the invited civil id may accept');
    for (const as of [app(S.dana), app(S.abdullah)]) {
      const n = await probe(as, async (tx) => (await tx.unsafe(accept)).count);
      expect(n).toBe(0); // RLS hides the row
    }
    expect(await ownerValue(`select status::text from caregivers where id = 'cg-03'`)).toBe('pending');
  });

  it('E-18', async () => {
    setScriptSession(null);
    const outcome = await pg.signIn(ID.naser);
    expect(outcome).toEqual({ kind: 'pending_invitation_only', invitationId: 'cg-03' });
    expect(await ownerValue(`select status::text || '|' || coalesce(accepted_at::text, 'null') from caregivers where id = 'cg-03'`)).toBe('pending|null');
    expect(JSON.stringify(await readSessionCookie())).toBe('{"subjectId":"cg-03","pendingInvitationOnly":true}');
    expect(await ownerValue(`select count(*)::int from sessions where subject_id = 'cg-03' and pending_invitation_only and role is null and revoked_at is null`)).toBeGreaterThanOrEqual(1);
  });

  it('E-19', async () => {
    const own: Record<string, string> = { 'cg-04': ID.mona, 'cg-05': ID.noAccount, 'cg-06': ID.talal, 'cg-07': ID.dalal };
    for (const [id, civil] of Object.entries(own)) {
      const before = await ownerValue<string>(`select status::text from caregivers where id = '${id}'`);
      await rejects({ role: 'owner', session: { subjectId: id, pendingInvitationOnly: true, civilId: civil } },
        `update caregivers set status = 'active', accepted_at = jurah_now() where id = '${id}'`, 'caregiver_transitions');
      setScriptSession(null);
      const count = await sessionCount();
      expect(await pg.signIn(civil), id).toEqual({ kind: 'no_claims' }); // nothing to accept from sign-in
      expect(await sessionCount(), id).toBe(count);
      expect(await ownerValue(`select status::text from caregivers where id = '${id}'`), id).toBe(before);
      // and no session row can be created that would carry it as a pending invitation
      expect(await asApp(app({ subjectId: id, pendingInvitationOnly: true, civilId: civil }), `select session_row_ok('${id}', null, true, null)::int`), id).toBe(0);
    }
  });

  it('E-20', async () => {
    // Read-time half (the job half is WP4b/WP6's): at 2026-10-03 ناصر's cg-03 (expires 2026-10-02
    // 20:10) is expired at read time — sign-in offers nothing and writes no session — while the row
    // itself is still `pending`.
    setScriptSession(null);
    const count = await sessionCount();
    expect(await pg.signInAt(ID.naser, '2026-10-03T09:15:00+03:00')).toEqual({ kind: 'no_claims' });
    expect(await sessionCount()).toBe(count);
    expect(await ownerValue(`select status::text from caregivers where id = 'cg-03'`)).toBe('pending');
    // the boundary: one second before expiry it is still offered
    expect(await pg.signInAt(ID.naser, '2026-10-02T20:09:59+03:00')).toEqual({ kind: 'pending_invitation_only', invitationId: 'cg-03' });
  });

  it('E-21', async () => {
    // Every non-active caregiver state reads NOTHING of pt-01 — 5 sessions × every patient-scoped
    // table the 24 reads are served from (the seam functions themselves are WP3's). Positive control:
    // عبدالله (cg-01, active) reads.
    const forged: Record<string, string> = { 'cg-03': ID.naser, 'cg-04': ID.mona, 'cg-05': ID.noAccount, 'cg-06': ID.talal, 'cg-07': ID.dalal };
    const table: Record<string, Record<string, number>> = {};
    for (const [id, civil] of Object.entries(forged)) {
      table[id] = await readTable(app({ subjectId: id, role: 'caregiver', linkedPatientId: 'pt-01', civilId: civil }), ` and id <> '${id}'`);
      for (const [k, v] of Object.entries(table[id]!)) expect(v, `${id} ${k}`).toBe(0);
      // and the seam can never hold such a session: no row may be created for it …
      expect(await asApp(app({ subjectId: id, role: 'caregiver', linkedPatientId: 'pt-01', civilId: civil }), `select session_row_ok('${id}', 'caregiver', false, 'pt-01')::int`)).toBe(0);
      // … so a correctly SIGNED cookie for it is still no session
      const cookie = await signSession({ session: { subjectId: id, role: 'caregiver', linkedPatientId: 'pt-01' }, sid: `ses_forged_${id}`, exp: sessionExpiry() }, secret());
      expect(await claimsFromCookieValue(cookie), id).toBeNull();
    }
    table['cg-01 (active, control)'] = await readTable(app(S.abdullah), " and id <> 'cg-01'");
    expect(table['cg-01 (active, control)']!.prescriptions).toBeGreaterThan(0);
    expect(table['cg-01 (active, control)']!.doses).toBeGreaterThan(0);
    console.table(table);
  });

  it('E-22', async () => {
    // ناصر's pending-only session, issued by signIn: every patient-scoped table 0 rows, no role options,
    // and proxy.ts sends /ar/app to /ar/invitation.
    setScriptSession(null);
    await pg.signIn(ID.naser);
    const claims = await readSessionClaims();
    expect(claims?.session).toEqual({ subjectId: 'cg-03', pendingInvitationOnly: true });
    const t = await readTable(app(S.naserPending), " and id <> 'cg-03'");
    for (const [k, v] of Object.entries(t)) expect(v, k).toBe(0);
    expect(await pg.getRoleOptions()).toEqual([]);
    const res = await proxy(new NextRequest('http://localhost:3100/ar/app', { headers: { cookie: `jurah.session=${getScriptCookie()}` } }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3100/ar/invitation');
    console.table({ 'cg-03 pending-only': t });
  });

  it('E-24', async () => {
    // Consent data (cg-08, سارة's invitation) is readable only by the invited Civil ID.
    const read = "select count(id)::int from caregivers where id = 'cg-08'";
    expect(await asApp(app(S.hamad), read)).toBe(0);
    expect(await asApp(app(S.naserPending), read)).toBe(0);
    expect(await asApp(app(S.sara), read)).toBe(1); // control: her own
  });

  it('E-25', async () => {
    const unsigned = encodeURIComponent(JSON.stringify({ subjectId: 'pt-01', role: 'admin' }));
    expect(await claimsFromCookieValue(unsigned)).toBeNull();
    // tampered payload carrying an old, valid signature
    setScriptSession(null);
    await pg.signIn(ID.hamad);
    const real = getScriptCookie()!;
    const [, mac] = real.split('.');
    const body = Buffer.from(JSON.stringify({ session: { subjectId: 'pt-01', role: 'admin' }, sid: 'x', exp: sessionExpiry() })).toString('base64url');
    expect(await claimsFromCookieValue(`${body}.${mac}`)).toBeNull();
    // proxy.ts: the hand-crafted cookie against /ar/clinic/audit → no session → /ar/clinic
    const res = await proxy(new NextRequest('http://localhost:3100/ar/clinic/audit', { headers: { cookie: `jurah.session=${unsigned}` } }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3100/ar/clinic');
    // an ID outside the test list: rejected server-side, no sessions row
    const count = await sessionCount();
    expect(await pg.signIn('000000000000')).toEqual({ kind: 'not_in_test_list' });
    expect(await pg.signIn('299999900000')).toEqual({ kind: 'not_in_test_list' });
    expect(await sessionCount()).toBe(count);
  });

  it('E-26', async () => {
    setScriptSession(null);
    await pg.signIn(ID.hamad);
    const copied = getScriptCookie()!;
    const claims = await claimsFromCookieValue(copied);
    expect(claims?.session).toEqual({ subjectId: 'pt-01', role: 'patient' });
    const auditBefore = await ownerValue<number>("select count(*)::int from audit_events where type = 'signed_out'");
    await pg.signOut();
    expect(await ownerValue(`select (revoked_at is not null)::text from sessions where id = '${claims!.sid}'`)).toBe('true');
    expect(await ownerValue<number>("select count(*)::int from audit_events where type = 'signed_out'")).toBe(auditBefore + 1);
    // replay the copied cookie
    setScriptCookie(copied);
    expect(await readSessionCookie()).toBeNull();
    expect(await claimsFromCookieValue(copied)).toBeNull();
    // what every patient-scoped read then runs under: no session → RLS 0 rows
    const n = await withSession(await readSessionCookie(), async (sql) =>
      (await sql`select count(d.id)::int as n from doses d join prescriptions p on p.id = d.prescription_id where p.patient_id = 'pt-01'`)[0]?.n);
    expect(n).toBe(0);
  });

  it('E-26 (seam: getDosesForDay under the replayed cookie — needs WP3a’s getDosesForDay)', async () => {
    setScriptSession(null);
    await pg.signIn(ID.hamad);
    const copied = getScriptCookie()!;
    await pg.signOut();
    setScriptCookie(copied);
    const data = await import('@/lib/data/pg');
    expect(await data.getDosesForDay('pt-01', '2026-09-21')).toEqual([]);
  });

  it('E-27', async () => {
    // The two no_claims IDs: identical bodies, identical statements (one signin_claims call each,
    // no branch before it), overlapping latency distributions over 200 interleaved samples.
    const N = 200;
    const t: Record<'mona' | 'noAccount', number[]> = { mona: [], noAccount: [] };
    const bodies = new Set<string>();
    setScriptSession(null);
    for (let i = 0; i < 5; i++) { await pg.signIn(ID.mona); await pg.signIn(ID.noAccount); } // warm the pool
    for (let i = 0; i < N; i++) {
      for (const who of (i % 2 ? ['mona', 'noAccount'] : ['noAccount', 'mona']) as ('mona' | 'noAccount')[]) {
        const t0 = performance.now();
        const out = await pg.signIn(ID[who]);
        t[who].push(performance.now() - t0);
        bodies.add(JSON.stringify(out));
      }
    }
    expect([...bodies]).toEqual(['{"kind":"no_claims"}']);
    const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!; };
    const stats = Object.fromEntries(Object.entries(t).map(([k, xs]) => [k, { n: xs.length, p5: +pct(xs, 5).toFixed(2), median: +pct(xs, 50).toFixed(2), p95: +pct(xs, 95).toFixed(2) }]));
    console.table(stats);
    const a = stats.mona!, b = stats.noAccount!;
    expect(a.median).toBeGreaterThanOrEqual(b.p5); expect(a.median).toBeLessThanOrEqual(b.p95);
    expect(b.median).toBeGreaterThanOrEqual(a.p5); expect(b.median).toBeLessThanOrEqual(a.p95);
    // and the database's own claims are byte-identical for the two
    const [ca, cb] = await withSession(null, async (sql) => [
      (await sql`select signin_claims(${ID.mona}, jurah_now())::text as c`)[0]?.c,
      (await sql`select signin_claims(${ID.noAccount}, jurah_now())::text as c`)[0]?.c,
    ]);
    expect(ca).toBe(cb);
  }, 1_800_000); // 400 full signIn round trips over the WAN pooler (vitest.integration.config.ts)
});

// ---------------------------------------------------------------------------------------------
describe('Role boundaries (auth-owned rows)', () => {
  it('E-36', async () => {
    // A role in the body is ignored: م. دانة (admin only) asks chooseRole for reviewer → her own
    // session back, nothing written.
    setScriptSession(null);
    expect(await pg.signIn(ID.dana)).toEqual({ kind: 'single_role', session: { subjectId: 'acc-11', role: 'admin' } });
    const before = await sessionCount();
    expect(await pg.chooseRole({ role: 'reviewer', subjectId: 'acc-11' })).toEqual({ subjectId: 'acc-11', role: 'admin' });
    expect(await pg.chooseRole({ role: 'patient', subjectId: 'pt-01' })).toEqual({ subjectId: 'acc-11', role: 'admin' });
    expect(await sessionCount()).toBe(before);
    expect(await readSessionCookie()).toEqual({ subjectId: 'acc-11', role: 'admin' });
    // admin-only: the review queue's rows are invisible; reviewer-only: the audit view is empty
    expect(await asApp(app(S.dana), "select count(id)::int from interaction_alerts where review_status = 'pending_medical_review'")).toBe(0);
    expect(await asApp(app(S.khalidReviewer), 'select count(id)::int from audit_log_admin')).toBe(0);
    expect(Number(await asApp(app(S.dana), 'select count(id)::int from audit_log_admin'))).toBeGreaterThan(0); // control
    // a forged reviewer claim on a patient's subject gets nothing either
    expect(await asApp(app({ subjectId: 'pt-01', role: 'reviewer', civilId: ID.hamad }), "select count(id)::int from interaction_alerts where review_status = 'pending_medical_review'")).toBe(0);
    // proxy.ts: dana → /ar/clinic/review → /ar/gate; a reviewer-only session → /ar/clinic/audit → /ar/gate
    const danaCookie = getScriptCookie()!;
    const r1 = await proxy(new NextRequest('http://localhost:3100/ar/clinic/review', { headers: { cookie: `jurah.session=${danaCookie}` } }));
    expect(r1.headers.get('location')).toBe('http://localhost:3100/ar/gate');
    await pg.signIn(ID.khalid);
    await pg.chooseRole({ role: 'reviewer', subjectId: 'acc-10' });
    const r2 = await proxy(new NextRequest('http://localhost:3100/ar/clinic/audit', { headers: { cookie: `jurah.session=${getScriptCookie()}` } }));
    expect(r2.headers.get('location')).toBe('http://localhost:3100/ar/gate');
  });

  it('E-37', async () => {
    const res = await proxy(new NextRequest('http://localhost:3100/ar/clinic'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    const res2 = await proxy(new NextRequest('http://localhost:3100/ar/clinic/choose'));
    expect(res2.status).toBe(200);
  });

  it('D-17 — chooseRole remembers the last role per account; the next multiple_roles sign-in defaults to it', async () => {
    const remembered = () => ownerValue<string | null>("select string_agg(id, ',' order by id) from accounts where last_chosen_role is not null");
    const rememberedBefore = await remembered(); // acc-10 from E-36's chooseRole, nothing of سارة's
    expect(rememberedBefore ?? '').not.toContain('acc-03');
    setScriptSession(null);
    await pg.signIn(ID.sara);
    expect(await readSessionCookie()).toEqual({ subjectId: 'pt-03', role: 'patient' }); // nothing remembered yet → first
    const oldSid = (await readSessionClaims())!.sid!;
    expect(await pg.chooseRole({ role: 'caregiver', subjectId: 'cg-02', linkedPatientId: 'pt-01' })).toEqual({ subjectId: 'cg-02', role: 'caregiver', linkedPatientId: 'pt-01' });
    expect(await ownerValue(`select (revoked_at is not null)::text from sessions where id = '${oldSid}'`)).toBe('true');
    expect(await ownerValue("select last_chosen_role::text from accounts where id = 'acc-03'")).toBe('caregiver');
    expect(await remembered()).toBe([...(rememberedBefore ? rememberedBefore.split(',') : []), 'acc-03'].sort().join(',')); // her own row, and only hers
    await pg.signOut();
    expect(await readSessionCookie()).toBeNull();
    const outcome = await pg.signIn(ID.sara);
    expect(outcome.kind).toBe('multiple_roles'); // the options array is unchanged …
    expect(JSON.stringify(outcome)).toBe(JSON.stringify(resolveCivilId(ID.sara, getStore(), REFERENCE_NOW)));
    expect(await readSessionCookie()).toEqual({ subjectId: 'cg-02', role: 'caregiver', linkedPatientId: 'pt-01' }); // … the default is remembered
    // chooseRole with a linkedPatientId the caller does not hold is refused (current session back)
    expect(await pg.chooseRole({ role: 'caregiver', subjectId: 'cg-02', linkedPatientId: 'pt-02' })).toEqual({ subjectId: 'cg-02', role: 'caregiver', linkedPatientId: 'pt-01' });
  });

  it('the sessions insert policy refuses a row for somebody else’s subject, and un-revoking is impossible', async () => {
    await rejects(app(S.hamad), "insert into sessions (id, subject_id, role, pending_invitation_only, expires_at) values ('s1', 'pt-02', 'patient', false, jurah_now() + interval '1 hour')", 'row-level security');
    await rejects(app(S.hamad), "insert into sessions (id, subject_id, role, pending_invitation_only, expires_at) values ('s2', 'acc-01', 'admin', false, jurah_now() + interval '1 hour')", 'row-level security');
    await rejects(app(S.abdullah), "insert into sessions (id, subject_id, role, linked_patient_id, pending_invitation_only, expires_at) values ('s3', 'cg-01', 'caregiver', 'pt-02', false, jurah_now() + interval '1 hour')", 'row-level security');
    await rejects(app(S.hamad), "update sessions set subject_id = 'pt-02'", 'permission denied');
    setScriptSession(null);
    await pg.signIn(ID.hamad);
    const sid = (await readSessionClaims())!.sid!;
    await pg.signOut();
    await rejects(app(S.hamad), `update sessions set revoked_at = null where id = '${sid}'`, 'row-level security');
    expect(await ownerValue(`select (revoked_at is not null)::text from sessions where id = '${sid}'`)).toBe('true');
  });
});
