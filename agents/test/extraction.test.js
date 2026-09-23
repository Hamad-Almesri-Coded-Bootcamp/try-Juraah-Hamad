'use strict';

/** agents/lib/extraction.js against TC-EX-01..06 and the body POST /api/agent/prescriptions accepts. */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../lib/extraction.js');

const SURE = { brandName: 0.95, strengthMg: 0.95, frequencyPerDay: 0.95, startDate: 0.95, doseTimes: 0.95 };
const CLEAR = {
  isPrescription: true, facilityName: 'مستشفى مبارك الكبير', sector: 'public', genericName: 'Amoxicillin', brandName: 'Amoxil',
  strength: 500, strengthUnit: 'mg', dosePerAdministration: 1, frequencyPerDay: 3, doseTimes: ['20:00', '08:00', '14:00'],
  dosingPattern: 'daily', durationDays: 7, startDate: '2026-09-24', confidence: SURE,
};

test('TC-EX-01: a clear prescription -> an unflagged body with every core field, doseTimes sorted', () => {
  const r = E.toPrescriptionBody({ patientId: 'pt-03', model: CLEAR });
  assert.equal(r.ok, true);
  assert.equal(r.needsReview, false);
  assert.deepEqual(r.body, {
    patientId: 'pt-03', needsReview: false, uncertainFields: [],
    prescription: {
      source: { facilityName: 'مستشفى مبارك الكبير', sector: 'public' },
      drug: { genericName: 'Amoxicillin', brandName: 'Amoxil', strengthMg: 500, strengthUnit: 'mg' },
      dosePerAdministration: 1, durationDays: 7, dosingPattern: 'daily', frequencyPerDay: 3, startDate: '2026-09-24',
      doseTimes: ['08:00', '14:00', '20:00'],
    },
  });
});

test('TC-EX-02: a low-confidence critical field is left UNSET and named, and the record is flagged', () => {
  const r = E.toPrescriptionBody({ patientId: 'pt-03', model: { ...CLEAR, confidence: { ...SURE, strengthMg: 0.5 } } });
  assert.equal(r.needsReview, true);
  assert.deepEqual(r.uncertainFields, ['strengthMg']);
  assert.equal('strengthMg' in r.body.prescription.drug, false);
});

test('TC-EX-03: alternate-day stays alternate_day', () => {
  assert.equal(E.toPrescriptionBody({ patientId: 'p', model: { ...CLEAR, dosingPattern: 'alternate_day' } }).body.prescription.dosingPattern, 'alternate_day');
});

test('TC-EX-04: not a prescription (or no answer at all) -> explicit failure, no record', () => {
  for (const model of [{ ...CLEAR, isPrescription: false }, {}, null, 'text']) {
    assert.deepEqual(E.toPrescriptionBody({ patientId: 'p', model }), { ok: false, code: 'not_a_prescription', missing: [] });
  }
});

test('TC-EX-05: "three times daily" with no times -> frequency kept, doseTimes unset and flagged, no invented clock times', () => {
  const r = E.toPrescriptionBody({ patientId: 'p', model: { ...CLEAR, doseTimes: null } });
  assert.equal(r.body.prescription.frequencyPerDay, 3);
  assert.equal('doseTimes' in r.body.prescription, false);
  assert.deepEqual(r.uncertainFields, ['doseTimes']);
});

test('doseTimes that disagree with the frequency, repeat, or are not HH:MM -> unset and flagged, never repaired', () => {
  for (const doseTimes of [['08:00', '20:00'], ['08:00', '08:00', '20:00'], ['8am', '2pm', '8pm'], ['24:00', '08:00', '14:00']]) {
    const r = E.toPrescriptionBody({ patientId: 'p', model: { ...CLEAR, doseTimes } });
    assert.ok(r.uncertainFields.includes('doseTimes'), JSON.stringify(doseTimes));
    assert.equal('doseTimes' in r.body.prescription, false);
  }
});

test('no start date is ever defaulted: missing or malformed -> flagged', () => {
  for (const startDate of [null, '24/09/2026', '2026-02-30']) {
    const r = E.toPrescriptionBody({ patientId: 'p', model: { ...CLEAR, startDate } });
    assert.deepEqual(r.uncertainFields, ['startDate']);
  }
});

test('a required field a reviewer cannot fix -> explicit failure naming it, never a default', () => {
  const r = E.toPrescriptionBody({ patientId: 'p', model: { ...CLEAR, facilityName: null, sector: 'semi-private', durationDays: 0 } });
  assert.deepEqual(r, { ok: false, code: 'required_field_unreadable', missing: ['facilityName', 'sector', 'durationDays'] });
});

test('the body carries no reviewer field and no key the route refuses', () => {
  const r = E.toPrescriptionBody({ patientId: 'p', model: { ...CLEAR, fieldReviewStatus: 'confirmed', id: 'rx-1', patientId: 'pt-99' } });
  assert.deepEqual(Object.keys(r.body).sort(), ['needsReview', 'patientId', 'prescription', 'uncertainFields']);
  assert.equal(r.body.patientId, 'p');
  assert.ok(!('fieldReviewStatus' in r.body.prescription) && !('id' in r.body.prescription));
});

test('the reply never says "saved" for a failure or a refused write', () => {
  const ok = E.toPrescriptionBody({ patientId: 'p', model: CLEAR });
  assert.match(E.extractionReply({ result: ok, statusCode: 201, language: 'ar' }), /انحفظت/);
  assert.match(E.extractionReply({ result: ok, statusCode: 422, language: 'ar' }), /ما انحفظت/);
  assert.match(E.extractionReply({ result: { ok: false, code: 'not_a_prescription' }, language: 'ar' }), /ما حفظنا/);
});
