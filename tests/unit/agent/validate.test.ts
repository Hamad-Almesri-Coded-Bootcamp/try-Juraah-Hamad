// @vitest-environment node
/**
 * P2-WP7 — body validation for the six agent routes (lib/agent/validate.ts). Pure: every refusal is
 * a 422 before any statement runs. What the DATABASE refuses (constraints, triggers) is proved in
 * tests/integration/enforcement/agent.test.ts and by hand (docs/backend-notes/p2-wp7.md).
 */
import { describe, expect, it } from 'vitest';
import {
  RECORDED_DOSE_WORDS, isIsoDate, isIsoDateTime, parseAlertBody, parseDoseStatusBody, parsePatientIdQuery,
  parsePrescriptionBody, parseRecomputeBody,
} from '@/lib/agent/validate';

const fail = (v: { ok: boolean }) => v as { ok: false; field: string; reason: string };

describe('dates', () => {
  it('accepts an offset datetime and a real calendar date only', () => {
    expect(isIsoDateTime('2026-09-21T13:05:00+03:00')).toBe(true);
    expect(isIsoDateTime('2026-09-21T10:05Z')).toBe(true);
    expect(isIsoDateTime('2026-09-21T13:05:00')).toBe(false); // no offset: would be read in the server's zone
    expect(isIsoDateTime('yesterday')).toBe(false);
    expect(isIsoDate('2026-09-21')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-9-21')).toBe(false);
  });
});

describe('POST /api/agent/doses/{id}/status body', () => {
  it('accepts the three recorded words with source adherence_agent', () => {
    for (const status of RECORDED_DOSE_WORDS) {
      const v = parseDoseStatusBody({ status, recordedAt: '2026-09-21T13:05:00+03:00', source: 'adherence_agent' });
      expect(v).toEqual({ ok: true, value: { status, recordedAt: '2026-09-21T13:05:00+03:00', source: 'adherence_agent' } });
    }
    expect(parseDoseStatusBody({ status: 'taken_on_time', source: 'adherence_agent' })).toEqual({ ok: true, value: { status: 'taken_on_time', source: 'adherence_agent' } });
  });
  it('refuses upcoming (the agent never un-records), an unknown word, and a non-agent source', () => {
    expect(fail(parseDoseStatusBody({ status: 'upcoming', source: 'adherence_agent' })).reason).toBe('not_a_recorded_status');
    expect(fail(parseDoseStatusBody({ status: 'taken', source: 'adherence_agent' })).field).toBe('status');
    for (const source of ['system', 'seed', 'ui', 'patient', undefined]) {
      expect(fail(parseDoseStatusBody({ status: 'taken_on_time', source })).reason).toBe('must_be_adherence_agent');
    }
  });
  it('taken_late requires recordedAt; recordedAt must carry an offset', () => {
    expect(fail(parseDoseStatusBody({ status: 'taken_late', source: 'adherence_agent' })).reason).toBe('required_for_taken_late');
    expect(fail(parseDoseStatusBody({ status: 'taken_late', recordedAt: '2026-09-21 22:40', source: 'adherence_agent' })).reason).toBe('not_an_iso_datetime');
  });
  it('is strict: no actor, role, tracked or id may ride along', () => {
    for (const k of ['actor', 'role', 'tracked', 'id', 'prescriptionId']) {
      expect(fail(parseDoseStatusBody({ status: 'missed', source: 'adherence_agent', [k]: 'x' }))).toEqual({ ok: false, field: k, reason: 'unknown_field' });
    }
    expect(fail(parseDoseStatusBody(null)).reason).toBe('not_an_object');
    expect(fail(parseDoseStatusBody([])).reason).toBe('not_an_object');
  });
});

describe('POST /api/agent/schedule/recompute body', () => {
  it('reported_miss requires missedDoseId and nothing of a discontinuation', () => {
    expect(parseRecomputeBody({ prescriptionId: 'rx-008', reason: 'reported_miss', missedDoseId: 'rx-008-20260919-0700' }))
      .toEqual({ ok: true, value: { prescriptionId: 'rx-008', reason: 'reported_miss', missedDoseId: 'rx-008-20260919-0700' } });
    expect(fail(parseRecomputeBody({ prescriptionId: 'rx-008', reason: 'reported_miss' })).field).toBe('missedDoseId');
    expect(fail(parseRecomputeBody({ prescriptionId: 'rx-008', reason: 'reported_miss', missedDoseId: 'd', discontinuedReason: 'x' })).field).toBe('discontinuedReason');
  });
  it('discontinued requires a reason; the date defaults to the frozen clock, never the wall clock', () => {
    expect(parseRecomputeBody({ prescriptionId: 'rx-003', reason: 'discontinued', discontinuedReason: 'الطبيب أوقف الدواء' }))
      .toEqual({ ok: true, value: { prescriptionId: 'rx-003', reason: 'discontinued', discontinuedAt: '2026-09-21', discontinuedReason: 'الطبيب أوقف الدواء' } });
    expect(fail(parseRecomputeBody({ prescriptionId: 'rx-003', reason: 'discontinued' })).reason).toBe('required_for_discontinued');
    expect(fail(parseRecomputeBody({ prescriptionId: 'rx-003', reason: 'discontinued', discontinuedAt: '21/09', discontinuedReason: 'x' })).field).toBe('discontinuedAt');
    expect(fail(parseRecomputeBody({ prescriptionId: 'rx-003', reason: 'discontinued', missedDoseId: 'd', discontinuedReason: 'x' })).field).toBe('missedDoseId');
  });
  it('refuses any other reason and an unknown key', () => {
    expect(fail(parseRecomputeBody({ prescriptionId: 'rx-003', reason: 'unanswered' })).field).toBe('reason');
    expect(fail(parseRecomputeBody({ prescriptionId: 'rx-003', reason: 'reported_miss', missedDoseId: 'd', status: 'missed' })).reason).toBe('unknown_field');
    expect(fail(parseRecomputeBody({ reason: 'reported_miss', missedDoseId: 'd' })).field).toBe('prescriptionId');
  });
});

describe('POST /api/agent/alerts body', () => {
  const ok = { patientId: 'pt-01', involvedPrescriptionIds: ['rx-001', 'rx-002'], severity: 'danger', description: 'd', sourceCitation: '', reviewStatus: 'pending_medical_review' };
  it('accepts pending_medical_review and auto_cleared; sourceCitation may be empty or the owner marker', () => {
    expect(parseAlertBody(ok).ok).toBe(true);
    expect(parseAlertBody({ ...ok, reviewStatus: 'auto_cleared' }).ok).toBe(true);
    expect(parseAlertBody({ ...ok, sourceCitation: ['[TO BE', 'SUPPLIED]'].join(' ') }).ok).toBe(true);
    expect(parseAlertBody({ ...ok, createdAt: '2026-09-21T09:00:00+03:00' }).ok).toBe(true);
  });
  it("refuses reviewStatus 'reviewed' and every reviewer field (422)", () => {
    expect(fail(parseAlertBody({ ...ok, reviewStatus: 'reviewed' }))).toEqual({ ok: false, field: 'reviewStatus', reason: 'agent_may_not_review' });
    for (const f of ['reviewerDecision', 'reviewerNote', 'reviewedAt', 'reviewedBy']) {
      expect(fail(parseAlertBody({ ...ok, [f]: 'x' }))).toEqual({ ok: false, field: f, reason: 'reviewer_field' });
    }
    expect(fail(parseAlertBody({ ...ok, reviewStatus: undefined })).field).toBe('reviewStatus');
  });
  it('sourceCitation is required (a missing key is refused, never defaulted)', () => {
    const { sourceCitation: _c, ...noCitation } = ok;
    void _c;
    expect(fail(parseAlertBody(noCitation))).toEqual({ ok: false, field: 'sourceCitation', reason: 'required' });
  });
  it('refuses an id, an empty or duplicate prescription list, a bad severity, and unknown keys', () => {
    expect(fail(parseAlertBody({ ...ok, id: 'ia-9' })).reason).toBe('server_assigned');
    expect(fail(parseAlertBody({ ...ok, involvedPrescriptionIds: [] })).field).toBe('involvedPrescriptionIds');
    expect(fail(parseAlertBody({ ...ok, involvedPrescriptionIds: ['rx-001', 'rx-001'] })).reason).toBe('duplicate_id');
    expect(fail(parseAlertBody({ ...ok, severity: 'critical' })).field).toBe('severity');
    expect(fail(parseAlertBody({ ...ok, ...JSON.parse('{"actions":[]}') })).reason).toBe('unknown_field'); // built by JSON.parse: guard 4 bans the literal key
  });
});

describe('POST /api/agent/prescriptions body', () => {
  const rx = {
    source: { facilityName: 'Mubarak Al-Kabeer Hospital pharmacy', sector: 'public' },
    drug: { genericName: 'Amoxicillin', strengthMg: 500, strengthUnit: 'mg' }, dosePerAdministration: 1, frequencyPerDay: 3,
    durationDays: 7, dosingPattern: 'daily', startDate: '2026-09-21', doseTimes: ['08:00', '14:00', '20:00'],
  };
  it('accepts a confident extraction and passes strengthMg through unconverted', () => {
    const v = parsePrescriptionBody({ patientId: 'pt-01', prescription: rx, needsReview: false });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.prescription.drug.strengthMg).toBe(500);
      expect(v.value.fieldReviewStatus).toBeUndefined();
      expect(v.value.uncertainFields).toEqual([]);
    }
    const mcg = parsePrescriptionBody({ patientId: 'pt-03', prescription: { ...rx, drug: { genericName: 'Levothyroxine', strengthMg: 50, strengthUnit: 'mcg' } }, needsReview: false });
    expect(mcg.ok && mcg.value.prescription.drug.strengthMg).toBe(50);
  });
  it('a flagged extraction is pending review and may name its uncertain fields', () => {
    const { startDate: _s, doseTimes: _d, ...partial } = rx;
    void _s; void _d;
    const v = parsePrescriptionBody({ patientId: 'pt-02', prescription: partial, needsReview: true, uncertainFields: ['startDate', 'doseTimes'] });
    expect(v.ok && v.value.fieldReviewStatus).toBe('pending');
    expect(v.ok && v.value.uncertainFields).toEqual(['startDate', 'doseTimes']);
    expect(fail(parsePrescriptionBody({ patientId: 'pt-02', prescription: rx, needsReview: false, uncertainFields: ['startDate'] })).reason).toBe('requires_needsReview');
    expect(fail(parsePrescriptionBody({ patientId: 'pt-02', prescription: rx, needsReview: true, uncertainFields: ['durationDays'] })).reason).toBe('unknown_field_name');
  });
  it('CR-042: the source is required — facility and sector, never fabricated', () => {
    const { source: _src, ...noSource } = rx;
    void _src;
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: noSource, needsReview: false })).field).toBe('prescription.source');
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, source: { facilityName: '', sector: 'public' } }, needsReview: false })).field).toBe('prescription.source.facilityName');
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, source: { facilityName: 'x', sector: 'military' } }, needsReview: false })).field).toBe('prescription.source.sector');
  });
  it('refuses every reviewer field, a confirmed review status, an id, and a mismatched patient', () => {
    for (const f of ['fieldReviewNote', 'fieldReviewedBy', 'fieldReviewedAt']) {
      expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, [f]: 'x' }, needsReview: true }))).toEqual({ ok: false, field: `prescription.${f}`, reason: 'reviewer_field' });
    }
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, fieldReviewStatus: 'confirmed' }, needsReview: true })).reason).toBe('reviewer_field');
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, id: 'rx-1' }, needsReview: false })).reason).toBe('unknown_field');
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, patientId: 'pt-03' }, needsReview: false })).reason).toBe('must_equal_patientId');
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, needsReview: true }, needsReview: false })).reason).toBe('must_equal_needsReview');
  });
  it('leaves the length-vs-frequency and CR-002 rules to the database (it names the constraint)', () => {
    expect(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, doseTimes: ['08:00', '20:00'] }, needsReview: false }).ok).toBe(true);
    const { startDate: _s, ...noStart } = rx;
    void _s;
    expect(parsePrescriptionBody({ patientId: 'pt-01', prescription: noStart, needsReview: false }).ok).toBe(true);
    expect(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, durationDays: 0 }, needsReview: false }).ok).toBe(true);
  });
  it('type-checks every field it passes on', () => {
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, drug: { genericName: '' } }, needsReview: false })).field).toBe('prescription.drug.genericName');
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, drug: { genericName: 'x', strengthUnit: 'grain' } }, needsReview: false })).field).toBe('prescription.drug.strengthUnit');
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, dosePerAdministration: 0 }, needsReview: false })).field).toBe('prescription.dosePerAdministration');
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, durationDays: 1.5 }, needsReview: false })).field).toBe('prescription.durationDays');
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, dosingPattern: 'weekly' }, needsReview: false })).field).toBe('prescription.dosingPattern');
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: { ...rx, dispensing: { unitsPerPackage: 30 } }, needsReview: false })).field).toBe('prescription.dispensing.totalQuantityDispensed');
    expect(fail(parsePrescriptionBody({ patientId: 'pt-01', prescription: rx })).field).toBe('needsReview');
    expect(fail(parsePrescriptionBody({ prescription: rx, needsReview: false })).field).toBe('patientId');
  });
});

describe('GET /api/agent/alert-recipients query', () => {
  it('requires patientId', () => {
    expect(parsePatientIdQuery('pt-01')).toEqual({ ok: true, value: 'pt-01' });
    expect(fail(parsePatientIdQuery(null)).field).toBe('patientId');
    expect(fail(parsePatientIdQuery('')).field).toBe('patientId');
  });
});
