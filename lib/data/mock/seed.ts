/**
 * The seed transcription (docs/briefs/WP1.md §4; docs/Seed Dataset.md, every line). Every value is
 * either stated in the seed or derived deterministically per CR-018/CR-028/D-005, and every
 * derivation is listed in docs/backend-notes/wp1.md §2. `buildSeedState()` returns a fresh,
 * independent object graph on every call so `store.reset()` never leaks state between tests.
 *
 * Ids: Patient pt-01..04 (حمد·فاطمة·سارة·بدر, cast order) · Account acc-01..11 (seed table order) ·
 * Caregiver cg-01..08 (seed table order) · MessagingLink ml-01..05 · PushSubscription ps-01..04 ·
 * RefillRequest rf-01 (rx-003) / rf-02 (rx-001) · CalendarSubscription keyed by pt-03 (D-005).
 *
 * `ia-001.sourceCitation` is `TO_BE_SUPPLIED` (owner-owed — never a lookalike citation). The same
 * marker is used for `ia-002`/`ia-003`'s citations too: the seed states a citation only for ia-001
 * by name, but fabricating a drug-database citation for any alert is the identical hazard, so this
 * report extends the "never invent a citation" rule to all three (logged as an assumption).
 */
import { TO_BE_SUPPLIED } from '@/lib/config';
import { generateDoses } from '@/lib/schedule/generate';
import { toKuwaitIso } from '@/lib/schedule/dates';
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
import { assignAuditIds } from './audit';
import type { StoreState } from './types';

/** CR-018 — the default time-of-day used wherever the seed states a date but no time. */
const DERIVED_TIME = '12:00';
function at(date: string, time: string = DERIVED_TIME): string {
  return toKuwaitIso(date, time);
}
/** An arbitrary early "account since" date for a record the seed never dates (CR-018, flagged). */
const EARLY = '2026-01-01';

// -------------------------------------------------------------------------------------------
// Accounts (11 rows) — docs/Seed Dataset.md → "Account" table, transcribed exactly.
// -------------------------------------------------------------------------------------------
export function buildAccounts(): Account[] {
  return [
    { id: 'acc-01', civilId: '255031200187', name: 'حمد سالم المطيري', roles: ['patient'] },
    { id: 'acc-02', civilId: '258071100342', name: 'فاطمة سالم العجمي', roles: ['patient'] },
    { id: 'acc-03', civilId: '290022500654', name: 'سارة يوسف العجمي', roles: ['patient', 'caregiver'] },
    { id: 'acc-04', civilId: '268110500413', name: 'بدر فهد العنزي', roles: ['patient'] },
    { id: 'acc-05', civilId: '285061400412', name: 'عبدالله محمد عبدالعزيز المطيري', roles: ['caregiver'] },
    { id: 'acc-06', civilId: '288110300229', name: 'ناصر حمد المطيري', roles: [] },
    { id: 'acc-07', civilId: '292043000517', name: 'منى خالد المطيري', roles: [] },
    { id: 'acc-08', civilId: '298052000731', name: 'طلال عبدالله المطيري', roles: [] },
    { id: 'acc-09', civilId: '285092200664', name: 'دلال عبدالرحمن المطيري', roles: [] },
    { id: 'acc-10', civilId: '280012000961', name: 'د. خالد عبدالرحمن الرشيد', roles: ['reviewer', 'admin'] },
    { id: 'acc-11', civilId: '293080700148', name: 'م. دانة فهد السالم', roles: ['admin'] },
  ];
}

/** The Civil ID with no account — still a valid twelfth test-list entry (ROLES.md). */
export const NO_ACCOUNT_CIVIL_ID = '277091900873';
export const ALL_TEST_CIVIL_IDS = [
  '255031200187',
  '258071100342',
  '290022500654',
  '285061400412',
  '288110300229',
  '292043000517',
  NO_ACCOUNT_CIVIL_ID,
  '280012000961',
  '293080700148',
  '268110500413',
  '298052000731',
  '285092200664',
] as const;

// -------------------------------------------------------------------------------------------
// Patients (4 rows)
// -------------------------------------------------------------------------------------------
export function buildPatients(): Patient[] {
  return [
    { id: 'pt-01', civilId: '255031200187', name: 'حمد سالم المطيري', language: 'ar', onboardingCompleted: true, caregiverIds: ['cg-01', 'cg-02', 'cg-03', 'cg-04', 'cg-05', 'cg-06', 'cg-07'] },
    { id: 'pt-02', civilId: '258071100342', name: 'فاطمة سالم العجمي', language: 'ar', onboardingCompleted: true, caregiverIds: ['cg-08'] },
    { id: 'pt-03', civilId: '290022500654', name: 'سارة يوسف العجمي', language: 'ar', onboardingCompleted: true, caregiverIds: [] },
    { id: 'pt-04', civilId: '268110500413', name: 'بدر فهد العنزي', language: 'ar', onboardingCompleted: false, caregiverIds: [] },
  ];
}

// -------------------------------------------------------------------------------------------
// Caregivers (8 rows, seed table order) — relationships in the stated table order (CR-006/CR-027).
// -------------------------------------------------------------------------------------------
export function buildCaregivers(): Caregiver[] {
  return [
    {
      id: 'cg-01', civilId: '285061400412', name: 'عبدالله محمد عبدالعزيز المطيري', relationship: 'ابني',
      linkedPatientId: 'pt-01', status: 'active', invitedAt: at('2026-09-02'), expiresAt: at('2026-09-16'),
      acceptedAt: at('2026-09-03', '18:20'), accessLevel: 'read_only',
    },
    {
      id: 'cg-02', civilId: '290022500654', name: 'سارة يوسف العجمي', relationship: 'ابنتي',
      linkedPatientId: 'pt-01', status: 'active', invitedAt: at('2026-08-20'), expiresAt: at('2026-09-03'),
      acceptedAt: at('2026-08-20', '12:05'), accessLevel: 'read_only',
    },
    {
      id: 'cg-03', civilId: '288110300229', name: 'ناصر حمد المطيري', relationship: 'ابني',
      linkedPatientId: 'pt-01', status: 'pending', invitedAt: at('2026-09-18', '20:10'), expiresAt: at('2026-10-02', '20:10'),
      accessLevel: 'read_only',
    },
    {
      id: 'cg-04', civilId: '292043000517', name: 'منى خالد المطيري', relationship: 'زوجة ابني',
      linkedPatientId: 'pt-01', status: 'declined', invitedAt: at('2026-09-10'), expiresAt: at('2026-09-24'),
      declinedAt: at('2026-09-10', '14:22'), accessLevel: 'read_only',
    },
    {
      // No account for this Civil ID (docs/Seed Dataset.md line 46/65). The seed never states the
      // name حمد typed for this invitee — CHANGE REQUEST (see report): a required field with no
      // stated value gets the loud marker rather than an invented name.
      id: 'cg-05', civilId: NO_ACCOUNT_CIVIL_ID, name: TO_BE_SUPPLIED, relationship: 'قريب',
      linkedPatientId: 'pt-01', status: 'expired', invitedAt: at('2026-08-01'), expiresAt: at('2026-08-15'),
      accessLevel: 'read_only',
    },
    {
      id: 'cg-06', civilId: '298052000731', name: 'طلال عبدالله المطيري', relationship: 'حفيدي',
      linkedPatientId: 'pt-01', status: 'revoked', invitedAt: at('2026-07-10'), expiresAt: at('2026-07-24'),
      acceptedAt: at('2026-07-11'), revokedAt: at('2026-08-28'), accessLevel: 'read_only',
    },
    {
      id: 'cg-07', civilId: '285092200664', name: 'دلال عبدالرحمن المطيري', relationship: 'ابنة أخي',
      linkedPatientId: 'pt-01', status: 'revoked', invitedAt: at('2026-06-05'), expiresAt: at('2026-06-19'),
      revokedAt: at('2026-06-06'), accessLevel: 'read_only', // acceptedAt deliberately unset (CR-027)
    },
    {
      id: 'cg-08', civilId: '290022500654', name: 'سارة يوسف العجمي', relationship: 'ابنة أختي',
      linkedPatientId: 'pt-02', status: 'pending', invitedAt: at('2026-09-20', '09:30'), expiresAt: at('2026-10-04', '09:30'),
      accessLevel: 'read_only',
    },
  ];
}

// -------------------------------------------------------------------------------------------
// Prescriptions (9 rows) — docs/Seed Dataset.md → "Prescriptions" table, transcribed exactly.
// -------------------------------------------------------------------------------------------
export function buildPrescriptions(): Prescription[] {
  return [
    {
      id: 'rx-001', patientId: 'pt-01', source: { facilityName: 'مستشفى الفروانية', sector: 'public' },
      drug: { genericName: 'Warfarin', brandName: 'Marevan', strengthMg: 5 },
      dosePerAdministration: 1, frequencyPerDay: 1, durationDays: 90, dosingPattern: 'daily',
      startDate: '2026-09-01', doseTimes: ['18:00'],
      dispensing: { unitsPerPackage: 90, totalQuantityDispensed: 90, dispenseDate: '2026-09-01' },
      needsReview: false, status: 'active',
    },
    {
      id: 'rx-002', patientId: 'pt-01', source: { facilityName: 'عيادة النخبة الطبية', sector: 'private' },
      drug: { genericName: 'Ibuprofen', brandName: 'Brufen', strengthMg: 400 },
      dosePerAdministration: 1, frequencyPerDay: 3, durationDays: 7, dosingPattern: 'daily',
      startDate: '2026-09-19', doseTimes: ['08:00', '14:00', '20:00'],
      dispensing: { unitsPerPackage: 21, totalQuantityDispensed: 21, dispenseDate: '2026-09-19' },
      needsReview: false, status: 'active',
    },
    {
      id: 'rx-003', patientId: 'pt-01', source: { facilityName: 'مستشفى الفروانية', sector: 'public' },
      drug: { genericName: 'Metformin', brandName: 'Glucophage', strengthMg: 500 },
      dosePerAdministration: 1, frequencyPerDay: 2, durationDays: 180, dosingPattern: 'daily',
      startDate: '2026-06-15', doseTimes: ['08:00', '20:00'],
      dispensing: { unitsPerPackage: 60, totalQuantityDispensed: 60, dispenseDate: '2026-09-01' },
      needsReview: false, status: 'active',
    },
    {
      id: 'rx-004', patientId: 'pt-01', source: { facilityName: 'مستشفى الفروانية', sector: 'public' },
      drug: { genericName: 'Atorvastatin', brandName: 'Lipitor', strengthMg: 20 },
      dosePerAdministration: 1, frequencyPerDay: 1, durationDays: 90, dosingPattern: 'daily',
      startDate: '2026-04-02', doseTimes: ['21:00'],
      needsReview: false, status: 'discontinued',
      discontinuedReason: 'الطبيب أوقف الدواء بسبب آلام العضلات', discontinuedAt: '2026-06-28',
    },
    {
      id: 'rx-005', patientId: 'pt-02', source: { facilityName: 'مركز الصباح للأمراض الروماتيزمية', sector: 'public' },
      drug: { genericName: 'Prednisolone', strengthMg: 5 }, // no brandName (CR-002 interpretation, generic-only)
      dosePerAdministration: 1, frequencyPerDay: 1, durationDays: 60, dosingPattern: 'alternate_day',
      startDate: '2026-09-14', doseTimes: ['09:00'],
      needsReview: false, status: 'active',
    },
    {
      // The seed's own table cell for the drug is literally "(unreadable) — handwritten"; transcribed
      // as given rather than invented. dosePerAdministration is not one of CR-002's five
      // optional-while-unread fields, so it is required even here — the seed states none:
      // CHANGE REQUEST (see report), defaulted to 1 (the overwhelmingly common case) until answered.
      id: 'rx-006', patientId: 'pt-02', source: { facilityName: 'عيادة الياسمين', sector: 'private' },
      drug: { genericName: '(unreadable)' },
      dosePerAdministration: 1, durationDays: 30, dosingPattern: 'daily',
      needsReview: true, fieldReviewStatus: 'pending', status: 'active',
    },
    {
      id: 'rx-007', patientId: 'pt-02', source: { facilityName: 'عيادة الياسمين', sector: 'private' },
      drug: { genericName: 'Ciprofloxacin', strengthMg: 500 }, // no brandName (stated)
      dosePerAdministration: 1, frequencyPerDay: 2, durationDays: 7, dosingPattern: 'daily',
      doseTimes: ['09:00', '21:00'], // no startDate (stated "—")
      needsReview: true, fieldReviewStatus: 'returned',
      fieldReviewNote: 'الجرعة المكتوبة تتعارض مع المدة، يرجى مراجعة العيادة',
      // fieldReviewedBy/At: the seed names only one reviewer (د. خالد) in the whole cast, so he is
      // the only self-consistent attribution for the return action — recorded, not invented, and
      // flagged in the report since the seed does not name him for this specific row.
      fieldReviewedBy: 'acc-10', fieldReviewedAt: at('2026-09-16', '10:00'),
      status: 'active',
    },
    {
      id: 'rx-008', patientId: 'pt-03', source: { facilityName: 'مستشفى العدان', sector: 'public' },
      drug: { genericName: 'Levothyroxine', brandName: 'Eltroxin', strengthMg: 50, strengthUnit: 'mcg' },
      dosePerAdministration: 1, frequencyPerDay: 1, durationDays: 180, dosingPattern: 'daily',
      startDate: '2026-08-10', doseTimes: ['07:00'],
      dispensing: { unitsPerPackage: 180, totalQuantityDispensed: 180, dispenseDate: '2026-08-10' },
      needsReview: false, status: 'active',
    },
    {
      id: 'rx-009', patientId: 'pt-03', source: { facilityName: 'عيادة النخبة الطبية', sector: 'private' },
      drug: { genericName: 'Calcium carbonate + vitamin D3', strengthMg: 500 }, // no brandName (stated)
      dosePerAdministration: 1, frequencyPerDay: 2, durationDays: 90, dosingPattern: 'daily',
      startDate: '2026-09-05', doseTimes: ['13:00', '21:00'],
      needsReview: false, fieldReviewStatus: 'confirmed',
      fieldReviewedBy: 'acc-10', fieldReviewedAt: at('2026-09-06', '10:00'), // CR-028
      status: 'active',
    },
  ];
}

// -------------------------------------------------------------------------------------------
// Doses — generated (lib/schedule), then سارة's seven recorded rows overlaid exactly as stated.
// -------------------------------------------------------------------------------------------
export function buildDoses(prescriptions: Prescription[], settingsByPatient: Map<string, Settings>): Dose[] {
  const doses: Dose[] = [];
  for (const rx of prescriptions) {
    const trackingOn = settingsByPatient.get(rx.patientId)?.adherenceCheckInEnabled ?? false;
    doses.push(...generateDoses(rx, trackingOn));
  }

  // سارة's overlay (docs/Seed Dataset.md → "سارة — the tracked patient"). Applied here, never
  // computed from the clock (G4): every value below is the seed's own stated status/time.
  type Overlay = { prescriptionId: string; date: string; time: string; status: Dose['status']; recordedAt: string };
  const overlays: Overlay[] = [
    { prescriptionId: 'rx-008', date: '2026-09-19', time: '07:00', status: 'missed', recordedAt: at('2026-09-19', '07:55') },
    { prescriptionId: 'rx-008', date: '2026-09-20', time: '07:00', status: 'taken_on_time', recordedAt: at('2026-09-20', '07:05') },
    { prescriptionId: 'rx-009', date: '2026-09-20', time: '13:00', status: 'taken_on_time', recordedAt: at('2026-09-20', '13:20') },
    { prescriptionId: 'rx-009', date: '2026-09-20', time: '21:00', status: 'taken_late', recordedAt: at('2026-09-20', '22:40') },
    { prescriptionId: 'rx-008', date: '2026-09-21', time: '07:00', status: 'taken_on_time', recordedAt: at('2026-09-21', '07:12') },
  ];
  for (const o of overlays) {
    const id = `${o.prescriptionId}-${o.date.replace(/-/g, '')}-${o.time.replace(':', '')}`;
    const idx = doses.findIndex((d) => d.id === id);
    const overlaid: Dose = {
      id, prescriptionId: o.prescriptionId, scheduledAt: toKuwaitIso(o.date, o.time),
      status: o.status, tracked: true, recordedAt: o.recordedAt, source: 'adherence_agent',
    };
    if (idx >= 0) doses[idx] = overlaid;
    else doses.push(overlaid); // 2026-09-19 predates rx-008's normal window edge case guard
  }
  return doses;
}

// -------------------------------------------------------------------------------------------
// Interaction alerts (3 rows)
// -------------------------------------------------------------------------------------------
export function buildAlerts(): InteractionAlert[] {
  return [
    {
      id: 'ia-001', patientId: 'pt-01', involvedPrescriptionIds: ['rx-001', 'rx-002'], severity: 'danger',
      // Description text is this build's own plain-language summary (not a citation — CLAUDE.md's
      // pinned-memory rule scopes TO_BE_SUPPLIED to sourceCitation/copy-deck/bot-handle only); the
      // citation itself is never invented.
      description: 'أخذ الوارفارين مع الإيبوبروفين يرفع خطر النزيف.',
      sourceCitation: TO_BE_SUPPLIED, createdAt: '2026-09-19T11:04:00+03:00', // stated exactly
      reviewStatus: 'pending_medical_review',
    },
    {
      id: 'ia-002', patientId: 'pt-03', involvedPrescriptionIds: ['rx-008', 'rx-009'], severity: 'warning',
      description: 'الكالسيوم قد يقلل امتصاص اللِفوثيروكسين إذا أُخذا معًا.',
      sourceCitation: TO_BE_SUPPLIED, // not stated for ia-002 either — same "never invent" rule
      createdAt: at('2026-09-05', '09:00'), // derived: rx-009's own startDate, the day both drugs first coexist
      reviewStatus: 'reviewed', reviewerDecision: 'confirmed',
      reviewerNote: 'تُؤخذ اللِفوثيروكسين على معدة فارغة وتُفصل عن الكالسيوم بأربع ساعات على الأقل',
      reviewedAt: at('2026-09-08', '12:40'), reviewedBy: 'acc-10', // CR-028: account id, never the Civil ID
    },
    {
      id: 'ia-003', patientId: 'pt-02', involvedPrescriptionIds: ['rx-005'], severity: 'info',
      description: 'تم فحص بريدنيزولون مع باقي أدويتك، ولم يوجد تعارض.',
      sourceCitation: TO_BE_SUPPLIED,
      createdAt: at('2026-09-14', '09:00'), // derived: rx-005's own startDate
      reviewStatus: 'auto_cleared',
    },
  ];
}

// -------------------------------------------------------------------------------------------
// Settings (3 rows — none for بدر, deliberately)
// -------------------------------------------------------------------------------------------
export const DEFAULT_SETTINGS: Omit<Settings, 'patientId'> = {
  adherenceCheckInEnabled: false,
  adherenceCheckInFrequency: 'daily',
  refillAlertsEnabled: false,
  calendarSyncEnabled: false,
  webPushEnabled: false,
  notificationChannel: 'none',
  language: 'ar',
};

export function buildSettings(): Settings[] {
  return [
    { patientId: 'pt-01', adherenceCheckInEnabled: false, adherenceCheckInFrequency: 'daily', refillAlertsEnabled: true, calendarSyncEnabled: false, webPushEnabled: false, notificationChannel: 'none', language: 'ar' },
    { patientId: 'pt-02', adherenceCheckInEnabled: false, adherenceCheckInFrequency: 'daily', refillAlertsEnabled: true, calendarSyncEnabled: false, webPushEnabled: false, notificationChannel: 'none', language: 'ar' },
    { patientId: 'pt-03', adherenceCheckInEnabled: true, adherenceCheckInFrequency: 'daily', refillAlertsEnabled: true, calendarSyncEnabled: true, webPushEnabled: true, notificationChannel: 'telegram', language: 'ar' },
    // pt-04 (بدر): deliberately no row (docs/Seed Dataset.md line 152/159/161).
  ];
}

// -------------------------------------------------------------------------------------------
// MessagingLink (5 rows — none for بدر)
// -------------------------------------------------------------------------------------------
export function buildMessagingLinks(): MessagingLink[] {
  return [
    { id: 'ml-01', subjectType: 'patient', subjectId: 'pt-01', channel: 'telegram', status: 'not_connected' },
    // فاطمة was connected once (تراكينغ enabled then), then the link lapsed (status expired) — a
    // derivation, since the seed only states her CURRENT state; see docs/backend-notes/wp1.md §2.
    { id: 'ml-02', subjectType: 'patient', subjectId: 'pt-02', channel: 'telegram', status: 'expired', connectedAt: at('2026-07-01'), linkToken: 'mock-token-ml-02' },
    { id: 'ml-03', subjectType: 'patient', subjectId: 'pt-03', channel: 'telegram', status: 'connected', connectedAt: at('2026-08-11') },
    { id: 'ml-04', subjectType: 'caregiver', subjectId: 'cg-01', channel: 'telegram', status: 'connected', connectedAt: at('2026-09-03', '18:25') },
    // فاطمة's retry — a live single-use token (docs/Seed Dataset.md line 163). getMessagingLink
    // returns the most recently created row for a subject, so this one — not ml-02 — is "current".
    { id: 'ml-05', subjectType: 'patient', subjectId: 'pt-02', channel: 'telegram', status: 'pending', linkToken: 'mock-token-ml-05' },
  ];
}

// -------------------------------------------------------------------------------------------
// PushSubscription (4 rows — none for بدر)
// -------------------------------------------------------------------------------------------
export function buildPushSubscriptions(): PushSubscription[] {
  return [
    { id: 'ps-01', subjectType: 'patient', subjectId: 'pt-01', status: 'active', permission: 'default', createdAt: at(EARLY) },
    { id: 'ps-02', subjectType: 'patient', subjectId: 'pt-02', status: 'active', permission: 'denied', createdAt: at(EARLY) },
    { id: 'ps-03', subjectType: 'patient', subjectId: 'pt-03', status: 'active', permission: 'granted', createdAt: at('2026-08-11', '12:15') },
    { id: 'ps-04', subjectType: 'caregiver', subjectId: 'cg-01', status: 'active', permission: 'unsupported', createdAt: at('2026-09-03', '18:30') },
  ];
}

// -------------------------------------------------------------------------------------------
// RefillRequest (2 rows) and CalendarSubscription (1 row, سارة)
// -------------------------------------------------------------------------------------------
export function buildRefillRequests(): RefillRequest[] {
  return [
    { id: 'rf-01', patientId: 'pt-01', prescriptionId: 'rx-003', requestedAt: at('2026-09-20', '18:05'), routedTo: 'public_pharmacy', status: 'requested' },
    { id: 'rf-02', patientId: 'pt-01', prescriptionId: 'rx-001', requestedAt: at('2026-08-20', '09:00'), routedTo: 'public_pharmacy', status: 'approved' },
  ];
}

export function buildCalendarSubscriptions(): CalendarSubscription[] {
  // Mock-cheat (docs/backend-notes/wp1.md §2): the ICS URL and token are computed client-side here;
  // Phase 2 must generate both server-side.
  return [{ patientId: 'pt-03', icsUrl: 'webcal://jurah.app/calendar/pt-03.ics', token: 'mock-token-cal-pt-03' }];
}

// -------------------------------------------------------------------------------------------
// AuditEvent — every seed-supported type at least once, the stated counts hit exactly, every
// derived timestamp/message from docs/backend-notes/wp1.md §2. 23 types present; 2 absent by
// design (prescription_discontinued, caregiver_self_unlinked — see report).
// -------------------------------------------------------------------------------------------
export function buildAuditEvents(): AuditEvent[] {
  const raw: Omit<AuditEvent, 'id'>[] = [
    // caregiver_invited ×8
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'caregiver_invited', message: 'دعوة مقدّم رعاية إلى عبدالله م*** ع*** المطيري', createdAt: at('2026-09-02'), relatedId: 'cg-01' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'caregiver_invited', message: 'دعوة مقدّم رعاية إلى سارة ي*** العجمي', createdAt: at('2026-08-20'), relatedId: 'cg-02' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'caregiver_invited', message: 'دعوة مقدّم رعاية إلى ناصر ح*** المطيري', createdAt: at('2026-09-18', '20:10'), relatedId: 'cg-03' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'caregiver_invited', message: 'دعوة مقدّم رعاية إلى منى خ*** المطيري', createdAt: at('2026-09-10'), relatedId: 'cg-04' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'caregiver_invited', message: 'دعوة مقدّم رعاية أُرسلت', createdAt: at('2026-08-01'), relatedId: 'cg-05' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'caregiver_invited', message: 'دعوة مقدّم رعاية إلى طلال ع*** المطيري', createdAt: at('2026-07-10'), relatedId: 'cg-06' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'caregiver_invited', message: 'دعوة مقدّم رعاية إلى دلال ع*** المطيري', createdAt: at('2026-06-05'), relatedId: 'cg-07' },
    { scope: 'patient', patientId: 'pt-02', actor: { role: 'patient', id: 'pt-02' }, type: 'caregiver_invited', message: 'دعوة مقدّم رعاية إلى سارة ي*** العجمي', createdAt: at('2026-09-20', '09:30'), relatedId: 'cg-08' },

    // caregiver_invite_accepted ×3
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'caregiver', id: 'cg-01' }, type: 'caregiver_invite_accepted', message: 'عبدالله م*** ع*** المطيري قبل الدعوة', createdAt: at('2026-09-03', '18:20'), relatedId: 'cg-01' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'caregiver', id: 'cg-02' }, type: 'caregiver_invite_accepted', message: 'سارة ي*** العجمي قبلت الدعوة', createdAt: at('2026-08-20', '12:05'), relatedId: 'cg-02' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'caregiver', id: 'cg-06' }, type: 'caregiver_invite_accepted', message: 'طلال ع*** المطيري قبل الدعوة', createdAt: at('2026-07-11'), relatedId: 'cg-06' },

    // caregiver_invite_declined ×1 — actor role recorded as "caregiver" (docs/backend-notes/wp1.md
    // §2 flags this: منى never held the role; the contract's closed actor enum has no "invitee"
    // value, so this is a CR-018 derivation for the owner to confirm, not a re-use of CR-014's
    // board mistake by coincidence).
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'caregiver', id: 'cg-04' }, type: 'caregiver_invite_declined', message: 'منى خ*** المطيري رفضت الدعوة', createdAt: at('2026-09-10', '14:22'), relatedId: 'cg-04' },

    // caregiver_invite_expired ×1
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'system' }, type: 'caregiver_invite_expired', message: 'انتهت صلاحية دعوة مقدّم رعاية', createdAt: at('2026-08-15'), relatedId: 'cg-05' },

    // caregiver_revoked ×1
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'caregiver_revoked', message: 'سُحبت صلاحية طلال ع*** المطيري', createdAt: at('2026-08-28'), relatedId: 'cg-06' },

    // caregiver_invite_cancelled ×1
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'caregiver_invite_cancelled', message: 'أُلغيت دعوة دلال ع*** المطيري', createdAt: at('2026-06-06'), relatedId: 'cg-07' },

    // prescription_added ×9
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'prescription_added', message: 'أُضيفت وصفة Warfarin', createdAt: at('2026-09-01', '09:00'), relatedId: 'rx-001' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'prescription_added', message: 'أُضيفت وصفة Ibuprofen', createdAt: at('2026-09-19', '09:00'), relatedId: 'rx-002' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'prescription_added', message: 'أُضيفت وصفة Metformin', createdAt: at('2026-06-15', '09:00'), relatedId: 'rx-003' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'prescription_added', message: 'أُضيفت وصفة Atorvastatin', createdAt: at('2026-04-02', '09:00'), relatedId: 'rx-004' },
    { scope: 'patient', patientId: 'pt-02', actor: { role: 'patient', id: 'pt-02' }, type: 'prescription_added', message: 'أُضيفت وصفة Prednisolone', createdAt: at('2026-09-14', '09:00'), relatedId: 'rx-005' },
    // rx-006/rx-007 carry no date anywhere in the seed — arbitrary recent dates, flagged in the report.
    { scope: 'patient', patientId: 'pt-02', actor: { role: 'patient', id: 'pt-02' }, type: 'prescription_added', message: 'أُضيفت وصفة غير مقروءة', createdAt: at('2026-09-17', '09:00'), relatedId: 'rx-006' },
    { scope: 'patient', patientId: 'pt-02', actor: { role: 'patient', id: 'pt-02' }, type: 'prescription_added', message: 'أُضيفت وصفة Ciprofloxacin', createdAt: at('2026-09-15', '09:00'), relatedId: 'rx-007' },
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'patient', id: 'pt-03' }, type: 'prescription_added', message: 'أُضيفت وصفة Levothyroxine', createdAt: at('2026-08-10', '09:00'), relatedId: 'rx-008' },
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'patient', id: 'pt-03' }, type: 'prescription_added', message: 'أُضيفت وصفة Calcium carbonate + D3', createdAt: at('2026-09-05', '09:00'), relatedId: 'rx-009' },

    // prescription_field_confirmed ×1, prescription_returned_to_clinic ×1
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'reviewer', id: 'acc-10' }, type: 'prescription_field_confirmed', message: 'تأكيد بيانات وصفة Calcium carbonate + D3', createdAt: at('2026-09-06', '10:00'), relatedId: 'rx-009' },
    { scope: 'patient', patientId: 'pt-02', actor: { role: 'reviewer', id: 'acc-10' }, type: 'prescription_returned_to_clinic', message: 'أُعيدت وصفة Ciprofloxacin للعيادة', createdAt: at('2026-09-16', '10:00'), relatedId: 'rx-007' },

    // alert_raised ×1, alert_reviewed ×1
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'agent' }, type: 'alert_raised', message: 'تنبيه تعارض خطير: Warfarin و Ibuprofen', createdAt: '2026-09-19T11:04:00+03:00', relatedId: 'ia-001' },
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'reviewer', id: 'acc-10' }, type: 'alert_reviewed', message: 'مراجعة تنبيه: Levothyroxine و Calcium — تأكيد', createdAt: at('2026-09-08', '12:40'), relatedId: 'ia-002' },

    // dose_status_recorded ×5 — every one actor.role "agent" (never patient/caregiver/reviewer/admin)
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'agent' }, type: 'dose_status_recorded', message: 'تسجيل حالة جرعة — فائتة: Levothyroxine', createdAt: at('2026-09-19', '07:55'), relatedId: 'rx-008-20260919-0700' },
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'system' }, type: 'schedule_recomputed', message: 'إعادة حساب جدول Levothyroxine بعد جرعة فائتة', createdAt: at('2026-09-19', '07:56'), relatedId: 'rx-008' },
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'agent' }, type: 'dose_status_recorded', message: 'تسجيل حالة جرعة — في وقتها: Levothyroxine', createdAt: at('2026-09-20', '07:05'), relatedId: 'rx-008-20260920-0700' },
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'agent' }, type: 'dose_status_recorded', message: 'تسجيل حالة جرعة — في وقتها: Calcium carbonate + D3', createdAt: at('2026-09-20', '13:20'), relatedId: 'rx-009-20260920-1300' },
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'agent' }, type: 'dose_status_recorded', message: 'تسجيل حالة جرعة — متأخرة: Calcium carbonate + D3', createdAt: at('2026-09-20', '22:40'), relatedId: 'rx-009-20260920-2100' },
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'agent' }, type: 'dose_status_recorded', message: 'تسجيل حالة جرعة — في وقتها: Levothyroxine', createdAt: at('2026-09-21', '07:12'), relatedId: 'rx-008-20260921-0700' },

    // refill_requested ×1, refill_status_changed ×1
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'refill_requested', message: 'طلب تعبئة Metformin — يُوجَّه لصيدلية حكومية', createdAt: at('2026-09-20', '18:05'), relatedId: 'rf-01' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'system' }, type: 'refill_status_changed', message: 'تغيّرت حالة طلب تعبئة Warfarin إلى: تمت الموافقة', createdAt: at('2026-08-25', '10:00'), relatedId: 'rf-02' },

    // messaging_connected ×3, messaging_disconnected ×1
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'patient', id: 'pt-03' }, type: 'messaging_connected', message: 'تم ربط تيليقرام', createdAt: at('2026-08-11'), relatedId: 'ml-03' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'caregiver', id: 'cg-01' }, type: 'messaging_connected', message: 'تم ربط تيليقرام', createdAt: at('2026-09-03', '18:25'), relatedId: 'ml-04' },
    { scope: 'patient', patientId: 'pt-02', actor: { role: 'patient', id: 'pt-02' }, type: 'messaging_connected', message: 'تم ربط تيليقرام', createdAt: at('2026-07-01'), relatedId: 'ml-02' },
    // No current MessagingLink row backs a disconnect (none was ever manually disconnected in the
    // seed's stated states); one historical row is derived for حمد so the type is present at all
    // (docs/backend-notes/wp1.md §2, flagged).
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'messaging_disconnected', message: 'تم فصل تيليقرام', createdAt: at('2026-05-01'), relatedId: 'ml-01' },

    // push_enabled ×1, push_disabled ×1
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'patient', id: 'pt-03' }, type: 'push_enabled', message: 'تفعيل إشعارات المتصفح', createdAt: at('2026-08-11', '12:15'), relatedId: 'ps-03' },
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'patient', id: 'pt-03' }, type: 'push_disabled', message: 'إيقاف إشعارات المتصفح', createdAt: at('2026-08-15', '10:00'), relatedId: 'ps-03' },

    // tracking_enabled ×2, tracking_disabled ×1
    { scope: 'patient', patientId: 'pt-02', actor: { role: 'patient', id: 'pt-02' }, type: 'tracking_enabled', message: 'تفعيل متابعة الجرعات', createdAt: at('2026-07-01', '12:05'), relatedId: 'pt-02' },
    { scope: 'patient', patientId: 'pt-02', actor: { role: 'system' }, type: 'tracking_disabled', message: 'أُوقفت متابعة الجرعات — انتهت صلاحية رابط تيليقرام', createdAt: at('2026-08-05'), relatedId: 'pt-02' },
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'patient', id: 'pt-03' }, type: 'tracking_enabled', message: 'تفعيل متابعة الجرعات', createdAt: at('2026-08-11', '12:10'), relatedId: 'pt-03' },

    // signed_in ×1, signed_out ×1
    { scope: 'patient', patientId: 'pt-03', actor: { role: 'patient', id: 'pt-03' }, type: 'signed_in', message: 'دخول عن طريق هويّاتي', createdAt: '2026-09-21T06:02:00+03:00', relatedId: 'pt-03' },
    { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'signed_out', message: 'خروج', createdAt: at('2026-09-20', '21:30'), relatedId: 'pt-01' },
  ];
  return assignAuditIds(raw);
}

// -------------------------------------------------------------------------------------------
// Assembly
// -------------------------------------------------------------------------------------------
export function buildSeedState(): StoreState {
  const accounts = buildAccounts();
  const patients = buildPatients();
  const caregivers = buildCaregivers();
  const prescriptions = buildPrescriptions();
  const settings = buildSettings();
  const settingsByPatient = new Map(settings.map((s) => [s.patientId, s]));
  const doses = buildDoses(prescriptions, settingsByPatient);
  const alerts = buildAlerts();
  const messagingLinks = buildMessagingLinks();
  const pushSubscriptions = buildPushSubscriptions();
  const refillRequests = buildRefillRequests();
  const calendarSubscriptions = buildCalendarSubscriptions();
  const auditEvents = buildAuditEvents();

  return {
    accounts, patients, caregivers, prescriptions, doses, alerts, settings,
    messagingLinks, pushSubscriptions, refillRequests, calendarSubscriptions, auditEvents,
    drafts: [],
  };
}
