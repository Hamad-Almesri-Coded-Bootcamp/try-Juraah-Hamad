/**
 * Projection literals for patient, settings, caregivers, activity, audit log, notifications reads and snapshot — owned by package WP3d (lead split at Gate 1, D-020/D-022). Only that package edits this file;
 * `lib/data/shapes.ts` is the barrel the lead owns. Rules: docs/briefs/P2-common.md.
 */
import type { AuditEvent, MessagingLink, PushSubscription, Settings } from '@/types/contracts';
import type { AuditLogRow, CaregiverLinkView, CaregiverView, InvitationSummary, PatientView } from '@/types/views';
import { compact, str, type DbRow } from './_core';

/** PatientView — the seed literal's order (id, name, language, onboardingCompleted, caregiverIds),
 * then the optional fields the mock appends when a mutation sets them (phone after caregiverIds —
 * updatePatientPhone assigns it last). telegramChatId is never projected (G9 / rule 7). */
export function toPatientView(r: DbRow): PatientView {
  return compact({
    id: String(r.id),
    name: String(r.name),
    language: r.language as PatientView['language'],
    onboardingCompleted: Boolean(r.onboarding_completed),
    caregiverIds: (r.caregiver_ids as string[] | null) ?? [],
    phone: str(r.phone),
    telegramLinkedAt: str(r.telegram_linked_at),
  }) as PatientView;
}

/** Settings row — patientId FIRST (buildSettings' literal); the no-row default is refusals.ts'. */
export function toSettings(r: DbRow): Settings {
  return {
    patientId: String(r.patient_id),
    adherenceCheckInEnabled: Boolean(r.adherence_check_in_enabled),
    adherenceCheckInFrequency: r.adherence_check_in_frequency as Settings['adherenceCheckInFrequency'],
    refillAlertsEnabled: Boolean(r.refill_alerts_enabled),
    calendarSyncEnabled: Boolean(r.calendar_sync_enabled),
    webPushEnabled: Boolean(r.web_push_enabled),
    notificationChannel: r.notification_channel as Settings['notificationChannel'],
    language: r.language as Settings['language'],
  };
}

/** InvitationSummary — exactly five keys, F0's non-negotiable invariant (E-23). Also the element
 * shape of getPendingInvitationsForSubject (the mock builds both with one toInvitationSummary). */
export function toInvitationSummary(r: DbRow): InvitationSummary {
  return {
    id: String(r.id),
    patientFirstName: String(r.patient_first_name ?? ''),
    relationship: String(r.relationship),
    status: r.status as InvitationSummary['status'],
    expiresAt: String(r.expires_at),
  };
}

/** AuditEvent — the seed's key order with `id` LAST (buildAuditEvents/append both spread the event
 * and then set `id`); `actor.id` and `patientId`/`relatedId` are dropped when absent. */
export function toAuditEvent(r: DbRow): AuditEvent {
  return compact({
    scope: r.scope as AuditEvent['scope'],
    patientId: str(r.patient_id),
    actor: compact({ role: r.actor_role as AuditEvent['actor']['role'], id: str(r.actor_id) }),
    type: r.type as AuditEvent['type'],
    message: String(r.message),
    createdAt: String(r.created_at),
    relatedId: str(r.related_id),
    id: String(r.id),
  }) as AuditEvent;
}

/** AuditLogRow — the AuditEvent literal, then `patientMaskedName` LAST and only when present (the
 * mock's `{...e, patientMaskedName}`). Read from the audit_log_admin view only (CR-047). */
export function toAuditLogRow(r: DbRow): AuditLogRow {
  const e = toAuditEvent(r);
  const masked = str(r.patient_masked_name);
  return masked === undefined ? e : { ...e, patientMaskedName: masked };
}

/** CaregiverView — the seed literal's order (buildCaregivers): the lifecycle timestamps in
 * accepted → declined → revoked order (cg-06 carries acceptedAt then revokedAt). phone sits where
 * the contract puts it (never set by any seed row or function). civilId and telegramChatId are
 * never selected. */
export function toCaregiverView(r: DbRow): CaregiverView {
  return compact({
    id: String(r.id),
    name: String(r.name),
    relationship: String(r.relationship),
    phone: str(r.phone),
    linkedPatientId: String(r.linked_patient_id),
    status: r.status as CaregiverView['status'],
    invitedAt: String(r.invited_at),
    expiresAt: String(r.expires_at),
    acceptedAt: str(r.accepted_at),
    declinedAt: str(r.declined_at),
    revokedAt: str(r.revoked_at),
    accessLevel: r.access_level as CaregiverView['accessLevel'],
  }) as CaregiverView;
}

/** CaregiverLinkView — the mock's literal (patientId, patientFirstName, acceptedAt; '' when absent). */
export function toCaregiverLink(r: DbRow): CaregiverLinkView {
  return {
    patientId: String(r.patient_id ?? ''),
    patientFirstName: String(r.patient_first_name ?? ''),
    acceptedAt: String(r.accepted_at ?? ''),
  };
}

/** PushSubscription — from push_subscriptions_view (endpoint/p256dh/auth do not exist in it). */
export function toPushSubscription(r: DbRow): PushSubscription {
  return {
    id: String(r.id),
    subjectType: r.subject_type as PushSubscription['subjectType'],
    subjectId: String(r.subject_id),
    status: r.status as PushSubscription['status'],
    permission: r.permission as PushSubscription['permission'],
    createdAt: String(r.created_at),
  };
}

/** MessagingLink — the seed literal's order (buildMessagingLinks: …, status, connectedAt, linkToken).
 * chatId is never projected (it is outside jurah_app's column grant, rule 7); linkToken only while the
 * row is `pending` (CR-048) — the query already nulls it otherwise. */
export function toMessagingLink(r: DbRow): MessagingLink {
  return compact({
    id: String(r.id),
    subjectType: r.subject_type as MessagingLink['subjectType'],
    subjectId: String(r.subject_id),
    channel: r.channel as MessagingLink['channel'],
    status: r.status as MessagingLink['status'],
    connectedAt: str(r.connected_at),
    linkToken: str(r.link_token),
  }) as MessagingLink;
}

/** readLastKnownSnapshot — `{ data, asOf }` (the mock's Map value literal). `data` is the stored
 * json text, parsed by the driver, so its key order is the cached shape's. */
export function toSnapshot(r: DbRow): { data: unknown; asOf: string } {
  return { data: r.data, asOf: String(r.as_of) };
}
