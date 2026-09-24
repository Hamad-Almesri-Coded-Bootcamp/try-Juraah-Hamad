// @vitest-environment node
/**
 * AP-10 — production today has no JURAH_AGENT_SCREENING_URL. This proves nothing merged here breaks
 * the save path there: the REAL screenOrHold and the REAL lib/agent-webhooks run with the screening
 * URL empty, and each of the four triggers completes exactly as before: no fetch, no settings read
 * for a language, no hold raised, and the agent route reports `skipped`. Only the transaction is
 * scripted (no database).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prescription } from '@/types/contracts';
import type { Session } from '@/types/views';

type Respond = (q: string, params: unknown[]) => unknown[];
const h = vi.hoisted(() => ({
  session: null as unknown,
  queries: [] as string[],
  respond: (() => []) as (q: string, params: unknown[]) => unknown[],
  loaded: null as unknown,
}));
async function inTx<T>(fn: (sql: unknown) => Promise<T>): Promise<T> {
  const tag = (() => { throw new Error('tagged-template SQL is not expected here'); }) as unknown as Record<string, unknown>;
  tag.unsafe = async (q: string, params: unknown[] = []) => { h.queries.push(q); return h.respond(q, params); };
  return fn(tag);
}
vi.mock('@/lib/db/withSession', () => ({
  withSession: (_s: unknown, fn: (sql: unknown) => Promise<unknown>) => inTx(fn),
  withAgent: (fn: (sql: unknown) => Promise<unknown>) => inTx(fn),
  withSystem: (fn: (sql: unknown) => Promise<unknown>) => inTx(fn),
}));
vi.mock('@/lib/data/pg/_shared', () => ({ sessionOf: async () => h.session }));
vi.mock('@/lib/db/audit', () => ({ append: async () => undefined }));
vi.mock('@/lib/engine', async (orig) => ({
  ...(await orig<typeof import('@/lib/engine')>()),
  insertGeneratedDoses: async () => [],
  regenerateUpcoming: async () => ({ deleted: 0, inserted: 0 }),
  loadPrescription: async () => h.loaded,
}));
vi.mock('@/lib/engine/doses', async (orig) => ({ ...(await orig<typeof import('@/lib/engine/doses')>()), insertGeneratedDoses: async () => [] }));

const fetchMock = vi.fn(async () => { throw new Error('nothing may be fetched when screening is not configured'); });
let m: {
  rx: typeof import('@/lib/data/pg/reads-rx');
  writes: typeof import('@/lib/data/pg/writes');
  agent: typeof import('@/lib/data/pg/agent');
  webhooks: typeof import('@/lib/agent-webhooks');
  validate: typeof import('@/lib/agent/validate');
  seed: typeof import('@/lib/data/mock/seed');
};

beforeAll(async () => {
  vi.resetModules();
  vi.stubEnv('JURAH_AGENT_SCREENING_URL', '');
  vi.stubEnv('JURAH_AGENT_INBOUND_SECRET', 'secret-present-but-no-url');
  vi.stubGlobal('fetch', fetchMock);
  m = {
    rx: await import('@/lib/data/pg/reads-rx'),
    writes: await import('@/lib/data/pg/writes'),
    agent: await import('@/lib/data/pg/agent'),
    webhooks: await import('@/lib/agent-webhooks'),
    validate: await import('@/lib/agent/validate'),
    seed: await import('@/lib/data/mock/seed'),
  };
});
afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
beforeEach(() => { h.queries = []; h.respond = () => []; h.loaded = null; fetchMock.mockClear(); });

const HAMAD: Session = { subjectId: 'pt-01', role: 'patient' };
/** Nothing screening-related ran: no fetch, no language read, no hold insert. */
function nothingScreened() {
  expect(fetchMock).not.toHaveBeenCalled();
  expect(h.queries).not.toContain(m.agent.PG_QUERIES_AGENT.patientLanguage);
  expect(h.queries).not.toContain(m.agent.PG_QUERIES_AGENT.insertAlert);
}

describe('screening NOT configured (production today)', () => {
  it('the configuration really reads as not configured', () => {
    expect(m.webhooks.screeningConfigured()).toBe(false);
  });

  it('savePrescriptionDraft saves and returns the prescription, and nothing is screened or held', async () => {
    h.session = HAMAD;
    let inserted: Record<string, unknown> | null = null;
    h.respond = ((q, params) => {
      const Q = m.rx.PG_QUERIES_RX;
      if (q === Q.selectDraft) return [{ prescription: { drug: { genericName: 'Ibuprofen', strengthMg: 400, strengthUnit: 'mg' }, dosePerAdministration: 1, frequencyPerDay: 1, durationDays: 7, dosingPattern: 'daily', doseTimes: ['08:00'], startDate: '2026-09-21', needsReview: false, status: 'active' } }];
      if (q === Q.insertPrescription) { inserted = params[0] as Record<string, unknown>; return []; }
      if (q === Q.getPrescription) return inserted ? [inserted] : [];
      return [];
    }) as Respond;
    const saved = await m.rx.savePrescriptionDraft('pt-01', 'draft_1');
    expect(saved.drug.genericName).toBe('Ibuprofen');
    expect(h.queries).not.toContain(m.rx.PG_QUERIES_RX.selectLanguage); // not even read (unchanged CR-049 path)
    nothingScreened();
  });

  it('POST /api/agent/prescriptions\' insert returns ok with screening "skipped"', async () => {
    const v = m.validate.parsePrescriptionBody({
      patientId: 'pt-01', needsReview: false,
      prescription: { source: { facilityName: 'مستشفى الفروانية', sector: 'public' }, drug: { genericName: 'Amoxicillin', strengthMg: 500, strengthUnit: 'mg' }, dosePerAdministration: 1, frequencyPerDay: 1, durationDays: 7, dosingPattern: 'daily', startDate: '2026-09-21', doseTimes: ['08:00'] },
    });
    if (!v.ok) throw new Error('fixture invalid');
    h.respond = (q, params) => (q === m.agent.PG_QUERIES_AGENT.insertPrescription ? [params[0] as Record<string, unknown>] : []);
    const r = await m.agent.insertExtractedPrescription(v.value);
    expect(r).toMatchObject({ kind: 'ok', screening: 'skipped' });
    nothingScreened();
  });

  it('confirmPrescriptionFields confirms, and nothing is screened or held', async () => {
    h.session = { subjectId: 'acc-10', role: 'reviewer' } as Session;
    h.loaded = m.seed.buildPrescriptions().find((p) => p.id === 'rx-006');
    h.respond = (q) => {
      if (q === m.writes.PG_QUERIES_WRITES.reviewerContext) return [{ reviewer: true, subject_id: 'acc-10', now: '2026-09-21T09:15:00+03:00' }];
      if (q === m.writes.PG_QUERIES_WRITES.confirmPrescriptionFields) return Object.assign([], { count: 1 });
      return [];
    };
    const confirmed: Prescription = await m.writes.confirmPrescriptionFields('rx-006', { drug: { genericName: '(unreadable)', strengthMg: 5 }, frequencyPerDay: 1, startDate: '2026-09-20', doseTimes: ['09:00'] });
    expect(confirmed.fieldReviewStatus).toBe('confirmed');
    nothingScreened();
  });

  it('requestRefill creates the request, and nothing is screened or held', async () => {
    h.session = HAMAD;
    h.loaded = m.seed.buildPrescriptions().find((p) => p.id === 'rx-001');
    h.respond = (q) => {
      if (q === m.writes.PG_QUERIES_WRITES.insertRefill) return [{ id: 'rf_01', patient_id: 'pt-01', prescription_id: 'rx-001', requested_at: '2026-09-21T09:15:00+03:00', routed_to: 'public_pharmacy', status: 'requested' }];
      return [];
    };
    const refill = await m.writes.requestRefill('pt-01', 'rx-001');
    expect(refill).toMatchObject({ id: 'rf_01', status: 'requested' });
    nothingScreened();
  });
});
