'use strict';

/**
 * AP-17/CR-079 (D7): no src change - this proves the drug-knowledge agent's stored alert text
 * already speaks the patient's own language, because the app shows it as written (i18n/localize.ts
 * AsWritten) and never translates it. Every ALERT_TEXT template: no Arabic in an 'en' call, Arabic
 * in an 'ar' call, and no em/en dash in either. screenNewPrescription on the seed's own danger case
 * (pt-01: Warfarin x Ibuprofen) gives English descriptions for 'en' and Arabic with no language at
 * all (screening's own default, D7's "the request does not carry the language" case never occurs on
 * a real path - see docs/backend-notes/ap-17.md - but the function's own default is asserted here).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { index, seedActive } = require('./helpers');
const { screenNewPrescription } = require('../src/screening');
const { ALERT_TEXT } = require('../src/text');

const ARABIC_LETTER = /[؀-ۿ]/;
const DASH = /[–—]/;

/** One representative call per ALERT_TEXT template, args in the shape screening.js actually passes. */
const CALLS = [
  ['interaction', (l) => ALERT_TEXT.interaction(l, 'danger', 'Warfarin', 'Ibuprofen')],
  ['duplicate', (l) => ALERT_TEXT.duplicate(l, 'Ibuprofen')],
  ['ungraded', (l) => ALERT_TEXT.ungraded(l, ['Warfarin x Ibuprofen'])],
  ['cannotVerify', (l) => ALERT_TEXT.cannotVerify(l, ['Gliclazide'])],
  ['pairNotCheckable', (l) => ALERT_TEXT.pairNotCheckable(l, ['Ibuprofen with Ciprofloxacin'])],
  ['nothingFound', (l) => ALERT_TEXT.nothingFound(l, 'Metformin')],
  ['nothingFoundButUnconfirmed', (l) => ALERT_TEXT.nothingFoundButUnconfirmed(l, 'Metformin', 1)],
  ['notScreenedAwaitingReview', (l) => ALERT_TEXT.notScreenedAwaitingReview(l, 'Metformin', 2)],
  ['travelDanger', (l) => ALERT_TEXT.travelDanger(l, 'Brufen', 'Ibuprofen', 'Warfarin')],
];

for (const [name, call] of CALLS) {
  test('ALERT_TEXT.' + name + ": 'en' has no Arabic letter, 'ar' has Arabic, neither has an em/en dash", () => {
    const en = call('en');
    const ar = call('ar');
    assert.doesNotMatch(en, ARABIC_LETTER, name + ' (en): ' + en);
    assert.match(ar, ARABIC_LETTER, name + ' (ar): ' + ar);
    assert.doesNotMatch(en, DASH, name + ' (en) dash: ' + en);
    assert.doesNotMatch(ar, DASH, name + ' (ar) dash: ' + ar);
  });
}

test("screenNewPrescription on the seed's danger case (pt-01: Warfarin x Ibuprofen), language 'en': English descriptions", () => {
  const r = screenNewPrescription({ patientId: 'pt-01', newPrescriptionId: 'rx-002', prescriptions: seedActive('pt-01'), language: 'en', index });
  assert.ok(r.alerts.length > 0);
  for (const a of r.alerts) assert.doesNotMatch(a.description, ARABIC_LETTER, a.description);
  const danger = r.alerts.find((a) => a.severity === 'danger');
  assert.match(danger.description, /Warfarin/);
  assert.match(danger.description, /Ibuprofen/);
});

test("screenNewPrescription on the same case with NO language given: Arabic descriptions (screening's own default)", () => {
  const r = screenNewPrescription({ patientId: 'pt-01', newPrescriptionId: 'rx-002', prescriptions: seedActive('pt-01'), index });
  assert.ok(r.alerts.length > 0);
  for (const a of r.alerts) assert.match(a.description, ARABIC_LETTER, a.description);
});
