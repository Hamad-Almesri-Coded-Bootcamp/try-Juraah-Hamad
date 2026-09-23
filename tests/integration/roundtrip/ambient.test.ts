/**
 * P2-WP3d round trip — the eleven ambient reads through the REAL Postgres path
 * (lib/data/pg/reads-ambient.ts → withSession() → jurah_app + RLS), under the seeded session
 * print-shapes uses, compared with tests/fixtures/shapes.json AS A STRING (key order included —
 * BACKEND-PLAN §6, never deep-equal).
 *
 * Four recorded shapes carry state another package's function creates during the print-shapes run,
 * so each is compared in two steps (docs/backend-notes/p2-wp3d.md §2):
 *   - getActivity / getAuditLog: first the SEEDED rows (id ae-NNN) byte-exact; then the same-second
 *     live rows the run appends are inserted through lib/db/audit.ts append() in the recorded order,
 *     and the whole head is compared with CR-041's rule (a created row's id is any string).
 *   - getCaregiverLink(cg-03): ناصر's acceptance is performed first (the database row change WP5's
 *     acceptInvitation makes, under ناصر's own pending session), then the recorded shape.
 *   - readLastKnownSnapshot: the backend stores a SERIALISED copy (D-5), so the expected value is
 *     `{ data: <getPatient(pt-01) fixture>, asOf }` — the fixture's own line carries the mock's
 *     aliasing bug (cg-09) and is asserted to DIFFER, exactly there.
 * Every mutating test re-seeds afterwards (audit_events is append-only; an acceptance is one-way).
 * getInvitationForConsent runs as سارة (D-024). Without JURAH_DATABASE_URL: loud NOT A PASS.
 */
import { afterAll, describe, expect, it } from 'vitest';
import shapes from '../../fixtures/shapes.json';
import { databaseUrl, getSql } from '@/lib/db/client';
import { withSession } from '@/lib/db/withSession';
import { append } from '@/lib/db/audit';
import { setScriptSession } from '@/lib/session/cookie';
import * as pg from '@/lib/data/pg/reads-ambient';
import { runSeed } from '../../../scripts/db/seed';
import type { AuditEvent } from '@/types/contracts';
import type { Session } from '@/types/views';

const fixture = shapes as unknown as Record<string, unknown>;
const HAMAD: Session = { subjectId: 'pt-01', role: 'patient' };
const FATIMA: Session = { subjectId: 'pt-02', role: 'patient' };
const SARA: Session = { subjectId: 'pt-03', role: 'patient' };
const BADR: Session = { subjectId: 'pt-04', role: 'patient' };
const NASER_PENDING: Session = { subjectId: 'cg-03', pendingInvitationOnly: true };
const NASER_ACTIVE: Session = { subjectId: 'cg-03', role: 'caregiver', linkedPatientId: 'pt-01' };
const DANA: Session = { subjectId: 'acc-11', role: 'admin' };

async function as(s: Session | null, fn: () => Promise<unknown>): Promise<string> {
  setScriptSession(s);
  return JSON.stringify(await fn());
}
const recorded = (key: string) => JSON.stringify(fixture[key]);
const seedRows = <T extends { id: string }>(a: T[]) => a.filter((e) => /^ae-\d{3}$/.test(e.id));
/** CR-041: a created row's id is "present and a string" — copy the recorded id over it, compare the rest. */
function withRecordedIds<T extends { id: string }>(got: T[], want: T[]): T[] {
  return got.map((e, i) => (want[i] && /^ae-live-/.test(want[i].id) && typeof e.id === 'string' ? { ...e, id: want[i].id } : e));
}
/** The live rows print-shapes appends before the read, re-created through append() in that order. */
async function appendLive(rows: AuditEvent[]): Promise<void> {
  for (const e of rows) {
    const s: Session | null = e.actor.role === 'patient' || e.actor.role === 'caregiver' || e.actor.role === 'reviewer' || e.actor.role === 'admin'
      ? { subjectId: e.actor.id ?? e.patientId ?? 'pt-01', role: e.actor.role } : null;
    const write = async (sql: Parameters<Parameters<typeof withSession>[1]>[0]) => {
      await append(sql, { scope: e.scope, patientId: e.patientId, actor: e.actor, type: e.type, message: e.message, relatedId: e.relatedId });
    };
    if (s) await withSession(s, write);
    else await getSql().begin(async (tx) => {
      await tx`select set_config('jurah.session', '{"role":"system"}', true), set_config('jurah.now', '2026-09-21T09:15:00+03:00', true)`;
      await write(tx);
    });
  }
}

// Guarded only so a missing URL reports ONE loud failure (setup.ts), not a second one from cleanup.
afterAll(async () => { if (databaseUrl()) await runSeed(getSql()); });

describe('round trip — ambient reads, the seeded state (string-equal against tests/fixtures/shapes.json)', () => {
  it('getPatient(pt-01) as حمد', async () => {
    expect(await as(HAMAD, () => pg.getPatient('pt-01'))).toBe(recorded('getPatient(pt-01)'));
  });
  it('getSettings(pt-01) as حمد — patientId FIRST', async () => {
    expect(await as(HAMAD, () => pg.getSettings('pt-01'))).toBe(recorded('getSettings(pt-01)'));
  });
  it('getSettings(pt-04) as بدر — no row → defaults with patientId LAST, and NO ROW WRITTEN (count before = after = 0)', async () => {
    const count = async () => (await getSql()`select count(*)::int as n from settings where patient_id = 'pt-04'`)[0]?.n;
    expect(await count()).toBe(0);
    expect(await as(BADR, () => pg.getSettings('pt-04'))).toBe(recorded('getSettings(pt-04, no row)'));
    expect(await count()).toBe(0);
  });
  it('getCaregivers(pt-01) as حمد — seq order, lifecycle keys in seed order, no civilId', async () => {
    expect(await as(HAMAD, () => pg.getCaregivers('pt-01'))).toBe(recorded('getCaregivers(pt-01)'));
  });
  it('getPendingInvitationsForSubject as سارة', async () => {
    expect(await as(SARA, () => pg.getPendingInvitationsForSubject())).toBe(recorded('getPendingInvitationsForSubject (as سارة)'));
  });
  it('getInvitationForConsent(cg-08) as سارة (D-024)', async () => {
    expect(await as(SARA, () => pg.getInvitationForConsent('cg-08'))).toBe(recorded('getInvitationForConsent(cg-08)'));
  });
  it('getPushCapability()', async () => {
    expect(await as(null, () => pg.getPushCapability())).toBe(recorded('getPushCapability()'));
  });
  it('getPushState(patient:pt-03) as سارة — endpoint/keys never projected', async () => {
    expect(await as(SARA, () => pg.getPushState({ subjectType: 'patient', subjectId: 'pt-03' }))).toBe(recorded('getPushState(patient:pt-03)'));
  });
  it('getMessagingLink(patient:pt-02) as فاطمة — the latest row (ml-05), linkToken while pending, no chatId', async () => {
    expect(await as(FATIMA, () => pg.getMessagingLink({ subjectType: 'patient', subjectId: 'pt-02' }))).toBe(recorded('getMessagingLink(patient:pt-02)'));
  });
  it('getActivity(pt-01) as حمد — the seeded rows, newest first', async () => {
    expect(await as(HAMAD, () => pg.getActivity('pt-01'))).toBe(JSON.stringify(seedRows(fixture['getActivity(pt-01)'] as AuditEvent[])));
  });
  it('getAuditLog({}) as م. دانة — the seeded rows, patientMaskedName LAST', async () => {
    expect(await as(DANA, () => pg.getAuditLog({}))).toBe(JSON.stringify(seedRows(fixture['getAuditLog (as م. دانة)'] as AuditEvent[])));
  });
  it('readLastKnownSnapshot(getPatient:pt-01) as حمد — a serialised copy of the getPatient read (D-5)', async () => {
    await as(HAMAD, () => pg.getPatient('pt-01'));
    const got = await as(HAMAD, () => pg.readLastKnownSnapshot('getPatient:pt-01'));
    expect(got).toBe(JSON.stringify({ data: fixture['getPatient(pt-01)'], asOf: '2026-09-21T09:15:00+03:00' }));
    // The fixture's own line shows the mock's aliasing bug (cg-09 appended after the snapshot): it must differ, only there.
    expect(got).not.toBe(recorded('readLastKnownSnapshot(getPatient:pt-01)'));
  });
});

describe('round trip — the recorded shapes that carry state created by other packages (then re-seeded)', () => {
  it('getActivity(pt-01) — the four same-second live rows come back in INSERTION order (seq asc), then the seed rows', async () => {
    const want = fixture['getActivity(pt-01)'] as AuditEvent[];
    await appendLive(want.filter((e) => /^ae-live-/.test(e.id)));
    setScriptSession(HAMAD);
    const got = await pg.getActivity('pt-01');
    expect(JSON.stringify(withRecordedIds(got, want))).toBe(JSON.stringify(want));
    await runSeed(getSql());
  });
  it('getAuditLog({}) — all 64 recorded rows (17 live, same second, insertion order), CR-041 ids', async () => {
    const want = fixture['getAuditLog (as م. دانة)'] as (AuditEvent & { patientMaskedName?: string })[];
    await appendLive(want.filter((e) => /^ae-live-/.test(e.id)));
    setScriptSession(DANA);
    const got = await pg.getAuditLog({});
    expect(JSON.stringify(withRecordedIds(got, want))).toBe(JSON.stringify(want));
    await runSeed(getSql());
  });
  it('getCaregiverLink(cg-03) as ناصر after his own acceptance', async () => {
    await withSession(NASER_PENDING, (sql) => sql`update caregivers set status = 'active', accepted_at = jurah_now() where id = 'cg-03'`);
    expect(await as(NASER_ACTIVE, () => pg.getCaregiverLink('cg-03'))).toBe(recorded('getCaregiverLink(cg-03)'));
    await runSeed(getSql());
  });
});
