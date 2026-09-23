/**
 * Refusal shapes for the write paths — owned by package WP5 (lead split at Gate 1, D-020/D-022). Only that package edits this file;
 * `lib/data/refusals.ts` is the barrel the lead owns. Rules: docs/briefs/P2-common.md.
 *
 * What a REFUSED write returns — the mock's bytes, exactly (lib/data/mock-impl.ts imports the
 * literals below for its own refusals, so the two backends cannot drift; tests/unit/data/refusals.test.ts
 * compares them). Each function returns a FRESH value. A refusal is never a throw: screens have no
 * try/catch and a throw reaches error.tsx.
 *
 * The void writes (updatePatientPhone, completeOnboarding, cancelInvitation, revokeCaregiver,
 * declineInvitation, selfUnlink, submitReviewDecision) refuse with `undefined` — `voidRefusal()`.
 * updateSettings refuses with the CURRENT row (the mock's `settingsFor`): lib/data/pg/writes.ts
 * reads it under the caller's RLS and falls back to reads-ambient's `settingsRefusal` (the
 * documented defaults) when the caller may not read it.
 */
import { REFERENCE_NOW } from '@/lib/config';
import type { Prescription, RefillRequest } from '@/types/contracts';
import type { CaregiverView, Session } from '@/types/views';

/** The seven void writes. */
export function voidRefusal(): void {
  return undefined;
}

/** requestRefill — no session, not that patient, unknown / foreign / inactive prescription. */
export function refillRequestRefusal(patientId: string, prescriptionId: string): RefillRequest {
  return { id: '', patientId, prescriptionId, requestedAt: REFERENCE_NOW, routedTo: 'public_pharmacy' as const, status: 'requested' as const };
}

/** lookupMaskedName — no session, rate-limited (CR-043), or no account: the one `null` shape. */
export function maskedNameRefusal(): { maskedName: string | null } {
  return { maskedName: null };
}

/** inviteCaregiver — any session but that patient's own (or a row the database refuses). */
export function inviteRefusal(patientId: string, input: { name: string; relationship: string }): CaregiverView {
  return { id: '', name: input.name, relationship: input.relationship, linkedPatientId: patientId, status: 'pending', invitedAt: REFERENCE_NOW, expiresAt: REFERENCE_NOW, accessLevel: 'read_only' };
}

/** acceptInvitation — the caller's own session back, or the empty session when there is none. */
export function acceptRefusal(current: Session | null): Session {
  return current ?? { subjectId: '' };
}

/** confirmPrescriptionFields / returnPrescriptionToClinic — for a prescription the caller cannot
 * read (or that does not exist): the bare `{ id }`. When the caller CAN read it, the pg path returns
 * the unchanged record instead (the mock returns the stored record to any caller — BACKEND-NOTES
 * divergence WP5-4). */
export function prescriptionWriteRefusal(prescriptionId: string): Prescription {
  return { id: prescriptionId } as Prescription;
}
