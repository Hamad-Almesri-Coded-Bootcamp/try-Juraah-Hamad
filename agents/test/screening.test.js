'use strict';

/** agents/lib/screening.js against TC-IX-01..06, on the seed's own prescriptions (rx-001..rx-009). */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../lib/screening.js');

const rx = (id, genericName, extra = {}) => ({ id, patientId: 'pt-01', drug: { genericName }, needsReview: false, status: 'active', ...extra });
const PT01 = [rx('rx-001', 'Warfarin'), rx('rx-002', 'Ibuprofen'), rx('rx-003', 'Metformin')];

test('TC-IX-01: warfarin + ibuprofen (public vs private) -> danger, pending review, citation passed through, never invented', () => {
  const r = S.screenNewPrescription({ patientId: 'pt-01', newPrescriptionId: 'rx-002', prescriptions: PT01, language: 'ar' });
  const danger = r.alerts.filter((a) => a.severity === 'danger');
  assert.equal(danger.length, 1);
  assert.deepEqual(danger[0].involvedPrescriptionIds, ['rx-002', 'rx-001']);
  assert.equal(danger[0].reviewStatus, 'pending_medical_review');
  assert.equal(danger[0].sourceCitation, '[TO BE SUPPLIED]');
  assert.equal(danger[0].description, 'أخذ الوارفارين مع الإيبوبروفين يرفع خطر النزيف.');
});

test('a combined ingredient is split: calcium carbonate + vitamin D3 against levothyroxine -> warning', () => {
  const r = S.screenNewPrescription({
    patientId: 'pt-03', newPrescriptionId: 'rx-009', language: 'ar',
    prescriptions: [rx('rx-008', 'Levothyroxine'), rx('rx-009', 'Calcium carbonate + vitamin D3')],
  });
  assert.deepEqual(r.alerts.map((a) => a.severity), ['warning']);
});

test('no pair matched is NEVER auto-cleared: one info alert, pending_medical_review, saying it is not a clearance', () => {
  const r = S.screenNewPrescription({ patientId: 'pt-01', newPrescriptionId: 'rx-001',
    prescriptions: [rx('rx-001', 'Warfarin'), rx('rx-008', 'Levothyroxine')], language: 'ar' });
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].severity, 'info');
  assert.equal(r.alerts[0].reviewStatus, 'pending_medical_review');
  assert.match(r.alerts[0].description, /ليس تأكيداً بالسلامة/);
  assert.ok(r.alerts.every((a) => a.reviewStatus !== 'auto_cleared'));
});

test('AP-17/CR-079: the "no pair matched" alert has no em or en dash, in either language', () => {
  const prescriptions = [rx('rx-001', 'Warfarin'), rx('rx-008', 'Levothyroxine')];
  const ar = S.screenNewPrescription({ patientId: 'pt-01', newPrescriptionId: 'rx-001', prescriptions, language: 'ar' });
  const en = S.screenNewPrescription({ patientId: 'pt-01', newPrescriptionId: 'rx-001', prescriptions, language: 'en' });
  assert.doesNotMatch(ar.alerts[0].description, /[—–]/);
  assert.doesNotMatch(en.alerts[0].description, /[—–]/);
  assert.match(en.alerts[0].description, /not a clearance/);
});

test('TC-IX-03/04: an ingredient we cannot resolve -> "cannot verify", never silently fine; nonsense names too', () => {
  for (const name of ['Metformin', 'Zzqxblorp', '', '(unreadable)']) {
    const r = S.screenNewPrescription({ patientId: 'pt-01', newPrescriptionId: 'rx-x', language: 'ar',
      prescriptions: [rx('rx-001', 'Warfarin'), rx('rx-x', name)] });
    assert.equal(r.screened, true);
    assert.equal(r.alerts.length, 1, name);
    assert.match(r.alerts[0].description, /تعذّر علينا التحقق/);
    assert.equal(r.alerts[0].severity, 'info');
  }
});

test('TC-IX-06: a flagged prescription is excluded visibly; a flagged NEW one is not screened yet', () => {
  const profile = [rx('rx-001', 'Warfarin'), rx('rx-002', 'Ibuprofen', { needsReview: true }), rx('rx-003', 'Levothyroxine')];
  const r = S.screenNewPrescription({ patientId: 'pt-01', newPrescriptionId: 'rx-001', prescriptions: profile, language: 'ar' });
  assert.deepEqual(r.excluded, [{ id: 'rx-002', reason: 'needs_review' }]);
  assert.ok(r.alerts.every((a) => !a.involvedPrescriptionIds.includes('rx-002')));
  const flagged = S.screenNewPrescription({ patientId: 'pt-01', newPrescriptionId: 'rx-002', prescriptions: profile, language: 'ar' });
  assert.equal(flagged.screened, false);
  assert.deepEqual(flagged.alerts, []);
});

test('only pairs that include the NEW prescription are checked, so a re-run never re-raises an old pair', () => {
  const r = S.screenNewPrescription({ patientId: 'pt-01', newPrescriptionId: 'rx-008',
    prescriptions: [...PT01.slice(0, 2), rx('rx-008', 'Levothyroxine')], language: 'en' });
  assert.ok(r.alerts.every((a) => a.severity !== 'danger'));
});

test('an id that is not an active prescription of the patient screens nothing', () => {
  assert.equal(S.screenNewPrescription({ patientId: 'pt-01', newPrescriptionId: 'rx-999', prescriptions: PT01 }).screened, false);
});

test('every alert body has exactly the keys POST /api/agent/alerts accepts, and never a reviewer field', () => {
  const r = S.screenNewPrescription({ patientId: 'pt-01', newPrescriptionId: 'rx-002', prescriptions: PT01, language: 'ar' });
  for (const a of r.alerts) {
    assert.deepEqual(Object.keys(a).sort(), ['description', 'involvedPrescriptionIds', 'patientId', 'reviewStatus', 'severity', 'sourceCitation']);
  }
});
