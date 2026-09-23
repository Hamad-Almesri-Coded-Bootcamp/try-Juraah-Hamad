'use strict';

/**
 * agents/lib/adherence.js against the spec's adherence and rescheduling cases. Fixtures mirror the
 * seed's tracked patient pt-03 (سارة) on 2026-09-24: rx-008 Levothyroxine (Eltroxin) 07:00 and
 * rx-009 Calcium + D3 13:00 / 21:00 - the rows GET /api/agent/patients/pt-03/doses returns.
 * Dose words are built from the module's own arrays, never as `status:` literals (guard 4).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../lib/adherence.js');

const [ON_TIME, LATE, MISSED] = A.RECORDED_WORDS;
const OPEN = ['upcoming'][0];
const dose = (id, prescriptionId, hhmm, word, extra = {}) => ({
  id, prescriptionId, scheduledAt: '2026-09-24T' + hhmm + ':00+03:00', status: word, recordedAt: null,
  genericName: prescriptionId === 'rx-008' ? 'Levothyroxine' : 'Calcium carbonate + vitamin D3',
  brandName: prescriptionId === 'rx-008' ? 'Eltroxin' : null, strengthMg: 50, strengthUnit: 'mcg',
  dosePerAdministration: 1, timingRelativeToFood: null, ...extra,
});
const DAY = () => [
  dose('rx-008-20260924-0700', 'rx-008', '07:00', OPEN),
  dose('rx-009-20260924-1300', 'rx-009', '13:00', OPEN),
  dose('rx-009-20260924-2100', 'rx-009', '21:00', OPEN),
];
const at = (hhmm) => '2026-09-24T' + hhmm + ':00+03:00';
const said = (intent, confidence = 0.95, quote = 'q') => ({ intent, confidence, quote });
const patient = (over) => ({ subjectType: 'patient', language: 'ar', doses: DAY(), tap: null, ...over });

test('taken_on_time on the one due dose -> exactly one status write, source fixed, recordedAt = the reply time', () => {
  const d = A.decide(patient({ sentAt: at('07:20'), classification: said(ON_TIME, 0.95, 'خذيته') }));
  assert.equal(d.outcome, 'record');
  assert.deepEqual(d.writes, [{ op: 'dose_status', doseId: 'rx-008-20260924-0700',
    body: { status: ON_TIME, recordedAt: '2026-09-24T04:20:00.000Z', source: 'adherence_agent' } }]);
  assert.match(d.reply, /Eltroxin/);
});

test('taken_late carries recordedAt (the route requires it) and no recompute', () => {
  const d = A.decide(patient({ sentAt: at('09:40'), classification: said(LATE) }));
  assert.equal(d.writes.length, 1);
  assert.equal(d.writes[0].body.status, LATE);
  assert.ok(d.writes[0].body.recordedAt);
});

test('TC-RS-01: a reported miss is recorded FIRST, then recompute reported_miss on that dose', () => {
  const d = A.decide(patient({ sentAt: at('08:30'), classification: said(MISSED, 0.9, 'نسيت') }));
  assert.deepEqual(d.writes.map((w) => w.op), ['dose_status', 'recompute']);
  assert.equal(d.writes[0].body.status, MISSED);
  assert.deepEqual(d.writes[1].body, { prescriptionId: 'rx-008', reason: 'reported_miss', missedDoseId: 'rx-008-20260924-0700' });
});

test('G11: below 0.7, or an intent that does not exist, is unclear and writes nothing', () => {
  for (const c of [said(ON_TIME, 0.69), said('taken', 0.99), said(MISSED, NaN), {}, null]) {
    const d = A.decide(patient({ sentAt: at('07:20'), classification: c }));
    assert.equal(d.outcome, 'unclear');
    assert.deepEqual(d.writes, []);
  }
});

test('TC-AD-14: a caregiver’s chat never writes - not a typed reply, not a tap - and is told why', () => {
  const typed = A.decide(patient({ subjectType: 'caregiver', sentAt: at('07:20'), classification: said(ON_TIME, 1, 'أبوي خذ الدوا') }));
  const tapped = A.decide(patient({ subjectType: 'caregiver', sentAt: at('07:20'), tap: A.parseTap('d:rx-008-20260924-0700:taken_on_time') }));
  for (const d of [typed, tapped]) {
    assert.equal(d.outcome, 'caregiver_refused');
    assert.deepEqual(d.writes, []);
    assert.match(d.reply, /المريض بنفسه/);
  }
});

test('TC-AD-12: two open due doses and a typed "I took it" -> ask with buttons, never pick one', () => {
  const d = A.decide(patient({ sentAt: at('22:00'), classification: said(ON_TIME) }));
  assert.equal(d.outcome, 'ask_which');
  assert.deepEqual(d.writes, []);
  assert.deepEqual(d.askDoses.map((x) => x.id), ['rx-008-20260924-0700', 'rx-009-20260924-1300', 'rx-009-20260924-2100']);
});

test('only open doses are candidates: a recorded dose is never written over by a typed reply', () => {
  const doses = DAY();
  doses[0] = dose('rx-008-20260924-0700', 'rx-008', '07:00', ON_TIME);
  const d = A.decide(patient({ doses, sentAt: at('13:05'), classification: said(ON_TIME) }));
  assert.equal(d.writes[0].doseId, 'rx-009-20260924-1300');
});

test('taken may be up to an hour early; missed never before the dose time; nothing open -> no write', () => {
  const early = A.decide(patient({ doses: DAY().slice(1), sentAt: at('12:10'), classification: said(ON_TIME) }));
  assert.equal(early.writes[0].doseId, 'rx-009-20260924-1300');
  const tooEarly = A.decide(patient({ doses: DAY().slice(1), sentAt: at('11:30'), classification: said(ON_TIME) }));
  assert.equal(tooEarly.outcome, 'no_dose');
  const missEarly = A.decide(patient({ doses: DAY().slice(1), sentAt: at('12:30'), classification: said(MISSED) }));
  assert.equal(missEarly.outcome, 'no_dose');
  assert.deepEqual(A.decide(patient({ doses: [], sentAt: at('12:00'), classification: said(ON_TIME) })).writes, []);
});

test('TC-AD-07: a tap is attributed to the dose it names, checked against the patient’s own doses', () => {
  const d = A.decide(patient({ sentAt: at('22:00'), tap: A.parseTap('d:rx-009-20260924-1300:taken_late') }));
  assert.equal(d.outcome, 'record');
  assert.equal(d.writes[0].doseId, 'rx-009-20260924-1300');
  assert.equal(d.writes[0].body.status, LATE);
  const foreign = A.decide(patient({ sentAt: at('22:00'), tap: A.parseTap('d:rx-001-20260924-0800:taken_on_time') }));
  assert.equal(foreign.outcome, 'no_dose');
  assert.deepEqual(foreign.writes, []);
});

test('a tap on an already-recorded dose, or "missed" before its time, writes nothing', () => {
  const doses = DAY();
  doses[0] = dose('rx-008-20260924-0700', 'rx-008', '07:00', MISSED);
  assert.equal(A.decide(patient({ doses, sentAt: at('08:00'), tap: A.parseTap('d:rx-008-20260924-0700:taken_on_time') })).outcome, 'already_recorded');
  assert.equal(A.decide(patient({ sentAt: at('08:00'), tap: A.parseTap('d:rx-009-20260924-2100:missed') })).writes.length, 0);
});

test('parseTap accepts only d:<id>:<recorded word>; tapData stays under 64 bytes', () => {
  assert.deepEqual(A.parseTap('d:rx-009-20260924-1300:missed'), { doseId: 'rx-009-20260924-1300', intent: MISSED });
  for (const bad of ['rx:1:missed', 'd::missed', 'd:x:ran_out', 'd:x:taken', 'd:a b:missed', 'taken_on_time', null, 7]) assert.equal(A.parseTap(bad), null);
  assert.ok(A.tapData('rx-009-20260924-1300', ON_TIME).length <= 64);
});

test('TC-RS-03: discontinued_by_doctor cancels ONE prescription with the patient’s words as the reason', () => {
  const d = A.decide(patient({ doses: DAY().slice(0, 1), sentAt: at('08:00'), classification: said('discontinued_by_doctor', 0.9, 'دكتوري قال أوقف الدواء') }));
  assert.equal(d.outcome, 'discontinue');
  assert.equal(d.writes.length, 1);
  assert.equal(d.writes[0].body.reason, 'discontinued');
  assert.equal(d.writes[0].body.prescriptionId, 'rx-008');
  assert.match(d.writes[0].body.discontinuedReason, /دكتوري قال أوقف الدواء/);
});

test('a discontinuation that could mean two prescriptions is asked about, never applied', () => {
  const d = A.decide(patient({ sentAt: at('22:00'), classification: said('discontinued_by_doctor', 0.95) }));
  assert.equal(d.outcome, 'ask_which');
  assert.deepEqual(d.writes, []);
});

test('ran_out writes nothing (a refill is the patient’s own request in the app)', () => {
  const d = A.decide(patient({ sentAt: at('07:30'), classification: said('ran_out') }));
  assert.equal(d.outcome, 'ran_out');
  assert.deepEqual(d.writes, []);
});

test('replyAfterWrites: a refused write never reads as recorded; a failed recompute says the miss is recorded', () => {
  const miss = A.decide(patient({ sentAt: at('08:30'), classification: said(MISSED) }));
  assert.deepEqual(A.replyAfterWrites(miss, [{ statusCode: 200 }, { statusCode: 200 }], 'ar'), { reply: miss.reply, recorded: true });
  assert.equal(A.replyAfterWrites(miss, [{ statusCode: 409 }], 'ar').recorded, false);
  assert.equal(A.replyAfterWrites(miss, [{ statusCode: 500 }], 'ar').reply, A.REPLIES.ar.failed);
  const partial = A.replyAfterWrites(miss, [{ statusCode: 200 }, { statusCode: 409 }], 'ar');
  assert.equal(partial.recorded, true);
  assert.match(partial.reply, /جدولك ما تغيّر/);
});

test('English replies follow Patient.language', () => {
  const d = A.decide(patient({ language: 'en', sentAt: at('07:20'), classification: said(ON_TIME) }));
  assert.match(d.reply, /recorded as taken on time/);
});

test('buildCheckIn: a header, then one message per OPEN dose with three buttons naming it; nothing open -> skipped', () => {
  const doses = DAY();
  doses[0] = dose('rx-008-20260924-0700', 'rx-008', '07:00', ON_TIME);
  const c = A.buildCheckIn({ patientId: 'pt-03', chatId: 'c-1', language: 'ar', doses });
  assert.equal(c.skipped, false);
  assert.equal(c.messages.length, 3);
  assert.equal(c.messages[0].buttons, null);
  assert.deepEqual(c.messages[1].buttons.map((b) => b.data),
    ['d:rx-009-20260924-1300:taken_on_time', 'd:rx-009-20260924-1300:taken_late', 'd:rx-009-20260924-1300:missed']);
  assert.match(c.messages[1].text, /^13:00/);
  assert.equal(A.buildCheckIn({ patientId: 'pt-03', chatId: 'c-1', language: 'ar', doses: [] }).skipped, true);
});

test('kuwaitDate / previousDate never depend on the host clock or zone', () => {
  assert.equal(A.kuwaitDate('2026-09-23T22:30:00Z'), '2026-09-24');
  assert.equal(A.kuwaitHHMM('2026-09-24T04:00:00Z'), '07:00');
  assert.equal(A.previousDate('2026-09-01'), '2026-08-31');
});
