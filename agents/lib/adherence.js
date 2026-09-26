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
 * and the doses come from GET /api/agent/patients/{id}/doses?date= (CR-062), TRACKED doses only;
 * the active prescriptions come from GET /api/agent/patients/{id}/prescriptions (CR-062).
 *
 * Rules that live here and nowhere else (docs/AI Agents Acceptance Criteria.md, section 2):
 *   - a status is written only on an explicit reply FROM THE PATIENT'S OWN CHAT (TC-AD-14);
 *   - silence is never a status; this file is only ever run on a reply (TC-AD-10);
 *   - below MIN_CONFIDENCE, or an intent that does not exist, is `unclear` - ask, write nothing;
 *   - a reply that could mean more than one dose is asked about, never guessed (TC-AD-12);
 *   - `missed` only for a dose whose time has come; `taken` never for a dose hours away;
 *   - a report that "the doctor stopped it" NEVER writes by itself (TC-RS-03, AP-05 step 1): it
 *     offers one button per active prescription, plus "none of these", and only a tap on one of
 *     those buttons discontinues anything.
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
 * CR-108 - a CORRECTION tap `c:<doseId>:<word>`, sent only under an Alexa "I recorded ..." notice.
 * Unlike `d:`, it may overwrite a status already recorded with a DIFFERENT word (CR-081/D9; the
 * audit trigger writes each change). A `d:` tap on a recorded dose still refuses, exactly as today.
 */
const CORRECT_PREFIX = 'c:';

/**
 * AP-05 step 1 (TC-RS-03) - a discontinuation confirmation names a PRESCRIPTION, never a dose:
 * `s:<prescriptionId>` for "yes, stop this one", `n:none` for "none of these". The two namespaces
 * (`d:`, `s:`) and the none token never collide: `n:none` starts with neither `d:` nor `s:`, so it
 * can never be read back as a prescription id.
 */
const STOP_PREFIX = 's:';
const STOP_NONE_DATA = 'n:none';

/** A fixed reason: Telegram's 64-byte callback data has no room for the patient's own words, so the
 * quote that first named "the doctor stopped it" is never carried into the write (CR-093, later). */
const DISCONTINUED_REASON = 'Patient confirmed by a Telegram button that the doctor told them to stop this medicine';

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
    confirm_discontinue: 'وش الدواء اللي تبي توقفه؟ اختر من الأزرار تحت 👇',
    discontinue_none: 'تمام، ما وقفنا شي. لو تبي توقف دواء معين قول لي وش هو.',
    no_dose: 'ما لقينا جرعة مفتوحة نسجّل عليها الحين. لو تعتقد فيه شي غلط، راجع طبيبك أو الصيدلاني.',
    tracking_off: 'تتبع الجرعات مو مفعّل لك الحين، فما عندنا شي نسجّله. تقدر تشغّله من التطبيق: الإشعارات، متابعة الجرعات.',
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
    confirm_discontinue: 'Which medicine do you want to stop? Pick from the buttons below 👇',
    discontinue_none: 'Okay, nothing was stopped. Tell me which medicine if you want to stop one.',
    no_dose: 'There is no open dose to record right now. If something looks wrong, check with your doctor or pharmacist.',
    tracking_off: 'Check-ins are not switched on for you right now, so there is nothing to record. You can turn them on from the app: Notifications, Dose check-ins.',
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

/**
 * AP-05 step 2 (TC-AD-12) - the Kuwait date(s) a reply might be about. Between 00:00 and 02:59 a
 * patient is very likely answering about a dose from the night before, so the previous day's open
 * doses are read too; from 03:00 on, only today's. Pure: no clock, only the reply's own timestamp.
 */
function readDates(sentAt) {
  const d = kuwaitDate(sentAt);
  if (!d) return [];
  const hh = Number(kuwaitHHMM(sentAt).slice(0, 2));
  return hh <= 2 ? [previousDate(d), d] : [d];
}

/** The name the patient knows the medicine by: brand first, then generic - from a DOSE row. */
function drugLabel(dose) {
  if (!dose) return '';
  return dose.brandName || dose.genericName || '';
}

/** The same, from a PRESCRIPTION row (types/contracts.ts Prescription.drug). */
function rxLabel(rx) {
  if (!rx || !rx.drug) return '';
  return rx.drug.brandName || rx.drug.genericName || '';
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

/** `d:<doseId>:<intent>` -> { doseId, intent }; `c:<doseId>:<intent>` (CR-108) -> the same, plus
 * `correct: true`; anything else -> null. Both prefixes are 2 characters, so one cut serves both. */
function parseTap(data) {
  const correct = typeof data === 'string' && data.startsWith(CORRECT_PREFIX);
  if (typeof data !== 'string' || !(correct || data.startsWith(TAP_PREFIX))) return null;
  const rest = data.slice(TAP_PREFIX.length); // TAP_PREFIX and CORRECT_PREFIX are both 2 chars
  const cut = rest.lastIndexOf(':');
  if (cut <= 0) return null;
  const doseId = rest.slice(0, cut);
  const intent = rest.slice(cut + 1);
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(doseId) || !TAP_INTENTS.includes(intent)) return null;
  return correct ? { doseId, intent, correct: true } : { doseId, intent };
}

/** The callback data for one quick-reply button. Telegram allows 64 bytes. */
function tapData(doseId, intent) {
  const data = TAP_PREFIX + doseId + ':' + intent;
  if (data.length > 64) throw new Error('callback data over 64 bytes for ' + doseId);
  return data;
}

/** CR-108 - the callback data for one CORRECTION button (an Alexa "I recorded ..." notice). Same
 * shape and the same 64-byte limit as `tapData`, under the `c:` namespace instead of `d:`. */
function correctionTapData(doseId, intent) {
  const data = CORRECT_PREFIX + doseId + ':' + intent;
  if (data.length > 64) throw new Error('callback data over 64 bytes for ' + doseId);
  return data;
}

/**
 * `s:<prescriptionId>` for a stop confirmation. The id must already look like one of our ids
 * (defence in depth: it is checked again against the patient's own prescriptions before anything
 * is written). Telegram allows 64 bytes; this is checked with Buffer.byteLength, not `.length`,
 * so a future non-ASCII id would still be measured correctly.
 */
function stopTapData(prescriptionId) {
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(String(prescriptionId))) throw new Error('not a prescription id: ' + prescriptionId);
  const data = STOP_PREFIX + prescriptionId;
  if (Buffer.byteLength(data) > 64) throw new Error('callback data over 64 bytes for ' + prescriptionId);
  return data;
}

/** `s:<id>` -> { none: false, prescriptionId }; `n:none` -> { none: true }; anything else -> null.
 * `n:none` is checked FIRST, so it can never be misread as a prescription id. */
function parseStopTap(data) {
  if (typeof data !== 'string') return null;
  if (data === STOP_NONE_DATA) return { none: true, prescriptionId: null };
  if (!data.startsWith(STOP_PREFIX)) return null;
  const prescriptionId = data.slice(STOP_PREFIX.length);
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(prescriptionId)) return null;
  return { none: false, prescriptionId };
}

/**
 * Which dose could a TYPED reply be about? Open (not yet recorded) tracked doses only.
 *   - `missed`: a dose whose time has already come;
 *   - anything else: a dose already due, or due within EARLY_GRACE_HOURS.
 * Returns every candidate, most recent first. The caller refuses to guess between two. `doses` may
 * span more than one Kuwait date (AP-05 step 2): each dose's own `scheduledAt` is an absolute
 * instant, so a dose from the day before still sorts and filters correctly by real time.
 */
function candidateDoses({ doses, sentAt, intent }) {
  const t = new Date(sentAt).getTime();
  const horizon = intent === 'missed' ? t : t + EARLY_GRACE_HOURS * HOUR_MS;
  return (doses || [])
    // Rule 3, defence in depth - the backend's own contract already never returns an untracked dose
    // here (docs/API-SURFACE.md), and the database refuses a status on one regardless
    // (dose_untracked_has_no_status / lib/agent/handlers.ts 409 untracked_dose). This file adds its
    // own filter anyway, on the `tracked` field itself, never the status word (rule 3 as written).
    .filter((d) => d && d.tracked !== false)
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
 *   doses         today's (and, across midnight, yesterday's too) TRACKED doses from the backend
 *   prescriptions the patient's ACTIVE prescriptions from the backend (CR-062)
 *   tap           parseTap(...) of a dose quick-reply, or null
 *   stopTap       parseStopTap(...) of a discontinuation-confirm tap, or null (AP-05 step 1)
 *   classification  the model's { intent, confidence, quote }, or null for a tap
 *   trackingOn    CR-092 - true/false from the relay's settings read, or null/undefined when the
 *                 relay did not send it (kept as today's no_dose reply exactly)
 *   caregiverVerified  true/false once the workflow re-checked an ACTIVE caregiver against
 *                 alert-recipients (AP-05 step 3b, TC-AD-16), or undefined when not applicable/not
 *                 (yet) checked - which keeps today's plain caregiver_refused reply
 *
 * Output:
 *   { outcome, intent, dose, writes: [...], askDoses: [...], stopOptions: [...], reply, guardrail,
 *     reason }
 *   writes[i] is { op: 'dose_status', doseId, body } or { op: 'recompute', body } - in order.
 */
function decide({ subjectType, language, sentAt, doses, prescriptions, tap, stopTap, classification, trackingOn, caregiverVerified }) {
  const L = REPLIES[lang(language)];
  const base = { intent: 'unclear', dose: null, writes: [], askDoses: [], stopOptions: [], guardrail: null, reason: null };

  // TC-AD-14 - the role boundary. A caregiver cannot report or discontinue a dose, whatever they
  // wrote or tapped. TC-AD-16 (AP-05 step 3b): a caregiver the workflow could NOT confirm is still
  // active against alert-recipients is dropped silently instead - rule 5, fail closed.
  if (subjectType !== 'patient') {
    if (subjectType === 'caregiver' && caregiverVerified === false) {
      return { ...base, outcome: 'caregiver_unverified', reply: null, guardrail: 'TC-AD-16',
               reason: 'the caregiver could not be confirmed active against alert-recipients' };
    }
    return { ...base, outcome: 'caregiver_refused', reply: L.caregiver, guardrail: 'TC-AD-14',
             reason: 'the chat belongs to a caregiver; only the patient may confirm a dose' };
  }
  if (!kuwaitDate(sentAt)) {
    return { ...base, outcome: 'refused', reply: L.failed, guardrail: 'G10', reason: 'the reply carries no usable timestamp' };
  }

  // AP-05 step 1 (TC-RS-03) - a stop tap names a PRESCRIPTION, checked before anything reads doses.
  if (stopTap) {
    if (stopTap.none) {
      return { ...base, outcome: 'discontinue_none', reply: L.discontinue_none, reason: 'the patient tapped "none of these"' };
    }
    const rx = (prescriptions || []).find((p) => p && p.id === stopTap.prescriptionId && p.status === 'active');
    if (!rx) {
      return { ...base, outcome: 'no_dose', reply: L.no_dose, guardrail: 'G10',
               reason: 'the tapped prescription is not one of this patient\'s active prescriptions' };
    }
    return {
      ...base, outcome: 'discontinue',
      writes: [{ op: 'recompute', body: { prescriptionId: rx.id, reason: 'discontinued', discontinuedReason: DISCONTINUED_REASON } }],
      reply: fill(L.discontinued, rxLabel(rx)),
    };
  }

  // A dose tap names its dose - but the name is checked against the patient's own doses, never trusted.
  let trusted;
  let dose = null;
  if (tap) {
    trusted = { intent: tap.intent, claimed: tap.intent, confidence: 1, quote: '', guardrail: null };
    // Rule 3, defence in depth (candidateDoses above has the same note) - a tap naming an untracked
    // dose's id finds nothing here either, whatever the backend contract already guarantees.
    dose = (doses || []).find((d) => d && d.id === tap.doseId && d.tracked !== false) || null;
    if (!dose) {
      return { ...base, outcome: 'no_dose', reply: L.no_dose, guardrail: 'G10',
               reason: 'the tapped dose is not one of this patient\'s tracked doses' };
    }
    // CR-108: a `c:` correction tap may overwrite a dose already recorded, but only with a
    // DIFFERENT word (CR-081/D9) - the same word taps "already recorded" exactly like a `d:` tap.
    if (dose.status !== OPEN_WORD && (!tap.correct || dose.status === tap.intent)) {
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

  // AP-05 step 1 - discontinued_by_doctor NEVER writes directly: it offers one button per active
  // prescription plus "none of these"; only a tap on one of THOSE buttons discontinues anything.
  if (!dose && intent === 'discontinued_by_doctor') {
    const active = (prescriptions || []).filter((p) => p && p.status === 'active');
    if (active.length === 0) {
      return { ...base, intent, outcome: 'no_dose', reply: L.no_dose, guardrail: 'G10', reason: 'no active prescription to stop' };
    }
    const stopOptions = active.map((p) => ({ prescriptionId: p.id, label: rxLabel(p) }));
    return { ...base, intent, outcome: 'confirm_discontinue', reply: L.confirm_discontinue, stopOptions,
             reason: stopOptions.length + ' active prescription(s) offered for confirmation' };
  }

  if (!dose) {
    const candidates = candidateDoses({ doses, sentAt, intent });
    if (candidates.length === 0) {
      // CR-092 (AP-05 step 4) - nothing open AND the backend told us check-ins are off: say so,
      // instead of the generic "no open dose". trackingOn === null/undefined keeps today's reply.
      if (trackingOn === false) {
        return { ...base, intent, outcome: 'tracking_off', reply: L.tracking_off,
                 reason: 'no open tracked dose, and check-ins are switched off for this patient' };
      }
      return { ...base, intent, outcome: 'no_dose', reply: L.no_dose, guardrail: 'G10', reason: 'no open tracked dose this reply could be about' };
    }
    // TC-AD-12 - more than one open dose (possibly across two Kuwait dates, AP-05 step 2) and a
    // typed report: ask with buttons, never pick one. ran_out picks silently among candidates of
    // the SAME prescription (below), because naming a specific dose does not matter for it - but
    // never guesses which MEDICINE ran out.
    if (candidates.length > 1 && intent !== 'ran_out') {
      return { ...base, intent, outcome: 'ask_which', reply: L.which_dose, askDoses: candidates.slice().reverse(),
               reason: candidates.length + ' open doses could be meant' };
    }
    // A prescription-level report (today, only ran_out reaches here with candidates.length > 1:
    // discontinued_by_doctor already returned above, and every other intent was just asked about)
    // needs ONE prescription behind the candidates - "it ran out" said with two medicines open must
    // not be read as naming whichever candidate happens to sort first.
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

  // ran_out: no status and no write - a refill is the patient's own request through the app.
  return { ...base, outcome: 'ran_out', intent, dose, reply: fill(L.ran_out, drug) };
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
 * `referenceDate` (a Kuwait YYYY-MM-DD) marks a dose from an earlier date - AP-05 step 2's
 * across-midnight "ask which" can mix yesterday's and today's doses, and the patient must be able
 * to tell them apart; omitted (the plain daily check-in, always one date) it marks nothing.
 */
function buildCheckIn({ patientId, chatId, language, doses, referenceDate }) {
  const l = lang(language);
  const open = (doses || []).filter((d) => d && d.status === OPEN_WORD)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  if (open.length === 0) return { patientId, skipped: true, reason: 'no open tracked doses today', messages: [] };
  const labels = l === 'en'
    ? { head: 'Good morning 👋 Your doses today:', taken: 'Taken ✅', late: 'Taken late ⏰', missed: 'Missed ✖', yesterday: 'Yesterday' }
    : { head: 'صباح الخير 👋 جرعاتك اليوم:', taken: 'أخذته ✅', late: 'أخذته متأخر ⏰', missed: 'نسيت ✖', yesterday: 'أمس' };
  const line = (d) => {
    const strength = d.strengthMg != null ? ' ' + d.strengthMg + ' ' + (d.strengthUnit || 'mg') : '';
    const food = d.timingRelativeToFood ? ' · ' + d.timingRelativeToFood : '';
    const day = referenceDate && kuwaitDate(d.scheduledAt) !== referenceDate ? labels.yesterday + ' ' : '';
    return day + kuwaitHHMM(d.scheduledAt) + ' · ' + drugLabel(d) + strength + food;
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

/**
 * CR-108 - the Telegram confirmation for a dose Alexa just recorded: "From your Alexa: I recorded
 * <drug> <HH:MM> as <word> 👍" (the owner asked for a thumbs up at the end), with that ONE dose's
 * three CORRECTION buttons (`c:<doseId>:<word>` - `parseTap`/`decide`, above, let a correction
 * overwrite with a DIFFERENT word). Only ever sent for the one dose the workflow's plan node
 * actually wrote.
 */
function buildVoiceNotice({ chatId, language, dose, status }) {
  const l = lang(language);
  const labels = l === 'en'
    ? { taken: 'Taken ✅', late: 'Taken late ⏰', missed: 'Missed ✖' }
    : { taken: 'أخذته ✅', late: 'أخذته متأخر ⏰', missed: 'نسيت ✖' };
  const word = l === 'en'
    ? { taken_on_time: 'taken', taken_late: 'taken late', missed: 'missed' }
    : { taken_on_time: 'إنك أخذتها', taken_late: 'إنك أخذتها متأخر', missed: 'إنها فاتتك' };
  if (!Object.prototype.hasOwnProperty.call(word, status)) throw new Error('buildVoiceNotice: unknown status ' + status);
  const what = drugLabel(dose) + ' ' + kuwaitHHMM(dose.scheduledAt);
  const text = l === 'en'
    ? 'From your Alexa: I recorded ' + what + ' as ' + word[status] + ' 👍'
    : 'من أليكسا: سجّلت ' + what + ' ' + word[status] + ' 👍';
  return {
    chatId, text,
    buttons: [
      { text: labels.taken, data: correctionTapData(dose.id, RECORDED_WORDS[0]) },
      { text: labels.late, data: correctionTapData(dose.id, RECORDED_WORDS[1]) },
      { text: labels.missed, data: correctionTapData(dose.id, RECORDED_WORDS[2]) },
    ],
  };
}

/**
 * AP-05 step 1 - the confirmation buttons for a discontinuation: one "Stop <drug>?" message per
 * active prescription, each with exactly ONE button, plus a final "none of these" message. Nothing
 * here writes anything; only a tap on one of these buttons (parseStopTap, above) does.
 */
function buildStopOptions({ chatId, language, stopOptions }) {
  const l = lang(language);
  const yes = l === 'en' ? 'Yes, stop it' : 'أي، وقفها';
  const noneText = l === 'en' ? 'None of these' : 'ولا وحدة من هذي';
  const messages = (stopOptions || []).map((o) => ({
    chatId,
    text: l === 'en' ? 'Stop ' + o.label + '?' : 'نوقف ' + o.label + '؟',
    buttons: [{ text: yes, data: stopTapData(o.prescriptionId) }],
  }));
  messages.push({ chatId, text: noneText, buttons: [{ text: noneText, data: STOP_NONE_DATA }] });
  return messages;
}

/**
 * AP-05 step 3a (TC-AD-08) - the daily check-in's plan, pulled out of the Code node so the skip log
 * can recompute the very same thing. Eligibility is the BACKEND's (tracking on AND the latest link
 * connected) - never decided here; this only applies the two plan-time skips: no chat id, and the
 * every-other-day parity (a fixed, documented parity - days since 2026-01-01 even - never a guess
 * per patient). `skipped[i]` is `{ patientId, reason }`, never a chat id (rule 6/7).
 */
function planCheckIns({ eligibility, dayIndex }) {
  const plans = [];
  const skipped = [];
  for (const e of eligibility || []) {
    if (!e || !e.patientId) continue; // not a real row - nothing to attribute a skip to
    if (!e.chatId) { skipped.push({ patientId: e.patientId, reason: 'no_chat_id' }); continue; }
    if (e.frequency === 'every_other_day' && dayIndex % 2 !== 0) { skipped.push({ patientId: e.patientId, reason: 'not_due_today' }); continue; }
    plans.push({ patientId: e.patientId, chatId: e.chatId, language: e.language === 'en' ? 'en' : 'ar' });
  }
  return { plans, skipped };
}

module.exports = {
  decide,
  replyAfterWrites,
  buildCheckIn,
  buildVoiceNotice,
  buildStopOptions,
  planCheckIns,
  trustClassification,
  candidateDoses,
  parseTap,
  tapData,
  correctionTapData,
  parseStopTap,
  stopTapData,
  rxLabel,
  kuwaitDate,
  kuwaitHHMM,
  previousDate,
  readDates,
  REPLIES,
  INTENTS,
  RECORDED_WORDS,
  MIN_CONFIDENCE,
  STOP_NONE_DATA,
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
