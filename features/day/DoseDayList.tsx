import type { ReactNode } from 'react';
import { ScheduleGroup } from '@/components/ui/ScheduleGroup';
import { DoseRow } from '@/components/ui/DoseRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { copy, t } from '@/i18n';
import { formatDoseAmount, formatDoseTime, groupDosesByTime } from './format';
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
  className,
}: DoseDayListProps) {
  const groups = groupDosesByTime(doses);
  const isEmpty = groups.length === 0;

  return (
    <div className={['flex flex-col gap-4', className].filter(Boolean).join(' ')}>
      <div data-testid="dose-list" className="flex flex-col gap-4">
        {isEmpty ? (
          <EmptyState
            icon="capsule"
            title={emptyTitle ?? t(copy.day.emptyDayTitle, locale)}
            description={emptyDescription ?? t(copy.day.emptyDayDescription, locale)}
          />
        ) : (
          groups.map((group) => (
            <ScheduleGroup key={group.time} timeLabel={formatDoseTime(group.doses[0]!.scheduledAt, locale)}>
              {group.doses.map((dose) => (
                <DoseRow
                  key={dose.id}
                  dose={{ status: dose.status, tracked: dose.tracked }}
                  drug={dose.drug}
                  amountLabel={formatDoseAmount(dose, locale)}
                  href={hrefBuilder ? hrefBuilder(dose) : undefined}
                  lang={locale}
                />
              ))}
            </ScheduleGroup>
          ))
        )}
      </div>
      {!tracked && !isEmpty && (
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
