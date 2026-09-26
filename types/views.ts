/**
 * View types — the shapes the seam actually returns. No function returns a `Patient`, `Caregiver`
 * or `Account` record whole (docs/briefs/WP1.md §2): `civilId` crosses the seam only as an argument
 * to `signIn`, `lookupMaskedName` and `inviteCaregiver`, and is never echoed back (G9, CLAUDE.md
 * rule 6). These are the view types named in `docs/SCREENS.md`'s appendix.
 */
import type {
  Account,
  AuditEvent,
  Caregiver,
  Dose,
  InteractionAlert,
  MessagingLink,
  Patient,
  Prescription,
  PushSubscription,
  RefillRequest,
  Settings,
} from './contracts';

/** A patient record with the Civil ID stripped. */
export type PatientView = Omit<Patient, 'civilId'>;

/** A caregiver record with the Civil ID stripped. */
export type CaregiverView = Omit<Caregiver, 'civilId'>;

/** An account record with the Civil ID stripped — used only inside the seam's own resolution logic. */
export type AccountView = Omit<Account, 'civilId'>;

// ---------------------------------------------------------------------------------------------
// Session module
// ---------------------------------------------------------------------------------------------

export type Role = 'patient' | 'caregiver' | 'reviewer' | 'admin';

/**
 * Never carries the Civil ID (D-005). `role` is required for every granted role, and left absent
 * only for `pendingInvitationOnly: true` — a session whose only claim is a pending invitation has
 * no role at all (ROLES.md, "What is not a role"); `subjectId` is then the pending Caregiver.id
 * itself (so `getPendingInvitationsForSubject`/F0 need no civilId round-trip), which is also the
 * value `SignInOutcome`'s `pending_invitation_only.invitationId` carries. Assumption flagged in the
 * WP1 report: `docs/SCREENS.md`'s appendix prose lists `role` as always one of the four values
 * without separately addressing the pending-only case.
 */
export interface Session {
  subjectId: string;
  role?: Role;
  linkedPatientId?: string;
  pendingInvitationOnly?: true;
}

/** One active role a signed-in Civil ID holds, for A1b, X0's chooser and the in-shell switch. */
export interface RoleOption {
  role: Role;
  subjectId: string;
  linkedPatientId?: string;
  /** For a caregiver option: the linked patient's first name, to render "<first name>'s medicines". */
  patientFirstName?: string;
  /** For a caregiver option: the relationship the patient recorded. */
  relationship?: string;
}

export type SignInOutcome =
  | { kind: 'not_in_test_list' }
  | { kind: 'no_claims' }
  | { kind: 'pending_invitation_only'; invitationId: string }
  | { kind: 'single_role'; session: Session }
  | { kind: 'multiple_roles'; options: RoleOption[] };

// ---------------------------------------------------------------------------------------------
// Notification subject (shared by the push and messaging functions)
// ---------------------------------------------------------------------------------------------

export interface Subject {
  subjectType: 'patient' | 'caregiver';
  subjectId: string;
}

// ---------------------------------------------------------------------------------------------
// Prescriptions and doses
// ---------------------------------------------------------------------------------------------

/** A Dose plus enough of its prescription's drug info to render a schedule row without a join. */
export interface DoseWithPrescription extends Dose {
  prescriptionId: string;
  drug: {
    genericName: string;
    brandName?: string;
    strengthMg?: number;
    strengthUnit?: Prescription['drug']['strengthUnit'];
  };
  dosePerAdministration: number;
}

export type ExtractionOutcome =
  | { kind: 'confident'; draftId: string; prescription: Partial<Prescription> }
  | { kind: 'needs_review'; draftId: string; prescription: Partial<Prescription>; uncertainFields: string[] }
  | { kind: 'unreadable' };

// ---------------------------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------------------------

export type DrugCheckOutcome =
  | { kind: 'identified'; drugName: string; verdict: 'no_interaction' | 'interaction_found'; alertId?: string }
  | { kind: 'could_not_identify' }
  // CR-078: the medicine was recognised but Travel Check cannot screen it against the whole
  // profile right now. Carries no drugName and no verdict — nothing is guessed, nothing screened.
  | { kind: 'cannot_verify' }
  // The photo was read, but it is not a medicine at all (no packet, box or strip) — the agent's own
  // classification, never inferred by the app. Carries no drugName, no verdict, no alertId: nothing
  // was screened because there was nothing to screen.
  | { kind: 'not_a_medicine' };

// ---------------------------------------------------------------------------------------------
// Supply
// ---------------------------------------------------------------------------------------------

export interface RefillLine {
  prescriptionId: string;
  genericName: string;
  brandName?: string;
  remaining: number | null;
  total: number | null;
  daysRemaining: number | null;
  routedTo: RefillRequest['routedTo'];
}

// ---------------------------------------------------------------------------------------------
// Caregiver invitations
// ---------------------------------------------------------------------------------------------

/** getInvitationForConsent's exact, five-key shape — and nothing else (docs/SCREENS.md appendix). */
export interface InvitationSummary {
  id: string;
  patientFirstName: string;
  relationship: string;
  status: Caregiver['status'];
  expiresAt: string;
}

export interface CaregiverLinkView {
  patientId: string;
  patientFirstName: string;
  acceptedAt: string;
}

// ---------------------------------------------------------------------------------------------
// Clinic
// ---------------------------------------------------------------------------------------------

export interface ReviewQueueItem {
  alertId: string;
  patientId: string;
  patientFirstName: string;
  severity: InteractionAlert['severity'];
  drugNames: string[];
  createdAt: string;
  /** CR-036 (lead, wave-2 gate): waiting time precomputed by the data layer from `createdAt`
   * against the reference clock — G1s renders it, never derives it. */
  waitedMinutes: number;
}

export interface FieldQueueItem {
  prescriptionId: string;
  patientId: string;
  patientFirstName: string;
  genericName: string;
  uncertainFields: string[];
  hasSourceImage: boolean;
  /** CR-037 (lead, wave-2 gate): the queue now carries returned rows too, marked by this field,
   * so G3s's "returned history rows" have a data-layer source without a free patient lookup. */
  fieldReviewStatus: 'pending' | 'returned';
}

/** CR-038 (lead, wave-2 gate): `getAuditLog`'s rows enrich the contract's `AuditEvent` with the
 * patient's masked name, computed server-side by the same rule F1 uses (CR-010's owner answer:
 * the patient reference on X1 is the masked name). Never a Civil ID, never a whole record. */
export type AuditLogRow = AuditEvent & { patientMaskedName?: string };

export interface PatientContext {
  activePrescriptions: Prescription[];
  recentDoses: DoseWithPrescription[];
  trackingOn: boolean;
}

/** "Why they interact" (CR-113): DDInter's own text for the alert's pair, from
 * agents/knowledge/data/interaction-why.json, with an AI draft summary written only from that text.
 * `summary` is null when no draft exists for the pair; the screen then says so and keeps the source. */
export interface AlertWhy {
  level: 'Major' | 'Moderate' | 'Minor';
  /** The pair as the interaction index keys it (lowercase English generic names, sorted). */
  drugs: [string, string];
  /** The same pair as the source or the prescriptions write it, for display ("Ibuprofen"). */
  labels: [string, string];
  summary: { en: string; ar: string } | null;
  /** DDInter's own words, English, shown verbatim. */
  mechanism: string;
  management: string;
  /** The DDInter record for the pair. */
  url: string;
  citation: string;
}

export interface AlertReviewView {
  alert: InteractionAlert;
  involvedPrescriptions: Prescription[];
  patientContext: PatientContext;
  /** Absent or null: no why-data for the pair; the screen keeps today's Source card. */
  why?: AlertWhy | null;
}

/** CR-115: the signed-in clinician's own profile, for the dashboard card on G1s/G3s and X1. Their own
 * name (a person's own name is never masked), their clinic roles, and counts of the decisions their
 * account has recorded. Never a Civil ID. */
export interface ClinicianProfile {
  name: string;
  roles: Array<'reviewer' | 'admin'>;
  decisions: {
    /** Interaction findings this account confirmed / cleared (`InteractionAlert.reviewedBy`). */
    confirmed: number;
    cleared: number;
    /** Prescriptions this account confirmed / returned (`Prescription.fieldReviewedBy`). */
    fieldsConfirmed: number;
    fieldsReturned: number;
  };
}

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

/** The seven keys `updateSettings` accepts (Backend Foundations, Feature Toggle Policy). */
export type PermittedSettingsPatch = Partial<
  Pick<
    Settings,
    | 'adherenceCheckInEnabled'
    | 'adherenceCheckInFrequency'
    | 'refillAlertsEnabled'
    | 'calendarSyncEnabled'
    | 'webPushEnabled'
    | 'notificationChannel'
    | 'language'
  >
>;

// Re-exported so a caller of lib/data need not also import lib data's own contract copies.
export type { Dose, AuditEvent, MessagingLink, PushSubscription, RefillRequest, Settings, Prescription, InteractionAlert };
