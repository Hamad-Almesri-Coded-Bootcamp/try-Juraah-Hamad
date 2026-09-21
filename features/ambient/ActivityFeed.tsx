/**
 * E2 — activity feed (`docs/wireframes/Activity.dc.html`): the patient-scoped `AuditEvent` rows,
 * reverse chronological (already `getActivity`'s own order), read-only by `ActivityRow`'s own
 * contract (G1) — this component adds no affordance beyond the `href` each row already carries.
 * Masked names are never rendered here as a separate value: they arrive baked into `event.message`
 * by the seed (a caregiver-invitation message already reads "دعوة مقدّم رعاية إلى عبدالله م*** ع***
 * المطيري") — this screen never calls a masking formatter itself, per this bundle's brief note that
 * warns against inventing one.
 */
import { ActivityRow } from '@/components/ui/ActivityRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { activityHrefFor, activityTimeLabel, ACTOR_LABEL_KEY, EVENT_LABEL_KEY } from './format';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { AuditEvent } from '@/types/contracts';

export function ActivityFeed({ events, locale }: { events: AuditEvent[]; locale: Locale }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon="clock"
        title={t(copy.ambient.e2EmptyTitle, locale)}
        description={t(copy.ambient.e2EmptyBody, locale)}
      />
    );
  }

  return (
    <div className="flex flex-col" data-testid="activity-list">
      {events.map((event) => (
        <ActivityRow
          key={event.id}
          title={t(copy.vocabulary[EVENT_LABEL_KEY[event.type]], locale)}
          description={event.message}
          timeLabel={activityTimeLabel(event.createdAt, locale)}
          actor={{ label: t(copy.vocabulary[ACTOR_LABEL_KEY[event.actor.role]], locale), kind: event.actor.role }}
          href={activityHrefFor(event, locale)}
        />
      ))}
      <p className="p-3 type-caption">{t(copy.ambient.e2ReadOnlyNote, locale)}</p>
    </div>
  );
}
