// @vitest-environment node
/**
 * AP-10 — screening on every path: the runtime half beside guard R (scripts/guards/
 * screening-on-every-path.ts). Each of the four triggers is run through its REAL Postgres
 * implementation with the transaction replaced by a scripted one (no database) and screenOrHold
 * replaced by a recorder, so the test proves, per trigger:
 *   - screening is called for THAT prescription, AFTER the transaction has committed (the agent reads
 *     the prescription back, so it must already be there);
 *   - it is AWAITED: the seam function does not return before screening has answered;
 *   - a refused or rolled-back write screens nothing.
 * The decision inside screenOrHold (flagged → skipped, not configured → skipped, not accepted →
 * held) is proved in ./screen-or-hold.test.ts; the not-configured production path end to end in
 * ./not-configured.test.ts; the database itself in tests/integration/roundtrip/agent-webhooks.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prescription } from '@/types/contracts';
import type { Session } from '@/types/views';

type Respond = (q: string, params: unknown[]) => unknown[] | Promise<unknown[]>;
const h = vi.hoisted(() => ({
  session: null as unknown,
  events: [] as string[],
  respond: (() => []) as (q: string, params: unknown[]) => unknown[] | Promise<unknown[]>,
  screenCalls: [] as unknown[][],
  gate: Promise.resolve() as Promise<void>,
  outcome: 'screened' as 'screened' | 'held' | 'skipped',
  loaded: null as unknown,
}));

function fakeSql() {
  const tag = (() => { throw new Error('tagged-template SQL is not expected on these paths'); }) as unknown as Record<string, unknown>;
  tag.unsafe = async (q: string, params: unknown[] = []) => h.respond(q, params);
  return tag;
}
async function inTx<T>(fn: (sql: unknown) => Promise<T>): Promise<T> {
  h.events.push('begin');
  const r = await fn(fakeSql());
  h.events.push('commit');
  return r;
}

vi.mock('@/lib/db/withSession', () => ({
  withSession: (_s: unknown, fn: (sql: unknown) => Promise<unknown>) => inTx(fn),
  withAgent: (fn: (sql: unknown) => Promise<unknown>) => inTx(fn),
  withSystem: (fn: (sql: unknown) => Promise<unknown>) => inTx(fn),
}));
vi.mock('@/lib/data/pg/_shared', () => ({ sessionOf: async () => h.session }));
vi.mock('@/lib/db/audit', () => ({ append: async (_sql: unknown, e: { type: string }) => { h.events.push(`audit:${e.type}`); } }));
vi.mock('@/lib/engine', async (orig) => ({
  ...(await orig<typeof import('@/lib/engine')>()),
  insertGeneratedDoses: async () => [],
  regenerateUpcoming: async () => ({ deleted: 0, inserted: 0 }),
  loadPrescription: async () => h.loaded,
}));
vi.mock('@/lib/engine/doses', async (orig) => ({ ...(await orig<typeof import('@/lib/engine/doses')>()), insertGeneratedDoses: async () => [] }));
vi.mock('@/lib/agent-webhooks', () => ({
  screeningConfigured: () => true,
  extractionConfigured: () => false,
  askExtraction: async () => null,
  requestScreening: async () => { throw new Error('screening goes through screenOrHold only'); },
}));
vi.mock('@/lib/data/pg/screening', () => ({
  screenOrHold: async (...args: unknown[]) => {
    h.events.push('screen');
    h.screenCalls.push(args);
    await h.gate;
    h.events.push('screen answered');
    return h.outcome;
  },
}));

import { buildPrescriptions } from '@/lib/data/mock/seed';
import { parsePrescriptionBody } from '@/lib/agent/validate';
import { PG_QUERIES_RX, savePrescriptionDraft } from '@/lib/data/pg/reads-rx';
import { confirmPrescriptionFields, PG_QUERIES_WRITES, requestRefill } from '@/lib/data/pg/writes';
import { insertExtractedPrescription, PG_QUERIES_AGENT } from '@/lib/data/pg/agent';

const HAMAD: Session = { subjectId: 'pt-01', role: 'patient' };
const KHALID: Session = { subjectId: 'acc-10', role: 'reviewer' };
const seedRx = (id: string) => buildPrescriptions().find((p) => p.id === id)!;

const CONFIDENT_DRAFT: Partial<Prescription> = {
  drug: { genericName: 'Ibuprofen', brandName: 'Brufen', strengthMg: 400, strengthUnit: 'mg' }, dosePerAdministration: 1,
  frequencyPerDay: 3, durationDays: 7, dosingPattern: 'daily', doseTimes: ['08:00', '14:00', '20:00'], startDate: '2026-09-21',
  needsReview: false, status: 'active',
};

/** Starts the call with screening held open, proves it has NOT returned while screening is pending, then releases it. */
async function runHeldOpen<T>(call: () => Promise<T>): Promise<T> {
  let release!: () => void;
  h.gate = new Promise<void>((r) => { release = r; });
  let settled = false;
  const p = call().then((v) => { settled = true; return v; });
  for (let i = 0; i < 50 && !h.events.includes('screen'); i++) await new Promise((r) => setTimeout(r, 2));
  expect(h.events, 'screening was reached').toContain('screen');
  await new Promise((r) => setTimeout(r, 10));
  expect(settled, 'the seam function returned before screening answered (fire-and-forget)').toBe(false);
  release();
  const v = await p;
  expect(settled).toBe(true);
  return v;
}

beforeEach(() => {
  h.session = null; h.events = []; h.screenCalls = []; h.gate = Promise.resolve(); h.outcome = 'screened'; h.loaded = null;
  h.respond = () => [];
});

describe('trigger 1 · the patient saves an unflagged draft (savePrescriptionDraft)', () => {
  it('screens the saved prescription after the commit, in the patient\'s language, and returns only once screening answered', async () => {
    h.session = HAMAD;
    let inserted: Record<string, unknown> | null = null;
    h.respond = ((q, params) => {
      if (q === PG_QUERIES_RX.selectDraft) return [{ prescription: CONFIDENT_DRAFT }];
      if (q === PG_QUERIES_RX.insertPrescription) { inserted = params[0] as Record<string, unknown>; return []; }
      if (q === PG_QUERIES_RX.selectTracking) return [{ adherence_check_in_enabled: false }];
      if (q === PG_QUERIES_RX.selectLanguage) return [{ language: 'en' }];
      if (q === PG_QUERIES_RX.getPrescription) return inserted ? [inserted] : [];
      return [];
    }) as Respond;
    const saved = await runHeldOpen(() => savePrescriptionDraft('pt-01', 'draft_1'));
    expect(saved.drug.genericName).toBe('Ibuprofen');
    expect(saved.needsReview).toBe(false);
    expect(h.events).toEqual(['begin', 'audit:prescription_added', 'commit', 'screen', 'screen answered']);
    expect(h.screenCalls).toHaveLength(1);
    const [patientId, rx, language] = h.screenCalls[0]! as [string, Prescription, string];
    expect([patientId, rx.id, language]).toEqual(['pt-01', saved.id, 'en']);
  });
  it('a draft that is not the patient\'s own saves nothing and screens nothing', async () => {
    h.session = HAMAD;
    h.respond = () => [];
    await savePrescriptionDraft('pt-01', 'draft_of_someone_else');
    expect(h.screenCalls).toEqual([]);
  });
});

describe('trigger 2 · an agent saves a prescription (POST /api/agent/prescriptions → insertExtractedPrescription)', () => {
  const input = (needsReview: boolean) => {
    const v = parsePrescriptionBody({
      patientId: 'pt-01', needsReview, ...(needsReview ? { uncertainFields: ['startDate'] } : {}),
      prescription: {
        source: { facilityName: 'مستشفى الفروانية', sector: 'public' }, drug: { genericName: 'Amoxicillin', strengthMg: 500, strengthUnit: 'mg' },
        dosePerAdministration: 1, frequencyPerDay: 3, durationDays: 7, dosingPattern: 'daily',
        ...(needsReview ? {} : { startDate: '2026-09-21' }), doseTimes: ['08:00', '14:00', '20:00'],
      },
    });
    if (!v.ok) throw new Error(`fixture invalid: ${JSON.stringify(v)}`);
    return v.value;
  };
  const respond: Respond = (q, params) => (q === PG_QUERIES_AGENT.insertPrescription ? [params[0] as Record<string, unknown>] : []);

  it('screens the inserted prescription after the commit, and reports what it did in the result (the 201 body)', async () => {
    h.respond = respond;
    h.outcome = 'held';
    const r = await runHeldOpen(() => insertExtractedPrescription(input(false)));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.screening).toBe('held');
    expect(h.events).toEqual(['begin', 'audit:prescription_added', 'commit', 'screen', 'screen answered']);
    const [patientId, rx, language] = h.screenCalls[0]! as [string, Prescription, string | undefined];
    expect([patientId, rx.id, rx.needsReview, language]).toEqual(['pt-01', r.prescription.id, false, undefined]);
  });
  it('a flagged one reaches screenOrHold with its flag, which skips it until the reviewer confirms it', async () => {
    h.respond = respond;
    h.outcome = 'skipped';
    const r = await insertExtractedPrescription(input(true));
    expect(r.kind === 'ok' && r.screening).toBe('skipped');
    expect((h.screenCalls[0]![1] as Prescription).needsReview).toBe(true);
  });
  it('a database refusal returns the constraint and screens nothing', async () => {
    h.respond = (q) => {
      if (q === PG_QUERIES_AGENT.insertPrescription) throw Object.assign(new Error('violates'), { code: '23514', constraint_name: 'rx_dose_times_match_frequency' });
      return [];
    };
    expect(await insertExtractedPrescription(input(false))).toEqual({ kind: 'refused', constraint: 'rx_dose_times_match_frequency' });
    expect(h.screenCalls).toEqual([]);
  });
});

describe('trigger 3 · a reviewer confirms a flagged prescription (confirmPrescriptionFields, TC-IX-06)', () => {
  const VALUES = { drug: { genericName: '(unreadable)', strengthMg: 5 }, frequencyPerDay: 1, startDate: '2026-09-20', doseTimes: ['09:00'] };
  const respond = (count: number): Respond => (q) => {
    if (q === PG_QUERIES_WRITES.reviewerContext) return [{ reviewer: true, subject_id: 'acc-10', now: '2026-09-21T09:15:00+03:00' }];
    if (q === PG_QUERIES_WRITES.confirmPrescriptionFields) return Object.assign([], { count });
    return [];
  };

  it('screens the now-unflagged prescription after the commit, in the PATIENT\'s language (read by screenOrHold)', async () => {
    h.session = KHALID;
    h.loaded = seedRx('rx-006');
    h.respond = respond(1);
    const confirmed = await runHeldOpen(() => confirmPrescriptionFields('rx-006', VALUES, 'تم التأكيد'));
    expect(confirmed.needsReview).toBe(false);
    expect(h.events).toEqual(['begin', 'audit:prescription_field_confirmed', 'commit', 'screen', 'screen answered']);
    expect(h.screenCalls).toHaveLength(1);
    const [patientId, rx, language] = h.screenCalls[0]! as [string, Prescription, string | undefined];
    expect([patientId, rx.id, rx.needsReview, rx.fieldReviewStatus, language]).toEqual(['pt-02', 'rx-006', false, 'confirmed', undefined]);
  });
  it('a confirmation the database refuses (0 rows: already decided) is rolled back and screens nothing', async () => {
    h.session = KHALID;
    h.loaded = seedRx('rx-006');
    h.respond = respond(0);
    await confirmPrescriptionFields('rx-006', VALUES, 'تم التأكيد');
    expect(h.screenCalls).toEqual([]);
  });
});

describe('trigger 4 · a refill request (requestRefill, D10 / CR-082)', () => {
  const ROW = { id: 'rf_01', patient_id: 'pt-01', prescription_id: 'rx-001', requested_at: '2026-09-21T09:15:00+03:00', routed_to: 'public_pharmacy', status: 'requested' };

  it('re-screens the refilled prescription\'s pairs after the commit, and returns only once screening answered', async () => {
    h.session = HAMAD;
    h.loaded = seedRx('rx-001');
    h.respond = (q) => {
      if (q === PG_QUERIES_WRITES.insertRefill) return [ROW];
      if (q === PG_QUERIES_WRITES.genericName) return [{ generic_name: 'Warfarin' }];
      return [];
    };
    const refill = await runHeldOpen(() => requestRefill('pt-01', 'rx-001'));
    expect(refill).toMatchObject({ id: 'rf_01', prescriptionId: 'rx-001', status: 'requested' });
    expect(h.events).toEqual(['begin', 'audit:refill_requested', 'commit', 'screen', 'screen answered']);
    const [patientId, rx, language] = h.screenCalls[0]! as [string, Prescription, string | undefined];
    expect([patientId, rx.id, language]).toEqual(['pt-01', 'rx-001', undefined]);
  });
  it('a refused refill (the refill_routing trigger raises: not the patient\'s, or not active) screens nothing', async () => {
    h.session = HAMAD;
    h.loaded = seedRx('rx-004');
    h.respond = (q) => {
      if (q === PG_QUERIES_WRITES.insertRefill) throw Object.assign(new Error('refill_routing: prescription not active'), { code: 'P0001' });
      return [];
    };
    const refused = await requestRefill('pt-01', 'rx-004');
    expect(refused.id).toBe(''); // the mock's refusal shape (D-022): no request was created
    expect(h.screenCalls).toEqual([]);
  });
  it('a refill RLS hides (0 rows) screens nothing', async () => {
    h.session = HAMAD;
    h.loaded = seedRx('rx-008');
    h.respond = () => [];
    await requestRefill('pt-01', 'rx-008');
    expect(h.screenCalls).toEqual([]);
  });
});
