/**
 * P2-WP3a enforcement — the ENFORCEMENT.md rows for the prescriptions-and-doses functions: E-41
 * (savePrescriptionDraft ownership, D-014), E-49 (wrong-patient id = missing id) and the E-21 rows
 * for getPrescriptions · getPrescription · getDosesForDay · getDoseHistory · getRecentDoses. Each
 * test is titled by its row id and carries BOTH proofs D-022 asks for: the DB-level refusal (the
 * exact PG_QUERIES_RX text, run as jurah_app under the forged session, civil id resolved as
 * withSession() resolves it → 0 rows) and the unchanged seam shape (the real lib/data/pg function
 * → the refusal bytes). Every refusal has a positive control, so none passes by absence.
 *
 * Without JURAH_DATABASE_URL tests/integration/setup.ts fails every test loudly (NOT A PASS).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getSql } from '@/lib/db/client';
import { setScriptSession } from '@/lib/session/cookie';
import * as rx from '@/lib/data/pg/reads-rx';
import { PG_QUERIES_RX } from '@/lib/data/pg/reads-rx';
import { doseHistoryRefusal, dosesWithPrescriptionRefusal, draftSaveRefusal, extractionRefusal, prescriptionRefusal, prescriptionsRefusal } from '@/lib/data/refusals/reads-rx';
import { app, probe, type As } from '../helpers';
import type { Session } from '@/types/views';

const HAMAD: Session = { subjectId: 'pt-01', role: 'patient' };
const FATIMA: Session = { subjectId: 'pt-02', role: 'patient' };
const ABDULLAH: Session = { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' };
const DANA: Session = { subjectId: 'acc-11', role: 'admin' };
const NOT_ACTIVE = ['cg-03', 'cg-04', 'cg-05', 'cg-06', 'cg-07'];
const blob = (n: number) => new Blob([new Uint8Array(n)]);

async function as<T>(s: Session | null, fn: () => Promise<T>): Promise<T> {
  setScriptSession(s);
  return fn();
}
/** The session GUC withSession() would set for `s` — civil id resolved by the owner, never typed. */
async function gucFor(s: Session): Promise<Record<string, unknown>> {
  const [row] = await getSql()`select civil_id_for_session(${s.subjectId}, ${s.role ?? null}::role_t, ${!!s.pendingInvitationOnly}) as c`;
  return JSON.parse(JSON.stringify({ ...s, civilId: row?.c ?? null })) as Record<string, unknown>;
}
async function dbRows(a: As, q: keyof typeof PG_QUERIES_RX, params: unknown[]): Promise<number> {
  return probe(a, async (tx) => (await tx.unsafe(PG_QUERIES_RX[q], params as never[])).length);
}
async function counts(): Promise<Record<string, number>> {
  const [r] = await getSql()`select (select count(*)::int from prescriptions) as rx, (select count(*)::int from doses) as doses,
    (select count(*)::int from audit_events) as audit, (select count(*)::int from prescription_drafts) as drafts`;
  return { ...(r as Record<string, number>) };
}

/** The five reads, each with the pt-01 argument a forged caregiver would aim at. */
type Read = { q: keyof typeof PG_QUERIES_RX; args: readonly unknown[]; call: () => Promise<unknown>; refusal: unknown };
const READS: Record<string, Read> = {
  getPrescriptions: { q: 'getPrescriptions', args: ['pt-01'], call: () => rx.getPrescriptions('pt-01'), refusal: prescriptionsRefusal() },
  getPrescription: { q: 'getPrescription', args: ['rx-001'], call: () => rx.getPrescription('rx-001'), refusal: prescriptionRefusal() },
  getDosesForDay: { q: 'getDosesForDay', args: ['pt-01', '2026-09-21'], call: () => rx.getDosesForDay('pt-01', '2026-09-21'), refusal: dosesWithPrescriptionRefusal() },
  getDoseHistory: { q: 'getDoseHistory', args: ['rx-001'], call: () => rx.getDoseHistory('rx-001'), refusal: doseHistoryRefusal() },
  getRecentDoses: { q: 'getRecentDoses', args: ['pt-01', 7], call: () => rx.getRecentDoses('pt-01', 7), refusal: dosesWithPrescriptionRefusal() },
};

describe('positive controls — the rows each refusal hides exist and are served to their owner', () => {
  it('حمد (and his active caregiver عبدالله) read all five', async () => {
    for (const s of [HAMAD, ABDULLAH]) {
      const guc = await gucFor(s);
      for (const [name, r] of Object.entries(READS)) {
        expect(await dbRows(app(guc), r.q, [...r.args]), `${s.subjectId} ${name}`).toBeGreaterThan(0);
        expect(JSON.stringify(await as(s, r.call)), `${s.subjectId} ${name}`).not.toBe(JSON.stringify(r.refusal));
      }
    }
  });
});

describe('E-21 — pending/declined/expired/revoked caregiver sessions read nothing (prescriptions and doses)', () => {
  it('E-21 · cg-03…cg-07 forged as caregivers of pt-01 × the five reads → RLS 0 rows and the refusal bytes', async () => {
    const table: string[] = [];
    for (const id of NOT_ACTIVE) {
      const s: Session = { subjectId: id, role: 'caregiver', linkedPatientId: 'pt-01' };
      const guc = await gucFor(s);
      for (const [name, r] of Object.entries(READS)) {
        const n = await dbRows(app(guc), r.q, [...r.args]);
        const shape = JSON.stringify(await as(s, r.call));
        table.push(`${id} ${name}: db=${n} seam=${shape}`);
        expect(n, `${id} ${name}`).toBe(0);
        expect(shape, `${id} ${name}`).toBe(JSON.stringify(r.refusal));
      }
    }
    console.log(table.join('\n'));
  });
  it('E-21 · the pending-only session (ناصر) and the admin (م. دانة) read nothing either', async () => {
    for (const s of [{ subjectId: 'cg-03', pendingInvitationOnly: true } as Session, DANA]) {
      const guc = await gucFor(s);
      for (const [name, r] of Object.entries(READS)) {
        expect(await dbRows(app(guc), r.q, [...r.args]), `${s.subjectId} ${name}`).toBe(0);
        expect(JSON.stringify(await as(s, r.call)), `${s.subjectId} ${name}`).toBe(JSON.stringify(r.refusal));
      }
    }
  });
});

describe('E-49 — a wrong-patient id and a missing id are the same null', () => {
  it("E-49 · getPrescription('rx-006') (فاطمة's) as حمد vs getPrescription('rx-999')", async () => {
    const guc = await gucFor(HAMAD);
    expect(await dbRows(app(guc), 'getPrescription', ['rx-006'])).toBe(0);
    expect(await dbRows(app(guc), 'getPrescription', ['rx-999'])).toBe(0);
    expect(await dbRows(app(await gucFor(FATIMA)), 'getPrescription', ['rx-006'])).toBe(1); // positive control
    const timings: Record<string, number[]> = { 'rx-006': [], 'rx-999': [] };
    for (let i = 0; i < 20; i++) {
      for (const id of ['rx-006', 'rx-999']) {
        const t0 = performance.now();
        expect(await as(HAMAD, () => rx.getPrescription(id))).toBeNull();
        timings[id]!.push(performance.now() - t0);
      }
    }
    const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
    const m6 = median(timings['rx-006']!), m9 = median(timings['rx-999']!);
    console.log(`E-49 medians over 20: rx-006 ${m6.toFixed(1)} ms · rx-999 ${m9.toFixed(1)} ms`);
    expect(Math.max(m6, m9) / Math.min(m6, m9)).toBeLessThan(3); // same timing class (one query plan, both 0 rows)
    // the same for the dose history of a foreign prescription
    expect(JSON.stringify(await as(HAMAD, () => rx.getDoseHistory('rx-006')))).toBe(JSON.stringify(await as(HAMAD, () => rx.getDoseHistory('rx-999'))));
  });
});

describe('E-41 — savePrescriptionDraft refuses a draft the session\'s patient does not own (D-014)', () => {
  let fatimaDraft = '';
  let hamadDraft = '';
  beforeAll(async () => {
    const f = await as(FATIMA, () => rx.submitPrescriptionImage('pt-02', blob(50)));
    const h = await as(HAMAD, () => rx.submitPrescriptionImage('pt-01', blob(500)));
    if (!('draftId' in f) || !('draftId' in h)) throw new Error('setup: the drafts were not created');
    fatimaDraft = f.draftId;
    hamadDraft = h.draftId;
  });

  it("E-41 · حمد savePrescriptionDraft('pt-01' | 'pt-02', فاطمة's draft), عبدالله and no session on حمد's → nothing written", async () => {
    const before = await counts();
    const refused = [
      await as(HAMAD, () => rx.savePrescriptionDraft('pt-01', fatimaDraft)),
      await as(HAMAD, () => rx.savePrescriptionDraft('pt-02', fatimaDraft)),
      await as(ABDULLAH, () => rx.savePrescriptionDraft('pt-01', hamadDraft)),
      await as(null, () => rx.savePrescriptionDraft('pt-01', hamadDraft)),
    ];
    expect(refused.map((r) => JSON.stringify(r))).toEqual([
      JSON.stringify(draftSaveRefusal('pt-01')), JSON.stringify(draftSaveRefusal('pt-02')),
      JSON.stringify(draftSaveRefusal('pt-01')), JSON.stringify(draftSaveRefusal('pt-01')),
    ]);
    expect(await counts()).toEqual(before); // no prescription, no doses, no audit row, both drafts still there
    // DB level: RLS shows حمد no draft of فاطمة's, whichever patient id he names; عبدالله sees none of حمد's.
    expect(await dbRows(app(await gucFor(HAMAD)), 'selectDraft', [fatimaDraft, 'pt-01'])).toBe(0);
    expect(await dbRows(app(await gucFor(HAMAD)), 'selectDraft', [fatimaDraft, 'pt-02'])).toBe(0);
    expect(await dbRows(app(await gucFor(ABDULLAH)), 'selectDraft', [hamadDraft, 'pt-01'])).toBe(0);
    expect(await dbRows(app(await gucFor(FATIMA)), 'selectDraft', [fatimaDraft, 'pt-02'])).toBe(1); // positive control
  });

  it('E-41 · submitPrescriptionImage for someone else stores nothing (quiet 0-row insert, never a throw)', async () => {
    const before = await counts();
    expect(JSON.stringify(await as(ABDULLAH, () => rx.submitPrescriptionImage('pt-01', blob(500))))).toBe(JSON.stringify(extractionRefusal()));
    expect(JSON.stringify(await as(HAMAD, () => rx.submitPrescriptionImage('pt-02', blob(500))))).toBe(JSON.stringify(extractionRefusal()));
    expect(JSON.stringify(await as(null, () => rx.submitPrescriptionImage('pt-01', blob(500))))).toBe(JSON.stringify(extractionRefusal()));
    expect(await counts()).toEqual(before);
  });

  it('E-41 · positive control: the owner saves her own draft exactly once', async () => {
    const before = await counts();
    const saved = await as(FATIMA, () => rx.savePrescriptionDraft('pt-02', fatimaDraft));
    expect(saved.id).not.toBe('');
    const after = await counts();
    // a needs_review draft generates no doses (CR-002 invariant 2) and is deleted; one audit row.
    expect(after).toEqual({ ...before, rx: before.rx! + 1, audit: before.audit! + 1, drafts: before.drafts! - 1 });
    expect(JSON.stringify(await as(FATIMA, () => rx.savePrescriptionDraft('pt-02', fatimaDraft)))).toBe(JSON.stringify(draftSaveRefusal('pt-02')));
    expect(await counts()).toEqual(after);
  });
});
