/**
 * The Data Contracts, transcribed field by field from `docs/Acceptance Criteria and Test Plan.md`
 * (v7.4, Gate 0) → "### Data Contracts". Nothing added, nothing renamed, nothing widened. Comments
 * kept where the spec states a rule. WP1 owns this file (docs/briefs/WP1.md).
 *
 * `Account`, `Prescription.drug.strengthUnit` and the five CR-002 optional `Prescription` fields,
 * and `Caregiver.revokedAt` are the v7.4 additions approved at Gate 0 (see docs/DECISIONS.md
 * CR-008, CR-003, CR-002, CR-027).
 */

export interface Account {
  // v7.4 (Gate 0, CR-008) — one row per Civil ID that has a Jur'ah account, patient or not. Role
  // resolution reads it; the masked-name lookup reads `name` and returns a masked form ONLY when a
  // row exists (G9).
  id: string;
  civilId: string; // never displayed, never returned to a client
  name: string; // full name; shown in full only to its own holder
  roles: ('patient' | 'caregiver' | 'reviewer' | 'admin')[]; // caregiver counts only while a Caregiver row is active
}

export interface Patient {
  id: string;
  civilId: string; // demo: must belong to the pre-seeded test-ID list
  name: string;
  telegramChatId?: string; // v4 — null until opt-in. Null is NORMAL (G10).
  telegramLinkedAt?: string; // v4
  phone?: string; // v4 — optional contact number. Not a messaging address.
  language: 'ar' | 'en'; // v2
  onboardingCompleted: boolean; // v3
  caregiverIds: string[];
}

export interface Caregiver {
  // one record per invitation; the role exists only once accepted
  id: string;
  civilId: string; // v7 — REQUIRED. Entered once by the patient and confirmed
  //      against a MASKED name (G9). It addresses the invitation;
  //      it does not authorise anything by itself.
  name: string; // the name the PATIENT knows them by — a claim, not a lookup
  relationship: string;
  phone?: string;
  telegramChatId?: string; // v4 — optional, alerts only, never check-ins, only while active
  linkedPatientId: string;
  status: 'pending' | 'active' | 'declined' | 'expired' | 'revoked'; // v7.2 — declined/expired added
  invitedAt: string; // v7.2
  expiresAt: string; // v7.2 — a pending invitation stops being acceptable after this
  acceptedAt?: string; // v7.2 — set ONLY by the F0 accept action
  declinedAt?: string; // v7.2
  revokedAt?: string; // v7.4 (CR-027) — when access ended. Set by BOTH kinds of withdrawal:
  //      after acceptance (caregiver_revoked) and before any answer
  //      (caregiver_invite_cancelled). `acceptedAt` set/unset tells them apart.
  accessLevel: 'read_only';
  // Only `active` grants any read access. pending / declined / expired / revoked grant NOTHING.
  // `revoked` is the single end state for an invitation the patient took back; the acceptedAt
  // distinction exists for the audit log and F1's wording ONLY — no code path branches on it for access.
}

export interface Prescription {
  id: string;
  patientId: string;
  source: { facilityName: string; sector: 'public' | 'private' };
  drug: {
    genericName: string;
    brandName?: string; // v7.4 — optional: absent for a generic-only record, or while unread (see below)
    strengthMg?: number; // v7.4 — optional only while unread (see below).
    // HOLDS THE NUMBER IN THE UNIT `strengthUnit` NAMES — the field name is
    // historical. rx-008 is `strengthMg: 50, strengthUnit: "mcg"`, never 0.05.
    // Nothing anywhere multiplies or divides this value (guard-scripted); a
    // reader who trusts the name produces a 1000× levothyroxine dose.
    strengthUnit?: 'mg' | 'mcg' | 'g' | 'ml' | 'IU'; // v7.4 (Gate 0, CR-003) — default "mg"; rx-008 is the one non-default
  };
  dosePerAdministration: number;
  frequencyPerDay?: number; // v7.4 — optional only while unread (see below)
  durationDays: number;
  dosingPattern: 'daily' | 'alternate_day' | 'other';
  startDate?: string; // v2 REQUIRED, v7.4 optional only while unread. ISO date. The schedule anchor.
  doseTimes?: string[]; // v2 REQUIRED, v7.4 optional only while unread. "HH:mm". Length MUST equal frequencyPerDay.
  // v7.4 (Gate 0, CR-002) — the five fields above (brandName, strengthMg, frequencyPerDay, startDate,
  // doseTimes) may be absent ONLY while `needsReview` is true or `fieldReviewStatus` is "pending" or
  // "returned". Two INVARIANTS, guard-scripted in Phase 1 and enforced at write time in Phase 2:
  //   (1) a prescription with status "active" and needsReview false carries all five;
  //   (2) the dose generator returns an EMPTY array unless startDate is present and
  //       doseTimes.length === frequencyPerDay. "Optional" never means an active prescription may
  //       have no schedule.
  prescribedAt?: string; // v2
  prescriberName?: string; // v2
  timingRelativeToFood?: string;
  routeOfAdministration?: string;
  specialNotes?: string;
  indication?: string;
  dispensing?: {
    unitsPerPackage: number;
    totalQuantityDispensed: number;
    dispenseDate: string;
    brandActuallyDispensed?: string;
  };
  needsReview: boolean; // v2
  fieldReviewStatus?: 'pending' | 'confirmed' | 'returned'; // v7
  fieldReviewedBy?: string; // v7
  fieldReviewedAt?: string; // v7
  fieldReviewNote?: string; // v7
  status: 'active' | 'completed' | 'discontinued';
  discontinuedReason?: string;
  discontinuedAt?: string;
}

export interface Dose {
  id: string;
  prescriptionId: string;
  scheduledAt: string;
  status: 'upcoming' | 'taken_on_time' | 'taken_late' | 'missed';
  tracked?: boolean; // v5 — false when generated while tracking was off: no pill,
  //      and no process may ever transition it to missed. Default true.
  recordedAt?: string; // v2 — required for taken_late
  source?: 'adherence_agent' | 'system' | 'seed'; // v2 — never "ui"
}

export interface InteractionAlert {
  id: string;
  patientId: string;
  involvedPrescriptionIds: string[];
  severity: 'info' | 'warning' | 'danger';
  description: string;
  sourceCitation: string; // v2
  createdAt: string; // v2
  reviewStatus: 'auto_cleared' | 'pending_medical_review' | 'reviewed';
  reviewerDecision?: 'confirmed' | 'cleared'; // v2
  reviewerNote?: string; // v2
  reviewedAt?: string; // v2
  reviewedBy?: string; // v2
}

export interface RefillRequest {
  id: string;
  patientId: string; // v2
  prescriptionId: string;
  requestedAt: string;
  routedTo: 'public_pharmacy' | 'private_pharmacy'; // must match prescription.source.sector
  status: 'requested' | 'approved' | 'denied';
}

export interface CalendarSubscription {
  patientId: string;
  icsUrl: string;
  token: string;
}

export interface MessagingLink {
  // v4, subject-scoped in v7
  id: string;
  subjectType: 'patient' | 'caregiver';
  subjectId: string; // the subject is identified once, here; a caregiver's patient is
  // found through Caregiver.linkedPatientId
  channel: 'telegram';
  status: 'not_connected' | 'pending' | 'connected' | 'expired'; // not_connected is the DEFAULT
  linkToken?: string;
  chatId?: string;
  connectedAt?: string;
}

export interface PushSubscription {
  // v7
  id: string;
  subjectType: 'patient' | 'caregiver';
  subjectId: string;
  status: 'active' | 'revoked';
  permission: 'default' | 'granted' | 'denied' | 'unsupported';
  createdAt: string;
  // The endpoint and its keys live SERVER-SIDE ONLY and never appear in a client payload,
  // in this contract, or on any screen.
}

export interface AuditEvent {
  // v7 — the single event log
  id: string;
  scope: 'patient' | 'system';
  patientId?: string;
  actor: {
    role: 'patient' | 'caregiver' | 'reviewer' | 'admin' | 'agent' | 'system';
    id?: string;
  };
  type:
    | 'prescription_added'
    | 'prescription_discontinued'
    | 'prescription_field_confirmed'
    | 'prescription_returned_to_clinic'
    | 'alert_raised'
    | 'alert_reviewed'
    | 'dose_status_recorded'
    | 'schedule_recomputed'
    | 'refill_requested'
    | 'refill_status_changed'
    | 'caregiver_invited'
    | 'caregiver_invite_accepted'
    | 'caregiver_invite_declined'
    | 'caregiver_invite_expired'
    | 'caregiver_invite_cancelled'
    | 'caregiver_revoked'
    | 'caregiver_self_unlinked'
    | 'messaging_connected'
    | 'messaging_disconnected'
    | 'push_enabled'
    | 'push_disabled'
    | 'tracking_enabled'
    | 'tracking_disabled'
    | 'signed_in'
    | 'signed_out';
  // v7.2 added the four invite lifecycle types
  message: string; // plain language; a name in it is MASKED, and it never
  // contains a Civil ID
  createdAt: string;
  relatedId?: string;
  // Append-only. Nothing in the product edits or deletes an AuditEvent.
}

export interface Settings {
  // one row per PATIENT. A caregiver has no Settings row.
  patientId: string; // v2
  adherenceCheckInEnabled: boolean; // v5 — DEFAULT false. Requires a connected chat channel.
  adherenceCheckInFrequency: 'daily' | 'every_other_day';
  refillAlertsEnabled: boolean;
  calendarSyncEnabled: boolean;
  webPushEnabled: boolean; // v7 — DEFAULT false. Alerts only; never a clinical action.
  notificationChannel: 'none' | 'telegram' | 'whatsapp' | 'email'; // v5 — the CHAT channel. DEFAULT "none"
  language: 'ar' | 'en'; // v2
  // No field here may ever represent disabling the dashboard, interaction
  // screening, or the schedule/extraction engine.
}
