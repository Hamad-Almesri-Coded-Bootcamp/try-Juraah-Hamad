/**
 * The data-access layer's published interface (docs/SCREENS.md appendix → "Data-access layer (50
 * functions)"). Exactly 50 methods, grouped and commented as the appendix, one per line, `  name(`
 * — parsed by scripts/notes-check.ts and guard 4. No Civil ID crosses the seam (docs/briefs/WP1.md
 * §2): view types replace `Patient`/`Caregiver`/`Account` wherever one would otherwise leak.
 */
import type {
  AuditEvent,
  CalendarSubscription,
  Dose,
  InteractionAlert,
  MessagingLink,
  Prescription,
  PushSubscription,
  RefillRequest,
  Settings,
} from '@/types/contracts';
import type {
  AlertReviewView,
  ClinicianProfile,
  AuditLogRow,
  CaregiverLinkView,
  CaregiverView,
  DoseWithPrescription,
  DrugCheckOutcome,
  ExtractionOutcome,
  FieldQueueItem,
  InvitationSummary,
  PatientView,
  PermittedSettingsPatch,
  RefillLine,
  ReviewQueueItem,
  Session,
  Subject,
} from '@/types/views';

export interface DataApi {
  // Patient and settings
  getPatient(patientId: string): Promise<PatientView | null>;
  updatePatientPhone(patientId: string, phone: string | null): Promise<void>;
  completeOnboarding(patientId: string): Promise<void>;
  getSettings(patientId: string): Promise<Settings>;
  updateSettings(patientId: string, patch: PermittedSettingsPatch): Promise<Settings>;

  // Prescriptions and doses
  getPrescriptions(patientId: string): Promise<Prescription[]>;
  getPrescription(prescriptionId: string): Promise<Prescription | null>;
  getDosesForDay(patientId: string, isoDate: string): Promise<DoseWithPrescription[]>;
  getDoseHistory(prescriptionId: string): Promise<Dose[]>;
  getRecentDoses(patientId: string, days: number): Promise<DoseWithPrescription[]>;
  submitPrescriptionImage(patientId: string, image: Blob): Promise<ExtractionOutcome>;
  savePrescriptionDraft(patientId: string, draftId: string): Promise<Prescription>;

  // Safety
  getAlerts(patientId: string): Promise<InteractionAlert[]>;
  getAlert(alertId: string): Promise<InteractionAlert | null>;
  checkDrugPhoto(patientId: string, image: Blob): Promise<DrugCheckOutcome>;

  // Supply
  getRefillOverview(patientId: string): Promise<RefillLine[]>;
  requestRefill(patientId: string, prescriptionId: string): Promise<RefillRequest>;
  getRefillRequests(patientId: string): Promise<RefillRequest[]>;

  // Calendar
  getCalendarSubscription(patientId: string): Promise<CalendarSubscription | null>;
  enableCalendarSync(patientId: string): Promise<CalendarSubscription>;

  // Activity
  getActivity(patientId: string): Promise<AuditEvent[]>;

  // Notifications
  getPushCapability(): Promise<{ supported: boolean; iosNeedsInstall: boolean }>;
  getPushState(subject: Subject): Promise<PushSubscription | null>;
  requestPushPermission(subject: Subject): Promise<PushSubscription>;
  disablePush(subject: Subject): Promise<void>;
  sendTestNotification(subject: Subject): Promise<void>;
  getMessagingLink(subject: Subject): Promise<MessagingLink>;
  startMessagingLink(subject: Subject): Promise<MessagingLink>;
  disconnectMessaging(subject: Subject): Promise<void>;
  sendTestMessage(subject: Subject): Promise<void>;

  // Caregivers, patient side
  getCaregivers(patientId: string): Promise<CaregiverView[]>;
  lookupMaskedName(civilId: string): Promise<{ maskedName: string | null }>;
  inviteCaregiver(patientId: string, input: { civilId: string; name: string; relationship: string }): Promise<CaregiverView>;
  cancelInvitation(caregiverId: string): Promise<void>;
  revokeCaregiver(caregiverId: string): Promise<void>;

  // Consent, invited side
  getPendingInvitationsForSubject(): Promise<InvitationSummary[]>;
  getInvitationForConsent(invitationId: string): Promise<InvitationSummary>;
  acceptInvitation(invitationId: string): Promise<Session>;
  declineInvitation(invitationId: string): Promise<void>;

  // Caregiver shell
  getCaregiverLink(caregiverId: string): Promise<CaregiverLinkView>;
  selfUnlink(caregiverId: string): Promise<void>;

  // Clinic
  getReviewQueue(): Promise<ReviewQueueItem[]>;
  getFieldConfirmationQueue(): Promise<FieldQueueItem[]>;
  getAlertForReview(alertId: string): Promise<AlertReviewView>;
  submitReviewDecision(alertId: string, decision: 'confirmed' | 'cleared', note: string): Promise<void>; // CR-115: the note is required
  getClinicianProfile(): Promise<ClinicianProfile | null>; // CR-115
  getFlaggedPrescription(prescriptionId: string): Promise<Prescription | null>;
  confirmPrescriptionFields(prescriptionId: string, values: Partial<Prescription>, note?: string): Promise<Prescription>;
  returnPrescriptionToClinic(prescriptionId: string, reason: string): Promise<Prescription>;
  getAuditLog(filters: { actorRole?: string; type?: string; from?: string; to?: string }): Promise<AuditLogRow[]>; // CR-038: AuditEvent + patientMaskedName

  // Resilience
  readLastKnownSnapshot(key: string): Promise<{ data: unknown; asOf: string } | null>;
}
