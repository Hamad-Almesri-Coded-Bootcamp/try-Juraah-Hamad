'use strict';

/**
 * Jur'ah - free talk with Alexa (the agents track's CR-070), and what voice does with a request
 * to record a dose (CR-073).
 *
 * Free talk: whatever the patient says after "Alexa, ask medicine helper ..." arrives as one
 * AMAZON.SearchQuery slot; Gemini reads the SENTENCE and returns an intent - and, for "record",
 * which of TODAY's doses the patient named. Gemini decides nothing else: every dose is matched
 * and every word is chosen HERE, from the backend's data.
 *
 * VOICE RECORDS NOTHING (CR-073 reverses CR-070's recording; CLAUDE.md rule 1, TC-AD-14/15). An Echo
 * sits in a room and cannot tell the patient from anyone else in it, and a dose status comes only
 * from the patient's own Telegram chat. A record request ("mark it taken", "I took the first two and
 * missed the third") is answered with one fixed line - voice cannot record, the buttons are in
 * Telegram - and the three buttons of the doses the patient meant are sent to the patient's own
 * chat, where one tap records through the adherence path. This file builds no URL and no write body.
 * Jur'ah gives no medical advice; nothing here says "take it now".
 */

const HOUR_MS_A = 3600 * 1000;
const OPEN_A = ['upcoming'][0];
const RECORD_WORDS = ['taken_on_time', 'taken_late', 'missed'];
const FREE_INTENTS = ['next_dose', 'dose_amount', 'today', 'forgot', 'record', 'help', 'unclear'];
const FREE_MIN_CONFIDENCE = 0.7;
/** The model's intent -> the voice kind voice.js already answers (record is answered here). */
const KIND_FOR_FREE = {
  next_dose: 'NextDoseIntent', dose_amount: 'DoseAmountIntent', today: 'TodayDosesIntent', forgot: 'ForgotDoseIntent',
  help: 'AMAZON.HelpIntent', unclear: 'AMAZON.FallbackIntent', record: 'record',
};
const MAX_ITEMS = 10;
/** Words that say what the patient DID with a dose. Used only when the model gave no answer at all. */
const RECORD_TALK = /\b(took|taken|missed|skipped|mark|record|log)\b/;
/**
 * "What are my medicines today" and its asked-for variants, English and Arabic, as whole sentences
 * (alef forms folded). Alexa may strip a leading "what" into FreeTalkIntent's carrier, so the word is optional.
 */
const TODAY_ASKED = [
  /^(what )?(are )?my (medicines|medications|meds) (for )?today$/,
  /^(what |which )?(medicines|medications|meds) (do i take |do i have |are )?(for )?today$/,
  /^(check )?my (medicines|medications|meds) for today$/,
  /^(شنو|وش) (هي )?ادويتي اليوم$/,
];

/** What Alexa says to a record request. The first line is the fixed CR-073 answer. */
const ACT = {
  ar: {
    sent: 'ما أقدر أسجّل بالصوت، أرسلت لك الأزرار في تيليقرام. أكّد منها بنفسك.',
    noChat: 'ما أقدر أسجّل بالصوت، وتيليقرام مو مربوط عندك، فسجّلها من محادثتك لما تربطها.',
    nothingOpen: 'ما أقدر أسجّل بالصوت، وما عندك جرعة باقية جا وقتها عشان أرسل أزرارها في تيليقرام.',
    failed: 'ما أقدر أسجّل بالصوت، وما قدرت أوصل لجدولك الحين عشان أرسل لك الأزرار. حاول بعد شوي، أو شوف التطبيق.',
    askMore: ' تبي شي ثاني؟',
  },
  en: {
    sent: 'I can\'t record by voice; I\'ve sent the buttons to your Telegram. Please confirm there yourself.',
    noChat: 'I can\'t record by voice, and your Telegram is not linked, so record it from your chat once it is.',
    nothingOpen: 'I can\'t record by voice, and there is no open dose due now, so I sent nothing to your Telegram.',
    failed: 'I can\'t record by voice, and I could not reach your schedule to send the buttons. Please try again shortly, or check the app.',
    askMore: ' Anything else?',
  },
};

function kwHHMM(iso) {
  const k = new Date(new Date(iso).getTime() + 3 * HOUR_MS_A);
  return String(k.getUTCHours()).padStart(2, '0') + ':' + String(k.getUTCMinutes()).padStart(2, '0');
}
const byTimeA = (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt);
const L = (language) => ACT[language === 'en' ? 'en' : 'ar'];

/** One item the model returned -> a clean item, or null. Exactly one way of naming the dose is kept. */
function cleanItem(x) {
  if (!x || typeof x !== 'object' || !RECORD_WORDS.includes(x.status)) return null;
  const position = Number.isInteger(x.position) && x.position >= 1 && x.position <= MAX_ITEMS ? x.position : null;
  const time = typeof x.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) ? x.time : null;
  const medicine = typeof x.medicine === 'string' && x.medicine.trim().length >= 2 ? x.medicine.trim().slice(0, 60) : null;
  if (!position && !time && !medicine) return null;
  return { position, time, medicine, status: x.status };
}

/**
 * G11 for free talk: the model's output is trusted only inside the lists and above the floor.
 * A record request needs no named dose ("mark it taken"): nothing is written from it, and with no
 * dose named the buttons go to every open dose that is due. If the model gave no answer at all
 * (an outage, a timeout), a sentence that plainly says what the patient did is still a record
 * request, so it gets the fixed answer instead of the help text.
 */
function trustFreeTalk(classification, text) {
  const c = classification && typeof classification === 'object' ? classification : {};
  if (!FREE_INTENTS.includes(c.intent)) {
    const t = String(text || '').toLowerCase();
    return RECORD_TALK.test(t) ? { kind: KIND_FOR_FREE.record, items: [] } : { kind: KIND_FOR_FREE.unclear, items: [] };
  }
  const intent = Number(c.confidence) >= FREE_MIN_CONFIDENCE ? c.intent : 'unclear';
  const items = intent === 'record' && Array.isArray(c.items) ? c.items.slice(0, MAX_ITEMS).map(cleanItem).filter(Boolean) : [];
  return { kind: KIND_FOR_FREE[intent], items };
}

/**
 * The fast path for free talk (no model call - Alexa waits at most 8 seconds): a plain question
 * answered from the schedule. Anything that says what the patient DID (took, missed, mark, ...)
 * or is not clearly one question returns null and goes to the model. Conservative on purpose.
 */
function quickFreeTalk(text) {
  const t = String(text || '').toLowerCase().replace(/[?.!,،؟]/g, ' ').replace(/\s+/g, ' ').trim();
  // The asked-for today questions, matched whole (with or without the carrier word Alexa may strip):
  // always today's schedule, never the model, never the record path.
  const bare = t.replace(/[أإآ]/g, 'ا');
  if (TODAY_ASKED.some((re) => re.test(bare))) return 'TodayDosesIntent';
  if (!t || /\b(took|taken|missed|miss|forgot|forget|skipped|mark|record|log|didn't|did not|not)\b/.test(t)) return null;
  // Another day is not today's schedule: the model reads it (today's answer is never given for it).
  if (/\b(tomorrow|yesterday|next week)\b/.test(t)) return null;
  const hits = [];
  // Alexa keeps the carrier word ("when ...") out of the slot: "should I have my eltroxin" is the same question.
  if (/\bnext (dose|medicine|medication|pill)\b|\bwhen (do|should|will|can|must) i\b.*\b(take|have)\b|^(do|should|can|must|will) i (need to |have to )?(take|have)\b|\bwhen is my\b|\bwhat time\b/.test(t)) hits.push('NextDoseIntent');
  if (/\bhow (much|many)\b|\bwhat (is|s) the dose\b|\bdose amount\b/.test(t)) hits.push('DoseAmountIntent');
  if (/\btoday\b|\bschedule\b|\bmy (medicines|medications|meds|doses)\b|\bthe list\b/.test(t)) hits.push('TodayDosesIntent');
  return hits.length === 1 ? hits[0] : null;
}

/** An item -> exactly one of today's doses, or a reason. Position counts today's doses in time order. */
function resolveItem(item, doses) {
  const all = doses.slice().sort(byTimeA);
  let hits = [];
  if (item.position) hits = all[item.position - 1] ? [all[item.position - 1]] : [];
  else if (item.time) hits = all.filter((d) => kwHHMM(d.scheduledAt) === item.time);
  if (item.medicine && (item.time || !item.position)) {
    const m = item.medicine.toLowerCase();
    const named = (item.time ? hits : all).filter((d) => [d.brandName, d.genericName].some((n) => n && (n.toLowerCase().includes(m) || m.includes(n.toLowerCase()))));
    hits = named;
    // "my calcium" with two calcium doses today: the open one wins, else ambiguous.
    if (hits.length > 1) {
      const openDue = hits.filter((d) => d.status === OPEN_A);
      if (openDue.length === 1) hits = openDue;
    }
  }
  if (hits.length === 0) return { reason: 'notFound' };
  if (hits.length > 1) return { reason: 'ambiguous' };
  return { dose: hits[0] };
}

/** Open, and due: its time has come, or comes within the hour. */
function openAndDue(dose, nowIso) {
  return dose.status === OPEN_A && Date.parse(dose.scheduledAt) <= Date.parse(nowIso) + HOUR_MS_A;
}

/**
 * Which doses' buttons go to the patient's Telegram for a record request. The doses the patient
 * named, each resolved to exactly one of today's doses, and only those still open and due; if the
 * patient named none that resolves ("mark it taken"), every open dose that is due. In time order.
 */
function recordPromptDoses({ items, doses, nowIso }) {
  if (!Array.isArray(doses)) return [];
  const named = [];
  for (const item of Array.isArray(items) ? items : []) {
    const r = resolveItem(item, doses);
    if (r.dose && !named.some((d) => d.id === r.dose.id)) named.push(r.dose);
  }
  const chosen = named.length ? named : doses;
  return chosen.filter((d) => openAndDue(d, nowIso)).sort(byTimeA);
}

/**
 * A record request -> { speech, endSession, promptDoses }. Nothing is written: the speech is the fixed
 * line, and promptDoses are the doses whose buttons the workflow sends to the patient's own chat.
 * `doses` is null when the backend could not be read.
 */
function recordReply({ items, doses, nowIso, language, hasChat }) {
  const S = L(language);
  if (!Array.isArray(doses)) return { speech: S.failed, endSession: true, promptDoses: [] };
  if (!hasChat) return { speech: S.noChat, endSession: true, promptDoses: [] };
  const promptDoses = recordPromptDoses({ items, doses, nowIso });
  if (promptDoses.length === 0) return { speech: S.nothingOpen + S.askMore, endSession: false, promptDoses: [] };
  return { speech: S.sent, endSession: true, promptDoses };
}

module.exports = {
  trustFreeTalk, quickFreeTalk, resolveItem, recordPromptDoses, recordReply,
  RECORD_WORDS, FREE_INTENTS, FREE_MIN_CONFIDENCE, ACT,
};
