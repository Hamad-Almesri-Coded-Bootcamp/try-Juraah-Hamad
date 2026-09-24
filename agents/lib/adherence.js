'use strict';

/**
 * Jur'ah - the Adherence Agent's deterministic layer, against the Phase 2 backend.
 *
 * The model reads one short reply and returns { intent, confidence, quote }. It decides nothing
 * else. Which dose the reply is about, whether the classification is trusted, what is written,
 * what the patient reads back - all of it is computed here and unit-tested (agents/test).
 *
 * What the backend accepts (docs/API-SURFACE.md section B):
 *   POST /api/agent/doses/{id}/status   { status, recordedAt, source: 'adherence_agent' }
 *   POST /api/agent/schedule/recompute  { prescriptionId, reason: 'reported_miss', missedDoseId }
 *                                       { prescriptionId, reason: 'discontinued', discontinuedReason }
 * and the doses come from GET /api/agent/patients/{id}/doses?date= (CR-062), TRACKED doses only.
 *
 * Rules that live here and nowhere else (docs/AI Agents Acceptance Criteria.md, section 2):
 *   - a status is written only on an explicit reply FROM THE PATIENT'S OWN CHAT (TC-AD-14);
 *   - silence is never a status; this file is only ever run on a reply (TC-AD-10);
 *   - below MIN_CONFIDENCE, or an intent that does not exist, is `unclear` - ask, write nothing;
 *   - a reply that could mean more than one dose is asked about, never guessed (TC-AD-12);
 *   - `missed` only for a dose whose time has come; `taken` never for a dose hours away.
 *
 * Plain CommonJS, no dependencies, no clock: every time comes from the reply's own timestamp.
 * The build inlines this file into an n8n Code node (agents/scripts/build.js).
 */

const HOUR_MS = 3600 * 1000;
const KUWAIT_OFFSET_HOURS = 3;

/** G11 - below this the model's answer is not a decision, whatever it says. */
const MIN_CONFIDENCE = 0.7;

/** The six intent classes of the spec. Anything else the model invents is `unclear`. */
const INTENTS = ['taken_on_time', 'taken_late', 'missed', 'ran_out', 'discontinued_by_doctor', 'unclear'];

/**
 * The backend's recorded dose words (lib/agent/validate.ts RECORDED_DOSE_WORDS), and the one word
 * a dose carries before anything is recorded. Arrays, never `status:` literals (guard 4).
 */
const RECORDED_WORDS = ['taken_on_time', 'taken_late', 'missed'];
const OPEN_WORD = ['upcoming'][0];

/** A patient may take a dose a little before its time; further ahead than this is not "this dose". */
const EARLY_GRACE_HOURS = 1;

/** Quick-reply taps carry `d:<doseId>:<intent>` - the dose is named, never inferred. */
const TAP_PREFIX = 'd:';
const TAP_INTENTS = ['taken_on_time', 'taken_late', 'missed'];

/**
 * What the patient reads. Chosen by outcome, never written by a model, so no branch can produce
 * free text and none can tell anyone a medicine is safe. `ar` is Kuwaiti; `en` for Patient.language.
 */
const REPLIES = {
  ar: {
    taken_on_time: 'تمام، سجّلنا إنك أخذت جرعة {drug} في وقتها ✅',
    taken_late: 'سجّلناها متأخرة ✅ ({drug}). حاول تاخذ الجاية بوقتها.',
    missed: 'سجّلنا إن جرعة {drug} فاتتك. رتّبنا باقي جدولك على نفس المواعيد ⏳',
    missed_no_recompute: 'سجّلنا إن جرعة {drug} فاتتك. جدولك ما تغيّر.',
    ran_out: 'فهمنا إن {drug} خلص. تقدر تطلب إعادة صرف من التطبيق (الأدوية ← إعادة الصرف).',
    discontinued: 'تمام، أوقفنا جرعات {drug} الجاية. راجع دكتورك أو الصيدلاني لو عندك سؤال.',
    unclear: 'ما فهمت عليك تمام 🙏 اضغط على الزر تحت الجرعة، أو اكتب: «أخذته» أو «أخذته متأخر» أو «نسيت».',
    which_dose: 'عندك أكثر من جرعة مفتوحة الحين. اختر الجرعة من الأزرار تحت 👇',
    no_dose: 'ما لقينا جرعة مفتوحة نسجّل عليها الحين. لو تعتقد فيه شي غلط، راجع طبيبك أو الصيدلاني.',
    already: 'هذي الجرعة مسجّلة من قبل ✅',
    failed: 'صار خلل عندنا وما قدرنا نسجّل الحين. حاول مرة ثانية بعد شوي.',
    caregiver: 'شكراً لك 🙏 الجرعات يسجّلها المريض بنفسه فقط من محادثته. تقدر تتابع جدوله من التطبيق.',
  },
  en: {
    taken_on_time: 'Done - your {drug} dose is recorded as taken on time ✅',
    taken_late: 'Recorded as taken late ✅ ({drug}). Try to take the next one on time.',
    missed: 'Recorded: you missed your {drug} dose. The rest of your schedule keeps its times ⏳',
    missed_no_recompute: 'Recorded: you missed your {drug} dose. Your schedule has not changed.',
    ran_out: 'Understood - your {drug} has run out. You can request a refill in the app (Medicines → Refill).',
    discontinued: 'Done - we stopped the upcoming {drug} doses. Ask your doctor or pharmacist if you have questions.',
    unclear: 'Sorry, I did not catch that 🙏 Tap a button under the dose, or write: "taken", "taken late" or "missed".',
    which_dose: 'You have more than one open dose right now. Pick the dose with the buttons below 👇',
    no_dose: 'There is no open dose to record right now. If something looks wrong, check with your doctor or pharmacist.',
    already: 'That dose is already recorded ✅',
    failed: 'Something went wrong on our side and nothing was recorded. Please try again shortly.',
    caregiver: 'Thank you 🙏 Only the patient can confirm a dose, from their own chat. You can follow the schedule in the app.',
  },
};

const lang = (l) => (l === 'en' ? 'en' : 'ar');
const fill = (template, drug) => template.replace('{drug}', drug || '');

/** YYYY-MM-DD in Kuwait (UTC+3 all year, no DST). Computed, never formatted by a locale library. */
function kuwaitDate(isoString) {
  const t = new Date(isoString).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + KUWAIT_OFFSET_HOURS * HOUR_MS).toISOString().slice(0, 10);
}

/** HH:MM in Kuwait. */
function kuwaitHHMM(isoString) {
  const t = new Date(isoString).getTime();
  if (Number.isNaN(t)) return null;
  const k = new Date(t + KUWAIT_OFFSET_HOURS * HOUR_MS);
  return String(k.getUTCHours()).padStart(2, '0') + ':' + String(k.getUTCMinutes()).padStart(2, '0');
}

/** The Kuwait date before `isoDate` (YYYY-MM-DD). */
function previousDate(isoDate) {
  const t = Date.parse(isoDate + 'T00:00:00Z');
  return new Date(t - 24 * HOUR_MS).toISOString().slice(0, 10);
}

/** The name the patient knows the medicine by: brand first, then generic. */
function drugLabel(dose) {
  if (!dose) return '';
  return dose.brandName || dose.genericName || '';
}

/**
 * G11 - trust the model only inside the whitelist and above the floor. Everything else is
 * `unclear`, and `unclear` writes nothing.
 */
function trustClassification({ intent, confidence, quote }, minConfidence = MIN_CONFIDENCE) {
  const claimed = String(intent == null ? 'unclear' : intent);
  const score = Number(confidence);
  const known = INTENTS.includes(claimed);
  const confident = Number.isFinite(score) && score >= minConfidence;
  if (known && confident) return { intent: claimed, claimed, confidence: score, quote: String(quote || ''), guardrail: null };
  return {
    intent: 'unclear',
    claimed,
    confidence: Number.isFinite(score) ? score : 0,
    quote: String(quote || ''),
    guardrail: 'G11',
  };
}

/** `d:<doseId>:<intent>` -> { doseId, intent }, or null for anything else. */
function parseTap(data) {
  if (typeof data !== 'string' || !data.startsWith(TAP_PREFIX)) return null;
  const rest = data.slice(TAP_PREFIX.length);
  const cut = rest.lastIndexOf(':');
  if (cut <= 0) return null;
  const doseId = rest.slice(0, cut);
  const intent = rest.slice(cut + 1);
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(doseId) || !TAP_INTENTS.includes(intent)) return null;
  return { doseId, intent };
}

/** The callback data for one quick-reply button. Telegram allows 64 bytes. */
function tapData(doseId, intent) {
  const data = TAP_PREFIX + doseId + ':' + intent;
  if (data.length > 64) throw new Error('callback data over 64 bytes for ' + doseId);
  return data;
}

/**
 * Which dose could a TYPED reply be about? Open (not yet recorded) tracked doses only.
 *   - `missed`: a dose whose time has already come;
 *   - anything else: a dose already due, or due within EARLY_GRACE_HOURS.
 * Returns every candidate, most recent first. The caller refuses to guess between two.
 */
function candidateDoses({ doses, sentAt, intent }) {
  const t = new Date(sentAt).getTime();
  const horizon = intent === 'missed' ? t : t + EARLY_GRACE_HOURS * HOUR_MS;
  return (doses || [])
    .filter((d) => d && d.status === OPEN_WORD)
    .filter((d) => new Date(d.scheduledAt).getTime() <= horizon)
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));
}

/**
 * THE decision. Input is everything the workflow knows; output is the complete, closed list of
 * what may happen next - nothing outside `writes` is ever sent to the backend.
 *
 *   subjectType   'patient' | 'caregiver' (from the relay - the chat's owner, resolved server-side)
 *   language      'ar' | 'en'
 *   sentAt        the reply's own Telegram timestamp (ISO)
 *   doses         today's (and, for a tap, the tapped day's) TRACKED doses from the backend
 *   tap           parseTap(...) of a quick-reply, or null for typed text
 *   classification  the model's { intent, confidence, quote }, or null for a tap
 *
 * Output:
 *   { outcome, intent, dose, writes: [...], reply, guardrail, reason, askDoses: [...] }
 *   writes[i] is { op: 'dose_status', doseId, body } or { op: 'recompute', body } - in order.
 */
function decide({ subjectType, language, sentAt, doses, tap, classification }) {
  const L = REPLIES[lang(language)];
  const base = { intent: 'unclear', dose: null, writes: [], askDoses: [], guardrail: null, reason: null };

  // TC-AD-14 - the role boundary. A caregiver cannot report a dose, whatever they wrote or tapped.
  if (subjectType !== 'patient') {
    return { ...base, outcome: 'caregiver_refused', reply: L.caregiver, guardrail: 'TC-AD-14',
             reason: 'the chat belongs to a caregiver; only the patient may confirm a dose' };
  }
  if (!kuwaitDate(sentAt)) {
    return { ...base, outcome: 'refused', reply: L.failed, guardrail: 'G10', reason: 'the reply carries no usable timestamp' };
  }

  // A tap names its dose - but the name is checked against the patient's own doses, never trusted.
  let trusted;
  let dose = null;
  if (tap) {
    trusted = { intent: tap.intent, claimed: tap.intent, confidence: 1, quote: '', guardrail: null };
    dose = (doses || []).find((d) => d && d.id === tap.doseId) || null;
    if (!dose) {
      return { ...base, outcome: 'no_dose', reply: L.no_dose, guardrail: 'G10',
               reason: 'the tapped dose is not one of this patient\'s tracked doses' };
    }
    if (dose.status !== OPEN_WORD) {
      return { ...base, outcome: 'already_recorded', dose, reply: L.already, reason: 'the tapped dose already carries ' + dose.status };
    }
    if (tap.intent === 'missed' && new Date(dose.scheduledAt).getTime() > new Date(sentAt).getTime()) {
      return { ...base, outcome: 'refused', dose, reply: L.no_dose, guardrail: 'G10', reason: 'a dose cannot be missed before its time' };
    }
  } else {
    trusted = trustClassification(classification || {});
  }

  const intent = trusted.intent;
  if (intent === 'unclear') {
    return { ...base, outcome: 'unclear', reply: L.unclear, guardrail: trusted.guardrail,
             reason: trusted.guardrail ? 'confidence or intent not trusted (claimed ' + trusted.claimed + ' @ ' + trusted.confidence + ')' : 'the reply is not an adherence answer' };
  }

  if (!dose) {
    const candidates = candidateDoses({ doses, sentAt, intent });
    if (candidates.length === 0) {
      return { ...base, intent, outcome: 'no_dose', reply: L.no_dose, guardrail: 'G10', reason: 'no open tracked dose this reply could be about' };
    }
    // TC-AD-12 - two open doses and a typed "I took it": ask with buttons, never pick one.
    if (candidates.length > 1 && intent !== 'ran_out' && intent !== 'discontinued_by_doctor') {
      return { ...base, intent, outcome: 'ask_which', reply: L.which_dose, askDoses: candidates.slice().reverse(),
               reason: candidates.length + ' open doses could be meant' };
    }
    // A prescription-level report needs ONE prescription behind the candidates.
    if (candidates.length > 1) {
      const rxIds = [...new Set(candidates.map((d) => d.prescriptionId))];
      if (rxIds.length > 1) {
        return { ...base, intent, outcome: 'ask_which', reply: L.unclear, askDoses: [],
                 reason: 'the report names no medicine and ' + rxIds.length + ' prescriptions are open' };
      }
    }
    dose = candidates[0];
  }

  const drug = drugLabel(dose);
  const recordedAt = new Date(sentAt).toISOString();
  const statusBody = (word) => ({ status: word, recordedAt, source: 'adherence_agent' });

  if (RECORDED_WORDS.includes(intent)) {
    const writes = [{ op: 'dose_status', doseId: dose.id, body: statusBody(intent) }];
    // TC-RS-01 - a reported miss is recorded FIRST, then the engine recomputes (it refuses otherwise).
    if (intent === RECORDED_WORDS[2]) {
      writes.push({ op: 'recompute', body: { prescriptionId: dose.prescriptionId, reason: 'reported_miss', missedDoseId: dose.id } });
    }
    return { ...base, outcome: 'record', intent, dose, writes, reply: fill(L[intent], drug), quote: trusted.quote };
  }

  if (intent === 'ran_out') {
    // No status and no write: a refill is the patient's request through the app (requestRefill).
    return { ...base, outcome: 'ran_out', intent, dose, reply: fill(L.ran_out, drug) };
  }

  // discontinued_by_doctor - TC-RS-03. Cancels the remaining doses of ONE prescription, with the
  // patient's own words as the reason (rx_discontinued_complete requires one).
  const quote = trusted.quote ? ': «' + trusted.quote.slice(0, 200) + '»' : '';
  return {
    ...base, outcome: 'discontinue', intent, dose,
    writes: [{ op: 'recompute', body: { prescriptionId: dose.prescriptionId, reason: 'discontinued',
                                         discontinuedReason: 'Patient reported in chat that the doctor stopped it' + quote } }],
    reply: fill(L.discontinued, drug),
  };
}

/**
 * The reply after the writes ran. A write the backend refused must never read as "recorded".
 *   results[i] is { statusCode } for writes[i], in order; a missing result means it never ran.
 */
function replyAfterWrites(decision, results, language) {
  const L = REPLIES[lang(language)];
  const drug = drugLabel(decision.dose);
  const writes = decision.writes || [];
  if (writes.length === 0) return { reply: decision.reply, recorded: false };
  const ok = (i) => results && results[i] && results[i].statusCode >= 200 && results[i].statusCode < 300;
  if (writes[0].op === 'dose_status' && !ok(0)) {
    const code = results && results[0] ? results[0].statusCode : null;
    return { reply: code === 409 ? L.no_dose : L.failed, recorded: false };
  }
  if (writes[0].op === 'recompute' && !ok(0)) return { reply: L.failed, recorded: false };
  // The miss IS recorded; only the recompute failed or refused - say exactly that much.
  if (writes.length > 1 && !ok(1)) return { reply: fill(L.missed_no_recompute, drug), recorded: true };
  return { reply: decision.reply, recorded: true };
}

/**
 * The daily check-in for one patient: a header, then one message per open dose with three
 * quick-reply buttons naming that dose (TC-AD-07/12). Times and names come from the data only.
 */
function buildCheckIn({ patientId, chatId, language, doses }) {
  const l = lang(language);
  const open = (doses || []).filter((d) => d && d.status === OPEN_WORD)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  if (open.length === 0) return { patientId, skipped: true, reason: 'no open tracked doses today', messages: [] };
  const labels = l === 'en'
    ? { head: 'Good morning 👋 Your doses today:', taken: 'Taken ✅', late: 'Taken late ⏰', missed: 'Missed ✖' }
    : { head: 'صباح الخير 👋 جرعاتك اليوم:', taken: 'أخذته ✅', late: 'أخذته متأخر ⏰', missed: 'نسيت ✖' };
  const line = (d) => {
    const strength = d.strengthMg != null ? ' ' + d.strengthMg + ' ' + (d.strengthUnit || 'mg') : '';
    const food = d.timingRelativeToFood ? ' — ' + d.timingRelativeToFood : '';
    return kuwaitHHMM(d.scheduledAt) + ' · ' + drugLabel(d) + strength + food;
  };
  const messages = [{ chatId, text: labels.head + '\n' + open.map((d) => '• ' + line(d)).join('\n'), buttons: null }];
  for (const d of open) {
    messages.push({
      chatId,
      text: line(d),
      buttons: [
        { text: labels.taken, data: tapData(d.id, 'taken_on_time') },
        { text: labels.late, data: tapData(d.id, 'taken_late') },
        { text: labels.missed, data: tapData(d.id, 'missed') },
      ],
      doseId: d.id,
    });
  }
  return { patientId, skipped: false, reason: null, messages };
}

module.exports = {
  decide,
  replyAfterWrites,
  buildCheckIn,
  trustClassification,
  candidateDoses,
  parseTap,
  tapData,
  kuwaitDate,
  kuwaitHHMM,
  previousDate,
  REPLIES,
  INTENTS,
  RECORDED_WORDS,
  MIN_CONFIDENCE,
};

/* ===== model contract ===== (agents/scripts/build.js cuts this block out of every Code node)
 * The prompt and the output schema that the n8n node "Gemini: classify the reply"
 * (agent-telegram-inbound) sends, kept beside INTENTS and trustClassification. agents/eval
 * sends the same two, unchanged. */
const CLASSIFY_PROMPT = `You classify ONE short reply from a patient about a medicine dose.
The patient writes Kuwaiti colloquial Arabic first, then Modern Standard Arabic, then English.

Return ONE intent:
- taken_on_time - they took it on time. «أخذته» «خذيته» «تناولته» «اخذتها»
- taken_late - they took it, but late. «أخذته متأخر» «خذيته بس متأخر شوي» «تأخرت شوي»
- missed - they did not take it. «ما خذيته» «نسيت» «نسيت أخذه» «فاتتني»
- ran_out - the medicine has run out. «خلص الدوا» «ما بقى عندي» «انتهى»
- discontinued_by_doctor - a doctor told them to stop. «دكتوري قال أوقف الدواء» «الدكتور وقفه»
- unclear - anything else, a question, or you are not sure

RULES
1. If you are not confident, return unclear. Never guess: a wrong guess changes a medical record.
2. confidence is 0 to 1. Below 0.7 the system treats it as unclear anyway, so do not inflate it.
3. quote is the exact words that made you decide. Copy them, do not paraphrase.
4. You classify language only. You never decide times, doses or schedules, and you never answer a medical question.`;

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['taken_on_time', 'taken_late', 'missed', 'ran_out', 'discontinued_by_doctor', 'unclear'] },
    confidence: { type: 'number' },
    quote: { type: 'string' },
  },
  required: ['intent', 'confidence', 'quote'],
};

Object.assign(module.exports, { CLASSIFY_PROMPT, CLASSIFY_SCHEMA });
