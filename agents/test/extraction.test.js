'use strict';

/** agents/lib/extraction.js (the Telegram channel) against the drug-knowledge core (AP-03/D3/CR-075). */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../lib/extraction.js');

const SURE = Object.fromEntries(E.CONFIDENCE_KEYS.map((k) => [k, 0.95]));
const CLEAR = {
  isPrescription: true, facilityName: 'مستشفى مبارك الكبير', sector: 'public', genericName: 'Amoxicillin', brandName: 'Amoxil',
  strength: 500, strengthUnit: 'mg', dosePerAdministration: 1, frequencyPerDay: 3, doseTimes: ['08:00', '14:00', '20:00'],
  dosingPattern: 'daily', durationDays: 7, startDate: '2026-09-24', confidence: SURE,
};
const geminiRes = (candidate) => ({ statusCode: 200, body: { candidates: [candidate] } });
const okCandidate = (model) => ({ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(model) }] } });

test('TC-EX-01: a clear prescription -> an unflagged body built by the shared core, doseTimes as written (the core does not sort)', () => {
  const r = E.toPrescriptionBody({ patientId: 'pt-03', model: CLEAR });
  assert.equal(r.ok, true);
  assert.equal(r.needsReview, false);
  assert.deepEqual(r.uncertainFields, []);
  assert.equal(r.body.prescription.drug.strengthMg, 500);
  assert.equal(r.body.prescription.drug.strengthUnit, 'mg');
  assert.deepEqual(r.body.prescription.doseTimes, ['08:00', '14:00', '20:00']);
});

test('a strength with NO unit written is flagged - no unit is ever assumed', () => {
  const r = E.toPrescriptionBody({ patientId: 'pt-03', model: Object.assign({}, CLEAR, { strengthUnit: null }) });
  assert.equal(r.ok, true);
  assert.equal(r.needsReview, true);
  assert.ok(r.uncertainFields.includes('strengthMg'), JSON.stringify(r.uncertainFields));
  assert.ok(!('strengthMg' in r.body.prescription.drug));
  assert.ok(!('strengthUnit' in r.body.prescription.drug));
});

test('TC-EX-04: not a prescription -> explicit failure, never a record, and its own reply', () => {
  const r = E.toPrescriptionBody({ patientId: 'pt-03', model: Object.assign({}, CLEAR, { isPrescription: false }) });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'not_a_prescription');
  assert.match(E.extractionReply({ result: r, language: 'ar' }), /ما تبين إنها وصفة/);
  assert.match(E.extractionReply({ result: r, language: 'en' }), /does not look like a prescription/);
});

test('a truncated answer (finishReason MAX_TOKENS) is unreadable with the reason named, never parsed', () => {
  const res = geminiRes({ finishReason: 'MAX_TOKENS', content: { parts: [{ text: JSON.stringify(CLEAR) }] } });
  const { model, reason } = E.readVision(res);
  assert.equal(model, null);
  assert.equal(reason, 'vision_finish_MAX_TOKENS');
  const r = E.extractFromTelegram({ patientId: 'pt-03', res, caption: null, fileProblem: null });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'unreadable');
  assert.equal(r.reason, 'vision_finish_MAX_TOKENS');
  assert.ok(!('body' in r));
});

test('an outage (HTTP 503) is unreadable, never "not a prescription" - and reads differently to the patient', () => {
  const res = { statusCode: 503, body: null };
  const { model, reason } = E.readVision(res);
  assert.equal(model, null);
  assert.equal(reason, 'vision_http_503');
  const r = E.extractFromTelegram({ patientId: 'pt-03', res, caption: null, fileProblem: null });
  assert.equal(r.code, 'unreadable');
  const notAPrescription = { ok: false, code: 'not_a_prescription' };
  assert.notEqual(E.extractionReply({ result: r, language: 'ar' }), E.extractionReply({ result: notAPrescription, language: 'ar' }));
  assert.notEqual(E.extractionReply({ result: r, language: 'en' }), E.extractionReply({ result: notAPrescription, language: 'en' }));
});

test('TC-EX-06: a contradicting caption, through extractFromTelegram, flags the named field and leaves it unset', () => {
  const res = geminiRes(okCandidate(Object.assign({}, CLEAR, { captionConflicts: ['startDate'] })));
  const r = E.extractFromTelegram({ patientId: 'pt-03', res, caption: 'من عيادتي', fileProblem: null });
  assert.equal(r.ok, true);
  assert.equal(r.needsReview, true);
  assert.ok(r.uncertainFields.includes('startDate'), JSON.stringify(r.uncertainFields));
  assert.ok(!('startDate' in r.body.prescription));
});

test('a file problem short-circuits before the vision response is even read', () => {
  const r = E.extractFromTelegram({ patientId: 'pt-03', res: null, caption: null, fileProblem: 'file_not_downloaded' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'unreadable');
  assert.equal(r.reason, 'file_not_downloaded');
  assert.ok(!('body' in r));
});

test('a save failure never reads as saved to the patient', () => {
  const ok = E.toPrescriptionBody({ patientId: 'pt-03', model: CLEAR });
  assert.match(E.extractionReply({ result: ok, statusCode: 201, language: 'ar' }), /انحفظت/);
  assert.match(E.extractionReply({ result: ok, statusCode: 422, language: 'ar' }), /ما انحفظت/);
});

test('a flagged (needsReview) record reads as pending review, not silently saved clean', () => {
  const flagged = E.toPrescriptionBody({ patientId: 'pt-03', model: Object.assign({}, CLEAR, { strengthUnit: null }) });
  assert.match(E.extractionReply({ result: flagged, statusCode: 201, language: 'ar' }), /بيراجعها مختص طبي/);
  assert.match(E.extractionReply({ result: flagged, statusCode: 201, language: 'en' }), /medical reviewer/);
});

test('a clear record reads as saved and screened, in both languages', () => {
  const clear = E.toPrescriptionBody({ patientId: 'pt-03', model: CLEAR });
  assert.match(E.extractionReply({ result: clear, statusCode: 201, language: 'ar' }), /نفحصها الحين/);
  assert.match(E.extractionReply({ result: clear, statusCode: 201, language: 'en' }), /being checked/);
});
