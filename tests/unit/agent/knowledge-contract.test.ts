// @vitest-environment node
/**
 * The drug-knowledge agents (agents/knowledge/src/*.js, the code inlined into
 * agents/knowledge/workflows/*.json) checked against THIS backend from both ends:
 *   - every alert and prescription body they build is run through the backend's own validators
 *     (lib/agent/validate.ts), on the LIVE seed (lib/data/mock/seed.ts), for every patient and
 *     every active prescription as the "new" one;
 *   - the seed copy the agents' own tests use (agents/knowledge/test/seed-prescriptions.json)
 *     must equal the live seed, so neither side can drift silently.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { parseAlertBody, parsePrescriptionBody, UNCERTAIN_FIELD_KEYS } from '@/lib/agent/validate';
import { buildPrescriptions } from '@/lib/data/mock/seed';

const require = createRequire(import.meta.url);
const I = require('../../../agents/knowledge/src/interactions.js');
const R = require('../../../agents/knowledge/src/resolve.js');
const S = require('../../../agents/knowledge/src/screening.js');
const T = require('../../../agents/knowledge/src/travel-check.js');
const E = require('../../../agents/knowledge/src/extraction.js');
const index = I.loadIndex(require('../../../agents/knowledge/data/interaction-index.json'));
const brandIndex = R.buildBrandIndex(require('../../../agents/knowledge/data/brand-map.json').brands, index);
const seedCopy = require('../../../agents/knowledge/test/seed-prescriptions.json');

const seed = buildPrescriptions();
const patients = [...new Set(seed.map((p) => p.patientId))];
const activeOf = (patientId: string) => seed.filter((p) => p.patientId === patientId && p.status === 'active');

describe('agents/knowledge ↔ the seed', () => {
  it('the agents’ seed copy equals the live seed', () => {
    expect(JSON.parse(JSON.stringify(seed))).toEqual(seedCopy);
  });
});

describe('agents/knowledge/src/screening.js → parseAlertBody', () => {
  for (const patientId of patients) {
    for (const p of activeOf(patientId)) {
      for (const language of ['ar', 'en'] as const) {
        it(`${patientId} · new ${p.id} · ${language}: every alert is accepted, none reviewed, danger/warning pending`, () => {
          const r = S.screenNewPrescription({ patientId, newPrescriptionId: p.id, prescriptions: activeOf(patientId), language, index });
          expect(r.report === null || r.report.validationFailed === 0).toBe(true);
          for (const a of r.alerts) {
            const v = parseAlertBody(a);
            expect(v, JSON.stringify(a)).toMatchObject({ ok: true });
            expect(a.reviewStatus).not.toBe('reviewed');
            if (a.severity !== 'info') expect(a.reviewStatus).toBe('pending_medical_review');
            for (const id of a.involvedPrescriptionIds) {
              const rx = seed.find((x) => x.id === id);
              expect(rx?.patientId).toBe(patientId);
              expect(rx?.needsReview).toBe(false);
              expect(rx?.status).toBe('active');
            }
          }
        });
      }
    }
  }

  it('the flagged rx-006 / returned rx-007 never appear in any alert (TC-IX-06)', () => {
    for (const p of activeOf('pt-02')) {
      const r = S.screenNewPrescription({ patientId: 'pt-02', newPrescriptionId: p.id, prescriptions: activeOf('pt-02'), index });
      for (const a of r.alerts) expect(a.involvedPrescriptionIds).not.toContain('rx-006');
      for (const a of r.alerts) expect(a.involvedPrescriptionIds).not.toContain('rx-007');
    }
  });
});

describe('agents/knowledge/src/travel-check.js → parseAlertBody', () => {
  it('a danger travel alert is accepted by the backend', () => {
    const profile = [{ ...activeOf('pt-03')[0], id: 't-simva', drug: { genericName: 'Simvastatin' } }];
    const r = T.travelCheck({ patientId: 'pt-03', visionText: 'KLACID', prescriptions: profile, index, brandIndex, language: 'ar' });
    expect(r.alert).toBeTruthy();
    expect(parseAlertBody(r.alert)).toMatchObject({ ok: true, value: { severity: 'danger', reviewStatus: 'pending_medical_review' } });
  });
  it('a photo that is not a medicine answers not_a_medicine and nothing else, whatever the profile (CR-110)', () => {
    const read = { isMedicine: false, brandAsPrinted: null, ingredientsAsPrinted: [], strengthAsPrinted: null };
    for (const patientId of patients) {
      const r = T.travelCheck({ patientId, visionRead: read, prescriptions: activeOf(patientId), index, brandIndex });
      expect(r.appOutcome).toEqual({ kind: 'not_a_medicine' });
      expect(r.alert).toBeFalsy();
    }
    // decided before the profile is needed: an unreadable profile changes nothing
    const unread = T.travelCheck({ patientId: 'pt-01', visionRead: read, prescriptions: null, index, brandIndex });
    expect(unread.appOutcome).toEqual({ kind: 'not_a_medicine' });
  });
  it('appOutcome is always a valid DrugCheckOutcome shape', () => {
    // CR-078: cannot_verify is exercised here too (today: pt-02 Euthyrox and ZOCOR, pt-03 KLACID,
    // all ungraded_interaction_in_source) - the new branch cannot pass this test unhit.
    const seenKinds = new Set<string>();
    for (const patientId of patients) {
      for (const text of ['KLACID', 'Euthyrox', 'ZOCOR', 'Panadol', 'UNKNOWNXYZ', '']) {
        const o = T.travelCheck({ patientId, visionText: text, prescriptions: activeOf(patientId), index, brandIndex }).appOutcome;
        seenKinds.add(o.kind);
        if (o.kind === 'could_not_identify' || o.kind === 'cannot_verify') expect(Object.keys(o)).toEqual(['kind']);
        else {
          expect(o.kind).toBe('identified');
          expect(typeof o.drugName).toBe('string');
          expect(['no_interaction', 'interaction_found']).toContain(o.verdict);
        }
      }
    }
    expect(seenKinds.has('cannot_verify')).toBe(true);
    expect(seenKinds.has('could_not_identify')).toBe(true);
    expect(seenKinds.has('identified')).toBe(true);
  });
});

describe('agents/knowledge/src/extraction.js → parsePrescriptionBody', () => {
  it('flaggable field names are exactly the backend’s CR-002 keys', () => {
    expect([...E.FLAGGABLE]).toEqual([...UNCERTAIN_FIELD_KEYS]);
  });
  const SURE = Object.fromEntries(E.CONFIDENCE_KEYS.map((k: string) => [k, 0.95]));
  const CLEAR = {
    isPrescription: true, facilityName: 'مستشفى العدان', sector: 'public', genericName: 'Levothyroxine', brandName: 'Eltroxin',
    strength: 50, strengthUnit: 'mcg', dosePerAdministration: 1, frequencyPerDay: 1, doseTimes: ['07:00'],
    dosingPattern: 'daily', durationDays: 180, startDate: '2026-08-10', confidence: SURE,
  };
  for (const [label, model] of [
    ['clear', CLEAR],
    ['low-confidence strength', { ...CLEAR, confidence: { ...SURE, strength: 0.3 } }],
    ['no times written', { ...CLEAR, frequencyPerDay: 3, doseTimes: null }],
    ['no start date', { ...CLEAR, startDate: null }],
    ['alternate day, no brand', { ...CLEAR, dosingPattern: 'alternate_day', brandName: null }],
    ['everything flaggable unread', { ...CLEAR, strength: null, frequencyPerDay: null, doseTimes: null, startDate: null, confidence: { ...SURE, brandName: 0.1 } }],
  ] as const) {
    it(`${label}: the body is accepted, and needsReview/uncertainFields agree with the validator`, () => {
      const r = E.toPrescriptionBody({ patientId: 'pt-03', model });
      expect(r.ok).toBe(true);
      const v = parsePrescriptionBody(r.body);
      expect(v, JSON.stringify(v)).toMatchObject({ ok: true, value: { needsReview: r.needsReview, uncertainFields: r.uncertainFields } });
    });
  }
  it('an unflagged body carries all four fields rx_cr002_invariant_1 requires', () => {
    const r = E.toPrescriptionBody({ patientId: 'pt-03', model: CLEAR });
    expect(r.needsReview).toBe(false);
    const p = r.body.prescription;
    expect(p.drug.strengthMg).toBeDefined();
    expect(p.frequencyPerDay).toBeDefined();
    expect(p.startDate).toBeDefined();
    expect(p.doseTimes?.length).toBe(p.frequencyPerDay);
  });
});
