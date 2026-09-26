'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { index, seedActive, rx } = require('./helpers');
const { screenNewPrescription, exclusionReason } = require('../src/screening');
const { ingredientsOf } = require('../src/normalise');

const screen = (over) => screenNewPrescription(Object.assign({ index, language: 'ar' }, over));
const bodyKeys = ['patientId', 'involvedPrescriptionIds', 'severity', 'description', 'sourceCitation', 'reviewStatus'];

function assertBackendShape(alert, patientId) {
  assert.deepEqual(Object.keys(alert).sort(), [...bodyKeys].sort(), 'only keys POST /api/agent/alerts accepts');
  assert.equal(alert.patientId, patientId);
  assert.ok(!('id' in alert), 'the backend assigns the id');
  assert.ok(['pending_medical_review', 'auto_cleared'].includes(alert.reviewStatus));
  assert.ok(typeof alert.sourceCitation === 'string' && alert.sourceCitation.length > 0);
  if (alert.severity !== 'info') assert.equal(alert.reviewStatus, 'pending_medical_review');
}

// ---------------------------------------------------------------- the real seed
test('seed سارة (pt-03): Levothyroxine x "Calcium carbonate + vitamin D3" finds the DDInter Moderate row (was missed before)', () => {
  const r = screen({ patientId: 'pt-03', newPrescriptionId: 'rx-009', prescriptions: seedActive('pt-03') });
  assert.equal(r.screened, true);
  const graded = r.alerts.filter((a) => a.severity === 'warning');
  assert.equal(graded.length, 1);
  assert.deepEqual([...graded[0].involvedPrescriptionIds].sort(), ['rx-008', 'rx-009']);
  assert.equal(graded[0].reviewStatus, 'pending_medical_review');
  assert.match(graded[0].sourceCitation, /DDInter271/);
  assert.match(graded[0].sourceCitation, /DDInter1064/);
  assert.match(graded[0].sourceCitation, /level "Moderate"/);
  // F2: vitamin D3 is in the index now (Cholecalciferol, DDInter367) and DDInter records no
  // interaction with Levothyroxine - nothing is left unverifiable, so nothing is raised for it.
  assert.equal(r.alerts.filter((a) => a.severity === 'info').length, 0);
  assert.equal(r.alerts.length, 1);
  for (const a of r.alerts) assertBackendShape(a, 'pt-03');
});

test('TC-IX-01 seed حمد (pt-01): adding Ibuprofen finds Warfarin x Ibuprofen as DANGER (DDInter "Major"), pending_medical_review, with the DDInter citation passed through, and Ibuprofen x Metformin as a warning - both to a human first (F2, AP-06)', () => {
  const r = screen({ patientId: 'pt-01', newPrescriptionId: 'rx-002', prescriptions: seedActive('pt-01') });
  assert.equal(r.alerts.length, 2);
  const danger = r.alerts.find((a) => a.severity === 'danger');
  assert.ok(danger, 'the demo\'s danger case');
  assert.deepEqual([...danger.involvedPrescriptionIds].sort(), ['rx-001', 'rx-002']);
  assert.match(danger.description, /Warfarin/);
  assert.match(danger.description, /Ibuprofen/);
  assert.match(danger.sourceCitation, /level "Major"/);
  assert.match(danger.sourceCitation, /DDInter 2\.0/);
  // AP-06: the citation is passed through from the index, never written here - the DDInter paper
  // (index meta), both DDInter ids and the level, all as the build read them from DDInter's files.
  const { pairCitation } = require('../src/text');
  assert.equal(danger.sourceCitation, pairCitation(index.meta, index.drugs.get('ibuprofen'), index.drugs.get('warfarin'), 'Major'));
  assert.ok(danger.sourceCitation.startsWith(index.meta.source.citation + ' '), 'the paper, verbatim from the index');
  assert.match(danger.sourceCitation, /Interaction record: Ibuprofen \(DDInter900\) x Warfarin \(DDInter1951\), level "Major"\./);
  assert.equal(index.pairs.get('ibuprofen|warfarin').level, 'Major');
  assert.deepEqual(index.pairs.get('ibuprofen|warfarin').rowIds, ['DDInter900', 'DDInter1951']);
  const warning = r.alerts.find((a) => a.severity === 'warning');
  assert.deepEqual([...warning.involvedPrescriptionIds].sort(), ['rx-002', 'rx-003']);
  for (const a of r.alerts) {
    assert.equal(a.reviewStatus, 'pending_medical_review');
    assertBackendShape(a, 'pt-01');
  }
  assert.equal(r.report.graded, 2);
});

test('a drug the index still lacks (Gliclazide) -> ONE cannot-verify alert, never "no interaction" (TC-IX-03)', () => {
  const r = screen({ patientId: 't', newPrescriptionId: 't-2', prescriptions: [rx('t-1', 'Warfarin'), rx('t-2', 'Gliclazide')] });
  assert.equal(r.alerts.length, 1);
  const [a] = r.alerts;
  assert.equal(a.severity, 'info');
  assert.equal(a.reviewStatus, 'pending_medical_review');
  assert.match(a.description, /Gliclazide/);
  assert.doesNotMatch(a.description, /لم نجد تعارضاً/, 'never the nothing-found wording');
  assert.equal(r.report.graded, 0);
});

test('seed حمد: the discontinued rx-004 is never screened (the route returns active only; screening re-checks)', () => {
  const all = require('./helpers').SEED.filter((p) => p.patientId === 'pt-01');
  const r = screen({ patientId: 'pt-01', newPrescriptionId: 'rx-002', prescriptions: all });
  assert.ok(r.excluded.some((e) => e.id === 'rx-004' && e.reason === 'not_active'));
  for (const a of r.alerts) assert.ok(!a.involvedPrescriptionIds.includes('rx-004'));
});

test('seed فاطمة (pt-02): the flagged rx-006 and returned rx-007 are excluded VISIBLY - to the reviewer, never "nothing found" (TC-IX-06)', () => {
  const r = screen({ patientId: 'pt-02', newPrescriptionId: 'rx-005', prescriptions: seedActive('pt-02') });
  assert.deepEqual(r.excluded.map((e) => e.id).sort(), ['rx-006', 'rx-007']);
  assert.equal(r.screened, true);
  assert.equal(r.reason, 'no_other_screenable_prescription');
  assert.equal(r.unconfirmedExcluded, 2);
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].reviewStatus, 'pending_medical_review');
  assert.deepEqual(r.alerts[0].involvedPrescriptionIds, ['rx-005']);
  assert.match(r.alerts[0].description, /^لم يُفحص Prednisolone مع باقي أدويتك بعد، لأن وصفتان من وصفاتك ما زالتا بانتظار المراجعة/);
  assert.doesNotMatch(r.alerts[0].description, /تم فحص/, 'nothing confirmed was screened, so it never says it was');
  assert.doesNotMatch(r.alerts[0].sourceCitation, /TC-IX/, 'no test-case id in text a screen shows');
  assert.ok(!r.alerts[0].involvedPrescriptionIds.includes('rx-006'));
});

test('nothing found but a prescription awaits review -> pending, and the text says what was left out', () => {
  // Metformin (ATC A, file A loaded) x Calcium carbonate: a checkable pair with no DDInter row.
  const p = [rx('t-1', 'Metformin'), rx('t-2', 'Calcium carbonate'), rx('t-3', '(unreadable)', { needsReview: true, fieldReviewStatus: 'pending' })];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-2', prescriptions: p, language: 'en' });
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].reviewStatus, 'pending_medical_review');
  assert.match(r.alerts[0].description, /1 of your prescriptions is still awaiting review/);
});

test('a NEW prescription still flagged needsReview is not screened at all (TC-IX-06 / TC-RS-07)', () => {
  const r = screen({ patientId: 'pt-02', newPrescriptionId: 'rx-006', prescriptions: seedActive('pt-02') });
  assert.equal(r.screened, false);
  assert.match(r.reason, /needs_review/);
  assert.deepEqual(r.alerts, []);
});

test('an unknown or foreign prescription id is refused, nothing sent', () => {
  const r = screen({ patientId: 'pt-03', newPrescriptionId: 'rx-001', prescriptions: seedActive('pt-03') });
  assert.equal(r.screened, false);
  assert.deepEqual(r.alerts, []);
});

// ---------------------------------------------------------------- CR-090 (ii): the pending exclusion
test('exclusionReason: fieldReviewStatus "pending" no longer excludes; "returned" still does; needsReview and status still gate', () => {
  const p = (extra) => rx('t-x', 'Warfarin', extra);
  assert.equal(exclusionReason(p({ needsReview: false, fieldReviewStatus: 'pending' })), null,
    'CR-054\'s confident-save shape (needsReview:false, fieldReviewStatus:"pending") is nobody\'s to review - it must be screened');
  assert.equal(exclusionReason(p({ needsReview: false, fieldReviewStatus: 'returned' })), 'field_review_returned');
  assert.equal(exclusionReason(p({ needsReview: true, fieldReviewStatus: 'pending' })), 'needs_review');
  assert.equal(exclusionReason(p({ needsReview: false, status: 'discontinued' })), 'not_active');
});

test('CR-090 (ii): a confidently-saved prescription left in the CR-054 "pending" state is screened, not silently dropped', () => {
  const rx001 = seedActive('pt-01').find((p) => p.id === 'rx-001'); // the real seed row: Warfarin
  const rx002 = rx('rx-002', 'Ibuprofen', { patientId: 'pt-01', needsReview: false, fieldReviewStatus: 'pending' });
  const r = screen({ patientId: 'pt-01', newPrescriptionId: 'rx-002', prescriptions: [rx001, rx002] });
  assert.equal(r.screened, true);
  assert.equal(r.unconfirmedExcluded, 0);
  const danger = r.alerts.filter((a) => a.severity === 'danger');
  assert.equal(danger.length, 1);
  assert.equal(danger[0].reviewStatus, 'pending_medical_review');
  assert.match(danger[0].sourceCitation, /DDInter900/);
  assert.match(danger[0].sourceCitation, /DDInter1951/);
  for (const a of r.alerts) assertBackendShape(a, 'pt-01');
});

// ---------------------------------------------------------------- graded paths (real DDInter rows)
test('TC-IX-01: a Major row -> danger, pending_medical_review, citation names the matched record', () => {
  const p = [rx('t-1', 'Simvastatin'), rx('t-2', 'Clarithromycin')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-2', prescriptions: p });
  const d = r.alerts.filter((a) => a.severity === 'danger');
  assert.equal(d.length, 1);
  assert.equal(d[0].reviewStatus, 'pending_medical_review');
  assert.match(d[0].sourceCitation, /DDInter1675/);
  assert.match(d[0].sourceCitation, /DDInter393/);
  assert.match(d[0].sourceCitation, /level "Major"/);
  assert.match(d[0].sourceCitation, /Nucleic Acids Research/);
  assertBackendShape(d[0], 't-patient');
});

test('danger sorts first; a Minor row is info and auto_cleared', () => {
  const p = [rx('t-1', 'Simvastatin'), rx('t-2', 'Clarithromycin'), rx('t-3', 'Levothyroxine')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-1', prescriptions: p });
  assert.equal(r.alerts[0].severity, 'danger');
  const minor = r.alerts.find((a) => a.severity === 'info' && /DDInter1064/.test(a.sourceCitation) && /Minor/.test(a.sourceCitation));
  assert.ok(minor, 'levothyroxine x simvastatin is Minor');
  assert.equal(minor.reviewStatus, 'auto_cleared');
});

test('TC-IX-02: both drugs covered, no row, one in a loaded category file -> no interaction alert; one auto_cleared "screened, nothing recorded" (seed ia-003 shape)', () => {
  // Metformin is ATC A and DDInter file A is loaded: file A lists every Metformin interaction, and
  // none with Calcium carbonate, so the absence is a real "none recorded".
  const p = [rx('t-1', 'Metformin'), rx('t-2', 'Calcium carbonate')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-2', prescriptions: p });
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].severity, 'info');
  assert.equal(r.alerts[0].reviewStatus, 'auto_cleared');
  assert.deepEqual(r.alerts[0].involvedPrescriptionIds, ['t-2']);
  assert.match(r.alerts[0].description, /تم فحص Calcium carbonate/);
  assert.match(r.alerts[0].description, /ليس ضماناً للسلامة/);
  assert.deepEqual(r.report.notCheckable, []);
});

// ---------------------------------------------------------------- AP-06: the loaded DDInter category files
//
// SFDA extension (2026-09-26): the build now loads all eight DDInter files (A, B, D, H, L, P, R, V),
// not just A, B, H. Loading file R turned up REAL DDInter rows for two pairs this suite used to use
// as its standard "cannot verify" examples - Ibuprofen x Ciprofloxacin (now a genuine Moderate row)
// and Atorvastatin x Ibuprofen (now a genuine, ungraded/Unknown row) - so neither demonstrates the
// cannot-verify path any more; they demonstrate the opposite: the wider index finding a real answer
// where there used to be a gap. Ciprofloxacin's own ATC categories (J, S) and Atorvastatin's (C) sit
// outside every one of these eight files regardless of DDInter's row content, so THEIR pair remains a
// durable "cannot verify" example and takes over as the fixture below.
test('AP-06 false reassurance: Ciprofloxacin (ATC J/S) x Atorvastatin (ATC C), both outside every loaded file (A, B, D, H, L, P, R, V) -> cannot verify, never "no interaction"', () => {
  const p = [rx('t-1', 'Ciprofloxacin'), rx('t-2', 'Atorvastatin')];
  for (const language of ['ar', 'en']) {
    const r = screen({ patientId: 't-patient', newPrescriptionId: 't-2', prescriptions: p, language });
    assert.equal(r.alerts.length, 1);
    const [a] = r.alerts;
    assert.equal(a.severity, 'info');
    assert.equal(a.reviewStatus, 'pending_medical_review', 'to the reviewer, never auto_cleared');
    assert.deepEqual([...a.involvedPrescriptionIds].sort(), ['t-1', 't-2']);
    assert.match(a.description, /Ciprofloxacin/);
    assert.match(a.description, /Atorvastatin/);
    assert.doesNotMatch(a.description, /تم فحص|لم نجد تعارضاً|no interaction is recorded|was screened/, 'never the nothing-found wording');
    assert.match(a.sourceCitation, /DDInter category files A, B, D, H, L, P, R, V/);
    assert.match(a.sourceCitation, /Atorvastatin \(DDInter133, ATC C\) x Ciprofloxacin \(DDInter384, ATC J\/S\)/);
    assert.match(a.sourceCitation, /nothing is cleared/);
    assert.ok(a.description.length <= 400);
    assertBackendShape(a, 't-patient');
    assert.deepEqual(r.report.notCheckable, ['atorvastatin|ciprofloxacin']);
    assert.equal(r.report.validationFailed, 0);
  }
  const en = screen({ patientId: 't-patient', newPrescriptionId: 't-2', prescriptions: p, language: 'en' }).alerts[0];
  assert.equal(en.description, 'We could not check for an interaction when taking Atorvastatin with Ciprofloxacin: the part of our drug-interaction database that records interactions for these medicines is not available to us yet. This will be shown to a medical reviewer.');
  const ar = screen({ patientId: 't-patient', newPrescriptionId: 't-2', prescriptions: p }).alerts[0];
  assert.equal(ar.description, 'لم نستطع التحقق من وجود تعارض عند أخذ Atorvastatin مع Ciprofloxacin، لأن الجزء الذي يسجّل تداخلات هذه الأدوية في قاعدة بيانات التداخلات الدوائية ليس متوفراً لدينا بعد. سيُعرض ذلك على مختص طبي للمراجعة.');
  for (const a of [en, ar]) assert.doesNotMatch(a.description, /—/, 'no em dash');
});

test('AP-06: Atorvastatin (ATC C) x Ibuprofen (ATC M) - the seed\'s own rx-004 x rx-002 pair - used to be cannot verify; the SFDA extension\'s file R now finds a real, ungraded DDInter row for it (G8: to the reviewer, never auto-cleared)', () => {
  const p = [rx('t-1', 'Ibuprofen'), rx('t-2', 'Atorvastatin')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-2', prescriptions: p });
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].severity, 'info');
  assert.equal(r.alerts[0].reviewStatus, 'pending_medical_review');
  assert.ok(!r.alerts.some((a) => a.reviewStatus === 'auto_cleared'));
  assert.match(r.alerts[0].sourceCitation, /Records with no severity grade \(level "Unknown"\): Atorvastatin \(DDInter133\) x Ibuprofen \(DDInter900\)/);
  assert.deepEqual(r.report.notCheckable, [], 'found (ungraded), not uncheckable - this pair is no longer a gap');
  assert.equal(r.report.ungraded, 1);
});

test('AP-06: Ezetimibe x Amlodipine (both ATC C, no ATC recorded here) - the old TC-IX-02 fixture was a false all-clear and is now cannot verify', () => {
  const p = [rx('t-1', 'Ezetimibe'), rx('t-2', 'Amlodipine')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-2', prescriptions: p });
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].reviewStatus, 'pending_medical_review');
  assert.doesNotMatch(r.alerts[0].description, /تم فحص/);
  assert.match(r.alerts[0].sourceCitation, /Amlodipine \(DDInter79, ATC unknown\) x Ezetimibe \(DDInter707, ATC unknown\)/);
});

test('AP-06 covered-absent: one drug in a loaded category is enough, even when the other\'s ATC is unknown (Metformin A x Diphenhydramine) -> nothing recorded, auto_cleared', () => {
  const p = [rx('t-1', 'Metformin'), rx('t-2', 'Diphenhydramine')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-2', prescriptions: p });
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].reviewStatus, 'auto_cleared');
  assert.equal(r.evidence.findings[0].findingType, 'nothing_found');
});

test('AP-06 fail closed: a drug with no recorded ATC category is treated as not loaded', () => {
  const { loadIndex } = require('../src/interactions');
  const json = JSON.parse(JSON.stringify(require('./helpers').INDEX_JSON));
  delete json.drugs.metformin.atcCategories;
  const r = screenNewPrescription({ index: loadIndex(json), language: 'en', patientId: 't-patient', newPrescriptionId: 't-2',
    prescriptions: [rx('t-1', 'Metformin'), rx('t-2', 'Diphenhydramine')] });
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].reviewStatus, 'pending_medical_review');
  assert.deepEqual(r.report.notCheckable, ['diphenhydramine|metformin']);
});

test('AP-06 fail closed: an index that does not record its loaded category files proves no absence at all', () => {
  const { loadIndex } = require('../src/interactions');
  const json = JSON.parse(JSON.stringify(require('./helpers').INDEX_JSON));
  delete json.meta.categoryFilesLoaded;
  const old = loadIndex(json);
  const clean = screenNewPrescription({ index: old, language: 'en', patientId: 't-patient', newPrescriptionId: 't-2',
    prescriptions: [rx('t-1', 'Metformin'), rx('t-2', 'Calcium carbonate')] });
  assert.equal(clean.alerts.length, 1);
  assert.equal(clean.alerts[0].reviewStatus, 'pending_medical_review', 'no "nothing recorded" without the record of what was loaded');
  assert.match(clean.alerts[0].sourceCitation, /category files none recorded/);
  // A row that IS in the index is still found: the rule only governs absences.
  const found = screenNewPrescription({ index: old, language: 'en', patientId: 'pt-01', newPrescriptionId: 'rx-002', prescriptions: seedActive('pt-01') });
  assert.ok(found.alerts.some((a) => a.severity === 'danger'));
});

test('AP-06: a missing drug and an uncheckable pair are both sent to the reviewer, and nothing reads clean', () => {
  // Ciprofloxacin (new) x Ibuprofen would now be FOUND (see the two tests above) - Atorvastatin
  // stays a durable "cannot verify" partner for Ciprofloxacin regardless of DDInter's row content.
  const p = [rx('t-new', 'Ciprofloxacin'), rx('t-a', 'Gliclazide'), rx('t-b', 'Atorvastatin')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-new', prescriptions: p, language: 'en' });
  assert.equal(r.alerts.length, 2);
  assert.ok(r.alerts.every((a) => a.severity === 'info' && a.reviewStatus === 'pending_medical_review'));
  assert.ok(r.alerts.some((a) => /Gliclazide/.test(a.description)));
  assert.ok(r.alerts.some((a) => /Ciprofloxacin with Atorvastatin/.test(a.description)));
  assert.equal(r.report.validationFailed, 0);
});

test('AP-06: many uncheckable pairs are capped in the text, never dropped for length; the citation keeps them all', () => {
  // Atorvastatin (ATC C, never loaded) as the new prescription: these seven partners are every one of
  // the old fixture's candidates (plus Acetaminophen) that DDInter's now-larger, 8-file dataset still
  // has no row for - Ciprofloxacin was dropped from this list because Atorvastatin x Ciprofloxacin is
  // covered by the pair-level fixture above already, and this test wants its OWN seven.
  const p = [rx('t-new', 'Atorvastatin'), rx('t-1', 'Ezetimibe'), rx('t-2', 'Amlodipine'), rx('t-3', 'Caffeine'),
             rx('t-4', 'Chlorpheniramine'), rx('t-5', 'Pseudoephedrine'), rx('t-6', 'Diphenhydramine'), rx('t-7', 'Acetaminophen')];
  for (const language of ['ar', 'en']) {
    const r = screen({ patientId: 't-patient', newPrescriptionId: 't-new', prescriptions: p, language });
    assert.equal(r.report.validationFailed, 0, JSON.stringify(r.evidence.validationFailures));
    assert.equal(r.report.notCheckable.length, 7);
    const a = r.alerts[r.evidence.findings.findIndex((f) => f.findingType === 'pair_not_checkable')];
    assert.ok(a);
    assert.equal(a.reviewStatus, 'pending_medical_review');
    assert.equal(a.involvedPrescriptionIds.length, 8);
    assert.ok(a.description.length <= 400, String(a.description.length));
    for (const d of ['DDInter133', 'DDInter707', 'DDInter79', 'DDInter14']) assert.match(a.sourceCitation, new RegExp(d));
  }
});

test('AP-06 V4: a "not checkable" finding that names a pair the index holds is withheld and escalates', () => {
  const { validateAlerts } = require('../src/validate');
  const alert = { patientId: 't', involvedPrescriptionIds: ['a', 'b'], severity: 'info', description: 'd', sourceCitation: 'c', reviewStatus: 'pending_medical_review' };
  const v = validateAlerts([{ alert, evidence: { findingType: 'pair_not_checkable', pairKeys: ['ibuprofen|warfarin'], allowedNames: [] } }],
    { patientId: 't', knownPrescriptionIds: ['a', 'b'], index });
  assert.equal(v.mustEscalate, true);
  assert.match(v.failed[0].violations.join(' '), /V4 a not-checkable pair is in the index: ibuprofen\|warfarin/);
  const cleared = validateAlerts([{ alert: Object.assign({}, alert, { reviewStatus: 'auto_cleared' }), evidence: { findingType: 'pair_not_checkable', pairKeys: ['ciprofloxacin|ibuprofen'], allowedNames: [] } }],
    { patientId: 't', knownPrescriptionIds: ['a', 'b'], index });
  assert.equal(cleared.mustEscalate, true, 'an uncheckable pair is never auto_cleared');
});

test('G8: an Unknown-level row is never "nothing found" - it goes to the reviewer ungraded', () => {
  const p = [rx('t-1', 'Acetaminophen'), rx('t-2', 'Simvastatin')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-1', prescriptions: p });
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].severity, 'info');
  assert.equal(r.alerts[0].reviewStatus, 'pending_medical_review');
  assert.match(r.alerts[0].sourceCitation, /Unknown/);
  assert.ok(!r.alerts.some((a) => a.reviewStatus === 'auto_cleared'));
});

test('TC-IX-04: a nonsense drug name -> cannot verify; no fabricated interaction', () => {
  const p = [rx('t-1', 'Zzqxtril'), rx('t-2', 'Simvastatin')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-1', prescriptions: p });
  assert.equal(r.alerts.length, 1);
  assert.match(r.alerts[0].description, /Zzqxtril/);
  assert.equal(r.alerts[0].reviewStatus, 'pending_medical_review');
  assert.equal(r.report.graded, 0);
});

test('duplicate therapy across two sectors -> warning, pending, patient-record citation', () => {
  const p = [rx('t-1', 'Amlodipine'), rx('t-2', 'Amlodipine besylate', { source: { facilityName: 'Private', sector: 'private' } })];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-2', prescriptions: p });
  const dup = r.alerts.find((a) => /Patient record/.test(a.sourceCitation));
  assert.ok(dup);
  assert.equal(dup.severity, 'warning');
  assert.equal(dup.reviewStatus, 'pending_medical_review');
  assert.doesNotMatch(dup.sourceCitation, /t-1|t-2/, 'no technical id in text a screen shows (rule 7)');
  assert.match(dup.sourceCitation, /\(Private; Test facility\)/);
});

test('scope: only pairs with the NEW prescription - an old pair is never re-raised', () => {
  const p = [rx('t-1', 'Simvastatin'), rx('t-2', 'Clarithromycin'), rx('t-3', 'Ezetimibe')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-3', prescriptions: p });
  assert.ok(!r.alerts.some((a) => a.severity === 'danger'), 'simvastatin x clarithromycin is not re-raised');
  assert.ok(r.alerts.every((a) => a.involvedPrescriptionIds.includes('t-3')));
});

test('whole-profile mode is ALWAYS a dry run', () => {
  const p = [rx('t-1', 'Simvastatin'), rx('t-2', 'Clarithromycin')];
  const r = screen({ patientId: 't-patient', prescriptions: p });
  assert.equal(r.dryRun, true);
  assert.equal(r.report.toSend, 0);
  assert.ok(r.alerts.some((a) => a.severity === 'danger'));
});

test('English when the patient language is en', () => {
  const p = [rx('t-1', 'Simvastatin'), rx('t-2', 'Clarithromycin')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-2', prescriptions: p, language: 'en' });
  assert.match(r.alerts[0].description, /^The drug-interaction database records a major interaction between Clarithromycin and Simvastatin\./);
});

test('no alert description names a drug outside its finding (V5), and none exceeds 400 characters', () => {
  const p = [rx('t-1', 'Simvastatin'), rx('t-2', 'Clarithromycin'), rx('t-3', 'Levothyroxine'), rx('t-4', 'Calcium carbonate + vitamin D3')];
  for (const id of ['t-1', 't-2', 't-3', 't-4']) {
    const r = screen({ patientId: 't-patient', newPrescriptionId: id, prescriptions: p });
    assert.equal(r.report.validationFailed, 0, JSON.stringify(r.evidence.validationFailures));
    for (const a of r.alerts) assert.ok(a.description.length <= 400);
  }
});

test('ingredientsOf splits every combination form and applies only same-molecule synonyms', () => {
  assert.deepEqual(ingredientsOf('Calcium carbonate + vitamin D3'), ['calcium carbonate', 'cholecalciferol']);
  assert.deepEqual(ingredientsOf('Paracetamol/Caffeine'), ['acetaminophen', 'caffeine']);
  assert.deepEqual(ingredientsOf('Amlodipine and Atorvastatin'), ['amlodipine', 'atorvastatin']);
  assert.deepEqual(ingredientsOf('Warfarin'), ['warfarin']);
  assert.deepEqual(ingredientsOf(''), []);
  assert.deepEqual(ingredientsOf(null), []);
});

test('a patient with no chat and no notifications is screened identically (TC-IX-05: no channel is read)', () => {
  // screenNewPrescription takes no channel, settings or link argument at all.
  assert.equal(screenNewPrescription.length, 1);
  const r = screen({ patientId: 'pt-01', newPrescriptionId: 'rx-001', prescriptions: seedActive('pt-01') });
  assert.equal(r.screened, true);
  assert.ok(r.alerts.length > 0);
});

// ---------------------------------------------------------------- regressions from the adversarial review
test('a bracketed brand in the stored name ("Simvastatin (Zocor)") still finds its pair, and V5 does not drop the alert', () => {
  const p = [rx('t-new', 'Simvastatin (Zocor)'), rx('t-a', 'Clarithromycin')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-new', prescriptions: p });
  assert.equal(r.report.validationFailed, 0, JSON.stringify(r.evidence && r.evidence.validationFailures));
  assert.ok(r.alerts.some((a) => a.severity === 'danger'));
});

test('an uncovered label containing an indexed word is never dropped by V5', () => {
  const p = [rx('t-new', 'Warfarin'), rx('t-a', 'Simvastatin lactobionate xyz')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-new', prescriptions: p });
  assert.equal(r.report.validationFailed, 0, JSON.stringify(r.evidence && r.evidence.validationFailures));
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].reviewStatus, 'pending_medical_review');
});

test('polypharmacy: 25 uncovered co-medications -> the cannot-verify alert is capped, never dropped for length', () => {
  const p = [rx('t-new', 'Esomeprazole magnesium trihydrate')];
  for (let i = 0; i < 25; i++) p.push(rx('t-' + i, 'Uncoveredmedicine' + String.fromCharCode(97 + i) + 'zol'));
  for (const language of ['ar', 'en']) {
    const r = screen({ patientId: 't-patient', newPrescriptionId: 't-new', prescriptions: p, language });
    assert.equal(r.report.validationFailed, 0);
    assert.equal(r.alerts.length, 1);
    assert.ok(r.alerts[0].description.length <= 400);
    assert.equal(r.alerts[0].involvedPrescriptionIds.length, 26);
    for (let i = 0; i < 25; i++) assert.match(r.alerts[0].sourceCitation, new RegExp('Uncoveredmedicine' + String.fromCharCode(97 + i) + 'zol'));
  }
});

test('ANY alert withheld by validation escalates the run (not only danger)', () => {
  const { validateAlerts } = require('../src/validate');
  const v = validateAlerts([{ alert: { patientId: 'x', involvedPrescriptionIds: [], severity: 'info', description: 'd', sourceCitation: 'c', reviewStatus: 'pending_medical_review' }, evidence: {} }],
    { patientId: 'x', knownPrescriptionIds: [], index });
  assert.equal(v.mustEscalate, true);
});

test('no prescription id ever appears in a description', () => {
  const p = [rx('t-new', ''), rx('t-a', 'Simvastatin')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-new', prescriptions: p });
  for (const a of r.alerts) assert.doesNotMatch(a.description, /t-new|t-a/);
});

test('very long uncovered names still fit the 400-character limit (names shortened, list capped)', () => {
  const p = [rx('t-new', 'Warfarin')];
  for (let i = 0; i < 8; i++) p.push(rx('t-' + i, 'Averyveryverylonguncoveredgenericname' + 'x'.repeat(30) + String.fromCharCode(97 + i)));
  for (const language of ['ar', 'en']) {
    const r = screen({ patientId: 't-patient', newPrescriptionId: 't-new', prescriptions: p, language });
    assert.equal(r.report.validationFailed, 0);
    assert.equal(r.alerts.length, 1);
    assert.ok(r.alerts[0].description.length <= 400, String(r.alerts[0].description.length));
  }
});

test('an unnamed prescription is labelled in the reader\'s language', () => {
  const p = [rx('t-new', 'Warfarin'), rx('t-a', '   ')];
  assert.match(screen({ patientId: 't-patient', newPrescriptionId: 't-new', prescriptions: p }).alerts[0].description, /\(وصفة بلا اسم\)/);
  assert.match(screen({ patientId: 't-patient', newPrescriptionId: 't-new', prescriptions: p, language: 'en' }).alerts[0].description, /\(unnamed prescription\)/);
});
