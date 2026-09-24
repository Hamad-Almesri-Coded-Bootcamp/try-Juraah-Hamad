/**
 * Postgres implementation behind the agent integration point (P2-WP7, docs/briefs/P2-WP7.md).
 * The route handlers in lib/agent/*.ts validate and orchestrate; every statement they need lives
 * HERE, because guard 8 admits SQL only in lib/{data,session}/pg/** and lib/engine/** (the brief's
 * "handlers live in lib/agent" would otherwise put SQL where the guard forbids it — WP7 fragment).
 * This file is not in the lead's pg/ barrel: the routes import it directly, as WP6's do channels.ts.
 *
 * Roles (D-017, D-025):
 *  - withAgent (role jurah_agent, actor agent): the dose-status write, the alert and prescription
 *    inserts, and the two reads. jurah_agent alone holds UPDATE (status, recorded_at, source) on
 *    doses; the trigger doses_status_write admits it, the check dose_untracked_has_no_status
 *    refuses a tracked:false dose, and the AFTER UPDATE trigger doses_status_recorded_audit appends
 *    `dose_status_recorded` with actor_role 'agent' and the mock's message form — composed by the
 *    trigger from the prescription's generic name, so this file appends NOTHING for a dose write.
 *  - withSystem (role jurah_app, actor system): recompute and discontinuation — jurah_agent holds no
 *    DELETE on doses (D-025). The engine is lib/engine's (WP4b); there is no second engine here.
 *
 * G1: the only statement in this file that writes doses.status is `recordDoseStatus`, reachable
 * only from POST /api/agent/doses/{id}/status behind the agent bearer. Nothing here names a dose
 * word in a write except the status the agent itself reported; no statement turns a dose `missed`
 * on its own (rule 4). G12: payloads are built in lib/agent/notify.ts through lib/push/send.ts's
 * whitelist; this file only reads the targets, and only for ACTIVE caregivers.
 * Never selected: civil_id (0008 removes the grant), telegram_chat_id.
 */
import { withAgent, withSystem } from '@/lib/db/withSession';
import { append } from '@/lib/db/audit';
import { newId } from '@/lib/db/ids';
import type { JsonValue } from '@/lib/db/client';
import { applyDiscontinuation, applyRecompute, insertGeneratedDoses } from '@/lib/engine/doses';
import { doseFromRow, loadPrescription, prescriptionFromRow } from '@/lib/engine/rows';
import { DOSE_COLUMNS, PRESCRIPTION_COLUMNS } from '@/lib/engine/sql';
import {
  alertRaisedMessage, prescriptionAddedMessage, prescriptionDiscontinuedMessage, scheduleRecomputedMessage,
} from '@/lib/agent/messages';
import type { AlertInput, DoseStatusInput, PrescriptionInput, RecomputeInput, VoiceTurnInput } from '@/lib/agent/validate';
import type { Dose, InteractionAlert, Prescription } from '@/types/contracts';
// AP-10: a cycle with ./screening.ts (which raises its hold through insertAlert below), safe by
// construction: each module uses the other's bindings only inside function bodies, never while it
// is being evaluated, and the functions involved are hoisted declarations.
import { screenOrHold, type ScreeningOutcome } from './screening';

/** Parameterised ($n). Exported so a gate proof runs the very same text through the MCP connector. */
export const PG_QUERIES_AGENT = {
  // withAgent. The one dose-status write in the product. `source` is fixed here, never the body's.
  recordDoseStatus: `
    update doses set status = $2::dose_status_t, recorded_at = $3::timestamptz, source = 'adherence_agent'
     where id = $1
    returning ${DOSE_COLUMNS}`,
  // withSystem. The reported miss the recompute is about.
  doseForRecompute: `select id, prescription_id, status::text as status, tracked from doses where id = $1`,
  // withAgent. The involved prescriptions, which must all belong to the alert's patient.
  prescriptionsOfPatient: `
    select id, generic_name from prescriptions
     where patient_id = $1 and id in (select jsonb_array_elements_text($2::jsonb))`,
  insertAlert: `
    insert into interaction_alerts (id, patient_id, involved_prescription_ids, severity, description, source_citation,
                                    created_at, review_status)
    values ($1, $2, array(select jsonb_array_elements_text($3::jsonb)), $4::severity_t, $5, $6,
            coalesce($7::timestamptz, jurah_now()), $8::review_status_t)
    returning id, patient_id, involved_prescription_ids, severity::text as severity, description, source_citation,
              iso_kw(created_at) as created_at, review_status::text as review_status`,
  // withAgent. Every column an extraction may carry; the review decision fields are the reviewer's
  // and are never written here (the validator refuses them before this runs).
  insertPrescription: `
    insert into prescriptions (id, patient_id, facility_name, sector, generic_name, brand_name, strength_mg, strength_unit,
                               dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date,
                               dose_times, prescribed_at, prescriber_name, timing_relative_to_food, route_of_administration,
                               special_notes, indication, dispensing_units_per_package, dispensing_total_quantity_dispensed,
                               dispensing_dispense_date, dispensing_brand_actually_dispensed, needs_review,
                               field_review_status, status, discontinued_reason, discontinued_at)
    select r.id, r.patient_id, r.facility_name, r.sector::sector_t, r.generic_name, r.brand_name, r.strength_mg,
           r.strength_unit::strength_unit_t, r.dose_per_administration, r.frequency_per_day, r.duration_days,
           r.dosing_pattern::dosing_pattern_t, r.start_date, r.dose_times, r.prescribed_at, r.prescriber_name,
           r.timing_relative_to_food, r.route_of_administration, r.special_notes, r.indication,
           r.dispensing_units_per_package, r.dispensing_total_quantity_dispensed, r.dispensing_dispense_date,
           r.dispensing_brand_actually_dispensed, r.needs_review, r.field_review_status::field_review_t,
           r.status::rx_status_t, r.discontinued_reason, r.discontinued_at
    from jsonb_to_record($1::jsonb) as r(
      id text, patient_id text, facility_name text, sector text, generic_name text, brand_name text, strength_mg numeric,
      strength_unit text, dose_per_administration numeric, frequency_per_day int, duration_days int, dosing_pattern text,
      start_date date, dose_times text[], prescribed_at timestamptz, prescriber_name text, timing_relative_to_food text,
      route_of_administration text, special_notes text, indication text, dispensing_units_per_package int,
      dispensing_total_quantity_dispensed numeric, dispensing_dispense_date date, dispensing_brand_actually_dispensed text,
      needs_review boolean, field_review_status text, status text, discontinued_reason text, discontinued_at date)
    returning ${PRESCRIPTION_COLUMNS}`,
  // withAgent. Tracking state now (rule 3: `tracked` is fixed at generation). No row → false.
  trackingOn: `select adherence_check_in_enabled as tracking_on from settings where patient_id = $1`,
  // withAgent. AP-10: the language screening writes the patient's alerts in (the recipients query
  // below reads the same column under the same role). No row → 'ar', the settings default.
  patientLanguage: `select language::text as language from settings where patient_id = $1`,
  // withAgent. Tracking on AND the patient's LATEST link connected (the same "latest" rule as
  // settings_tracking_requires_link, p2-wp1 §3.12).
  checkInEligibility: `
    select s.patient_id, l.chat_id, s.language::text as language, s.adherence_check_in_frequency::text as frequency
      from settings s
      join lateral (select m.status, m.chat_id from messaging_links m
                     where m.subject_type = 'patient' and m.subject_id = s.patient_id
                     order by m.seq desc limit 1) l on true
     where s.adherence_check_in_enabled and l.status = 'connected' and l.chat_id is not null
     order by s.patient_id`,
  // withAgent. G12's one recipient query: the patient, then ACTIVE caregivers only (in seq order),
  // each with the chat id of its latest link when that link is connected and its push target when
  // the subscription is active + granted + attached. A pending/declined/expired/revoked caregiver
  // is not a row of this result at all (E-07). No row at all → the patient does not exist.
  recipients: `
    with subjects as (
      select 'patient'::text as subject_type, p.id as subject_id, 0::bigint as ord from patients p where p.id = $1
      union all
      select 'caregiver', c.id, c.seq from caregivers c
       where c.linked_patient_id = $1 and c.status = 'active' and exists (select 1 from patients p where p.id = $1)
    )
    select s.subject_type, s.subject_id,
           (select case when l.status = 'connected' then l.chat_id end
              from messaging_links l
             where l.subject_type::text = s.subject_type and l.subject_id = s.subject_id
             order by l.seq desc limit 1) as chat_id,
           ps.endpoint, ps.p256dh, ps.auth,
           (select st.language::text from settings st where st.patient_id = $1) as language
      from subjects s
      left join push_subscriptions ps
        on ps.subject_type::text = s.subject_type and ps.subject_id = s.subject_id
       and ps.status = 'active' and ps.permission = 'granted'
       and ps.endpoint is not null and ps.p256dh is not null and ps.auth is not null
     order by s.ord`,
  // withAgent. CR-062: the agent's two reads. jurah_agent holds SELECT (id) on patients — enough for
  // the 404 — and SELECT on prescriptions and doses (0005). Never civil_id, name or chat id.
  patientExists: `select id from patients where id = $1`,
  // TRACKED doses only, of one Kuwait calendar date: an untracked dose is never part of a check-in
  // and never given a status (TC-AD-11), so the agent is not even shown one.
  trackedDosesForDay: `
    select d.id, d.prescription_id, iso_kw(d.scheduled_at) as scheduled_at, d.status::text as status,
           iso_kw(d.recorded_at) as recorded_at,
           p.generic_name, p.brand_name, p.strength_mg::float8 as strength_mg, p.strength_unit::text as strength_unit,
           p.dose_per_administration::float8 as dose_per_administration, p.timing_relative_to_food
      from doses d
      join prescriptions p on p.id = d.prescription_id
     where p.patient_id = $1 and d.tracked
       and (d.scheduled_at at time zone 'Asia/Kuwait')::date = $2::date
     order by d.scheduled_at, p.seq, d.seq`,
  // ACTIVE prescriptions, flagged ones included WITH their flag, so screening can exclude them
  // visibly (TC-IX-06) instead of never learning they exist.
  activePrescriptions: `
    select ${PRESCRIPTION_COLUMNS} from prescriptions
     where patient_id = $1 and status = 'active'
     order by seq`,
} as const;

// -------------------------------------------------------------------------------------------
// errors
// -------------------------------------------------------------------------------------------
interface PgErrorLike { code?: string; constraint_name?: string; message?: string }

/** The named constraint or guard trigger a Postgres refusal carries, or null for anything else. */
export function refusalOf(e: unknown): string | null {
  const err = e as PgErrorLike | null;
  if (!err || typeof err !== 'object') return null;
  if (err.constraint_name) return err.constraint_name;
  // A guard trigger raises P0001 '<trigger_name>: …'.
  if (err.code === 'P0001') {
    const m = /^([a-z_]+):/.exec(err.message ?? '');
    return m?.[1] ?? 'raised';
  }
  return null;
}

// -------------------------------------------------------------------------------------------
// POST /api/agent/doses/{doseId}/status
// -------------------------------------------------------------------------------------------
export type DoseWriteResult =
  | { kind: 'ok'; dose: Dose }
  | { kind: 'not_found' }
  | { kind: 'untracked' }
  | { kind: 'refused'; constraint: string };

export async function recordDoseStatus(doseId: string, input: DoseStatusInput): Promise<DoseWriteResult> {
  try {
    return await withAgent(async (sql) => {
      const [row] = await sql.unsafe(PG_QUERIES_AGENT.recordDoseStatus, [doseId, input.status, input.recordedAt ?? null]);
      return row ? { kind: 'ok' as const, dose: doseFromRow(row) } : { kind: 'not_found' as const };
    });
  } catch (e) {
    const name = refusalOf(e);
    if (name === 'dose_untracked_has_no_status') return { kind: 'untracked' };
    if (name) return { kind: 'refused', constraint: name };
    throw e;
  }
}

// -------------------------------------------------------------------------------------------
// POST /api/agent/schedule/recompute
// -------------------------------------------------------------------------------------------
export type RecomputeOutcome =
  | { kind: 'not_found' }
  | { kind: 'dose_not_found' }
  | { kind: 'dose_of_other_prescription' }
  | { kind: 'not_a_recorded_miss' }
  | { kind: 'recomputed'; changed: boolean; addedIds: string[]; droppedIds: string[] }
  | { kind: 'discontinued'; prescription: Prescription; cancelledDoseIds: string[] }
  | { kind: 'not_active' }
  | { kind: 'invalid_date' };

/** D-025: bearer-checked by the caller, then executed as the system actor. */
export async function recomputeSchedule(input: RecomputeInput): Promise<RecomputeOutcome> {
  return withSystem(async (sql): Promise<RecomputeOutcome> => {
    const rx = await loadPrescription(sql, input.prescriptionId);
    if (!rx) return { kind: 'not_found' };

    if (input.reason === 'reported_miss') {
      const [dose] = await sql.unsafe(PG_QUERIES_AGENT.doseForRecompute, [input.missedDoseId]);
      if (!dose) return { kind: 'dose_not_found' };
      if (String(dose.prescription_id) !== rx.id) return { kind: 'dose_of_other_prescription' };
      // The miss must already be RECORDED by the agent (the status write comes first, p2-wp4 §5.5).
      if (String(dose.status) !== 'missed') return { kind: 'not_a_recorded_miss' };
      const result = await applyRecompute(sql, rx, input.missedDoseId);
      await append(sql, {
        scope: 'patient', patientId: rx.patientId, actor: { role: 'system' }, type: 'schedule_recomputed',
        message: scheduleRecomputedMessage(rx.drug.genericName), relatedId: rx.id,
      });
      return { kind: 'recomputed', ...result };
    }

    const outcome = await applyDiscontinuation(sql, rx, input.discontinuedAt, input.discontinuedReason);
    if (!outcome.ok) return { kind: outcome.reason };
    await append(sql, {
      scope: 'patient', patientId: rx.patientId, actor: { role: 'agent' }, type: 'prescription_discontinued',
      message: prescriptionDiscontinuedMessage(rx.drug.genericName), relatedId: rx.id,
    });
    return { kind: 'discontinued', prescription: outcome.prescription, cancelledDoseIds: outcome.cancelledDoseIds };
  });
}

// -------------------------------------------------------------------------------------------
// POST /api/agent/alerts
// -------------------------------------------------------------------------------------------
export type AlertWriteResult =
  | { kind: 'ok'; alert: InteractionAlert }
  | { kind: 'prescriptions_not_of_patient'; ids: string[] }
  | { kind: 'refused'; constraint: string };

export async function insertAlert(input: AlertInput): Promise<AlertWriteResult> {
  try {
    return await withAgent(async (sql): Promise<AlertWriteResult> => {
      const found = await sql.unsafe(PG_QUERIES_AGENT.prescriptionsOfPatient, [input.patientId, input.involvedPrescriptionIds]);
      const names = new Map(found.map((r) => [String(r.id), String(r.generic_name)]));
      const missing = input.involvedPrescriptionIds.filter((id) => !names.has(id));
      if (missing.length > 0) return { kind: 'prescriptions_not_of_patient', ids: missing };
      const [row] = await sql.unsafe(PG_QUERIES_AGENT.insertAlert, [
        newId('ia'), input.patientId, input.involvedPrescriptionIds, input.severity, input.description,
        input.sourceCitation, input.createdAt ?? null, input.reviewStatus,
      ]);
      const alert: InteractionAlert = {
        id: String(row!.id),
        patientId: String(row!.patient_id),
        involvedPrescriptionIds: (row!.involved_prescription_ids as string[]).map(String),
        severity: String(row!.severity) as InteractionAlert['severity'],
        description: String(row!.description),
        sourceCitation: String(row!.source_citation),
        createdAt: String(row!.created_at),
        reviewStatus: String(row!.review_status) as InteractionAlert['reviewStatus'],
      };
      await append(sql, {
        scope: 'patient', patientId: alert.patientId, actor: { role: 'agent' }, type: 'alert_raised',
        message: alertRaisedMessage(alert.severity, input.involvedPrescriptionIds.map((id) => names.get(id)!)),
        createdAt: alert.createdAt, relatedId: alert.id,
      });
      return { kind: 'ok', alert };
    });
  } catch (e) {
    const name = refusalOf(e);
    if (name) return { kind: 'refused', constraint: name };
    throw e;
  }
}

// -------------------------------------------------------------------------------------------
// POST /api/agent/prescriptions
// -------------------------------------------------------------------------------------------
export type PrescriptionWriteResult =
  | { kind: 'ok'; prescription: Prescription; doseCount: number; screening: ScreeningOutcome }
  | { kind: 'refused'; constraint: string };

/** The jsonb record of PG_QUERIES_AGENT.insertPrescription (snake_case columns, null for absent). Exported for the gate proof. */
export function prescriptionRecord(id: string, input: PrescriptionInput): Record<string, unknown> {
  const p = input.prescription;
  return {
    id, patient_id: input.patientId, facility_name: p.source.facilityName, sector: p.source.sector,
    generic_name: p.drug.genericName, brand_name: p.drug.brandName ?? null,
    strength_mg: p.drug.strengthMg ?? null, // the number as written, in strengthUnit's unit — never converted
    strength_unit: p.drug.strengthUnit ?? null,
    dose_per_administration: p.dosePerAdministration, frequency_per_day: p.frequencyPerDay ?? null,
    duration_days: p.durationDays, dosing_pattern: p.dosingPattern, start_date: p.startDate ?? null,
    dose_times: p.doseTimes ?? null, prescribed_at: p.prescribedAt ?? null, prescriber_name: p.prescriberName ?? null,
    timing_relative_to_food: p.timingRelativeToFood ?? null, route_of_administration: p.routeOfAdministration ?? null,
    special_notes: p.specialNotes ?? null, indication: p.indication ?? null,
    dispensing_units_per_package: p.dispensing?.unitsPerPackage ?? null,
    dispensing_total_quantity_dispensed: p.dispensing?.totalQuantityDispensed ?? null,
    dispensing_dispense_date: p.dispensing?.dispenseDate ?? null,
    dispensing_brand_actually_dispensed: p.dispensing?.brandActuallyDispensed ?? null,
    needs_review: input.needsReview, field_review_status: input.fieldReviewStatus ?? null,
    status: p.status ?? 'active', discontinued_reason: p.discontinuedReason ?? null, discontinued_at: p.discontinuedAt ?? null,
  };
}

/**
 * POST /api/agent/prescriptions' write, then (AP-10, CR-090) its screening. The insert commits first
 * (the screening agent reads the prescription back); an UNFLAGGED one is then handed to screening,
 * or held for a specialist when n8n does not accept it (./screening.ts). A flagged one is screened
 * when the reviewer confirms it (writes.ts confirmPrescriptionFields), never before (TC-IX-06).
 * `screening` goes back in the 201 body, so the calling workflow knows the backend has already
 * handed it over and does not screen it a second time.
 */
export async function insertExtractedPrescription(input: PrescriptionInput): Promise<PrescriptionWriteResult> {
  let saved: { prescription: Prescription; doseCount: number };
  try {
    saved = await withAgent(async (sql) => {
      const [row] = await sql.unsafe(PG_QUERIES_AGENT.insertPrescription, [prescriptionRecord(newId('rx'), input) as JsonValue]);
      const rx = prescriptionFromRow(row!);
      const [t] = await sql.unsafe(PG_QUERIES_AGENT.trackingOn, [rx.patientId]);
      // The generator returns [] for a flagged/unconfirmed or incomplete record (CR-002), so a
      // needsReview extraction gets no doses until a reviewer confirms it.
      const doses = await insertGeneratedDoses(sql, rx, Boolean(t?.tracking_on));
      await append(sql, {
        scope: 'patient', patientId: rx.patientId, actor: { role: 'agent' }, type: 'prescription_added',
        message: prescriptionAddedMessage(rx.drug.genericName), relatedId: rx.id,
      });
      return { prescription: rx, doseCount: doses.length };
    });
  } catch (e) {
    const name = refusalOf(e);
    if (name) return { kind: 'refused', constraint: name };
    throw e;
  }
  const screening = await screenOrHold(saved.prescription.patientId, saved.prescription);
  return { kind: 'ok', ...saved, screening };
}

/** AP-10: the patient's own language, for the alerts screening writes. Any failure → 'ar' (the default). */
export async function patientLanguage(patientId: string): Promise<'ar' | 'en'> {
  try {
    const [row] = await withAgent((sql) => sql.unsafe(PG_QUERIES_AGENT.patientLanguage, [patientId]));
    return row?.language === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

// -------------------------------------------------------------------------------------------
// GET /api/agent/check-in-eligibility
// -------------------------------------------------------------------------------------------
export interface CheckInEligible {
  patientId: string;
  chatId: string;
  language: 'ar' | 'en';
  frequency: 'daily' | 'every_other_day';
}

export async function checkInEligibility(): Promise<CheckInEligible[]> {
  return withAgent(async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_AGENT.checkInEligibility);
    return rows.map((r) => ({
      patientId: String(r.patient_id),
      chatId: String(r.chat_id),
      language: (String(r.language) === 'en' ? 'en' : 'ar') as CheckInEligible['language'],
      frequency: String(r.frequency) as CheckInEligible['frequency'],
    }));
  });
}

// -------------------------------------------------------------------------------------------
// GET /api/agent/alert-recipients, and the delivery targets POST /api/agent/alerts sends to
// -------------------------------------------------------------------------------------------
export interface RecipientTarget {
  subjectType: 'patient' | 'caregiver';
  subjectId: string;
  chatId: string | null;
  push: { endpoint: string; p256dh: string; auth: string } | null;
}

export interface Recipients {
  patientId: string;
  language: 'ar' | 'en';
  /** The patient first, then ACTIVE caregivers only, in invitation order. */
  targets: RecipientTarget[];
}

/** null ⇔ no such patient. The targets carry push keys: server-side use only, never returned raw. */
export async function recipientsFor(patientId: string): Promise<Recipients | null> {
  const rows = await withAgent((sql) => sql.unsafe(PG_QUERIES_AGENT.recipients, [patientId]));
  if (rows.length === 0) return null;
  return {
    patientId,
    language: String(rows[0]?.language) === 'en' ? 'en' : 'ar',
    targets: rows.map((r) => ({
      subjectType: String(r.subject_type) as RecipientTarget['subjectType'],
      subjectId: String(r.subject_id),
      chatId: r.chat_id === null || r.chat_id === undefined ? null : String(r.chat_id),
      push: r.endpoint ? { endpoint: String(r.endpoint), p256dh: String(r.p256dh), auth: String(r.auth) } : null,
    })),
  };
}

// -------------------------------------------------------------------------------------------
// GET /api/agent/patients/{patientId}/doses?date=  and  /prescriptions   (CR-062)
// -------------------------------------------------------------------------------------------
/** One tracked dose, with the few prescription fields a check-in message and a reply need. */
export interface AgentDose {
  id: string;
  prescriptionId: string;
  scheduledAt: string;
  status: string;
  recordedAt: string | null;
  genericName: string;
  brandName: string | null;
  strengthMg: number | null;
  strengthUnit: string | null;
  dosePerAdministration: number;
  timingRelativeToFood: string | null;
}

const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** null ⇔ no such patient. An existing patient with no tracked dose that day is `[]`. */
export async function trackedDosesForDay(patientId: string, isoDate: string): Promise<AgentDose[] | null> {
  return withAgent(async (sql) => {
    const [p] = await sql.unsafe(PG_QUERIES_AGENT.patientExists, [patientId]);
    if (!p) return null;
    const rows = await sql.unsafe(PG_QUERIES_AGENT.trackedDosesForDay, [patientId, isoDate]);
    return rows.map((r) => ({
      id: String(r.id),
      prescriptionId: String(r.prescription_id),
      scheduledAt: String(r.scheduled_at),
      status: String(r.status),
      recordedAt: strOrNull(r.recorded_at),
      genericName: String(r.generic_name),
      brandName: strOrNull(r.brand_name),
      strengthMg: numOrNull(r.strength_mg),
      strengthUnit: strOrNull(r.strength_unit),
      dosePerAdministration: Number(r.dose_per_administration),
      timingRelativeToFood: strOrNull(r.timing_relative_to_food),
    }));
  });
}

/** null ⇔ no such patient. Active prescriptions only, each carrying its own `needsReview`. */
export async function activePrescriptions(patientId: string): Promise<Prescription[] | null> {
  return withAgent(async (sql) => {
    const [p] = await sql.unsafe(PG_QUERIES_AGENT.patientExists, [patientId]);
    if (!p) return null;
    const rows = await sql.unsafe(PG_QUERIES_AGENT.activePrescriptions, [patientId]);
    return rows.map((r) => prescriptionFromRow(r));
  });
}

/**
 * CR-069 — one Alexa turn for the patient's open web app. null ⇔ no such patient. jurah_agent holds
 * INSERT on five columns of voice_turns and nothing else there (0012); `created_at` is jurah_now().
 */
export async function insertVoiceTurn(patientId: string, turn: VoiceTurnInput): Promise<string | null> {
  return withAgent(async (sql) => {
    const [p] = await sql.unsafe(PG_QUERIES_AGENT.patientExists, [patientId]);
    if (!p) return null;
    const id = newId('vt');
    await sql`insert into voice_turns (id, patient_id, topic, language, reply)
              values (${id}, ${patientId}, ${turn.topic}, ${turn.language}, ${turn.reply})`;
    return id;
  });
}
