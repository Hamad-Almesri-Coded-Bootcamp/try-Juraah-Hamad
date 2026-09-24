'use strict';
const { toPrescriptionBody, RESPONSE_SCHEMA, PROMPT, CRITICAL_CONFIDENCE, CONFIDENCE_KEYS, FLAGGABLE } = require('../knowledge/src/extraction.js');

/**
 * Jur'ah - the Telegram channel's part of the Prescription Extraction Agent (AP-03/D3/CR-075).
 *
 * The deterministic reading of a prescription photo - what a "clear" record is, which fields are
 * FLAGGABLE, the confidence floor, the caption rule - lives once, in the drug-knowledge core
 * (../knowledge/src/extraction.js), which both the app and Telegram now call. This file keeps only
 * what is specific to talking to a patient over Telegram:
 *   - readVision(res)            turns the raw Gemini HTTP response into a model reading or a named
 *                                 failure reason (an outage, a truncated/blocked answer, unparseable
 *                                 or malformed JSON) - never silently "not a prescription" (AP-03).
 *   - extractFromTelegram(...)   the file problem or the vision failure short-circuits to `unreadable`
 *                                 with its reason; otherwise the core decides, exactly as the app does.
 *   - extractionReply(...)       what the patient reads, in the register Telegram uses (CR-079).
 */

/**
 * readVision(res) -> { model, reason }
 *   res  the Gemini HTTP response node's full-response item: { statusCode, body }
 * A non-200, a non-STOP finishReason, unparseable JSON or an answer with no boolean isPrescription
 * are every named failure reason; only then is `model` the parsed reading, `reason` null.
 */
function readVision(res) {
  const status = res && res.statusCode;
  if (status !== 200) return { model: null, reason: 'vision_http_' + status };
  let finishReason;
  let text;
  try {
    finishReason = res.body.candidates[0].finishReason;
    if (finishReason !== 'STOP') return { model: null, reason: 'vision_finish_' + (finishReason || 'none') };
    text = res.body.candidates[0].content.parts.map((p) => p.text || '').join('');
  } catch (e) {
    return { model: null, reason: 'vision_unparseable' };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { model: null, reason: 'vision_unparseable' };
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.isPrescription !== 'boolean') {
    return { model: null, reason: 'vision_answer_malformed' };
  }
  return { model: parsed, reason: null };
}

/**
 * extractFromTelegram({ patientId, res, caption, fileProblem })
 *   fileProblem  set when the file itself could not be used (too large, unsupported, not downloaded);
 *                short-circuits before the vision response is even read.
 * A model error or truncated answer is `unreadable` with its reason named - never `not_a_prescription`.
 * Only a parsed isPrescription:false can ever become `not_a_prescription` (that check is the core's).
 */
function extractFromTelegram({ patientId, res, caption, fileProblem }) {
  if (fileProblem) return { ok: false, code: 'unreadable', reason: fileProblem, missing: [], appOutcome: { kind: 'unreadable' } };
  const { model, reason } = readVision(res);
  if (reason) return { ok: false, code: 'unreadable', reason, missing: [], appOutcome: { kind: 'unreadable' } };
  return toPrescriptionBody({ patientId, model, caption });
}

/** What the patient reads after an extraction attempt. */
function extractionReply({ result, statusCode, language }) {
  const en = language === 'en';
  if (!result.ok && result.code === 'unreadable') {
    return en ? 'We could not read this image right now, so nothing was saved. Please send it again in a little while, or add it in the app.'
              : 'ما قدرنا نقرأ الصورة هالمرة، فما حفظنا شي. أرسلها مرة ثانية بعد شوي، أو أضفها من التطبيق.';
  }
  if (!result.ok && result.code === 'not_a_prescription') {
    return en ? 'This does not look like a prescription, so nothing was saved. To check a medicine box, open Safety in the app.'
              : 'الصورة ما تبين إنها وصفة طبية، فما حفظنا شي. لفحص علبة دواء استخدم «فحص دواء» في التطبيق.';
  }
  if (!result.ok) {
    return en ? 'We could not read everything we need from this prescription, so nothing was saved. You can add it in the app.'
              : 'ما قدرنا نقرأ كل البيانات اللازمة من الوصفة، فما حفظنا شي. تقدر تضيفها من التطبيق.';
  }
  if (!(statusCode >= 200 && statusCode < 300)) {
    return en ? 'Something went wrong on our side and the prescription was not saved. Please try again shortly.'
              : 'صار خلل عندنا وما انحفظت الوصفة. حاول مرة ثانية بعد شوي.';
  }
  if (result.needsReview) {
    return en ? 'Received ✅ Some details were unclear, so a medical reviewer will confirm them before this medicine is added to your schedule.'
              : 'استلمنا وصفتك ✅ بعض البيانات ما كانت واضحة، فبيراجعها مختص طبي قبل ما ينضاف الدواء لجدولك.';
  }
  return en ? 'Received ✅ The prescription is saved and is being checked against your other medicines.'
            : 'استلمنا وصفتك ✅ انحفظت، ونفحصها الحين مع باقي أدويتك.';
}

module.exports = { toPrescriptionBody, RESPONSE_SCHEMA, PROMPT, CRITICAL_CONFIDENCE, CONFIDENCE_KEYS, FLAGGABLE, readVision, extractFromTelegram, extractionReply };
