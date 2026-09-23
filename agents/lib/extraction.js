'use strict';

/**
 * Jur'ah - the Prescription Extraction Agent's deterministic layer.
 *
 * The vision model reads the image and returns what it sees, field by field, with a confidence per
 * critical field. This file decides what becomes of that (AI Agents Acceptance Criteria.md, section 1):
 *   - not a prescription                              -> an explicit failure, never a record (TC-EX-04);
 *   - one of the five critical fields missing, badly  -> that field is left UNSET and named in
 *     shaped or below CRITICAL_CONFIDENCE                 `uncertainFields`, and the record is
 *     (brandName, strengthMg, frequencyPerDay,            `needsReview: true` - the reviewer's queue,
 *      startDate, doseTimes)                              no schedule, no screening (TC-EX-02/05);
 *   - doseTimes that do not match frequencyPerDay     -> unset and flagged, never "fixed";
 *   - a field the route REQUIRES and a reviewer cannot -> an explicit failure naming it: generic name,
 *     fix (the drug, the facility and its sector, the     facility, sector, dose per administration,
 *     dose, the duration, the pattern)                    duration, dosing pattern. Never a default.
 * No time is invented: no start date defaults to today, no clock time is made up for "3x daily".
 * The output is the exact body of POST /api/agent/prescriptions (lib/agent/validate.ts).
 */

const CRITICAL_CONFIDENCE = 0.8;
const CRITICAL = ['brandName', 'strengthMg', 'frequencyPerDay', 'startDate', 'doseTimes'];
const PATTERNS = ['daily', 'alternate_day', 'other'];
const UNITS = ['mg', 'mcg', 'g', 'ml', 'IU'];
const SECTORS = ['public', 'private'];

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v) => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null);
const posNum = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const posInt = (v) => (Number.isInteger(v) && v > 0 ? v : null);
function isoDate(v) {
  if (typeof v !== 'string' || !ISO_DATE.test(v)) return null;
  const t = Date.parse(v + 'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v ? v : null;
}

/** The JSON schema the vision call is constrained to (Gemini responseSchema, OpenAPI subset). */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    isPrescription: { type: 'boolean' },
    facilityName: { type: 'string', nullable: true },
    sector: { type: 'string', enum: SECTORS, nullable: true },
    genericName: { type: 'string', nullable: true },
    brandName: { type: 'string', nullable: true },
    strength: { type: 'number', nullable: true },
    strengthUnit: { type: 'string', enum: UNITS, nullable: true },
    dosePerAdministration: { type: 'number', nullable: true },
    frequencyPerDay: { type: 'integer', nullable: true },
    doseTimes: { type: 'array', items: { type: 'string' }, nullable: true },
    dosingPattern: { type: 'string', enum: PATTERNS, nullable: true },
    durationDays: { type: 'integer', nullable: true },
    startDate: { type: 'string', nullable: true },
    prescriberName: { type: 'string', nullable: true },
    timingRelativeToFood: { type: 'string', nullable: true },
    routeOfAdministration: { type: 'string', nullable: true },
    confidence: {
      type: 'object',
      properties: Object.fromEntries(CRITICAL.map((k) => [k, { type: 'number' }])),
    },
  },
  required: ['isPrescription'],
};

const PROMPT = [
  'You read ONE image a patient in Kuwait sent. Decide whether it is a medication prescription, and if it is, copy what it says.',
  'RULES',
  '1. Copy only what is written. If a field is not written or you cannot read it, return null. Never guess, never fill a default.',
  '2. doseTimes: only clock times actually written on the prescription, as HH:MM 24-hour. "Three times daily" with no times written means doseTimes = null.',
  '3. dosingPattern: "every other day" / "يوم بعد يوم" / "كل يومين" is alternate_day, never daily.',
  '4. sector: "public" for a Ministry of Health hospital, polyclinic or government centre; "private" for a private clinic, hospital or pharmacy; null if you cannot tell.',
  '5. startDate as YYYY-MM-DD only if a start or issue date is written.',
  '6. confidence: 0 to 1 for each of brandName, strength, frequencyPerDay, startDate, doseTimes. Below 0.8 means a human checks it, so do not inflate it.',
  '7. The caption the patient typed is context only. If it disagrees with the image, the image wins and you lower the confidence of that field.',
  '8. A photo of a medicine box or blister pack is NOT a prescription: isPrescription = false.',
].join('\n');

/**
 * Model output -> { ok: true, body, needsReview, uncertainFields } | { ok: false, code, missing }.
 * `facts` never carries a patient id from the model: the caller passes the chat's patientId.
 */
function toPrescriptionBody({ patientId, model }) {
  const m = model && typeof model === 'object' ? model : {};
  if (m.isPrescription !== true) return { ok: false, code: 'not_a_prescription', missing: [] };
  const conf = m.confidence && typeof m.confidence === 'object' ? m.confidence : {};
  const sure = (k) => Number.isFinite(Number(conf[k])) && Number(conf[k]) >= CRITICAL_CONFIDENCE;

  const required = {
    genericName: str(m.genericName),
    facilityName: str(m.facilityName),
    sector: SECTORS.includes(m.sector) ? m.sector : null,
    dosePerAdministration: posNum(m.dosePerAdministration),
    durationDays: posInt(m.durationDays),
    dosingPattern: PATTERNS.includes(m.dosingPattern) ? m.dosingPattern : null,
  };
  const missing = Object.keys(required).filter((k) => required[k] === null);
  if (missing.length > 0) return { ok: false, code: 'required_field_unreadable', missing };

  const uncertain = [];
  const brandName = str(m.brandName) && sure('brandName') ? str(m.brandName) : null;
  if (!brandName) uncertain.push('brandName');
  const strengthMg = posNum(m.strength) && sure('strengthMg') ? m.strength : null;
  if (strengthMg === null) uncertain.push('strengthMg');
  const frequencyPerDay = posInt(m.frequencyPerDay) && sure('frequencyPerDay') ? m.frequencyPerDay : null;
  if (frequencyPerDay === null) uncertain.push('frequencyPerDay');
  const startDate = isoDate(m.startDate) && sure('startDate') ? m.startDate : null;
  if (startDate === null) uncertain.push('startDate');
  let doseTimes = Array.isArray(m.doseTimes) && m.doseTimes.length > 0 && m.doseTimes.every((t) => HHMM.test(t)) && sure('doseTimes')
    ? m.doseTimes.slice() : null;
  // rx_dose_times_match_frequency - a mismatch is flagged, never repaired by us.
  if (doseTimes && frequencyPerDay !== null && doseTimes.length !== frequencyPerDay) doseTimes = null;
  if (doseTimes && new Set(doseTimes).size !== doseTimes.length) doseTimes = null;
  if (doseTimes === null) uncertain.push('doseTimes');
  if (doseTimes && frequencyPerDay === null) { doseTimes = null; if (!uncertain.includes('doseTimes')) uncertain.push('doseTimes'); }

  const drug = { genericName: required.genericName };
  if (brandName) drug.brandName = brandName;
  if (strengthMg !== null) drug.strengthMg = strengthMg;
  if (UNITS.includes(m.strengthUnit)) drug.strengthUnit = m.strengthUnit;

  const prescription = {
    source: { facilityName: required.facilityName, sector: required.sector },
    drug,
    dosePerAdministration: required.dosePerAdministration,
    durationDays: required.durationDays,
    dosingPattern: required.dosingPattern,
  };
  if (frequencyPerDay !== null) prescription.frequencyPerDay = frequencyPerDay;
  if (startDate) prescription.startDate = startDate;
  if (doseTimes) prescription.doseTimes = doseTimes.sort();
  for (const k of ['prescriberName', 'timingRelativeToFood', 'routeOfAdministration']) {
    if (str(m[k])) prescription[k] = str(m[k]).slice(0, 200);
  }

  const needsReview = uncertain.length > 0;
  return { ok: true, needsReview, uncertainFields: uncertain, body: { patientId, prescription, needsReview, uncertainFields: uncertain } };
}

/** What the patient reads after an extraction attempt. */
function extractionReply({ result, statusCode, language }) {
  const en = language === 'en';
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

module.exports = { toPrescriptionBody, extractionReply, RESPONSE_SCHEMA, PROMPT, CRITICAL, CRITICAL_CONFIDENCE };
