'use strict';

/**
 * Jur'ah - free talk with Alexa (CR-070), and CR-108 (the owner, 2026-09-25): voice records a dose
 * again, through the same agent route the Telegram buttons use.
 *
 * Free talk: whatever the patient says after "Alexa, ask medicine helper ..." arrives as one
 * AMAZON.SearchQuery slot; Gemini reads the SENTENCE and returns an intent - and, for "record",
 * which of TODAY's doses the patient named. Gemini decides nothing else: every dose is matched,
 * checked and worded HERE, from the backend's data. This file builds the only voice write URLs
 * (writeFor); only the workflow's "plan (deterministic)" node (agents/scripts/build.js) calls it.
 *
 * Recording is a two-turn conversation, same shape as CR-070 originally shipped:
 *   1. planRecord/recordTurn - each named dose must resolve to exactly one of today's doses, be
 *      OPEN ('upcoming') and due (no more than an hour ahead; a miss only after its own time).
 *      Alexa reads the list back and asks "Shall I? Say yes, or no." Nothing is written yet.
 *   2. confirmRecord - on "yes", the SAME list (carried in Alexa's session attributes) is checked
 *      again against FRESH doses; only what still passes is written. "no" writes nothing.
 * An unresolved, ambiguous, already-recorded or not-yet-due dose is named and skipped, never
 * guessed. A request that names no dose ("mark it taken") is the one dose due now, read back first
 * (this is also how the ar-SA skill's slotless RecordDoseIntent is answered - no model runs for it).
 * If the model gave nothing usable at all (an outage), the AP-02 button fallback stands: the
 * buttons of every open, due dose go to the patient's own Telegram chat instead.
 *
 * «نسيت دواي» (ForgotDoseIntent) is answered by agents/lib/voice.js and does not go through this
 * file's record turns: it names the one dose whose time passed and records it missed directly, with
 * no yes/no step (voice.js forgotTarget, agents/scripts/build.js's plan node).
 *
 * Jur'ah gives no medical advice; nothing here ever says "take it now" or "skip it".
 */

const HOUR_MS_A = 3600 * 1000;
const OPEN_A = ['upcoming'][0];
const RECORD_WORDS = ['taken_on_time', 'taken_late', 'missed'];
const MISSED_A = RECORD_WORDS[2];
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
/** A bare medicine word, never a real name - "mark it taken" names no medicine even though the
 * model may echo "it" or "my medicine" back as `medicine`. Arabic forms too (the ar-SA skill has no
 * free talk, but a future model reply is not assumed to be English-only). */
const GENERIC_NAME = /^(my |the )?(medicine|medicines|medication|medications|meds|pill|pills|tablet|tablets|dose|doses|it|دواي|الدوا|الدواء|جرعتي|الجرعة)$/i;
/**
 * "what are my medicines today" and its asked-for variants, English and Arabic, as whole sentences
 * (alef forms folded). Alexa may strip a leading "what" into FreeTalkIntent's carrier, so the word is optional.
 */
const TODAY_ASKED = [
  /^(what )?(are )?my (medicines|medications|meds) (for )?today$/,
  /^(what |which )?(medicines|medications|meds) (do i take |do i have |are )?(for )?today$/,
  /^(check )?my (medicines|medications|meds) for today$/,
  /^(شنو|وش) (هي )?ادويتي اليوم$/,
];
/**
 * CR-108 - a plain "I forgot" sentence, English, matched whole (no model, no read-back): it goes
 * straight to ForgotDoseIntent, the same as the sample-driven intent, so the ~5 s Gemini round trip
 * never sits in front of the one write that must land inside Alexa's 8-second budget. A sentence
 * that names a dose or is not this plain ("I forgot the evening one") still goes to the model.
 */
const FORGOT_ASKED = [
  /^(i )?(forgot|missed) (my |the )?(dose|doses|medicine|medicines|medication|medications|meds|pill|pills)$/,
  /^(i )?forgot to take (my |the )?(medicine|medicines|medication|medications|meds|pill|pills|dose)$/,
  /^(i )?did not take (my )?(medicine|medicines|medication|medications|meds|pill|pills)$/,
];

/** What Alexa says for a record request (CR-108). Every string is exact - Telegram / Alexa spoken text. */
const ACT = {
  ar: {
    word: { taken_on_time: 'أخذتها', taken_late: 'أخذتها متأخر', missed: 'فاتتك' },
    plan: 'بسجّل: ', confirm: ' تأكد؟ قول نعم، أو لا.', confirmReprompt: 'تأكد؟ قول نعم، أو لا.',
    none: 'ما قدرت أسجّل شي: ', notFound: 'ما لقيت الجرعة اللي قصدتها', ambiguous: 'أكثر من جرعة تطابق كلامك',
    recorded: 'مسجّلة من قبل', notDue: 'وقتها لسه ما جا', nothingDue: 'ما عندك جرعة باقية جا وقتها',
    done: 'تم. سجّلت: ', failed: 'ما قدرت أسجّل: ',
    chatSent: ' أرسلتها لك في تيليقرام.', chatButtons: ' أرسلت لك أزرارها في تيليقرام، سجّلها من هناك.',
    cancelled: 'تمام، ما سجّلت شي.',
    stale: 'ما سجّلت شي: الجرعات تغيّرت من سألتك. اسألني مرة ثانية.',
    unsure: 'ما عرفت أي جرعة تقصد، فأرسلت لك الأزرار في تيليقرام. سجّلها من هناك.',
    noChat: 'ما عرفت أي جرعة تقصد، وتيليقرام مو مربوط عندك.',
    nothingOpen: 'ما عندك جرعة باقية جا وقتها أسجّلها.',
    unreachable: 'ما قدرت أوصل لجدولك الحين. حاول بعد شوي، أو شوف التطبيق.',
    askMore: ' تبي شي ثاني؟', at: ' ', sep: '، ', end: '.',
  },
  en: {
    word: { taken_on_time: 'taken', taken_late: 'taken late', missed: 'missed' },
    plan: 'I will record: ', confirm: ' Shall I? Say yes, or no.', confirmReprompt: 'Shall I? Say yes, or no.',
    none: 'I could not record anything: ', notFound: 'I could not find the dose you meant', ambiguous: 'more than one dose matches what you said',
    recorded: 'already recorded', notDue: 'not due yet', nothingDue: 'there is no open dose due now',
    done: 'Done. I recorded: ', failed: 'I could not record: ',
    chatSent: ' I sent it to your Telegram.', chatButtons: ' I sent its buttons to your Telegram, so you can record it there.',
    cancelled: 'Okay, I did not record anything.',
    stale: 'I did not record anything: those doses changed since I asked. Please ask me again.',
    unsure: 'I could not tell which dose you meant, so I sent the buttons to your Telegram. Please record it there.',
    noChat: 'I could not tell which dose you meant, and your Telegram is not linked.',
    nothingOpen: 'There is no open dose due now for me to record.',
    unreachable: 'I could not reach your schedule right now. Please try again shortly, or check the app.',
    askMore: ' Anything else?', at: ' at ', sep: ', ', end: '.',
  },
};

function kwHHMM(iso) {
  const k = new Date(new Date(iso).getTime() + 3 * HOUR_MS_A);
  return String(k.getUTCHours()).padStart(2, '0') + ':' + String(k.getUTCMinutes()).padStart(2, '0');
}
function medNameA(d) { return d.brandName || d.genericName || ''; }
const byTimeA = (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt);
const L = (language) => ACT[language === 'en' ? 'en' : 'ar'];

/** CR-108 - a request that names no dose ("mark it taken"): the one dose due now, read back first. */
function dueNowItem(status) {
  return { position: null, time: null, medicine: null, status, dueNow: true };
}

/**
 * One item the model returned -> a clean item, or null. Exactly one way of naming the dose is kept.
 * A medicine name that is really just a generic word ("it", "my medicine") counts as no name at
 * all. When nothing is left to name the dose, this is CR-108's "one dose due now" case, not a
 * refusal: `dueNowItem`, resolved later against the fresh schedule (`resolveItem`'s `dueNow` branch).
 */
function cleanItem(x) {
  if (!x || typeof x !== 'object' || !RECORD_WORDS.includes(x.status)) return null;
  const position = Number.isInteger(x.position) && x.position >= 1 && x.position <= MAX_ITEMS ? x.position : null;
  const time = typeof x.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) ? x.time : null;
  const rawMedicine = typeof x.medicine === 'string' ? x.medicine.trim() : '';
  const medicine = rawMedicine.length >= 2 && !GENERIC_NAME.test(rawMedicine) ? rawMedicine.slice(0, 60) : null;
  if (!position && !time && !medicine) return dueNowItem(x.status);
  return { position, time, medicine, status: x.status };
}

/**
 * G11 for free talk: the model's output is trusted only inside the lists and above the floor. A
 * record request may resolve to at most one "due now" item (CR-108: two would be ambiguous, so
 * named items always win over a due-now guess, and more than one due-now item collapses to none).
 * If the model gave no answer at all (an outage, a timeout), a sentence that plainly says what the
 * patient did is still a record request, so it gets read back instead of the help text.
 */
function trustFreeTalk(classification, text) {
  const c = classification && typeof classification === 'object' ? classification : {};
  if (!FREE_INTENTS.includes(c.intent)) {
    const t = String(text || '').toLowerCase();
    return RECORD_TALK.test(t) ? { kind: KIND_FOR_FREE.record, items: [] } : { kind: KIND_FOR_FREE.unclear, items: [] };
  }
  const intent = Number(c.confidence) >= FREE_MIN_CONFIDENCE ? c.intent : 'unclear';
  let items = intent === 'record' && Array.isArray(c.items) ? c.items.slice(0, MAX_ITEMS).map(cleanItem).filter(Boolean) : [];
  if (intent === 'record') {
    const named = items.filter((x) => !x.dueNow);
    items = named.length ? named : (items.length === 1 ? items : []);
  }
  return { kind: KIND_FOR_FREE[intent], items };
}

/**
 * The fast path for free talk (no model call - Alexa waits at most 8 seconds): a plain question
 * answered from the schedule, or a plain "I forgot" sentence (CR-108, FORGOT_ASKED) answered by the
 * ForgotDoseIntent path directly. Anything else that says what the patient DID (took, missed,
 * mark, ...) or is not clearly one question returns null and goes to the model. Conservative on purpose.
 */
function quickFreeTalk(text) {
  const t = String(text || '').toLowerCase().replace(/[?.!,،؟]/g, ' ').replace(/\s+/g, ' ').trim();
  // The asked-for today questions, matched whole (with or without the carrier word Alexa may strip):
  // always today's schedule, never the model, never the record path.
  const bare = t.replace(/[أإآ]/g, 'ا');
  if (TODAY_ASKED.some((re) => re.test(bare))) return 'TodayDosesIntent';
  if (FORGOT_ASKED.some((re) => re.test(bare))) return 'ForgotDoseIntent';
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

/**
 * An item -> exactly one of today's doses, or a reason. Position counts today's doses in time
 * order. CR-108's `dueNow` item ("mark it taken") is resolved differently: the one open dose due
 * now (a miss only from its own time on; anything else up to an hour early) - ambiguous with more
 * than one candidate, `nothingDue` with none, `notFound` when no clock (`nowIso`) was given at all.
 */
function resolveItem(item, doses, nowIso) {
  const all = doses.slice().sort(byTimeA);
  if (item.dueNow) {
    if (!nowIso) return { reason: 'notFound' };
    const horizon = Date.parse(nowIso) + (item.status === MISSED_A ? 0 : HOUR_MS_A);
    const hits = all.filter((d) => d.status === OPEN_A && Date.parse(d.scheduledAt) <= horizon);
    return hits.length === 0 ? { reason: 'nothingDue' } : hits.length > 1 ? { reason: 'ambiguous' } : { dose: hits[0] };
  }
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
 * Which doses' buttons go to the patient's Telegram when CR-108's record turn cannot resolve a
 * single dose to read back (the AP-02 button fallback: an outage, or "I could not tell which dose
 * you meant"). The doses the patient named, each resolved to exactly one of today's doses, and only
 * those still open and due; if the patient named none that resolves, every open dose that is due.
 * In time order. (Kept exactly as AP-02 shipped it - see recordTurn's fallback branch, below.)
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

/** Why a dose cannot be recorded now, or null. `status` is what the patient SAID (a miss is never
 * before the dose's own time, whatever the general one-hour-early grace allows for the rest). */
function blockOf(dose, nowIso, status) {
  if (dose.status !== OPEN_A) return 'recorded';
  if (Date.parse(dose.scheduledAt) > Date.parse(nowIso) + HOUR_MS_A) return 'notDue';
  if (status === MISSED_A && Date.parse(dose.scheduledAt) > Date.parse(nowIso)) return 'notDue';
  return null;
}

function describe(dose, status, language, spokenTime) {
  const S = L(language);
  return medNameA(dose) + (spokenTime ? S.at + spokenTime(dose.scheduledAt, language) : '') + (status ? ' ' + S.word[status] : '');
}

/**
 * Turn 1. items + today's doses -> { speech, pending }. Writes nothing. `spokenTime` is voice.js's,
 * passed in so both files word a time the same way. A `dueNow` item (no dose named) resolves
 * against the FRESH schedule here, same as any other - "mark it taken" is read back like any
 * request that named exactly one dose.
 */
function planRecord({ items, doses, nowIso, language, spokenTime }) {
  const S = L(language);
  if (!Array.isArray(doses)) return { speech: null, pending: [] }; // the caller answers "could not reach your schedule"
  const pending = [];
  const refused = [];
  for (const item of items) {
    const r = resolveItem(item, doses, nowIso);
    if (!r.dose) { refused.push(S[r.reason]); continue; }
    const block = blockOf(r.dose, nowIso, item.status);
    if (block) { refused.push(describe(r.dose, null, language, spokenTime) + ' - ' + S[block]); continue; }
    if (pending.some((p) => p.doseId === r.dose.id)) continue;
    pending.push({ doseId: r.dose.id, prescriptionId: r.dose.prescriptionId, status: item.status });
  }
  const byId = Object.fromEntries(doses.map((d) => [d.id, d]));
  const refusedText = refused.length ? ' ' + S.failed + refused.join(S.sep) + S.end : '';
  if (pending.length === 0) return { speech: S.none + refused.join(S.sep) + S.end, pending: [] };
  const list = pending.map((p) => describe(byId[p.doseId], p.status, language, spokenTime)).join(S.sep);
  return { speech: S.plan + list + S.end + refusedText + S.confirm, pending };
}

/**
 * CR-108's whole turn 1, from the free-talk items (or the ar-SA slotless RecordDoseIntent's single
 * `dueNowItem`) down to what Alexa says and what - if anything - is carried into Alexa's session
 * attributes for turn 2. `doses` null (the backend failed) ends the session with the honest
 * failure. No items at all (the model could not name a dose, or gave nothing usable) falls back to
 * AP-02's buttons: the due doses' three-button messages go to Telegram instead of a read-back.
 */
function recordTurn({ items, doses, nowIso, language, hasChat, spokenTime }) {
  const S = L(language);
  if (!Array.isArray(doses)) return { speech: S.unreachable, endSession: true, promptDoses: [], pending: [] };
  if (!Array.isArray(items) || items.length === 0) {
    if (!hasChat) return { speech: S.noChat + S.askMore, endSession: false, promptDoses: [], pending: [] };
    const promptDoses = recordPromptDoses({ items: [], doses, nowIso });
    if (promptDoses.length === 0) return { speech: S.nothingOpen + S.askMore, endSession: false, promptDoses: [], pending: [] };
    return { speech: S.unsure, endSession: true, promptDoses, pending: [] };
  }
  const r = planRecord({ items, doses, nowIso, language, spokenTime });
  if (r.pending.length === 0) return { speech: r.speech + S.askMore, endSession: false, promptDoses: [], pending: [] };
  return { speech: r.speech, endSession: false, promptDoses: [], pending: r.pending };
}

/** A pending list as it came back in Alexa's session attributes -> a clean list (never trusted as-is). */
function cleanPending(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_ITEMS).filter((p) => p && typeof p === 'object'
    && typeof p.doseId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(p.doseId)
    && typeof p.prescriptionId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(p.prescriptionId)
    && RECORD_WORDS.includes(p.status)).map((p) => ({ doseId: p.doseId, prescriptionId: p.prescriptionId, status: p.status }));
}

/**
 * The ONE place a voice write is built - the same shape the Telegram quick-reply buttons write
 * (agents/lib/adherence.js `decide`'s RECORDED_WORDS branch): the status first, and, only for a
 * miss, the recompute. `status` is always a variable here, never a literal (guard 4 / G1).
 */
function writeFor(dose, status, api, recordedAtIso) {
  return {
    doseId: dose.id, prescriptionId: dose.prescriptionId, status,
    url: api + '/doses/' + encodeURIComponent(dose.id) + '/status',
    body: { status, recordedAt: recordedAtIso, source: 'adherence_agent' },
    recompute: status === MISSED_A
      ? { url: api + '/schedule/recompute', body: { prescriptionId: dose.prescriptionId, reason: 'reported_miss', missedDoseId: dose.id } }
      : null,
  };
}

/**
 * Turn 2 ("yes"). The pending list, checked AGAIN against fresh doses - a dose recorded since, no
 * longer due, or a miss now before its own time is skipped, never written. Every write that
 * survives is exactly the Telegram path's own: writeFor's status call, and its recompute for a miss.
 */
function confirmRecord({ pending, doses, nowIso, api, recordedAtIso }) {
  if (!Array.isArray(doses)) return { writes: [], skipped: cleanPending(pending).map((p) => p.doseId) };
  const byId = Object.fromEntries(doses.map((d) => [d.id, d]));
  const writes = [];
  const skipped = [];
  for (const p of cleanPending(pending)) {
    const d = byId[p.doseId];
    if (!d || d.prescriptionId !== p.prescriptionId || blockOf(d, nowIso, p.status)) { skipped.push(p.doseId); continue; }
    writes.push(writeFor(d, p.status, api, recordedAtIso));
  }
  return { writes, skipped };
}

/**
 * What Alexa says after turn 2's writes actually ran: `codes[i]` is the HTTP status writes[i]'s
 * status call answered (undefined for one that never got a response at all - a timeout counts as
 * failed, never as recorded). Only === 200 counts as done; every other code is grouped with it as
 * failed, so a 409 (recorded elsewhere in the meantime) reads exactly like a network failure - not
 * spoken as success either way.
 */
function confirmedReply({ writes, codes, doses, language, hasChat, spokenTime }) {
  const S = L(language);
  if (!Array.isArray(doses)) return { speech: S.unreachable, endSession: true, promptDoses: [] };
  if (!writes.length) return { speech: S.stale + S.askMore, endSession: false, promptDoses: [] };
  const byId = Object.fromEntries(doses.map((d) => [d.id, d]));
  const ok = [];
  const bad = [];
  writes.forEach((w, i) => {
    const d = byId[w.doseId] || null;
    const line = describe(d || { brandName: w.doseId }, w.status, language, d ? spokenTime : null);
    (codes[i] === 200 ? ok : bad).push({ line, dose: d });
  });
  const parts = [];
  if (ok.length) parts.push(S.done + ok.map((x) => x.line).join(S.sep) + S.end + (hasChat ? S.chatSent : ''));
  if (bad.length) parts.push(S.failed + bad.map((x) => x.line).join(S.sep) + S.end + (hasChat ? S.chatButtons : ''));
  const promptDoses = hasChat ? bad.map((x) => x.dose).filter(Boolean) : [];
  return { speech: parts.join(' ') + S.askMore, endSession: false, promptDoses };
}

module.exports = {
  trustFreeTalk, quickFreeTalk, resolveItem, recordPromptDoses, planRecord, recordTurn, cleanPending,
  writeFor, confirmRecord, confirmedReply, dueNowItem,
  RECORD_WORDS, FREE_INTENTS, FREE_MIN_CONFIDENCE, ACT,
};

/* ===== model contract ===== (agents/scripts/build.js cuts this block out of every Code node)
 * The prompt and the output schema that the n8n node "Gemini: understand the sentence"
 * (agent-alexa) sends, kept beside FREE_INTENTS and trustFreeTalk. agents/eval sends the same
 * two, unchanged. */
const FREE_TALK_PROMPT = `You read ONE sentence a patient said to the Jur'ah voice assistant (usually English, sometimes Arabic).
The sentence may be missing its first word (Alexa keeps it as a carrier), e.g. "is my next dose" means "what is my next dose",
and "should I have my Eltroxin" / "do I need to take my calcium" mean "WHEN should I ..." - that is next_dose.

Return ONE intent:
- next_dose - when/what is the next dose.
- dose_amount - how much / how many to take.
- today - the list of today's medicines or doses, "check my medicines".
- forgot - they forgot or missed a dose but do not say which one.
- record - they say they took a dose, name a dose they took or missed, or ask to mark one, e.g. "mark it taken", "mark the first two taken and
  the third missed", "I took my Eltroxin", "the 7 am one I took late", "I missed the evening calcium".
  Give one item per dose they named, naming it the way THEY did: position (1 = the first dose of today by time),
  or time as "HH:MM" 24-hour, or medicine (the medicine's name as they said it, never a word like medicine, pill or dose).
  If they did not say which dose ("mark it taken", "I took my medicine"), give ONE item with only the status.
  status is taken_on_time (took it, taken, done), taken_late (took it late) or missed (missed, forgot it, did not take it).
- help - what the assistant can do, greetings, thanks.
- unclear - anything else, a medical question, or you are not sure.

RULES
1. If you are not confident, return unclear. Never guess a dose the patient did not name.
2. confidence is 0 to 1; below 0.7 the system treats it as unclear anyway.
3. You read language only. You never answer, never give medical advice, never decide doses or times.`;

const FREE_TALK_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['next_dose', 'dose_amount', 'today', 'forgot', 'record', 'help', 'unclear'] },
    confidence: { type: 'number' },
    items: { type: 'array', items: { type: 'object', properties: {
      position: { type: 'integer' }, time: { type: 'string' }, medicine: { type: 'string' },
      status: { type: 'string', enum: ['taken_on_time', 'taken_late', 'missed'] },
    }, required: ['status'] } },
  },
  required: ['intent', 'confidence'],
};

Object.assign(module.exports, { FREE_TALK_PROMPT, FREE_TALK_SCHEMA });
