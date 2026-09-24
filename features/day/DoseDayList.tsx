import type { ReactNode } from 'react';
import { ScheduleGroup } from '@/components/ui/ScheduleGroup';
import { DoseRow } from '@/components/ui/DoseRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { copy, t } from '@/i18n';
import { formatDoseAmount, formatDoseTime } from './format';
import { groupDosesByPart, minutesOfIso, partLabel } from './today';
import { formatTime } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import type { DoseWithPrescription } from '@/types/views';

export interface DoseDayListProps {
  /** One day's doses, from `getDosesForDay` — already day-filtered and ascending. */
  doses: DoseWithPrescription[];
  /**
   * `Settings.adherenceCheckInEnabled` — the patient's OVERALL tracking state, used only to decide
   * whether the "turn tracking on" explanation renders below the list. Each row's own status pill is
   * decided independently, per dose, by that dose's own `tracked` field — never by this prop
   * (CLAUDE.md rule 3 / G10: the pill's absence keys off `Dose.tracked`, never the status word, and
   * never a screen-level flag either).
   */
  tracked: boolean;
  locale: Locale;
  /**
   * Builds the href for a dose row's only affordance (opens the prescription detail — G1: the row
   * offers nothing else). `null` renders every row with no link at all — the cross-bundle contract
   * for a consumer with no detail route wired for its shell yet.
   */
  hrefBuilder: ((dose: DoseWithPrescription) => string) | null;
  /**
   * true = the caregiver's read-only view (bundle h / F2): the tracking-off explanation still
   * renders (UX Principles §10 — "the caregiver sees the same plan, the same explanation, never
   * more"), but its "turn tracking on" Button is absent rather than disabled (§10, rule 8) because a
   * caregiver may never write the patient's settings. Default false.
   */
  readOnly?: boolean;
  /** Where the "turn tracking on" Button points (the patient's own Settings screen). Ignored, and
   * the button omitted, when `readOnly` or when this is not supplied. */
  settingsHref?: string;
  /** Overrides the default "no doses today" copy — e.g. a distinct message for a patient with no
   * active prescription at all yet, versus a day that simply has none. */
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  /** The empty state's one action, when there is one that applies (UX §1/§7, audit M12): B1 passes
   * "add a prescription by photo" only for a patient with no active prescription at all. A day that
   * simply has no dose (an alternate-day medicine) passes none — the day navigation is the way on.
   * Ignored when `readOnly`. Rendered OUTSIDE the `dose-list` root, which never holds a control. */
  emptyAction?: ReactNode;
  /** Replaces the tracking-off explanation (still shown only when `tracked` is false and the day has
   * doses). The default is written TO the patient ("we are not tracking your doses — turn it on");
   * the caregiver's F2 passes the same fact in the caregiver's voice, naming the patient, with no
   * action (UX §10, rule 8; audit M10). Rendered outside the `dose-list` root, like the default. */
  trackingOffNotice?: ReactNode;
  /** Minutes since midnight now, only when the day shown is today: draws the "Now" line. */
  nowMinutes?: number | null;
  className?: string;
}

/**
 * B1's day list: one `ScheduleGroup` per distinct dose time, each holding that time's `DoseRow`s —
 * and, outside the `data-testid="dose-list"` root the standing G1 test reads, the tracking-off
 * explanation with its own "turn tracking on" action. The list root itself carries no button, no
 * input and no click handler beyond each row's own single optional link (G1 — nothing here can ever
 * create or change a `Dose.status`). Presentational and props-driven: no fetch, no mock import — the
 * caller does all the fetching (cross-bundle contract, docs/briefs/WP4c.md).
 */
export function DoseDayList({
  doses,
  tracked,
  locale,
  hrefBuilder,
  readOnly = false,
  settingsHref,
  emptyTitle,
  emptyDescription,
  emptyAction,
  trackingOffNotice,
  nowMinutes,
  className,
}: DoseDayListProps) {
  const groups = groupDosesByPart(doses);
  const isEmpty = groups.length === 0;

  return (
    <div className={['flex flex-col gap-4', className].filter(Boolean).join(' ')}>
      {/* Empty: the EmptyState (and its one action, if any) sits beside the list root, never inside
          it — the root stays free of every control, the G1 runtime proof's structural invariant. */}
      {isEmpty && (
        <EmptyState
          icon="capsule"
          title={emptyTitle ?? t(copy.day.emptyDayTitle, locale)}
          description={emptyDescription ?? t(copy.day.emptyDayDescription, locale)}
          action={!readOnly ? emptyAction : undefined}
        />
      )}
      <div data-testid="dose-list" className="flex flex-col gap-5">
        {isEmpty
          ? null
          : groups.map((group, gi) => {
              // "Now" sits before the first dose still ahead: between two parts of the day, or inside
              // one. It is a line of time, never a control and never a status (rule 1, rule 3).
              const firstAhead = nowMarkerIndex(group.doses, nowMinutes);
              const beforeGroup = firstAhead === 0 && (gi === 0 || nowMarkerIndex(groups[gi - 1]!.doses, nowMinutes) === -1);
              return (
                <div key={`${group.part}-${gi}`} className="flex flex-col gap-5">
                  {beforeGroup ? <NowLine minutes={nowMinutes!} locale={locale} /> : null}
                  <ScheduleGroup timeLabel={partLabel(group.part, locale)}>
                    {group.doses.map((dose, di) => (
                      <DoseRowWithNow
                        key={dose.id}
                        showNow={di > 0 && di === firstAhead}
                        nowMinutes={nowMinutes}
                        locale={locale}
                      >
                        <DoseRow
                          dose={{ status: dose.status, tracked: dose.tracked }}
                          drug={dose.drug}
                          amountLabel={formatDoseAmount(dose, locale)}
                          timeLabel={formatDoseTime(dose.scheduledAt, locale)}
                          href={hrefBuilder ? hrefBuilder(dose) : undefined}
                          lang={locale}
                        />
                      </DoseRowWithNow>
                    ))}
                  </ScheduleGroup>
                </div>
              );
            })}
        {!isEmpty && nowMinutes != null && groups.every((g) => nowMarkerIndex(g.doses, nowMinutes) === -1) ? (
          <NowLine minutes={nowMinutes} locale={locale} />
        ) : null}
      </div>
      {!tracked && !isEmpty && trackingOffNotice}
      {!tracked && !isEmpty && !trackingOffNotice && (
        <InlineNotice>
          <span className="flex flex-col items-start gap-2">
            <span>{t(copy.day.trackingOffNotice, locale)}</span>
            {!readOnly && settingsHref && (
              <NavigateButton href={settingsHref} variant="secondary" lang={locale}>
                {t(copy.day.turnTrackingOn, locale)}
              </NavigateButton>
            )}
          </span>
        </InlineNotice>
      )}
    </div>
  );
}

/** Index of the first dose after now in a group, or -1 (none ahead in it, or no "now" at all). */
function nowMarkerIndex(doses: readonly DoseWithPrescription[], nowMinutes: number | null | undefined): number {
  if (nowMinutes == null) return -1;
  return doses.findIndex((d) => minutesOfIso(d.scheduledAt) > nowMinutes);
}

function NowLine({ minutes, locale }: { minutes: number; locale: Locale }) {
  const hhmm = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return (
    <div className="jr-now type-label" data-testid="now-line">
      <span className="jr-now__dot" aria-hidden="true" />
      <span>
        {t(copy.daylight.now, locale)} <span className="jr-num">{formatTime(hhmm, locale)}</span>
      </span>
      <span className="jr-now__line" aria-hidden="true" />
    </div>
  );
}

function DoseRowWithNow({
  showNow,
  nowMinutes,
  locale,
  children,
}: {
  showNow: boolean;
  nowMinutes: number | null | undefined;
  locale: Locale;
  children: ReactNode;
}) {
  if (!showNow || nowMinutes == null) return <>{children}</>;
  return (
    <>
      <NowLine minutes={nowMinutes} locale={locale} />
      {children}
    </>
  );
}
