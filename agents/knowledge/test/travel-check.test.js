'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { index, brandIndex, seedActive, rx } = require('./helpers');
const { travelCheck } = require('../src/travel-check');
const { buildBrandIndex } = require('../src/resolve');

const check = (over) => travelCheck(Object.assign({ index, brandIndex, language: 'ar', patientId: 't-patient' }, over));

test('G5: empty or unreadable text -> could_not_identify, app outcome could_not_identify', () => {
  for (const t of ['', null, '   ', '®™']) {
    const r = check({ visionText: t, prescriptions: [] });
    assert.equal(r.verdict, 'could_not_identify');
    assert.deepEqual(r.appOutcome, { kind: 'could_not_identify' });
  }
});

test('G2: a name not in the verified map or the index is a refusal, never a guess', () => {
  const r = check({ visionText: 'Brufen 400', prescriptions: seedActive('pt-01') });
  assert.equal(r.verdict, 'could_not_identify');
  assert.equal(r.reason, 'not_in_mapping_table');
});

test('unverified (pendingVerification) brands are never loaded - MAREVAN does not resolve', () => {
  assert.equal(brandIndex.has('marevan'), false);
  const r = check({ visionText: 'Marevan', prescriptions: [] });
  assert.equal(r.verdict, 'could_not_identify');
});

test('one near match -> needs_confirmation (the chat may ask), app outcome could_not_identify', () => {
  const r = check({ visionText: 'Eltroxim', prescriptions: [] });
  assert.equal(r.verdict, 'needs_confirmation');
  assert.deepEqual(r.candidates, ['ELTROXIN']);
  assert.deepEqual(r.appOutcome, { kind: 'could_not_identify' });
});

test('danger: KLACID photographed by a patient on Simvastatin -> interaction_found + ONE pending danger alert body', () => {
  const r = check({ visionText: 'KLACID 500MG', prescriptions: [rx('t-1', 'Simvastatin')] });
  assert.equal(r.verdict, 'interaction_found');
  assert.equal(r.reviewRequired, true);
  assert.ok(r.alert);
  assert.deepEqual(Object.keys(r.alert).sort(), ['description', 'involvedPrescriptionIds', 'patientId', 'reviewStatus', 'severity', 'sourceCitation']);
  assert.equal(r.alert.severity, 'danger');
  assert.equal(r.alert.reviewStatus, 'pending_medical_review');
  assert.deepEqual(r.alert.involvedPrescriptionIds, ['t-1']);
  assert.match(r.alert.sourceCitation, /level "Major"/);
  assert.deepEqual(r.appOutcome, { kind: 'identified', drugName: 'Clarithromycin', verdict: 'interaction_found' });
});

test('already taking: EUTHYROX photographed by سارة (on Levothyroxine) -> already_taking, never "no interaction"', () => {
  const r = check({ patientId: 'pt-03', visionText: 'Euthyrox', prescriptions: seedActive('pt-03') });
  assert.equal(r.verdict, 'already_taking');
  assert.equal(r.alreadyTaking[0].prescriptionId, 'rx-008');
  assert.equal(r.appOutcome.verdict, 'interaction_found');
  assert.equal(r.alert, null, 'only a danger finding raises an alert');
});

test('cannot verify: a covered candidate against a profile drug the index lacks (Gliclazide) -> cannot_verify, app could_not_identify', () => {
  const r = check({ visionText: 'ZOCOR', prescriptions: [rx('t-1', 'Gliclazide')] });
  assert.equal(r.verdict, 'cannot_verify');
  assert.deepEqual(r.appOutcome, { kind: 'could_not_identify' });
  assert.ok(r.notCovered.includes('Gliclazide'));
});

test('F2: ZOCOR against the seed profile of حمد is now checkable - Simvastatin x Warfarin is in DDInter -> interaction_found', () => {
  const r = check({ patientId: 'pt-01', visionText: 'ZOCOR', prescriptions: seedActive('pt-01') });
  assert.equal(r.verdict, 'interaction_found');
  assert.deepEqual(r.notCovered, []);
});

test('an ungraded (Unknown) row -> cannot_verify with the ungraded message, never no_interaction', () => {
  const r = check({ visionText: 'Panadrex', prescriptions: [rx('t-1', 'Simvastatin')] });
  assert.equal(r.verdict, 'cannot_verify');
  assert.equal(r.reason, 'ungraded_interaction_in_source');
  assert.match(r.message, /من غير تحديد درجة شدته/);
});

test('no_interaction_found only when every pair was checkable - and the words never say "safe"', () => {
  const r = check({ visionText: 'Ezetimibe', prescriptions: [rx('t-1', 'Amlodipine')], language: 'en' });
  assert.equal(r.verdict, 'no_interaction_found');
  assert.deepEqual(r.appOutcome, { kind: 'identified', drugName: 'Ezetimibe', verdict: 'no_interaction' });
  assert.match(r.message, /not a clearance/);
  assert.doesNotMatch(r.message, /\bsafe\b/i);
});

test('a combination product screens EVERY ingredient (Panadol Cold & Flu has pseudoephedrine x levothyroxine, Moderate)', () => {
  const r = check({ visionText: 'PANADOL COLD & FLU', prescriptions: [rx('t-1', 'Levothyroxine')] });
  assert.equal(r.verdict, 'interaction_found');
  assert.ok(r.findings.some((f) => f.candidateIngredient === 'pseudoephedrine' && f.severity === 'warning'));
  assert.equal(r.alert, null);
});

test('flagged prescriptions are excluded from the profile and listed (TC-IX-06)', () => {
  const r = check({ patientId: 'pt-02', visionText: 'ZOCOR', prescriptions: seedActive('pt-02') });
  assert.deepEqual(r.excluded.map((e) => e.id).sort(), ['rx-006', 'rx-007']);
});

test('a generic box resolves only by the index\'s own ingredient name, exactly', () => {
  const bi = buildBrandIndex([], index);
  const r = travelCheck({ patientId: 't', visionText: 'Amlodipine 5 mg tablets', prescriptions: [], index, brandIndex: bi, language: 'en' });
  assert.equal(r.candidate.via, 'index_ingredient_name');
  assert.equal(r.verdict, 'no_interaction_found');
});

// ---------------------------------------------------------------- regressions from the adversarial review
test('a flagged or returned prescription in the profile -> cannot_verify, never a false all-clear', () => {
  for (const extra of [{ needsReview: true, fieldReviewStatus: 'pending' }, { needsReview: true, fieldReviewStatus: 'returned' }, { fieldReviewStatus: 'returned' }]) {
    const r = check({ visionText: 'ZOCOR', prescriptions: [rx('t-1', 'Clarithromycin', extra)] });
    assert.equal(r.verdict, 'cannot_verify', JSON.stringify(extra));
    assert.equal(r.reason, 'profile_has_unconfirmed_prescriptions');
    assert.deepEqual(r.appOutcome, { kind: 'could_not_identify' });
  }
});

test('a bare family name with line extensions ("PANADOL") -> needs_confirmation listing them, never the base product', () => {
  const r = check({ visionText: 'PANADOL', prescriptions: [rx('t-1', 'Diphenhydramine')] });
  assert.equal(r.verdict, 'needs_confirmation');
  assert.deepEqual(r.candidates, ['PANADOL', 'PANADOL EXTRA', 'PANADOL COLD & FLU', 'PANADOL NIGHT']);
  assert.match(r.message, /يُستخدم لأكثر من دواء بمكونات مختلفة/);
  assert.doesNotMatch(r.message, /صورة أوضح/, 'never promises that a clearer photo of the same name will help');
  const full = check({ visionText: 'PANADOL COLD & FLU', prescriptions: [rx('t-1', 'Diphenhydramine')] });
  assert.equal(full.verdict, 'interaction_found');
});

test('"Plus"/"Forte" are part of the name: "Panadol Plus" does not resolve to PANADOL', () => {
  for (const t of ['Panadol Plus', 'Panadol Forte']) assert.equal(check({ visionText: t, prescriptions: [] }).verdict, 'could_not_identify');
});

test('already_taking names only the ingredient the patient already takes', () => {
  const r = check({ visionText: 'INEGY', prescriptions: [rx('t-1', 'Simvastatin')], language: 'en' });
  assert.equal(r.verdict, 'already_taking');
  assert.match(r.message, /already taking Simvastatin/);
  assert.doesNotMatch(r.message, /Ezetimibe/);
});

test('patient-facing travel text never shows a raw normalised key', () => {
  const r = check({ visionText: 'KLACID', prescriptions: [rx('t-1', 'Gliclazide')], language: 'en' });
  assert.equal(r.verdict, 'cannot_verify');
  assert.match(r.message, /but our drug-interaction database does not include Gliclazide,/);
});

test('a generic box is named by its ingredient, not by the brand row that owns the key', () => {
  const r = check({ visionText: 'Acetaminophen 500 mg', prescriptions: [], language: 'en' });
  assert.equal(r.candidate.brandLabel, 'Acetaminophen');
});

test('singular/plural: one or two unconfirmed prescriptions read correctly', () => {
  const one = check({ visionText: 'ZOCOR', prescriptions: [rx('t-1', 'Clarithromycin', { needsReview: true })], language: 'en' });
  assert.match(one.message, /1 of your prescriptions is still awaiting review/);
  const two = check({ visionText: 'ZOCOR', prescriptions: [rx('t-1', 'Clarithromycin', { needsReview: true }), rx('t-2', 'Amlodipine', { needsReview: true })] });
  assert.match(two.message, /وصفتان من وصفاتك ما زالتا بانتظار المراجعة/);
});
