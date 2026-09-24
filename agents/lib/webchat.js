'use strict';

/**
 * Jur'ah - the web-app chat assistant's deterministic layer (CR-067). READ-ONLY, patient only.
 *
 * Gemini picks ONE intent from WEBCHAT_INTENTS (and a confidence); this file writes every word the
 * patient reads, from data only:
 *   - dose questions      -> the patient's TRACKED doses of today (GET /api/agent/patients/{id}/doses).
 *                            The SAME dose voice.js (Alexa) would pick - next = the first open dose
 *                            after now, amount = the one due within an hour else next, forgot = every
 *                            open dose at or before now - but in the chat's OWN written Fusha
 *                            (CR-079/D7: the app's register, never Alexa's spoken Kuwaiti lines), so
 *                            the two channels never disagree about WHICH dose, only about how they
 *                            say it;
 *   - safety questions    -> ONLY the alerts already in the patient's file (read by the app under the
 *                            patient's own session and passed in) - never a new judgement, never
 *                            "it is safe"; a stored description is quoted only when its own script
 *                            matches the reply language, so an English reply never quotes an Arabic
 *                            sentence back (D7: one language per locale);
 *   - app help            -> fixed text.
 *
 * The chat NEVER records a dose (CLAUDE.md rule 1). "I took it" / "I forgot" name the dose and send
 * its three buttons to the patient's OWN Telegram chat; the tap there records it through the
 * adherence path. CR-068 proposes recording from the chat itself; it is not built.
 *
 * Plain CommonJS, inlined into the n8n Code node after agents/lib/voice.js. Every name below is
 * distinct from voice.js's and adherence.js's own (all three share one scope once inlined), so this
 * file can word its dose answers on its own without editing either of them.
 */

const WEBCHAT_INTENTS = [
  'next_dose', 'dose_amount', 'today', 'forgot', 'took_it', 'safety',
  'help_telegram', 'help_refill', 'help_general', 'unclear',
];
const WEBCHAT_MIN_CONFIDENCE = 0.7;
const WEBCHAT_HOUR_MS = 3600 * 1000;
const WEBCHAT_OPEN = ['upcoming'][0];

/** The four intents whose answer needs today's doses (kept beside took_it in needsDoses). */
const DOSE_INTENTS = ['next_dose', 'dose_amount', 'today', 'forgot'];

const CHAT = {
  ar: {
    tookIt: 'لا يمكنني تسجيل الجرعة من هنا، فالتسجيل يتم فقط من محادثتك في تيليجرام. ',
    tookItPrompt: 'أرسلتُ لك أزرار هذه الجرعة في تيليجرام، فاضغط زر «أخذته ✅» هناك.',
    tookItNoDose: 'لا توجد جرعة مفتوحة في وقتها الآن.',
    noChat: 'تيليجرام غير مرتبط بحسابك، ويمكنك ربطه من «المزيد» ثم «الإشعارات والرسائل».',
    none: 'لا توجد لديك جرعات مسجّلة في جدولك اليوم.',
    noneLeft: 'لا توجد لديك جرعات متبقية اليوم.',
    statusUpcoming: 'قادمة',
    statusTakenOnTime: 'أُخذت في موعدها',
    statusTakenLate: 'أُخذت متأخرة',
    statusMissed: 'فائتة',
    forgotNone: 'لم أجد جرعة تجاوزت وقتها ولم تُسجَّل بعد.',
    forgotTail: ' لم يُسجَّل شيء بعد. أرسلنا الأزرار في تيليجرام، فاضغط الزر المناسب هناك. إذا كان لديك سؤال عن الجرعة الفائتة فاسأل الصيدلي.',
    forgotNoChat: ' لم يُسجَّل شيء بعد، وتيليجرام غير مرتبط بحسابك، فسجِّلها من محادثتك بعد ربطها. إذا كان لديك سؤال عن الجرعة الفائتة فاسأل الصيدلي.',
    safetyNone: 'لا توجد تنبيهات تعارض في ملفك حاليًا. هذا ليس تأكيدًا بالسلامة، فلأي سؤال عن أدويتك اسأل الصيدلي أو طبيبك.',
    safetyHead: 'هذه التنبيهات الموجودة في ملفك:',
    pending: 'بانتظار المراجعة الطبية',
    reviewed: 'راجعه مختص طبي',
    cleared: 'فُحص تلقائيًا',
    severityDanger: 'تعارض خطير',
    severityWarning: 'استشر طبيبك',
    severityInfo: 'للعلم',
    safetyTail: 'التفاصيل الكاملة في صفحة «السلامة». لا يقدّم تطبيق جرعة استشارة طبية، فاسأل الصيدلي أو طبيبك.',
    helpTelegram: 'لربط تيليجرام: افتح «المزيد» ثم «الإشعارات والرسائل»، واضغط «افتح تيليجرام». اضغط «ابدأ» في المحادثة، وبعدها نستطيع مراسلتك بشأن جرعاتك.',
    helpRefill: 'لإعادة الصرف: افتح «المزيد» ثم «تجديد الوصفات»، واختر الدواء. يصل طلبك إلى الجهة التي صرفت الوصفة.',
    helpGeneral: 'يمكنني الإجابة عن: جرعتك القادمة، الكمية التي تأخذها، أدويتك اليوم، تنبيهات السلامة في ملفك، وكيفية ربط تيليجرام. لا أقدّم استشارة طبية.',
    unclear: 'لم أفهم قصدك تمامًا 🙏 جرّب: «متى الجرعة القادمة؟» أو «كم آخذ؟» أو «ماذا في جدول أدويتي اليوم؟».',
    failed: 'لم أتمكن من الوصول إلى جدولك الآن. حاول مرة أخرى بعد قليل.',
  },
  en: {
    tookIt: 'I can\'t record a dose from here; doses are recorded only from your Telegram chat. ',
    tookItPrompt: 'I sent this dose\'s buttons to your Telegram; tap "Taken" there.',
    tookItNoDose: 'There is no dose open right now.',
    noChat: 'Your Telegram is not linked; you can link it from More, then Notifications and messages.',
    none: 'There are no doses on your schedule today.',
    noneLeft: 'You have no doses left today.',
    statusUpcoming: 'Upcoming',
    statusTakenOnTime: 'Taken on time',
    statusTakenLate: 'Taken late',
    statusMissed: 'Missed',
    forgotNone: 'I could not find a dose past its time that has not been recorded yet.',
    forgotTail: ' Nothing has been recorded yet. We sent the buttons to your Telegram chat; tap the right one there. If you have a question about the missed dose, ask your pharmacist.',
    forgotNoChat: ' Nothing has been recorded yet, and your Telegram is not linked, so record it from your chat once it is linked. If you have a question about the missed dose, ask your pharmacist.',
    safetyNone: 'There are no interaction alerts in your file right now. This is not a safety clearance; ask your pharmacist or doctor about your medicines.',
    safetyHead: 'These are the alerts in your file:',
    pending: 'awaiting medical review',
    reviewed: 'reviewed by a specialist',
    cleared: 'checked automatically',
    severityDanger: 'Serious interaction',
    severityWarning: 'Check with your doctor',
    severityInfo: 'For your information',
    safetyTail: 'Full details are under Safety. Jur\'ah gives no medical advice; ask your pharmacist or doctor.',
    helpTelegram: 'To link Telegram: open More, then Notifications and messages, and tap Open Telegram. Press Start in the chat, and we will be able to message you about your doses.',
    helpRefill: 'To request a refill: open More, then Refills, and pick the medicine. Your request goes to the place that dispensed it.',
    helpGeneral: 'I can answer: your next dose, how much you take, today\'s medicines, the safety alerts in your file, and how to link Telegram. I give no medical advice.',
    unclear: 'Sorry, I did not catch that 🙏 Try: "What is my next dose?", "How much do I take?" or "What are my medicines today?".',
    failed: 'I could not reach your schedule right now. Please try again shortly.',
  },
};

/** G11 - the model's intent is trusted only inside the list and above the floor. */
function trustWebchatIntent(classification) {
  const c = classification && typeof classification === 'object' ? classification : {};
  const intent = String(c.intent == null ? 'unclear' : c.intent);
  const confidence = Number(c.confidence);
  if (!WEBCHAT_INTENTS.includes(intent) || !Number.isFinite(confidence) || confidence < WEBCHAT_MIN_CONFIDENCE) return 'unclear';
  return intent;
}

function needsDoses(intent) {
  return DOSE_INTENTS.includes(intent) || intent === 'took_it';
}

/** Only these two answers can send Telegram buttons, so only they need the patient's chat. */
function needsChat(intent) {
  return intent === 'forgot' || intent === 'took_it';
}

/**
 * The fast path (no model call): the app's own suggestion buttons, and a few phrasings that can
 * only mean one thing. Returns an intent, or null to let Gemini decide. Conservative on purpose:
 * a message that matches MORE than one topic is null, and so is anything negated or vague - a
 * wrong fast answer is worse than a slow right one. Every answer is still read-only.
 */
const QUICK_RULES = [
  ['next_dose', /جرعتي الجاي|الجرعة الجاي|الدوا الجاي|الدواء الجاي|الجرعة القادمة|\bnext dose\b|\bnext medicine\b/],
  ['dose_amount', /^كم (آخذ|اخذ|حبة|حبه|الجرعة)|^شكثر آخذ|^شقد آخذ|\bhow much (do|should) i take\b|\bhow many (pills|tablets|doses)\b/],
  ['today', /أدويتي اليوم|ادويتي اليوم|جرعاتي اليوم|جدولي اليوم|جدول أدويتي|\bmedicines today\b|\bdoses today\b|\bmy schedule\b/],
  ['safety', /تعارض|تداخل|تنبيهات السلامة|\binteract(ion|ions)?\b|\bsafety alerts?\b/],
  ['help_telegram', /تيليقرام|تليقرام|تيليجرام|تلغرام|\btelegram\b/],
  ['help_refill', /إعادة صرف|اعادة صرف|تجديد الوصف|\brefill\b/],
  ['forgot', /^(نسيت|نسيت دواي|نسيت الدوا|نسيت الدواء|نسيت الجرعة|فاتتني الجرعة)$|^i (forgot|missed) my (medicine|dose|pill)s?$/],
  ['took_it', /^(أخذته|اخذته|خذيته|أخذتها|اخذتها|خذيتها|أخذت الدوا|اخذت الدوا)$|^i took (it|my (medicine|dose|pill))$/],
];

function quickIntent(text) {
  const t = String(text || '')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')        // Arabic diacritics and tatweel
    .replace(/[؟?!.،,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || /(^|\s)(ما|مو|لا|not|didn't|don't|never)(\s|$)/.test(t)) return null;
  const hits = QUICK_RULES.filter(([, re]) => re.test(t)).map(([intent]) => intent);
  if (hits.length !== 1) return null;
  // A dose-report word inside some other question ("I forgot to ask about...") is the model's call.
  const reportWord = /نسيت|فاتت|فاتني|أخذت|اخذت|خذيت|\bforgot\b|\bmissed\b|\btook\b/.test(t);
  if (reportWord && hits[0] !== 'forgot' && hits[0] !== 'took_it') return null;
  return hits[0];
}

const WEBCHAT_ARABIC = /[؀-ۿ]/;

/** Kuwait wall-clock parts of an ISO time (UTC+3, no DST) - a private copy of voice.js's kwParts,
 *  named apart from it on purpose (both files share one scope once inlined). */
function chatParts(iso) {
  const k = new Date(new Date(iso).getTime() + 3 * WEBCHAT_HOUR_MS);
  return { h: k.getUTCHours(), m: k.getUTCMinutes() };
}

/**
 * "الساعة 7 صباحًا" / "7 in the morning" - the chat's OWN written time, never Alexa's spoken
 * "الصبح"/"بالليل" (CR-079/D7). English is unchanged from voice.js's spoken words: they were never
 * a dialect problem, only the Arabic day-part words and the spelled-out minutes were.
 */
function chatTime(iso, language) {
  const { h, m } = chatParts(iso);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m ? ':' + String(m).padStart(2, '0') : '';
  if (language === 'en') {
    const part = h < 12 ? 'in the morning' : h < 17 ? 'in the afternoon' : 'in the evening';
    return h12 + mm + ' ' + part;
  }
  const part = h >= 4 && h < 12 ? 'صباحًا' : h >= 12 && h < 15 ? 'ظهرًا' : h >= 15 && h < 18 ? 'عصرًا' : h >= 18 && h < 20 ? 'مساءً' : 'ليلًا';
  return 'الساعة ' + h12 + mm + ' ' + part;
}

function medNameChat(d) { return d.brandName || d.genericName || ''; }

const CHAT_UNIT_AR = { mg: 'مليغرام', mcg: 'مايكروغرام', g: 'غرام', ml: 'مل', IU: 'وحدة دولية' };
const CHAT_UNIT_EN = { mg: 'milligrams', mcg: 'micrograms', g: 'grams', ml: 'millilitres', IU: 'international units' };

/** The amount AS PRESCRIBED - never converted, never advised. Same values as voice.js's
 *  spokenAmount (there was never a dialect problem in "quantity" or "strength"); a private copy so
 *  this file owns its own wording end to end. */
function chatAmount(d, language) {
  const unit = d.strengthUnit || 'mg';
  const strength = d.strengthMg != null ? d.strengthMg + ' ' + (language === 'en' ? CHAT_UNIT_EN[unit] || unit : CHAT_UNIT_AR[unit] || unit) : null;
  const count = d.dosePerAdministration != null ? d.dosePerAdministration : null;
  if (language === 'en') return [count != null ? count + ' dose' + (count === 1 ? '' : 's') : null, strength ? 'strength ' + strength : null].filter(Boolean).join(', ');
  return [count != null ? 'الكمية ' + count : null, strength ? 'تركيز ' + strength : null].filter(Boolean).join('، ');
}

/** "جرعة واحدة" / "جرعتان" / "3 جرعات" / "11 جرعة" - Arabic count agreement for how many DOSE
 *  EVENTS are on today's schedule (never used for the "quantity per administration" above, a
 *  different idea that chatAmount already words without a bare noun). */
function chatDoseCount(n, language) {
  if (language === 'en') return n + ' dose' + (n === 1 ? '' : 's');
  if (n === 1) return 'جرعة واحدة';
  if (n === 2) return 'جرعتان';
  if (n >= 3 && n <= 10) return n + ' جرعات';
  return n + ' جرعة';
}

const byTimeChat = (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt);

/**
 * The whole answer. `doses` = today's tracked doses (null = the backend failed); `alerts` = the
 * patient's alerts as the app read them ({severity, description, reviewStatus}); `hasChat` = the
 * patient's Telegram is linked. Returns { reply, promptDoses } - promptDoses go to Telegram as
 * buttons. Nothing here writes anything.
 */
function webchatReply({ intent, language, doses, alerts, nowIso, hasChat }) {
  const l = language === 'en' ? 'en' : 'ar';
  const C = CHAT[l];
  const out = (reply, promptDoses = []) => ({ reply, promptDoses });

  if (intent === 'help_telegram') return out(C.helpTelegram);
  if (intent === 'help_refill') return out(C.helpRefill);
  if (intent === 'help_general') return out(C.helpGeneral);
  if (intent === 'safety') {
    const list = (Array.isArray(alerts) ? alerts : []).filter((a) => a && a.description);
    if (list.length === 0) return out(C.safetyNone);
    const state = (a) => (a.reviewStatus === 'pending_medical_review' ? C.pending : a.reviewStatus === 'reviewed' ? C.reviewed : C.cleared);
    const severityWord = (a) => (a.severity === 'danger' ? C.severityDanger : a.severity === 'warning' ? C.severityWarning : C.severityInfo);
    // One language per locale (CR-079/D7): a stored description is quoted only when its OWN script
    // matches the reply language - an English reply must never echo a stored Arabic sentence back.
    // When it does not match, this names the alert's OWN severity and review state, both already
    // decided by the deterministic screening layer - never a new judgement, and never "safe" (D23).
    const line = (a) => {
      const quotable = WEBCHAT_ARABIC.test(String(a.description)) === (l === 'ar');
      return '• ' + (quotable ? String(a.description).slice(0, 300) : severityWord(a)) + ' (' + state(a) + ')';
    };
    return out(C.safetyHead + '\n' + list.map(line).join('\n') + '\n' + C.safetyTail);
  }
  if (!needsDoses(intent)) return out(C.unclear);
  if (!Array.isArray(doses)) return out(C.failed);

  if (intent === 'took_it') {
    const t = Date.parse(nowIso);
    const open = doses.filter((d) => d && d.status === WEBCHAT_OPEN && Date.parse(d.scheduledAt) <= t + WEBCHAT_HOUR_MS);
    if (open.length === 0) return out(C.tookIt + C.tookItNoDose);
    if (!hasChat) return out(C.tookIt + C.noChat);
    return out(C.tookIt + C.tookItPrompt, open);
  }

  // next_dose, dose_amount, today, forgot: the SAME dose selection as voice.js's voiceReply (agents/
  // lib/voice.js), reimplemented here so this file needs nothing from it at runtime - only the words
  // are the chat's own written Fusha, never Alexa's spoken Kuwaiti lines (CR-079/D7).
  const all = doses.slice().sort(byTimeChat);
  const open = all.filter((d) => d.status === WEBCHAT_OPEN);
  const t = Date.parse(nowIso);
  const next = open.find((d) => Date.parse(d.scheduledAt) > t) || null;

  if (intent === 'today') {
    if (all.length === 0) return out(C.none);
    const comma = l === 'en' ? ', ' : '، ';
    const word = (d) => (d.status === WEBCHAT_OPEN ? C.statusUpcoming : d.status === 'taken_on_time' ? C.statusTakenOnTime : d.status === 'taken_late' ? C.statusTakenLate : C.statusMissed);
    const lines = all.map((d) => chatTime(d.scheduledAt, l) + ' ' + medNameChat(d) + comma + word(d));
    const head = l === 'en' ? 'Today you have ' + chatDoseCount(all.length, l) + ': ' : 'لديك اليوم ' + chatDoseCount(all.length, l) + ': ';
    return out(head + lines.join('. ') + '.');
  }

  if (intent === 'next_dose') {
    if (!next) return out(C.noneLeft);
    const say = l === 'en'
      ? 'Your next dose is ' + medNameChat(next) + ' at ' + chatTime(next.scheduledAt, l) + '. ' + chatAmount(next, l) + '.'
      : 'جرعتك القادمة ' + medNameChat(next) + ' ' + chatTime(next.scheduledAt, l) + '. ' + chatAmount(next, l) + '.';
    return out(say);
  }

  if (intent === 'dose_amount') {
    // The dose due now (up to an hour early) or else the next one - read as prescribed.
    const due = open.filter((d) => Date.parse(d.scheduledAt) <= t + WEBCHAT_HOUR_MS).sort(byTimeChat).pop() || next;
    if (!due) return out(C.noneLeft);
    const say = l === 'en'
      ? 'As prescribed, ' + medNameChat(due) + ' at ' + chatTime(due.scheduledAt, l) + ': ' + chatAmount(due, l) + '.'
      : 'حسب وصفتك، ' + medNameChat(due) + ' ' + chatTime(due.scheduledAt, l) + ': ' + chatAmount(due, l) + '.';
    return out(say);
  }

  // forgot - which dose(s) passed unrecorded; ALL of them go to the patient's own Telegram chat.
  const passed = open.filter((d) => Date.parse(d.scheduledAt) <= t);
  const nextLine = next
    ? (l === 'en' ? ' Your next dose is ' + medNameChat(next) + ' at ' + chatTime(next.scheduledAt, l) + '.'
                  : ' جرعتك القادمة ' + medNameChat(next) + ' ' + chatTime(next.scheduledAt, l) + '.')
    : '';
  if (passed.length === 0) return out(C.forgotNone + nextLine);
  const last = passed[passed.length - 1];
  const which = l === 'en'
    ? 'The dose that passed its time is ' + medNameChat(last) + ' at ' + chatTime(last.scheduledAt, l) + '.'
    : 'الجرعة التي تجاوزت وقتها ' + medNameChat(last) + ' ' + chatTime(last.scheduledAt, l) + '.';
  return out(which + nextLine + (hasChat ? C.forgotTail : C.forgotNoChat), hasChat ? passed : []);
}

module.exports = { webchatReply, trustWebchatIntent, needsDoses, needsChat, quickIntent, chatTime, chatAmount, WEBCHAT_INTENTS, WEBCHAT_MIN_CONFIDENCE };

/* ===== model contract ===== (agents/scripts/build.js cuts this block out of every Code node)
 * The prompt and the output schema that the n8n node "Gemini: classify the question"
 * (agent-webchat) sends, kept beside WEBCHAT_INTENTS and trustWebchatIntent. agents/eval sends
 * the same two, unchanged. */
const WEBCHAT_PROMPT = `You classify ONE message a patient typed into the Jur'ah app's assistant.
The patient writes Kuwaiti colloquial Arabic first, then Modern Standard Arabic, then English.

Return ONE intent:
- next_dose - when/what is the next dose. «شنو جرعتي الجاية» «متى الدوا الجاي» "what's my next dose"
- dose_amount - how much / how many to take. «كم آخذ» «كم حبة» "how much do I take"
- today - the list of today's medicines or doses. «شنو أدويتي اليوم» «جدولي اليوم»
- forgot - they missed or forgot a dose. «نسيت دواي» «فاتتني الجرعة» "I forgot my medicine"
- took_it - they say they took a dose. «أخذته» «خذيت الدوا» "I took it"
- safety - interactions, safety alerts, whether medicines conflict. «فيه تعارض بين أدويتي؟» «تنبيهات السلامة»
- help_telegram - how to connect or use Telegram or the daily messages. «كيف أربط تيليقرام»
- help_refill - refills, running out, reordering. «كيف أطلب إعادة صرف» «خلص الدوا»
- help_general - what the assistant can do, greetings, thanks. «هلا» «شنو تقدر تسوي»
- unclear - anything else, a medical question, or you are not sure

RULES
1. If you are not confident, return unclear. Never guess.
2. confidence is 0 to 1; below 0.7 the system treats it as unclear anyway.
3. You classify language only. You never answer, never give medical advice, never decide doses or times.`;

const WEBCHAT_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['next_dose', 'dose_amount', 'today', 'forgot', 'took_it', 'safety', 'help_telegram', 'help_refill', 'help_general', 'unclear'] },
    confidence: { type: 'number' },
  },
  required: ['intent', 'confidence'],
};

Object.assign(module.exports, { WEBCHAT_PROMPT, WEBCHAT_SCHEMA });
