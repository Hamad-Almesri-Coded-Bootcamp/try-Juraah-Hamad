'use strict';

/**
 * agents/lib/voice.js - the Alexa demo channel. Fixtures are the seed's tracked patient pt-03 on
 * 2026-09-24 (the rows GET /api/agent/patients/pt-03/doses returns). CR-108: voice records again,
 * through the workflow's plan node (agents/scripts/build.js) - this file only WORDS the outcome it
 * is handed (`forgot`); voiceReply itself never writes anything.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../lib/voice.js');

const OPEN = ['upcoming'][0];
const TAKEN = ['taken_on_time'][0];
const MISSED = ['missed'][0];
const dose = (id, rx, hhmm, word) => ({
  id, prescriptionId: rx, scheduledAt: '2026-09-24T' + hhmm + ':00+03:00', status: word, recordedAt: null,
  genericName: rx === 'rx-008' ? 'Levothyroxine' : 'Calcium carbonate + vitamin D3', brandName: rx === 'rx-008' ? 'Eltroxin' : null,
  strengthMg: rx === 'rx-008' ? 50 : 500, strengthUnit: rx === 'rx-008' ? 'mcg' : null, dosePerAdministration: 1, timingRelativeToFood: null,
});
const DAY = () => [dose('rx-008-20260924-0700', 'rx-008', '07:00', OPEN), dose('rx-009-20260924-1300', 'rx-009', '13:00', OPEN), dose('rx-009-20260924-2100', 'rx-009', '21:00', OPEN)];
const at = (hhmm) => '2026-09-24T' + hhmm + ':00+03:00';
const SKILL = 'amzn1.ask.skill.test';
const USER = 'amzn1.ask.account.TESTUSER';
const req = (type, intentName, over = {}) => ({
  version: '1.0',
  session: { application: { applicationId: SKILL }, user: { userId: USER } },
  request: { type, locale: 'ar-SA', timestamp: '2026-09-24T09:00:00Z', ...(intentName ? { intent: { name: intentName } } : {}), ...over },
});

test('parse: the right skill, a fresh timestamp and a linked user -> ok, with the patient, and an empty pending list', () => {
  const p = V.parseAlexaRequest({ body: req('IntentRequest', 'NextDoseIntent'), nowIso: '2026-09-24T09:00:30Z', skillId: SKILL, links: { [USER]: 'pt-03' } });
  assert.deepEqual(p, { ok: true, kind: 'NextDoseIntent', language: 'ar', userId: USER, patientId: 'pt-03', utterance: '', pending: [], needsDoses: true });
});

test('CR-108: a "yes" carrying a pending list in the session attributes -> that list (capped at 10), needsDoses true', () => {
  const body = req('IntentRequest', 'AMAZON.YesIntent');
  const raw = Array.from({ length: 12 }, (_, i) => ({ doseId: 'rx-' + i, prescriptionId: 'rx-' + i, status: TAKEN }));
  body.session.attributes = { pending: raw };
  const p = V.parseAlexaRequest({ body, nowIso: '2026-09-24T09:00:30Z', skillId: SKILL, links: { [USER]: 'pt-03' } });
  assert.equal(p.pending.length, 10);
  assert.deepEqual(p.pending[0], raw[0]);
  assert.equal(p.needsDoses, true);
});

test('a bare "yes" (no session attributes) -> an empty pending list, needsDoses false, the help text, screen topic unclear', () => {
  const p = V.parseAlexaRequest({ body: req('IntentRequest', 'AMAZON.YesIntent'), nowIso: '2026-09-24T09:00:30Z', skillId: SKILL, links: { [USER]: 'pt-03' } });
  assert.deepEqual(p.pending, []);
  assert.equal(p.needsDoses, false);
  const r = V.voiceReply({ kind: p.kind, language: 'en', doses: DAY(), nowIso: at('09:00'), hasChat: true });
  assert.match(r.speech, /^Ask me: /);
  assert.deepEqual(r.promptDoses, []);
  assert.equal(V.screenTopic('AMAZON.YesIntent'), 'unclear');
});

test('alexaResponse: sessionAttributes and a reprompt override are written only while the session stays open', () => {
  const open = V.alexaResponse({ speech: 'x', endSession: false, language: 'en', sessionAttributes: { pending: [{ a: 1 }] }, reprompt: 'Shall I? Say yes, or no.' });
  assert.deepEqual(open.sessionAttributes, { pending: [{ a: 1 }] });
  assert.equal(open.response.reprompt.outputSpeech.text, 'Shall I? Say yes, or no.');
  const ended = V.alexaResponse({ speech: 'x', endSession: true, language: 'en', sessionAttributes: { pending: [{ a: 1 }] }, reprompt: 'Shall I? Say yes, or no.' });
  assert.ok(!('sessionAttributes' in ended));
  assert.ok(!('reprompt' in ended.response));
  const noOverride = V.alexaResponse({ speech: 'x', endSession: false, language: 'en' });
  assert.equal(noOverride.response.reprompt.outputSpeech.text, 'What would you like to know about your medicines?');
});

test('parse fails closed: no skill id configured, another skill, a stale or replayed request', () => {
  const now = '2026-09-24T09:00:30Z';
  assert.equal(V.parseAlexaRequest({ body: req('LaunchRequest'), nowIso: now, skillId: '', links: {} }).kind, 'refused');
  const other = req('LaunchRequest'); other.session.application.applicationId = 'amzn1.ask.skill.other';
  assert.equal(V.parseAlexaRequest({ body: other, nowIso: now, skillId: SKILL, links: { [USER]: 'pt-03' } }).kind, 'refused');
  assert.equal(V.parseAlexaRequest({ body: req('LaunchRequest'), nowIso: '2026-09-24T09:05:00Z', skillId: SKILL, links: { [USER]: 'pt-03' } }).kind, 'refused');
  assert.equal(V.parseAlexaRequest({ body: {}, nowIso: now, skillId: SKILL, links: {} }).ok, false);
});

test('parse: an unlinked Alexa user is told so - and its userId is kept for linking', () => {
  const p = V.parseAlexaRequest({ body: req('LaunchRequest'), nowIso: '2026-09-24T09:00:00Z', skillId: SKILL, links: {} });
  assert.equal(p.kind, 'not_linked');
  assert.equal(p.userId, USER);
});

test('parse: en-US requests answer in English', () => {
  assert.equal(V.parseAlexaRequest({ body: req('LaunchRequest', null, { locale: 'en-US' }), nowIso: '2026-09-24T09:00:00Z', skillId: SKILL, links: { [USER]: 'pt-03' } }).language, 'en');
});

test('next dose: the first OPEN dose after now, with its time and the amount as prescribed', () => {
  const r = V.voiceReply({ kind: 'NextDoseIntent', language: 'ar', doses: DAY(), nowIso: at('09:00'), hasChat: true });
  assert.match(r.speech, /جرعتك الجاية Calcium carbonate \+ vitamin D3 الساعة 1 الظهر/);
  assert.match(r.speech, /الكمية 1، تركيز 500 مليغرام/);
  assert.equal(r.endSession, false);
  assert.deepEqual(r.promptDoses, []);
});

test('how much: the dose due now (up to an hour early), read as prescribed - micrograms stay micrograms', () => {
  const r = V.voiceReply({ kind: 'DoseAmountIntent', language: 'ar', doses: DAY(), nowIso: at('06:30'), hasChat: true });
  assert.match(r.speech, /^حسب وصفتك، Eltroxin الساعة 7 الصبح: الكمية 1، تركيز 50 مايكروغرام/);
});

test('today: every tracked dose in time order with its state', () => {
  const doses = DAY(); doses[0] = dose('rx-008-20260924-0700', 'rx-008', '07:00', TAKEN);
  const r = V.voiceReply({ kind: 'TodayDosesIntent', language: 'ar', doses, nowIso: at('09:00'), hasChat: true });
  assert.match(r.speech, /^عندك اليوم 3 جرعات: الساعة 7 الصبح Eltroxin، أخذتها\. الساعة 1 الظهر .*باقية\. الساعة 9 بالليل .*باقية\./);
});

test('today in English: an English comma, never the Arabic one', () => {
  const doses = DAY(); doses[0] = dose('rx-008-20260924-0700', 'rx-008', '07:00', TAKEN);
  const r = V.voiceReply({ kind: 'TodayDosesIntent', language: 'en', doses, nowIso: at('09:00'), hasChat: true });
  assert.match(r.speech, /^Today you have 3 doses: 7 in the morning Eltroxin, taken\. /);
  assert.doesNotMatch(r.speech, /،/);
});

test('CR-108 forgotTarget: the most recent passed, still-open dose; a recorded dose is skipped; none passed, or doses unreachable -> null; it is exactly the dose voiceReply names', () => {
  assert.equal(V.forgotTarget({ doses: DAY(), nowIso: at('09:00') }).id, 'rx-008-20260924-0700');
  assert.equal(V.forgotTarget({ doses: DAY(), nowIso: at('14:00') }).id, 'rx-009-20260924-1300');
  assert.equal(V.forgotTarget({ doses: DAY(), nowIso: at('06:00') }), null);
  assert.equal(V.forgotTarget({ doses: null, nowIso: at('09:00') }), null);
  const recorded = DAY(); recorded[0] = dose('rx-008-20260924-0700', 'rx-008', '07:00', TAKEN);
  assert.equal(V.forgotTarget({ doses: recorded, nowIso: at('14:00') }).id, 'rx-009-20260924-1300');
});

test('CR-108 forgot: recorded -> names the dose, says it recorded it as missed and sent it to Telegram, keeps the pharmacist line, no medical advice, ends the session; the OTHER passed dose is not re-prompted', () => {
  const r = V.voiceReply({ kind: 'ForgotDoseIntent', language: 'ar', doses: DAY(), nowIso: at('09:00'), hasChat: true, forgot: 'recorded' });
  assert.match(r.speech, /الجرعة اللي فات وقتها Eltroxin الساعة 7 الصبح/);
  assert.match(r.speech, /جرعتك الجاية Calcium carbonate \+ vitamin D3 الساعة 1 الظهر/);
  assert.match(r.speech, /سجّلتها إنها فاتتك وأرسلتها لك في تيليقرام/);
  assert.match(r.speech, /اسأل الصيدلاني/);
  assert.doesNotMatch(r.speech, /خذها الحين|اتركها|ضاعف/); // no medical advice
  assert.equal(r.endSession, true);
  assert.deepEqual(r.promptDoses, []);
});

test('CR-108 forgot: recorded, at 14:00 - the 13:00 dose (the most recent passed) is the one recorded and named; the 07:00 dose ALSO passed and is still open, so it still gets its buttons (today\'s behaviour, unchanged)', () => {
  const doses = DAY();
  const r = V.voiceReply({ kind: 'ForgotDoseIntent', language: 'en', doses, nowIso: at('14:00'), hasChat: true, forgot: 'recorded' });
  assert.match(r.speech, /^The dose that passed is Calcium carbonate \+ vitamin D3 at 1 in the afternoon\./);
  assert.equal(r.speech, 'The dose that passed is Calcium carbonate + vitamin D3 at 1 in the afternoon. Your next dose is Calcium carbonate + vitamin D3 at 9 in the evening. '
    + 'I recorded it as missed and sent it to your Telegram. If you have a question about the missed dose, ask your pharmacist.');
  assert.deepEqual(r.promptDoses.map((d) => d.id), ['rx-008-20260924-0700']);
});

test('CR-108 forgot: recorded, no chat linked -> says it recorded it and that no message was sent; nothing to prompt', () => {
  const r = V.voiceReply({ kind: 'ForgotDoseIntent', language: 'ar', doses: DAY(), nowIso: at('09:00'), hasChat: false, forgot: 'recorded' });
  assert.match(r.speech, /تيليقرام مو مربوط عندك، فما أرسلت لك رسالة/);
  assert.deepEqual(r.promptDoses, []);
  assert.equal(r.endSession, true);
});

test('CR-108 forgot: the write failed (fail closed) - never "recorded", the exact fallback text, and today\'s buttons for every passed dose, including the one that failed', () => {
  for (const forgot of [undefined, 'failed']) {
    const r = V.voiceReply({ kind: 'ForgotDoseIntent', language: 'en', doses: DAY(), nowIso: at('09:00'), hasChat: true, forgot });
    assert.equal(r.speech, 'The dose that passed is Eltroxin at 7 in the morning. Your next dose is Calcium carbonate + vitamin D3 at 1 in the afternoon. '
      + 'I could not record it just now, so I sent the buttons to your Telegram chat. Please record it there. If you have a question about the missed dose, ask your pharmacist.');
    assert.doesNotMatch(r.speech, /\brecorded\b/);
    assert.deepEqual(r.promptDoses.map((d) => d.id), ['rx-008-20260924-0700']);
  }
});

test('CR-108 forgot: the write failed, no chat linked -> says it could not record AND that Telegram is not linked; no buttons to send anywhere', () => {
  const r = V.voiceReply({ kind: 'ForgotDoseIntent', language: 'ar', doses: DAY(), nowIso: at('09:00'), hasChat: false, forgot: 'failed' });
  assert.match(r.speech, /ما قدرت أسجّلها الحين، وتيليقرام مو مربوط عندك/);
  assert.deepEqual(r.promptDoses, []);
});

test('I forgot before any dose time -> nothing passed, nothing recorded, nothing prompted, whatever `forgot` says', () => {
  for (const forgot of [undefined, 'recorded', 'failed']) {
    const r = V.voiceReply({ kind: 'ForgotDoseIntent', language: 'ar', doses: DAY(), nowIso: at('06:00'), hasChat: true, forgot });
    assert.deepEqual(r.promptDoses, []);
    assert.match(r.speech, /ما لقيت جرعة فاتت/);
  }
});

test('the backend failed -> an honest failure, never an invented schedule', () => {
  for (const kind of V.VOICE_INTENTS) {
    const r = V.voiceReply({ kind, language: 'ar', doses: null, nowIso: at('09:00'), hasChat: true });
    assert.match(r.speech, /ما قدرت أوصل لجدولك/);
    assert.deepEqual(r.promptDoses, []);
  }
});

test('CR-106: launch is the greeting alone, in each language; the session stays open with the same reprompt; help still lists the questions; stop ends the session', () => {
  const ar = V.voiceReply({ kind: 'launch', language: 'ar' });
  const en = V.voiceReply({ kind: 'launch', language: 'en' });
  assert.deepEqual(ar, { speech: 'هلا، معك جرعة AI. شلون أقدر أساعدك؟', endSession: false, promptDoses: [] });
  assert.deepEqual(en, { speech: 'Hi, Jur\'ah AI. How can I help?', endSession: false, promptDoses: [] });
  assert.equal(V.alexaResponse({ ...ar, language: 'ar' }).response.reprompt.outputSpeech.text, 'شنو تبي تعرف عن أدويتك؟');
  assert.equal(V.alexaResponse({ ...en, language: 'en' }).response.reprompt.outputSpeech.text, 'What would you like to know about your medicines?');
  assert.match(V.voiceReply({ kind: 'AMAZON.HelpIntent', language: 'ar' }).speech, /^تقدر تسألني: /);
  assert.match(V.voiceReply({ kind: 'AMAZON.HelpIntent', language: 'en' }).speech, /^Ask me: what is my next dose/);
  assert.equal(V.voiceReply({ kind: 'AMAZON.StopIntent', language: 'ar' }).endSession, true);
});

test('English: same data, English words and times', () => {
  const r = V.voiceReply({ kind: 'NextDoseIntent', language: 'en', doses: DAY(), nowIso: at('09:00'), hasChat: true });
  assert.match(r.speech, /^Your next dose is Calcium carbonate \+ vitamin D3 at 1 in the afternoon\. 1 dose, strength 500 milligrams\./);
});

test('spokenTime covers the day parts and minutes', () => {
  assert.equal(V.spokenTime('2026-09-24T21:30:00+03:00', 'ar'), 'الساعة 9 و30 دقيقة بالليل');
  assert.equal(V.spokenTime('2026-09-24T12:00:00+03:00', 'ar'), 'الساعة 12 الظهر');
  assert.equal(V.spokenTime('2026-09-24T18:15:00+03:00', 'en'), '6:15 in the evening');
});

test('alexaResponse: PlainText speech, a reprompt only while the session stays open', () => {
  assert.deepEqual(V.alexaResponse({ speech: 'x', endSession: true, language: 'ar' }), { version: '1.0', response: { outputSpeech: { type: 'PlainText', text: 'x' }, shouldEndSession: true } });
  assert.ok(V.alexaResponse({ speech: 'x', endSession: false, language: 'ar' }).response.reprompt);
});

test('CR-069 screenTopic: each voice turn names the topic the screen should follow; a closed session names none', () => {
  assert.equal(V.screenTopic('launch'), 'launch');
  assert.equal(V.screenTopic('NextDoseIntent'), 'next_dose');
  assert.equal(V.screenTopic('DoseAmountIntent'), 'dose_amount');
  assert.equal(V.screenTopic('TodayDosesIntent'), 'today');
  assert.equal(V.screenTopic('ForgotDoseIntent'), 'forgot');
  assert.equal(V.screenTopic('record'), 'record');
  for (const k of ['AMAZON.HelpIntent', 'AMAZON.FallbackIntent', 'unknown', 'SomethingNew']) assert.equal(V.screenTopic(k), 'unclear', k);
  for (const k of ['AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.NoIntent', 'AMAZON.NavigateHomeIntent']) assert.equal(V.screenTopic(k), 'bye', k);
  assert.equal(V.screenTopic('ended'), null);
});

test('SAY purity: no em dash anywhere in the module, and the four new forgot templates carry no drug name (their language purity is checked on the fixed template, not the assembled sentence, which legitimately mixes in an English brand name)', () => {
  const src = require('node:fs').readFileSync(require.resolve('../lib/voice.js'), 'utf8');
  assert.doesNotMatch(src, /—/, 'an em dash (U+2014) in voice.js');
  // en templates: pure English (besides the fixed punctuation already asserted above).
  assert.doesNotMatch('I recorded it as missed and sent it to your Telegram. If you have a question about the missed dose, ask your pharmacist.', /[؀-ۿ]/);
  // ar templates: pure Arabic script (the four exact strings this session added to SAY.ar).
  for (const s of [
    ' سجّلتها إنها فاتتك وأرسلتها لك في تيليقرام. وإذا عندك سؤال عن الجرعة الفايتة، اسأل الصيدلاني.',
    ' سجّلتها إنها فاتتك. تيليقرام مو مربوط عندك، فما أرسلت لك رسالة. وإذا عندك سؤال عن الجرعة الفايتة، اسأل الصيدلاني.',
    ' ما قدرت أسجّلها الحين، فأرسلت لك الأزرار في تيليقرام. سجّلها من هناك. وإذا عندك سؤال عن الجرعة الفايتة، اسأل الصيدلاني.',
    ' ما قدرت أسجّلها الحين، وتيليقرام مو مربوط عندك، فسجّلها من محادثتك لما تربطها. وإذا عندك سؤال عن الجرعة الفايتة، اسأل الصيدلاني.',
  ]) {
    assert.doesNotMatch(s.replace(/[؀-ۿ]/g, ''), /[A-Za-z]/, s);
    assert.ok(!s.includes(String.fromCharCode(0x2014)), s);
  }
});
