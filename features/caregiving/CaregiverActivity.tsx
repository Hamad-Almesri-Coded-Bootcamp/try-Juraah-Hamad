/**
 * F3 — caregiver detail access, activity feed (E2's content — SCREENS.md): the patient-scoped
 * `AuditEvent` rows, reverse chronological, read-only. `getActivity` is already session-scoped to
 * an `active` caregiver (lib/data/mock/access.ts); this file adds no access check of its own.
 */
import { ActivityRow } from '@/components/ui/ActivityRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { getActivity, getCaregiverLink } from '@/lib/data';
import { formatDate, formatTime } from '@/i18n/format';
import { activityHrefFor } from './format';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { AuditEvent } from '@/types/contracts';

const ACTOR_LABEL_KEY = {
  patient: 'actor_patient',
  caregiver: 'actor_caregiver',
  reviewer: 'actor_reviewer',
  admin: 'actor_admin',
  agent: 'actor_agent',
  system: 'actor_system',
} as const satisfies Record<AuditEvent['actor']['role'], keyof typeof copy.vocabulary>;

const EVENT_LABEL_KEY = {
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

export async function CaregiverActivity({ caregiverId, locale }: { caregiverId: string; locale: Locale }) {
  const link = await getCaregiverLink(caregiverId);
  const events = await getActivity(link.patientId);

  if (events.length === 0) {
    return (
      <div className="p-3 tablet:p-5">
        <EmptyState icon="clock" title={t(copy.caregiving.f3ActivityEmptyTitle, locale)} description={t(copy.caregiving.f3ActivityEmptyBody, locale)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col p-3 tablet:p-5">
      {events.map((event) => (
        <ActivityRow
          key={event.id}
          title={t(copy.vocabulary[EVENT_LABEL_KEY[event.type]], locale)}
          description={event.message}
          timeLabel={`${formatDate(event.createdAt.slice(0, 10), locale)} ${formatTime(event.createdAt.slice(11, 16), locale)}`}
          actor={{ label: t(copy.vocabulary[ACTOR_LABEL_KEY[event.actor.role]], locale), kind: event.actor.role }}
          href={activityHrefFor(event, locale)}
        />
      ))}
    </div>
  );
}
