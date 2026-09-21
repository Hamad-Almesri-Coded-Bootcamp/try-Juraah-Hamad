/**
 * Verification: calls every one of the 55 published functions with a seeded argument, under the
 * seeded session each needs ("as حمد", "as سارة", "as عبدالله", "as ناصر", "as د. خالد", "as م.
 * دانة" — docs/briefs/WP1.md §8), and prints `name → JSON`. Also writes `tests/fixtures/shapes.json`
 * so `scripts/guards/seed-invariants.ts` (guard S, item h) can scan every returned shape for a
 * Civil ID without re-running every function itself.
 *
 * `next/headers`'s `cookies()` has no request context in a plain `tsx` run — `lib/session/cookie.ts`
 * falls back to an in-memory session set here via `setScriptSession` (script/test use only).
 */
import { writeFileSync } from 'node:fs';
import { reset } from '../lib/data/mock/store';
import { setScriptSession } from '../lib/session/cookie';
import type { Session } from '../types/views';
import * as data from '../lib/data/index';
import * as sessionApi from '../lib/session/index';

const SESSIONS = {
  hamad: { subjectId: 'pt-01', role: 'patient' } as Session,
  fatima: { subjectId: 'pt-02', role: 'patient' } as Session,
  sara: { subjectId: 'pt-03', role: 'patient' } as Session,
  badr: { subjectId: 'pt-04', role: 'patient' } as Session,
  abdullah: { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' } as Session,
  naser: { subjectId: 'cg-03', pendingInvitationOnly: true } as Session,
  khalidReviewer: { subjectId: 'acc-10', role: 'reviewer' } as Session,
  khalidAdmin: { subjectId: 'acc-10', role: 'admin' } as Session,
  dana: { subjectId: 'acc-11', role: 'admin' } as Session,
} satisfies Record<string, Session>;

/** Overridden per-actor after a mutation changes what session that actor now holds (e.g. ناصر
 * after acceptInvitation) — a script-only concern; the data layer itself is stateless per call. */
const liveSessions: Partial<Record<keyof typeof SESSIONS, Session>> = {};

async function as<T>(who: keyof typeof SESSIONS | null, fn: () => Promise<T>): Promise<T> {
  setScriptSession(who ? (liveSessions[who] ?? SESSIONS[who]) : null);
  return fn();
}

function blob(bytes: number): Blob {
  return new Blob([new Uint8Array(bytes)]);
}

/** A deep, JSON-serialisable snapshot taken NOW — later mutations must never retroactively change
 * an already-recorded shape (the store's records are mutated in place, not replaced). */
function snapshot<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

async function main() {
  reset();
  const shapes: Record<string, unknown> = {};
  const record = async (name: string, who: keyof typeof SESSIONS | null, fn: () => Promise<unknown>) => {
    shapes[name] = snapshot(await as(who, fn));
  };

  // ---- Session module (5) ----
  await record('signIn(حمد)', null, () => sessionApi.signIn('255031200187'));
  await record('getSession (as حمد)', 'hamad', () => sessionApi.getSession());
  await record('getRoleOptions (as سارة)', 'sara', () => sessionApi.getRoleOptions());
  await record('chooseRole (as سارة → patient)', 'sara', () => sessionApi.chooseRole({ role: 'patient', subjectId: 'pt-03' }));
  await record('signOut (as حمد)', 'hamad', () => sessionApi.signOut());

  // ---- Patient and settings ----
  await record('getPatient(pt-01)', 'hamad', () => data.getPatient('pt-01'));
  await record('updatePatientPhone(pt-01)', 'hamad', () => data.updatePatientPhone('pt-01', '99887766'));
  await record('completeOnboarding(pt-04)', 'badr', () => data.completeOnboarding('pt-04'));
  await record('getSettings(pt-04, no row)', 'badr', () => data.getSettings('pt-04'));
  await record('getSettings(pt-01)', 'hamad', () => data.getSettings('pt-01'));
  await record('updateSettings(pt-01)', 'hamad', () => data.updateSettings('pt-01', { refillAlertsEnabled: true }));

  // ---- Prescriptions and doses ----
  await record('getPrescriptions(pt-01)', 'hamad', () => data.getPrescriptions('pt-01'));
  await record('getPrescription(rx-001)', 'hamad', () => data.getPrescription('rx-001'));
  await record('getDosesForDay(pt-01, 2026-09-21)', 'hamad', () => data.getDosesForDay('pt-01', '2026-09-21'));
  await record('getDoseHistory(rx-008)', 'sara', () => data.getDoseHistory('rx-008'));
  await record('getRecentDoses(pt-03, 7)', 'sara', () => data.getRecentDoses('pt-03', 7));
  const extraction = await as('hamad', () => data.submitPrescriptionImage('pt-01', blob(500)));
  shapes['submitPrescriptionImage(pt-01)'] = snapshot(extraction);
  if ('draftId' in extraction) {
    await record('savePrescriptionDraft(pt-01)', 'hamad', () => data.savePrescriptionDraft('pt-01', extraction.draftId));
  }

  // ---- Safety ----
  await record('getAlerts(pt-01)', 'hamad', () => data.getAlerts('pt-01'));
  await record('getAlert(ia-001)', 'hamad', () => data.getAlert('ia-001'));
  await record('checkDrugPhoto(pt-01)', 'hamad', () => data.checkDrugPhoto('pt-01', blob(500)));

  // ---- Supply ----
  await record('getRefillOverview(pt-01)', 'hamad', () => data.getRefillOverview('pt-01'));
  await record('requestRefill(pt-01, rx-002)', 'hamad', () => data.requestRefill('pt-01', 'rx-002'));
  await record('getRefillRequests(pt-01)', 'hamad', () => data.getRefillRequests('pt-01'));

  // ---- Calendar ----
  await record('getCalendarSubscription(pt-03)', 'sara', () => data.getCalendarSubscription('pt-03'));
  await record('enableCalendarSync(pt-01)', 'hamad', () => data.enableCalendarSync('pt-01'));

  // ---- Activity ----
  await record('getActivity(pt-01)', 'hamad', () => data.getActivity('pt-01'));

  // ---- Notifications ----
  await record('getPushCapability()', null, () => data.getPushCapability());
  await record('getPushState(patient:pt-03)', 'sara', () => data.getPushState({ subjectType: 'patient', subjectId: 'pt-03' }));
  await record('requestPushPermission(patient:pt-01)', 'hamad', () => data.requestPushPermission({ subjectType: 'patient', subjectId: 'pt-01' }));
  await record('disablePush(patient:pt-01)', 'hamad', () => data.disablePush({ subjectType: 'patient', subjectId: 'pt-01' }));
  await record('sendTestNotification(patient:pt-03)', 'sara', () => data.sendTestNotification({ subjectType: 'patient', subjectId: 'pt-03' }));
  await record('getMessagingLink(patient:pt-02)', 'fatima', () => data.getMessagingLink({ subjectType: 'patient', subjectId: 'pt-02' }));
  await record('startMessagingLink(caregiver:cg-01)', 'abdullah', () => data.startMessagingLink({ subjectType: 'caregiver', subjectId: 'cg-01' }));
  await record('disconnectMessaging(patient:pt-03)', 'sara', () => data.disconnectMessaging({ subjectType: 'patient', subjectId: 'pt-03' }));
  await record('sendTestMessage(patient:pt-03)', 'sara', () => data.sendTestMessage({ subjectType: 'patient', subjectId: 'pt-03' }));

  // ---- Caregivers, patient side ----
  await record('getCaregivers(pt-01)', 'hamad', () => data.getCaregivers('pt-01'));
  // Labels deliberately never embed the Civil ID argument itself (guard S, item h, scans this
  // whole file for one) — "with account" / "no account" name which seed row each call exercises.
  await record('lookupMaskedName(عبدالله, has an account)', null, () => data.lookupMaskedName('285061400412'));
  await record('lookupMaskedName(no account)', null, () => data.lookupMaskedName('277091900873'));
  const invited = await as('hamad', () => data.inviteCaregiver('pt-01', { civilId: '299999900000', name: 'اختبار', relationship: 'قريب' }));
  shapes['inviteCaregiver(pt-01)'] = snapshot(invited);
  await record('cancelInvitation(new invite)', 'hamad', () => data.cancelInvitation(invited.id));
  await record('revokeCaregiver(cg-01)', 'hamad', () => data.revokeCaregiver('cg-01'));

  // ---- Consent, invited side ----
  await record('getPendingInvitationsForSubject (as سارة)', 'sara', () => data.getPendingInvitationsForSubject());
  await record('getInvitationForConsent(cg-08)', null, () => data.getInvitationForConsent('cg-08'));
  const naserAccepted = await as('naser', () => data.acceptInvitation('cg-03'));
  shapes['acceptInvitation(cg-03, as ناصر)'] = snapshot(naserAccepted);
  liveSessions.naser = naserAccepted; // ناصر is now an active caregiver (cg-03), not pending-only
  await record('declineInvitation(cg-08, as سارة)', 'sara', () => data.declineInvitation('cg-08'));

  // ---- Caregiver shell ---- (freshly-accepted ناصر, cg-03, is now an active caregiver)
  await record('getCaregiverLink(cg-03)', 'naser', () => data.getCaregiverLink('cg-03'));
  await record('selfUnlink(cg-03)', 'naser', () => data.selfUnlink('cg-03'));

  // ---- Clinic ----
  await record('getReviewQueue (as د. خالد)', 'khalidReviewer', () => data.getReviewQueue());
  await record('getFieldConfirmationQueue (as د. خالد)', 'khalidReviewer', () => data.getFieldConfirmationQueue());
  await record('getAlertForReview(ia-001, as د. خالد)', 'khalidReviewer', () => data.getAlertForReview('ia-001'));
  await record('submitReviewDecision(ia-001, as د. خالد)', 'khalidReviewer', () => data.submitReviewDecision('ia-001', 'confirmed', 'ملاحظة المراجع'));
  await record('getFlaggedPrescription(rx-006, as د. خالد)', 'khalidReviewer', () => data.getFlaggedPrescription('rx-006'));
  await record('confirmPrescriptionFields(rx-006, as د. خالد)', 'khalidReviewer', () => data.confirmPrescriptionFields('rx-006', { drug: { genericName: 'Paracetamol' }, frequencyPerDay: 1, startDate: '2026-09-20', doseTimes: ['09:00'] }, 'تم التأكيد'));
  await record('returnPrescriptionToClinic(rx-007, as د. خالد)', 'khalidReviewer', () => data.returnPrescriptionToClinic('rx-007', 'الجرعة غير واضحة'));
  await record('getAuditLog (as م. دانة)', 'dana', () => data.getAuditLog({}));

  // ---- Resilience ----
  await record('readLastKnownSnapshot(getPatient:pt-01)', null, () => data.readLastKnownSnapshot('getPatient:pt-01'));

  for (const [name, value] of Object.entries(shapes)) {
    console.log(`${name} → ${JSON.stringify(value)}`);
  }
  writeFileSync('tests/fixtures/shapes.json', JSON.stringify(shapes, null, 2));
}

main();
