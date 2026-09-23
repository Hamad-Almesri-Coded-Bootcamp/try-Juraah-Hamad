/**
 * Projection literals for the channel writes — owned by package WP6 (lead split at Gate 1, D-020/D-022). Only that package edits this file;
 * `lib/data/shapes.ts` is the barrel the lead owns. Rules: docs/briefs/P2-common.md.
 *
 * Key order is the mock's (BACKEND-NOTES §5, tests/fixtures/shapes.json), compared as a string.
 * Never projected, by construction: `chat_id`, `endpoint`, `p256dh`, `auth` (rule 7, G9).
 */
import type { CalendarSubscription, Dose, MessagingLink, Prescription, PushSubscription } from '@/types/contracts';
import type { DoseWithPrescription } from '@/types/views';
import { compact, str, type DbRow } from './_core';

/** PushSubscription — `id, subjectType, subjectId, status, permission, createdAt` (ps-01's literal). */
export function toChannelPushSubscription(r: DbRow): PushSubscription {
  return {
    id: String(r.id),
    subjectType: r.subject_type as PushSubscription['subjectType'],
    subjectId: String(r.subject_id),
    status: r.status as PushSubscription['status'],
    permission: r.permission as PushSubscription['permission'],
    createdAt: String(r.created_at),
  };
}

/** MessagingLink — `id, subjectType, subjectId, channel, status, linkToken?, connectedAt?`. The
 * token is projected only while `pending` (CR-048); chatId never. */
export function toChannelMessagingLink(r: DbRow): MessagingLink {
  const status = r.status as MessagingLink['status'];
  return compact({
    id: String(r.id),
    subjectType: r.subject_type as MessagingLink['subjectType'],
    subjectId: String(r.subject_id),
    channel: 'telegram' as const,
    status,
    linkToken: status === 'pending' ? str(r.link_token) : undefined,
    connectedAt: str(r.connected_at),
  }) as MessagingLink;
}

/** CalendarSubscription — `patientId, icsUrl, token` (the seed's سارة row). */
export function toChannelCalendarSubscription(r: DbRow): CalendarSubscription {
  return { patientId: String(r.patient_id), icsUrl: String(r.ics_url), token: String(r.token) };
}

/** A calendar-feed row → DoseWithPrescription (the mock's toDoseWithPrescription key order: the
 * dose's keys, then `drug`, then `dosePerAdministration`). Consumed by lib/calendar/ics.ts only. */
export function toFeedDose(r: DbRow): DoseWithPrescription {
  return compact({
    id: String(r.id),
    prescriptionId: String(r.prescription_id),
    scheduledAt: String(r.scheduled_at),
    status: r.status as Dose['status'],
    tracked: Boolean(r.tracked),
    recordedAt: str(r.recorded_at),
    source: str(r.source) as Dose['source'],
    drug: compact({
      genericName: String(r.generic_name),
      brandName: str(r.brand_name),
      strengthMg: r.strength_mg === null || r.strength_mg === undefined ? undefined : Number(r.strength_mg), // unconverted
      strengthUnit: str(r.strength_unit) as Prescription['drug']['strengthUnit'],
    }),
    dosePerAdministration: Number(r.dose_per_administration),
  }) as DoseWithPrescription;
}
