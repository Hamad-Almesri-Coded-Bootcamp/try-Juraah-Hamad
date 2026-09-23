/**
 * B3's (and F3's) dose history, windowed (audit M8): what already happened under "Dose history"
 * (newest first, the last 7 days) and the plan under its own plain heading, "Planned doses" (soonest
 * first, the next 7 days) — each with a "show all N" disclosure for the rest, so nothing is dropped.
 * Before this the screen listed every row flat (90 for Warfarin, future dates to 29 November under
 * "Dose history"), and "Request a refill" sat ~5,900px down.
 *
 * Server-compatible and presentational: the caller passes the rows it fetched and `nowIso` from its
 * clock helper (`kuwaitNow()` — never `Date.now()`, rule 9). Each row's `tracked` passes through to
 * `DoseTimeline` untouched, so the pill's absence still keys off `Dose.tracked` alone (rule 3), and
 * the only control here is the view disclosure — no dose status can be written from it (G1). Shared
 * by the patient's B3 and the caregiver's F3 so the two stay identical minus actions (UX §10).
 */
import type { ReactNode } from 'react';
import { copy, t } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { interpolate } from '@/features/shell/interpolate';
import { splitDoseHistory, timelineWhen } from './format';
import { DoseHistoryList, type DoseHistoryRow } from './DoseHistoryList';
import type { Locale } from '@/i18n/locale';
import type { Dose } from '@/types/contracts';

export interface DoseHistorySectionProps {
  history: Pick<Dose, 'scheduledAt' | 'status' | 'tracked'>[];
  nowIso: string;
  locale: Locale;
  /** The tracking-off line, in the caller's own voice (the patient's, or the caregiver's). */
  trackingOffNote?: ReactNode;
}

export function DoseHistorySection({ history, nowIso, locale, trackingOffNote }: DoseHistorySectionProps) {
  const { past, planned, pastVisible, plannedVisible } = splitDoseHistory(history, nowIso);
  const toRow = (d: Pick<Dose, 'scheduledAt' | 'status' | 'tracked'>): DoseHistoryRow => ({
    ...timelineWhen(d.scheduledAt, locale),
    status: d.status,
    tracked: d.tracked,
  });
  const showFewer = t(copy.prescription.doseHistoryShowFewer, locale);

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="type-h2">{t(copy.prescription.doseHistoryTitle, locale)}</h2>
        {trackingOffNote}
        {past.length === 0 ? (
          <p className="type-body-small">{t(copy.prescription.doseHistoryEmpty, locale)}</p>
        ) : (
          <DoseHistoryList
            rows={past.map(toRow)}
            visibleCount={pastVisible}
            showAllLabel={interpolate(t(copy.prescription.doseHistoryShowAllPastTemplate, locale), { count: formatNumber(past.length, locale) })}
            showFewerLabel={showFewer}
            lang={locale}
          />
        )}
      </section>

      {planned.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="type-h2">{t(copy.prescription.doseHistoryPlannedTitle, locale)}</h2>
          <DoseHistoryList
            rows={planned.map(toRow)}
            visibleCount={plannedVisible}
            showAllLabel={interpolate(t(copy.prescription.doseHistoryShowAllPlannedTemplate, locale), { count: formatNumber(planned.length, locale) })}
            showFewerLabel={showFewer}
            lang={locale}
          />
        </section>
      )}
    </>
  );
}
