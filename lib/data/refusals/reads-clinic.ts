/**
 * Refusal shapes for alerts and the clinic reads — owned by package WP3b (lead split at Gate 1, D-020/D-022). Only that package edits this file;
 * `lib/data/refusals.ts` is the barrel the lead owns. Rules: docs/briefs/P2-common.md.
 *
 * Each function returns exactly what lib/data/mock-impl.ts returns for a refused or missing call,
 * so the mock and lib/data/pg/reads-clinic.ts cannot drift (BACKEND-DIVERGENCES D-3). A fresh value
 * per call — never a shared literal a caller could mutate.
 */
import { REFERENCE_NOW } from '@/lib/config';
import type { InteractionAlert, Prescription } from '@/types/contracts';
import type { AlertReviewView, DrugCheckOutcome, FieldQueueItem, ReviewQueueItem } from '@/types/views';

/** getAlerts — forbidden and "none" are the same empty list. */
export function alertsRefusal(): InteractionAlert[] {
  return [];
}

/** getAlert — forbidden and missing are the same null (E-49's rule, for alerts). */
export function alertRefusal(): InteractionAlert | null {
  return null;
}

/** checkDrugPhoto — not the patient's own session, a 0-byte image, or no active prescription. */
export function drugCheckRefusal(): DrugCheckOutcome {
  return { kind: 'could_not_identify' };
}

/** getReviewQueue — any session that is not a reviewer (E-28, E-36). */
export function reviewQueueRefusal(): ReviewQueueItem[] {
  return [];
}

/** getFieldConfirmationQueue — any session that is not a reviewer. */
export function fieldQueueRefusal(): FieldQueueItem[] {
  return [];
}

/** getAlertForReview — not a reviewer, unknown alert, or (backend, D-014 · divergence D-4) an alert
 * that is not `pending_medical_review`. The mock's `empty` literal, key for key: the requested id
 * echoed back, `createdAt` at the reference clock. */
export function alertReviewRefusal(alertId: string): AlertReviewView {
  return {
    alert: { id: alertId, patientId: '', involvedPrescriptionIds: [], severity: 'info', description: '', sourceCitation: '', createdAt: REFERENCE_NOW, reviewStatus: 'auto_cleared' },
    involvedPrescriptions: [],
    patientContext: { activePrescriptions: [], recentDoses: [], trackingOn: false },
  };
}

/** getFlaggedPrescription — not a reviewer, unknown id, or not `needsReview` (E-32). */
export function flaggedPrescriptionRefusal(): Prescription | null {
  return null;
}
