'use strict';

/**
 * agents/lib/voice.js - the Alexa demo channel. Fixtures are the seed's tracked patient pt-03 on
 * 2026-09-24 (the rows GET /api/agent/patients/pt-03/doses returns). Voice is READ-ONLY: nothing
 * here can produce a write, and "I forgot" only ever prompts the patient's own Telegram chat.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../lib/voice.js');

const OPEN = ['upcoming'][0];
const TAKEN = ['taken_on_time'][0];
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

test('parse: the right skill, a fresh timestamp and a linked user -> ok, with the patient', () => {
  const p = V.parseAlexaRequest({ body: req('IntentRequest', 'NextDoseIntent'), nowIso: '2026-09-24T09:00:30Z', skillId: SKILL, links: { [USER]: 'pt-03' } });
  assert.deepEqual(p, { ok: true, kind: 'NextDoseIntent', language: 'ar', userId: USER, patientId: 'pt-03', needsDoses: true });
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

test('I forgot: names the passed dose and the next one, records NOTHING, prompts the patient’s own chat', () => {
  const r = V.voiceReply({ kind: 'ForgotDoseIntent', language: 'ar', doses: DAY(), nowIso: at('09:00'), hasChat: true });
  assert.match(r.speech, /الجرعة اللي فات وقتها Eltroxin الساعة 7 الصبح/);
  assert.match(r.speech, /جرعتك الجاية Calcium/);
  assert.match(r.speech, /ما سجّلت شي بالصوت/);
  assert.match(r.speech, /اسأل الصيدلاني/);
  assert.doesNotMatch(r.speech, /خذها الحين|اتركها|ضاعف/); // no medical advice
  assert.deepEqual(r.promptDoses.map((d) => d.id), ['rx-008-20260924-0700']);
  assert.ok(!('writes' in r));
});

test('I forgot with no Telegram linked -> nothing to prompt, and it says so', () => {
  const r = V.voiceReply({ kind: 'ForgotDoseIntent', language: 'ar', doses: DAY(), nowIso: at('09:00'), hasChat: false });
  assert.deepEqual(r.promptDoses, []);
  assert.match(r.speech, /تيليقرام مو مربوط/);
});

test('I forgot before any dose time -> nothing passed, nothing prompted', () => {
  const r = V.voiceReply({ kind: 'ForgotDoseIntent', language: 'ar', doses: DAY(), nowIso: at('06:00'), hasChat: true });
  assert.deepEqual(r.promptDoses, []);
  assert.match(r.speech, /ما لقيت جرعة فاتت/);
});

test('the backend failed -> an honest failure, never an invented schedule', () => {
  for (const kind of V.VOICE_INTENTS) {
    const r = V.voiceReply({ kind, language: 'ar', doses: null, nowIso: at('09:00'), hasChat: true });
    assert.match(r.speech, /ما قدرت أوصل لجدولك/);
    assert.deepEqual(r.promptDoses, []);
  }
});

test('launch carries the prototype / no-medical-advice line; stop ends the session', () => {
  assert.match(V.voiceReply({ kind: 'launch', language: 'ar' }).speech, /نموذج طلابي.*ما نقدم استشارة طبية/);
  assert.equal(V.voiceReply({ kind: 'AMAZON.StopIntent', language: 'ar' }).endSession, true);
  assert.match(V.voiceReply({ kind: 'launch', language: 'en' }).speech, /student prototype.*no medical advice/);
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
