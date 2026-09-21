/**
 * The mock store's mutation and read logic, called directly (never the `'use server'` wrappers —
 * docs/briefs/WP1.md §8). Every `beforeEach` resets the store.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { REFERENCE_NOW } from '@/lib/config';
import { reset, getStore } from '@/lib/data/mock/store';
import { canReadPatient } from '@/lib/data/mock/access';
import { deriveRoles, maskedNameFor } from '@/lib/data/mock/accounts';
import {
  acceptInvitation, cancelInvitation, caregiverById, declineInvitation,
  revokeCaregiver, toInvitationSummary,
} from '@/lib/data/mock/caregivers';
import { messagingLinkFor, pushStateFor, settingsFor } from '@/lib/data/mock/reads';
import type { Session } from '@/types/views';

beforeEach(() => reset());

describe('pending-invitation-only session (ناصر, cg-03) — grants nothing', () => {
  const pendingSession: Session = { subjectId: 'cg-03', pendingInvitationOnly: true };

  it('canReadPatient is false for every patient', () => {
    for (const pid of ['pt-01', 'pt-02', 'pt-03', 'pt-04']) {
      expect(canReadPatient(getStore(), pendingSession, pid)).toBe(false);
    }
  });

  it('getInvitationForConsent-equivalent shape has exactly five keys', () => {
    const store = getStore();
    const c = caregiverById(store, 'cg-03')!;
    const summary = toInvitationSummary(store, c);
    expect(Object.keys(summary).sort()).toEqual(['expiresAt', 'id', 'patientFirstName', 'relationship', 'status'].sort());
    expect(summary).toEqual({ id: 'cg-03', patientFirstName: 'حمد', relationship: 'ابني', status: 'pending', expiresAt: expect.any(String) });
  });
});

describe('بدر (pt-04) — no Settings/MessagingLink/PushSubscription row; documented defaults, never written', () => {
  it('has no rows in the seed', () => {
    const store = getStore();
    expect(store.settings.some((s) => s.patientId === 'pt-04')).toBe(false);
    expect(store.messagingLinks.some((l) => l.subjectId === 'pt-04')).toBe(false);
    expect(store.pushSubscriptions.some((p) => p.subjectId === 'pt-04')).toBe(false);
  });

  it('settingsFor returns the documented defaults without writing a row', () => {
    const store = getStore();
    const before = store.settings.length;
    const s = settingsFor(store, 'pt-04');
    expect(s).toEqual({ patientId: 'pt-04', adherenceCheckInEnabled: false, adherenceCheckInFrequency: 'daily', refillAlertsEnabled: false, calendarSyncEnabled: false, webPushEnabled: false, notificationChannel: 'none', language: 'ar' });
    expect(store.settings.length).toBe(before);
  });

  it('messagingLinkFor returns not_connected without writing a row', () => {
    const store = getStore();
    const before = store.messagingLinks.length;
    const link = messagingLinkFor(store, { subjectType: 'patient', subjectId: 'pt-04' });
    expect(link.status).toBe('not_connected');
    expect(store.messagingLinks.length).toBe(before);
  });

  it('pushStateFor returns null (PushSubscription | null allows it; no documented default shape exists) without writing a row', () => {
    const store = getStore();
    const before = store.pushSubscriptions.length;
    expect(pushStateFor(store, { subjectType: 'patient', subjectId: 'pt-04' })).toBeNull();
    expect(store.pushSubscriptions.length).toBe(before);
  });
});

describe('lookupMaskedName — same shape whether or not the Civil ID has an account (G9)', () => {
  it('عبدالله (has an account) and 277091900873 (no account) return the same key set', () => {
    const store = getStore();
    const withAccount = maskedNameFor(store, '285061400412');
    const withoutAccount = maskedNameFor(store, '277091900873');
    expect(Object.keys(withAccount)).toEqual(Object.keys(withoutAccount));
    expect(withAccount).toEqual({ maskedName: 'عبدالله م*** ع*** المطيري' });
    expect(withoutAccount).toEqual({ maskedName: null });
  });
});

describe('acceptInvitation / declineInvitation', () => {
  it('acceptInvitation moves ناصر (cg-03) to active, appends caregiver_invite_accepted, and roles now include caregiver', () => {
    const store = getStore();
    const before = deriveRoles(store, '288110300229');
    expect(before).toEqual([]);
    const updated = acceptInvitation(store, 'cg-03', REFERENCE_NOW);
    expect(updated?.status).toBe('active');
    expect(updated?.acceptedAt).toBe(REFERENCE_NOW);
    expect(store.auditEvents.some((e) => e.type === 'caregiver_invite_accepted' && e.relatedId === 'cg-03')).toBe(true);
    expect(deriveRoles(store, '288110300229')).toEqual(['caregiver']);
  });

  it('declineInvitation leaves a declined row, and a later acceptInvitation is refused', () => {
    const store = getStore();
    const declined = declineInvitation(store, 'cg-03', REFERENCE_NOW);
    expect(declined?.status).toBe('declined');
    expect(store.auditEvents.some((e) => e.type === 'caregiver_invite_declined' && e.relatedId === 'cg-03')).toBe(true);
    const secondAttempt = acceptInvitation(store, 'cg-03', REFERENCE_NOW);
    expect(secondAttempt).toBeNull();
    expect(caregiverById(store, 'cg-03')!.status).toBe('declined');
  });
});

describe('revokeCaregiver / cancelInvitation — both set revokedAt and append their own event type', () => {
  it('revokeCaregiver (cg-01, active) sets revokedAt and appends caregiver_revoked', () => {
    const store = getStore();
    const updated = revokeCaregiver(store, 'cg-01', REFERENCE_NOW);
    expect(updated?.status).toBe('revoked');
    expect(updated?.revokedAt).toBe(REFERENCE_NOW);
    expect(store.auditEvents.some((e) => e.type === 'caregiver_revoked' && e.relatedId === 'cg-01')).toBe(true);
  });

  it('cancelInvitation (cg-03, pending) sets revokedAt (no acceptedAt) and appends caregiver_invite_cancelled', () => {
    const store = getStore();
    const updated = cancelInvitation(store, 'cg-03', REFERENCE_NOW);
    expect(updated?.status).toBe('revoked');
    expect(updated?.revokedAt).toBe(REFERENCE_NOW);
    expect(updated?.acceptedAt).toBeUndefined();
    expect(store.auditEvents.some((e) => e.type === 'caregiver_invite_cancelled' && e.relatedId === 'cg-03')).toBe(true);
  });
});

describe('سارة — the tracked patient\'s seven recorded rows (docs/Seed Dataset.md)', () => {
  it('every row is tracked:true, and the five overlaid ones carry the stated status/recordedAt/source', () => {
    const store = getStore();
    const rows = store.doses.filter((d) => d.prescriptionId === 'rx-008' || d.prescriptionId === 'rx-009').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    for (const d of rows) expect(d.tracked).toBe(true);

    const byId = new Map(rows.map((d) => [d.id, d]));
    expect(byId.get('rx-008-20260919-0700')).toMatchObject({ status: 'missed', source: 'adherence_agent', recordedAt: '2026-09-19T07:55:00+03:00' });
    expect(byId.get('rx-008-20260920-0700')).toMatchObject({ status: 'taken_on_time', source: 'adherence_agent', recordedAt: '2026-09-20T07:05:00+03:00' });
    expect(byId.get('rx-009-20260920-1300')).toMatchObject({ status: 'taken_on_time', source: 'adherence_agent', recordedAt: '2026-09-20T13:20:00+03:00' });
    expect(byId.get('rx-009-20260920-2100')).toMatchObject({ status: 'taken_late', source: 'adherence_agent', recordedAt: '2026-09-20T22:40:00+03:00' });
    expect(byId.get('rx-008-20260921-0700')).toMatchObject({ status: 'taken_on_time', source: 'adherence_agent', recordedAt: '2026-09-21T07:12:00+03:00' });
    // 2026-09-21's other two doses (rx-009 13:00, 21:00) are still upcoming, carrying no overlay.
    expect(byId.get('rx-009-20260921-1300')).toMatchObject({ status: 'upcoming', source: 'seed' });
    expect(byId.get('rx-009-20260921-2100')).toMatchObject({ status: 'upcoming', source: 'seed' });
  });

  it('no dose anywhere in the seed has source "ui", and no untracked dose has a status other than upcoming', () => {
    const store = getStore();
    expect(store.doses.every((d) => d.source !== 'ui')).toBe(true);
    expect(store.doses.filter((d) => d.tracked === false).every((d) => d.status === 'upcoming')).toBe(true);
  });
});

describe('G1 — no test anywhere writes a Dose.status', () => {
  it('the seed store never contains a dose with source "ui"', () => {
    expect(getStore().doses.some((d) => d.source === 'ui')).toBe(false);
  });
});
