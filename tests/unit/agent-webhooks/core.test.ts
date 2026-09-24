// @vitest-environment node
/**
 * CR-066 — lib/agent-webhooks/core.ts, the seam's readers of the drug-knowledge agents' answers.
 * Both halves are real: the answers are built by the agents' OWN code (agents/knowledge/src, the code
 * inlined into the n8n workflows), then read by the app's reader — so a shape change on either side
 * fails here. Anything else n8n could send must become the conservative outcome.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  draftSource, extractionPayload, languageOf, mimeOf, readDrugCheck, readExtraction, screeningPayload, shouldScreen,
  travelPayload, webhookConfigured,
} from '@/lib/agent-webhooks/core';
import { buildPrescriptions } from '@/lib/data/mock/seed';

const require = createRequire(import.meta.url);
const E = require('../../../agents/knowledge/src/extraction.js');
const T = require('../../../agents/knowledge/src/travel-check.js');
const I = require('../../../agents/knowledge/src/interactions.js');
const R = require('../../../agents/knowledge/src/resolve.js');
const index = I.loadIndex(require('../../../agents/knowledge/data/interaction-index.json'));
const brandIndex = R.buildBrandIndex(require('../../../agents/knowledge/data/brand-map.json').brands, index);

describe('webhookConfigured', () => {
  it('accepts an https /webhook/ URL with a secret, and nothing else', () => {
    expect(webhookConfigured('https://x.app.n8n.cloud/webhook/jurah/travel-check', 's')).toBe(true);
    expect(webhookConfigured('https://x.app.n8n.cloud/webhook-test/jurah/travel-check', 's')).toBe(false);
    expect(webhookConfigured('http://x.app.n8n.cloud/webhook/jurah/travel-check', 's')).toBe(false);
    expect(webhookConfigured('https://x.app.n8n.cloud/webhook/jurah/travel-check', '')).toBe(false);
    expect(webhookConfigured('', 's')).toBe(false);
  });
});

describe('languageOf', () => {
  it('is Arabic unless the patient chose English', () => {
    expect(languageOf('en')).toBe('en');
    expect(languageOf('ar')).toBe('ar');
    expect(languageOf(undefined)).toBe('ar');
    expect(languageOf('fr')).toBe('ar');
  });
});

describe('mimeOf', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pdf = new TextEncoder().encode('%PDF-1.7');
  const heic = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode('ftypheic')]);
  it('trusts an accepted declared type, and sniffs when the browser sent none', () => {
    expect(mimeOf('image/png', jpeg, false)).toBe('image/png');
    expect(mimeOf('image/jpg', jpeg, false)).toBe('image/jpeg');
    expect(mimeOf('', jpeg, false)).toBe('image/jpeg');
    expect(mimeOf('', png, false)).toBe('image/png');
    expect(mimeOf('application/octet-stream', heic, false)).toBe('image/heic');
  });
  it('a PDF only where the agent accepts one (extraction), and garbage never', () => {
    expect(mimeOf('application/pdf', pdf, false)).toBeNull();
    expect(mimeOf('application/pdf', pdf, true)).toBe('application/pdf');
    expect(mimeOf('', pdf, true)).toBe('application/pdf');
    expect(mimeOf('text/plain', new TextEncoder().encode('hello'), true)).toBeNull();
  });
});

describe('payloads — exactly what the workflows read', () => {
  it('travel check, extraction (save:false) and screening', () => {
    expect(travelPayload('pt-03', 'AAAA', 'image/jpeg', 'ar')).toEqual({ patientId: 'pt-03', imageBase64: 'AAAA', mimeType: 'image/jpeg', language: 'ar' });
    expect(extractionPayload('pt-03', 'AAAA', 'image/png', 'en')).toEqual({ patientId: 'pt-03', imageBase64: 'AAAA', mimeType: 'image/png', language: 'en', save: false });
    expect(screeningPayload('pt-03', 'rx-1', 'ar')).toEqual({ patientId: 'pt-03', newPrescriptionId: 'rx-1', language: 'ar' });
  });
});

describe('readDrugCheck ← agent-travel-check', () => {
  const seed = buildPrescriptions();
  const active = (id: string) => seed.filter((p) => p.patientId === id && p.status === 'active');

  it('every appOutcome the real agent produces is read back unchanged - except cannot_verify, owed to PR #13/AP-11a', () => {
    for (const patientId of ['pt-01', 'pt-02', 'pt-03']) {
      for (const text of ['KLACID', 'Euthyrox', 'ZOCOR', 'Panadol', 'UNKNOWNXYZ', '']) {
        const { appOutcome } = T.travelCheck({ patientId, visionText: text, prescriptions: active(patientId), index, brandIndex });
        // D6/CR-078: the agent now produces its own cannot_verify kind (CR-095, agents/knowledge/src/
        // travel-check.js). readDrugCheck does not read it yet - that is PR #13/AP-11a's own change,
        // a separate PR against DrugCheckOutcome and this reader. Until it lands, this is the one
        // outcome NOT read back unchanged, by design (docs/DECISIONS.md CR-095: "either merge order
        // is safe"); the fallback itself is asserted below ("anything unexpected is could_not_identify").
        const expected = appOutcome.kind === 'cannot_verify' ? { kind: 'could_not_identify' } : appOutcome;
        expect(readDrugCheck(200, { ok: true, appOutcome })).toEqual(expected);
      }
    }
  });

  it('a danger finding keeps the alert id the backend assigned, so C3 links to it', () => {
    const outcome = T.appOutcomeFor('interaction_found', 'Clarithromycin', 'ia-abc123');
    expect(readDrugCheck(200, { appOutcome: outcome })).toEqual({ kind: 'identified', drugName: 'Clarithromycin', verdict: 'interaction_found', alertId: 'ia-abc123' });
  });

  it('anything unexpected is could_not_identify — never a guessed drug, never a false "no interaction"', () => {
    const cni = { kind: 'could_not_identify' };
    expect(readDrugCheck(500, { appOutcome: { kind: 'identified', drugName: 'X', verdict: 'no_interaction' } })).toEqual(cni);
    expect(readDrugCheck(422, { error: 'unsupported_mime_type' })).toEqual(cni);
    expect(readDrugCheck(200, null)).toEqual(cni);
    expect(readDrugCheck(200, 'ok')).toEqual(cni);
    expect(readDrugCheck(200, { appOutcome: { kind: 'identified', drugName: '', verdict: 'no_interaction' } })).toEqual(cni);
    expect(readDrugCheck(200, { appOutcome: { kind: 'identified', drugName: 'X', verdict: 'safe' } })).toEqual(cni);
    expect(readDrugCheck(200, { appOutcome: { kind: 'identified', drugName: 'X'.repeat(201), verdict: 'no_interaction' } })).toEqual(cni);
    expect(readDrugCheck(200, { appOutcome: { kind: 'cannot_verify' } })).toEqual(cni);
  });

  it('an alert id that is not an id is dropped, never followed', () => {
    const r = readDrugCheck(200, { appOutcome: { kind: 'identified', drugName: 'X', verdict: 'interaction_found', alertId: '../../clinic' } });
    expect(r).toEqual({ kind: 'identified', drugName: 'X', verdict: 'interaction_found' });
  });
});

describe('readExtraction ← agent-extraction', () => {
  const SURE = Object.fromEntries(E.CONFIDENCE_KEYS.map((k: string) => [k, 0.95]));
  const CLEAR = {
    isPrescription: true, facilityName: 'مستشفى العدان', sector: 'public', genericName: 'Levothyroxine', brandName: 'Eltroxin',
    strength: 50, strengthUnit: 'mcg', dosePerAdministration: 1, frequencyPerDay: 1, doseTimes: ['07:00'],
    dosingPattern: 'daily', durationDays: 180, startDate: '2026-08-10', confidence: SURE,
  };
  const agent = (model: object) => ({ ok: true, appOutcome: E.toPrescriptionBody({ patientId: 'pt-03', model }).appOutcome });

  it('a clear prescription is a confident draft with the real source and the unit as written', () => {
    const r = readExtraction(200, agent(CLEAR), 'pt-03');
    expect(r.kind).toBe('confident');
    if (r.kind !== 'confident') return;
    expect(r.prescription.source).toEqual({ facilityName: 'مستشفى العدان', sector: 'public' });
    expect(r.prescription.drug).toEqual({ genericName: 'Levothyroxine', brandName: 'Eltroxin', strengthMg: 50, strengthUnit: 'mcg' });
    expect(r.prescription.doseTimes).toEqual(['07:00']);
    expect(r.prescription.needsReview).toBe(false);
    expect(r.prescription.status).toBe('active');
    expect('fieldReviewStatus' in r.prescription).toBe(false);
  });

  for (const [label, model, fields] of [
    ['low-confidence strength', { ...CLEAR, confidence: { ...SURE, strength: 0.3 } }, ['strengthMg']],
    ['no times written', { ...CLEAR, frequencyPerDay: 3, doseTimes: null }, ['doseTimes']],
    ['no start date', { ...CLEAR, startDate: null }, ['startDate']],
    ['everything flaggable unread', { ...CLEAR, strength: null, frequencyPerDay: null, doseTimes: null, startDate: null, confidence: { ...SURE, brandName: 0.1 } },
      ['brandName', 'strengthMg', 'frequencyPerDay', 'startDate', 'doseTimes']],
  ] as const) {
    it(`${label}: needs_review, the unsure fields unset and listed, pending the reviewer`, () => {
      const r = readExtraction(200, agent(model), 'pt-03');
      expect(r.kind).toBe('needs_review');
      if (r.kind !== 'needs_review') return;
      expect([...r.uncertainFields].sort()).toEqual([...fields].sort());
      expect(r.prescription.needsReview).toBe(true);
      expect(r.prescription.fieldReviewStatus).toBe('pending');
      if (fields.includes('startDate' as never)) expect(r.prescription.startDate).toBeUndefined();
      if (fields.includes('doseTimes' as never)) expect(r.prescription.doseTimes).toBeUndefined();
    });
  }

  it('not a prescription / a required field unread → unreadable, never a draft', () => {
    expect(readExtraction(200, agent({ ...CLEAR, isPrescription: false }), 'pt-03')).toEqual({ kind: 'unreadable' });
    expect(readExtraction(200, agent({ ...CLEAR, genericName: null }), 'pt-03')).toEqual({ kind: 'unreadable' });
  });

  it('a body the backend itself would refuse is unreadable here too', () => {
    const good = agent(CLEAR).appOutcome;
    const bad = (appOutcome: object) => readExtraction(200, { appOutcome }, 'pt-03');
    // another patient's id inside the prescription
    expect(bad({ ...good, prescription: { ...good.prescription, patientId: 'pt-01' } })).toEqual({ kind: 'unreadable' });
    // a reviewer-owned field
    expect(bad({ ...good, prescription: { ...good.prescription, fieldReviewStatus: 'confirmed' } })).toEqual({ kind: 'unreadable' });
    // an unknown unit / an unknown key
    expect(bad({ ...good, prescription: { ...good.prescription, drug: { ...good.prescription.drug, strengthUnit: 'grains' } } })).toEqual({ kind: 'unreadable' });
    expect(bad({ ...good, prescription: { ...good.prescription, dose: 3 } })).toEqual({ kind: 'unreadable' });
    // "confident" without its full schedule (CR-002 invariant 1)
    const { doseTimes: _t, ...noTimes } = good.prescription;
    void _t;
    expect(bad({ ...good, prescription: noTimes })).toEqual({ kind: 'unreadable' });
    // times that do not match the frequency / are not clock times
    expect(bad({ ...good, prescription: { ...good.prescription, doseTimes: ['07:00', '19:00'] } })).toEqual({ kind: 'unreadable' });
    expect(bad({ ...good, prescription: { ...good.prescription, doseTimes: ['7am'] } })).toEqual({ kind: 'unreadable' });
    // needs_review with nothing uncertain / an unknown uncertain field
    expect(bad({ kind: 'needs_review', prescription: { ...good.prescription, needsReview: true }, uncertainFields: [] })).toEqual({ kind: 'unreadable' });
    expect(bad({ kind: 'needs_review', prescription: { ...good.prescription, needsReview: true }, uncertainFields: ['genericName'] })).toEqual({ kind: 'unreadable' });
    // a zero-day course
    expect(bad({ ...good, prescription: { ...good.prescription, durationDays: 0 } })).toEqual({ kind: 'unreadable' });
  });

  it('transport failures are unreadable', () => {
    expect(readExtraction(500, agent(CLEAR), 'pt-03')).toEqual({ kind: 'unreadable' });
    expect(readExtraction(200, null, 'pt-03')).toEqual({ kind: 'unreadable' });
    expect(readExtraction(200, { appOutcome: { kind: 'unreadable' } }, 'pt-03')).toEqual({ kind: 'unreadable' });
  });
});

describe('draftSource', () => {
  it('the agent’s real source, and none for the stub’s drafts', () => {
    expect(draftSource({ source: { facilityName: 'عيادة', sector: 'private' } })).toEqual({ facilityName: 'عيادة', sector: 'private' });
    expect(draftSource({ source: { facilityName: '', sector: 'public' } })).toBeNull();
    expect(draftSource({ source: { facilityName: 'x', sector: 'military' as 'public' } })).toBeNull();
    expect(draftSource({ drug: { genericName: 'Ibuprofen' } })).toBeNull();
    expect(draftSource(undefined)).toBeNull();
  });
});

describe('shouldScreen', () => {
  it('only a saved, active, unflagged prescription', () => {
    expect(shouldScreen({ id: 'rx-9', needsReview: false, status: 'active' })).toBe(true);
    expect(shouldScreen({ id: 'rx-9', needsReview: true, status: 'active' })).toBe(false);
    expect(shouldScreen({ id: 'rx-9', needsReview: false, status: 'discontinued' })).toBe(false);
    expect(shouldScreen({ id: '', needsReview: false, status: 'active' })).toBe(false);
    expect(shouldScreen(null)).toBe(false);
  });
});
