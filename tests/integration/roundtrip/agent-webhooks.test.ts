/**
 * CR-066 round trip — the agent path of checkDrugPhoto · submitPrescriptionImage · savePrescriptionDraft
 * through the REAL Postgres path (withSession → jurah_app + RLS), with n8n replaced by a stubbed
 * fetch whose answers are built by the agents' OWN code (agents/knowledge/src). Proves: the draft the
 * agent read is stored and saved with its real source and unit; the screening webhook is called only
 * AFTER the save committed and only for an unflagged prescription; nobody but the patient reaches an
 * agent. The stub path is covered, unchanged, by rx.test.ts / clinic.test.ts.
 *
 * Without JURAH_DATABASE_URL tests/integration/setup.ts fails every test loudly (NOT A PASS).
 */
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/types/views';

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

type Mods = {
  rx: typeof import('@/lib/data/pg/reads-rx');
  clinic: typeof import('@/lib/data/pg/reads-clinic');
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
  m = {
    rx: await import('@/lib/data/pg/reads-rx'),
    clinic: await import('@/lib/data/pg/reads-clinic'),
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
