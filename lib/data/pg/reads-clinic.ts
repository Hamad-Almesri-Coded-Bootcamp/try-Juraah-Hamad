/**
 * Postgres implementation — alerts and the clinic reads. Owned by package WP3b (lead split at Gate 1). Every function
 * runs inside withSession(); RLS/guard triggers refuse; zero rows → the mock's refusal shape
 * (lib/data/refusals/<package>.ts, D-022); projections through lib/data/shapes/<package>.ts (key
 * order). Reads never write (E-48): no append(), no insert/update anywhere in this file.
 *
 * Two places where RLS alone would NOT refuse what the mock refuses, so the query carries the gate
 * itself (the DB-level proof is then genuinely 0 rows):
 *  - the four clinic reads carry `jurah_session_is('reviewer')` — `alerts_select`/`prescriptions_select`
 *    admit a patient (and an active caregiver) to their OWN rows, so without it حمد would see ia-001
 *    in getReviewQueue() and his own context in getAlertForReview() (E-28);
 *  - checkDrugPhoto carries `jurah_session_is('patient') and subjectId = $1` (and the seam checks
 *    the same before querying) — RLS lets عبدالله read pt-01's prescriptions, the mock does not.
 */
import type { DataApi } from '../api';
import { sessionOf } from './_shared';
import { withSession } from '@/lib/db/withSession';
import {
  alertRefusal,
  alertReviewRefusal,
  alertsRefusal,
  drugCheckRefusal,
  fieldQueueRefusal,
  flaggedPrescriptionRefusal,
  reviewQueueRefusal,
} from '../refusals/reads-clinic';
import { toAlert, toFieldQueueItem, toReviewQueueItem } from '../shapes/reads-clinic';
import { toDoseWithPrescription, toPrescription } from '../shapes/reads-rx';
import { alertWhy } from '../shapes/why'; // CR-113
import { WHY_DATA } from '../why-data';
import type { DrugCheckOutcome } from '@/types/views';
import { askTravelCheck, travelCheckConfigured } from '@/lib/agent-webhooks';
import { languageOf } from '@/lib/agent-webhooks/core';

/** Every InteractionAlert column, projected for toAlert (timestamps through iso_kw, enums as text). */
const ALERT_COLUMNS = `
    a.id, a.patient_id, a.involved_prescription_ids, a.severity::text as severity, a.description, a.source_citation,
    iso_kw(a.created_at) as created_at, a.review_status::text as review_status,
    a.reviewer_decision::text as reviewer_decision, a.reviewer_note, iso_kw(a.reviewed_at) as reviewed_at, a.reviewed_by`;

/** Every Prescription column, projected for WP3a's toPrescription (the same list getPrescriptions selects). */
const PRESCRIPTION_COLUMNS = `
    p.id, p.patient_id, p.facility_name, p.sector::text as sector, p.generic_name, p.brand_name,
    p.strength_mg::float8 as strength_mg, p.strength_unit::text as strength_unit,
    p.dose_per_administration::float8 as dose_per_administration, p.frequency_per_day, p.duration_days,
    p.dosing_pattern::text as dosing_pattern, to_char(p.start_date, 'YYYY-MM-DD') as start_date, p.dose_times,
    iso_kw(p.prescribed_at) as prescribed_at, p.prescriber_name, p.timing_relative_to_food, p.route_of_administration,
    p.special_notes, p.indication, p.dispensing_units_per_package,
    p.dispensing_total_quantity_dispensed::float8 as dispensing_total_quantity_dispensed,
    to_char(p.dispensing_dispense_date, 'YYYY-MM-DD') as dispensing_dispense_date, p.dispensing_brand_actually_dispensed,
    p.needs_review, p.field_review_status::text as field_review_status, p.field_reviewed_by,
    iso_kw(p.field_reviewed_at) as field_reviewed_at, p.field_review_note, p.status::text as status,
    p.discontinued_reason, to_char(p.discontinued_at, 'YYYY-MM-DD') as discontinued_at`;

/** The mock's SEVERITY_RANK: danger 0 · warning 1 · info 2. */
const SEVERITY_RANK = `case a.severity when 'danger' then 0 when 'warning' then 1 else 2 end`;

/** The mock's patientFirstName(): the first whitespace token of the name, '' when unreadable. */
const FIRST_NAME = (patientIdExpr: string) =>
  `coalesce((select (regexp_split_to_array(pt.name, '\\s+'))[1] from patients pt where pt.id = ${patientIdExpr}), '')`;

/** Parameterised ($1, $2). Exported so a gate proof can run the very same text through the MCP connector. */
export const PG_QUERIES_CLINIC = {
  // RLS (alerts_select → can_read_patient) does the refusing. Order: severity rank, then newest
  // first; `id` breaks a tie deterministically (the table has no seq; the seed has no tie).
  getAlerts: `
    select ${ALERT_COLUMNS}
    from interaction_alerts a
    where a.patient_id = $1
    order by ${SEVERITY_RANK}, a.created_at desc, a.id`,
  getAlert: `
    select ${ALERT_COLUMNS}
    from interaction_alerts a
    where a.id = $1`,
  // CR-049's deterministic provider: "the drug" is the patient's first active prescription in store
  // (seq) order; the verdict is whether it is one side of the patient's own danger alert. Patient
  // self only (the mock's role check, in SQL too). Read-only: nothing is stored.
  checkDrugPhoto: `
    select p.id, p.generic_name,
           (select a.id from interaction_alerts a
            where a.patient_id = p.patient_id and p.id = any (a.involved_prescription_ids) and a.severity = 'danger'
            order by a.created_at, a.id limit 1) as alert_id
    from prescriptions p
    where p.patient_id = $1 and p.status = 'active'
      and jurah_session_is('patient') and jurah_session()->>'subjectId' = $1
    order by p.seq
    limit 1`,
  // CR-066: the language the agent answers in — the patient's own settings row (RLS settings_own),
  // under the same patient-self gate as checkDrugPhoto. No row → Arabic (the product's default).
  patientLanguage: `
    select s.language::text as language
    from settings s
    where s.patient_id = $1
      and jurah_session_is('patient') and jurah_session()->>'subjectId' = $1`,
  // Every pending alert, most severe first, then OLDEST first (the mock's queue order).
  // waitedMinutes = floor((REFERENCE_NOW − createdAt) / 1 min), never negative — jurah_now() is
  // REFERENCE_NOW (D-021). drugNames keep involved_prescription_ids' order; an id with no readable
  // row is dropped (the mock's `?? ''` + filter(Boolean)).
  getReviewQueue: `
    select a.id as alert_id, a.patient_id, ${FIRST_NAME('a.patient_id')} as patient_first_name,
           a.severity::text as severity,
           array(select p.generic_name
                 from unnest(a.involved_prescription_ids) with ordinality as u(rx_id, o)
                 join prescriptions p on p.id = u.rx_id
                 order by u.o) as drug_names,
           iso_kw(a.created_at) as created_at,
           greatest(0, floor(extract(epoch from (jurah_now() - a.created_at)) / 60))::int as waited_minutes
    from interaction_alerts a
    where a.review_status = 'pending_medical_review' and jurah_session_is('reviewer')
    order by ${SEVERITY_RANK}, a.created_at, a.id`,
  // CR-037: pending flagged rows plus already-returned history rows, in store (seq) order.
  // has_source_image — CR-050's rule as far as it can be built today: the seed rows the mock
  // hard-codes (rx-006, rx-007). prescription_drafts has no link to a saved prescription, is deleted
  // on save and is patient-only under RLS, so it cannot feed this column (divergence in
  // docs/backend-notes/p2-wp3b.md; WP5/WP7 must key the image by prescription).
  getFieldConfirmationQueue: `
    select p.id as prescription_id, p.patient_id, ${FIRST_NAME('p.patient_id')} as patient_first_name,
           p.generic_name, p.frequency_per_day, to_char(p.start_date, 'YYYY-MM-DD') as start_date, p.dose_times,
           (p.id in ('rx-006', 'rx-007')) as has_source_image,
           p.field_review_status::text as field_review_status
    from prescriptions p
    where ((p.needs_review and p.field_review_status = 'pending') or p.field_review_status = 'returned')
      and jurah_session_is('reviewer')
    order by p.seq`,
  // D-014 · divergence D-4: ONLY a pending alert, ONLY for a reviewer. The queue has no per-reviewer
  // assignment, so "queue membership" is exactly `pending_medical_review` + the reviewer role.
  getAlertForReview: `
    select ${ALERT_COLUMNS}
    from interaction_alerts a
    where a.id = $1 and a.review_status = 'pending_medical_review' and jurah_session_is('reviewer')`,
  // The mock filters the whole store by id, so store (seq) order — not involved_prescription_ids' order.
  alertReviewInvolved: `
    select ${PRESCRIPTION_COLUMNS}
    from prescriptions p
    where exists (select 1 from interaction_alerts a where a.id = $1 and p.id = any (a.involved_prescription_ids))
    order by p.seq`,
  alertReviewActive: `
    select ${PRESCRIPTION_COLUMNS}
    from prescriptions p
    where p.patient_id = $1 and p.status = 'active'
    order by p.seq`,
  // The mock's own 14-day filter (getRecentDoses is NOT used): doses of the ACTIVE prescriptions
  // whose Kuwait calendar date is in [REFERENCE_DATE − 14, REFERENCE_DATE], every status, ordered by
  // scheduledAt with ties in store order (prescription seq, then dose seq) — the mock's stable sort.
  alertReviewRecentDoses: `
    select d.id, d.prescription_id, iso_kw(d.scheduled_at) as scheduled_at, d.status::text as status, d.tracked,
           iso_kw(d.recorded_at) as recorded_at, d.source::text as source,
           p.generic_name, p.brand_name, p.strength_mg::float8 as strength_mg, p.strength_unit::text as strength_unit,
           p.dose_per_administration::float8 as dose_per_administration
    from doses d
    join prescriptions p on p.id = d.prescription_id
    where p.patient_id = $1 and p.status = 'active'
      and (d.scheduled_at at time zone 'Asia/Kuwait')::date
          between (jurah_now() at time zone 'Asia/Kuwait')::date - 14 and (jurah_now() at time zone 'Asia/Kuwait')::date
    order by d.scheduled_at, p.seq, d.seq`,
  // No settings row → tracking off, and nothing is written.
  alertReviewTracking: `
    select coalesce((select s.adherence_check_in_enabled from settings s where s.patient_id = $1), false) as tracking_on`,
  getFlaggedPrescription: `
    select ${PRESCRIPTION_COLUMNS}
    from prescriptions p
    where p.id = $1 and p.needs_review and jurah_session_is('reviewer')`,
} as const;

export const getAlerts: DataApi['getAlerts'] = async (patientId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_CLINIC.getAlerts, [patientId]);
    return rows.length === 0 ? alertsRefusal() : rows.map((r) => toAlert(r));
  });
};

export const getAlert: DataApi['getAlert'] = async (alertId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_CLINIC.getAlert, [alertId]);
    return row ? toAlert(row) : alertRefusal();
  });
};

/**
 * CR-066: when JURAH_AGENT_TRAVEL_CHECK_URL is set, the photo goes to the Travel Check agent
 * (agents/knowledge, agent-travel-check): Gemini reads only the name on the box, the agent resolves
 * it to verified ingredients and screens them against the patient's active profile, which it reads
 * itself through /api/agent (never from here). Its answer is validated in lib/agent-webhooks/core.
 * The session gate below runs FIRST either way — the agent is only ever asked about the caller's
 * own record. Unset → CR-049's deterministic stub, unchanged: identified by the image's byte size
 * and the patient's own record, never a vision model.
 */
export const checkDrugPhoto: DataApi['checkDrugPhoto'] = async (patientId, image) => {
  const session = await sessionOf();
  if (!session || session.role !== 'patient' || session.subjectId !== patientId) return drugCheckRefusal();
  if (image.size === 0) return drugCheckRefusal();
  if (travelCheckConfigured()) {
    const language = await withSession(session, async (sql) => {
      const [row] = await sql.unsafe(PG_QUERIES_CLINIC.patientLanguage, [patientId]);
      return languageOf(row?.language);
    });
    const fromAgent = await askTravelCheck(patientId, image, language);
    if (fromAgent) return fromAgent;
  }
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_CLINIC.checkDrugPhoto, [patientId]);
    if (!row) return drugCheckRefusal();
    const outcome: DrugCheckOutcome = row.alert_id
      ? { kind: 'identified', drugName: String(row.generic_name), verdict: 'interaction_found', alertId: String(row.alert_id) }
      : { kind: 'identified', drugName: String(row.generic_name), verdict: 'no_interaction' };
    return outcome;
  });
};

export const getReviewQueue: DataApi['getReviewQueue'] = async () => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_CLINIC.getReviewQueue);
    return rows.length === 0 ? reviewQueueRefusal() : rows.map((r) => toReviewQueueItem(r));
  });
};

export const getFieldConfirmationQueue: DataApi['getFieldConfirmationQueue'] = async () => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_CLINIC.getFieldConfirmationQueue);
    return rows.length === 0 ? fieldQueueRefusal() : rows.map((r) => toFieldQueueItem(r));
  });
};

export const getAlertForReview: DataApi['getAlertForReview'] = async (alertId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_CLINIC.getAlertForReview, [alertId]);
    if (!row) return alertReviewRefusal(alertId);
    const alert = toAlert(row);
    const involved = await sql.unsafe(PG_QUERIES_CLINIC.alertReviewInvolved, [alertId]);
    const active = await sql.unsafe(PG_QUERIES_CLINIC.alertReviewActive, [alert.patientId]);
    const doses = await sql.unsafe(PG_QUERIES_CLINIC.alertReviewRecentDoses, [alert.patientId]);
    const [tracking] = await sql.unsafe(PG_QUERIES_CLINIC.alertReviewTracking, [alert.patientId]);
    const involvedPrescriptions = involved.map((r) => toPrescription(r));
    return {
      alert,
      involvedPrescriptions,
      why: alertWhy(involvedPrescriptions, WHY_DATA, alert.sourceCitation),
      patientContext: {
        activePrescriptions: active.map((r) => toPrescription(r)),
        recentDoses: doses.map((r) => toDoseWithPrescription(r)),
        trackingOn: Boolean(tracking?.tracking_on),
      },
    };
  });
};

export const getFlaggedPrescription: DataApi['getFlaggedPrescription'] = async (prescriptionId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_CLINIC.getFlaggedPrescription, [prescriptionId]);
    return row ? toPrescription(row) : flaggedPrescriptionRefusal();
  });
};
