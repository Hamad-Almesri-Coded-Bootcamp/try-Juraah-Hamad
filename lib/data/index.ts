'use server';
/**
 * The seam's data-access layer — a THIN DISPATCHER (D-020). Screens import these 50 functions and
 * nothing else; which implementation answers is decided server-side by JURAH_DATA_BACKEND
 * (lib/db/client.ts → selectedBackend()): `mock` → ./mock-impl (the Phase 1 mock, moved verbatim),
 * `postgres` → ./pg (the real database, through withSession()). vitest and `npm run verify`
 * default to the mock; `next dev`/`next start` default to postgres once JURAH_DATABASE_URL is set,
 * and a postgres choice with no URL fails loudly on the first call — never a silent fallback.
 *
 * The published interface is lib/data/api.ts (unchanged; parsed by notes-check and guard 4). Every
 * export below keeps that exact name and type.
 */
import { selectedBackend } from '@/lib/db/client';
import type { DataApi } from './api';
import * as mock from './mock-impl';

async function impl(): Promise<DataApi> {
  return selectedBackend() === 'postgres' ? await import('./pg') : mock;
}

export const getPatient: DataApi['getPatient'] = async (...args) => (await impl()).getPatient(...args);
export const updatePatientPhone: DataApi['updatePatientPhone'] = async (...args) => (await impl()).updatePatientPhone(...args);
export const completeOnboarding: DataApi['completeOnboarding'] = async (...args) => (await impl()).completeOnboarding(...args);
export const getSettings: DataApi['getSettings'] = async (...args) => (await impl()).getSettings(...args);
export const updateSettings: DataApi['updateSettings'] = async (...args) => (await impl()).updateSettings(...args);
export const getPrescriptions: DataApi['getPrescriptions'] = async (...args) => (await impl()).getPrescriptions(...args);
export const getPrescription: DataApi['getPrescription'] = async (...args) => (await impl()).getPrescription(...args);
export const getDosesForDay: DataApi['getDosesForDay'] = async (...args) => (await impl()).getDosesForDay(...args);
export const getDoseHistory: DataApi['getDoseHistory'] = async (...args) => (await impl()).getDoseHistory(...args);
export const getRecentDoses: DataApi['getRecentDoses'] = async (...args) => (await impl()).getRecentDoses(...args);
export const submitPrescriptionImage: DataApi['submitPrescriptionImage'] = async (...args) => (await impl()).submitPrescriptionImage(...args);
export const savePrescriptionDraft: DataApi['savePrescriptionDraft'] = async (...args) => (await impl()).savePrescriptionDraft(...args);
export const getAlerts: DataApi['getAlerts'] = async (...args) => (await impl()).getAlerts(...args);
export const getAlert: DataApi['getAlert'] = async (...args) => (await impl()).getAlert(...args);
export const checkDrugPhoto: DataApi['checkDrugPhoto'] = async (...args) => (await impl()).checkDrugPhoto(...args);
export const getRefillOverview: DataApi['getRefillOverview'] = async (...args) => (await impl()).getRefillOverview(...args);
export const requestRefill: DataApi['requestRefill'] = async (...args) => (await impl()).requestRefill(...args);
export const getRefillRequests: DataApi['getRefillRequests'] = async (...args) => (await impl()).getRefillRequests(...args);
export const getCalendarSubscription: DataApi['getCalendarSubscription'] = async (...args) => (await impl()).getCalendarSubscription(...args);
export const enableCalendarSync: DataApi['enableCalendarSync'] = async (...args) => (await impl()).enableCalendarSync(...args);
export const getActivity: DataApi['getActivity'] = async (...args) => (await impl()).getActivity(...args);
export const getPushCapability: DataApi['getPushCapability'] = async (...args) => (await impl()).getPushCapability(...args);
export const getPushState: DataApi['getPushState'] = async (...args) => (await impl()).getPushState(...args);
export const requestPushPermission: DataApi['requestPushPermission'] = async (...args) => (await impl()).requestPushPermission(...args);
export const disablePush: DataApi['disablePush'] = async (...args) => (await impl()).disablePush(...args);
export const sendTestNotification: DataApi['sendTestNotification'] = async (...args) => (await impl()).sendTestNotification(...args);
export const getMessagingLink: DataApi['getMessagingLink'] = async (...args) => (await impl()).getMessagingLink(...args);
export const startMessagingLink: DataApi['startMessagingLink'] = async (...args) => (await impl()).startMessagingLink(...args);
export const disconnectMessaging: DataApi['disconnectMessaging'] = async (...args) => (await impl()).disconnectMessaging(...args);
export const sendTestMessage: DataApi['sendTestMessage'] = async (...args) => (await impl()).sendTestMessage(...args);
export const getCaregivers: DataApi['getCaregivers'] = async (...args) => (await impl()).getCaregivers(...args);
export const lookupMaskedName: DataApi['lookupMaskedName'] = async (...args) => (await impl()).lookupMaskedName(...args);
export const inviteCaregiver: DataApi['inviteCaregiver'] = async (...args) => (await impl()).inviteCaregiver(...args);
export const cancelInvitation: DataApi['cancelInvitation'] = async (...args) => (await impl()).cancelInvitation(...args);
export const revokeCaregiver: DataApi['revokeCaregiver'] = async (...args) => (await impl()).revokeCaregiver(...args);
export const getPendingInvitationsForSubject: DataApi['getPendingInvitationsForSubject'] = async (...args) => (await impl()).getPendingInvitationsForSubject(...args);
export const getInvitationForConsent: DataApi['getInvitationForConsent'] = async (...args) => (await impl()).getInvitationForConsent(...args);
export const acceptInvitation: DataApi['acceptInvitation'] = async (...args) => (await impl()).acceptInvitation(...args);
export const declineInvitation: DataApi['declineInvitation'] = async (...args) => (await impl()).declineInvitation(...args);
export const getCaregiverLink: DataApi['getCaregiverLink'] = async (...args) => (await impl()).getCaregiverLink(...args);
export const selfUnlink: DataApi['selfUnlink'] = async (...args) => (await impl()).selfUnlink(...args);
export const getReviewQueue: DataApi['getReviewQueue'] = async (...args) => (await impl()).getReviewQueue(...args);
export const getFieldConfirmationQueue: DataApi['getFieldConfirmationQueue'] = async (...args) => (await impl()).getFieldConfirmationQueue(...args);
export const getAlertForReview: DataApi['getAlertForReview'] = async (...args) => (await impl()).getAlertForReview(...args);
export const submitReviewDecision: DataApi['submitReviewDecision'] = async (...args) => (await impl()).submitReviewDecision(...args);
export const getClinicianProfile: DataApi['getClinicianProfile'] = async (...args) => (await impl()).getClinicianProfile(...args);
export const getFlaggedPrescription: DataApi['getFlaggedPrescription'] = async (...args) => (await impl()).getFlaggedPrescription(...args);
export const confirmPrescriptionFields: DataApi['confirmPrescriptionFields'] = async (...args) => (await impl()).confirmPrescriptionFields(...args);
export const returnPrescriptionToClinic: DataApi['returnPrescriptionToClinic'] = async (...args) => (await impl()).returnPrescriptionToClinic(...args);
export const getAuditLog: DataApi['getAuditLog'] = async (...args) => (await impl()).getAuditLog(...args);
export const readLastKnownSnapshot: DataApi['readLastKnownSnapshot'] = async (...args) => (await impl()).readLastKnownSnapshot(...args);
