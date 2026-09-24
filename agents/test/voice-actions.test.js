'use strict';

/**
 * agents/lib/voice-actions.js - CR-070. Fixtures: pt-03's three tracked doses on 2026-09-24
 * (07:00 Eltroxin, 13:00 and 21:00 Calcium + D3). The model only names doses; everything else -
 * which dose, whether it can be recorded, what is written - is decided here and tested here.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../lib/voice-actions.js');
const V = require('../lib/voice.js');

const OPEN = ['upcoming'][0];
// Dose words by reference, never as an object literal (guard 4 / G1 scans for status: '<word>').
const W_ON = ['taken_on_time'][0];
const W_LATE = ['taken_late'][0];
const W_MISS = ['missed'][0];
const dose = (id, rx, hhmm, status = OPEN) => ({
  id, prescriptionId: rx, scheduledAt: '2026-09-24T' + hhmm + ':00+03:00', status, recordedAt: null,
  genericName: rx === 'rx-008' ? 'Levothyroxine' : 'Calcium carbonate + vitamin D3', brandName: rx === 'rx-008' ? 'Eltroxin' : null,
  strengthMg: rx === 'rx-008' ? 50 : 500, strengthUnit: rx === 'rx-008' ? 'mcg' : null, dosePerAdministration: 1, timingRelativeToFood: null,
});
const DAY = () => [dose('rx-009-0924-2100', 'rx-009', '21:00'), dose('rx-008-0924-0700', 'rx-008', '07:00'), dose('rx-009-0924-1300', 'rx-009', '13:00')];
const at = (hhmm) => '2026-09-24T' + hhmm + ':00+03:00';
const API = 'https://app.example/api/agent';
const plan = (items, nowHHMM, language = 'en', doses = DAY()) => A.planRecord({ items, doses, nowIso: at(nowHHMM), language, spokenTime: V.spokenTime });

test('trustFreeTalk: only a listed intent above 0.7; record keeps only well-formed items; record with none is unclear', () => {
  assert.deepEqual(A.trustFreeTalk({ intent: 'today', confidence: 0.9 }), { kind: 'TodayDosesIntent', items: [] });
  assert.deepEqual(A.trustFreeTalk({ intent: 'today', confidence: 0.5 }), { kind: 'AMAZON.FallbackIntent', items: [] });
  assert.deepEqual(A.trustFreeTalk({ intent: 'delete_everything', confidence: 1 }), { kind: 'AMAZON.FallbackIntent', items: [] });
  const r = A.trustFreeTalk({ intent: 'record', confidence: 0.95, items: [
    { position: 1, status: W_ON }, { position: 2, status: 'raise_dose' }, { position: 99, status: W_MISS }, { time: '21:00', status: W_MISS }, {},
  ] });
  assert.equal(r.kind, 'record');
  assert.deepEqual(r.items, [{ position: 1, time: null, medicine: null, status: W_ON }, { position: null, time: '21:00', medicine: null, status: W_MISS }]);
  assert.deepEqual(A.trustFreeTalk({ intent: 'record', confidence: 0.95, items: [{ status: W_MISS }] }), { kind: 'AMAZON.FallbackIntent', items: [] });
  assert.deepEqual(A.trustFreeTalk(null), { kind: 'AMAZON.FallbackIntent', items: [] });
});

test('"mark the first two taken and the third missed" at 22:00: positions count today in time order; read back, nothing written', () => {
  const r = plan([{ position: 1, status: W_ON }, { position: 2, status: W_ON }, { position: 3, status: W_MISS }], '22:00');
  assert.deepEqual(r.pending, [
    { doseId: 'rx-008-0924-0700', prescriptionId: 'rx-008', status: W_ON },
    { doseId: 'rx-009-0924-1300', prescriptionId: 'rx-009', status: W_ON },
    { doseId: 'rx-009-0924-2100', prescriptionId: 'rx-009', status: W_MISS },
  ]);
  assert.match(r.speech, /^I will record: Eltroxin at 7 in the morning taken, Calcium carbonate \+ vitamin D3 at 1 in the afternoon taken, Calcium carbonate \+ vitamin D3 at 9 in the evening missed\. Shall I\? Say yes, or no\.$/);
});

test('a dose not due yet (more than an hour ahead) or already recorded is named and skipped - never written', () => {
  const r = plan([{ position: 1, status: W_ON }, { position: 2, status: W_ON }, { position: 3, status: W_MISS }], '09:00');
  assert.deepEqual(r.pending.map((p) => p.doseId), ['rx-008-0924-0700']);
  assert.match(r.speech, /I could not record: Calcium carbonate \+ vitamin D3 at 1 in the afternoon - not due yet, Calcium carbonate \+ vitamin D3 at 9 in the evening - not due yet\./);
  const done = DAY(); done[1] = dose('rx-008-0924-0700', 'rx-008', '07:00', 'taken_on_time');
  const r2 = plan([{ position: 1, status: W_MISS }], '09:00', 'en', done);
  assert.deepEqual(r2.pending, []);
  assert.match(r2.speech, /^I could not record anything: Eltroxin at 7 in the morning - already recorded\.$/);
});

test('by medicine name and by time; "my calcium" with two calcium doses picks the one that is open and due, else refuses as ambiguous', () => {
  assert.deepEqual(plan([{ medicine: 'eltroxin', status: W_LATE }], '09:00').pending.map((p) => [p.doseId, p.status]), [['rx-008-0924-0700', 'taken_late']]);
  assert.deepEqual(plan([{ time: '13:00', status: W_ON }], '13:10').pending.map((p) => p.doseId), ['rx-009-0924-1300']);
  const doneMorning = DAY(); doneMorning[2] = dose('rx-009-0924-1300', 'rx-009', '13:00', 'taken_on_time');
  assert.deepEqual(plan([{ medicine: 'calcium', status: W_MISS }], '22:00', 'en', doneMorning).pending.map((p) => p.doseId), ['rx-009-0924-2100']);
  assert.match(plan([{ medicine: 'calcium', status: W_ON }], '22:00').speech, /more than one dose matches/);
  assert.match(plan([{ medicine: 'aspirin', status: W_ON }], '22:00').speech, /could not find the dose you meant/);
});

test('Arabic wording, and the schedule could not be read -> no speech here (the caller says it failed), nothing pending', () => {
  assert.match(plan([{ position: 1, status: W_ON }], '09:00', 'ar').speech, /^بسجّل: Eltroxin الساعة 7 الصبح أخذتها\. تأكد؟ قول نعم، أو لا\.$/);
  assert.deepEqual(A.planRecord({ items: [{ position: 1, status: W_MISS }], doses: null, nowIso: at('09:00'), language: 'en', spokenTime: V.spokenTime }), { speech: null, pending: [] });
});

test('"yes": the pending list from Alexa\'s session is re-checked against FRESH doses; writes are the Telegram path\'s own two calls', () => {
  const pending = [
    { doseId: 'rx-008-0924-0700', prescriptionId: 'rx-008', status: W_ON },
    { doseId: 'rx-009-0924-2100', prescriptionId: 'rx-009', status: W_MISS },
    { doseId: 'rx-009-0924-1300', prescriptionId: 'rx-008', status: W_ON }, // prescription does not match -> skipped
    { doseId: '../../etc', prescriptionId: 'rx-008', status: W_ON }, // malformed -> dropped
    { doseId: 'rx-008-0924-0700', prescriptionId: 'rx-008', status: 'raise_dose' }, // not a status -> dropped
  ];
  const r = A.confirmRecord({ pending, doses: DAY(), nowIso: at('22:00'), api: API, recordedAtIso: '2026-09-24T19:00:00.000Z' });
  assert.deepEqual(r.writes.map((w) => [w.url, w.body, w.recompute]), [
    [API + '/doses/rx-008-0924-0700/status', { status: W_ON, recordedAt: '2026-09-24T19:00:00.000Z', source: 'adherence_agent' }, null],
    [API + '/doses/rx-009-0924-2100/status', { status: W_MISS, recordedAt: '2026-09-24T19:00:00.000Z', source: 'adherence_agent' },
      { url: API + '/schedule/recompute', body: { prescriptionId: 'rx-009', reason: 'reported_miss', missedDoseId: 'rx-009-0924-2100' } }],
  ]);
  assert.deepEqual(r.skipped, ['rx-009-0924-1300']);
  // Recorded in the meantime (e.g. from Telegram) -> not written twice.
  const fresh = DAY(); fresh[1] = dose('rx-008-0924-0700', 'rx-008', '07:00', 'taken_late');
  assert.deepEqual(A.confirmRecord({ pending: pending.slice(0, 1), doses: fresh, nowIso: at('22:00'), api: API, recordedAtIso: 'x' }).writes, []);
  assert.deepEqual(A.cleanPending('nope'), []);
});

test('after the writes: says what was recorded and, honestly, what was not', () => {
  const writes = [{ doseId: 'rx-008-0924-0700', status: W_ON }, { doseId: 'rx-009-0924-2100', status: W_MISS }];
  assert.equal(A.recordedSpeech({ writes, results: [200, 409], doses: DAY(), language: 'en', spokenTime: V.spokenTime }),
    'Done. I recorded: Eltroxin at 7 in the morning taken. I could not record: Calcium carbonate + vitamin D3 at 9 in the evening missed.');
  assert.match(A.recordedSpeech({ writes: [], results: [], doses: DAY(), language: 'en', spokenTime: V.spokenTime }), /nothing for me to record/);
});

test('quickFreeTalk: a plain question skips the model (Alexa waits at most 8 s); anything about what the patient DID goes to the model', () => {
  assert.equal(A.quickFreeTalk('when do i need to take my eltroxin'), 'NextDoseIntent');
  assert.equal(A.quickFreeTalk('should I have my eltroxin'), 'NextDoseIntent'); // Alexa dropped the carrier "when"
  assert.equal(A.quickFreeTalk('do I need to take my calcium'), 'NextDoseIntent');
  assert.equal(A.quickFreeTalk('my medicines for today'), 'TodayDosesIntent');
  assert.equal(A.quickFreeTalk('how many pills'), 'DoseAmountIntent');
  for (const t of ['the first two taken and the third missed', 'i took my eltroxin', 'i forgot the evening one', 'did not take it today', 'hello there', 'how many do i take today']) {
    assert.equal(A.quickFreeTalk(t), null, t);
  }
});
