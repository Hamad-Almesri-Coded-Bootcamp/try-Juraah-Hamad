'use strict';

/**
 * Jur'ah - the web-app chat assistant's deterministic layer (CR-067). READ-ONLY, patient only.
 *
 * Gemini picks ONE intent from WEBCHAT_INTENTS (and a confidence); this file writes every word the
 * patient reads, from data only:
 *   - dose questions      -> the patient's TRACKED doses of today (GET /api/agent/patients/{id}/doses),
 *                            worded by agents/lib/voice.js so voice and chat never disagree;
 *   - safety questions    -> ONLY the alerts already in the patient's file (read by the app under the
 *                            patient's own session and passed in) - never a new judgement, never
 *                            "it is safe";
 *   - app help            -> fixed text.
 *
 * The chat NEVER records a dose (CLAUDE.md rule 1). "I took it" / "I forgot" name the dose and send
 * its three buttons to the patient's OWN Telegram chat; the tap there records it through the
 * adherence path. CR-068 proposes recording from the chat itself; it is not built.
 *
 * Plain CommonJS, inlined into the n8n Code node after agents/lib/voice.js (whose voiceReply,
 * spokenTime and spokenAmount it uses).
 */

const WEBCHAT_INTENTS = [
  'next_dose', 'dose_amount', 'today', 'forgot', 'took_it', 'safety',
  'help_telegram', 'help_refill', 'help_general', 'unclear',
];
const WEBCHAT_MIN_CONFIDENCE = 0.7;
const WEBCHAT_HOUR_MS = 3600 * 1000;
const WEBCHAT_OPEN = ['upcoming'][0];

/** Chat intent -> the voice intent that already answers it from the doses. */
const VOICE_FOR = { next_dose: 'NextDoseIntent', dose_amount: 'DoseAmountIntent', today: 'TodayDosesIntent', forgot: 'ForgotDoseIntent' };

const CHAT = {
  ar: {
    tookIt: 'ما أقدر أسجّل الجرعة من هنا — التسجيل يصير من محادثتك في تيليقرام فقط. ',
    tookItPrompt: 'أرسلت لك أزرار الجرعة في تيليقرام، اضغط «أخذته» هناك.',
    tookItNoDose: 'ما لقيت جرعة مفتوحة وقتها الحين.',
    noChat: 'تيليقرام مو مربوط عندك، تقدر تربطه من «المزيد ← الإشعارات والمراسلة».',
    safetyNone: 'ما فيه تنبيهات تعارض في ملفك الحين. هذا مو تأكيد بالسلامة — لأي سؤال عن أدويتك اسأل الصيدلاني أو طبيبك.',
    safetyHead: 'هذي التنبيهات الموجودة في ملفك:',
    pending: 'بانتظار مراجعة طبية',
    reviewed: 'راجعها مختص',
    cleared: 'فُحصت',
    safetyTail: 'التفاصيل في «السلامة». جرعة ما تقدّم استشارة طبية — اسأل الصيدلاني أو طبيبك.',
    helpTelegram: 'لربط تيليقرام: «المزيد ← الإشعارات والمراسلة ← افتح تيليقرام»، ثم اضغط Start في البوت. بعدها توصلك رسالة كل صباح بجرعاتك.',
    helpRefill: 'لإعادة الصرف: «المزيد ← تجديد الوصفات»، واختر الدواء. الطلب يروح للجهة اللي صرفت الوصفة.',
    helpGeneral: 'أقدر أجاوبك عن: جرعتك الجاية، كم تاخذ، أدويتك اليوم، تنبيهات السلامة في ملفك، وربط تيليقرام. ما أقدّم استشارة طبية.',
    unclear: 'ما فهمت عليك تمام 🙏 جرّب: «شنو جرعتي الجاية؟» أو «كم آخذ؟» أو «شنو أدويتي اليوم؟».',
    failed: 'ما قدرت أوصل لجدولك الحين. حاول بعد شوي.',
  },
  en: {
    tookIt: 'I can\'t record a dose from here - doses are recorded only from your Telegram chat. ',
    tookItPrompt: 'I sent the dose\'s buttons to your Telegram; tap "Taken" there.',
    tookItNoDose: 'There is no dose open right now.',
    noChat: 'Your Telegram is not linked; you can link it from More → Notifications & messaging.',
    safetyNone: 'There are no interaction alerts in your file right now. This is not a safety clearance - ask your pharmacist or doctor about your medicines.',
    safetyHead: 'These are the alerts in your file:',
    pending: 'awaiting medical review',
    reviewed: 'reviewed by a specialist',
    cleared: 'checked',
    safetyTail: 'Details are under Safety. Jur\'ah gives no medical advice - ask your pharmacist or doctor.',
    helpTelegram: 'To link Telegram: More → Notifications & messaging → Open Telegram, then press Start in the bot. You will get your doses every morning.',
    helpRefill: 'To request a refill: More → Refills, then pick the medicine. The request goes to the place that dispensed it.',
    helpGeneral: 'I can answer: your next dose, how much to take, today\'s medicines, the safety alerts in your file, and linking Telegram. I give no medical advice.',
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
  return Object.prototype.hasOwnProperty.call(VOICE_FOR, intent) || intent === 'took_it';
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
    return out(C.safetyHead + '\n' + list.map((a) => '• ' + String(a.description).slice(0, 300) + ' (' + state(a) + ')').join('\n') + '\n' + C.safetyTail);
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

  // next_dose, dose_amount, today, forgot: the same words Alexa speaks, from the same function.
  const v = voiceReply({ kind: VOICE_FOR[intent], language: l, doses, nowIso, hasChat });
  const reply = v.speech.replace(/ (تبي شي ثاني؟|Anything else\?)$/, '');
  return out(reply, v.promptDoses || []);
}

module.exports = { webchatReply, trustWebchatIntent, needsDoses, needsChat, quickIntent, WEBCHAT_INTENTS, WEBCHAT_MIN_CONFIDENCE };

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
