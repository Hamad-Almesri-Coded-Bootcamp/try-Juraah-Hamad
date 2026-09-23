'use strict';

/**
 * agents/lib/webchat.js - the web-app assistant (CR-067). In n8n the file is inlined after
 * agents/lib/voice.js; here voice.js's voiceReply is put on the global the same way.
 * Fixtures are the seed's tracked patient pt-03 (سارة) on 2026-09-24.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
global.voiceReply = require('../lib/voice.js').voiceReply;
const W = require('../lib/webchat.js');

const OPEN = ['upcoming'][0];
const dose = (id, rx, hhmm) => ({
  id, prescriptionId: rx, scheduledAt: '2026-09-24T' + hhmm + ':00+03:00', status: OPEN, recordedAt: null,
  genericName: rx === 'rx-008' ? 'Levothyroxine' : 'Calcium carbonate + vitamin D3', brandName: rx === 'rx-008' ? 'Eltroxin' : null,
  strengthMg: rx === 'rx-008' ? 50 : 500, strengthUnit: rx === 'rx-008' ? 'mcg' : null, dosePerAdministration: 1, timingRelativeToFood: null,
});
const DAY = () => [dose('rx-008-20260924-0700', 'rx-008', '07:00'), dose('rx-009-20260924-1300', 'rx-009', '13:00'), dose('rx-009-20260924-2100', 'rx-009', '21:00')];
const at = (hhmm) => '2026-09-24T' + hhmm + ':00+03:00';
const ask = (intent, over = {}) => W.webchatReply({ intent, language: 'ar', doses: DAY(), alerts: [], nowIso: at('09:00'), hasChat: true, ...over });

test('G11: an intent outside the list, or below 0.7, is unclear', () => {
  assert.equal(W.trustWebchatIntent({ intent: 'next_dose', confidence: 0.9 }), 'next_dose');
  for (const c of [{ intent: 'next_dose', confidence: 0.69 }, { intent: 'record_dose', confidence: 1 }, {}, null]) assert.equal(W.trustWebchatIntent(c), 'unclear');
});

test('next dose / how much / today are the same words Alexa speaks, without the spoken "anything else?"', () => {
  assert.match(ask('next_dose').reply, /^جرعتك الجاية Calcium carbonate \+ vitamin D3 الساعة 1 الظهر\. الكمية 1، تركيز 500 مليغرام\.$/);
  assert.match(ask('dose_amount', { nowIso: at('06:30') }).reply, /^حسب وصفتك، Eltroxin الساعة 7 الصبح: الكمية 1، تركيز 50 مايكروغرام\.$/);
  assert.match(ask('today').reply, /^عندك اليوم 3 جرعات:/);
});

test('"I took it" records NOTHING: it says so and sends the open dose’s buttons to the patient’s own Telegram', () => {
  const r = ask('took_it');
  assert.match(r.reply, /ما أقدر أسجّل الجرعة من هنا/);
  assert.deepEqual(r.promptDoses.map((d) => d.id), ['rx-008-20260924-0700']);
  assert.ok(!('writes' in r));
});

test('"I took it" with no Telegram linked, or nothing open -> no prompt, and it says why', () => {
  assert.match(ask('took_it', { hasChat: false }).reply, /تيليقرام مو مربوط/);
  assert.deepEqual(ask('took_it', { hasChat: false }).promptDoses, []);
  assert.match(ask('took_it', { nowIso: at('05:00') }).reply, /ما لقيت جرعة مفتوحة/);
});

test('"I forgot" -> names the passed dose, prompts Telegram, records nothing', () => {
  const r = ask('forgot');
  assert.match(r.reply, /الجرعة اللي فات وقتها Eltroxin/);
  assert.deepEqual(r.promptDoses.map((d) => d.id), ['rx-008-20260924-0700']);
});

test('safety: only the alerts already in the file, with their review state - never "it is safe"', () => {
  const alerts = [{ severity: 'warning', description: 'الكالسيوم قد يقلل امتصاص اللِفوثيروكسين إذا أُخذا معًا.', reviewStatus: 'reviewed' }];
  const r = ask('safety', { alerts });
  assert.match(r.reply, /^هذي التنبيهات الموجودة في ملفك:\n• الكالسيوم قد يقلل امتصاص اللِفوثيروكسين إذا أُخذا معًا\. \(راجعها مختص\)/);
  assert.match(r.reply, /اسأل الصيدلاني/);
  const none = ask('safety', { alerts: [] });
  assert.match(none.reply, /هذا مو تأكيد بالسلامة/);
  assert.doesNotMatch(none.reply + r.reply, /آمن|safe to/);
});

test('app help is fixed text; unclear offers examples; the backend down is an honest failure', () => {
  assert.match(ask('help_telegram').reply, /المزيد ← الإشعارات والمراسلة/);
  assert.match(ask('help_refill').reply, /تجديد الوصفات/);
  assert.match(ask('unclear').reply, /ما فهمت عليك/);
  assert.match(ask('next_dose', { doses: null }).reply, /ما قدرت أوصل لجدولك/);
});

test('English follows the locale', () => {
  assert.match(ask('help_general', { language: 'en' }).reply, /I give no medical advice/);
  assert.match(ask('next_dose', { language: 'en' }).reply, /^Your next dose is Calcium/);
});

test('only dose intents need the schedule', () => {
  assert.deepEqual(W.WEBCHAT_INTENTS.filter(W.needsDoses), ['next_dose', 'dose_amount', 'today', 'forgot', 'took_it']);
});

test('fast path: the app’s four suggestion buttons (ar and en) resolve without the model', () => {
  const cases = {
    'شنو جرعتي الجاية؟': 'next_dose', 'كم آخذ؟': 'dose_amount', 'شنو أدويتي اليوم؟': 'today', 'فيه تعارض بين أدويتي؟': 'safety',
    'What is my next dose?': 'next_dose', 'How much do I take?': 'dose_amount', 'What are my medicines today?': 'today', 'Do my medicines interact?': 'safety',
  };
  for (const [text, intent] of Object.entries(cases)) assert.equal(W.quickIntent(text), intent, text);
});

test('fast path: a few one-meaning phrasings; diacritics and punctuation do not matter', () => {
  assert.equal(W.quickIntent('نسيت دواي'), 'forgot');
  assert.equal(W.quickIntent('أخذتُه!'), 'took_it');
  assert.equal(W.quickIntent('كيف أربط تيليقرام'), 'help_telegram');
  assert.equal(W.quickIntent('ابي إعادة صرف'), 'help_refill');
  assert.equal(W.quickIntent('I forgot my medicine'), 'forgot');
});

test('fast path is conservative: negated, two-topic, vague or unknown text goes to the model (null)', () => {
  for (const text of ['ما أخذته', 'مو متأكد متى الدوا الجاي', 'نسيت أسأل عن التعارض', 'نسيت متى الجرعة الجاية', 'I did not take it', 'ايه', 'هلا', '', '   ', 'شنو رايك بالدوا']) {
    assert.equal(W.quickIntent(text), null, JSON.stringify(text));
  }
});

test('only "I forgot" / "I took it" need the patient’s Telegram chat', () => {
  assert.deepEqual(W.WEBCHAT_INTENTS.filter(W.needsChat), ['forgot', 'took_it']);
});
