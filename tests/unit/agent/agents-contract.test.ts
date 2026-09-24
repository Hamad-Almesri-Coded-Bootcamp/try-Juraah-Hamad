// @vitest-environment node
/**
 * The contract between the two tracks, checked from both ends: every request body the n8n agents
 * build (agents/lib/*.js, the code inlined into the workflows) is run through THIS backend's own
 * validators (lib/agent/validate.ts). If either side drifts, this fails before anything is deployed.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { parseAlertBody, parseDoseStatusBody, parsePrescriptionBody, parseRecomputeBody, RECORDED_DOSE_WORDS } from '@/lib/agent/validate';

const require = createRequire(import.meta.url);
const A = require('../../../agents/lib/adherence.js');
const S = require('../../../agents/lib/screening.js');
const E = require('../../../agents/lib/extraction.js');

type Write = { op: 'dose_status' | 'recompute'; doseId?: string; body: unknown };

const OPEN = ['upcoming'][0];
const dose = (id: string, prescriptionId: string, hhmm: string) => ({
  id, prescriptionId, scheduledAt: `2026-09-24T${hhmm}:00+03:00`, status: OPEN, recordedAt: null,
  genericName: 'Levothyroxine', brandName: 'Eltroxin', strengthMg: 50, strengthUnit: 'mcg', dosePerAdministration: 1, timingRelativeToFood: null,
});
const RX = [{ id: 'rx-008', patientId: 'pt-03', drug: { genericName: 'Levothyroxine', brandName: 'Eltroxin' }, status: 'active', needsReview: false }];
const decide = (intent: string, hhmm: string, doses = [dose('rx-008-20260924-0700', 'rx-008', '07:00')]) =>
  A.decide({ subjectType: 'patient', language: 'ar', sentAt: `2026-09-24T${hhmm}:00+03:00`, doses, prescriptions: RX, tap: null, stopTap: null,
             classification: { intent, confidence: 0.95, quote: 'q' } });

describe('agents/lib/adherence.js → the backend validators', () => {
  it('the agents write exactly the backend’s recorded dose words', () => {
    expect([...A.RECORDED_WORDS]).toEqual([...RECORDED_DOSE_WORDS]);
  });
  for (const [intent, hhmm] of [['taken_on_time', '07:20'], ['taken_late', '09:40'], ['missed', '08:30']] as const) {
    it(`${intent}: every write it plans is accepted`, () => {
      const writes = decide(intent, hhmm).writes as Write[];
      expect(writes.length).toBeGreaterThan(0);
      for (const w of writes) {
        const v = w.op === 'dose_status' ? parseDoseStatusBody(w.body) : parseRecomputeBody(w.body);
        expect(v, JSON.stringify(w.body)).toMatchObject({ ok: true });
      }
    });
  }
  it('AP-05 (TC-RS-03): discontinued_by_doctor never writes by itself; the recompute from a CONFIRMED stop tap is accepted and carries a reason', () => {
    const asked = decide('discontinued_by_doctor', '08:00');
    expect(asked.outcome).toBe('confirm_discontinue');
    expect(asked.writes).toEqual([]);
    const tapped = A.decide({ subjectType: 'patient', language: 'ar', sentAt: '2026-09-24T08:01:00+03:00', doses: [], prescriptions: RX,
      tap: null, stopTap: A.parseStopTap('s:rx-008'), classification: null });
    const [w] = tapped.writes as Write[];
    expect(parseRecomputeBody(w!.body)).toMatchObject({ ok: true, value: { reason: 'discontinued' } });
  });
});

describe('agents/lib/screening.js → parseAlertBody', () => {
  it('every alert it builds is accepted, and none is reviewed or auto-cleared', () => {
    const rx = (id: string, genericName: string) => ({ id, drug: { genericName }, needsReview: false });
    for (const profile of [[rx('rx-001', 'Warfarin'), rx('rx-002', 'Ibuprofen')], [rx('rx-001', 'Warfarin'), rx('rx-002', 'Zzqx')], [rx('rx-001', 'Warfarin'), rx('rx-002', 'Levothyroxine')]]) {
      const r = S.screenNewPrescription({ patientId: 'pt-01', newPrescriptionId: 'rx-002', prescriptions: profile, language: 'ar' });
      expect(r.alerts.length).toBeGreaterThan(0);
      for (const a of r.alerts) expect(parseAlertBody(a), JSON.stringify(a)).toMatchObject({ ok: true, value: { reviewStatus: 'pending_medical_review' } });
    }
  });
});

describe('agents/lib/extraction.js → parsePrescriptionBody', () => {
  const SURE = Object.fromEntries(E.CONFIDENCE_KEYS.map((k: string) => [k, 0.95]));
  const CLEAR = {
    isPrescription: true, facilityName: 'مستشفى مبارك الكبير', sector: 'public', genericName: 'Amoxicillin', brandName: 'Amoxil',
    strength: 500, strengthUnit: 'mg', dosePerAdministration: 1, frequencyPerDay: 3, doseTimes: ['08:00', '14:00', '20:00'],
    dosingPattern: 'daily', durationDays: 7, startDate: '2026-09-24', confidence: SURE,
  };
  for (const [label, model] of [
    ['clear', CLEAR],
    ['flagged strength', { ...CLEAR, confidence: { ...SURE, strength: 0.4 } }],
    ['no times written', { ...CLEAR, doseTimes: null }],
    ['alternate day, no brand', { ...CLEAR, dosingPattern: 'alternate_day', brandName: null }],
  ] as const) {
    it(`${label}: the body is accepted, and needsReview/uncertainFields agree with the validator`, () => {
      const r = E.toPrescriptionBody({ patientId: 'pt-03', model });
      expect(r.ok).toBe(true);
      const v = parsePrescriptionBody(r.body);
      expect(v, JSON.stringify(v)).toMatchObject({ ok: true, value: { needsReview: r.needsReview, uncertainFields: r.uncertainFields } });
    });
  }
});
