'use strict';

/**
 * Jur'ah - the Orchestrator's deterministic layer (AP-11, docs/AGENTS-POLISH-PLAN.md 7.3, D6/CR-078).
 *
 * The model answers exactly one narrow question about ONE patient photo: is it a prescription, a
 * medicine package, something else, or is the model not sure. Everything else - which route a
 * message takes, whether a photo's answer is trusted, what a pending "which is it?" choice was and
 * whether it is still good, what the patient reads back - is computed here and unit-tested
 * (agents/test/orchestrator.test.js). Nothing here ever asserts a drug interaction, a dose time or
 * a diagnosis: that stays with adherence, extraction, screening and Travel Check.
 *
 * Routes `route (deterministic)` may return: 'adherence' | 'extraction' | 'photo' | 'travel' |
 * 'reply' | null (dropped). 'photo' means "download it and let the model say what it is"; the vision
 * answer is turned into a decision by `decidePhoto`, never trusted below MIN_ROUTE_CONFIDENCE.
 *
 * Rules that live here and nowhere else:
 *   - a caregiver's message - text, tap, photo or a document - is answered and read no further
 *     (TC-AD-14's boundary extended to photos): no download, no model call, no backend read, and
 *     nothing about it is written to the pending-photo store;
 *   - a photo the model is not confident about is never guessed at: the patient is asked, with two
 *     buttons, and nothing runs against either agent until the patient picks one;
 *   - a pending choice is one-shot, keyed by the patient's own id and the ORIGINAL message id (never
 *     the file id, which never appears in a callback), good for 24 hours, and holds nothing but the
 *     file id, whether it came as a photo or a document, and when it was asked - no caption, no chat
 *     id (rule 6/7);
 *   - a PDF can only be a prescription (Travel Check reads images only, agents/knowledge/README.md),
 *     so it is decided from its mime type, never asked to the model;
 *   - Travel Check's own answer is turned into ONE of a fixed set of lines, chosen by verdict alone -
 *     never a direct instruction to the patient, and a danger finding reads as "sent for review", not
 *     as an all-clear or a guess (PRODUCT-DECISIONS.md D23: the model classifies, code decides).
 *
 * Plain CommonJS, no dependencies but agents/lib/adherence.js (for the caregiver words the app
 * already shows on every other channel), no clock: `now` always comes from the caller. The build
 * inlines this file, after adherence.js, into n8n Code nodes (agents/scripts/build.js).
 */

const { REPLIES } = require('./adherence.js');

/** G-style floor for the photo classifier: below this, "prescription" or "medicine_package" is not
 * a decision - it is treated exactly like the model saying "unsure" itself. */
const MIN_ROUTE_CONFIDENCE = 0.7;

/** The four answers PHOTO_SCHEMA allows; anything else the model invents is unknown, not unsure. */
const PHOTO_KINDS = ['prescription', 'medicine_package', 'other', 'unsure'];

/** A pending "which is it?" choice: one-shot, 24 hours, capped, keyed by patient id + message id. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const PENDING_CAP = 100;

/** Telegram allows 64 bytes of callback data. `or:rx:` / `or:box:` + a message id never gets close.
 * Named distinctly from adherence.js's own `d:` tap prefix - both files share one Code-node scope. */
const ROUTE_TAP_PREFIX = { rx: 'or:rx:', box: 'or:box:' };
const MESSAGE_ID = /^[0-9]{1,19}$/;

/** Named distinctly from adherence.js's own `lang` - both files share one Code-node scope. */
const langOf = (l) => (l === 'en' ? 'en' : 'ar');

const ORCH_TEXT = {
  ar: {
    caregiver_photo: 'شكراً لك 🙏 الصور الطبية يرسلها المريض بنفسه فقط من محادثته.',
    other_reply: 'هذي ما تبين إنها وصفة طبية ولا علبة دواء، فما قدرنا نساعدك فيها من هنا. لو تبي تسأل عن دواء، صوّر الوصفة أو علبة الدواء نفسها.',
    unsure_question: 'ما قدرنا نتأكد وش نوع الصورة. اختر من الأزرار تحت 👇',
    photo_expired: 'خلص وقت هذا الطلب. ابعث الصورة مرة ثانية لو تبي نكمل.',
    file_problem: 'ما قدرنا نفتح الملف اللي بعثته. جرب تبعثه مرة ثانية.',
    choice_rx: 'وصفة طبية 📄',
    choice_box: 'علبة دواء 📦',
    travel_review: 'لقينا احتمال تعارض مهم. رفعناه لمراجعة طبية، تقدر تشوفه من التطبيق.',
    travel_interaction_found: 'لقينا تعارض محتمل مع دوا من أدويتك. تقدر تشوف التفاصيل من التطبيق واسأل الصيدلاني.',
    travel_cannot_verify: 'ما قدرنا نتأكد من هذا الدواء مقابل أدويتك. اسأل الصيدلاني قبل لا تاخذه.',
    travel_could_not_identify: 'ما قدرنا نتعرف على الدواء من الصورة. جرب صورة أوضح أو اكتب اسم الدواء المطبوع عليه.',
    travel_no_interaction: 'ما لقينا تعارض مسجل مع أدويتك. هذا مو معناه إنه آمن مية بالمية، اسأل الصيدلاني لو ما تكفّي.',
    travel_already_taking: 'يبين هذا نفس الدواء اللي تاخذه حالياً من وصفة عندك. لا تاخذ جرعة زايدة، وراجع طبيبك لو محتاج كمية أكثر.',
    travel_failed: 'صار خلل عندنا وما قدرنا نفحص الصورة الحين. حاول مرة ثانية بعد شوي، أو اسأل الصيدلاني.',
  },
  en: {
    caregiver_photo: 'Thank you 🙏 Only the patient can send a medicine photo, from their own chat.',
    other_reply: 'This does not look like a prescription or a medicine package, so we cannot help with it here. To ask about a medicine, send a photo of the prescription or of the medicine package itself.',
    unsure_question: 'We could not tell what this photo is. Please choose below 👇',
    photo_expired: 'This request has expired. Please send the photo again if you would like to continue.',
    file_problem: 'We could not open the file you sent. Please try sending it again.',
    choice_rx: 'A prescription 📄',
    choice_box: 'A medicine box 📦',
    travel_review: 'We found a possible important interaction. It has been sent for medical review; you can see it in the app.',
    travel_interaction_found: 'We found a possible interaction with one of your medicines. You can see the details in the app, and ask your pharmacist.',
    travel_cannot_verify: 'We cannot verify this medicine against your medicines. Ask your pharmacist before taking it.',
    travel_could_not_identify: 'We could not identify the medicine from the photo. Try a clearer photo, or type the printed name of the medicine.',
    travel_no_interaction: 'No interaction is recorded against your medicines. This is not a clearance that it is safe; ask your pharmacist if you are unsure.',
    travel_already_taking: 'This looks like the same medicine you already take on an existing prescription. Do not take an extra dose, and check with your doctor if you need more.',
    travel_failed: 'Something went wrong on our side and we could not check the photo. Please try again shortly, or ask your pharmacist.',
  },
};

/** Text and taps reuse adherence.js's own caregiver line; photos and documents get their own. */
function caregiverReply(kind, language) {
  const l = langOf(language);
  if (kind === 'photo' || kind === 'document') return ORCH_TEXT[l].caregiver_photo;
  return REPLIES[l].caregiver;
}

// ------------------------------------------------------------------------------ the pending store
/** n8n's `$getWorkflowStaticData('global')` (or any plain object the caller persists). Never thrown
 * on a missing store: a store-less call simply cannot remember or resume anything. */
function pendingMap(store) {
  if (!store || typeof store !== 'object') return null;
  if (!store.orchestratorPending || typeof store.orchestratorPending !== 'object') store.orchestratorPending = {};
  return store.orchestratorPending;
}
const pendingKey = (patientId, messageId) => String(patientId) + ':' + String(messageId);

/**
 * Remember an unsure photo so a later tap can resume it. Stores only what re-downloading and
 * re-classifying it needs - never a caption, never a chat id (rule 6/7).
 */
function rememberPhoto(store, patientId, messageId, fileId, kind, now) {
  const map = pendingMap(store);
  if (!map) return null;
  const key = pendingKey(patientId, messageId);
  map[key] = { fileId: String(fileId), kind: kind === 'document' ? 'document' : 'photo', time: typeof now === 'number' ? now : Date.now() };
  const keys = Object.keys(map);
  if (keys.length > PENDING_CAP) {
    keys.sort((a, b) => (map[a].time || 0) - (map[b].time || 0));
    for (let i = 0; i < keys.length - PENDING_CAP; i += 1) delete map[keys[i]];
  }
  return key;
}

/** One-shot: gone whether it was found, expired, or never existed - a second tap always finds nothing. */
function takePhoto(store, patientId, messageId, now) {
  const map = pendingMap(store);
  if (!map) return null;
  const key = pendingKey(patientId, messageId);
  const entry = map[key];
  delete map[key];
  if (!entry) return null;
  const t = typeof now === 'number' ? now : Date.now();
  if (typeof entry.time !== 'number' || t - entry.time > PENDING_TTL_MS) return null;
  return entry;
}

// ------------------------------------------------------------------------------ the choice tap
/** `or:rx:<messageId>` / `or:box:<messageId>` -> { choice, messageId }, or null for anything else. */
function parseRouteTap(data) {
  if (typeof data !== 'string') return null;
  for (const choice of Object.keys(ROUTE_TAP_PREFIX)) {
    const prefix = ROUTE_TAP_PREFIX[choice];
    if (data.startsWith(prefix)) {
      const messageId = data.slice(prefix.length);
      return MESSAGE_ID.test(messageId) ? { choice, messageId } : null;
    }
  }
  return null;
}

/** The two buttons for an unsure photo, keyed by the ORIGINAL message id (never the file id). */
function choiceButtons(messageId, language) {
  const L = ORCH_TEXT[langOf(language)];
  const rx = ROUTE_TAP_PREFIX.rx + String(messageId);
  const box = ROUTE_TAP_PREFIX.box + String(messageId);
  if (rx.length > 64 || box.length > 64) throw new Error('callback data over 64 bytes for ' + messageId);
  return [{ text: L.choice_rx, data: rx }, { text: L.choice_box, data: box }];
}

// ------------------------------------------------------------------------------ the photo question
const PHOTO_IMAGE_TYPES = /^image\/(jpeg|png|webp|heic|heif)$/;
const PHOTO_PDF_TYPE = 'application/pdf';
/** The Telegram download is a raw buffer, not base64: the same 15 MB agents/lib/extraction.js allows. */
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

const PHOTO_PROMPT = `You are shown ONE photo a patient sent in a medication-safety chat. Decide what kind of photo it is - nothing else.

Return ONE kind:
- prescription - a doctor's or pharmacy's prescription, a handwritten or printed medical note with dosing instructions
- medicine_package - a medicine box, bottle, strip or its label, with no prescriber's dosing instructions on it
- other - anything else: a person, a room, a receipt, a document that is neither of the above
- unsure - you cannot tell, the photo is unclear or cropped, or it could reasonably be more than one of the above

RULES
1. If you are not confident, return unsure. Never guess: a wrong guess sends the photo down the wrong path.
2. confidence is 0 to 1. Below 0.7 the system treats your answer as unsure anyway, so do not inflate it.
3. You classify the photo only. Do not read a drug name, a dose or a person's identity here.`;

const PHOTO_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: PHOTO_KINDS },
    confidence: { type: 'number' },
  },
  required: ['kind', 'confidence'],
};

/**
 * Build the classification request for a downloaded photo, or decide without asking at all.
 *   -> { ok:true, mimeShortcut:null, visionBody } for an image: ask the model.
 *   -> { ok:true, mimeShortcut:'prescription', visionBody:null } for a PDF: Travel Check reads
 *      images only, so a PDF can only be a prescription - decided here, never by the model.
 *   -> { ok:false, reason } for anything empty, oversized, or of a type neither of the above reads.
 */
function photoQuestion(mime, buffer) {
  const m = typeof mime === 'string' ? mime.toLowerCase() : '';
  const size = buffer && typeof buffer.length === 'number' ? buffer.length : 0;
  if (!buffer || size === 0) return { ok: false, reason: 'file_not_downloaded' };
  if (size > MAX_PHOTO_BYTES) return { ok: false, reason: 'file_too_large' };
  if (m === PHOTO_PDF_TYPE) return { ok: true, mimeShortcut: 'prescription', visionBody: null };
  if (!PHOTO_IMAGE_TYPES.test(m)) return { ok: false, reason: 'unsupported_file' };
  return {
    ok: true,
    mimeShortcut: null,
    visionBody: {
      contents: [{ role: 'user', parts: [{ text: PHOTO_PROMPT }, { inlineData: { mimeType: m, data: buffer.toString('base64') } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: PHOTO_SCHEMA },
    },
  };
}

/**
 * THE DETERMINISTIC LAYER for the photo question. Below the floor, an unknown kind, a confidence
 * that is not a finite number in [0, 1], a finish reason other than STOP, an unparsable answer, or
 * an HTTP status other than 200 - every one of these is 'unsure', never a guess.
 */
function decidePhoto(res) {
  const unsure = (guardrail, claimed, confidence) => ({ kind: 'unsure', confidence: Number.isFinite(confidence) ? confidence : 0, claimed: claimed || null, guardrail });
  if (!res || res.statusCode !== 200) return unsure('http_' + (res ? res.statusCode : 'none'));
  let finishReason = null;
  let text = '';
  try {
    const c = res.body.candidates[0];
    finishReason = c.finishReason || null;
    text = c.content.parts.map((p) => p.text || '').join('');
  } catch (e) { text = ''; }
  if (finishReason !== 'STOP') return unsure('finish_' + finishReason);
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
  const claimed = parsed && typeof parsed === 'object' ? parsed.kind : null;
  const confidence = parsed && typeof parsed === 'object' ? Number(parsed.confidence) : NaN;
  if (!PHOTO_KINDS.includes(claimed)) return unsure('unknown_kind', claimed, confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return unsure('bad_confidence', claimed);
  if (claimed !== 'unsure' && confidence < MIN_ROUTE_CONFIDENCE) return unsure('below_floor', claimed, confidence);
  return { kind: claimed, confidence, claimed, guardrail: null };
}

// ------------------------------------------------------------------------------ the reply
/**
 * The one Code node every non-agent outcome ends at, whichever of the two upstream nodes fed it:
 * a caregiver or an expired tap (straight from `route (deterministic)`), or other/unsure/a file
 * problem (from `decide (deterministic)`, after the photo was downloaded and classified).
 */
function orchestratorReply({ reason, kind, language, messageId }) {
  const L = ORCH_TEXT[langOf(language)];
  if (reason === 'caregiver') return { text: caregiverReply(kind, language), buttons: null };
  if (reason === 'photo_expired') return { text: L.photo_expired, buttons: null };
  if (reason === 'other') return { text: L.other_reply, buttons: null };
  if (reason === 'unsure') return { text: L.unsure_question, buttons: choiceButtons(messageId, language) };
  return { text: L.file_problem, buttons: null }; // file_not_downloaded | file_too_large | unsupported_file
}

// ------------------------------------------------------------------------------ travel check
/** The body `jurah/travel-check` (agents/knowledge) documents: { patientId, imageBase64, mimeType, language }. */
function travelBody({ patientId, imageBase64, mimeType, language }) {
  return { patientId, imageBase64, mimeType, language: langOf(language) };
}

/**
 * Travel Check's own answer -> ONE fixed line, chosen by verdict alone. A danger finding (an
 * alertId, or a non-accepted danger that still must escalate) never reads as an instruction to the
 * patient - it points at the app's own review. Anything the workflow could not complete cleanly
 * (a bad HTTP status, ok:false, mustEscalate, or a verdict this file does not know) is a failure
 * line, never an all-clear: PRODUCT-DECISIONS.md - unknown always means refuse.
 */
function travelReply({ statusCode, body, language }) {
  const L = ORCH_TEXT[langOf(language)];
  const b = body && typeof body === 'object' ? body : {};
  if (statusCode !== 200 || b.ok !== true || b.mustEscalate) return L.travel_failed;
  if (b.alertId) return L.travel_review;
  if (b.verdict === 'interaction_found') return L.travel_interaction_found;
  if (b.verdict === 'cannot_verify') return L.travel_cannot_verify;
  if (b.verdict === 'could_not_identify' || b.verdict === 'needs_confirmation') return L.travel_could_not_identify;
  if (b.verdict === 'no_interaction_found') return L.travel_no_interaction;
  if (b.verdict === 'already_taking') return L.travel_already_taking;
  return L.travel_failed;
}

// ------------------------------------------------------------------------------ routing
/** A `/start` (with or without the bot's @username) - the relay already drops this (lib/messaging/
 * telegram.ts); refused again here so this file is correct standing alone. */
const START_TEXT = /^\/start(?:@|\s|$)/;

/**
 * THE ROUTE. Everything the relay (CR-063) forwards decides which agent, if any, this message goes
 * to - nothing here reads a dose, a drug or a photo's content; that happens after, on the route this
 * function names.
 *
 *   payload   the relay's own body (channel, subjectType, patientId, chatId, language, kind, text,
 *             photoFileId, documentFileId, callbackQueryId, sentAt, messageId - lib/messaging/telegram.ts)
 *   store     the pending-photo map (n8n's `$getWorkflowStaticData('global')`), or undefined
 *   now       the caller's own clock (ms since epoch) - this file has none of its own
 *
 * -> 'adherence' | 'extraction' | 'photo' | 'travel' | 'reply' | null
 */
function routeInbound(payload, opts) {
  const p = payload || {};
  const o = opts || {};
  const nowMs = typeof o.now === 'number' ? o.now : Date.now();

  // Rule 1 - a caregiver, whatever they sent: answered, and read no further (TC-AD-14, extended).
  if (p.subjectType !== 'patient') return 'reply';

  // Rule 4 - resuming an earlier "which is it?" choice. Only ever reached for the patient's own tap.
  if (p.kind === 'callback') {
    const tap = parseRouteTap(p.text);
    if (!tap) return 'adherence'; // a d:<doseId>:<intent> tap (or anything else): the unchanged path
    const entry = takePhoto(o.store, p.patientId, tap.messageId, nowMs);
    // Side channel: the caller needs the remembered file id and kind to re-download it, and this
    // was the only chance to take it (one-shot) - set whether or not it was found.
    o.resumedFile = entry || null;
    if (!entry) return 'reply'; // already taken, from another patient's photo, or older than 24h
    return tap.choice === 'rx' ? 'extraction' : 'travel';
  }

  // Rule 5.
  if (typeof p.text === 'string' && START_TEXT.test(p.text.trim())) return null;

  // Rule 2/3 - a photo, or anything sent as a document. A PDF is decided from its mime type once
  // downloaded (photoQuestion), never guessed here from the file id alone.
  if (p.photoFileId || p.documentFileId) return 'photo';

  // Rule 6.
  return 'adherence';
}

module.exports = {
  MIN_ROUTE_CONFIDENCE,
  PHOTO_KINDS,
  PHOTO_PROMPT,
  PHOTO_SCHEMA,
  ORCH_TEXT,
  routeInbound,
  photoQuestion,
  decidePhoto,
  choiceButtons,
  parseRouteTap,
  rememberPhoto,
  takePhoto,
  caregiverReply,
  orchestratorReply,
  travelBody,
  travelReply,
};
