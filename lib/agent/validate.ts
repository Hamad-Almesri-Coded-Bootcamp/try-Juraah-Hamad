/**
 * Body validation for the six agent routes (P2-WP7). Pure: no SQL, no clock, no I/O — unit-tested in
 * tests/unit/agent/validate.test.ts. A refusal names the field and the reason, and the route answers
 * 422 `{ error: 'invalid_body', field, reason }`.
 *
 * Every body is STRICT: an unknown key is refused, so no agent route accepts an `actor`, a `role`, a
 * `tracked`, an `id`, a reviewer field or anything else the contract does not let the agent write
 * (API-SURFACE §B, "deliberately absent"). What the database refuses (a constraint, a guard trigger)
 * is left to the database, and the route answers 422/409 naming it.
 *
 * Guard 4: the recorded dose words are an ARRAY here, never a `status:` object literal.
 */
import type { InteractionAlert, Prescription } from '@/types/contracts';
import { kuwaitNow } from '@/lib/config';

export type Invalid = { ok: false; field: string; reason: string };
export type Valid<T> = { ok: true; value: T };
export type Validation<T> = Valid<T> | Invalid;

const bad = (field: string, reason: string): Invalid => ({ ok: false, field, reason });
const good = <T>(value: T): Valid<T> => ({ ok: true, value });

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** An ISO 8601 datetime WITH an offset (a bare local time would be read in the server's zone). */
export function isIsoDateTime(v: unknown): v is string {
  return isStr(v) && ISO_DATETIME.test(v) && Number.isFinite(Date.parse(v));
}
export function isIsoDate(v: unknown): v is string {
  if (!isStr(v) || !ISO_DATE.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
}

function unknownKey(o: Obj, allowed: readonly string[], prefix = ''): Invalid | null {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) return bad(`${prefix}${k}`, 'unknown_field');
  return null;
}

// -------------------------------------------------------------------------------------------
// POST /api/agent/doses/{doseId}/status
// -------------------------------------------------------------------------------------------
/** The three words that RECORD a dose. `upcoming` is not one: the agent never un-records a dose. */
export const RECORDED_DOSE_WORDS = ['taken_on_time', 'taken_late', 'missed'] as const;
export type RecordedDoseWord = (typeof RECORDED_DOSE_WORDS)[number];

export interface DoseStatusInput {
  status: RecordedDoseWord;
  recordedAt?: string;
  source: 'adherence_agent';
}

export function parseDoseStatusBody(body: unknown): Validation<DoseStatusInput> {
  if (!isObj(body)) return bad('body', 'not_an_object');
  const extra = unknownKey(body, ['status', 'recordedAt', 'source']);
  if (extra) return extra;
  const { status, recordedAt, source } = body;
  if (!RECORDED_DOSE_WORDS.includes(status as RecordedDoseWord)) return bad('status', 'not_a_recorded_status');
  if (source !== 'adherence_agent') return bad('source', 'must_be_adherence_agent');
  if (recordedAt !== undefined && !isIsoDateTime(recordedAt)) return bad('recordedAt', 'not_an_iso_datetime');
  if (status === 'taken_late' && recordedAt === undefined) return bad('recordedAt', 'required_for_taken_late');
  const value: DoseStatusInput = { status: status as RecordedDoseWord, source: 'adherence_agent' };
  if (recordedAt !== undefined) value.recordedAt = recordedAt as string;
  return good(value);
}

// -------------------------------------------------------------------------------------------
// POST /api/agent/schedule/recompute
// -------------------------------------------------------------------------------------------
export type RecomputeInput =
  | { prescriptionId: string; reason: 'reported_miss'; missedDoseId: string }
  | { prescriptionId: string; reason: 'discontinued'; discontinuedAt: string; discontinuedReason: string };

/** `discontinuedAt` defaults to the frozen clock's calendar date (D-021), never the wall clock. */
export function parseRecomputeBody(body: unknown): Validation<RecomputeInput> {
  if (!isObj(body)) return bad('body', 'not_an_object');
  const extra = unknownKey(body, ['prescriptionId', 'reason', 'missedDoseId', 'discontinuedAt', 'discontinuedReason']);
  if (extra) return extra;
  const { prescriptionId, reason, missedDoseId, discontinuedAt, discontinuedReason } = body;
  if (!isNonEmpty(prescriptionId)) return bad('prescriptionId', 'required');
  if (reason === 'reported_miss') {
    if (!isNonEmpty(missedDoseId)) return bad('missedDoseId', 'required_for_reported_miss');
    if (discontinuedAt !== undefined) return bad('discontinuedAt', 'only_for_discontinued');
    if (discontinuedReason !== undefined) return bad('discontinuedReason', 'only_for_discontinued');
    return good({ prescriptionId, reason, missedDoseId });
  }
  if (reason === 'discontinued') {
    if (missedDoseId !== undefined) return bad('missedDoseId', 'only_for_reported_miss');
    if (discontinuedAt !== undefined && !isIsoDate(discontinuedAt) && !isIsoDateTime(discontinuedAt)) {
      return bad('discontinuedAt', 'not_an_iso_date');
    }
    // rx_discontinued_complete requires a reason on every discontinued row.
    if (!isNonEmpty(discontinuedReason)) return bad('discontinuedReason', 'required_for_discontinued');
    const at = (discontinuedAt as string | undefined) ?? kuwaitNow().slice(0, 10);
    return good({ prescriptionId, reason, discontinuedAt: at, discontinuedReason });
  }
  return bad('reason', 'must_be_reported_miss_or_discontinued');
}

// -------------------------------------------------------------------------------------------
// POST /api/agent/alerts
// -------------------------------------------------------------------------------------------
export type AlertInput = Omit<InteractionAlert, 'id' | 'createdAt' | 'reviewStatus' | 'reviewerDecision' | 'reviewerNote' | 'reviewedAt' | 'reviewedBy'> & {
  createdAt?: string;
  reviewStatus: 'pending_medical_review' | 'auto_cleared';
};

const REVIEWER_FIELDS = ['reviewerDecision', 'reviewerNote', 'reviewedAt', 'reviewedBy'] as const;
const SEVERITIES = ['info', 'warning', 'danger'] as const;
const AGENT_REVIEW_STATES = ['pending_medical_review', 'auto_cleared'] as const;

export function parseAlertBody(body: unknown): Validation<AlertInput> {
  if (!isObj(body)) return bad('body', 'not_an_object');
  for (const f of REVIEWER_FIELDS) if (f in body) return bad(f, 'reviewer_field');
  if ('id' in body) return bad('id', 'server_assigned');
  const extra = unknownKey(body, ['patientId', 'involvedPrescriptionIds', 'severity', 'description', 'sourceCitation', 'createdAt', 'reviewStatus']);
  if (extra) return extra;
  const { patientId, involvedPrescriptionIds, severity, description, sourceCitation, createdAt, reviewStatus } = body;
  if (reviewStatus === 'reviewed') return bad('reviewStatus', 'agent_may_not_review');
  if (!AGENT_REVIEW_STATES.includes(reviewStatus as AlertInput['reviewStatus'])) return bad('reviewStatus', 'must_be_pending_medical_review_or_auto_cleared');
  if (!isNonEmpty(patientId)) return bad('patientId', 'required');
  if (!Array.isArray(involvedPrescriptionIds) || involvedPrescriptionIds.length === 0) return bad('involvedPrescriptionIds', 'non_empty_array_required');
  if (!involvedPrescriptionIds.every(isNonEmpty)) return bad('involvedPrescriptionIds', 'ids_must_be_strings');
  if (new Set(involvedPrescriptionIds).size !== involvedPrescriptionIds.length) return bad('involvedPrescriptionIds', 'duplicate_id');
  if (!SEVERITIES.includes(severity as InteractionAlert['severity'])) return bad('severity', 'must_be_info_warning_or_danger');
  if (!isNonEmpty(description)) return bad('description', 'required');
  // Required, but an empty string is allowed, and so is the owner's loud placeholder marker — the
  // agent never invents a citation (owner's rule), it passes what it has.
  if (!isStr(sourceCitation)) return bad('sourceCitation', 'required');
  if (createdAt !== undefined && !isIsoDateTime(createdAt)) return bad('createdAt', 'not_an_iso_datetime');
  const value: AlertInput = {
    patientId,
    involvedPrescriptionIds: involvedPrescriptionIds as string[],
    severity: severity as InteractionAlert['severity'],
    description,
    sourceCitation,
    reviewStatus: reviewStatus as AlertInput['reviewStatus'],
  };
  if (createdAt !== undefined) value.createdAt = createdAt as string;
  return good(value);
}

// -------------------------------------------------------------------------------------------
// POST /api/agent/prescriptions
// -------------------------------------------------------------------------------------------
type ReviewKeys = 'needsReview' | 'fieldReviewStatus' | 'fieldReviewNote' | 'fieldReviewedBy' | 'fieldReviewedAt';
export type ExtractedPrescription = Omit<Prescription, 'id' | 'patientId' | ReviewKeys>;

/** The five fields CR-002 lets a flagged record leave unread (FieldQueueItem.uncertainFields). */
export const UNCERTAIN_FIELD_KEYS = ['brandName', 'strengthMg', 'frequencyPerDay', 'startDate', 'doseTimes'] as const;
export type UncertainField = (typeof UNCERTAIN_FIELD_KEYS)[number];

export interface PrescriptionInput {
  patientId: string;
  prescription: ExtractedPrescription;
  needsReview: boolean;
  /** `pending` for a flagged extraction; absent for an unflagged one. Never `confirmed` (a reviewer's). */
  fieldReviewStatus?: 'pending';
  uncertainFields: UncertainField[];
}

const RX_KEYS = [
  'source', 'drug', 'dosePerAdministration', 'frequencyPerDay', 'durationDays', 'dosingPattern', 'startDate', 'doseTimes',
  'prescribedAt', 'prescriberName', 'timingRelativeToFood', 'routeOfAdministration', 'specialNotes', 'indication',
  'dispensing', 'status', 'discontinuedReason', 'discontinuedAt',
  // tolerated only when they agree with the top level:
  'patientId', 'needsReview', 'fieldReviewStatus',
] as const;
const RX_REVIEWER_FIELDS = ['fieldReviewNote', 'fieldReviewedBy', 'fieldReviewedAt'] as const;
const SECTORS = ['public', 'private'] as const;
const UNITS = ['mg', 'mcg', 'g', 'ml', 'IU'] as const;
const PATTERNS = ['daily', 'alternate_day', 'other'] as const;
const RX_STATES = ['active', 'completed', 'discontinued'] as const;
const OPTIONAL_TEXT = ['prescriberName', 'timingRelativeToFood', 'routeOfAdministration', 'specialNotes', 'indication', 'discontinuedReason'] as const;

export function parsePrescriptionBody(body: unknown): Validation<PrescriptionInput> {
  if (!isObj(body)) return bad('body', 'not_an_object');
  const top = unknownKey(body, ['patientId', 'prescription', 'needsReview', 'uncertainFields', 'source']);
  if (top) return top;
  const { patientId, prescription: p, needsReview, uncertainFields } = body;
  if (!isNonEmpty(patientId)) return bad('patientId', 'required');
  if (typeof needsReview !== 'boolean') return bad('needsReview', 'boolean_required');
  if (!isObj(p)) return bad('prescription', 'required');
  // API-SURFACE §B also names `source` at the top level; accepted there only as the same value.
  if (body.source !== undefined && JSON.stringify(body.source) !== JSON.stringify(p.source)) return bad('source', 'must_equal_prescription_source');

  for (const f of RX_REVIEWER_FIELDS) if (f in p) return bad(`prescription.${f}`, 'reviewer_field');
  if (p.fieldReviewStatus !== undefined && p.fieldReviewStatus !== 'pending') return bad('prescription.fieldReviewStatus', 'reviewer_field');
  const extra = unknownKey(p, RX_KEYS, 'prescription.');
  if (extra) return extra;
  if (p.patientId !== undefined && p.patientId !== patientId) return bad('prescription.patientId', 'must_equal_patientId');
  if (p.needsReview !== undefined && p.needsReview !== needsReview) return bad('prescription.needsReview', 'must_equal_needsReview');
  if (p.fieldReviewStatus === 'pending' && !needsReview) return bad('prescription.fieldReviewStatus', 'pending_requires_needsReview');

  // CR-042: this is where the real source arrives — required, never fabricated.
  const src = p.source;
  if (!isObj(src)) return bad('prescription.source', 'required');
  const srcExtra = unknownKey(src, ['facilityName', 'sector'], 'prescription.source.');
  if (srcExtra) return srcExtra;
  if (!isNonEmpty(src.facilityName)) return bad('prescription.source.facilityName', 'required');
  if (!SECTORS.includes(src.sector as 'public')) return bad('prescription.source.sector', 'must_be_public_or_private');

  const drug = p.drug;
  if (!isObj(drug)) return bad('prescription.drug', 'required');
  const drugExtra = unknownKey(drug, ['genericName', 'brandName', 'strengthMg', 'strengthUnit'], 'prescription.drug.');
  if (drugExtra) return drugExtra;
  if (!isNonEmpty(drug.genericName)) return bad('prescription.drug.genericName', 'required');
  if (drug.brandName !== undefined && !isNonEmpty(drug.brandName)) return bad('prescription.drug.brandName', 'not_a_string');
  if (drug.strengthMg !== undefined && !(isNum(drug.strengthMg) && drug.strengthMg > 0)) return bad('prescription.drug.strengthMg', 'positive_number_required');
  if (drug.strengthUnit !== undefined && !UNITS.includes(drug.strengthUnit as 'mg')) return bad('prescription.drug.strengthUnit', 'unknown_unit');

  if (!(isNum(p.dosePerAdministration) && p.dosePerAdministration > 0)) return bad('prescription.dosePerAdministration', 'positive_number_required');
  if (p.frequencyPerDay !== undefined && !(isInt(p.frequencyPerDay) && p.frequencyPerDay >= 1)) return bad('prescription.frequencyPerDay', 'positive_integer_required');
  // durationDays > 0 is the database's (rx_duration_days_positive) — an integer is all that is checked here.
  if (!isInt(p.durationDays)) return bad('prescription.durationDays', 'integer_required');
  if (!PATTERNS.includes(p.dosingPattern as 'daily')) return bad('prescription.dosingPattern', 'must_be_daily_alternate_day_or_other');
  if (p.startDate !== undefined && !isIsoDate(p.startDate)) return bad('prescription.startDate', 'not_an_iso_date');
  // Shape and length-vs-frequency are the database's (rx_dose_times_shape, rx_dose_times_match_frequency).
  if (p.doseTimes !== undefined && !(Array.isArray(p.doseTimes) && p.doseTimes.every(isStr))) return bad('prescription.doseTimes', 'array_of_strings_required');
  if (p.prescribedAt !== undefined && !isIsoDateTime(p.prescribedAt)) return bad('prescription.prescribedAt', 'not_an_iso_datetime');
  for (const f of OPTIONAL_TEXT) if (p[f] !== undefined && !isStr(p[f])) return bad(`prescription.${f}`, 'not_a_string');
  if (p.status !== undefined && !RX_STATES.includes(p.status as 'active')) return bad('prescription.status', 'unknown_status');
  if (p.discontinuedAt !== undefined && !isIsoDate(p.discontinuedAt)) return bad('prescription.discontinuedAt', 'not_an_iso_date');

  let dispensing: ExtractedPrescription['dispensing'];
  if (p.dispensing !== undefined) {
    const d = p.dispensing;
    if (!isObj(d)) return bad('prescription.dispensing', 'not_an_object');
    const dExtra = unknownKey(d, ['unitsPerPackage', 'totalQuantityDispensed', 'dispenseDate', 'brandActuallyDispensed'], 'prescription.dispensing.');
    if (dExtra) return dExtra;
    if (!(isInt(d.unitsPerPackage) && d.unitsPerPackage > 0)) return bad('prescription.dispensing.unitsPerPackage', 'positive_integer_required');
    if (!(isNum(d.totalQuantityDispensed) && d.totalQuantityDispensed > 0)) return bad('prescription.dispensing.totalQuantityDispensed', 'positive_number_required');
    if (!isIsoDate(d.dispenseDate)) return bad('prescription.dispensing.dispenseDate', 'not_an_iso_date');
    if (d.brandActuallyDispensed !== undefined && !isStr(d.brandActuallyDispensed)) return bad('prescription.dispensing.brandActuallyDispensed', 'not_a_string');
    dispensing = {
      unitsPerPackage: d.unitsPerPackage, totalQuantityDispensed: d.totalQuantityDispensed, dispenseDate: d.dispenseDate,
      ...(d.brandActuallyDispensed !== undefined ? { brandActuallyDispensed: d.brandActuallyDispensed as string } : {}),
    };
  }

  let uncertain: UncertainField[] = [];
  if (uncertainFields !== undefined) {
    if (!Array.isArray(uncertainFields) || !uncertainFields.every((f) => UNCERTAIN_FIELD_KEYS.includes(f as UncertainField))) {
      return bad('uncertainFields', 'unknown_field_name');
    }
    if (uncertainFields.length > 0 && !needsReview) return bad('uncertainFields', 'requires_needsReview');
    uncertain = uncertainFields as UncertainField[];
  }

  const { patientId: _p, needsReview: _n, fieldReviewStatus: _f, ...rest } = p;
  void _p; void _n; void _f;
  const prescription = { ...rest, source: { facilityName: src.facilityName, sector: src.sector }, ...(dispensing ? { dispensing } : {}) } as ExtractedPrescription;
  const value: PrescriptionInput = { patientId, prescription, needsReview, uncertainFields: uncertain };
  if (needsReview) value.fieldReviewStatus = 'pending';
  return good(value);
}

// -------------------------------------------------------------------------------------------
// GET /api/agent/alert-recipients?patientId=
// -------------------------------------------------------------------------------------------
export function parsePatientIdQuery(value: string | null): Validation<string> {
  return isNonEmpty(value) ? good(value) : bad('patientId', 'required');
}

// -------------------------------------------------------------------------------------------
// GET /api/agent/patients/{patientId}/doses?date=   (CR-062)
// -------------------------------------------------------------------------------------------
/** The Kuwait calendar date the agent asks about. Required: the route never defaults to a clock. */
export function parseDateQuery(value: string | null): Validation<string> {
  return isIsoDate(value) ? good(value) : bad('date', 'not_an_iso_date');
}

/**
 * CR-069 — POST /api/agent/patients/{id}/voice-turns: one Alexa turn for the patient's open web
 * app. `topic` is from agents/lib/voice.js screenTopic (a fixed list), `reply` the sentence Alexa
 * just spoke. Not clinical data; nothing here names a dose status.
 */
export const VOICE_TOPICS = ['launch', 'next_dose', 'dose_amount', 'today', 'forgot', 'unclear', 'bye'] as const;
export type VoiceTopic = (typeof VOICE_TOPICS)[number];
export interface VoiceTurnInput { topic: VoiceTopic; language: 'ar' | 'en'; reply: string }

export function parseVoiceTurnBody(body: unknown): Validation<VoiceTurnInput> {
  if (!isObj(body)) return bad('body', 'not_an_object');
  const extra = unknownKey(body, ['topic', 'language', 'reply']);
  if (extra) return extra;
  const { topic, language, reply } = body;
  if (typeof topic !== 'string' || !(VOICE_TOPICS as readonly string[]).includes(topic)) return bad('topic', 'not_a_voice_topic');
  if (language !== 'ar' && language !== 'en') return bad('language', 'must_be_ar_or_en');
  if (!isNonEmpty(reply)) return bad('reply', 'required');
  if (reply.length > 2000) return bad('reply', 'too_long');
  return good({ topic: topic as VoiceTopic, language, reply: reply.trim() });
}
