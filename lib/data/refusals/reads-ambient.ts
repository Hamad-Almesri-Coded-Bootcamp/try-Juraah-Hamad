/**
 * Refusal shapes for patient, settings, caregivers, activity, audit log, notifications reads and snapshot — owned by package WP3d (lead split at Gate 1, D-020/D-022). Only that package edits this file;
 * `lib/data/refusals.ts` is the barrel the lead owns. Rules: docs/briefs/P2-common.md.
 *
 * Each function returns a FRESH value (never a shared constant) so no caller can mutate another
 * caller's refusal. Bytes are the mock's, exactly (lib/data/mock-impl.ts imports these too).
 */
import { REFERENCE_NOW } from '@/lib/config';
import type { AuditEvent, MessagingLink, PushSubscription, Settings } from '@/types/contracts';
import type { AuditLogRow, CaregiverLinkView, CaregiverView, InvitationSummary, PatientView, Subject } from '@/types/views';
import { DEFAULT_SETTINGS } from '../mock/seed';

/** getPatient — forbidden and missing are the same null. */
export function patientRefusal(): PatientView | null {
  return null;
}

/** getSettings — forbidden, and "no row" (بدر), are both the documented defaults with patientId
 * LAST (`{...DEFAULT_SETTINGS, patientId}` — the mock's key order, BACKEND-PLAN §6). */
export function settingsRefusal(patientId: string): Settings {
  return { ...DEFAULT_SETTINGS, patientId };
}

/** getInvitationForConsent — unknown, foreign or refused: the `expired` placeholder. */
export function invitationRefusal(invitationId: string): InvitationSummary {
  return { id: invitationId, patientFirstName: '', relationship: '', status: 'expired', expiresAt: REFERENCE_NOW };
}

/** getActivity — a session that may not read the patient (and a patient with no events): []. */
export function activityRefusal(): AuditEvent[] {
  return [];
}

/** getAuditLog — any session but a verified admin: []. */
export function auditLogRefusal(): AuditLogRow[] {
  return [];
}

/** getCaregivers — any session but that patient's own: []. */
export function caregiversRefusal(): CaregiverView[] {
  return [];
}

/** getPendingInvitationsForSubject — no session, or nothing pending and unexpired: []. */
export function pendingInvitationsRefusal(): InvitationSummary[] {
  return [];
}

/** getCaregiverLink — anything but that caregiver's own active session: the empty-strings view. */
export function caregiverLinkRefusal(): CaregiverLinkView {
  return { patientId: '', patientFirstName: '', acceptedAt: '' };
}

/** getPushState — not self, or never asked: null (PushSubscription's own `| null`). */
export function pushStateRefusal(): PushSubscription | null {
  return null;
}

/** getMessagingLink — not self, or no row (بدر): the `ml-default` / `not_connected` shape — never
 * null, never a throw (G10). */
export function messagingLinkRefusal(subject: Subject): MessagingLink {
  return { id: 'ml-default', subjectType: subject.subjectType, subjectId: subject.subjectId, channel: 'telegram', status: 'not_connected' };
}

/** readLastKnownSnapshot — no snapshot for this caller and key: null. */
export function snapshotRefusal(): { data: unknown; asOf: string } | null {
  return null;
}
