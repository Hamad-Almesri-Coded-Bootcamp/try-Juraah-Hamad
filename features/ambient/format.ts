/**
 * Small, ambient-scoped formatting helpers (WP4 bundle g — E1–E5). No date maths beyond what
 * `i18n/format` already exposes; this file lives in `features/ambient`, not `lib/**`.
 */
import { formatDate, formatTime } from '@/i18n/format';
import { copy } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { AuditEvent } from '@/types/contracts';

export const ACTOR_LABEL_KEY = {
  patient: 'actor_patient',
  caregiver: 'actor_caregiver',
  reviewer: 'actor_reviewer',
  admin: 'actor_admin',
  agent: 'actor_agent',
  system: 'actor_system',
} as const satisfies Record<AuditEvent['actor']['role'], keyof typeof copy.vocabulary>;

export const EVENT_LABEL_KEY = {
  prescription_added: 'event_prescription_added',
  prescription_discontinued: 'event_prescription_discontinued',
  prescription_field_confirmed: 'event_prescription_field_confirmed',
  prescription_returned_to_clinic: 'event_prescription_returned_to_clinic',
  alert_raised: 'event_alert_raised',
  alert_reviewed: 'event_alert_reviewed',
  dose_status_recorded: 'event_dose_status_recorded',
  schedule_recomputed: 'event_schedule_recomputed',
  refill_requested: 'event_refill_requested',
  refill_status_changed: 'event_refill_status_changed',
  caregiver_invited: 'event_caregiver_invited',
  caregiver_invite_accepted: 'event_caregiver_invite_accepted',
  caregiver_invite_declined: 'event_caregiver_invite_declined',
  caregiver_invite_expired: 'event_caregiver_invite_expired',
  caregiver_invite_cancelled: 'event_caregiver_invite_cancelled',
  caregiver_revoked: 'event_caregiver_revoked',
  caregiver_self_unlinked: 'event_caregiver_self_unlinked',
  messaging_connected: 'event_messaging_connected',
  messaging_disconnected: 'event_messaging_disconnected',
  push_enabled: 'event_push_enabled',
  push_disabled: 'event_push_disabled',
  tracking_enabled: 'event_tracking_enabled',
  tracking_disabled: 'event_tracking_disabled',
  signed_in: 'event_signed_in',
  signed_out: 'event_signed_out',
} as const satisfies Record<AuditEvent['type'], keyof typeof copy.vocabulary>;

/**
 * E2's own href map (patient shell routes — the caregiver shell's `activityHrefFor` in
 * `features/caregiving/format.ts` points at `/care/...` instead, so this is not reused from there).
 * Only wired where SCREENS.md's E2 row names a destination: a prescription → B3, an alert → C2, a
 * caregiver event → F1 (the list only — F1 has no per-caregiver route), settings → E3 for the
 * tracking on/off pair. Every other event type renders with no link (G1: read-only, nothing
 * invented).
 */
export function activityHrefFor(event: Pick<AuditEvent, 'type' | 'relatedId'>, locale: Locale): string | undefined {
  if (event.type.startsWith('prescription_') && event.relatedId) return `/${locale}/app/medicines/${event.relatedId}`;
  if (event.type.startsWith('alert_') && event.relatedId) return `/${locale}/app/safety/${event.relatedId}`;
  if (event.type.startsWith('caregiver_')) return `/${locale}/app/more/caregivers`;
  if (event.type === 'tracking_enabled' || event.type === 'tracking_disabled') return `/${locale}/app/more/settings`;
  return undefined;
}

/** E2's timestamp cell — the same composition `features/caregiving/CaregiverActivity.tsx` uses for
 * the identical underlying data (E2's own content, reused read-only by F3), kept independent per
 * that file's own comment: a change to one screen's rendering must never silently change the
 * other's. */
export function activityTimeLabel(createdAt: string, locale: Locale): string {
  return `${formatDate(createdAt.slice(0, 10), locale)} ${formatTime(createdAt.slice(11, 16), locale)}`;
}
