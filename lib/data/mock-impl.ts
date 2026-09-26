'use server';
/**
 * The MOCK implementation of the seam (D-020): the Phase 1 body of lib/data/index.ts, moved here
 * verbatim by P2-WP1 — lib/data/index.ts is now a dispatcher that selects this module when
 * JURAH_DATA_BACKEND=mock (the default for vitest and `npm run verify`). The only edits: the two
 * inline refusal literals below now come from ./refusals (shared with lib/data/pg, D-022), same bytes.
 *
 * The data-access layer ('use server'), implementing `DataApi` by delegating to `lib/data/mock/*`
 * (docs/briefs/WP1.md §2/§3). Every patient-scoped function checks the session (ROLES.md
 * "Enforcement in Phase 1", point 3) before returning anything; every mutation appends an
 * `AuditEvent` and never writes `Dose.status` (G1).
 */
import { REFERENCE_NOW } from '@/lib/config';
import { generateDoses } from '@/lib/schedule/generate';
import { computeDepletion } from '@/lib/schedule/depletion';
import { dosesOnDate } from '@/lib/schedule/group';
import { daysBetween, REFERENCE_DATE } from '@/lib/schedule/dates';
import { getStore } from './mock/store';
import { canReadPatient } from './mock/access';
import { append } from './mock/audit';
import { civilIdForSession, findAccountById, maskedNameFor } from './mock/accounts';
import { maskName } from '@/lib/format/maskedName';
import {
  acceptInvitation as mockAccept,
  cancelInvitation as mockCancel,
  caregiverById,
  declineInvitation as mockDecline,
  inviteCaregiver as mockInvite,
  patientFirstName,
  pendingInvitationsFor,
  revokeCaregiver as mockRevoke,
  toInvitationSummary,
} from './mock/caregivers';
import { readSessionCookie, writeSessionCookie, clearSessionCookie } from '@/lib/session/cookie';
import { messagingLinkFor, pushStateFor, settingsFor } from './mock/reads';
import { applySettingsPatch } from './mock/settings';
import { invitationRefusal, settingsRefusal } from './refusals';
import { enableCalendarSyncRefusal, requestPushPermissionRefusal, startMessagingLinkRefusal } from './refusals/channels'; // WP6
import { calendarSubscriptionRefusal, refillOverviewRefusal, refillRequestsRefusal } from './refusals/reads-supply'; // WP3c
import { alertRefusal, alertReviewRefusal, alertsRefusal, clinicianProfileRefusal, drugCheckRefusal, fieldQueueRefusal, flaggedPrescriptionRefusal, reviewQueueRefusal } from './refusals/reads-clinic'; // WP3b
import { activityRefusal, auditLogRefusal, caregiverLinkRefusal, caregiversRefusal, messagingLinkRefusal, patientRefusal, pendingInvitationsRefusal, pushStateRefusal, snapshotRefusal } from './refusals/reads-ambient'; // WP3d
// WP3a (P2): the prescriptions-and-doses refusal literals, shared with lib/data/pg (D-022).
import { doseHistoryRefusal, dosesWithPrescriptionRefusal, extractionRefusal, prescriptionRefusal, prescriptionsRefusal } from './refusals/reads-rx';
import { acceptRefusal, inviteRefusal, prescriptionWriteRefusal, refillRequestRefusal } from './refusals/writes'; // WP5
import type { DataApi } from './api';
import { alertWhy } from './shapes/why'; // CR-113
import { WHY_DATA } from './why-data';
import type {
  AlertReviewView,
  CaregiverLinkView,
  CaregiverView,
  ClinicianProfile,
  DoseWithPrescription,
  DrugCheckOutcome,
  FieldQueueItem,
  PatientView,
  PermittedSettingsPatch,
  RefillLine,
  ReviewQueueItem,
  Session,
  Subject,
} from '@/types/views';
import type { Dose, MessagingLink, Prescription } from '@/types/contracts';

// -------------------------------------------------------------------------------------------
// Shared helpers
// -------------------------------------------------------------------------------------------
async function session(): Promise<Session | null> {
  return readSessionCookie();
}

function stripCivilId<T extends { civilId: string }>(obj: T): Omit<T, 'civilId'> {
  const rest: Partial<T> = { ...obj };
  delete rest.civilId;
  return rest as Omit<T, 'civilId'>;
}

function toDoseWithPrescription(dose: Dose, rx: Prescription): DoseWithPrescription {
  return {
    ...dose,
    prescriptionId: rx.id,
    drug: { genericName: rx.drug.genericName, brandName: rx.drug.brandName, strengthMg: rx.drug.strengthMg, strengthUnit: rx.drug.strengthUnit },
    dosePerAdministration: rx.dosePerAdministration,
  };
}

function isSelf(s: Session | null, subject: Subject): boolean {
  if (!s || !s.role) return false;
  return s.role === subject.subjectType && s.subjectId === subject.subjectId;
}

const snapshots = new Map<string, { data: unknown; asOf: string }>();
function recordSnapshot(key: string, data: unknown): void {
  snapshots.set(key, { data, asOf: REFERENCE_NOW });
}

// -------------------------------------------------------------------------------------------
// Patient and settings
// -------------------------------------------------------------------------------------------
export const getPatient: DataApi['getPatient'] = async (patientId) => {
  const store = getStore();
  const s = await session();
  if (!canReadPatient(store, s, patientId)) return patientRefusal();
  const p = store.patients.find((x) => x.id === patientId);
  const view: PatientView | null = p ? stripCivilId(p) : null;
  if (view) recordSnapshot(`getPatient:${patientId}`, view);
  return view;
};

export const updatePatientPhone: DataApi['updatePatientPhone'] = async (patientId, phone) => {
  const s = await session();
  if (!s || s.role !== 'patient' || s.subjectId !== patientId) return;
  const p = getStore().patients.find((x) => x.id === patientId);
  if (p) p.phone = phone ?? undefined;
};

export const completeOnboarding: DataApi['completeOnboarding'] = async (patientId) => {
  const s = await session();
  if (!s || s.role !== 'patient' || s.subjectId !== patientId) return;
  const p = getStore().patients.find((x) => x.id === patientId);
  if (p) p.onboardingCompleted = true;
};

export const getSettings: DataApi['getSettings'] = async (patientId) => {
  const store = getStore();
  const s = await session();
  if (!canReadPatient(store, s, patientId)) return settingsRefusal(patientId);
  return settingsFor(store, patientId); // بدر: documented defaults, never a written row
};

export const updateSettings: DataApi['updateSettings'] = async (patientId, patch: PermittedSettingsPatch) => {
  const store = getStore();
  const s = await session();
  if (!s || s.role !== 'patient' || s.subjectId !== patientId) {
    return settingsFor(store, patientId);
  }
  return applySettingsPatch(store, patientId, patch, REFERENCE_NOW);
};

// -------------------------------------------------------------------------------------------
// Prescriptions and doses
// -------------------------------------------------------------------------------------------
export const getPrescriptions: DataApi['getPrescriptions'] = async (patientId) => {
  const store = getStore();
  const s = await session();
  if (!canReadPatient(store, s, patientId)) return prescriptionsRefusal();
  return store.prescriptions.filter((p) => p.patientId === patientId);
};

export const getPrescription: DataApi['getPrescription'] = async (prescriptionId) => {
  const store = getStore();
  const rx = store.prescriptions.find((p) => p.id === prescriptionId);
  if (!rx) return prescriptionRefusal();
  const s = await session();
  if (!canReadPatient(store, s, rx.patientId)) return prescriptionRefusal();
  return rx;
};

export const getDosesForDay: DataApi['getDosesForDay'] = async (patientId, isoDate) => {
  const store = getStore();
  const s = await session();
  if (!canReadPatient(store, s, patientId)) return dosesWithPrescriptionRefusal();
  const rxById = new Map(store.prescriptions.filter((p) => p.patientId === patientId).map((p) => [p.id, p]));
  const doses = store.doses.filter((d) => rxById.has(d.prescriptionId));
  return dosesOnDate(doses, isoDate).map((d) => toDoseWithPrescription(d, rxById.get(d.prescriptionId)!));
};

export const getDoseHistory: DataApi['getDoseHistory'] = async (prescriptionId) => {
  const store = getStore();
  const rx = store.prescriptions.find((p) => p.id === prescriptionId);
  if (!rx) return doseHistoryRefusal();
  const s = await session();
  if (!canReadPatient(store, s, rx.patientId)) return doseHistoryRefusal();
  return store.doses.filter((d) => d.prescriptionId === prescriptionId).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
};

export const getRecentDoses: DataApi['getRecentDoses'] = async (patientId, days) => {
  const store = getStore();
  const s = await session();
  if (!canReadPatient(store, s, patientId)) return dosesWithPrescriptionRefusal();
  const from = REFERENCE_DATE;
  const rxById = new Map(store.prescriptions.filter((p) => p.patientId === patientId).map((p) => [p.id, p]));
  return store.doses
    .filter((d) => rxById.has(d.prescriptionId) && daysBetween(d.scheduledAt.slice(0, 10), from) >= 0 && daysBetween(d.scheduledAt.slice(0, 10), from) <= days)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .map((d) => toDoseWithPrescription(d, rxById.get(d.prescriptionId)!));
};

/** Mock shortcut (docs/backend-notes/wp1.md §2): the outcome is chosen from the image Blob's byte
 * size, not a real extraction agent — deterministic and testable without a model call. */
export const submitPrescriptionImage: DataApi['submitPrescriptionImage'] = async (patientId, image) => {
  const store = getStore();
  const s = await session();
  if (!s || s.role !== 'patient' || s.subjectId !== patientId) return extractionRefusal();
  const draftId = `draft-${store.drafts.length + 1}`;
  if (image.size === 0) return { kind: 'unreadable' };
  if (image.size < 100) {
    const prescription: Partial<Prescription> = { drug: { genericName: '(unreadable)' }, dosePerAdministration: 1, durationDays: 30, dosingPattern: 'daily', needsReview: true, fieldReviewStatus: 'pending', status: 'active' };
    store.drafts.push({ draftId, patientId, prescription, confident: false });
    return { kind: 'needs_review', draftId, prescription, uncertainFields: ['strengthMg', 'frequencyPerDay', 'startDate', 'doseTimes'] };
  }
  const prescription: Partial<Prescription> = {
    drug: { genericName: 'Ibuprofen', brandName: 'Brufen', strengthMg: 400 }, dosePerAdministration: 1,
    frequencyPerDay: 3, durationDays: 7, dosingPattern: 'daily', doseTimes: ['08:00', '14:00', '20:00'],
    // CR-002 invariant (1): a confident (needsReview:false) extraction carries the four clinical
    // fields — a freshly scanned prescription starts on the day of scanning (CR-035, lead fix).
    startDate: REFERENCE_DATE,
    needsReview: false, status: 'active',
  };
  store.drafts.push({ draftId, patientId, prescription, confident: true });
  return { kind: 'confident', draftId, prescription };
};

export const savePrescriptionDraft: DataApi['savePrescriptionDraft'] = async (patientId, draftId) => {
  const store = getStore();
  const draft = store.drafts.find((d) => d.draftId === draftId && d.patientId === patientId);
  const id = `rx-draft-${store.prescriptions.length + 1}`;
  const rx: Prescription = {
    id, patientId,
    source: { facilityName: '', sector: 'public' },
    drug: draft?.prescription.drug ?? { genericName: '(unreadable)' },
    dosePerAdministration: draft?.prescription.dosePerAdministration ?? 1,
    frequencyPerDay: draft?.prescription.frequencyPerDay,
    durationDays: draft?.prescription.durationDays ?? 30,
    dosingPattern: draft?.prescription.dosingPattern ?? 'daily',
    startDate: draft?.prescription.startDate,
    doseTimes: draft?.prescription.doseTimes,
    needsReview: draft?.prescription.needsReview ?? true,
    fieldReviewStatus: draft?.prescription.fieldReviewStatus ?? 'pending',
    status: 'active',
  };
  store.prescriptions.push(rx);
  const trackingOn = store.settings.find((x) => x.patientId === patientId)?.adherenceCheckInEnabled ?? false;
  store.doses.push(...generateDoses(rx, trackingOn));
  if (draft) store.drafts = store.drafts.filter((d) => d.draftId !== draftId);
  append(store, {
    scope: 'patient', patientId, actor: { role: 'patient', id: patientId }, type: 'prescription_added',
    message: `أُضيفت وصفة ${rx.drug.genericName}`, createdAt: REFERENCE_NOW, relatedId: id,
  });
  return rx;
};

// -------------------------------------------------------------------------------------------
// Safety
// -------------------------------------------------------------------------------------------
const SEVERITY_RANK = { danger: 0, warning: 1, info: 2 } as const;

export const getAlerts: DataApi['getAlerts'] = async (patientId) => {
  const store = getStore();
  const s = await session();
  if (!canReadPatient(store, s, patientId)) return alertsRefusal();
  return store.alerts.filter((a) => a.patientId === patientId).sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.createdAt.localeCompare(a.createdAt));
};

export const getAlert: DataApi['getAlert'] = async (alertId) => {
  const store = getStore();
  const alert = store.alerts.find((a) => a.id === alertId);
  if (!alert) return alertRefusal();
  const s = await session();
  if (!canReadPatient(store, s, alert.patientId)) return alertRefusal();
  return alert;
};

/** Mock shortcut: identified by the image's byte size, never a real vision model. */
export const checkDrugPhoto: DataApi['checkDrugPhoto'] = async (patientId, image) => {
  const store = getStore();
  const s = await session();
  if (!s || s.role !== 'patient' || s.subjectId !== patientId) return drugCheckRefusal();
  if (image.size === 0) return drugCheckRefusal();
  const rx = store.prescriptions.find((p) => p.patientId === patientId && p.status === 'active');
  if (!rx) return drugCheckRefusal();
  const dangerAlert = store.alerts.find((a) => a.patientId === patientId && a.involvedPrescriptionIds.includes(rx.id) && a.severity === 'danger');
  const outcome: DrugCheckOutcome = dangerAlert
    ? { kind: 'identified', drugName: rx.drug.genericName, verdict: 'interaction_found', alertId: dangerAlert.id }
    : { kind: 'identified', drugName: rx.drug.genericName, verdict: 'no_interaction' };
  return outcome;
};

// -------------------------------------------------------------------------------------------
// Supply
// -------------------------------------------------------------------------------------------
export const getRefillOverview: DataApi['getRefillOverview'] = async (patientId) => {
  const store = getStore();
  const s = await session();
  if (!canReadPatient(store, s, patientId)) return refillOverviewRefusal();
  return store.prescriptions
    .filter((p) => p.patientId === patientId && p.status === 'active')
    .map((rx): RefillLine => {
      const d = computeDepletion(rx);
      return {
        prescriptionId: rx.id, genericName: rx.drug.genericName, brandName: rx.drug.brandName,
        remaining: d.remaining, total: d.total, daysRemaining: d.daysRemaining,
        routedTo: rx.source.sector === 'public' ? 'public_pharmacy' : 'private_pharmacy',
      };
    });
};

export const requestRefill: DataApi['requestRefill'] = async (patientId, prescriptionId) => {
  const store = getStore();
  const s = await session();
  const rx = store.prescriptions.find((p) => p.id === prescriptionId);
  if (!s || s.role !== 'patient' || s.subjectId !== patientId || !rx) {
    return refillRequestRefusal(patientId, prescriptionId);
  }
  const id = `rf-${String(store.refillRequests.length + 1).padStart(2, '0')}`;
  const routedTo: 'public_pharmacy' | 'private_pharmacy' = rx.source.sector === 'public' ? 'public_pharmacy' : 'private_pharmacy';
  const request = { id, patientId, prescriptionId, requestedAt: REFERENCE_NOW, routedTo, status: 'requested' as const };
  store.refillRequests.push(request);
  append(store, {
    scope: 'patient', patientId, actor: { role: 'patient', id: patientId }, type: 'refill_requested',
    message: `طلب تعبئة ${rx.drug.genericName}`, createdAt: REFERENCE_NOW, relatedId: id,
  });
  return request;
};

export const getRefillRequests: DataApi['getRefillRequests'] = async (patientId) => {
  const store = getStore();
  const s = await session();
  if (!canReadPatient(store, s, patientId)) return refillRequestsRefusal();
  return store.refillRequests.filter((r) => r.patientId === patientId);
};

// -------------------------------------------------------------------------------------------
// Calendar
// -------------------------------------------------------------------------------------------
export const getCalendarSubscription: DataApi['getCalendarSubscription'] = async (patientId) => {
  const store = getStore();
  const s = await session();
  if (!s || s.role !== 'patient' || s.subjectId !== patientId) return calendarSubscriptionRefusal();
  return store.calendarSubscriptions.find((c) => c.patientId === patientId) ?? null;
};

export const enableCalendarSync: DataApi['enableCalendarSync'] = async (patientId) => {
  const store = getStore();
  const s = await session();
  const existing = store.calendarSubscriptions.find((c) => c.patientId === patientId);
  if (!s || s.role !== 'patient' || s.subjectId !== patientId) {
    return existing ?? enableCalendarSyncRefusal(patientId);
  }
  let sub = existing;
  if (!sub) {
    // Mock-cheat (docs/backend-notes/wp1.md §2): the URL and token are computed here; Phase 2
    // must generate both server-side.
    sub = { patientId, icsUrl: `webcal://jurah.app/calendar/${patientId}.ics`, token: `mock-token-cal-${patientId}` };
    store.calendarSubscriptions.push(sub);
  }
  const settings = store.settings.find((x) => x.patientId === patientId);
  if (settings) settings.calendarSyncEnabled = true;
  return sub;
};

// -------------------------------------------------------------------------------------------
// Activity
// -------------------------------------------------------------------------------------------
export const getActivity: DataApi['getActivity'] = async (patientId) => {
  const store = getStore();
  const s = await session();
  if (!canReadPatient(store, s, patientId)) return activityRefusal();
  return store.auditEvents.filter((e) => e.scope === 'patient' && e.patientId === patientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

// -------------------------------------------------------------------------------------------
// Notifications
// -------------------------------------------------------------------------------------------
/** Mock shortcut: Phase 1 cannot detect the real device/browser server-side; a static, generic
 * capability is reported. Real detection is client-side, Phase 2/WP4 (docs/backend-notes/wp1.md §2). */
export const getPushCapability: DataApi['getPushCapability'] = async () => ({ supported: true, iosNeedsInstall: false });

export const getPushState: DataApi['getPushState'] = async (subject) => {
  const store = getStore();
  const s = await session();
  if (!isSelf(s, subject)) return pushStateRefusal();
  return pushStateFor(store, subject);
};

export const requestPushPermission: DataApi['requestPushPermission'] = async (subject) => {
  const store = getStore();
  const s = await session();
  const existing = store.pushSubscriptions.find((p) => p.subjectType === subject.subjectType && p.subjectId === subject.subjectId);
  if (!isSelf(s, subject)) {
    return existing ?? requestPushPermissionRefusal(subject);
  }
  let row = existing;
  if (!row) {
    row = { id: `ps-${String(store.pushSubscriptions.length + 1).padStart(2, '0')}`, subjectType: subject.subjectType, subjectId: subject.subjectId, status: 'active', permission: 'granted', createdAt: REFERENCE_NOW };
    store.pushSubscriptions.push(row);
  } else {
    row.status = 'active';
    row.permission = 'granted'; // simulated — Phase 1 never asks a real browser (PUSH_IS_SIMULATED)
  }
  if (subject.subjectType === 'patient') {
    append(store, { scope: 'patient', patientId: subject.subjectId, actor: { role: 'patient', id: subject.subjectId }, type: 'push_enabled', message: 'تفعيل إشعارات المتصفح', createdAt: REFERENCE_NOW, relatedId: row.id });
  }
  return row;
};

export const disablePush: DataApi['disablePush'] = async (subject) => {
  const store = getStore();
  const s = await session();
  if (!isSelf(s, subject)) return;
  const row = store.pushSubscriptions.find((p) => p.subjectType === subject.subjectType && p.subjectId === subject.subjectId);
  if (!row) return;
  row.status = 'revoked';
  if (subject.subjectType === 'patient') {
    append(store, { scope: 'patient', patientId: subject.subjectId, actor: { role: 'patient', id: subject.subjectId }, type: 'push_disabled', message: 'إيقاف إشعارات المتصفح', createdAt: REFERENCE_NOW, relatedId: row.id });
  }
};

export const sendTestNotification: DataApi['sendTestNotification'] = async (subject) => {
  const s = await session();
  void s; void subject; // simulated — no payload is ever sent, nothing to record (G12)
};

/** فاطمة's patient subject has two rows (ml-02 expired, ml-05 pending retry) — the most recently
 * created one is "current" (docs/backend-notes/wp1.md §2). */
export const getMessagingLink: DataApi['getMessagingLink'] = async (subject) => {
  const store = getStore();
  const s = await session();
  if (!isSelf(s, subject)) return messagingLinkRefusal(subject);
  return messagingLinkFor(store, subject); // بدر / not-yet-connected: not_connected, never null, never throws (G10)
};

export const startMessagingLink: DataApi['startMessagingLink'] = async (subject) => {
  const store = getStore();
  const s = await session();
  if (!isSelf(s, subject)) return startMessagingLinkRefusal(subject);
  // Parity with the database (AP-09, CR-086): the trigger link_caregiver_must_be_active refuses a
  // caregiver's link unless the invitation is `active` (rule 5), and connectByToken connects one
  // only while it still is. The mock refused neither, so a revoked caregiver's link auto-confirmed.
  const caregiverActive = () => subject.subjectType !== 'caregiver' || caregiverById(store, subject.subjectId)?.status === 'active';
  if (!caregiverActive()) return startMessagingLinkRefusal(subject);
  // Numbered from the store, which every bundle of the server shares (AP-09, lib/data/mock/store.ts).
  const linkCounter = store.messagingLinks.reduce((n, l) => (l.id.startsWith('ml-live-') ? n + 1 : n), 0) + 1;
  const row: MessagingLink = { id: `ml-live-${linkCounter}`, subjectType: subject.subjectType, subjectId: subject.subjectId, channel: 'telegram', status: 'pending', linkToken: `mock-token-live-${linkCounter}` };
  store.messagingLinks.push(row);
  // Mock shortcut (docs/backend-notes/wp1.md §2): the mock auto-confirms after a short delay —
  // never a real bot. A real delay primitive (setTimeout), not a clock read, so G3's guard does
  // not apply.
  setTimeout(() => {
    // As connectByToken: only a still-pending row, only while a caregiver is active, and the token is
    // spent (single use).
    if (row.status !== 'pending' || !caregiverActive()) return;
    row.status = 'connected';
    row.connectedAt = REFERENCE_NOW;
    row.linkToken = undefined;
    append(store, { scope: subject.subjectType === 'patient' ? 'patient' : 'system', patientId: subject.subjectType === 'patient' ? subject.subjectId : undefined, actor: { role: subject.subjectType, id: subject.subjectId }, type: 'messaging_connected', message: 'تم ربط تيليقرام', createdAt: REFERENCE_NOW, relatedId: row.id });
  }, 50);
  return row;
};

export const disconnectMessaging: DataApi['disconnectMessaging'] = async (subject) => {
  const store = getStore();
  const s = await session();
  if (!isSelf(s, subject)) return;
  const row = store.messagingLinks.filter((l) => l.subjectType === subject.subjectType && l.subjectId === subject.subjectId).at(-1);
  if (row) { row.status = 'not_connected'; row.chatId = undefined; row.linkToken = undefined; }
  if (subject.subjectType === 'patient') {
    const settings = store.settings.find((x) => x.patientId === subject.subjectId);
    if (settings?.adherenceCheckInEnabled) {
      settings.adherenceCheckInEnabled = false;
      append(store, { scope: 'patient', patientId: subject.subjectId, actor: { role: 'system' }, type: 'tracking_disabled', message: 'أُوقفت متابعة الجرعات', createdAt: REFERENCE_NOW, relatedId: subject.subjectId });
    }
    append(store, { scope: 'patient', patientId: subject.subjectId, actor: { role: 'patient', id: subject.subjectId }, type: 'messaging_disconnected', message: 'تم فصل تيليقرام', createdAt: REFERENCE_NOW, relatedId: row?.id });
  }
};

export const sendTestMessage: DataApi['sendTestMessage'] = async (subject) => {
  const s = await session();
  void s; void subject; // simulated — never a real bot call
};

// -------------------------------------------------------------------------------------------
// Caregivers, patient side
// -------------------------------------------------------------------------------------------
export const getCaregivers: DataApi['getCaregivers'] = async (patientId) => {
  const store = getStore();
  const s = await session();
  if (!s || s.role !== 'patient' || s.subjectId !== patientId) return caregiversRefusal();
  return store.caregivers.filter((c) => c.linkedPatientId === patientId).map((c): CaregiverView => stripCivilId(c));
};

export const lookupMaskedName: DataApi['lookupMaskedName'] = async (civilId) => maskedNameFor(getStore(), civilId);

export const inviteCaregiver: DataApi['inviteCaregiver'] = async (patientId, input) => {
  const store = getStore();
  const s = await session();
  if (!s || s.role !== 'patient' || s.subjectId !== patientId) {
    return inviteRefusal(patientId, input);
  }
  const c = mockInvite(store, patientId, input, REFERENCE_NOW);
  return stripCivilId(c);
};

export const cancelInvitation: DataApi['cancelInvitation'] = async (caregiverId) => {
  const store = getStore();
  const s = await session();
  const c = caregiverById(store, caregiverId);
  if (!s || s.role !== 'patient' || !c || s.subjectId !== c.linkedPatientId) return;
  mockCancel(store, caregiverId, REFERENCE_NOW);
};

export const revokeCaregiver: DataApi['revokeCaregiver'] = async (caregiverId) => {
  const store = getStore();
  const s = await session();
  const c = caregiverById(store, caregiverId);
  if (!s || s.role !== 'patient' || !c || s.subjectId !== c.linkedPatientId) return;
  mockRevoke(store, caregiverId, REFERENCE_NOW);
};

// -------------------------------------------------------------------------------------------
// Consent, invited side
// -------------------------------------------------------------------------------------------
export const getPendingInvitationsForSubject: DataApi['getPendingInvitationsForSubject'] = async () => {
  const store = getStore();
  const s = await session();
  if (!s) return pendingInvitationsRefusal();
  if (s.pendingInvitationOnly) {
    const c = caregiverById(store, s.subjectId);
    return c && c.status === 'pending' && c.expiresAt > REFERENCE_NOW ? [toInvitationSummary(store, c)] : pendingInvitationsRefusal();
  }
  const civilId = civilIdForSession(store, s);
  if (!civilId) return pendingInvitationsRefusal();
  return pendingInvitationsFor(store, civilId, REFERENCE_NOW).map((c) => toInvitationSummary(store, c));
};

/** Exactly five keys (F0's non-negotiable invariant) — nothing else on the object. */
export const getInvitationForConsent: DataApi['getInvitationForConsent'] = async (invitationId) => {
  const store = getStore();
  const c = caregiverById(store, invitationId);
  if (!c) return invitationRefusal(invitationId);
  return toInvitationSummary(store, c);
};

export const acceptInvitation: DataApi['acceptInvitation'] = async (invitationId) => {
  const store = getStore();
  const s = await session();
  const c = caregiverById(store, invitationId);
  const authorised = !!c && ((s?.pendingInvitationOnly && s.subjectId === invitationId) || (!!s?.role && civilIdForSession(store, s) === c.civilId));
  if (!authorised) return acceptRefusal(s);
  const updated = mockAccept(store, invitationId, REFERENCE_NOW);
  if (!updated) return acceptRefusal(s);
  const newSession: Session = { subjectId: updated.id, role: 'caregiver', linkedPatientId: updated.linkedPatientId };
  await writeSessionCookie(newSession);
  return newSession;
};

export const declineInvitation: DataApi['declineInvitation'] = async (invitationId) => {
  const store = getStore();
  const s = await session();
  const c = caregiverById(store, invitationId);
  const authorised = !!c && ((s?.pendingInvitationOnly && s.subjectId === invitationId) || (!!s?.role && civilIdForSession(store, s) === c.civilId));
  if (!authorised) return;
  mockDecline(store, invitationId, REFERENCE_NOW);
  if (s?.pendingInvitationOnly && s.subjectId === invitationId) await clearSessionCookie();
};

// -------------------------------------------------------------------------------------------
// Caregiver shell
// -------------------------------------------------------------------------------------------
export const getCaregiverLink: DataApi['getCaregiverLink'] = async (caregiverId) => {
  const store = getStore();
  const s = await session();
  const c = caregiverById(store, caregiverId);
  const view: CaregiverLinkView = { patientId: c?.linkedPatientId ?? '', patientFirstName: c ? patientFirstName(store, c.linkedPatientId) : '', acceptedAt: c?.acceptedAt ?? '' };
  if (!s || s.role !== 'caregiver' || s.subjectId !== caregiverId || !c) return caregiverLinkRefusal();
  return view;
};

export const selfUnlink: DataApi['selfUnlink'] = async (caregiverId) => {
  const store = getStore();
  const s = await session();
  const c = caregiverById(store, caregiverId);
  if (!s || s.role !== 'caregiver' || s.subjectId !== caregiverId || !c || c.status !== 'active') return;
  c.status = 'revoked';
  c.revokedAt = REFERENCE_NOW;
  append(store, {
    scope: 'patient', patientId: c.linkedPatientId, actor: { role: 'caregiver', id: c.id },
    type: 'caregiver_self_unlinked', message: `${c.name.split(/\s+/)[0] ?? ''} ألغى ربط نفسه`, createdAt: REFERENCE_NOW, relatedId: c.id,
  });
  await clearSessionCookie();
};

// -------------------------------------------------------------------------------------------
// Clinic
// -------------------------------------------------------------------------------------------
export const getReviewQueue: DataApi['getReviewQueue'] = async () => {
  const store = getStore();
  const s = await session();
  if (!s || s.role !== 'reviewer') return reviewQueueRefusal();
  return store.alerts
    .filter((a) => a.reviewStatus === 'pending_medical_review')
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.createdAt.localeCompare(b.createdAt))
    .map((a): ReviewQueueItem => ({
      alertId: a.id, patientId: a.patientId, patientFirstName: patientFirstName(store, a.patientId),
      severity: a.severity, drugNames: a.involvedPrescriptionIds.map((id) => store.prescriptions.find((p) => p.id === id)?.drug.genericName ?? '').filter(Boolean),
      createdAt: a.createdAt,
      // CR-036: waiting time is the data layer's derivation, against the reference clock only.
      waitedMinutes: Math.max(0, Math.floor((Date.parse(REFERENCE_NOW) - Date.parse(a.createdAt)) / 60_000)),
    }));
};

export const getFieldConfirmationQueue: DataApi['getFieldConfirmationQueue'] = async () => {
  const store = getStore();
  const s = await session();
  if (!s || s.role !== 'reviewer') return fieldQueueRefusal();
  return store.prescriptions
    // CR-037: returned prescriptions stay in the queue view as history rows, marked by
    // `fieldReviewStatus`, so G3s lists them without a free patient lookup.
    .filter((p) => (p.needsReview && p.fieldReviewStatus === 'pending') || p.fieldReviewStatus === 'returned')
    .map((p): FieldQueueItem => ({
      prescriptionId: p.id, patientId: p.patientId, patientFirstName: patientFirstName(store, p.patientId),
      genericName: p.drug.genericName,
      uncertainFields: (['strengthMg', 'frequencyPerDay', 'startDate', 'doseTimes', 'brandName'] as const).filter((k) => (p as unknown as Record<string, unknown>)[k] === undefined && !(k === 'brandName')),
      hasSourceImage: true,
      fieldReviewStatus: p.fieldReviewStatus === 'returned' ? 'returned' : 'pending',
    }));
};

export const getAlertForReview: DataApi['getAlertForReview'] = async (alertId) => {
  const store = getStore();
  const s = await session();
  const empty: AlertReviewView = alertReviewRefusal(alertId);
  if (!s || s.role !== 'reviewer') return empty;
  const alert = store.alerts.find((a) => a.id === alertId);
  if (!alert) return empty;
  const involvedPrescriptions = store.prescriptions.filter((p) => alert.involvedPrescriptionIds.includes(p.id));
  const activePrescriptions = store.prescriptions.filter((p) => p.patientId === alert.patientId && p.status === 'active');
  const trackingOn = store.settings.find((x) => x.patientId === alert.patientId)?.adherenceCheckInEnabled ?? false;
  const rxById = new Map(activePrescriptions.map((p) => [p.id, p]));
  const recentDoses = store.doses
    .filter((d) => rxById.has(d.prescriptionId) && daysBetween(d.scheduledAt.slice(0, 10), REFERENCE_DATE) >= 0 && daysBetween(d.scheduledAt.slice(0, 10), REFERENCE_DATE) <= 14)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .map((d) => toDoseWithPrescription(d, rxById.get(d.prescriptionId)!));
  return { alert, involvedPrescriptions, patientContext: { activePrescriptions, recentDoses, trackingOn }, why: alertWhy(involvedPrescriptions, WHY_DATA, alert.sourceCitation) };
};

export const submitReviewDecision: DataApi['submitReviewDecision'] = async (alertId, decision, note) => {
  const store = getStore();
  const s = await session();
  if (!s || s.role !== 'reviewer') return;
  // CR-115: the doctor's justification is required. A blank one is refused like any other refused
  // write: nothing changes and no audit event is written.
  if (typeof note !== 'string' || note.trim() === '') return;
  const alert = store.alerts.find((a) => a.id === alertId);
  if (!alert) return;
  alert.reviewStatus = 'reviewed';
  alert.reviewerDecision = decision;
  alert.reviewerNote = note.trim();
  alert.reviewedAt = REFERENCE_NOW;
  alert.reviewedBy = s.subjectId; // Account.id, never the Civil ID (CR-028)
  append(store, {
    scope: 'patient', patientId: alert.patientId, actor: { role: 'reviewer', id: s.subjectId }, type: 'alert_reviewed',
    message: `مراجعة تنبيه — ${decision === 'confirmed' ? 'تأكيد' : 'إخلاء'}`, createdAt: REFERENCE_NOW, relatedId: alertId,
  });
};

/** CR-115: the signed-in clinician's own name, clinic roles and recorded decisions. Keyed on the
 * session's account id (a reviewer's or admin's `subjectId`); never returns the Civil ID. */
export const getClinicianProfile: DataApi['getClinicianProfile'] = async () => {
  const store = getStore();
  const s = await session();
  if (!s || (s.role !== 'reviewer' && s.role !== 'admin')) return clinicianProfileRefusal();
  const account = findAccountById(store, s.subjectId);
  if (!account || !account.roles.includes(s.role)) return clinicianProfileRefusal();
  const mine = store.alerts.filter((a) => a.reviewStatus === 'reviewed' && a.reviewedBy === account.id);
  const fields = store.prescriptions.filter((p) => p.fieldReviewedBy === account.id);
  const profile: ClinicianProfile = {
    name: account.name,
    roles: account.roles.filter((r): r is 'reviewer' | 'admin' => r === 'reviewer' || r === 'admin'),
    decisions: {
      confirmed: mine.filter((a) => a.reviewerDecision === 'confirmed').length,
      cleared: mine.filter((a) => a.reviewerDecision === 'cleared').length,
      fieldsConfirmed: fields.filter((p) => p.fieldReviewStatus === 'confirmed').length,
      fieldsReturned: fields.filter((p) => p.fieldReviewStatus === 'returned').length,
    },
  };
  return profile;
};

export const getFlaggedPrescription: DataApi['getFlaggedPrescription'] = async (prescriptionId) => {
  const store = getStore();
  const s = await session();
  if (!s || s.role !== 'reviewer') return flaggedPrescriptionRefusal();
  const rx = store.prescriptions.find((p) => p.id === prescriptionId && p.needsReview);
  return rx ?? flaggedPrescriptionRefusal();
};

export const confirmPrescriptionFields: DataApi['confirmPrescriptionFields'] = async (prescriptionId, values, note) => {
  const store = getStore();
  const s = await session();
  const rx = store.prescriptions.find((p) => p.id === prescriptionId);
  if (!s || s.role !== 'reviewer' || !rx) return rx ?? prescriptionWriteRefusal(prescriptionId);
  Object.assign(rx, values);
  rx.needsReview = false;
  rx.fieldReviewStatus = 'confirmed';
  rx.fieldReviewedBy = s.subjectId;
  rx.fieldReviewedAt = REFERENCE_NOW;
  rx.fieldReviewNote = note;
  store.doses = store.doses.filter((d) => d.prescriptionId !== rx.id);
  const trackingOn = store.settings.find((x) => x.patientId === rx.patientId)?.adherenceCheckInEnabled ?? false;
  store.doses.push(...generateDoses(rx, trackingOn));
  append(store, {
    scope: 'patient', patientId: rx.patientId, actor: { role: 'reviewer', id: s.subjectId }, type: 'prescription_field_confirmed',
    message: `تأكيد بيانات وصفة ${rx.drug.genericName}`, createdAt: REFERENCE_NOW, relatedId: rx.id,
  });
  return rx;
};

export const returnPrescriptionToClinic: DataApi['returnPrescriptionToClinic'] = async (prescriptionId, reason) => {
  const store = getStore();
  const s = await session();
  const rx = store.prescriptions.find((p) => p.id === prescriptionId);
  if (!s || s.role !== 'reviewer' || !rx) return rx ?? prescriptionWriteRefusal(prescriptionId);
  rx.fieldReviewStatus = 'returned';
  rx.fieldReviewNote = reason;
  rx.fieldReviewedBy = s.subjectId;
  rx.fieldReviewedAt = REFERENCE_NOW;
  append(store, {
    scope: 'patient', patientId: rx.patientId, actor: { role: 'reviewer', id: s.subjectId }, type: 'prescription_returned_to_clinic',
    message: `أُعيدت وصفة ${rx.drug.genericName} للعيادة`, createdAt: REFERENCE_NOW, relatedId: rx.id,
  });
  return rx;
};

export const getAuditLog: DataApi['getAuditLog'] = async (filters) => {
  const store = getStore();
  const s = await session();
  if (!s || s.role !== 'admin') return auditLogRefusal();
  return store.auditEvents
    .filter((e) => (!filters.actorRole || e.actor.role === filters.actorRole) && (!filters.type || e.type === filters.type) && (!filters.from || e.createdAt >= filters.from) && (!filters.to || e.createdAt <= filters.to))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    // CR-038: the patient reference on X1 is the masked name (CR-010, owner answer), computed
    // here — the admin session still reads no clinical record and no Civil ID.
    .map((e) => {
      const name = e.patientId ? store.patients.find((p) => p.id === e.patientId)?.name : undefined;
      return name ? { ...e, patientMaskedName: maskName(name) } : { ...e };
    });
};

// -------------------------------------------------------------------------------------------
// Resilience
// -------------------------------------------------------------------------------------------
export const readLastKnownSnapshot: DataApi['readLastKnownSnapshot'] = async (key) => snapshots.get(key) ?? snapshotRefusal();
