import type { ReactNode } from 'react';
import { AlertRow } from '@/components/ui/AlertRow';
import { IconButton } from '@/components/ui/IconButton';
import { DayDial } from '@/components/ui/DayDial';
import { SkyHeader } from '@/components/ui/SkyHeader';
import { WeekStrip } from '@/components/ui/WeekStrip';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { interpolate } from '@/features/shell/interpolate';
import { copy, t } from '@/i18n';
import { formatDayLabel, formatNumber } from '@/i18n/format';
import { localizeDrugName } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';
import type { InteractionAlert } from '@/types/contracts';
import type { DoseWithPrescription } from '@/types/views';
import { DoseDayList } from './DoseDayList';
import { formatDoseTime } from './format';
import { dialDoses, minutesOfIso, nextDoseAfter, weekDays } from './today';
import { addDays } from '@/lib/schedule/dates';

export interface TodayViewAlert {
  id: string;
  severity: InteractionAlert['severity'];
  reviewStatus: InteractionAlert['reviewStatus'];
  /** Generic names as stored; the row localises them. */
  drugs: string[];
  href: string;
}

/** The danger findings that still stand (CR-069(g)): pending, or confirmed by the reviewer. */
export function standingDangerAlerts(alerts: readonly InteractionAlert[]): InteractionAlert[] {
  return alerts.filter(
    (a) => a.severity === 'danger' && (a.reviewStatus === 'pending_medical_review' || (a.reviewStatus === 'reviewed' && a.reviewerDecision !== 'cleared')),
  );
}

export interface TodayViewProps {
  locale: Locale;
  /** The screen's one h1 (the tab label). */
  title: string;
  /** The greeting line above it. */
  eyebrow?: ReactNode;
  /** The bar's actions: the assistant and the language switch. */
  actions?: ReactNode;
  isoDate: string;
  today: string;
  nowIso: string;
  /** The link for a day in the week strip (today's is the bare home link). */
  dayHref: (iso: string) => string;
  homeHref: string;
  doses: DoseWithPrescription[];
  tracked: boolean;
  hrefBuilder: ((dose: DoseWithPrescription) => string) | null;
  alerts?: TodayViewAlert[];
  /** Quiet notices between the alerts and the day (a pending invitation). */
  notices?: ReactNode;
  readOnly?: boolean;
  settingsHref?: string;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  trackingOffNotice?: ReactNode;
  /** Wraps the sheet (LastKnown for the offline view). */
  wrapSheet?: (sheet: ReactNode) => ReactNode;
}

/**
 * Today, Daylight (CR-071) — the patient's home (B1) and the caregiver's view of the patient's day
 * (F2) are the same composition, so the caregiver sees exactly what the patient sees, never more
 * (rule 8): the sky with the greeting, the week strip and the day dial, then the sheet with any
 * standing danger finding, the notices and the day in parts. Read-only by construction: nothing here
 * can create or change a dose status (rule 1); the dial's colours key off `tracked` (rule 3).
 */
export function TodayView({
  locale,
  title,
  eyebrow,
  actions,
  isoDate,
  today,
  nowIso,
  dayHref,
  homeHref,
  doses,
  tracked,
  hrefBuilder,
  alerts = [],
  notices,
  readOnly = false,
  settingsHref,
  emptyTitle,
  emptyDescription,
  emptyAction,
  trackingOffNotice,
  wrapSheet,
}: TodayViewProps) {
  const isToday = isoDate === today;
  const nowMinutes = isToday ? minutesOfIso(nowIso) : null;
  const caption = interpolate(t(isToday ? copy.day.doseCountTodayTemplate : copy.day.doseCountTemplate, locale), {
    count: formatNumber(doses.length, locale),
  });

  const next = isToday ? nextDoseAfter(doses, nowIso) : undefined;
  const dialCenter =
    doses.length === 0 ? (
      <span className="jr-dial__name">{t(copy.daylight.noDosesThisDay, locale)}</span>
    ) : next ? (
      <>
        <span className="jr-dial__kicker">{t(copy.daylight.nextDose, locale)}</span>
        <span className="jr-dial__time">{formatDoseTime(next.scheduledAt, locale)}</span>
        <span className="jr-dial__name">{localizeDrugName(next.drug.brandName ?? next.drug.genericName, locale)}</span>
      </>
    ) : isToday ? (
      <span className="jr-dial__name">{t(copy.daylight.noMoreDosesToday, locale)}</span>
    ) : (
      <>
        <span className="jr-dial__kicker">{t(copy.daylight.dosesOnThisDay, locale)}</span>
        <span className="jr-dial__time">{formatNumber(doses.length, locale)}</span>
      </>
    );

  const sheet = (
    <div className="jr-sheet flex flex-col gap-5 px-3 pb-3 pt-5 tablet:px-5">
      <p className="type-body-small text-ink-muted">{caption}</p>
      {!isToday && (
        // Navigation only, so a real link drawn as a secondary button (not a button that pushes).
        <Link href={homeHref} className="jr-link-btn wsf-btn wsf-btn--secondary wsf-focus type-label self-start">
          <Icon name="refresh" />
          {t(copy.day.returnToToday, locale)}
        </Link>
      )}
      {alerts.map((alert) => (
        <AlertRow
          key={alert.id}
          severity={alert.severity}
          drugs={alert.drugs}
          reviewStatus={alert.reviewStatus}
          href={alert.href}
          lang={locale}
        />
      ))}
      {notices}
      <DoseDayList
        doses={doses}
        tracked={tracked}
        locale={locale}
        nowMinutes={nowMinutes}
        hrefBuilder={hrefBuilder}
        readOnly={readOnly}
        settingsHref={settingsHref}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
        trackingOffNotice={trackingOffNotice}
      />
    </div>
  );

  return (
    <div className="relative flex min-h-full flex-col">
      <SkyHeader eyebrow={eyebrow} title={title} subtitle={formatDayLabel(isoDate, locale)} actions={actions}>
        <WeekStrip days={weekDays(isoDate, today, locale, dayHref)} label={t(copy.daylight.weekLabel, locale)} />
        {/* Day by day, both ways (B1 spec): the week strip reaches this week; these reach any day. Previous
            points to the start edge (mirror + reverse), next to the end (mirror) (audit C5). */}
        <div className="jr-sky__center">
          <IconButton
            label={t(copy.day.previousDay, locale)}
            icon="chevron"
            mirrorIcon
            reverseIcon
            href={dayHref(addDays(isoDate, -1))}
            className="jr-sky-nav"
          />
          <DayDial
            doses={dialDoses(doses)}
            nowMinutes={nowMinutes}
            // 24 at the top: an Arabic-Indic zero (٠) reads as a dot.
            hourLabels={[formatNumber(24, locale), formatNumber(6, locale), formatNumber(12, locale), formatNumber(18, locale)]}
          >
            {dialCenter}
          </DayDial>
          <IconButton label={t(copy.day.nextDay, locale)} icon="chevron" mirrorIcon href={dayHref(addDays(isoDate, 1))} className="jr-sky-nav" />
        </div>
      </SkyHeader>
      {wrapSheet ? wrapSheet(sheet) : sheet}
    </div>
  );
}
