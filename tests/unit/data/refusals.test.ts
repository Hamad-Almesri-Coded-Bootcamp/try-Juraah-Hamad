/**
 * P2-WP5 — D-022 / BACKEND-DIVERGENCES D-3: every refusal literal in lib/data/refusals.ts (all six
 * package files, through the lead's barrel) is byte-for-byte what lib/data/mock-impl.ts returns for
 * a NULL session. The mock is the arbiter; the comparison is on the serialised STRING (key order
 * included), never deep-equal. Runs in `npm run verify` (mock backend, no database).
 *
 * Where the mock does NOT refuse a null session (ENFORCEMENT "mock does not refuse today", or a
 * mock that hands the stored row to any caller) the test says so explicitly with a second
 * assertion — never silently skipped: lookupMaskedName for a Civil ID with an account (E-14),
 * getInvitationForConsent for a real id (E-24), updateSettings / confirm / return for a stored
 * record (the mock returns the stored row to anyone), savePrescriptionDraft (D-014, it SAVES),
 * enableCalendarSync / requestPushPermission for a subject that already has a row.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';
import * as mock from '@/lib/data/mock-impl';
import * as R from '@/lib/data/refusals';

const same = async (got: Promise<unknown>, want: unknown) => expect(JSON.stringify(await got)).toBe(JSON.stringify(want));
const PT01 = { subjectType: 'patient', subjectId: 'pt-01' } as const;
const CG03 = { subjectType: 'caregiver', subjectId: 'cg-03' } as const;

beforeEach(() => {
  reset();
  setScriptSession(null);
});

describe('refusal literals = the mock with a null session (string-equal)', () => {
  it('patient and settings', async () => {
    await same(mock.getPatient('pt-01'), R.patientRefusal());
    await same(mock.updatePatientPhone('pt-01', '1'), R.voidRefusal());
    await same(mock.completeOnboarding('pt-01'), R.voidRefusal());
    await same(mock.getSettings('pt-01'), R.settingsRefusal('pt-01'));
    // updateSettings refuses with the CURRENT row: for a patient with no row (بدر) that is the default literal …
    await same(mock.updateSettings('pt-04', { refillAlertsEnabled: true }), R.settingsRefusal('pt-04'));
    // … and for a stored row the mock hands the row itself to a null session (pg: only if RLS lets the caller read it).
    expect(JSON.stringify(await mock.updateSettings('pt-01', { refillAlertsEnabled: true }))).not.toBe(JSON.stringify(R.settingsRefusal('pt-01')));
  });

  it('prescriptions and doses', async () => {
    await same(mock.getPrescriptions('pt-01'), R.prescriptionsRefusal());
    await same(mock.getPrescription('rx-001'), R.prescriptionRefusal());
    await same(mock.getDosesForDay('pt-01', '2026-09-21'), R.dosesWithPrescriptionRefusal());
    await same(mock.getDoseHistory('rx-001'), R.doseHistoryRefusal());
    await same(mock.getRecentDoses('pt-01', 7), R.dosesWithPrescriptionRefusal());
    await same(mock.submitPrescriptionImage('pt-01', new Blob([new Uint8Array(500)])), R.extractionRefusal());
    // D-014: the mock SAVES a fabricated record for a null session; the backend's refusal has id ''.
    const saved = await mock.savePrescriptionDraft('pt-01', 'draft-none');
    expect(saved.id).not.toBe('');
    expect(JSON.stringify({ ...saved, id: '' })).toBe(JSON.stringify(R.draftSaveRefusal('pt-01')));
  });

  it('safety and supply', async () => {
    await same(mock.getAlerts('pt-01'), R.alertsRefusal());
    await same(mock.getAlert('ia-001'), R.alertRefusal());
    await same(mock.checkDrugPhoto('pt-01', new Blob([new Uint8Array(500)])), R.drugCheckRefusal());
    await same(mock.getRefillOverview('pt-01'), R.refillOverviewRefusal());
    await same(mock.requestRefill('pt-01', 'rx-002'), R.refillRequestRefusal('pt-01', 'rx-002'));
    await same(mock.requestRefill('pt-01', 'rx-999'), R.refillRequestRefusal('pt-01', 'rx-999'));
    await same(mock.getRefillRequests('pt-01'), R.refillRequestsRefusal());
  });

  it('calendar, activity, notifications', async () => {
    await same(mock.getCalendarSubscription('pt-03'), R.calendarSubscriptionRefusal());
    await same(mock.enableCalendarSync('pt-01'), R.enableCalendarSyncRefusal('pt-01'));
    await same(mock.getActivity('pt-01'), R.activityRefusal());
    await same(mock.getPushState(PT01), R.pushStateRefusal());
    await same(mock.requestPushPermission(CG03), R.requestPushPermissionRefusal(CG03));
    await same(mock.disablePush(PT01), R.voidRefusal());
    await same(mock.getMessagingLink(PT01), R.messagingLinkRefusal(PT01));
    await same(mock.startMessagingLink(PT01), R.startMessagingLinkRefusal(PT01));
    await same(mock.disconnectMessaging(PT01), R.voidRefusal());
    // existing rows: the mock returns them to a null session (WP6's fragment records the pg divergence)
    expect(JSON.stringify(await mock.requestPushPermission(PT01))).not.toBe(JSON.stringify(R.requestPushPermissionRefusal(PT01)));
  });

  it('caregivers, patient side', async () => {
    await same(mock.getCaregivers('pt-01'), R.caregiversRefusal());
    await same(mock.lookupMaskedName('277091900873'), R.maskedNameRefusal());
    // E-14 "mock does not refuse": no session check — the backend returns the null shape here.
    expect(await mock.lookupMaskedName('285061400412')).toEqual({ maskedName: 'عبدالله م*** ع*** المطيري' });
    const input = { civilId: '299999900000', name: 'اختبار', relationship: 'قريب' };
    await same(mock.inviteCaregiver('pt-01', input), R.inviteRefusal('pt-01', input));
    await same(mock.cancelInvitation('cg-03'), R.voidRefusal());
    await same(mock.revokeCaregiver('cg-01'), R.voidRefusal());
  });

  it('consent and the caregiver shell', async () => {
    await same(mock.getPendingInvitationsForSubject(), R.pendingInvitationsRefusal());
    await same(mock.getInvitationForConsent('cg-99'), R.invitationRefusal('cg-99'));
    // E-24 "mock does not refuse": a real id is answered with no session.
    expect(JSON.stringify(await mock.getInvitationForConsent('cg-08'))).not.toBe(JSON.stringify(R.invitationRefusal('cg-08')));
    await same(mock.acceptInvitation('cg-03'), R.acceptRefusal(null));
    await same(mock.declineInvitation('cg-03'), R.voidRefusal());
    await same(mock.getCaregiverLink('cg-01'), R.caregiverLinkRefusal());
    await same(mock.selfUnlink('cg-01'), R.voidRefusal());
  });

  it('acceptInvitation refused for a signed-in non-invitee returns THAT session (the mock\'s `s`)', async () => {
    const hamad = { subjectId: 'pt-01', role: 'patient' } as const;
    setScriptSession(hamad);
    await same(mock.acceptInvitation('cg-03'), R.acceptRefusal(hamad));
  });

  it('clinic and resilience', async () => {
    await same(mock.getReviewQueue(), R.reviewQueueRefusal());
    await same(mock.getFieldConfirmationQueue(), R.fieldQueueRefusal());
    await same(mock.getAlertForReview('ia-001'), R.alertReviewRefusal('ia-001'));
    await same(mock.submitReviewDecision('ia-001', 'confirmed', 'x'), R.voidRefusal());
    await same(mock.getClinicianProfile(), R.clinicianProfileRefusal()); // CR-115: no session → null
    await same(mock.getFlaggedPrescription('rx-006'), R.flaggedPrescriptionRefusal());
    await same(mock.confirmPrescriptionFields('rx-999', { frequencyPerDay: 1 }), R.prescriptionWriteRefusal('rx-999'));
    await same(mock.returnPrescriptionToClinic('rx-999', 'x'), R.prescriptionWriteRefusal('rx-999'));
    // a stored record: the mock returns it unchanged to ANY caller (pg: only when RLS lets the caller read it)
    const stored = await mock.confirmPrescriptionFields('rx-006', { frequencyPerDay: 1 });
    expect(stored.id).toBe('rx-006');
    expect(stored.fieldReviewStatus).toBe('pending');
    await same(mock.getAuditLog({}), R.auditLogRefusal());
    await same(mock.readLastKnownSnapshot('getPatient:pt-01'), R.snapshotRefusal());
  });

  it('every refusal is a fresh value (no caller can mutate another caller\'s refusal)', () => {
    expect(R.refillRequestRefusal('a', 'b')).not.toBe(R.refillRequestRefusal('a', 'b'));
    expect(R.inviteRefusal('a', { name: 'n', relationship: 'r' })).not.toBe(R.inviteRefusal('a', { name: 'n', relationship: 'r' }));
    expect(R.maskedNameRefusal()).not.toBe(R.maskedNameRefusal());
    expect(R.acceptRefusal(null)).not.toBe(R.acceptRefusal(null));
    expect(R.prescriptionWriteRefusal('x')).not.toBe(R.prescriptionWriteRefusal('x'));
  });
});
