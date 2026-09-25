'use strict';

/**
 * agents/lib/webchat.js - the web-app assistant (CR-067). In n8n the file is inlined after
 * agents/lib/voice.js; webchatReply no longer calls voiceReply at all (AP-17/CR-079: the chat has
 * its own written Fusha), but the fixtures stay the seed's tracked patient pt-03 (سارة) on
 * 2026-09-24, and voice.js is required directly below for the parity test against it.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../lib/webchat.js');
const V = require('../lib/voice.js');

const OPEN = ['upcoming'][0];
const dose = (id, rx, hhmm) => ({
  id, prescriptionId: rx, scheduledAt: '2026-09-24T' + hhmm + ':00+03:00', status: OPEN, recordedAt: null,
  genericName: rx === 'rx-008' ? 'Levothyroxine' : 'Calcium carbonate + vitamin D3', brandName: rx === 'rx-008' ? 'Eltroxin' : null,
  strengthMg: rx === 'rx-008' ? 50 : 500, strengthUnit: rx === 'rx-008' ? 'mcg' : null, dosePerAdministration: 1, timingRelativeToFood: null,
});
const DAY = () => [dose('rx-008-20260924-0700', 'rx-008', '07:00'), dose('rx-009-20260924-1300', 'rx-009', '13:00'), dose('rx-009-20260924-2100', 'rx-009', '21:00')];
const at = (hhmm) => '2026-09-24T' + hhmm + ':00+03:00';
const ask = (intent, over = {}) => W.webchatReply({ intent, language: 'ar', doses: DAY(), alerts: [], nowIso: at('09:00'), hasChat: true, ...over });

const DASH = /[–—]/;
const DIALECT = /شنو|الحين|مو |ما أقدر|اللي|هذي|الجاية|الصبح|بالليل|شوي|تبي|تيليقرام|لقيت|بالصوت/;
const ARABIC_LETTER = /[؀-ۿ]/;

test('G11: an intent outside the list, or below 0.7, is unclear', () => {
  assert.equal(W.trustWebchatIntent({ intent: 'next_dose', confidence: 0.9 }), 'next_dose');
  for (const c of [{ intent: 'next_dose', confidence: 0.69 }, { intent: 'record_dose', confidence: 1 }, {}, null]) assert.equal(W.trustWebchatIntent(c), 'unclear');
});

test('next dose / how much / today: the chat\'s OWN written Fusha (chatTime/chatAmount), the same dose voice.js would name', () => {
  assert.match(ask('next_dose').reply, /^جرعتك القادمة Calcium carbonate \+ vitamin D3 الساعة 1 ظهرًا\. الكمية 1، تركيز 500 مليغرام\.$/);
  assert.match(ask('dose_amount', { nowIso: at('06:30') }).reply, /^حسب وصفتك، Eltroxin الساعة 7 صباحًا: الكمية 1، تركيز 50 مايكروغرام\.$/);
  assert.match(ask('today').reply, /^لديك اليوم 3 جرعات: الساعة 7 صباحًا Eltroxin، قادمة\. الساعة 1 ظهرًا Calcium carbonate \+ vitamin D3، قادمة\. الساعة 9 ليلًا Calcium carbonate \+ vitamin D3، قادمة\.$/);
});

test('no next dose left, or nothing on the schedule at all: an honest "none", never an invented time', () => {
  assert.match(ask('next_dose', { nowIso: at('22:00') }).reply, /^لا توجد لديك جرعات متبقية اليوم\.$/);
  assert.match(ask('today', { doses: [] }).reply, /^لا توجد لديك جرعات مسجّلة في جدولك اليوم\.$/);
});

test('"I took it" records NOTHING: it says so and sends the open dose’s buttons to the patient’s own Telegram', () => {
  const r = ask('took_it');
  assert.match(r.reply, /لا يمكنني تسجيل الجرعة من هنا/);
  assert.match(r.reply, /تيليجرام/);
  assert.deepEqual(r.promptDoses.map((d) => d.id), ['rx-008-20260924-0700']);
  assert.ok(!('writes' in r));
});

test('"I took it" with no Telegram linked, or nothing open -> no prompt, and it says why', () => {
  assert.match(ask('took_it', { hasChat: false }).reply, /تيليجرام غير مرتبط/);
  assert.deepEqual(ask('took_it', { hasChat: false }).promptDoses, []);
  assert.match(ask('took_it', { nowIso: at('05:00') }).reply, /لا توجد جرعة مفتوحة/);
});

test('"I forgot" -> names the passed dose in the chat\'s own words, prompts Telegram, records nothing, and never mentions voice', () => {
  const r = ask('forgot');
  assert.match(r.reply, /الجرعة التي تجاوزت وقتها Eltroxin الساعة 7 صباحًا/);
  assert.match(r.reply, /جرعتك القادمة Calcium/);
  assert.deepEqual(r.promptDoses.map((d) => d.id), ['rx-008-20260924-0700']);
  assert.doesNotMatch(r.reply, /صوت|voice/i);
});

test('"I forgot" with several doses already passed prompts ALL of them, not just the one it names', () => {
  const r = ask('forgot', { nowIso: at('22:00') });
  assert.match(r.reply, /الجرعة التي تجاوزت وقتها Calcium carbonate \+ vitamin D3 الساعة 9 ليلًا/);
  assert.deepEqual(r.promptDoses.map((d) => d.id).sort(), ['rx-008-20260924-0700', 'rx-009-20260924-1300', 'rx-009-20260924-2100']);
});

test('safety: only the alerts already in the file, with their review state - never "it is safe"; a matching-language description is quoted', () => {
  const alerts = [{ severity: 'warning', description: 'الكالسيوم قد يقلل امتصاص اللِفوثيروكسين إذا أُخذا معًا.', reviewStatus: 'reviewed' }];
  const r = ask('safety', { alerts });
  assert.match(r.reply, /^هذه التنبيهات الموجودة في ملفك:\n• الكالسيوم قد يقلل امتصاص اللِفوثيروكسين إذا أُخذا معًا\. \(راجعه مختص طبي\)/);
  assert.match(r.reply, /اسأل الصيدلي/);
  const none = ask('safety', { alerts: [] });
  assert.match(none.reply, /هذا ليس تأكيدًا بالسلامة/);
  assert.doesNotMatch(none.reply + r.reply, /آمن|safe to/);
});

test('safety in English never quotes a stored Arabic description back: it names the severity and review state instead (D7)', () => {
  const alerts = [{ severity: 'danger', description: 'الكالسيوم قد يقلل امتصاص اللِفوثيروكسين إذا أُخذا معًا.', reviewStatus: 'pending_medical_review' }];
  const r = ask('safety', { alerts, language: 'en' });
  assert.doesNotMatch(r.reply, ARABIC_LETTER);
  assert.match(r.reply, /Serious interaction \(awaiting medical review\)/);
});

test('app help is fixed text; unclear suggests the app\'s own Fusha chips; the backend down is an honest failure', () => {
  assert.match(ask('help_telegram').reply, /المزيد» ثم «الإشعارات والرسائل/);
  assert.match(ask('help_refill').reply, /تجديد الوصفات/);
  assert.match(ask('unclear').reply, /متى الجرعة القادمة؟» أو «كم آخذ؟» أو «ماذا في جدول أدويتي اليوم؟/);
  assert.match(ask('next_dose', { doses: null }).reply, /لم أتمكن من الوصول إلى جدولك/);
});

test('English follows the locale', () => {
  assert.match(ask('help_general', { language: 'en' }).reply, /I give no medical advice/);
  assert.match(ask('next_dose', { language: 'en' }).reply, /^Your next dose is Calcium/);
});

test('only dose intents need the schedule', () => {
  assert.deepEqual(W.WEBCHAT_INTENTS.filter(W.needsDoses), ['next_dose', 'dose_amount', 'today', 'forgot', 'took_it']);
});

test('fast path: the app’s actual suggestion chips (ar and en) resolve without the model', () => {
  const cases = {
    'متى الجرعة القادمة؟': 'next_dose', 'كم آخذ؟': 'dose_amount', 'ماذا في جدول أدويتي اليوم؟': 'today', 'هل يوجد تعارض بين أدويتي؟': 'safety',
    'كيف أربط تيليجرام؟': 'help_telegram', 'كيف أطلب تجديد الوصفة؟': 'help_refill',
    'What is my next dose?': 'next_dose', 'How much do I take?': 'dose_amount', 'What are my medicines today?': 'today', 'Do my medicines interact?': 'safety',
  };
  for (const [text, intent] of Object.entries(cases)) assert.equal(W.quickIntent(text), intent, text);
});

test('fast path: a few one-meaning phrasings a patient might actually type; diacritics and punctuation do not matter', () => {
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

test('every intent, in ar and en: no em/en dash, no Kuwaiti dialect marker in ar, no Arabic letter in en (AP-17/CR-079)', () => {
  const arabicAlert = [{ severity: 'warning', description: 'الكالسيوم قد يقلل امتصاص اللِفوثيروكسين إذا أُخذا معًا.', reviewStatus: 'reviewed' }];
  for (const language of ['ar', 'en']) {
    for (const intent of W.WEBCHAT_INTENTS) {
      const { reply } = ask(intent, { language, alerts: arabicAlert, hasChat: true });
      assert.doesNotMatch(reply, DASH, intent + ' ' + language);
      if (language === 'ar') assert.doesNotMatch(reply, DIALECT, intent + ' ar: ' + reply);
      else assert.doesNotMatch(reply, ARABIC_LETTER, intent + ' en: ' + reply);
    }
  }
});

test('parity with voice.js at 05:00, 06:30, 09:00, 13:30 and 22:00: the same dose is named, and forgot prompts the same doses', () => {
  for (const hhmm of ['05:00', '06:30', '09:00', '13:30', '22:00']) {
    const nowIso = at(hhmm);
    for (const [chatIntent, voiceKind] of [['next_dose', 'NextDoseIntent'], ['dose_amount', 'DoseAmountIntent']]) {
      const c = ask(chatIntent, { nowIso });
      const v = V.voiceReply({ kind: voiceKind, language: 'ar', doses: DAY(), nowIso, hasChat: true });
      for (const name of ['Eltroxin', 'Calcium carbonate + vitamin D3']) {
        assert.equal(c.reply.includes(name), v.speech.includes(name), hhmm + ' ' + chatIntent + ': ' + name);
      }
    }
    const cf = ask('forgot', { nowIso });
    const vf = V.voiceReply({ kind: 'ForgotDoseIntent', language: 'ar', doses: DAY(), nowIso, hasChat: true });
    assert.deepEqual(cf.promptDoses.map((d) => d.id).sort(), vf.promptDoses.map((d) => d.id).sort(), hhmm + ': forgot promptDoses');
  }
});
