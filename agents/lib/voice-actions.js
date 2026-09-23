'use strict';

/**
 * Jur'ah - CR-070, free talk and dose actions by voice (the AI-agents track's call for the demo).
 *
 * Free talk: whatever the patient says after "Alexa, ask medicine helper ..." arrives as one
 * AMAZON.SearchQuery slot; Gemini reads the SENTENCE and returns an intent - and, for "record",
 * which of TODAY's doses the patient named and what they said about each. Gemini decides nothing
 * else: every dose is matched, checked and worded HERE, from the backend's data.
 *
 * Recording (ONLY when the workflow's VOICE_RECORDS switch is on - the repository ships it OFF,
 * because TC-AD-14/15 and CLAUDE.md rule 1 say a dose status comes only from the patient's own
 * chat; the live demo node turns it on):
 *   1. planRecord  - each named dose must resolve to exactly one of today's doses, be OPEN
 *                    ('upcoming') and due (no more than an hour ahead); Alexa reads the list back and
 *                    asks for "yes". Nothing is written on this turn.
 *   2. confirmRecord - on "yes", the SAME list (carried in Alexa's session attributes) is checked
 *                    again against fresh doses; only what still passes is written, through the same
 *                    agent route the Telegram buttons use, and a miss is recomputed as they are.
 * Unknown means refuse: an unresolved, ambiguous, recorded or not-yet-due dose is named and skipped.
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

const ACT = {
  ar: {
    word: { taken_on_time: 'أخذتها', taken_late: 'أخذتها متأخر', missed: 'فاتتك' },
    plan: 'بسجّل: ', confirm: ' تأكد؟ قول نعم، أو لا.',
    none: 'ما قدرت أسجّل شي: ', notFound: 'ما لقيت الجرعة اللي قصدتها', ambiguous: 'أكثر من جرعة تطابق كلامك',
    recorded: 'مسجّلة من قبل', notDue: 'وقتها لسه ما جا', done: 'تم. سجّلت: ', failed: 'ما قدرت أسجّل: ',
    cancelled: 'تمام، ما سجّلت شي.', off: 'التسجيل بالصوت مو مفعّل. أرسل لك الأزرار في تيليقرام بدالها؟',
    at: ' ', sep: '، ', end: '.', nothingPending: 'ما عندي شي أسجّله. قول مثلاً: سجّل أول جرعة أخذتها.',
  },
  en: {
    word: { taken_on_time: 'taken', taken_late: 'taken late', missed: 'missed' },
    plan: 'I will record: ', confirm: ' Shall I? Say yes, or no.',
    none: 'I could not record anything: ', notFound: 'I could not find the dose you meant', ambiguous: 'more than one dose matches what you said',
    recorded: 'already recorded', notDue: 'not due yet', done: 'Done. I recorded: ', failed: 'I could not record: ',
    cancelled: 'Okay, I did not record anything.', off: 'Recording by voice is turned off.',
    at: ' at ', sep: ', ', end: '.', nothingPending: 'There is nothing for me to record. Say, for example: mark the first dose taken.',
  },
};

function kwHHMM(iso) {
  const k = new Date(new Date(iso).getTime() + 3 * HOUR_MS_A);
  return String(k.getUTCHours()).padStart(2, '0') + ':' + String(k.getUTCMinutes()).padStart(2, '0');
}
function medNameA(d) { return d.brandName || d.genericName || ''; }
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

/** G11 for free talk: the model's output is trusted only inside the lists and above the floor. */
function trustFreeTalk(classification) {
  const c = classification && typeof classification === 'object' ? classification : {};
  const intent = FREE_INTENTS.includes(c.intent) && Number(c.confidence) >= FREE_MIN_CONFIDENCE ? c.intent : 'unclear';
  const items = Array.isArray(c.items) ? c.items.slice(0, MAX_ITEMS).map(cleanItem).filter(Boolean) : [];
  if (intent === 'record' && items.length === 0) return { kind: KIND_FOR_FREE.unclear, items: [] };
  return { kind: KIND_FOR_FREE[intent], items: intent === 'record' ? items : [] };
}

/**
 * The fast path for free talk (no model call - Alexa waits at most 8 seconds): a plain question
 * answered from the schedule. Anything that says what the patient DID (took, missed, mark, ...)
 * or is not clearly one question returns null and goes to the model. Conservative on purpose.
 */
function quickFreeTalk(text) {
  const t = String(text || '').toLowerCase().replace(/[?.!,،؟]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || /\b(took|taken|missed|miss|forgot|forget|skipped|mark|record|log|didn't|did not|not)\b/.test(t)) return null;
  const hits = [];
  if (/\bnext (dose|medicine|medication|pill)\b|\bwhen (do|should|will|can|must) i\b.*\btake\b|\bwhen is my\b|\bwhat time\b/.test(t)) hits.push('NextDoseIntent');
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
    // "my calcium" with two calcium doses today: the one due now (open and not in the future) wins, else ambiguous.
    if (hits.length > 1) {
      const openDue = hits.filter((d) => d.status === OPEN_A);
      if (openDue.length === 1) hits = openDue;
    }
  }
  if (hits.length === 0) return { reason: 'notFound' };
  if (hits.length > 1) return { reason: 'ambiguous' };
  return { dose: hits[0] };
}

/** Why a dose cannot be recorded now, or null. */
function blockOf(dose, nowIso) {
  if (dose.status !== OPEN_A) return 'recorded';
  if (Date.parse(dose.scheduledAt) > Date.parse(nowIso) + HOUR_MS_A) return 'notDue';
  return null;
}

function describe(dose, status, language, spokenTime) {
  const S = L(language);
  return medNameA(dose) + (spokenTime ? S.at + spokenTime(dose.scheduledAt, language) : '') + (status ? ' ' + S.word[status] : '');
}

/**
 * Turn 1. items + today's doses -> { speech, pending, endSession:false }. Writes nothing.
 * `spokenTime` is voice.js's, passed in so both files word a time the same way.
 */
function planRecord({ items, doses, nowIso, language, spokenTime }) {
  const S = L(language);
  if (!Array.isArray(doses)) return { speech: null, pending: [] }; // the caller answers "could not reach your schedule"
  const pending = [];
  const refused = [];
  for (const item of items) {
    const r = resolveItem(item, doses);
    if (!r.dose) { refused.push(S[r.reason]); continue; }
    const block = blockOf(r.dose, nowIso);
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

/** A pending list as it came back in Alexa's session attributes -> a clean list (never trusted as-is). */
function cleanPending(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_ITEMS).filter((p) => p && typeof p === 'object'
    && typeof p.doseId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(p.doseId)
    && typeof p.prescriptionId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(p.prescriptionId)
    && RECORD_WORDS.includes(p.status)).map((p) => ({ doseId: p.doseId, prescriptionId: p.prescriptionId, status: p.status }));
}

/**
 * Turn 2 ("yes"). The pending list, checked AGAIN against fresh doses -> the writes, each exactly
 * the Telegram path's two calls: the status, and a recompute for a miss.
 */
function confirmRecord({ pending, doses, nowIso, api, recordedAtIso }) {
  if (!Array.isArray(doses)) return { writes: [], skipped: cleanPending(pending).map((p) => p.doseId) };
  const byId = Object.fromEntries(doses.map((d) => [d.id, d]));
  const writes = [];
  const skipped = [];
  for (const p of cleanPending(pending)) {
    const d = byId[p.doseId];
    if (!d || d.prescriptionId !== p.prescriptionId || blockOf(d, nowIso)) { skipped.push(p.doseId); continue; }
    writes.push({
      doseId: d.id, status: p.status,
      url: api + '/doses/' + encodeURIComponent(d.id) + '/status',
      body: { status: p.status, recordedAt: recordedAtIso, source: 'adherence_agent' },
      recompute: p.status === 'missed' ? { url: api + '/schedule/recompute', body: { prescriptionId: d.prescriptionId, reason: 'reported_miss', missedDoseId: d.id } } : null,
    });
  }
  return { writes, skipped };
}

/** What Alexa says after the writes: what was recorded, and honestly what was not. */
function recordedSpeech({ writes, results, doses, language, spokenTime }) {
  const S = L(language);
  const byId = Object.fromEntries((doses || []).map((d) => [d.id, d]));
  const ok = [];
  const bad = [];
  writes.forEach((w, i) => {
    const code = results[i];
    const line = describe(byId[w.doseId] || { brandName: w.doseId }, w.status, language, byId[w.doseId] ? spokenTime : null);
    (code === 200 ? ok : bad).push(line);
  });
  const parts = [];
  if (ok.length) parts.push(S.done + ok.join(S.sep) + S.end);
  if (bad.length) parts.push(S.failed + bad.join(S.sep) + S.end);
  if (!parts.length) parts.push(S.nothingPending);
  return parts.join(' ');
}

module.exports = {
  trustFreeTalk, quickFreeTalk, planRecord, cleanPending, confirmRecord, recordedSpeech, resolveItem,
  RECORD_WORDS, FREE_INTENTS, FREE_MIN_CONFIDENCE, ACT,
};
