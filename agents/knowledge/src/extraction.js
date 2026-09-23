'use strict';

/* ---------------------------------------------------------------------------
 * extraction.js - validate a vision model's reading of a prescription and turn
 * it into the exact body of POST /api/agent/prescriptions
 * (lib/agent/validate.ts parsePrescriptionBody), or an explicit refusal.
 *
 * How this fits the project (changed 2026-09-23): the agent does not write an
 * ACTIVE, trusted prescription on its own say-so. It writes through the one
 * documented agent path, and anything it could not read confidently goes out
 * with needsReview:true - which the backend stores with no doses and keeps out
 * of screening until a reviewer confirms it (TC-EX-02, the field queue). That
 * is the project's version of "a draft a human must accept".
 *
 * GUARDRAIL G7 (unchanged): a critical field that is missing, malformed or
 * below the confidence threshold is LEFT UNSET and named in uncertainFields.
 * It is never filled with a plausible value. No start date defaults to today,
 * no clock time is invented for "three times daily", no unit is assumed for a
 * strength (rx-008 is 50 mcg; a strength read without its unit is exactly the
 * 1000x levothyroxine error the contract warns about).
 *
 * Two kinds of field:
 *   FLAGGABLE (CR-002 - the backend lets a flagged record leave them unset):
 *     brandName, strengthMg (+ strengthUnit), frequencyPerDay, startDate, doseTimes
 *   REQUIRED (the backend refuses a body without them, flagged or not):
 *     genericName, source.facilityName, source.sector, dosePerAdministration,
 *     durationDays, dosingPattern
 * A REQUIRED field that cannot be read is an explicit failure naming it - the
 * record cannot be saved, and nothing is saved.
 *
 * Every value - critical, required and secondary text alike - needs a numeric
 * confidence >= CRITICAL_CONFIDENCE (the same 0.8 as agents/lib/extraction.js).
 * A missing confidence is NOT confidence. An unsure secondary text is left out.
 * Dispensing (the pharmacist's block) and prescribedAt are not read from a
 * prescription image at all; they arrive, if ever, from dispensing data.
 * ------------------------------------------------------------------------- */

const CRITICAL_CONFIDENCE = 0.8;
const FLAGGABLE = ['brandName', 'strengthMg', 'frequencyPerDay', 'startDate', 'doseTimes'];
const PATTERNS = ['daily', 'alternate_day', 'other'];
const UNITS = ['mg', 'mcg', 'g', 'ml', 'IU'];
const SECTORS = ['public', 'private'];

/** Every field the model must report a confidence for. A missing or non-numeric confidence counts as NOT sure. */
const CONFIDENCE_KEYS = ['facilityName', 'sector', 'genericName', 'brandName', 'strength', 'strengthUnit', 'dosePerAdministration',
  'frequencyPerDay', 'doseTimes', 'dosingPattern', 'durationDays', 'startDate',
  'prescriberName', 'timingRelativeToFood', 'routeOfAdministration', 'specialNotes', 'indication'];
/** Secondary text: kept only when read confidently, otherwise simply left out (never flagged). */
const OPTIONAL_TEXT = ['prescriberName', 'timingRelativeToFood', 'routeOfAdministration', 'specialNotes', 'indication'];

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
    specialNotes: { type: 'string', nullable: true },
    indication: { type: 'string', nullable: true },
    confidence: {
      type: 'object',
      properties: {
        facilityName: { type: 'number' }, sector: { type: 'number' }, genericName: { type: 'number' },
        brandName: { type: 'number' }, strength: { type: 'number' }, strengthUnit: { type: 'number' },
        dosePerAdministration: { type: 'number' }, frequencyPerDay: { type: 'number' }, doseTimes: { type: 'number' },
        dosingPattern: { type: 'number' }, durationDays: { type: 'number' }, startDate: { type: 'number' },
        prescriberName: { type: 'number' }, timingRelativeToFood: { type: 'number' }, routeOfAdministration: { type: 'number' },
        specialNotes: { type: 'number' }, indication: { type: 'number' }
      },
      required: CONFIDENCE_KEYS
    }
  },
  required: ['isPrescription', 'confidence']
};

const PROMPT = [
  'You read ONE image of a medical prescription and return JSON matching the schema. You transcribe; you never decide.',
  '',
  'RULES',
  '1. isPrescription is false if the image is not a prescription (a medicine box, a receipt, a photo of something else, a blank page). Then leave every other field null.',
  '2. Copy only what is written. If a value is not clearly legible, return null for it and give it a low confidence. Never infer, never use a typical value, never round a strength you cannot read. A null is correct; a plausible guess is not.',
  '3. strength is the number exactly as written, and strengthUnit is the unit written next to it (mg, mcg, g, ml, IU). Never convert units. If the unit is not written, strengthUnit is null.',
  '4. doseTimes are clock times "HH:mm" (24-hour) ONLY if the prescription writes times. "Three times daily" with no times written means frequencyPerDay 3 and doseTimes null.',
  '5. dosingPattern: "every other day" / "يوم بعد يوم" / "كل يومين" is alternate_day; once or more every day is daily; anything else is other.',
  '6. startDate is "YYYY-MM-DD" only if a start date (or the prescription date as the start) is written. Never use today.',
  '7. facilityName is the clinic or hospital printed on the prescription. sector is public only for a government (MOH) facility and private only for a private one, and only if that is clear from the prescription itself; otherwise null.',
  '8. The prescription may be in Arabic or English. Keep names as written.',
  '9. confidence gives EVERY field a number 0-1 for how sure you are that you read it correctly - including a field you left null (how sure you are that it is not written). Do not inflate it.'
].join('\n');

/**
 * toPrescriptionBody({ patientId, model, source?, minConfidence? })
 *   model   the vision model's JSON (RESPONSE_SCHEMA shape), or null when it could not be parsed
 *   source  optional { facilityName, sector } the caller already knows (e.g. the patient picked
 *           it in the app); when valid it wins over the model's reading
 * ->
 *   { ok: true, body, needsReview, uncertainFields, appOutcome }
 *   { ok: false, code: 'not_a_prescription' | 'missing_required', missing: [...], appOutcome: { kind: 'unreadable' } }
 */
function toPrescriptionBody(args) {
  const { patientId } = args;
  const model = args.model;
  const min = typeof args.minConfidence === 'number' ? args.minConfidence : CRITICAL_CONFIDENCE;
  const unreadable = { kind: 'unreadable' };

  if (typeof patientId !== 'string' || !patientId) return { ok: false, code: 'missing_required', missing: ['patientId'], appOutcome: unreadable };
  if (!model || typeof model !== 'object' || model.isPrescription !== true) {
    return { ok: false, code: 'not_a_prescription', missing: [], appOutcome: unreadable };
  }
  const conf = model.confidence && typeof model.confidence === 'object' ? model.confidence : {};
  // Fail closed: a value is usable only with a NUMERIC confidence at or above the threshold.
  // A missing confidence, a string "0.9", NaN - all count as not sure (G7).
  const sure = (field) => typeof conf[field] === 'number' && Number.isFinite(conf[field]) && conf[field] >= min;

  // ---- REQUIRED
  const missing = [];
  const callerSource = args.source && str(args.source.facilityName) && SECTORS.indexOf(args.source.sector) !== -1 ? args.source : null;
  const facilityName = callerSource ? str(callerSource.facilityName) : (sure('facilityName') ? str(model.facilityName) : null);
  const sector = callerSource ? callerSource.sector : (sure('sector') && SECTORS.indexOf(model.sector) !== -1 ? model.sector : null);
  const genericName = sure('genericName') ? str(model.genericName) : null;
  const dosePerAdministration = sure('dosePerAdministration') ? posNum(model.dosePerAdministration) : null;
  const durationDays = sure('durationDays') ? posInt(model.durationDays) : null;
  const dosingPattern = sure('dosingPattern') && PATTERNS.indexOf(model.dosingPattern) !== -1 ? model.dosingPattern : null;
  if (!genericName) missing.push('genericName');
  if (!facilityName) missing.push('source.facilityName');
  if (!sector) missing.push('source.sector');
  if (dosePerAdministration === null) missing.push('dosePerAdministration');
  if (durationDays === null) missing.push('durationDays');
  if (!dosingPattern) missing.push('dosingPattern');
  if (missing.length) return { ok: false, code: 'missing_required', missing, appOutcome: unreadable };

  // ---- FLAGGABLE
  const uncertain = [];

  let brandName = null;
  if (model.brandName !== null && model.brandName !== undefined) {
    brandName = sure('brandName') ? str(model.brandName) : null;
    if (!brandName) uncertain.push('brandName');
  } else if (!sure('brandName')) {
    uncertain.push('brandName');     // not sure whether a brand is written at all
  }

  let strengthMg = null;
  let strengthUnit = null;
  const s = sure('strength') ? posNum(model.strength) : null;
  const u = sure('strengthUnit') && UNITS.indexOf(model.strengthUnit) !== -1 ? model.strengthUnit : null;
  if (s !== null && u !== null) { strengthMg = s; strengthUnit = u; } else uncertain.push('strengthMg');

  let frequencyPerDay = sure('frequencyPerDay') ? posInt(model.frequencyPerDay) : null;
  if (frequencyPerDay === null) uncertain.push('frequencyPerDay');

  let doseTimes = null;
  const t = model.doseTimes;
  const timesOk = sure('doseTimes') && Array.isArray(t) && t.length > 0 && t.every((x) => typeof x === 'string' && HHMM.test(x)) &&
    new Set(t).size === t.length;
  if (timesOk && frequencyPerDay !== null && t.length === frequencyPerDay) doseTimes = t.slice();
  else uncertain.push('doseTimes');     // never "fixed": unset and flagged (TC-EX-05)

  const startDate = sure('startDate') ? isoDate(model.startDate) : null;
  if (!startDate) uncertain.push('startDate');

  const needsReview = uncertain.length > 0;

  // ---- the body, exactly as parsePrescriptionBody accepts it
  const drug = { genericName };
  if (brandName) drug.brandName = brandName;
  if (strengthMg !== null) { drug.strengthMg = strengthMg; drug.strengthUnit = strengthUnit; }

  const prescription = {
    source: { facilityName, sector },
    drug,
    dosePerAdministration,
    durationDays,
    dosingPattern
  };
  if (frequencyPerDay !== null) prescription.frequencyPerDay = frequencyPerDay;
  if (startDate) prescription.startDate = startDate;
  if (doseTimes) prescription.doseTimes = doseTimes;
  // "Take on an empty stomach" matters for levothyroxine: secondary text is copied only when read
  // confidently, and otherwise left out rather than guessed.
  for (const f of OPTIONAL_TEXT) {
    const v = sure(f) ? str(model[f]) : null;
    if (v) prescription[f] = v;
  }
  const uncertainFields = FLAGGABLE.filter((f) => uncertain.indexOf(f) !== -1);
  const body = { patientId, prescription, needsReview, uncertainFields };
  const appOutcome = needsReview
    ? { kind: 'needs_review', prescription: Object.assign({ patientId, needsReview: true }, prescription), uncertainFields }
    : { kind: 'confident', prescription: Object.assign({ patientId, needsReview: false }, prescription) };
  return { ok: true, body, needsReview, uncertainFields, appOutcome };
}

module.exports = { CRITICAL_CONFIDENCE, FLAGGABLE, CONFIDENCE_KEYS, RESPONSE_SCHEMA, PROMPT, toPrescriptionBody };
