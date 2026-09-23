/**
 * Refusal shapes for prescriptions and doses — owned by package WP3a (lead split at Gate 1, D-020/D-022). Only that package edits this file;
 * `lib/data/refusals.ts` is the barrel the lead owns. Rules: docs/briefs/P2-common.md.
 * A refusal is a quiet shape, never a throw (screens have no try/catch; a throw reaches error.tsx).
 */
import type { Dose, Prescription } from '@/types/contracts';
import type { DoseWithPrescription, ExtractionOutcome } from '@/types/views';
import { prescriptionFromDraft } from '../shapes/reads-rx';

/** getPrescriptions — forbidden reads nothing. */
export function prescriptionsRefusal(): Prescription[] {
  return [];
}

/** getPrescription — forbidden and missing are the same null (E-49). */
export function prescriptionRefusal(): Prescription | null {
  return null;
}

/** getDosesForDay / getRecentDoses — forbidden reads nothing. */
export function dosesWithPrescriptionRefusal(): DoseWithPrescription[] {
  return [];
}

/** getDoseHistory — forbidden and missing are the same []. */
export function doseHistoryRefusal(): Dose[] {
  return [];
}

/** submitPrescriptionImage — a caller who is not that patient gets the mock's `unreadable`. */
export function extractionRefusal(): ExtractionOutcome {
  return { kind: 'unreadable' };
}

/**
 * savePrescriptionDraft — a draft the session's patient does not own, a patientId that is not the
 * session's, or no session at all (D-014, E-41, E-29). The mock does NOT refuse here: it fabricates
 * the `(unreadable)` skeleton under `rx-draft-<n>` and SAVES it. The backend returns the same
 * skeleton's bytes with `id: ''` (the `{id:''…}` convention of requestRefill/inviteCaregiver's
 * refusals) and writes NOTHING — no prescription, no doses, no audit row. Recorded in
 * docs/backend-notes/p2-wp3a.md → Divergences.
 */
export function draftSaveRefusal(patientId: string): Prescription {
  return prescriptionFromDraft('', patientId, undefined);
}
