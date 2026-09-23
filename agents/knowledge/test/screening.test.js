'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { index, seedActive, rx } = require('./helpers');
const { screenNewPrescription } = require('../src/screening');
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
  // vitamin D3 is not in the demo index: said, never cleared (TC-IX-03)
  const cv = r.alerts.find((a) => a.severity === 'info');
  assert.ok(cv, 'a cannot-verify alert');
  assert.equal(cv.reviewStatus, 'pending_medical_review');
  assert.match(cv.description, /vitamin D3/);
  for (const a of r.alerts) assertBackendShape(a, 'pt-03');
});

test('seed حمد (pt-01): Warfarin, Ibuprofen, Metformin are not in the demo index -> ONE cannot-verify alert, never "no interaction" (TC-IX-03)', () => {
  const r = screen({ patientId: 'pt-01', newPrescriptionId: 'rx-002', prescriptions: seedActive('pt-01') });
  assert.equal(r.alerts.length, 1);
  const [a] = r.alerts;
  assert.equal(a.severity, 'info');
  assert.equal(a.reviewStatus, 'pending_medical_review');
  assert.deepEqual([...a.involvedPrescriptionIds].sort(), ['rx-001', 'rx-002', 'rx-003']);
  for (const d of ['Warfarin', 'Ibuprofen', 'Metformin']) assert.match(a.description, new RegExp(d));
  assert.doesNotMatch(a.description, /لم نجد تعارضاً/, 'never the nothing-found wording');
  assert.equal(r.report.graded, 0);
  assertBackendShape(a, 'pt-01');
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
  const p = [rx('t-1', 'Ezetimibe'), rx('t-2', 'Amlodipine'), rx('t-3', '(unreadable)', { needsReview: true, fieldReviewStatus: 'pending' })];
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

test('TC-IX-02: both drugs covered, no row -> no interaction alert; one auto_cleared "screened, nothing recorded" (seed ia-003 shape)', () => {
  const p = [rx('t-1', 'Ezetimibe'), rx('t-2', 'Amlodipine')];
  const r = screen({ patientId: 't-patient', newPrescriptionId: 't-2', prescriptions: p });
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].severity, 'info');
  assert.equal(r.alerts[0].reviewStatus, 'auto_cleared');
  assert.deepEqual(r.alerts[0].involvedPrescriptionIds, ['t-2']);
  assert.match(r.alerts[0].description, /تم فحص Amlodipine/);
  assert.match(r.alerts[0].description, /ليس ضماناً للسلامة/);
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
