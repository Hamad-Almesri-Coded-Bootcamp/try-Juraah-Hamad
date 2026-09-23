/**
 * P2-WP3d enforcement — docs/ENFORCEMENT.md rows for the ambient reads, each test titled by its id:
 * E-21 (the remaining patient-scoped reads, 5 × 5 table), E-22 read half, E-23, E-24, E-31,
 * E-35 audit half, E-36 (audit half), E-40. Each asserts BOTH halves (D-022/CR-044): the database
 * refuses (RLS / the query's own caller condition → zero rows, shown with a raw count under the same
 * session) AND the seam returns the mock's refusal shape (lib/data/refusals/reads-ambient.ts).
 * Reads never write (E-48): the one write, getPatient's per-subject snapshot, is counted.
 * Without JURAH_DATABASE_URL tests/integration/setup.ts fails every test loudly (NOT A PASS).
 */
import { describe, expect, it } from 'vitest';
import { getSql } from '@/lib/db/client';
import { withSession } from '@/lib/db/withSession';
import { setScriptSession } from '@/lib/session/cookie';
import * as pg from '@/lib/data/pg/reads-ambient';
import * as rf from '@/lib/data/refusals/reads-ambient';
import type { Session } from '@/types/views';

const HAMAD: Session = { subjectId: 'pt-01', role: 'patient' };
const SARA: Session = { subjectId: 'pt-03', role: 'patient' };
const ABDULLAH: Session = { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' };
const NASER_PENDING: Session = { subjectId: 'cg-03', pendingInvitationOnly: true };
const DANA: Session = { subjectId: 'acc-11', role: 'admin' };
const KHALID_REVIEWER: Session = { subjectId: 'acc-10', role: 'reviewer' };
const forged = (id: string): Session => ({ subjectId: id, role: 'caregiver', linkedPatientId: 'pt-01' });

async function as(s: Session | null, fn: () => Promise<unknown>): Promise<string> {
  setScriptSession(s);
  return JSON.stringify(await fn());
}
const snapshotCount = async () => (await getSql()`select count(*)::int as n from snapshots`)[0]?.n as number;

/** The five WP3d patient-scoped reads of E-21's 24, with the refusal each must return. */
const PATIENT_SCOPED: [string, (s: Session) => Promise<unknown>, unknown][] = [
  ['getPatient', () => pg.getPatient('pt-01'), rf.patientRefusal()],
  ['getSettings', () => pg.getSettings('pt-01'), rf.settingsRefusal('pt-01')],
  ['getActivity', () => pg.getActivity('pt-01'), rf.activityRefusal()],
  ['getCaregivers', () => pg.getCaregivers('pt-01'), rf.caregiversRefusal()],
  ['getCaregiverLink', (s) => pg.getCaregiverLink(s.subjectId), rf.caregiverLinkRefusal()],
];

describe('E-21 — a pending, declined, expired or revoked caregiver session reads nothing (WP3d rows)', () => {
  for (const id of ['cg-03', 'cg-04', 'cg-05', 'cg-06', 'cg-07']) {
    it(`E-21 ${id} × {getPatient, getSettings, getActivity, getCaregivers, getCaregiverLink}`, async () => {
      const [raw] = await withSession(forged(id), (sql) => sql`
        select (select count(*)::int from patients) + (select count(*)::int from settings)
             + (select count(*)::int from audit_events) as n`);
      expect(raw?.n, `${id}: raw rows visible`).toBe(0);
      for (const [name, call, refusal] of PATIENT_SCOPED) {
        expect(await as(forged(id), () => call(forged(id))), `${id} ${name}`).toBe(JSON.stringify(refusal));
      }
    });
  }
  it('E-21 control — the ACTIVE caregiver cg-01 does read them', async () => {
    expect(await as(ABDULLAH, () => pg.getPatient('pt-01'))).not.toBe('null');
    expect(await as(ABDULLAH, () => pg.getCaregiverLink('cg-01'))).toBe(JSON.stringify({ patientId: 'pt-01', patientFirstName: 'حمد', acceptedAt: '2026-09-03T18:20:00+03:00' }));
  });
  it('E-21 getCaregivers — caregivers_select alone would show a caregiver its own row; the query refuses it', async () => {
    const [raw] = await withSession(SARA, (sql) => sql`select count(*)::int as n from caregivers where linked_patient_id = 'pt-01'`);
    expect(raw?.n).toBe(1); // cg-02, her own invitation row, visible to her Civil ID by policy
    expect(await as(SARA, () => pg.getCaregivers('pt-01'))).toBe('[]');
    expect(await as(ABDULLAH, () => pg.getCaregivers('pt-01'))).toBe('[]');
  });
});

describe('E-22 — the pending-only session reaches F0 data and nothing else (read half)', () => {
  it('E-22 ناصر pending-only × every WP3d read', async () => {
    const before = await snapshotCount();
    for (const [name, call, refusal] of PATIENT_SCOPED) {
      expect(await as(NASER_PENDING, () => call(NASER_PENDING)), name).toBe(JSON.stringify(refusal));
    }
    expect(await as(NASER_PENDING, () => pg.getAuditLog({}))).toBe('[]');
    expect(await as(NASER_PENDING, () => pg.getPushState({ subjectType: 'caregiver', subjectId: 'cg-03' }))).toBe('null');
    expect(await as(NASER_PENDING, () => pg.getMessagingLink({ subjectType: 'caregiver', subjectId: 'cg-03' })))
      .toBe(JSON.stringify(rf.messagingLinkRefusal({ subjectType: 'caregiver', subjectId: 'cg-03' })));
    expect(await as(NASER_PENDING, () => pg.readLastKnownSnapshot('getPatient:pt-01'))).toBe('null');
    // …and F0's own data does reach it:
    expect(await as(NASER_PENDING, () => pg.getInvitationForConsent('cg-03'))).toBe(JSON.stringify({ id: 'cg-03', patientFirstName: 'حمد', relationship: 'ابني', status: 'pending', expiresAt: '2026-10-02T20:10:00+03:00' }));
    expect(await as(NASER_PENDING, () => pg.getPendingInvitationsForSubject())).toBe(JSON.stringify([{ id: 'cg-03', patientFirstName: 'حمد', relationship: 'ابني', status: 'pending', expiresAt: '2026-10-02T20:10:00+03:00' }]));
    expect(await snapshotCount()).toBe(before); // nothing written
  });
});

describe('E-23 / E-24 — getInvitationForConsent', () => {
  it('E-23 getInvitationForConsent(cg-08) as سارة returns exactly five keys', async () => {
    setScriptSession(SARA);
    expect(Object.keys(await pg.getInvitationForConsent('cg-08'))).toEqual(['id', 'patientFirstName', 'relationship', 'status', 'expiresAt']);
  });
  it('E-24 consent data is readable only by the invited Civil ID — حمد and ناصر get the expired placeholder', async () => {
    const [raw] = await withSession(HAMAD, (sql) => sql`select count(*)::int as n from caregivers c where c.id = 'cg-08' and c.civil_id = jurah_session()->>'civilId'`);
    expect(raw?.n).toBe(0);
    const placeholder = JSON.stringify(rf.invitationRefusal('cg-08'));
    expect(await as(HAMAD, () => pg.getInvitationForConsent('cg-08'))).toBe(placeholder);
    expect(await as(NASER_PENDING, () => pg.getInvitationForConsent('cg-08'))).toBe(placeholder);
    expect(await as(null, () => pg.getInvitationForConsent('cg-08'))).toBe(placeholder);
  });
});

describe('E-31 — a caregiver never sees more than the patient', () => {
  it('E-31 getPatient / getSettings / getActivity(pt-01): حمد and عبدالله byte-identical', async () => {
    for (const call of [() => pg.getPatient('pt-01'), () => pg.getSettings('pt-01'), () => pg.getActivity('pt-01')]) {
      expect(await as(ABDULLAH, call)).toBe(await as(HAMAD, call));
    }
  });
});

describe('E-35 / E-36 — the admin reads audit metadata and nothing else (audit half)', () => {
  it('E-35 م. دانة: getAuditLog rows carry only AuditEvent keys + patientMaskedName; no clinical read', async () => {
    setScriptSession(DANA);
    const rows = await pg.getAuditLog({});
    expect(rows.length).toBe(47);
    const allowed = new Set(['scope', 'patientId', 'actor', 'type', 'message', 'createdAt', 'relatedId', 'id', 'patientMaskedName']);
    for (const r of rows) for (const k of Object.keys(r)) expect(allowed.has(k), k).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/[0-9]{12}/);
    for (const [name, call, refusal] of PATIENT_SCOPED) expect(await as(DANA, () => call(DANA)), name).toBe(JSON.stringify(refusal));
    const [raw] = await withSession(DANA, (sql) => sql`select (select count(*)::int from patients) + (select count(*)::int from audit_events) as n`);
    expect(raw?.n).toBe(0); // only the definer view reaches the log; the tables themselves show nothing
  });
  it('E-36 a reviewer-only session gets [] from getAuditLog (the view filters on the admin session)', async () => {
    expect(await as(KHALID_REVIEWER, () => pg.getAuditLog({}))).toBe('[]');
    expect(await as(HAMAD, () => pg.getAuditLog({}))).toBe('[]');
  });
  it('E-35 filters mirror the mock: bare-date from/to compared as Kuwait ISO text; empty string = no filter', async () => {
    setScriptSession(DANA);
    expect((await pg.getAuditLog({ actorRole: 'agent' })).length).toBe(6);
    expect((await pg.getAuditLog({ from: '2026-09-14' })).length).toBe(17);
    expect((await pg.getAuditLog({ to: '2026-09-20' })).length).toBe(39); // '2026-09-20T…' > '2026-09-20': that day excluded, as the mock
    expect((await pg.getAuditLog({ actorRole: '', type: '' })).length).toBe(47);
    expect(await pg.getAuditLog({ actorRole: 'nobody' })).toEqual([]);
  });
});

describe('E-40 — readLastKnownSnapshot is scoped to the caller', () => {
  it('E-40 حمد caches getPatient(pt-01); ناصر pending, عبدالله and no session read null', async () => {
    // E-22/E-31 above read getPatient(pt-01) AS عبدالله, which rightly caches HIS OWN copy; clear the
    // table so this test observes only حمد's row.
    await getSql()`delete from snapshots`;
    await as(HAMAD, () => pg.getPatient('pt-01'));
    expect(await as(HAMAD, () => pg.readLastKnownSnapshot('getPatient:pt-01'))).not.toBe('null');
    for (const s of [NASER_PENDING, ABDULLAH, null]) {
      expect(await as(s, () => pg.readLastKnownSnapshot('getPatient:pt-01'))).toBe('null');
    }
    const [raw] = await withSession(NASER_PENDING, (sql) => sql`select count(*)::int as n from snapshots`);
    expect(raw?.n).toBe(0); // the snapshots_own policy, without the WHERE
  });
});

describe('WP3d reads never write an audit row (the E-48 rule)', () => {
  it('every WP3d read, twice, leaves audit_events at the same count', async () => {
    const count = async () => (await getSql()`select count(*)::int as n from audit_events`)[0]?.n;
    const before = await count();
    for (let i = 0; i < 2; i++) {
      await as(HAMAD, () => pg.getActivity('pt-01'));
      await as(DANA, () => pg.getAuditLog({}));
      await as(HAMAD, () => pg.getCaregivers('pt-01'));
      await as(SARA, () => pg.getPendingInvitationsForSubject());
      await as(SARA, () => pg.getMessagingLink({ subjectType: 'patient', subjectId: 'pt-03' }));
      await as(SARA, () => pg.getPushState({ subjectType: 'patient', subjectId: 'pt-03' }));
    }
    expect(await count()).toBe(before);
  });
});
