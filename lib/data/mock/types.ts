/**
 * The shape of the mutable mock store (D-002: "a module-level singleton … with an explicit
 * reset()"). One array per contract entity, plus the in-flight prescription-extraction drafts
 * B4 needs (submitPrescriptionImage → savePrescriptionDraft), which have no contract entity of
 * their own.
 */
import type {
  Account,
  AuditEvent,
  CalendarSubscription,
  Caregiver,
  Dose,
  InteractionAlert,
  MessagingLink,
  Patient,
  Prescription,
  PushSubscription,
  RefillRequest,
  Settings,
} from '@/types/contracts';

export interface PrescriptionDraft {
  draftId: string;
  patientId: string;
  prescription: Partial<Prescription>;
  confident: boolean;
}

export interface StoreState {
  accounts: Account[];
  patients: Patient[];
  caregivers: Caregiver[];
  prescriptions: Prescription[];
  doses: Dose[];
  alerts: InteractionAlert[];
  settings: Settings[];
  messagingLinks: MessagingLink[];
  pushSubscriptions: PushSubscription[];
  refillRequests: RefillRequest[];
  calendarSubscriptions: CalendarSubscription[];
  auditEvents: AuditEvent[];
  /** Not a contract entity — B4's in-flight drafts between submitPrescriptionImage and savePrescriptionDraft. */
  drafts: PrescriptionDraft[];
}
