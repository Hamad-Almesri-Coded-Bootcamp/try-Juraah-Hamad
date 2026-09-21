/**
 * Caregiver invitation lifecycle (D-002; docs/briefs/WP1.md §3). Shared by `lib/session` (accept /
 * decline, the invited side) and `lib/data` (invite / cancel / revoke, the patient side) so the
 * state machine and its audit rows are written once. Every mutation appends an `AuditEvent` and
 * never changes a `Dose.status` (G1).
 */
import type { Caregiver } from '@/types/contracts';
import { addDays, toKuwaitIso } from '@/lib/schedule/dates';
import { append } from './audit';
import type { StoreState } from './types';
import type { InvitationSummary } from '@/types/views';

const INVITATION_VALID_DAYS = 14;

/** Adds whole days to a Kuwait-offset ISO datetime, keeping the same time-of-day and offset. */
export function addDaysIso(iso: string, days: number): string {
  return toKuwaitIso(addDays(iso.slice(0, 10), days), iso.slice(11, 16));
}

export function caregiverById(store: StoreState, id: string): Caregiver | null {
  return store.caregivers.find((c) => c.id === id) ?? null;
}

export function activeCaregiversFor(store: StoreState, civilId: string): Caregiver[] {
  return store.caregivers.filter((c) => c.civilId === civilId && c.status === 'active');
}

/** ROLES.md step 3: a stale pending row is treated as expired at read time, never offered for acceptance. */
export function pendingInvitationsFor(store: StoreState, civilId: string, nowIso: string): Caregiver[] {
  return store.caregivers.filter((c) => c.civilId === civilId && c.status === 'pending' && c.expiresAt > nowIso);
}

export function patientFirstName(store: StoreState, patientId: string): string {
  const p = store.patients.find((x) => x.id === patientId);
  return p ? (p.name.split(/\s+/)[0] ?? p.name) : '';
}

/** `getInvitationForConsent`'s exact shape (F0 non-negotiable invariant) — these five keys, nothing else. */
export function toInvitationSummary(store: StoreState, c: Caregiver): InvitationSummary {
  return { id: c.id, patientFirstName: patientFirstName(store, c.linkedPatientId), relationship: c.relationship, status: c.status, expiresAt: c.expiresAt };
}

/** F0's accept action — the ONLY path that moves an invitation to `active` (G9/F0 non-negotiable). */
export function acceptInvitation(store: StoreState, invitationId: string, nowIso: string): Caregiver | null {
  const c = caregiverById(store, invitationId);
  if (!c || c.status !== 'pending' || c.expiresAt <= nowIso) return null;
  c.status = 'active';
  c.acceptedAt = nowIso;
  append(store, {
    scope: 'patient', patientId: c.linkedPatientId, actor: { role: 'caregiver', id: c.id },
    type: 'caregiver_invite_accepted', message: `${c.name.split(/\s+/)[0] ?? ''} قبل الدعوة`, createdAt: nowIso, relatedId: c.id,
  });
  return c;
}

export function declineInvitation(store: StoreState, invitationId: string, nowIso: string): Caregiver | null {
  const c = caregiverById(store, invitationId);
  if (!c || c.status !== 'pending' || c.expiresAt <= nowIso) return null;
  c.status = 'declined';
  c.declinedAt = nowIso;
  append(store, {
    scope: 'patient', patientId: c.linkedPatientId, actor: { role: 'caregiver', id: c.id },
    type: 'caregiver_invite_declined', message: `${c.name.split(/\s+/)[0] ?? ''} رفضت الدعوة`, createdAt: nowIso, relatedId: c.id,
  });
  return c;
}

/** Patient side: withdraw a still-pending invitation before any answer (CR-027 — revokedAt, no acceptedAt). */
export function cancelInvitation(store: StoreState, invitationId: string, nowIso: string): Caregiver | null {
  const c = caregiverById(store, invitationId);
  if (!c || c.status !== 'pending') return null;
  c.status = 'revoked';
  c.revokedAt = nowIso;
  append(store, {
    scope: 'patient', patientId: c.linkedPatientId, actor: { role: 'patient' }, type: 'caregiver_invite_cancelled',
    message: `أُلغيت دعوة ${c.name.split(/\s+/)[0] ?? ''}`, createdAt: nowIso, relatedId: c.id,
  });
  return c;
}

/** Patient side: withdraw access already granted (CR-027 — revokedAt, acceptedAt stays set). */
export function revokeCaregiver(store: StoreState, invitationId: string, nowIso: string): Caregiver | null {
  const c = caregiverById(store, invitationId);
  if (!c || c.status !== 'active') return null;
  c.status = 'revoked';
  c.revokedAt = nowIso;
  append(store, {
    scope: 'patient', patientId: c.linkedPatientId, actor: { role: 'patient' }, type: 'caregiver_revoked',
    message: `سُحبت صلاحية ${c.name.split(/\s+/)[0] ?? ''}`, createdAt: nowIso, relatedId: c.id,
  });
  return c;
}

export function inviteCaregiver(
  store: StoreState,
  patientId: string,
  input: { civilId: string; name: string; relationship: string },
  nowIso: string,
): Caregiver {
  const id = `cg-${String(store.caregivers.length + 1).padStart(2, '0')}`;
  const c: Caregiver = {
    id, civilId: input.civilId, name: input.name, relationship: input.relationship,
    linkedPatientId: patientId, status: 'pending', invitedAt: nowIso,
    expiresAt: addDaysIso(nowIso, INVITATION_VALID_DAYS), accessLevel: 'read_only',
  };
  store.caregivers.push(c);
  const patient = store.patients.find((p) => p.id === patientId);
  if (patient) patient.caregiverIds.push(id);
  append(store, {
    scope: 'patient', patientId, actor: { role: 'patient', id: patientId }, type: 'caregiver_invited',
    message: 'دعوة مقدّم رعاية أُرسلت', createdAt: nowIso, relatedId: id,
  });
  return c;
}
