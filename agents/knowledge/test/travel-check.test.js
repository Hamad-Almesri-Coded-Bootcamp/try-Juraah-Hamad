'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { index, brandIndex, pendingNames, seedActive, rx, BRANDS_JSON } = require('./helpers');
const { travelCheck, appOutcomeFor, VERDICT } = require('../src/travel-check');
const { buildBrandIndex, resolveToIngredient } = require('../src/resolve');

const check = (over) => travelCheck(Object.assign({ index, brandIndex, language: 'ar', patientId: 't-patient' }, over));

test('G5: empty or unreadable text -> could_not_identify, app outcome could_not_identify', () => {
  for (const t of ['', null, '   ', '®™']) {
    const r = check({ visionText: t, prescriptions: [] });
    assert.equal(r.verdict, 'could_not_identify');
    assert.deepEqual(r.appOutcome, { kind: 'could_not_identify' });
  }
});

test('G2: a name not in the verified map or the index is a refusal, never a guess', () => {
  // Lipitor really is absent from the SFDA register on 2026-09-24 (AP-07), so this still exercises
  // the refusal with a genuinely unverified name. Brufen 400 now resolves - see the AP-07 tests below.
  const r = check({ visionText: 'Lipitor 20', prescriptions: seedActive('pt-01') });
  assert.equal(r.verdict, 'could_not_identify');
  assert.equal(r.reason, 'not_in_mapping_table');
});

test('unverified (pendingVerification) brands are never loaded - MAREVAN never resolves to Warfarin, but answers cannot_verify, not "unknown"', () => {
  assert.equal(brandIndex.has('marevan'), false);
  const r = check({ visionText: 'Marevan', prescriptions: [], pendingNames });
  assert.equal(r.verdict, 'cannot_verify');
  assert.equal(r.reason, 'brand_not_verified');
  assert.equal(r.brandLabel, 'MAREVAN');
  assert.equal(r.candidate, null, 'never resolved to an ingredient');
  assert.deepEqual(r.findings, []);
  assert.equal(r.alert, null);
  assert.deepEqual(r.appOutcome, { kind: 'cannot_verify' });
  // Without the pending-brand list (the default in every other test here), the same box is simply unknown.
  assert.equal(check({ visionText: 'Marevan', prescriptions: [] }).verdict, 'could_not_identify');
});

// ---------------------------------------------------------------- AP-07: SFDA brand verification
test('AP-07: BRUFEN resolves to Ibuprofen', () => {
  for (const name of ['BRUFEN', 'Brufen 400', 'BRUFEN 400 MG TAB', 'BRUFEN TAB 600MG']) {
    const r = resolveToIngredient(name, brandIndex);
    assert.equal(r.outcome, 'resolved', name);
    assert.deepEqual(r.ingredientLabels, ['Ibuprofen'], name);
    assert.equal(r.via, 'brand', name);
    assert.equal(r.sfdaTradeName, 'BRUFEN 400 MG TAB', name);
    assert.ok(index.drugs.has(r.ingredients[0]), name + ': key is in index.drugs');
  }

  // BRUFEN photographed by حمد, whose active profile already carries Marevan (Warfarin, rx-001):
  // Warfarin x Ibuprofen is the seed's own DDInter Major row (ia-001, AP-06).
  const danger = check({ patientId: 'pt-01', visionText: 'BRUFEN', prescriptions: seedActive('pt-01') });
  assert.equal(danger.verdict, 'interaction_found');
  assert.ok(danger.alert);
  assert.equal(danger.alert.reviewStatus, 'pending_medical_review');
  assert.match(danger.alert.sourceCitation, /level "Major"/);

  const row = BRANDS_JSON.brands.find((b) => b.brand === 'BRUFEN');
  assert.equal(row.source, BRANDS_JSON.meta.source);
  assert.equal(row.retrievedAt, '2026-09-24');
  assert.match(row.retrievedBy, /approved by the owner \(Mohammad\) on 2026-09-25/);
});

test('AP-07: GLUCOPHAGE resolves to Metformin', () => {
  for (const name of ['GLUCOPHAGE', 'Glucophage XR', 'GLUCOPHAGE 850 mg tablet', 'GLUCOPHAGE 1 g tablet', 'GLUCOPHAGE XR 750MG TABLET']) {
    const r = resolveToIngredient(name, brandIndex);
    assert.equal(r.outcome, 'resolved', name);
    assert.deepEqual(r.ingredientLabels, ['Metformin'], name);
    assert.equal(r.via, 'brand', name);
  }

  const clean = check({ visionText: 'GLUCOPHAGE', prescriptions: [rx('t-1', 'Calcium carbonate')] });
  assert.equal(clean.verdict, 'no_interaction_found');
  assert.deepEqual(clean.appOutcome, { kind: 'identified', drugName: 'Metformin', verdict: 'no_interaction' });

  const row = BRANDS_JSON.brands.find((b) => b.brand === 'GLUCOPHAGE');
  assert.equal(row.source, BRANDS_JSON.meta.source);
  assert.equal(row.retrievedAt, '2026-09-24');
  assert.match(row.retrievedBy, /approved by the owner \(Mohammad\) on 2026-09-25/);
});

test('AP-07: MAREVAN and LIPITOR fail closed - not in the SFDA list on 2026-09-24', () => {
  const pending = BRANDS_JSON.pendingVerification.brands;
  const marevan = pending.find((b) => b.brand === 'MAREVAN');
  const lipitor = pending.find((b) => b.brand === 'LIPITOR');
  // The input this test needs must actually exist, so it cannot pass on a row that was never added.
  assert.ok(marevan && marevan.verified === false, 'MAREVAN must be present in pendingVerification, unverified');
  assert.ok(lipitor && lipitor.verified === false, 'LIPITOR must be present in pendingVerification, unverified');
  assert.equal(BRANDS_JSON.brands.some((b) => b.brand === 'MAREVAN'), false, 'MAREVAN must not be in the verified brands list');
  assert.equal(BRANDS_JSON.brands.some((b) => b.brand === 'LIPITOR'), false, 'LIPITOR must not be in the verified brands list');

  // The verified:false flag is what gates them, not merely which section of the file they sit in.
  const everything = buildBrandIndex(BRANDS_JSON.brands.concat(pending), index);
  assert.equal(everything.has('marevan'), false);
  assert.equal(everything.has('lipitor'), false);

  for (const text of ['Marevan 5 mg', 'Lipitor 20 mg']) {
    const r = check({ visionText: text, prescriptions: seedActive('pt-01') });
    assert.equal(r.verdict, 'could_not_identify', text);
    assert.equal(r.reason, 'not_in_mapping_table', text);
    assert.deepEqual(r.appOutcome, { kind: 'could_not_identify' }, text);
    assert.deepEqual(r.findings, [], text);
    assert.equal(r.alert, null, text);
  }
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

test('cannot verify: a covered candidate against a profile drug the index lacks (Gliclazide) -> cannot_verify, app cannot_verify', () => {
  const r = check({ visionText: 'ZOCOR', prescriptions: [rx('t-1', 'Gliclazide')] });
  assert.equal(r.verdict, 'cannot_verify');
  assert.deepEqual(r.appOutcome, { kind: 'cannot_verify' });
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
  assert.deepEqual(r.appOutcome, { kind: 'cannot_verify' });
});

test('no_interaction_found only when every pair was checkable - and the words never say "safe"', () => {
  // Metformin is ATC A and DDInter file A is loaded, so its missing row with Calcium carbonate is a real "none recorded".
  const r = check({ visionText: 'Metformin 500 mg', prescriptions: [rx('t-1', 'Calcium carbonate')], language: 'en' });
  assert.equal(r.verdict, 'no_interaction_found');
  assert.deepEqual(r.appOutcome, { kind: 'identified', drugName: 'Metformin', verdict: 'no_interaction' });
  assert.match(r.message, /not a clearance/);
  assert.doesNotMatch(r.message, /\bsafe\b/i);
});

test('AP-06: both drugs outside the loaded DDInter files (Ezetimibe x Amlodipine, Atorvastatin x Ciprofloxacin) -> cannot_verify, never no_interaction; app cannot_verify (D6/CR-078)', () => {
  // SFDA extension (2026-09-26): loading DDInter's file R turned up a real Ibuprofen x Ciprofloxacin
  // row (Moderate), so that pair no longer demonstrates "cannot verify" - Atorvastatin (ATC C, never
  // loaded by any of this build's eight files) takes its place here.
  for (const [box, onFile] of [['Ezetimibe', 'Amlodipine'], ['Atorvastatin 20 mg', 'Ciprofloxacin']]) {
    const r = check({ visionText: box, prescriptions: [rx('t-1', onFile)], language: 'en' });
    assert.equal(r.verdict, 'cannot_verify', box);
    assert.equal(r.reason, 'pair_outside_loaded_categories');
    assert.deepEqual(r.appOutcome, { kind: 'cannot_verify' });
    assert.equal(r.notCheckable.length, 1);
    assert.match(r.message, new RegExp('would cover it with ' + onFile + ' is not available to us yet'));
    assert.doesNotMatch(r.message, /not a clearance|no interaction/i);
  }
  const ar = check({ visionText: 'Ezetimibe', prescriptions: [rx('t-1', 'Amlodipine')] });
  assert.match(ar.message, /لكن الجزء الذي يغطيه مع Amlodipine في قاعدة بيانات التداخلات الدوائية غير متوفر عندنا بعد/);
  assert.doesNotMatch(ar.message, /—/);
});

test('AP-06: one checkable pair does not clear an uncheckable one on the same profile', () => {
  const r = check({ visionText: 'Metformin', prescriptions: [rx('t-1', 'Calcium carbonate'), rx('t-2', 'Diphenhydramine')] });
  assert.equal(r.verdict, 'no_interaction_found', 'Metformin (A) makes both absences conclusive');
  const s = check({ visionText: 'Ezetimibe', prescriptions: [rx('t-1', 'Calcium carbonate'), rx('t-2', 'Amlodipine')] });
  assert.equal(s.verdict, 'cannot_verify');
  assert.deepEqual(s.notCheckable.map((n) => n.prescriptionId), ['t-2']);
  assert.deepEqual(s.appOutcome, { kind: 'cannot_verify' });
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
test('a flagged or returned prescription in the profile -> cannot_verify, never a false all-clear; app cannot_verify (D6/CR-078)', () => {
  for (const extra of [{ needsReview: true, fieldReviewStatus: 'pending' }, { needsReview: true, fieldReviewStatus: 'returned' }, { fieldReviewStatus: 'returned' }]) {
    const r = check({ visionText: 'ZOCOR', prescriptions: [rx('t-1', 'Clarithromycin', extra)] });
    assert.equal(r.verdict, 'cannot_verify', JSON.stringify(extra));
    assert.equal(r.reason, 'profile_has_unconfirmed_prescriptions');
    assert.deepEqual(r.appOutcome, { kind: 'cannot_verify' });
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
  assert.deepEqual(r.appOutcome, { kind: 'cannot_verify' });
});

test('a generic box is named by its ingredient, not by the brand row that owns the key', () => {
  const r = check({ visionText: 'Acetaminophen 500 mg', prescriptions: [], language: 'en' });
  assert.equal(r.candidate.brandLabel, 'Acetaminophen');
});

test('AP-07 regression: BRUFEN now owns the ibuprofen key, as PANADOL owns acetaminophen - a generic box still names itself', () => {
  const r = check({ visionText: 'Ibuprofen 400 mg', prescriptions: [rx('t-1', 'Ciprofloxacin')], language: 'en' });
  assert.equal(r.candidate.brandLabel, 'Ibuprofen');
  assert.equal(r.candidate.via, 'generic');
});

test('singular/plural: one or two unconfirmed prescriptions read correctly', () => {
  const one = check({ visionText: 'ZOCOR', prescriptions: [rx('t-1', 'Clarithromycin', { needsReview: true })], language: 'en' });
  assert.match(one.message, /1 of your prescriptions is still awaiting review/);
  const two = check({ visionText: 'ZOCOR', prescriptions: [rx('t-1', 'Clarithromycin', { needsReview: true }), rx('t-2', 'Amlodipine', { needsReview: true })] });
  assert.match(two.message, /وصفتان من وصفاتك ما زالتا بانتظار المراجعة/);
});

// ---------------------------------------------------------------- CR-078: cannot_verify is its own outcome
test('a profile the backend never handed us is cannot_verify/profile_unavailable, never no_interaction (fail closed)', () => {
  for (const prescriptions of [undefined, null]) {
    const r = check({ visionText: 'ZOCOR', prescriptions });
    assert.equal(r.verdict, 'cannot_verify', String(prescriptions));
    assert.equal(r.reason, 'profile_unavailable');
    assert.deepEqual(r.appOutcome, { kind: 'cannot_verify' });
    assert.equal(r.alert, null, 'no screening happens, so nothing can be raised');
    assert.deepEqual(r.findings, []);
    assert.ok(r.candidate, 'the drug was still resolved - only the profile is unavailable');
  }
  // G5 (unreadable) answers first: it never even reaches the profile-availability check.
  assert.equal(check({ visionText: '', prescriptions: null }).verdict, 'could_not_identify');
  // A real empty profile [] is unchanged: today's behaviour, not "unavailable".
  assert.equal(check({ visionText: 'ZOCOR', prescriptions: [] }).verdict, 'no_interaction_found');
});

test('appOutcomeFor: every VERDICT maps to exactly one DrugCheckOutcome kind; anything else stays fail-closed', () => {
  assert.deepEqual(appOutcomeFor(VERDICT.INTERACTION_FOUND, 'X', null), { kind: 'identified', drugName: 'X', verdict: 'interaction_found' });
  assert.deepEqual(appOutcomeFor(VERDICT.INTERACTION_FOUND, 'X', 'ia-1'), { kind: 'identified', drugName: 'X', verdict: 'interaction_found', alertId: 'ia-1' });
  assert.deepEqual(appOutcomeFor(VERDICT.ALREADY_TAKING, 'X', null), { kind: 'identified', drugName: 'X', verdict: 'interaction_found' });
  assert.deepEqual(appOutcomeFor(VERDICT.NO_INTERACTION_FOUND, 'X', null), { kind: 'identified', drugName: 'X', verdict: 'no_interaction' });
  assert.deepEqual(appOutcomeFor(VERDICT.CANNOT_VERIFY, 'X', null), { kind: 'cannot_verify' });
  assert.deepEqual(appOutcomeFor(VERDICT.CANNOT_VERIFY, null, null), { kind: 'cannot_verify' });
  assert.deepEqual(appOutcomeFor(VERDICT.NEEDS_CONFIRMATION, 'X', null), { kind: 'could_not_identify' });
  assert.deepEqual(appOutcomeFor(VERDICT.COULD_NOT_IDENTIFY, 'X', null), { kind: 'could_not_identify' });
  assert.deepEqual(appOutcomeFor('safe', 'X', null), { kind: 'could_not_identify' });
  assert.deepEqual(appOutcomeFor(undefined, 'X', null), { kind: 'could_not_identify' });
});
