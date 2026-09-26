'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { index, brandIndex, pendingNames, seedActive, rx, BRANDS_JSON } = require('./helpers');
const { travelCheck, appOutcomeFor, VERDICT } = require('../src/travel-check');
const { buildBrandIndex, resolveToIngredient } = require('../src/resolve');

const check = (over) => travelCheck(Object.assign({ index, brandIndex, language: 'ar', patientId: 't-patient' }, over));

// A fixture in the SFDA data-file shape (agents/knowledge/data/sfda-brands.json's `names` map),
// not the real 20k-row register: another builder produces that file - resolve.js/build.js only need
// to code against its shape, proven here with two small, clearly-fictional rows.
const SFDA_FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sfda-brands.sample.json'), 'utf8'));

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

// ---------------------------------------------------------------- 2026-09-26: the isMedicine gate,
// the field-by-field resolver (brandAsPrinted / ingredientsAsPrinted), and the SFDA brand source.
test('decision (a): isMedicine false -> not_a_medicine, decided before any lookup - no alert, no candidate', () => {
  const r = check({ visionRead: { isMedicine: false, brandAsPrinted: null, ingredientsAsPrinted: [], strengthAsPrinted: null }, prescriptions: seedActive('pt-01') });
  assert.equal(r.verdict, 'not_a_medicine');
  assert.deepEqual(r.appOutcome, { kind: 'not_a_medicine' });
  assert.equal(r.candidate, null);
  assert.equal(r.alert, null);
  assert.deepEqual(r.findings, []);
});

test('a malformed/unparseable model answer (visionRead null) -> could_not_identify, model_response_unparseable, fail closed', () => {
  const r = check({ visionRead: null, prescriptions: [] });
  assert.equal(r.verdict, 'could_not_identify');
  assert.equal(r.reason, 'model_response_unparseable');
  assert.deepEqual(r.appOutcome, { kind: 'could_not_identify' });
});

test('isMedicine true but nothing legible (no brand, no ingredients) -> could_not_identify, no_readable_text (G5 restated in the new schema)', () => {
  const r = check({ visionRead: { isMedicine: true, brandAsPrinted: null, ingredientsAsPrinted: [], strengthAsPrinted: null }, prescriptions: [] });
  assert.equal(r.verdict, 'could_not_identify');
  assert.equal(r.reason, 'no_readable_text');
});

test('bilingual box: brandAsPrinted holds the Latin name only, so "Brufen" + Arabic print still resolves', () => {
  const r = check({ visionRead: { isMedicine: true, brandAsPrinted: 'Brufen', ingredientsAsPrinted: [], strengthAsPrinted: null }, prescriptions: [], language: 'en' });
  assert.equal(r.verdict, 'no_interaction_found');
  assert.equal(r.candidate.via, 'brand');
  assert.deepEqual(r.candidate.ingredients, ['Ibuprofen']);
});

test('brand plus strength: strengthAsPrinted is carried on the candidate and never blocks resolution', () => {
  const r = check({ visionRead: { isMedicine: true, brandAsPrinted: 'BRUFEN', ingredientsAsPrinted: [], strengthAsPrinted: '400 mg' }, prescriptions: [], language: 'en' });
  assert.equal(r.verdict, 'no_interaction_found');
  assert.equal(r.candidate.strengthAsPrinted, '400 mg');
  assert.deepEqual(r.candidate.ingredients, ['Ibuprofen']);
});

test('no brand printed: a combination resolves only when EVERY ingredientsAsPrinted entry resolves, never a partial screen', () => {
  const both = check({ visionRead: { isMedicine: true, brandAsPrinted: null, ingredientsAsPrinted: ['Acetaminophen', 'Caffeine'], strengthAsPrinted: null }, prescriptions: [], language: 'en' });
  assert.equal(both.verdict, 'no_interaction_found');
  assert.equal(both.candidate.isCombination, true);
  assert.deepEqual(both.candidate.ingredients.sort(), ['Acetaminophen', 'Caffeine']);

  const oneMissing = check({ visionRead: { isMedicine: true, brandAsPrinted: null, ingredientsAsPrinted: ['Acetaminophen', 'Notarealingredientxyz'], strengthAsPrinted: null }, prescriptions: [] });
  assert.equal(oneMissing.verdict, 'could_not_identify');
  assert.equal(oneMissing.reason, 'combination_ingredient_unresolved');
  assert.deepEqual(oneMissing.findings, [], 'never a partial screen on the one ingredient that DID resolve');
});

test('decision (d): a pending brand PLUS a printed ingredient still refuses - ingredientsAsPrinted is never a fallback for an unverified brand', () => {
  const r = check({ visionRead: { isMedicine: true, brandAsPrinted: 'Marevan', ingredientsAsPrinted: ['Warfarin'], strengthAsPrinted: null }, prescriptions: [], pendingNames });
  assert.equal(r.verdict, 'cannot_verify');
  assert.equal(r.reason, 'brand_not_verified');
  assert.equal(r.brandLabel, 'MAREVAN');
  assert.equal(r.candidate, null, 'never resolved to Warfarin through the ingredient field');
});

test('decision (c): SFDA brand source - a salt-form ingredient name reaches the interaction index key', () => {
  const sfdaBrandIndex = buildBrandIndex(BRANDS_JSON.brands, index, SFDA_FIXTURE.names);
  const r = travelCheck({ patientId: 't-patient', index, brandIndex: sfdaBrandIndex, language: 'en',
    visionRead: { isMedicine: true, brandAsPrinted: 'GLUCOFORM', ingredientsAsPrinted: [], strengthAsPrinted: null },
    prescriptions: [rx('t-1', 'Warfarin')] });
  assert.equal(r.verdict, 'interaction_found', 'GLUCOFORM -> "Metformin Hydrochloride" -> metformin, and metformin x warfarin is a graded DDInter row');
  assert.equal(r.candidate.ingredients[0], 'Metformin Hydrochloride');
});

test('decision (c): SFDA brand source - a base name registering more than one distinct ingredient set -> needs_confirmation, never a guess', () => {
  const sfdaBrandIndex = buildBrandIndex(BRANDS_JSON.brands, index, SFDA_FIXTURE.names);
  const r = travelCheck({ patientId: 't-patient', index, brandIndex: sfdaBrandIndex, language: 'en',
    visionRead: { isMedicine: true, brandAsPrinted: 'COLDMEX', ingredientsAsPrinted: [], strengthAsPrinted: null },
    prescriptions: [] });
  assert.equal(r.verdict, 'needs_confirmation');
  assert.equal(r.reason, 'sfda_multiple_ingredient_sets');
  assert.deepEqual(r.candidates.sort(), ['Acetaminophen', 'Acetaminophen + Caffeine']);
});

test('a missing sfda-brands.json is simply "no SFDA rows", never an error - buildBrandIndex(rows, index) with no third argument is unchanged', () => {
  const noSfda = buildBrandIndex(BRANDS_JSON.brands, index, undefined);
  assert.equal(noSfda.has('glucoform'), false);
  assert.equal(noSfda.has('brufen'), true, 'brand-map.json rows are unaffected');
});

// ---------------------------------------------------------------- reviewer fix: resolve.js's
// ingredient-only path must never consult a brand or SFDA row (agents/knowledge/src/resolve.js,
// buildIngredientIndex). Regression coverage for the exact scenario the finding described.
test('reviewer fix: an SFDA base name equal to a real index ingredient (EZETIMIBE) never shadows it - a plain generic box still resolves to itself alone', () => {
  const sfdaBrandIndex = buildBrandIndex(BRANDS_JSON.brands, index, SFDA_FIXTURE.names);
  // Sanity: the fixture really does collide - EZETIMIBE is both a plain index ingredient and an SFDA
  // base name with more than one distinct ingredient set (the shape that shadowed it before the fix).
  assert.ok(sfdaBrandIndex.get('ezetimibe').ambiguousSets, 'sanity: the combined brandIndex entry for this key is the ambiguous SFDA row, not the plain ingredient - the collision this test exists to survive');
  const r = travelCheck({ patientId: 't-patient', index, brandIndex: sfdaBrandIndex, language: 'en',
    visionRead: { isMedicine: true, brandAsPrinted: null, ingredientsAsPrinted: ['Ezetimibe'], strengthAsPrinted: null },
    prescriptions: [rx('t-1', 'Amlodipine')] });
  // Ezetimibe x Amlodipine is outside the loaded DDInter category files (the same profile the AP-06
  // test above uses): a correct resolution lands on cannot_verify/pair_outside_loaded_categories.
  // Before the fix this returned could_not_identify/combination_ingredient_unresolved instead - the
  // SFDA row's ambiguousSets is never OUTCOME.RESOLVED, so resolveFields refused the whole reading.
  assert.equal(r.verdict, 'cannot_verify', 'must resolve as the plain ingredient, not be shadowed by the colliding SFDA row');
  assert.equal(r.reason, 'pair_outside_loaded_categories');
  assert.ok(r.candidate, 'the ingredient must actually have resolved');
  assert.deepEqual(r.candidate.ingredients, ['Ezetimibe']);
  assert.equal(r.candidate.ingredientKeys[0], 'ezetimibe');
});

test('reviewer fix: a brand name typed into ingredientsAsPrinted (no brand printed) must not resolve via a brand-map or SFDA row', () => {
  const r = check({ visionRead: { isMedicine: true, brandAsPrinted: null, ingredientsAsPrinted: ['Zocor'], strengthAsPrinted: null }, prescriptions: [] });
  assert.equal(r.verdict, 'could_not_identify', 'ZOCOR is a brand, not an ingredient name - the ingredient-only path must refuse it, never resolve it to Simvastatin');
  assert.equal(r.reason, 'combination_ingredient_unresolved');
  assert.equal(r.candidate, null, 'never silently resolved to Simvastatin through the brand row');
});

test('appOutcomeFor: every VERDICT maps to exactly one DrugCheckOutcome kind; anything else stays fail-closed', () => {
  assert.deepEqual(appOutcomeFor(VERDICT.NOT_A_MEDICINE, 'X', 'ia-1'), { kind: 'not_a_medicine' }, 'no drugName, no alertId - not_a_medicine carries nothing else');
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

// CR-112 integration: SFDA spells an ingredient with its salt or ester, the index names the drug.
test('an SFDA brand whose ingredient carries a salt resolves to the index key, not the salted name', () => {
  const { loadIndex } = require('../src/interactions');
  const idx = loadIndex({
    meta: { sfdaIngredientMap: { 'OLMESARTAN MEDOXOMIL': 'olmesartan' } },
    drugs: { metformin: { label: 'Metformin', ddinterId: 'DDInter1144' }, olmesartan: { label: 'Olmesartan', ddinterId: 'DDInter1335' } },
    pairs: {}
  });
  const sfda = {
    'FICTIONAL METFORMIN BRAND': [['METFORMIN HYDROCHLORIDE']],
    'FICTIONAL OLMESARTAN BRAND': [['OLMESARTAN MEDOXOMIL']],
    'FICTIONAL TWO SPELLINGS': [['METFORMIN'], ['METFORMIN HYDROCHLORIDE']],
    'FICTIONAL UNKNOWN SALT': [['NOTINDEXED SODIUM']]
  };
  const bi = buildBrandIndex([], idx, sfda);
  const met = resolveToIngredient('FICTIONAL METFORMIN BRAND', bi);
  assert.equal(met.outcome, 'resolved');
  assert.deepEqual(met.ingredients, ['metformin']);
  // an ester the normaliser cannot strip: the index's own SFDA spelling map carries it
  assert.deepEqual(resolveToIngredient('FICTIONAL OLMESARTAN BRAND', bi).ingredients, ['olmesartan']);
  // two spellings of one drug under one base name are one set, not a "which one?" question
  const two = resolveToIngredient('FICTIONAL TWO SPELLINGS', bi);
  assert.equal(two.outcome, 'resolved');
  assert.deepEqual(two.ingredients, ['metformin']);
  // an ingredient the index does not cover stays uncovered (the check then says "cannot verify")
  const unknown = resolveToIngredient('FICTIONAL UNKNOWN SALT', bi);
  assert.equal(unknown.outcome, 'resolved');
  assert.equal(idx.drugs.has(unknown.ingredients[0]), false);
});

test('building one brand index never changes the shared brand-map rows', () => {
  const before = JSON.stringify(BRANDS_JSON.brands);
  buildBrandIndex(BRANDS_JSON.brands, index, SFDA_FIXTURE);
  assert.equal(JSON.stringify(BRANDS_JSON.brands), before);
});

// Final review (2026-09-26): the brand index as it SHIPS, with the whole SFDA list loaded.
const SHIPPED_SFDA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sfda-brands.json'), 'utf8')).names;
const shipped = (over) => check(Object.assign({ brandIndex: buildBrandIndex(BRANDS_JSON.brands, index, SHIPPED_SFDA) }, over));
const read = (brandAsPrinted, ingredientsAsPrinted = []) => ({ isMedicine: true, brandAsPrinted, ingredientsAsPrinted, strengthAsPrinted: null });

test('a bilingual Brufen box read as "Brufen بروفين" still finds the danger with Warfarin (pt-01)', () => {
  const r = shipped({ visionRead: read('Brufen بروفين'), prescriptions: seedActive('pt-01') });
  assert.equal(r.appOutcome.kind, 'identified');
  assert.equal(r.appOutcome.verdict, 'interaction_found');
  assert.ok(r.alert, 'the danger alert is raised');
});

test('a brand printed only in Arabic never falls through to the model\'s ingredient reading (decision (d))', () => {
  const r = shipped({ visionRead: read('بروفين', ['Ibuprofen']), prescriptions: seedActive('pt-01') });
  assert.notEqual(r.appOutcome.kind, 'identified');
  assert.equal(r.alert, null);
});

test('a generic box ("Warfarin" in the brand field) resolves as the ingredient, not as a "which one?" over SFDA\'s generics', () => {
  const r = shipped({ visionRead: read('Warfarin'), prescriptions: [rx('t-ibu', 'Ibuprofen')] });
  assert.equal(r.appOutcome.kind, 'identified');
  assert.equal(r.appOutcome.verdict, 'interaction_found');
});

test('the generic shortcut is refused when the printed ingredients name a second drug', () => {
  const r = shipped({ visionRead: read('Ezetimibe', ['Ezetimibe', 'Simvastatin']), prescriptions: [] });
  // never screened as plain ezetimibe: the printed Simvastatin vetoes a one-drug reading, so it refuses
  assert.notEqual(r.appOutcome.kind, 'identified');
  assert.equal(r.alert, null);
});

test('Panadol Extra on an empty profile (pt-06) answers no interaction with the shipped index', () => {
  const r = shipped({ visionRead: read('Panadol Extra'), prescriptions: [] });
  assert.equal(r.appOutcome.kind, 'identified');
  assert.equal(r.appOutcome.verdict, 'no_interaction');
});
