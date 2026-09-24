/**
 * Postgres implementation — prescriptions and doses. Owned by package WP3a (lead split at Gate 1). Every function
 * runs inside withSession(); RLS/guard triggers refuse; zero rows → the mock's refusal shape
 * (lib/data/refusals/<package>.ts, D-022); projections through lib/data/shapes/<package>.ts (key
 * order). Reads never write (E-48): the five reads below call no append() and write no row.
 *
 * Every statement is a parameterised text in PG_QUERIES_RX so a gate proof can run the very same
 * text through the MCP connector. Arrays and the image travel as JSON / base64 TEXT parameters and
 * are decoded in SQL (jsonb_to_record[set], decode(…, 'base64')), so no driver-specific array or
 * bytea serialisation is relied on.
 */
import type { DataApi } from '../api';
import type { Prescription } from '@/types/contracts';
import { sessionOf } from './_shared';
import { withSession } from '@/lib/db/withSession';
import { append } from '@/lib/db/audit';
import { newId } from '@/lib/db/ids';
import type { JsonValue } from '@/lib/db/client';
import { insertGeneratedDoses } from '@/lib/engine'; // P2-WP5 follow-up (CR-WP5-6): the one generation call site
import { addDays, kuwaitToday } from '@/lib/schedule/dates';
import {
  doseHistoryRefusal,
  dosesWithPrescriptionRefusal,
  draftSaveRefusal,
  extractionRefusal,
  prescriptionRefusal,
  prescriptionsRefusal,
} from '../refusals/reads-rx';
import {
  confidentDraft,
  NEEDS_REVIEW_UNCERTAIN_FIELDS,
  needsReviewDraft,
  prescriptionFromDraft,
  toDose,
  toDoseWithPrescription,
  toPrescription,
} from '../shapes/reads-rx';
import { askExtraction, extractionConfigured, screeningConfigured } from '@/lib/agent-webhooks';
import { screenOrHold } from './screening';
import { draftSource, languageOf } from '@/lib/agent-webhooks/core';

/** Every Prescription column, each timestamp through iso_kw(), each date to_char, each numeric ::float8. */
const RX_COLUMNS = `id, patient_id, facility_name, sector::text as sector, generic_name, brand_name,
           strength_mg::float8 as strength_mg, strength_unit::text as strength_unit,
           dose_per_administration::float8 as dose_per_administration, frequency_per_day, duration_days,
           dosing_pattern::text as dosing_pattern, to_char(start_date, 'YYYY-MM-DD') as start_date, dose_times,
           iso_kw(prescribed_at) as prescribed_at, prescriber_name, timing_relative_to_food, route_of_administration,
           special_notes, indication, dispensing_units_per_package,
           dispensing_total_quantity_dispensed::float8 as dispensing_total_quantity_dispensed,
           to_char(dispensing_dispense_date, 'YYYY-MM-DD') as dispensing_dispense_date, dispensing_brand_actually_dispensed,
           needs_review, field_review_status::text as field_review_status, field_reviewed_by,
           iso_kw(field_reviewed_at) as field_reviewed_at, field_review_note, status::text as status,
           discontinued_reason, to_char(discontinued_at, 'YYYY-MM-DD') as discontinued_at`;

/** A dose joined to its prescription, projected for DoseWithPrescription (the dose columns first). */
const DOSE_WITH_RX_COLUMNS = `d.id, d.prescription_id, iso_kw(d.scheduled_at) as scheduled_at, d.status::text as status, d.tracked,
           iso_kw(d.recorded_at) as recorded_at, d.source::text as source,
           p.generic_name, p.brand_name, p.strength_mg::float8 as strength_mg, p.strength_unit::text as strength_unit,
           p.dose_per_administration::float8 as dose_per_administration`;

export const PG_QUERIES_RX = {
  getPrescriptions: `
    select ${RX_COLUMNS}
    from prescriptions
    where patient_id = $1
    order by seq`,
  // RLS on the owning patient: a foreign id and a missing id are the same zero rows (E-49).
  getPrescription: `
    select ${RX_COLUMNS}
    from prescriptions
    where id = $1`,
  // Grouped by the KUWAIT calendar date; ties at one time broken by id (rx-002 before rx-003, the
  // mock's stable insertion order for every seed row).
  getDosesForDay: `
    select ${DOSE_WITH_RX_COLUMNS}
    from doses d
    join prescriptions p on p.id = d.prescription_id
    where p.patient_id = $1
      and (d.scheduled_at at time zone 'Asia/Kuwait')::date = $2::date
    order by d.scheduled_at, p.seq, d.seq /* D-030: the mock's insertion order */`,
  getDoseHistory: `
    select d.id, d.prescription_id, iso_kw(d.scheduled_at) as scheduled_at, d.status::text as status, d.tracked,
           iso_kw(d.recorded_at) as recorded_at, d.source::text as source
    from doses d
    where d.prescription_id = $1
    order by d.scheduled_at, d.seq /* D-030 */`,
  // The mock's window: 0 <= REFERENCE_DATE − (Kuwait date of the dose) <= days, both ends inclusive.
  // REFERENCE_DATE reaches SQL as jurah_now() (D-021); CR-046: served, no caller.
  getRecentDoses: `
    select ${DOSE_WITH_RX_COLUMNS}
    from doses d
    join prescriptions p on p.id = d.prescription_id
    where p.patient_id = $1
      and ((jurah_now() at time zone 'Asia/Kuwait')::date - (d.scheduled_at at time zone 'Asia/Kuwait')::date) between 0 and $2::float8
    order by d.scheduled_at, p.seq, d.seq /* D-030 */`,
  // submitPrescriptionImage — the insert refuses QUIETLY (0 rows, no raise) unless the session is
  // that patient; RLS's drafts_own with-check stands behind it. $1 draft_id · $2 patient_id ·
  // $3 prescription json · $4 confident · $5 uncertain_fields json (or null) · $6 image base64.
  insertDraft: `
    insert into prescription_drafts (draft_id, patient_id, prescription, confident, uncertain_fields, image)
    select $1, $2, $3::jsonb, $4::boolean,
           (select array_agg(x) from jsonb_array_elements_text($5::jsonb) as x),
           decode($6, 'base64')
    where jurah_session_is('patient') and jurah_session()->>'subjectId' = $2
    returning draft_id`,
  // savePrescriptionDraft — RLS (drafts_own) shows a draft only to its own patient's session.
  selectDraft: `
    select prescription
    from prescription_drafts
    where draft_id = $1 and patient_id = $2`,
  selectTracking: `
    select adherence_check_in_enabled
    from settings
    where patient_id = $1`,
  // CR-066: the language the agents answer in — the patient's own row only (RLS settings_own plus
  // the same patient-self gate as insertDraft). No row → Arabic.
  selectLanguage: `
    select language::text as language
    from settings
    where patient_id = $1
      and jurah_session_is('patient') and jurah_session()->>'subjectId' = $1`,
  // $1 the Prescription as JSON, snake_case keys (see rowForInsert). RLS prescriptions_insert_own.
  insertPrescription: `
    insert into prescriptions (id, patient_id, facility_name, sector, generic_name, brand_name, strength_mg, strength_unit,
                               dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date,
                               dose_times, needs_review, field_review_status, status)
    select r.id, r.patient_id, r.facility_name, r.sector::sector_t, r.generic_name, r.brand_name, r.strength_mg,
           r.strength_unit::strength_unit_t, r.dose_per_administration, r.frequency_per_day, r.duration_days,
           r.dosing_pattern::dosing_pattern_t, r.start_date, r.dose_times, r.needs_review,
           r.field_review_status::field_review_t, r.status::rx_status_t
    from jsonb_to_record($1::jsonb) as r(id text, patient_id text, facility_name text, sector text, generic_name text,
         brand_name text, strength_mg numeric, strength_unit text, dose_per_administration numeric, frequency_per_day int,
         duration_days int, dosing_pattern text, start_date date, dose_times text[], needs_review boolean,
         field_review_status text, status text)`,
  // $1 the generated doses as JSON. No status column: every generated dose is the column default
  // 'upcoming' (G1 — this insert cannot carry a status). source = the generator's own value
  // ('seed'), which is what the mock stores and what docs/briefs/P2-WP4b.md fixes for
  // CREATION-time rows (only recompute-added rows are 'system', D-28). Same statement as
  // lib/engine's insertGeneratedDoses (WP4b), which this can be swapped for once that lands.
  insertDoses: `
    insert into doses (id, prescription_id, scheduled_at, tracked, source)
    select x.id, x.prescription_id, x.scheduled_at::timestamptz, x.tracked, x.source::dose_source_t
    from jsonb_to_recordset($1::jsonb) as x(id text, prescription_id text, scheduled_at text, tracked boolean, source text)
    returning id`,
  deleteDraft: `
    delete from prescription_drafts
    where draft_id = $1 and patient_id = $2`,
} as const;

/** A real YYYY-MM-DD calendar date — anything else would make `$2::date` raise (→ error.tsx),
 * where the mock simply matches nothing. */
function isIsoDate(v: unknown): v is string {
  // Date.parse first: a month > 12 or a day > 31 is an Invalid Date, whose toISOString() (inside
  // addDays) would THROW; then the round trip rejects 02-30-style overflow.
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && addDays(v, 0) === v;
}

/** The record to insert, snake_case for jsonb_to_record. Only what the mock's record carries. */
function rowForInsert(rx: Prescription): Record<string, unknown> {
  return {
    id: rx.id, patient_id: rx.patientId, facility_name: rx.source.facilityName, sector: rx.source.sector,
    generic_name: rx.drug.genericName, brand_name: rx.drug.brandName ?? null, strength_mg: rx.drug.strengthMg ?? null,
    strength_unit: rx.drug.strengthUnit ?? null, dose_per_administration: rx.dosePerAdministration,
    frequency_per_day: rx.frequencyPerDay ?? null, duration_days: rx.durationDays, dosing_pattern: rx.dosingPattern,
    start_date: rx.startDate ?? null, dose_times: rx.doseTimes ?? null, needs_review: rx.needsReview,
    field_review_status: rx.fieldReviewStatus ?? null, status: rx.status,
  };
}

export const getPrescriptions: DataApi['getPrescriptions'] = async (patientId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_RX.getPrescriptions, [patientId]);
    return rows.length === 0 ? prescriptionsRefusal() : rows.map((r) => toPrescription(r));
  });
};

export const getPrescription: DataApi['getPrescription'] = async (prescriptionId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_RX.getPrescription, [prescriptionId]);
    return row ? toPrescription(row) : prescriptionRefusal();
  });
};

export const getDosesForDay: DataApi['getDosesForDay'] = async (patientId, isoDate) => {
  if (!isIsoDate(isoDate)) return dosesWithPrescriptionRefusal();
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_RX.getDosesForDay, [patientId, isoDate]);
    return rows.length === 0 ? dosesWithPrescriptionRefusal() : rows.map((r) => toDoseWithPrescription(r));
  });
};

export const getDoseHistory: DataApi['getDoseHistory'] = async (prescriptionId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_RX.getDoseHistory, [prescriptionId]);
    return rows.length === 0 ? doseHistoryRefusal() : rows.map((r) => toDose(r));
  });
};

export const getRecentDoses: DataApi['getRecentDoses'] = async (patientId, days) => {
  // NaN would compare TRUE against every bound in SQL; in the mock it matches nothing.
  if (typeof days !== 'number' || Number.isNaN(days)) return dosesWithPrescriptionRefusal();
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_RX.getRecentDoses, [patientId, days]);
    return rows.length === 0 ? dosesWithPrescriptionRefusal() : rows.map((r) => toDoseWithPrescription(r));
  });
};

/** CR-049 — the deterministic, SIMULATED provider (the mock's byte-size switch; no model call):
 * 0 bytes → unreadable (nothing stored) · 1–99 → needs_review · ≥100 → confident. The image bytes
 * and the draft are stored in prescription_drafts (CR-050: `image is not null` drives hasSourceImage). */
export const submitPrescriptionImage: DataApi['submitPrescriptionImage'] = async (patientId, image) => {
  if (image.size === 0) return extractionRefusal();
  const session = await sessionOf();
  if (extractionConfigured()) return submitToExtractionAgent(session, patientId, image);
  const draftId = newId('draft');
  const confident = image.size >= 100;
  const prescription = confident ? confidentDraft(kuwaitToday()) : needsReviewDraft();
  const uncertainFields = confident ? null : [...NEEDS_REVIEW_UNCERTAIN_FIELDS];
  const bytes = Buffer.from(await image.arrayBuffer()).toString('base64');
  return withSession(session, async (sql) => {
    const stored = await sql.unsafe(PG_QUERIES_RX.insertDraft, [
      draftId, patientId, prescription, confident, uncertainFields, bytes,
    ]);
    if (stored.length === 0) return extractionRefusal();
    return confident
      ? { kind: 'confident' as const, draftId, prescription }
      : { kind: 'needs_review' as const, draftId, prescription, uncertainFields: uncertainFields ?? [] };
  });
};

/**
 * CR-066 — JURAH_AGENT_EXTRACTION_URL is set: the Extraction agent (agents/knowledge,
 * agent-extraction, save:false) reads the photo into the app's own draft shape; every value it is not
 * sure of is left unset and listed in uncertainFields (needs_review), and an image that is not a
 * readable prescription is `unreadable` — never a fabricated record. The answer is validated with the
 * backend's own parsePrescriptionBody (lib/agent-webhooks/core). The patient still confirms in B4,
 * and savePrescriptionDraft below is still the only write. Patient-self gate first: nobody else's
 * session reaches the agent. The image is stored with the draft exactly as the stub stores it.
 */
async function submitToExtractionAgent(session: Awaited<ReturnType<typeof sessionOf>>, patientId: string, image: Blob) {
  if (!session || session.role !== 'patient' || session.subjectId !== patientId) return extractionRefusal();
  const language = await withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_RX.selectLanguage, [patientId]);
    return languageOf(row?.language);
  });
  const answer = await askExtraction(patientId, image, language);
  if (!answer || answer.draft.kind === 'unreadable' || !answer.imageBase64) return extractionRefusal();
  const { draft, imageBase64 } = answer;
  const draftId = newId('draft');
  const confident = draft.kind === 'confident';
  const uncertainFields = draft.kind === 'needs_review' ? [...draft.uncertainFields] : null;
  return withSession(session, async (sql) => {
    const stored = await sql.unsafe(PG_QUERIES_RX.insertDraft, [
      draftId, patientId, draft.prescription as JsonValue, confident, uncertainFields, imageBase64,
    ]);
    if (stored.length === 0) return extractionRefusal();
    return draft.kind === 'confident'
      ? { kind: 'confident' as const, draftId, prescription: draft.prescription }
      : { kind: 'needs_review' as const, draftId, prescription: draft.prescription, uncertainFields: draft.uncertainFields };
  });
}

/** One transaction: the draft must be the session patient's own (D-014 — RLS shows no other; no
 * fabricated record is ever saved) → insert the prescription (CR-042's fabricated source, D-19) →
 * its generated doses with `tracked` from the patient's settings (no row → false) → delete the
 * draft → append prescription_added. Any failure rolls the whole thing back. */
export const savePrescriptionDraft: DataApi['savePrescriptionDraft'] = async (patientId, draftId) => {
  const session = await sessionOf();
  const screen = screeningConfigured();
  let language: 'ar' | 'en' = 'ar';
  const saved = await withSession(session, async (sql) => {
    const [draft] = await sql.unsafe(PG_QUERIES_RX.selectDraft, [draftId, patientId]);
    if (!draft) return draftSaveRefusal(patientId);
    const draftRx = (typeof draft.prescription === 'string' ? JSON.parse(draft.prescription) : draft.prescription) as Partial<Prescription>;
    const built = prescriptionFromDraft(newId('rx'), patientId, draftRx);
    // CR-066: a draft the Extraction agent read carries the real facility and sector off the paper
    // (CR-042 — never fabricated); the stub's drafts carry none, so they keep the mock's literal.
    const realSource = draftSource(draftRx);
    const rx = realSource ? { ...built, source: realSource } : built;
    await sql.unsafe(PG_QUERIES_RX.insertPrescription, [rowForInsert(rx) as JsonValue]);
    const [settings] = await sql.unsafe(PG_QUERIES_RX.selectTracking, [patientId]);
    const trackingOn = settings ? Boolean(settings.adherence_check_in_enabled) : false;
    // lib/engine (P2-WP5 follow-up, CR-WP5-6): the generator's doses, source 'seed', status omitted
    // (the column default 'upcoming'); a short insert throws EngineInvariantError, rolling the save back.
    await insertGeneratedDoses(sql, rx, trackingOn);
    await sql.unsafe(PG_QUERIES_RX.deleteDraft, [draftId, patientId]);
    await append(sql, {
      scope: 'patient', patientId, actor: { role: 'patient', id: patientId }, type: 'prescription_added',
      message: `أُضيفت وصفة ${rx.drug.genericName}`, relatedId: rx.id,
    });
    if (screen) {
      const [lang] = await sql.unsafe(PG_QUERIES_RX.selectLanguage, [patientId]);
      language = languageOf(lang?.language);
    }
    const [row] = await sql.unsafe(PG_QUERIES_RX.getPrescription, [rx.id]);
    return row ? toPrescription(row) : draftSaveRefusal(patientId);
  });
  // CR-066 / F3: AFTER the transaction has committed — the Interaction Screening agent reads the new
  // prescription back through /api/agent, so it must already be there. Only a saved, active,
  // unflagged prescription (a flagged one is screened once the reviewer confirms it, TC-IX-06:
  // writes.ts confirmPrescriptionFields). Awaited, so the patient's add flow ends only once it is
  // screened; screening that cannot be confirmed HOLDS it for a specialist (./screening.ts).
  if (screen && saved.id && saved.patientId === patientId) {
    await screenOrHold(patientId, saved, language);
  }
  return saved;
};
