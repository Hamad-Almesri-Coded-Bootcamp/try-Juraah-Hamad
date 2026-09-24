'use strict';

/**
 * agents/lib/voice-actions.js - free talk (CR-070) and the record request that records nothing
 * (CR-073, AP-02). Fixtures: pt-03's three tracked doses on 2026-09-24 (07:00 Eltroxin, 13:00 and
 * 21:00 Calcium + D3). The model only names doses; which buttons go to Telegram and every word
 * Alexa says are decided here and tested here. Nothing here can produce a write.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../lib/voice-actions.js');

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
const ids = (doses) => doses.map((d) => d.id);
const prompt = (items, nowHHMM, doses = DAY()) => ids(A.recordPromptDoses({ items, doses, nowIso: at(nowHHMM) }));
const reply = (over) => A.recordReply({ items: [], doses: DAY(), nowIso: at('22:00'), language: 'en', hasChat: true, ...over });

const EN_SENT = 'I can\'t record by voice; I\'ve sent the buttons to your Telegram. Please confirm there yourself.';
const AR_SENT = 'ما أقدر أسجّل بالصوت، أرسلت لك الأزرار في تيليقرام. أكّد منها بنفسك.';

test('trustFreeTalk: only a listed intent above 0.7; record keeps only well-formed items', () => {
  assert.deepEqual(A.trustFreeTalk({ intent: 'today', confidence: 0.9 }), { kind: 'TodayDosesIntent', items: [] });
  assert.deepEqual(A.trustFreeTalk({ intent: 'today', confidence: 0.5 }), { kind: 'AMAZON.FallbackIntent', items: [] });
  assert.deepEqual(A.trustFreeTalk({ intent: 'record', confidence: 0.5, items: [{ position: 1, status: W_ON }] }), { kind: 'AMAZON.FallbackIntent', items: [] });
  const r = A.trustFreeTalk({ intent: 'record', confidence: 0.95, items: [
    { position: 1, status: W_ON }, { position: 2, status: 'raise_dose' }, { position: 99, status: W_MISS }, { time: '21:00', status: W_MISS }, {},
  ] });
  assert.equal(r.kind, 'record');
  assert.deepEqual(r.items, [{ position: 1, time: null, medicine: null, status: W_ON }, { position: null, time: '21:00', medicine: null, status: W_MISS }]);
  // Items only ever come with a record request.
  assert.deepEqual(A.trustFreeTalk({ intent: 'today', confidence: 0.9, items: [{ position: 1, status: W_ON }] }).items, []);
});

test('AP-02: "mark it taken" names no dose and is still a record request (nothing is written from it)', () => {
  assert.deepEqual(A.trustFreeTalk({ intent: 'record', confidence: 0.95, items: [] }), { kind: 'record', items: [] });
  assert.deepEqual(A.trustFreeTalk({ intent: 'record', confidence: 0.95, items: [{ status: W_MISS }] }), { kind: 'record', items: [] });
});

test('AP-02: the model gave no usable answer -> a sentence that says what the patient did is a record request; anything else is unclear', () => {
  for (const c of [null, {}, { error: '429' }, { intent: 'delete_everything', confidence: 1 }]) {
    assert.deepEqual(A.trustFreeTalk(c, 'it taken'), { kind: 'record', items: [] }, JSON.stringify(c));
    assert.deepEqual(A.trustFreeTalk(c, 'I missed the evening one'), { kind: 'record', items: [] });
    assert.deepEqual(A.trustFreeTalk(c, 'what is the weather'), { kind: 'AMAZON.FallbackIntent', items: [] });
    assert.deepEqual(A.trustFreeTalk(c), { kind: 'AMAZON.FallbackIntent', items: [] });
  }
  // A model that answered, even "unclear", is believed: the fallback is for an outage only.
  assert.deepEqual(A.trustFreeTalk({ intent: 'unclear', confidence: 0.9 }, 'I took it'), { kind: 'AMAZON.FallbackIntent', items: [] });
});

test('resolveItem: position counts today in time order; by time; by name; "my calcium" picks the open one, else ambiguous', () => {
  assert.equal(A.resolveItem({ position: 1 }, DAY()).dose.id, 'rx-008-0924-0700');
  assert.equal(A.resolveItem({ position: 3 }, DAY()).dose.id, 'rx-009-0924-2100');
  assert.equal(A.resolveItem({ position: 4 }, DAY()).reason, 'notFound');
  assert.equal(A.resolveItem({ time: '13:00' }, DAY()).dose.id, 'rx-009-0924-1300');
  assert.equal(A.resolveItem({ medicine: 'eltroxin' }, DAY()).dose.id, 'rx-008-0924-0700');
  assert.equal(A.resolveItem({ medicine: 'calcium' }, DAY()).reason, 'ambiguous');
  const doneMorning = DAY(); doneMorning[2] = dose('rx-009-0924-1300', 'rx-009', '13:00', W_ON);
  assert.equal(A.resolveItem({ medicine: 'calcium' }, doneMorning).dose.id, 'rx-009-0924-2100');
  assert.equal(A.resolveItem({ medicine: 'aspirin' }, DAY()).reason, 'notFound');
});

test('AP-02 TC-AD-15: "I took the first two and missed the third" at 22:00 -> the buttons of those three doses, in time order', () => {
  assert.deepEqual(prompt([{ position: 1, status: W_ON }, { position: 2, status: W_ON }, { position: 3, status: W_MISS }], '22:00'),
    ['rx-008-0924-0700', 'rx-009-0924-1300', 'rx-009-0924-2100']);
});

test('AP-02: the buttons are only for doses still open and due (up to an hour ahead); a named dose that is neither gets none', () => {
  // 09:00: the 13:00 and 21:00 doses are not due, so only the first one's buttons go.
  assert.deepEqual(prompt([{ position: 1, status: W_ON }, { position: 2, status: W_ON }, { position: 3, status: W_MISS }], '09:00'), ['rx-008-0924-0700']);
  assert.deepEqual(prompt([{ time: '13:00', status: W_ON }], '12:10'), ['rx-009-0924-1300']);
  // Named, but not due: nothing, and never some other dose instead.
  assert.deepEqual(prompt([{ time: '21:00', status: W_ON }], '09:00'), []);
  // Named, but already recorded: nothing.
  const done = DAY(); done[1] = dose('rx-008-0924-0700', 'rx-008', '07:00', W_LATE);
  assert.deepEqual(prompt([{ medicine: 'eltroxin', status: W_ON }], '09:00', done), []);
});

test('AP-02: no dose named, or none that resolves ("mark it taken") -> every open dose that is due', () => {
  assert.deepEqual(prompt([], '13:30'), ['rx-008-0924-0700', 'rx-009-0924-1300']);
  assert.deepEqual(prompt([{ medicine: 'aspirin', status: W_ON }], '13:30'), ['rx-008-0924-0700', 'rx-009-0924-1300']);
  assert.deepEqual(prompt([{ medicine: 'calcium', status: W_ON }], '22:00'), ['rx-008-0924-0700', 'rx-009-0924-1300', 'rx-009-0924-2100']); // ambiguous
  assert.deepEqual(prompt([], '06:00'), ['rx-008-0924-0700']); // within the hour
  assert.deepEqual(prompt([], '05:00'), []);
  assert.deepEqual(A.recordPromptDoses({ items: [], doses: null, nowIso: at('09:00') }), []);
});

test('AP-02 TC-AD-15: a record request -> the fixed line "I can\'t record by voice; I\'ve sent the buttons to your Telegram", in English and in Arabic', () => {
  const en = reply({});
  assert.equal(en.speech, EN_SENT);
  assert.equal(en.endSession, true);
  assert.deepEqual(ids(en.promptDoses), ['rx-008-0924-0700', 'rx-009-0924-1300', 'rx-009-0924-2100']);
  const ar = reply({ language: 'ar' });
  assert.equal(ar.speech, AR_SENT);
  assert.deepEqual(ids(ar.promptDoses), ids(en.promptDoses));
});

test('AP-02: no Telegram linked, nothing open and due, or the schedule unreachable -> it says so and nothing is sent', () => {
  const noChat = reply({ hasChat: false });
  assert.match(noChat.speech, /^I can't record by voice, and your Telegram is not linked/);
  assert.deepEqual(noChat.promptDoses, []);
  assert.match(reply({ hasChat: false, language: 'ar' }).speech, /^ما أقدر أسجّل بالصوت، وتيليقرام مو مربوط عندك/);
  const early = reply({ nowIso: at('05:00') });
  assert.match(early.speech, /^I can't record by voice, and there is no open dose due now, so I sent nothing to your Telegram\. Anything else\?$/);
  assert.equal(early.endSession, false);
  assert.deepEqual(early.promptDoses, []);
  const down = reply({ doses: null, language: 'ar' });
  assert.match(down.speech, /^ما أقدر أسجّل بالصوت، وما قدرت أوصل لجدولك/);
  assert.deepEqual(down.promptDoses, []);
});

test('AP-02 TC-AD-14: the reply carries no write - only words and which doses get buttons in the patient\'s own chat', () => {
  for (const r of [reply({}), reply({ hasChat: false }), reply({ doses: null }), reply({ nowIso: at('05:00') })]) {
    assert.deepEqual(Object.keys(r).sort(), ['endSession', 'promptDoses', 'speech']);
  }
});

test('AP-02: the CR-070 write path is gone from the module - no write function, no route, no switch', () => {
  for (const gone of ['planRecord', 'confirmRecord', 'cleanPending', 'recordedSpeech']) assert.equal(A[gone], undefined, gone);
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'voice-actions.js'), 'utf8');
  assert.doesNotMatch(src, /['"`]\/(doses|schedule)\//, 'a /doses/ or /schedule/ URL is built here');
  assert.doesNotMatch(src, /VOICE_RECORDS|adherence_agent|recordedAt/);
});

test('the voice copy has no em dash, and each language speaks only its own', () => {
  for (const [lang, lines] of Object.entries(A.ACT)) {
    for (const [k, v] of Object.entries(lines)) {
      assert.ok(!v.includes(String.fromCharCode(0x2014)), lang + '.' + k + ' has an em dash');
      if (lang === 'en') assert.doesNotMatch(v, /[؀-ۿ]/, 'en.' + k);
      else assert.doesNotMatch(v.replace(/[؀-ۿ]/g, ''), /[A-Za-z]/, 'ar.' + k);
    }
  }
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

test('"what are my medicines today" and its variants -> today\'s schedule, in code (no model), whole or with the carrier "what" stripped', () => {
  const asked = [
    'what are my medicines today', 'are my medicines today', 'What are my medicines today?',
    'what medicines do I take today', 'medicines do I take today',
    'what are my meds today', 'are my meds today',
    'which medicines today', 'check my medicines for today', 'my medicines for today',
    'شنو أدويتي اليوم', 'وش أدويتي اليوم', 'شنو ادويتي اليوم؟', 'وش ادويتي اليوم',
  ];
  for (const t of asked) assert.equal(A.quickFreeTalk(t), 'TodayDosesIntent', t);
});

test('"what are my medicines today" never takes the record path; a record sentence about today still does, and another day is not today', () => {
  // The fast path answers it, so the model's answer is never read for it - even a model that says "record".
  assert.equal(A.quickFreeTalk('what are my medicines today'), 'TodayDosesIntent');
  assert.notEqual(A.trustFreeTalk({ intent: 'today', confidence: 0.9 }, 'what are my medicines today').kind, 'record');
  for (const t of ['i took my medicines today', 'mark my medicines today as taken', 'I missed my meds today']) assert.equal(A.quickFreeTalk(t), null, t);
  for (const t of ['what are my medicines tomorrow', 'my meds for yesterday']) assert.equal(A.quickFreeTalk(t), null, t);
});
