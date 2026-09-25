'use strict';

/**
 * agents/lib/voice-actions.js - CR-070 free talk and CR-108 recording by voice (read-back, "yes",
 * fresh re-check against the schedule at write time). Fixtures: pt-03's three tracked doses on
 * 2026-09-24 (07:00 Eltroxin, 13:00 and 21:00 Calcium + D3). Only `writeFor` (and `confirmRecord`,
 * which calls it) ever builds a write; everything else only decides words and button choices.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../lib/voice-actions.js');
const { spokenTime } = require('../lib/voice.js');

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

test('CR-108: "mark it taken" names no dose - a single due-now item, not a refusal; two status-only items collapse to none; a named item wins over a due-now guess', () => {
  assert.deepEqual(A.trustFreeTalk({ intent: 'record', confidence: 0.95, items: [] }), { kind: 'record', items: [] });
  assert.deepEqual(A.trustFreeTalk({ intent: 'record', confidence: 0.95, items: [{ status: W_MISS }] }),
    { kind: 'record', items: [A.dueNowItem(W_MISS)] });
  assert.deepEqual(A.trustFreeTalk({ intent: 'record', confidence: 0.95, items: [{ status: W_ON }, { status: W_MISS }] }), { kind: 'record', items: [] });
  assert.deepEqual(A.trustFreeTalk({ intent: 'record', confidence: 0.95, items: [{ medicine: 'my medicine', status: W_ON }] }),
    { kind: 'record', items: [A.dueNowItem(W_ON)] });
  const mixed = A.trustFreeTalk({ intent: 'record', confidence: 0.95, items: [{ medicine: 'Eltroxin', status: W_ON }, { status: W_MISS }] });
  assert.deepEqual(mixed.items, [{ position: null, time: null, medicine: 'Eltroxin', status: W_ON }]);
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

test('CR-108 resolveItem, dueNow: ambiguous with two due; a recorded dose drops out; within-the-hour still resolves; a miss cannot be due before its own time; no clock at all -> notFound', () => {
  assert.equal(A.resolveItem(A.dueNowItem(W_ON), DAY(), at('13:30')).reason, 'ambiguous'); // 07:00 and 13:00 both open and due
  const morningDone = DAY(); morningDone[1] = dose('rx-008-0924-0700', 'rx-008', '07:00', W_ON);
  assert.equal(A.resolveItem(A.dueNowItem(W_ON), morningDone, at('13:30')).dose.id, 'rx-009-0924-1300');
  assert.equal(A.resolveItem(A.dueNowItem(W_ON), DAY(), at('06:00')).dose.id, 'rx-008-0924-0700'); // within the hour
  assert.equal(A.resolveItem(A.dueNowItem(W_MISS), DAY(), at('06:30')).reason, 'nothingDue'); // not missed before 07:00
  assert.equal(A.resolveItem(A.dueNowItem(W_ON), DAY()).reason, 'notFound');
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

test('fallback (AP-02): no dose named, or none that resolves ("mark it taken") -> every open dose that is due', () => {
  assert.deepEqual(prompt([], '13:30'), ['rx-008-0924-0700', 'rx-009-0924-1300']);
  assert.deepEqual(prompt([{ medicine: 'aspirin', status: W_ON }], '13:30'), ['rx-008-0924-0700', 'rx-009-0924-1300']);
  assert.deepEqual(prompt([{ medicine: 'calcium', status: W_ON }], '22:00'), ['rx-008-0924-0700', 'rx-009-0924-1300', 'rx-009-0924-2100']); // ambiguous
  assert.deepEqual(prompt([], '06:00'), ['rx-008-0924-0700']); // within the hour
  assert.deepEqual(prompt([], '05:00'), []);
  assert.deepEqual(A.recordPromptDoses({ items: [], doses: null, nowIso: at('09:00') }), []);
});

test('CR-108 recordTurn: no items and doses open -> unsure + every due dose\'s id, session ends (the AP-02 fallback); no chat -> noChat + askMore, session stays open; nothing open -> nothingOpen + askMore; doses unreachable -> unreachable, session ends', () => {
  const unsure = A.recordTurn({ items: [], doses: DAY(), nowIso: at('13:30'), language: 'en', hasChat: true, spokenTime });
  assert.equal(unsure.speech, A.ACT.en.unsure);
  assert.equal(unsure.endSession, true);
  assert.deepEqual(ids(unsure.promptDoses), ['rx-008-0924-0700', 'rx-009-0924-1300']);
  assert.deepEqual(unsure.pending, []);
  const noChat = A.recordTurn({ items: [], doses: DAY(), nowIso: at('13:30'), language: 'en', hasChat: false, spokenTime });
  assert.equal(noChat.speech, A.ACT.en.noChat + A.ACT.en.askMore);
  assert.equal(noChat.endSession, false);
  const nothingOpen = A.recordTurn({ items: [], doses: DAY().map((d) => dose(d.id, d.prescriptionId, d.scheduledAt.slice(11, 16), W_ON)), nowIso: at('05:00'), language: 'en', hasChat: true, spokenTime });
  assert.equal(nothingOpen.speech, A.ACT.en.nothingOpen + A.ACT.en.askMore);
  const down = A.recordTurn({ items: [{ status: W_ON }], doses: null, language: 'ar', hasChat: true, nowIso: at('09:00'), spokenTime });
  assert.equal(down.speech, A.ACT.ar.unreachable);
  assert.equal(down.endSession, true);
});

test('CR-108 planRecord/recordTurn: the read-back names every resolved dose and asks yes/no; unresolved items are named and skipped; a miss cannot be read back before its own time', () => {
  const items = [{ position: 1, status: W_ON }, { position: 2, status: W_ON }, { time: '21:00', status: W_MISS }];
  const readBack = A.recordTurn({ items, doses: DAY(), nowIso: at('22:00'), language: 'en', hasChat: true, spokenTime });
  assert.equal(readBack.speech,
    'I will record: Eltroxin at 7 in the morning taken, Calcium carbonate + vitamin D3 at 1 in the afternoon taken, '
    + 'Calcium carbonate + vitamin D3 at 9 in the evening missed. Shall I? Say yes, or no.');
  assert.deepEqual(readBack.pending, [
    { doseId: 'rx-008-0924-0700', prescriptionId: 'rx-008', status: W_ON },
    { doseId: 'rx-009-0924-1300', prescriptionId: 'rx-009', status: W_ON },
    { doseId: 'rx-009-0924-2100', prescriptionId: 'rx-009', status: W_MISS },
  ]);
  assert.equal(readBack.endSession, false);
  assert.deepEqual(readBack.promptDoses, []);
  const ar = A.recordTurn({ items: [{ position: 1, status: W_ON }], doses: DAY(), nowIso: at('22:00'), language: 'ar', hasChat: true, spokenTime });
  assert.ok(ar.speech.startsWith('بسجّل: Eltroxin الساعة 7 الصبح أخذتها'));
  assert.ok(ar.speech.endsWith('تأكد؟ قول نعم، أو لا.'));
  // Too early at 09:00: only the 07:00 dose is due; the other two are named and refused, not silently dropped.
  const early = A.recordTurn({ items, doses: DAY(), nowIso: at('09:00'), language: 'en', hasChat: true, spokenTime });
  assert.ok(early.speech.startsWith('I will record: Eltroxin at 7 in the morning taken.'));
  assert.match(early.speech, /not due yet/);
  assert.deepEqual(early.pending, [{ doseId: 'rx-008-0924-0700', prescriptionId: 'rx-008', status: W_ON }]);
  // A miss named for a dose whose time has not yet come: refused, however early-grace normally allows a "taken".
  const missEarly = A.recordTurn({ items: [{ time: '13:00', status: W_MISS }], doses: DAY(), nowIso: at('12:30'), language: 'en', hasChat: true, spokenTime });
  assert.equal(missEarly.speech, 'I could not record anything: Calcium carbonate + vitamin D3 at 1 in the afternoon - not due yet. Anything else?');
  assert.deepEqual(missEarly.pending, []);
});

test('CR-108 confirmRecord: re-checks against FRESH doses - recorded since, no longer due, a foreign prescriptionId, or a not-due miss is skipped; only what survives is written, exactly the Telegram path\'s own bodies', () => {
  const pending = [
    { doseId: 'rx-008-0924-0700', prescriptionId: 'rx-008', status: W_ON }, // fine
    { doseId: 'rx-009-0924-1300', prescriptionId: 'rx-009', status: W_MISS }, // fine: a miss, its time has come
    { doseId: 'rx-009-0924-2100', prescriptionId: 'wrong-rx', status: W_ON }, // tampered prescriptionId
    { doseId: 'no-such-dose', prescriptionId: 'rx-008', status: W_ON }, // not in the fresh doses at all
  ];
  const { writes, skipped } = A.confirmRecord({ pending, doses: DAY(), nowIso: at('22:00'), api: 'https://x/api/agent', recordedAtIso: '2026-09-24T19:00:00Z' });
  assert.equal(writes.length, 2);
  assert.deepEqual(skipped, ['rx-009-0924-2100', 'no-such-dose']);
  assert.equal(writes[0].url, 'https://x/api/agent/doses/rx-008-0924-0700/status');
  assert.deepEqual(writes[0].body, { status: W_ON, recordedAt: '2026-09-24T19:00:00Z', source: 'adherence_agent' });
  assert.equal(writes[0].recompute, null);
  assert.equal(writes[1].status, W_MISS);
  assert.deepEqual(writes[1].recompute.body, { prescriptionId: 'rx-009', reason: 'reported_miss', missedDoseId: 'rx-009-0924-1300' });
  // A dose recorded since the read-back, or no longer due: skipped, never written.
  const staleDoses = DAY(); staleDoses[1] = dose('rx-008-0924-0700', 'rx-008', '07:00', W_ON);
  const recordedSince = A.confirmRecord({ pending: [pending[0]], doses: staleDoses, nowIso: at('22:00'), api: 'https://x/api/agent', recordedAtIso: at('22:00') });
  assert.deepEqual(recordedSince.writes, []);
  assert.deepEqual(recordedSince.skipped, ['rx-008-0924-0700']);
  // doses null (the backend failed at write time): nothing written, everything skipped.
  const down = A.confirmRecord({ pending, doses: null, nowIso: at('22:00'), api: 'https://x/api/agent', recordedAtIso: at('22:00') });
  assert.deepEqual(down.writes, []);
  assert.equal(down.skipped.length, 4);
});

test('CR-108 confirmedReply: only a 200 reads as recorded; anything else (409, 500, a thrown error/undefined) is grouped as failed, never "Done"; hasChat gates the Telegram clause and the correction prompt', () => {
  const okOnly = A.confirmedReply({
    writes: [{ doseId: 'rx-008-0924-0700', status: W_ON }], codes: [200], doses: DAY(), language: 'en', hasChat: true, spokenTime,
  });
  assert.equal(okOnly.speech, 'Done. I recorded: Eltroxin at 7 in the morning taken. I sent it to your Telegram. Anything else?');
  assert.deepEqual(okOnly.promptDoses, []);
  for (const codes of [[409], [undefined]]) {
    const bad = A.confirmedReply({ writes: [{ doseId: 'rx-008-0924-0700', status: W_ON }], codes, doses: DAY(), language: 'en', hasChat: true, spokenTime });
    assert.doesNotMatch(bad.speech, /Done/);
    assert.match(bad.speech, /^I could not record: /);
    assert.match(bad.speech, /sent its buttons to your Telegram/);
    assert.deepEqual(ids(bad.promptDoses), ['rx-008-0924-0700']);
  }
  const mixed = A.confirmedReply({
    writes: [{ doseId: 'rx-008-0924-0700', status: W_ON }, { doseId: 'rx-009-0924-1300', status: W_MISS }], codes: [200, 500], doses: DAY(), language: 'en', hasChat: true, spokenTime,
  });
  assert.match(mixed.speech, /^Done\. I recorded: Eltroxin at 7 in the morning taken\. I sent it to your Telegram\./);
  assert.match(mixed.speech, /I could not record: Calcium carbonate \+ vitamin D3 at 1 in the afternoon missed\. I sent its buttons to your Telegram/);
  const noChat = A.confirmedReply({ writes: [{ doseId: 'rx-008-0924-0700', status: W_ON }], codes: [200], doses: DAY(), language: 'en', hasChat: false, spokenTime });
  assert.doesNotMatch(noChat.speech, /Telegram/);
  assert.deepEqual(noChat.promptDoses, []);
  assert.equal(A.confirmedReply({ writes: [], codes: [], doses: DAY(), language: 'en', hasChat: true, spokenTime }).speech, A.ACT.en.stale + A.ACT.en.askMore);
  assert.equal(A.confirmedReply({ writes: [], codes: [], doses: null, language: 'en', hasChat: true, spokenTime }).speech, A.ACT.en.unreachable);
});

test('CR-108: writeFor builds exactly the Telegram path\'s two URLs and bodies; a miss carries the recompute, anything else does not; `status` is always a variable, never a literal, in the source', () => {
  const d = dose('rx-008-0924-0700', 'rx-008', '07:00');
  const w = A.writeFor(d, W_MISS, 'https://x/api/agent', '2026-09-24T09:00:00Z');
  assert.equal(w.url, 'https://x/api/agent/doses/rx-008-0924-0700/status');
  assert.deepEqual(w.body, { status: W_MISS, recordedAt: '2026-09-24T09:00:00Z', source: 'adherence_agent' });
  assert.deepEqual(w.recompute, { url: 'https://x/api/agent/schedule/recompute', body: { prescriptionId: 'rx-008', reason: 'reported_miss', missedDoseId: 'rx-008-0924-0700' } });
  assert.equal(A.writeFor(d, W_ON, 'https://x/api/agent', '2026-09-24T09:00:00Z').recompute, null);
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'voice-actions.js'), 'utf8');
  assert.doesNotMatch(src, /VOICE_RECORDS/);
  assert.doesNotMatch(src, /\bhelpers\.httpRequest|\bfetch\s*\(/);
});

test('cleanPending: drops non-objects, bad id characters and an unknown status; keeps at most the first 10 raw entries', () => {
  const valid = Array.from({ length: 12 }, (_, i) => ({ doseId: 'rx-' + i, prescriptionId: 'rx-' + i, status: W_ON }));
  const capped = A.cleanPending(valid);
  assert.equal(capped.length, 10);
  assert.deepEqual(capped[0], valid[0]);
  assert.deepEqual(capped[9], valid[9]);
  const raw = [
    { doseId: 'rx-1', prescriptionId: 'rx-1', status: W_ON },
    null, 'nope', 42,
    { doseId: 'bad id!', prescriptionId: 'rx-1', status: W_ON },
    { doseId: 'rx-1', prescriptionId: 'rx-1', status: 'raise_dose' },
  ];
  assert.deepEqual(A.cleanPending(raw), [{ doseId: 'rx-1', prescriptionId: 'rx-1', status: W_ON }]);
  assert.deepEqual(A.cleanPending(null), []);
  assert.deepEqual(A.cleanPending('not an array'), []);
});

test('the voice copy has no em dash, and each language speaks only its own', () => {
  const flat = (obj, out = []) => { for (const v of Object.values(obj)) (typeof v === 'object' && v !== null) ? flat(v, out) : out.push(v); return out; };
  for (const [lang, lines] of Object.entries(A.ACT)) {
    for (const v of flat(lines)) {
      assert.ok(!v.includes(String.fromCharCode(0x2014)), lang + ' has an em dash: ' + v);
      if (lang === 'en') assert.doesNotMatch(v, /[؀-ۿ]/, 'en: ' + v);
      else assert.doesNotMatch(v.replace(/[؀-ۿ]/g, ''), /[A-Za-z]/, 'ar: ' + v);
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

test('CR-108: a plain "I forgot ..." sentence is answered in code, no model - ForgotDoseIntent; a sentence that names a dose, or is not this plain, still goes to the model', () => {
  for (const t of ['forgot my dose', 'I forgot my medicine', 'missed my pill', 'forgot to take my medicine', 'I did not take my medicine']) {
    assert.equal(A.quickFreeTalk(t), 'ForgotDoseIntent', t);
  }
  for (const t of ['i forgot the evening one', 'did not take it today', 'i forgot my eltroxin']) assert.equal(A.quickFreeTalk(t), null, t);
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
