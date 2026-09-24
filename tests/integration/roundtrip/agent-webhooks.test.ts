/**
 * CR-066 round trip — the agent path of checkDrugPhoto · submitPrescriptionImage · savePrescriptionDraft
 * through the REAL Postgres path (withSession → jurah_app + RLS), with n8n replaced by a stubbed
 * fetch whose answers are built by the agents' OWN code (agents/knowledge/src). Proves: the draft the
 * agent read is stored and saved with its real source and unit; the screening webhook is called only
 * AFTER the save committed and only for an unflagged prescription; nobody but the patient reaches an
 * agent. The stub path is covered, unchanged, by rx.test.ts / clinic.test.ts.
 *
 * AP-10 (the last describe): screening on every other path, against the database: a reviewer's
 * confirmation (TC-IX-06), a refill request (D10), an agent's save through POST
 * /api/agent/prescriptions (CR-090), and the hold, audited as the agent, when n8n does not accept the
 * job. Run it only against a Supabase TEST BRANCH (CR-080, D8): it commits prescriptions, refills
 * and alerts. The branch costs money, so the run is owed until the cost is approved.
 *
 * Without JURAH_DATABASE_URL tests/integration/setup.ts fails every test loudly (NOT A PASS).
 */
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/types/views';
import { copy } from '@/i18n';

const require = createRequire(import.meta.url);
const E = require('../../../agents/knowledge/src/extraction.js');
const T = require('../../../agents/knowledge/src/travel-check.js');

const URLS = {
  JURAH_AGENT_TRAVEL_CHECK_URL: 'https://n8n.example/webhook/jurah/travel-check',
  JURAH_AGENT_EXTRACTION_URL: 'https://n8n.example/webhook/jurah/extract-prescription',
  JURAH_AGENT_SCREENING_URL: 'https://n8n.example/webhook/jurah/screen-prescription',
  JURAH_AGENT_INBOUND_SECRET: 'integration-inbound-secret',
};
const SARA: Session = { subjectId: 'pt-03', role: 'patient' };
const HAMAD: Session = { subjectId: 'pt-01', role: 'patient' };
const ABDULLAH: Session = { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' };
const JPEG = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(300).fill(7)])], { type: 'image/jpeg' });

const SURE = Object.fromEntries(E.CONFIDENCE_KEYS.map((k: string) => [k, 0.95]));
const CLEAR = {
  isPrescription: true, facilityName: 'مستشفى العدان', sector: 'public', genericName: 'Levothyroxine', brandName: 'Eltroxin',
  strength: 50, strengthUnit: 'mcg', dosePerAdministration: 1, frequencyPerDay: 1, doseTimes: ['07:00'],
  dosingPattern: 'daily', durationDays: 30, startDate: '2026-09-21', confidence: SURE,
};

const KHALID: Session = { subjectId: 'acc-10', role: 'reviewer' };

type Mods = {
  rx: typeof import('@/lib/data/pg/reads-rx');
  clinic: typeof import('@/lib/data/pg/reads-clinic');
  writes: typeof import('@/lib/data/pg/writes');
  agentRoute: typeof import('@/app/api/agent/prescriptions/route');
  cookie: typeof import('@/lib/session/cookie');
  db: typeof import('@/lib/db/client');
};
let m: Mods;
const fetchMock = vi.fn();
const reply = (status: number, body: unknown) => ({ status, json: async () => body });
const calls = (url: string) => fetchMock.mock.calls.filter(([u]) => u === url);

beforeAll(async () => {
  vi.resetModules();
  for (const [k, v] of Object.entries(URLS)) vi.stubEnv(k, v);
  vi.stubEnv('JURAH_DATA_BACKEND', 'postgres'); // the agent route answers 503 under the mock
  m = {
    rx: await import('@/lib/data/pg/reads-rx'),
    clinic: await import('@/lib/data/pg/reads-clinic'),
    writes: await import('@/lib/data/pg/writes'),
    agentRoute: await import('@/app/api/agent/prescriptions/route'),
    cookie: await import('@/lib/session/cookie'),
    db: await import('@/lib/db/client'),
  };
  vi.stubGlobal('fetch', fetchMock);
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
beforeEach(() => fetchMock.mockReset());

async function as<T>(s: Session | null, fn: () => Promise<T>): Promise<T> {
  m.cookie.setScriptSession(s);
  return fn();
}

describe('B4 → Extraction agent → draft → save → Screening agent', () => {
  it('a clear prescription: stored draft, saved with the real source and unit, then screened', async () => {
    let committedWhenScreened = false;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === URLS.JURAH_AGENT_EXTRACTION_URL) return reply(200, { ok: true, appOutcome: E.toPrescriptionBody({ patientId: 'pt-03', model: CLEAR }).appOutcome });
      if (url === URLS.JURAH_AGENT_SCREENING_URL) {
        // The agent reads the prescription back: it must already be COMMITTED when screening is asked.
        const body = JSON.parse(String(fetchMock.mock.calls.at(-1)![1].body));
        const [row] = await m.db.getSql()`select id from prescriptions where id = ${body.newPrescriptionId}`;
        committedWhenScreened = !!row;
        return reply(row ? 200 : 500, { message: 'Workflow was started' });
      }
      return reply(404, null);
    });

    const extraction = await as(SARA, () => m.rx.submitPrescriptionImage('pt-03', JPEG()));
    expect(extraction.kind).toBe('confident');
    if (extraction.kind !== 'confident') return;
    const sent = JSON.parse(String(calls(URLS.JURAH_AGENT_EXTRACTION_URL)[0]![1].body));
    expect(sent).toMatchObject({ patientId: 'pt-03', mimeType: 'image/jpeg', save: false });
    expect(calls(URLS.JURAH_AGENT_EXTRACTION_URL)[0]![1].headers['x-jurah-secret']).toBe(URLS.JURAH_AGENT_INBOUND_SECRET);

    const [draft] = await m.db.getSql()`select confident, octet_length(image) as bytes from prescription_drafts where draft_id = ${extraction.draftId}`;
    expect(draft).toMatchObject({ confident: true, bytes: 304 });

    const saved = await as(SARA, () => m.rx.savePrescriptionDraft('pt-03', extraction.draftId));
    expect(saved.source).toEqual({ facilityName: 'مستشفى العدان', sector: 'public' });
    expect(saved.drug).toEqual({ genericName: 'Levothyroxine', brandName: 'Eltroxin', strengthMg: 50, strengthUnit: 'mcg' });
    expect(saved.needsReview).toBe(false);
    const [doseCount] = await m.db.getSql()`select count(*)::int as n from doses where prescription_id = ${saved.id}`;
    expect(doseCount!.n).toBe(30);

    const screen = calls(URLS.JURAH_AGENT_SCREENING_URL);
    expect(screen).toHaveLength(1);
    expect(JSON.parse(String(screen[0]![1].body))).toEqual({ patientId: 'pt-03', newPrescriptionId: saved.id, language: 'ar' });
    expect(committedWhenScreened).toBe(true);
    const [draftGone] = await m.db.getSql()`select count(*)::int as n from prescription_drafts where draft_id = ${extraction.draftId}`;
    expect(draftGone!.n).toBe(0);
  });

  it('an unsure field: needs_review draft, saved flagged for the reviewer, and NOT screened yet', async () => {
    const model = { ...CLEAR, startDate: null };
    fetchMock.mockImplementation(async (url: string) =>
      url === URLS.JURAH_AGENT_EXTRACTION_URL ? reply(200, { appOutcome: E.toPrescriptionBody({ patientId: 'pt-03', model }).appOutcome }) : reply(200, {}));
    const extraction = await as(SARA, () => m.rx.submitPrescriptionImage('pt-03', JPEG()));
    expect(extraction.kind).toBe('needs_review');
    if (extraction.kind !== 'needs_review') return;
    expect(extraction.uncertainFields).toEqual(['startDate']);
    const saved = await as(SARA, () => m.rx.savePrescriptionDraft('pt-03', extraction.draftId));
    expect(saved.needsReview).toBe(true);
    expect(saved.fieldReviewStatus).toBe('pending');
    expect(saved.startDate).toBeUndefined();
    const [doseCount] = await m.db.getSql()`select count(*)::int as n from doses where prescription_id = ${saved.id}`;
    expect(doseCount!.n).toBe(0);
    expect(calls(URLS.JURAH_AGENT_SCREENING_URL)).toHaveLength(0);
  });

  it('not a prescription, or n8n down: unreadable and nothing stored', async () => {
    const before = await m.db.getSql()`select count(*)::int as n from prescription_drafts`;
    fetchMock.mockResolvedValueOnce(reply(200, { appOutcome: E.toPrescriptionBody({ patientId: 'pt-03', model: { isPrescription: false } }).appOutcome }));
    expect(await as(SARA, () => m.rx.submitPrescriptionImage('pt-03', JPEG()))).toEqual({ kind: 'unreadable' });
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await as(SARA, () => m.rx.submitPrescriptionImage('pt-03', JPEG()))).toEqual({ kind: 'unreadable' });
    const after = await m.db.getSql()`select count(*)::int as n from prescription_drafts`;
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it('nobody but the patient reaches the agent: a caregiver, another patient, no session', async () => {
    expect(await as(ABDULLAH, () => m.rx.submitPrescriptionImage('pt-01', JPEG()))).toEqual({ kind: 'unreadable' });
    expect(await as(HAMAD, () => m.rx.submitPrescriptionImage('pt-03', JPEG()))).toEqual({ kind: 'unreadable' });
    expect(await as(null, () => m.rx.submitPrescriptionImage('pt-03', JPEG()))).toEqual({ kind: 'unreadable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('C3 → Travel Check agent', () => {
  it('the agent’s outcome reaches the screen, with the patient’s language', async () => {
    const outcome = T.appOutcomeFor('interaction_found', 'Clarithromycin', 'ia-travel-1');
    fetchMock.mockResolvedValueOnce(reply(200, { ok: true, appOutcome: outcome }));
    expect(await as(HAMAD, () => m.clinic.checkDrugPhoto('pt-01', JPEG()))).toEqual(outcome);
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1].body));
    expect(body).toMatchObject({ patientId: 'pt-01', mimeType: 'image/jpeg', language: 'ar' });
  });

  it('n8n failing is could_not_identify — never the stub’s Warfarin answer', async () => {
    fetchMock.mockResolvedValueOnce(reply(502, null));
    expect(await as(HAMAD, () => m.clinic.checkDrugPhoto('pt-01', JPEG()))).toEqual({ kind: 'could_not_identify' });
  });

  it('a caregiver or another patient never reaches the agent', async () => {
    expect(await as(ABDULLAH, () => m.clinic.checkDrugPhoto('pt-01', JPEG()))).toEqual({ kind: 'could_not_identify' });
    expect(await as(SARA, () => m.clinic.checkDrugPhoto('pt-01', JPEG()))).toEqual({ kind: 'could_not_identify' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('AP-10 · screening on every path, against the database', () => {
  const TOKEN = () => (process.env.JURAH_AGENT_TOKEN ?? '').trim();
  const agentPost = (body: unknown) =>
    new Request('http://localhost:3000/api/agent/prescriptions', {
      method: 'POST', headers: { authorization: `Bearer ${TOKEN()}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
  /** n8n accepts the job; the row it is about must already be COMMITTED when it is asked. */
  function acceptScreening(check: (id: string) => Promise<boolean>): { committed: () => boolean } {
    let committed = false;
    fetchMock.mockImplementation(async (url: string, init: { body: string }) => {
      if (url !== URLS.JURAH_AGENT_SCREENING_URL) return reply(404, null);
      committed = await check(JSON.parse(String(init.body)).newPrescriptionId);
      return reply(200, { message: 'Workflow was started' });
    });
    return { committed: () => committed };
  }

  it('TC-IX-06: a reviewer confirming a flagged prescription screens it after the commit, in the patient\'s language', async () => {
    const seen = acceptScreening(async (id) => {
      const [row] = await m.db.getSql()`select needs_review, field_review_status::text as s from prescriptions where id = ${id}`;
      return row?.needs_review === false && row?.s === 'confirmed';
    });
    const confirmed = await as(KHALID, () => m.writes.confirmPrescriptionFields('rx-006', { drug: { genericName: '(unreadable)', brandName: 'Panadol', strengthMg: 500 }, frequencyPerDay: 1, startDate: '2026-09-20', doseTimes: ['09:00'] }, 'تم التأكيد'));
    expect(confirmed.fieldReviewStatus).toBe('confirmed');
    const screen = calls(URLS.JURAH_AGENT_SCREENING_URL);
    expect(screen).toHaveLength(1);
    expect(JSON.parse(String(screen[0]![1].body))).toEqual({ patientId: 'pt-02', newPrescriptionId: 'rx-006', language: 'ar' });
    expect(seen.committed()).toBe(true);
  });

  it('D10: a refill request re-screens that prescription after the request committed', async () => {
    const count = async (id: string) => (await m.db.getSql()`select count(*)::int as n from refill_requests where prescription_id = ${id}`)[0]!.n as number;
    const before = await count('rx-001');
    const seen = acceptScreening(async (id) => (await count(id)) === before + 1);
    const refill = await as(HAMAD, () => m.writes.requestRefill('pt-01', 'rx-001'));
    expect(refill.id).toMatch(/^rf_/);
    const screen = calls(URLS.JURAH_AGENT_SCREENING_URL);
    expect(screen).toHaveLength(1);
    expect(JSON.parse(String(screen[0]![1].body))).toEqual({ patientId: 'pt-01', newPrescriptionId: 'rx-001', language: 'ar' });
    expect(seen.committed()).toBe(true);
  });

  it('a request n8n does not accept is HELD: one pending warning on that prescription, empty citation, raised by the agent', async () => {
    fetchMock.mockImplementation(async (url: string) => (url === URLS.JURAH_AGENT_SCREENING_URL ? reply(502, null) : reply(404, null)));
    const refill = await as(HAMAD, () => m.writes.requestRefill('pt-01', 'rx-003'));
    expect(refill.id).toMatch(/^rf_/); // the refill stands whatever n8n answers
    expect(calls(URLS.JURAH_AGENT_SCREENING_URL)).toHaveLength(1);
    const holds = await m.db.getSql()`
      select id, source_citation, description from interaction_alerts
       where patient_id = 'pt-01' and involved_prescription_ids = array['rx-003']::text[]
         and severity = 'warning' and review_status = 'pending_medical_review'`;
    expect(holds).toHaveLength(1);
    expect(holds[0]).toMatchObject({ source_citation: '', description: copy.safety.screeningHeldTemplate.ar.replace('{drug}', 'Metformin') });
    const [audit] = await m.db.getSql()`select actor_role::text as actor from audit_events where type = 'alert_raised' and related_id = ${String(holds[0]!.id)}`;
    expect(audit).toEqual({ actor: 'agent' });
    // …and it is in the reviewer's queue.
    const queue = await as(KHALID, () => m.clinic.getReviewQueue());
    expect(queue.map((q) => q.alertId)).toContain(String(holds[0]!.id));
  });

  it('CR-090: POST /api/agent/prescriptions screens an unflagged save itself and says so; a flagged one is not screened yet', async () => {
    if (!TOKEN()) throw new Error('JURAH_AGENT_TOKEN is not set: the agent route refuses everyone; NOT A PASS');
    m.cookie.setScriptSession(null);
    const seen = acceptScreening(async (id) => {
      const [row] = await m.db.getSql()`select id from prescriptions where id = ${id}`;
      return !!row;
    });
    const prescription = {
      source: { facilityName: 'Mubarak Al-Kabeer Hospital pharmacy', sector: 'public' }, drug: { genericName: 'Amoxicillin', strengthMg: 500, strengthUnit: 'mg' },
      dosePerAdministration: 1, frequencyPerDay: 3, durationDays: 7, dosingPattern: 'daily', startDate: '2026-09-21', doseTimes: ['08:00', '14:00', '20:00'],
    };
    const ok = await m.agentRoute.POST(agentPost({ patientId: 'pt-01', needsReview: false, prescription }));
    expect(ok.status).toBe(201);
    const j = (await ok.json()) as { prescription: { id: string }; screening: string };
    expect(j.screening).toBe('screened');
    const screen = calls(URLS.JURAH_AGENT_SCREENING_URL);
    expect(screen).toHaveLength(1);
    expect(JSON.parse(String(screen[0]![1].body))).toEqual({ patientId: 'pt-01', newPrescriptionId: j.prescription.id, language: 'ar' });
    expect(seen.committed()).toBe(true);

    fetchMock.mockClear();
    const { startDate: _sd, ...unsure } = prescription;
    void _sd;
    const flagged = await m.agentRoute.POST(agentPost({ patientId: 'pt-01', needsReview: true, uncertainFields: ['startDate'], prescription: unsure }));
    expect(flagged.status).toBe(201);
    expect(((await flagged.json()) as { screening: string }).screening).toBe('skipped');
    expect(calls(URLS.JURAH_AGENT_SCREENING_URL)).toHaveLength(0);
  });
});
