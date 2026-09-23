/**
 * Projection literals for alerts and the clinic reads — owned by package WP3b (lead split at Gate 1, D-020/D-022). Only that package edits this file;
 * `lib/data/shapes.ts` is the barrel the lead owns. Rules: docs/briefs/P2-common.md.
 *
 * Every literal copies the MOCK's key order (Gate 3 compares serialised strings, BACKEND-PLAN §6).
 * Optional fields are dropped when the column is null (`compact`), never emitted as null.
 */
import type { InteractionAlert } from '@/types/contracts';
import type { FieldQueueItem, ReviewQueueItem } from '@/types/views';
import { compact, str, type DbRow } from './_core';

/** InteractionAlert — buildAlerts()' literal order; the four review fields in the order both the
 * seed (ia-002) and the mock's submitReviewDecision append them. */
export function toAlert(r: DbRow): InteractionAlert {
  return compact({
    id: String(r.id),
    patientId: String(r.patient_id),
    involvedPrescriptionIds: (r.involved_prescription_ids as string[] | null) ?? [],
    severity: r.severity as InteractionAlert['severity'],
    description: String(r.description),
    sourceCitation: String(r.source_citation ?? ''),
    createdAt: String(r.created_at),
    reviewStatus: r.review_status as InteractionAlert['reviewStatus'],
    reviewerDecision: str(r.reviewer_decision) as InteractionAlert['reviewerDecision'],
    reviewerNote: str(r.reviewer_note),
    reviewedAt: str(r.reviewed_at),
    reviewedBy: str(r.reviewed_by),
  }) as InteractionAlert;
}

/** ReviewQueueItem — the mock's map literal order (getReviewQueue). */
export function toReviewQueueItem(r: DbRow): ReviewQueueItem {
  return {
    alertId: String(r.alert_id),
    patientId: String(r.patient_id),
    patientFirstName: String(r.patient_first_name ?? ''),
    severity: r.severity as ReviewQueueItem['severity'],
    drugNames: ((r.drug_names as string[] | null) ?? []).filter(Boolean),
    createdAt: String(r.created_at),
    waitedMinutes: Number(r.waited_minutes),
  };
}

/**
 * FieldQueueItem — the mock's map literal order (getFieldConfirmationQueue).
 *
 * `uncertainFields` reproduces the MOCK byte for byte, including its bug: the mock tests
 * `p[k] === undefined` on the Prescription's TOP level, but `strengthMg` lives under `p.drug`, so
 * the mock lists `strengthMg` for EVERY row (rx-007 has strengthMg 500 and still reads
 * ["strengthMg","startDate"]). The other three keys are derived from their null columns in the
 * mock's order; `brandName` is never listed (generic-only records). Change request in
 * docs/backend-notes/p2-wp3b.md — the shape is kept until the owner answers.
 *
 * `hasSourceImage` is the SQL column `has_source_image` (see PG_QUERIES_CLINIC — the seed rule,
 * divergence recorded in the fragment).
 */
export function toFieldQueueItem(r: DbRow): FieldQueueItem {
  const uncertainFields: string[] = ['strengthMg'];
  if (r.frequency_per_day === null || r.frequency_per_day === undefined) uncertainFields.push('frequencyPerDay');
  if (r.start_date === null || r.start_date === undefined) uncertainFields.push('startDate');
  if (r.dose_times === null || r.dose_times === undefined) uncertainFields.push('doseTimes');
  return {
    prescriptionId: String(r.prescription_id),
    patientId: String(r.patient_id),
    patientFirstName: String(r.patient_first_name ?? ''),
    genericName: String(r.generic_name),
    uncertainFields,
    hasSourceImage: Boolean(r.has_source_image),
    fieldReviewStatus: r.field_review_status === 'returned' ? 'returned' : 'pending',
  };
}

// DoseWithPrescription (getAlertForReview's recentDoses) is WP3a's toDoseWithPrescription in
// ./reads-rx — one literal for both packages, so the review context and B1 cannot drift.
