/**
 * E2 — activity feed (`docs/wireframes/Activity.dc.html`), Daylight (CR-071): the patient-scoped
 * `AuditEvent` rows, reverse chronological (already `getActivity`'s own order), grouped by day under
 * a day heading, one grouped card per day. Each event is one line (its message, in the reader's
 * language through `localizeText`) plus its time; the actor is named on the time's line only when it
 * is not the patient (the patient knows what they did). Read-only by `ActivityRow`'s own contract (G1) — this component
 * adds no affordance beyond the `href` each row already carries.
 *
 * Masked names are never rendered here as a separate value: they arrive baked into `event.message`
 * by the seed ("دعوة مقدّم رعاية إلى عبدالله م*** ع*** المطيري") and keep their shape when the
 * message is localised — this screen never calls a masking formatter itself.
 */
import { ActivityRow } from '@/components/ui/ActivityRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { activityHrefFor, ACTOR_LABEL_KEY, EVENT_LABEL_KEY } from './format';
import { copy, t } from '@/i18n';
import { formatDayLabel, formatTime } from '@/i18n/format';
import { localizeText } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';
import type { AuditEvent } from '@/types/contracts';

/** Consecutive events of the same Kuwait calendar day, in the order given (newest first). The day is
 * the ISO instant's own date part: every stored instant carries the Kuwait offset (+03:00). */
export function groupByDay(events: readonly AuditEvent[]): { day: string; events: AuditEvent[] }[] {
  const groups: { day: string; events: AuditEvent[] }[] = [];
  for (const event of events) {
    const day = event.createdAt.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.events.push(event);
    else groups.push({ day, events: [event] });
  }
  return groups;
}

export function ActivityFeed({
  events,
  locale,
  hrefFor = (event) => activityHrefFor(event, locale),
}: {
  events: AuditEvent[];
  locale: Locale;
  /** Where a row links. Defaults to the patient shell's routes; the caregiver's read-only reuse (F3)
   * passes its own `/care/...` map, or `() => undefined` for no links at all. */
  hrefFor?: (event: AuditEvent) => string | undefined;
}) {
  if (events.length === 0) {
    return <EmptyState icon="clock" title={t(copy.ambient.e2EmptyTitle, locale)} description={t(copy.ambient.e2EmptyBody, locale)} />;
  }

  return (
    <div className="flex flex-col gap-5" data-testid="activity-list">
      {groupByDay(events).map((group) => (
        <section key={group.day} className="flex flex-col gap-2" data-testid="activity-day">
          <h2 className="jr-group-title">{formatDayLabel(group.day, locale)}</h2>
          <div className="jr-group">
            {group.events.map((event) => {
              const message = localizeText(event.message, locale);
              const time = formatTime(event.createdAt.slice(11, 16), locale);
              // The actor shares the time's line, and only when it is not the patient themself.
              const actor = event.actor.role === 'patient' ? null : t(copy.vocabulary[ACTOR_LABEL_KEY[event.actor.role]], locale);
              return (
                <ActivityRow
                  key={event.id}
                  title={message || t(copy.vocabulary[EVENT_LABEL_KEY[event.type]], locale)}
                  timeLabel={actor ? `${time} · ${actor}` : time}
                  href={hrefFor(event)}
                />
              );
            })}
          </div>
        </section>
      ))}
      <p className="m-0 px-1 type-caption text-ink-muted">{t(copy.ambient.e2ReadOnlyNote, locale)}</p>
    </div>
  );
}
