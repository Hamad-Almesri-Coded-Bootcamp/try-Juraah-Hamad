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
/** dose(), but for the Kuwait date BEFORE 2026-09-24 (2026-09-23), for the midnight tests. */
const yDose = (id, prescriptionId, hhmm, word, extra = {}) => ({
  ...dose(id, prescriptionId, hhmm, word, extra), scheduledAt: '2026-09-23T' + hhmm + ':00+03:00',
});
const at = (hhmm) => '2026-09-24T' + hhmm + ':00+03:00';
const said = (intent, confidence = 0.95, quote = 'q') => ({ intent, confidence, quote });
// The patient's active prescriptions, exactly as GET /api/agent/patients/{id}/prescriptions answers
// (types/contracts.ts Prescription: id, drug.genericName/brandName, status).
const RX = () => [
  { id: 'rx-008', patientId: 'pt-03', drug: { genericName: 'Levothyroxine', brandName: 'Eltroxin' }, status: 'active', needsReview: false },
  { id: 'rx-009', patientId: 'pt-03', drug: { genericName: 'Calcium carbonate + vitamin D3' }, status: 'active', needsReview: false },
];
const patient = (over) => ({ subjectType: 'patient', language: 'ar', doses: DAY(), prescriptions: RX(), tap: null, stopTap: null, ...over });

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

test('TC-AD-16: a caregiver the workflow could NOT confirm is still active (alert-recipients) -> silently dropped, never the plain refusal; an ACTIVE caregiver keeps today’s refusal reply', () => {
  const unverified = A.decide(patient({ subjectType: 'caregiver', sentAt: at('07:20'), classification: said(ON_TIME, 1), caregiverVerified: false }));
  assert.equal(unverified.outcome, 'caregiver_unverified');
  assert.equal(unverified.reply, null);
  assert.deepEqual(unverified.writes, []);
  assert.equal(unverified.guardrail, 'TC-AD-16');
  const verified = A.decide(patient({ subjectType: 'caregiver', sentAt: at('07:20'), classification: said(ON_TIME, 1), caregiverVerified: true }));
  assert.equal(verified.outcome, 'caregiver_refused');
  assert.match(verified.reply, /المريض بنفسه/);
  // Not (yet) checked (the field is absent, as every OTHER test in this file leaves it): today's behaviour, unchanged.
  const unchecked = A.decide(patient({ subjectType: 'caregiver', sentAt: at('07:20'), classification: said(ON_TIME, 1) }));
  assert.equal(unchecked.outcome, 'caregiver_refused');
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

test('CR-108: parseTap also accepts c:<id>:<word> with correct:true; a d: tap never carries it; a malformed c: tap is still null; correctionTapData stays under 64 bytes', () => {
  assert.deepEqual(A.parseTap('c:rx-009-20260924-1300:missed'), { doseId: 'rx-009-20260924-1300', intent: MISSED, correct: true });
  assert.deepEqual(A.parseTap('d:rx-009-20260924-1300:missed'), { doseId: 'rx-009-20260924-1300', intent: MISSED });
  for (const bad of ['c::missed', 'c:x:ran_out', 'c:a b:missed']) assert.equal(A.parseTap(bad), null);
  assert.ok(A.correctionTapData('rx-009-20260924-1300', ON_TIME).length <= 64);
  assert.ok(A.correctionTapData('rx-009-20260924-1300', ON_TIME).startsWith('c:'));
});

test('CR-108 (CR-081/D9): a c: correction tap may overwrite a dose already recorded, but ONLY with a DIFFERENT word; the SAME word, a miss before its time, another patient\'s dose, or a caregiver\'s tap all still refuse and write nothing; a d: tap on a recorded dose is unchanged', () => {
  const doses = DAY();
  doses[0] = dose('rx-008-20260924-0700', 'rx-008', '07:00', MISSED);
  // Different word: overwrites, exactly the same write shape a fresh tap would produce.
  const overwrite = A.decide(patient({ doses, sentAt: at('09:00'), tap: A.parseTap('c:rx-008-20260924-0700:taken_on_time') }));
  assert.equal(overwrite.outcome, 'record');
  assert.deepEqual(overwrite.writes, [{ op: 'dose_status', doseId: 'rx-008-20260924-0700',
    body: { status: ON_TIME, recordedAt: '2026-09-24T06:00:00.000Z', source: 'adherence_agent' } }]);
  // A miss overwritten by a c: tap after its time still gets the recompute, exactly like a fresh miss.
  const doses2 = DAY(); doses2[0] = dose('rx-008-20260924-0700', 'rx-008', '07:00', ON_TIME);
  const toMissed = A.decide(patient({ doses: doses2, sentAt: at('09:00'), tap: A.parseTap('c:rx-008-20260924-0700:missed') }));
  assert.deepEqual(toMissed.writes.map((w) => w.op), ['dose_status', 'recompute']);
  // The SAME word: already_recorded, no writes - a correction tap is not a re-confirmation.
  const same = A.decide(patient({ doses, sentAt: at('09:00'), tap: A.parseTap('c:rx-008-20260924-0700:missed') }));
  assert.equal(same.outcome, 'already_recorded');
  assert.deepEqual(same.writes, []);
  // A miss before the dose's own time: refused, whatever tap namespace asks for it.
  const stillOpen = DAY();
  const tooEarly = A.decide(patient({ doses: stillOpen, sentAt: at('06:30'), tap: A.parseTap('c:rx-008-20260924-0700:missed') }));
  assert.equal(tooEarly.outcome, 'refused');
  assert.deepEqual(tooEarly.writes, []);
  // A c: tap naming a dose that is not this patient's: no_dose, exactly like a d: tap would refuse.
  const foreign = A.decide(patient({ doses, sentAt: at('09:00'), tap: A.parseTap('c:rx-999-20260924-0700:taken_on_time') }));
  assert.equal(foreign.outcome, 'no_dose');
  assert.deepEqual(foreign.writes, []);
  // A caregiver's c: tap: refused exactly like any other caregiver write attempt, never overwrites.
  const byCaregiver = A.decide(patient({ subjectType: 'caregiver', doses, sentAt: at('09:00'), tap: A.parseTap('c:rx-008-20260924-0700:taken_on_time') }));
  assert.equal(byCaregiver.outcome, 'caregiver_refused');
  assert.deepEqual(byCaregiver.writes, []);
  // A plain d: tap on a recorded dose is unaffected by any of this - unchanged from before CR-108.
  const plainD = A.decide(patient({ doses, sentAt: at('09:00'), tap: A.parseTap('d:rx-008-20260924-0700:taken_on_time') }));
  assert.equal(plainD.outcome, 'already_recorded');
  assert.deepEqual(plainD.writes, []);
});

test('CR-108 buildVoiceNotice: exact en/ar text, the three button labels as in buildCheckIn, correction (c:) callback data; an unknown status throws', () => {
  const d = dose('rx-008-20260924-0700', 'rx-008', '07:00', MISSED);
  const en = A.buildVoiceNotice({ chatId: 'c-1', language: 'en', dose: d, status: MISSED });
  assert.equal(en.chatId, 'c-1');
  assert.equal(en.text, 'From your Alexa: I recorded Eltroxin 07:00 as missed 👍');
  assert.deepEqual(en.buttons.map((b) => b.text), ['Taken ✅', 'Taken late ⏰', 'Missed ✖']);
  assert.deepEqual(en.buttons.map((b) => b.data), ['c:rx-008-20260924-0700:taken_on_time', 'c:rx-008-20260924-0700:taken_late', 'c:rx-008-20260924-0700:missed']);
  const ar = A.buildVoiceNotice({ chatId: 'c-1', language: 'ar', dose: d, status: MISSED });
  assert.equal(ar.text, 'من أليكسا: سجّلت Eltroxin 07:00 إنها فاتتك 👍');
  assert.deepEqual(ar.buttons.map((b) => b.text), ['أخذته ✅', 'أخذته متأخر ⏰', 'نسيت ✖']);
  assert.throws(() => A.buildVoiceNotice({ chatId: 'c-1', language: 'en', dose: d, status: 'raise_dose' }));
});

test('TC-RS-03: "the doctor told me to stop it" writes nothing; one Stop <drug>? button per active prescription plus none of these (callback data <= 64 bytes); only a tap s:<rxId> of this patient discontinues', () => {
  const asked = A.decide(patient({ sentAt: at('08:00'), classification: said('discontinued_by_doctor', 0.9, 'دكتوري قال أوقف الدواء') }));
  assert.equal(asked.outcome, 'confirm_discontinue');
  assert.deepEqual(asked.writes, []);
  assert.deepEqual(asked.stopOptions, [{ prescriptionId: 'rx-008', label: 'Eltroxin' }, { prescriptionId: 'rx-009', label: 'Calcium carbonate + vitamin D3' }]);
  const buttons = A.buildStopOptions({ chatId: 'c-1', language: 'ar', stopOptions: asked.stopOptions });
  assert.equal(buttons.length, 3); // one per prescription, plus "none of these"
  for (const m of buttons) {
    assert.equal(m.buttons.length, 1);
    assert.ok(Buffer.byteLength(m.buttons[0].data) <= 64);
  }
  assert.equal(buttons[0].buttons[0].data, 's:rx-008');
  assert.equal(buttons[2].buttons[0].data, 'n:none');
  // ONE prescription open (the other already discontinued/completed): still asks, never assumes it.
  const oneActive = A.decide(patient({ prescriptions: [RX()[0]], sentAt: at('08:00'), classification: said('discontinued_by_doctor', 0.9) }));
  assert.equal(oneActive.outcome, 'confirm_discontinue');
  assert.equal(oneActive.stopOptions.length, 1);
  // The tap that follows: s:rx-008 discontinues that ONE prescription, with a fixed reason (no quote fits in callback data).
  const tapped = A.decide(patient({ sentAt: at('08:01'), stopTap: A.parseStopTap('s:rx-008') }));
  assert.equal(tapped.outcome, 'discontinue');
  assert.equal(tapped.writes.length, 1);
  assert.equal(tapped.writes[0].body.reason, 'discontinued');
  assert.equal(tapped.writes[0].body.prescriptionId, 'rx-008');
  assert.equal(typeof tapped.writes[0].body.discontinuedReason, 'string');
  assert.ok(tapped.writes[0].body.discontinuedReason.length > 0);
  assert.match(tapped.reply, /Eltroxin/);
  // "none of these": no write, an acknowledgement.
  const none = A.decide(patient({ sentAt: at('08:01'), stopTap: A.parseStopTap('n:none') }));
  assert.equal(none.outcome, 'discontinue_none');
  assert.deepEqual(none.writes, []);
  // An unknown, foreign or already-inactive prescription id: refused, nothing written.
  const unknown = A.decide(patient({ sentAt: at('08:01'), stopTap: A.parseStopTap('s:rx-999') }));
  assert.equal(unknown.outcome, 'no_dose');
  assert.deepEqual(unknown.writes, []);
  // A caregiver's stop tap: refused exactly like any other caregiver write attempt.
  const byCaregiver = A.decide(patient({ subjectType: 'caregiver', sentAt: at('08:01'), stopTap: A.parseStopTap('s:rx-008') }));
  assert.equal(byCaregiver.outcome, 'caregiver_refused');
  assert.deepEqual(byCaregiver.writes, []);
  // No active prescription at all: nothing to offer.
  const none_active = A.decide(patient({ prescriptions: [], sentAt: at('08:00'), classification: said('discontinued_by_doctor', 0.9) }));
  assert.equal(none_active.outcome, 'no_dose');
});

test('parseStopTap: only s:<id> or n:none; the none token can never parse as a prescription id; stopTapData stays under 64 bytes', () => {
  assert.deepEqual(A.parseStopTap('s:rx-008'), { none: false, prescriptionId: 'rx-008' });
  assert.deepEqual(A.parseStopTap('n:none'), { none: true, prescriptionId: null });
  for (const bad of ['s:', 's:a b', 'd:rx-008:taken_on_time', 'rx-008', null, 7, '']) assert.equal(A.parseStopTap(bad), null);
  assert.ok(Buffer.byteLength(A.stopTapData('rx-008')) <= 64);
  assert.throws(() => A.stopTapData('not an id!'));
});

test('ran_out writes nothing (a refill is the patient’s own request in the app)', () => {
  const d = A.decide(patient({ sentAt: at('07:30'), classification: said('ran_out') }));
  assert.equal(d.outcome, 'ran_out');
  assert.deepEqual(d.writes, []);
});

test('TC-AD-12: "it ran out" with two open doses of the SAME prescription -> picks one, never asks (naming a specific dose does not matter for ran_out)', () => {
  const doses = [
    dose('rx-009-20260924-1300', 'rx-009', '13:00', OPEN),
    dose('rx-009-20260924-2100', 'rx-009', '21:00', OPEN),
  ];
  const d = A.decide(patient({ doses, sentAt: at('22:00'), classification: said('ran_out') }));
  assert.equal(d.outcome, 'ran_out');
  assert.deepEqual(d.writes, []);
  assert.match(d.reply, /Calcium carbonate/);
});

test('TC-AD-12: "it ran out" with open doses across TWO prescriptions -> ask, never guess which medicine (the prescription-level guard candidateDoses/decide relies on)', () => {
  const d = A.decide(patient({ sentAt: at('22:00'), classification: said('ran_out', 0.95, 'خلص الدوا') }));
  assert.equal(d.outcome, 'ask_which');
  assert.deepEqual(d.writes, []);
  assert.equal(d.reply, A.REPLIES.ar.unclear);
  assert.deepEqual(d.askDoses, []);
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

// -------------------------------------------------------------------------------------------
// AP-05 step 2 - TC-AD-12 (after midnight): a reply between 00:00 and 02:59 Kuwait also reads the
// PREVIOUS day's open doses. readDates is pure; decide() itself just needs the merged doses array
// (each dose's own scheduledAt is an absolute instant, so it sorts and filters correctly either way).
test('readDates: [previous, today] between 00:00 and 02:59 Kuwait; [today] alone from 03:00 on', () => {
  assert.deepEqual(A.readDates(at('00:40')), ['2026-09-23', '2026-09-24']);
  assert.deepEqual(A.readDates(at('02:59')), ['2026-09-23', '2026-09-24']);
  assert.deepEqual(A.readDates(at('03:00')), ['2026-09-24']);
  assert.deepEqual(A.readDates(at('23:59')), ['2026-09-24']);
  assert.equal(A.readDates('not a date').length, 0);
});

test('TC-AD-12 (after midnight): 00:40 with only yesterday’s 21:00 open -> that dose, marked as such', () => {
  const doses = [yDose('rx-009-y-2100', 'rx-009', '21:00', OPEN)];
  const d = A.decide(patient({ doses, sentAt: at('00:40'), classification: said(ON_TIME) }));
  assert.equal(d.outcome, 'record');
  assert.equal(d.writes[0].doseId, 'rx-009-y-2100');
  const c = A.buildCheckIn({ patientId: 'pt-03', chatId: 'c-1', language: 'ar', doses, referenceDate: '2026-09-24' });
  assert.match(c.messages[1].text, /^أمس 21:00/);
});

test('TC-AD-12 (after midnight): two open doses across both days -> ask which, never the wrong day; each button message marks yesterday’s dose', () => {
  const doses = [yDose('rx-009-y-2100', 'rx-009', '21:00', OPEN), dose('rx-008-20260924-0700', 'rx-008', '07:00', OPEN)];
  // 07:00 is not yet due at 00:40, so only the 1-hour early grace window matters; use 08:00 so both are due.
  const d = A.decide(patient({ doses, sentAt: at('08:00'), classification: said(ON_TIME) }));
  assert.equal(d.outcome, 'ask_which');
  assert.deepEqual(d.askDoses.map((x) => x.id), ['rx-009-y-2100', 'rx-008-20260924-0700']);
  const c = A.buildCheckIn({ patientId: 'pt-03', chatId: 'c-1', language: 'ar', doses: d.askDoses, referenceDate: '2026-09-24' });
  assert.match(c.messages[1].text, /^أمس 21:00/);
  assert.doesNotMatch(c.messages[2].text, /^أمس/);
});

test('TC-AD-12: 03:00 reads today only - readDates asks for no previous-day fetch at that hour, so ROUTE hands decide() only today’s doses, and a dose only open yesterday is correctly not a candidate', () => {
  assert.deepEqual(A.readDates(at('03:00')), ['2026-09-24']);
  // The merge is ROUTE's job (agents/scripts/build.js), proven end to end in agents/scripts/check.js;
  // simulated here with exactly what ROUTE would fetch at 03:00 - today's doses only, none of them
  // due yet. Contrast with the 00:40 test above, where the SAME dose (only open yesterday) is
  // reached because ROUTE also fetched the previous day.
  const d = A.decide(patient({ doses: DAY(), sentAt: at('03:00'), classification: said(ON_TIME) }));
  assert.equal(d.outcome, 'no_dose');
});

// -------------------------------------------------------------------------------------------
// AP-05 step 4 - CR-092: tracking off.
test('TC-AD-09 (CR-092): trackingOn false and nothing open -> "check-ins are not switched on", no write; trackingOn absent -> today’s no-dose reply', () => {
  const off = A.decide(patient({ doses: [], sentAt: at('12:00'), classification: said(ON_TIME), trackingOn: false }));
  assert.equal(off.outcome, 'tracking_off');
  assert.deepEqual(off.writes, []);
  assert.match(off.reply, /متابعة الجرعات/);
  const absent = A.decide(patient({ doses: [], sentAt: at('12:00'), classification: said(ON_TIME) }));
  assert.equal(absent.outcome, 'no_dose');
  const on = A.decide(patient({ doses: [], sentAt: at('12:00'), classification: said(ON_TIME), trackingOn: true }));
  assert.equal(on.outcome, 'no_dose');
});

// -------------------------------------------------------------------------------------------
// AP-05 step 5 - rule 3/4 invariants.
test('TC-AD-11 (rule 3): a tracked:false dose is never a candidate or a tap target and is never written', () => {
  const untracked = dose('rx-009-20260924-1300', 'rx-009', '13:00', OPEN, { tracked: false });
  // The backend never RETURNS an untracked dose to the agent in the first place (CR-062,
  // docs/API-SURFACE.md: "an untracked dose is never returned"), and the database refuses a
  // status on one regardless of what any caller sends (dose_untracked_has_no_status,
  // supabase/migrations/0004_constraints_and_triggers.sql:194, surfaced as 409 untracked_dose by
  // lib/agent/handlers.ts:33). This test proves the DEFENCE IN DEPTH on top of that: even handed
  // the tracked:false dose directly (never trusting the backend contract alone), candidateDoses
  // and the tap lookup both refuse it - on the `tracked` field itself, never the status word
  // (rule 3 as written: "the pill's absence keys off Dose.tracked, never off the status word").
  const doses = [untracked];
  const typed = A.decide(patient({ doses, sentAt: at('13:05'), classification: said(ON_TIME) }));
  assert.equal(typed.outcome, 'no_dose');
  assert.deepEqual(typed.writes, []);
  const tapped = A.decide(patient({ doses, sentAt: at('13:05'), tap: A.parseTap('d:rx-009-20260924-1300:taken_on_time') }));
  assert.equal(tapped.outcome, 'no_dose');
  assert.deepEqual(tapped.writes, []);
});

test('TC-AD-10 (rule 4): no reply -> nothing recorded; the check-in only sends', () => {
  const c = A.buildCheckIn({ patientId: 'pt-03', chatId: 'c-1', language: 'ar', doses: DAY() });
  assert.equal(c.skipped, false);
  for (const m of c.messages) assert.equal(Object.prototype.hasOwnProperty.call(m, 'status'), false);
  // buildCheckIn never calls a write - it only shapes messages; nothing here can record anything.
  assert.ok(!/decide|dose_status|recompute/.test(A.buildCheckIn.toString()));
});

test('AP-17: no em dash (U+2014) anywhere in the module', () => {
  const src = require('node:fs').readFileSync(require.resolve('../lib/adherence.js'), 'utf8');
  assert.doesNotMatch(src, /—/);
});

// -------------------------------------------------------------------------------------------
// AP-05 step 3a - the pure plan/skip helper the daily check-in's log node reuses (TC-AD-08).
test('TC-AD-08 (the plan-time half): no chat id, or not due today (every_other_day parity), are named skips, never a chat id; a real row survives. The other two skip reasons (nothing open, a refused doses fetch) need the daily workflow\'s own fetch and are proved in agents/scripts/check.js.', () => {
  const eligibility = [
    { patientId: 'pt-01', chatId: null, language: 'ar', frequency: 'daily' },
    { patientId: 'pt-02', chatId: 'c-2', language: 'ar', frequency: 'every_other_day' },
    { patientId: 'pt-03', chatId: 'c-3', language: 'ar', frequency: 'daily' },
    {},
  ];
  const even = A.planCheckIns({ eligibility, dayIndex: 10 });
  assert.deepEqual(even.skipped, [{ patientId: 'pt-01', reason: 'no_chat_id' }]);
  assert.deepEqual(even.plans.map((p) => p.patientId), ['pt-02', 'pt-03']);
  const odd = A.planCheckIns({ eligibility, dayIndex: 11 });
  assert.deepEqual(odd.skipped, [{ patientId: 'pt-01', reason: 'no_chat_id' }, { patientId: 'pt-02', reason: 'not_due_today' }]);
  assert.deepEqual(odd.plans.map((p) => p.patientId), ['pt-03']);
  assert.deepEqual(A.planCheckIns({ eligibility: [], dayIndex: 1 }), { plans: [], skipped: [] });
});
