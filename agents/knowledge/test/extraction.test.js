'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { toPrescriptionBody, FLAGGABLE } = require('../src/extraction');

const SURE = Object.fromEntries(require('../src/extraction').CONFIDENCE_KEYS.map((k) => [k, 0.95]));
const CLEAR = {
  isPrescription: true, facilityName: 'مستشفى العدان', sector: 'public', genericName: 'Levothyroxine', brandName: 'Eltroxin',
  strength: 50, strengthUnit: 'mcg', dosePerAdministration: 1, frequencyPerDay: 1, doseTimes: ['07:00'],
  dosingPattern: 'daily', durationDays: 180, startDate: '2026-08-10', confidence: SURE
};
const run = (model, extra) => toPrescriptionBody(Object.assign({ patientId: 'pt-03', model }, extra || {}));

test('TC-EX-01: a clear prescription -> confident body, strength kept in its written unit (50 mcg, never 0.05)', () => {
  const r = run(CLEAR);
  assert.equal(r.ok, true);
  assert.equal(r.needsReview, false);
  assert.deepEqual(r.uncertainFields, []);
  assert.equal(r.body.prescription.drug.strengthMg, 50);
  assert.equal(r.body.prescription.drug.strengthUnit, 'mcg');
  assert.deepEqual(r.body.prescription.doseTimes, ['07:00']);
  assert.equal(r.appOutcome.kind, 'confident');
});

test('TC-EX-02: a low-confidence strength is removed and flagged, never kept with a caveat', () => {
  const r = run(Object.assign({}, CLEAR, { confidence: Object.assign({}, SURE, { strength: 0.4 }) }));
  assert.equal(r.ok, true);
  assert.equal(r.needsReview, true);
  assert.deepEqual(r.uncertainFields, ['strengthMg']);
  assert.ok(!('strengthMg' in r.body.prescription.drug));
  assert.ok(!('strengthUnit' in r.body.prescription.drug));
  assert.equal(r.appOutcome.kind, 'needs_review');
});

test('a strength with NO unit written is flagged - no unit is ever assumed', () => {
  const r = run(Object.assign({}, CLEAR, { strengthUnit: null }));
  assert.deepEqual(r.uncertainFields, ['strengthMg']);
});

test('TC-EX-03: alternate-day is carried through, not defaulted to daily', () => {
  const r = run(Object.assign({}, CLEAR, { dosingPattern: 'alternate_day' }));
  assert.equal(r.body.prescription.dosingPattern, 'alternate_day');
});

test('TC-EX-04: not a prescription -> explicit failure, never a record', () => {
  for (const m of [{ isPrescription: false }, null, undefined, 'text', { genericName: 'X' }]) {
    const r = run(m);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'not_a_prescription');
    assert.deepEqual(r.appOutcome, { kind: 'unreadable' });
    assert.ok(!('body' in r));
  }
});

test('TC-EX-05: "three times daily" with no times -> frequency kept, doseTimes unset and flagged; never invented', () => {
  const r = run(Object.assign({}, CLEAR, { frequencyPerDay: 3, doseTimes: null }));
  assert.equal(r.body.prescription.frequencyPerDay, 3);
  assert.ok(!('doseTimes' in r.body.prescription));
  assert.deepEqual(r.uncertainFields, ['doseTimes']);
});

test('doseTimes that do not match frequencyPerDay, or malformed, or duplicated -> unset and flagged, never "fixed"', () => {
  for (const times of [['08:00', '20:00'], ['8:00'], ['24:00'], ['08:00', '08:00', '08:00'], []]) {
    const r = run(Object.assign({}, CLEAR, { frequencyPerDay: 3, doseTimes: times }));
    assert.ok(r.uncertainFields.includes('doseTimes'), JSON.stringify(times));
    assert.ok(!('doseTimes' in r.body.prescription));
  }
});

test('no start date is ever defaulted', () => {
  for (const d of [null, '2026-02-30', '21/09/2026', 'today']) {
    const r = run(Object.assign({}, CLEAR, { startDate: d }));
    assert.ok(r.uncertainFields.includes('startDate'));
    assert.ok(!('startDate' in r.body.prescription));
  }
});

test('a REQUIRED field that cannot be read -> explicit failure naming it, nothing to save', () => {
  const cases = [
    [{ genericName: null }, 'genericName'],
    [{ facilityName: '' }, 'source.facilityName'],
    [{ sector: 'government' }, 'source.sector'],
    [{ dosePerAdministration: 0 }, 'dosePerAdministration'],
    [{ durationDays: 7.5 }, 'durationDays'],
    [{ dosingPattern: 'weekly' }, 'dosingPattern'],
    [{ confidence: Object.assign({}, SURE, { genericName: 0.5 }) }, 'genericName']
  ];
  for (const [over, field] of cases) {
    const r = run(Object.assign({}, CLEAR, over));
    assert.equal(r.ok, false, field);
    assert.equal(r.code, 'missing_required');
    assert.ok(r.missing.includes(field), field + ' in ' + r.missing);
  }
});

test('a source the caller already knows wins over the model reading', () => {
  const r = run(Object.assign({}, CLEAR, { facilityName: null, sector: null }), { source: { facilityName: 'عيادة النخبة الطبية', sector: 'private' } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.body.prescription.source, { facilityName: 'عيادة النخبة الطبية', sector: 'private' });
});

test('no brand written is legitimate (generic-only record) and not flagged', () => {
  const r = run(Object.assign({}, CLEAR, { brandName: null }));
  assert.equal(r.needsReview, false);
  assert.ok(!('brandName' in r.body.prescription.drug));
});

test('dispensing and prescribedAt are never taken from a prescription image', () => {
  const r = run(Object.assign({}, CLEAR, { dispensing: { unitsPerPackage: 30, totalQuantityDispensed: 90, dispenseDate: '2026-08-10' }, prescribedAt: '2026-08-10T10:00:00+03:00' }));
  assert.ok(!('dispensing' in r.body.prescription));
  assert.ok(!('prescribedAt' in r.body.prescription));
});

test('a MISSING confidence is not confidence: no confidence at all -> nothing saved as unflagged', () => {
  const noConf = Object.assign({}, CLEAR);
  delete noConf.confidence;
  const r = run(noConf);
  assert.equal(r.ok, false, 'required fields without a confidence cannot be saved');
  assert.equal(r.code, 'missing_required');
});

test('a confidence given as a string or NaN counts as not sure', () => {
  for (const bad of ['0.95', NaN, null]) {
    const r = run(Object.assign({}, CLEAR, { confidence: Object.assign({}, SURE, { strength: bad }) }));
    assert.ok(r.uncertainFields.includes('strengthMg'), String(bad));
  }
});

test('strengthUnit needs its own confidence', () => {
  const r = run(Object.assign({}, CLEAR, { confidence: Object.assign({}, SURE, { strengthUnit: 0.5 }) }));
  assert.deepEqual(r.uncertainFields, ['strengthMg']);
});

test('no brand written, but not sure of that -> brandName flagged', () => {
  const r = run(Object.assign({}, CLEAR, { brandName: null, confidence: Object.assign({}, SURE, { brandName: 0.3 }) }));
  assert.deepEqual(r.uncertainFields, ['brandName']);
});

test('the response schema requires a confidence for every read field', () => {
  const { RESPONSE_SCHEMA, CONFIDENCE_KEYS } = require('../src/extraction');
  assert.ok(RESPONSE_SCHEMA.required.includes('confidence'));
  assert.deepEqual(RESPONSE_SCHEMA.properties.confidence.required, CONFIDENCE_KEYS);
  for (const k of CONFIDENCE_KEYS) assert.ok(RESPONSE_SCHEMA.properties.confidence.properties[k], k);
});

test('the body never carries a reviewer field, an id, a status or a tracked flag', () => {
  const r = run(CLEAR);
  const p = r.body.prescription;
  for (const k of ['id', 'status', 'tracked', 'fieldReviewStatus', 'fieldReviewedBy', 'fieldReviewedAt', 'fieldReviewNote', 'needsReview', 'patientId']) {
    assert.ok(!(k in p), k);
  }
  assert.deepEqual(Object.keys(r.body).sort(), ['needsReview', 'patientId', 'prescription', 'uncertainFields']);
});

test('uncertainFields only ever uses the five CR-002 names, in their fixed order', () => {
  const r = run(Object.assign({}, CLEAR, { strength: null, frequencyPerDay: null, doseTimes: null, startDate: null,
                                           confidence: Object.assign({}, SURE, { brandName: 0.2 }) }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.uncertainFields, FLAGGABLE);
});

test('secondary text (e.g. "on an empty stomach") is kept only when read confidently, otherwise left out - never flagged', () => {
  const m = Object.assign({}, CLEAR, { timingRelativeToFood: 'on an empty stomach', specialNotes: 'x' });
  const kept = run(m);
  assert.equal(kept.body.prescription.timingRelativeToFood, 'on an empty stomach');
  const unsure = run(Object.assign({}, m, { confidence: Object.assign({}, SURE, { timingRelativeToFood: 0.3 }) }));
  assert.ok(!('timingRelativeToFood' in unsure.body.prescription));
  assert.equal(unsure.needsReview, false);
});
