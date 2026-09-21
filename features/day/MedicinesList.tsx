import { InteractionAlert } from '@/components/ui/InteractionAlert';
import { PrescriptionCard } from '@/components/ui/PrescriptionCard';
import { PrescriptionCardLink } from './PrescriptionCardLink';
import { SectorChip } from '@/components/ui/SectorChip';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { copy, t } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { interpolate } from '@/features/shell/interpolate';
import type { Locale } from '@/i18n/locale';
import type { DoseStatus } from '@/components/ui/StatusPill';
import type { InteractionAlert as InteractionAlertRecord, Prescription } from '@/types/contracts';

/** The next (or most recent) dose for one prescription, already resolved by the caller —
 * `features/day/format.ts`'s `pickNextOrMostRecent` over today's `getDosesForDay` rows. */
export interface NextDoseInfo {
  status: DoseStatus;
  /** Already-formatted, e.g. "اليوم ٨:٠٠ م" / "Today 8:00 PM". This component formats no dates. */
  timeLabel: string;
}

export interface MedicinesListProps {
  /** Every prescription the patient has (active and past) — from `getPrescriptions`. */
  prescriptions: Prescription[];
  /** The patient's alerts — from `getAlerts`, already sorted most-severe-first by the seam. */
  alerts: InteractionAlertRecord[];
  /** Keyed by `Prescription.id`: the next-or-most-recent dose for that active prescription today.
   * A missing key renders the card with no dose row at all (PrescriptionCard's own contract). */
  nextDoseByPrescriptionId: Record<string, NextDoseInfo | undefined>;
  /** `Settings.adherenceCheckInEnabled` — when false, no card ever shows a status pill, regardless
   * of what `nextDoseByPrescriptionId` carries (rule 3 / G10, enforced again here defensively). */
  tracked: boolean;
  locale: Locale;
  /** Builds the href for a card's only affordance (opens the prescription detail). `null` renders
   * every card with no link — the caregiver-with-no-detail-route case in the cross-bundle contract. */
  hrefBuilder: ((prescription: Prescription) => string) | null;
  /** true = the caregiver's read-only view: the empty state offers no add/scan action (a caregiver
   * cannot add the patient's prescriptions) and nothing here exposes a write control. Default false. */
  readOnly?: boolean;
  /** Where the empty state's "add a prescription" action points. Ignored when `readOnly`. */
  addHref?: string;
  /** Where "see all safety alerts" points, shown only when more than one alert exists. */
  safetyHref?: string;
  className?: string;
}

const ALERT_TITLE = {
  danger: copy.day.alertTitleDanger,
  warning: copy.day.alertTitleWarning,
  info: copy.day.alertTitleInfo,
} as const;

function drugLine(rx: Prescription | undefined, locale: Locale): string | null {
  if (!rx) return null;
  void locale; // numerals here mirror board practice (Western digits in the citation-style line); no formatting done
  const unit = rx.drug.strengthUnit ?? 'mg';
  const strength = rx.drug.strengthMg != null ? ` ${rx.drug.strengthMg} ${unit}` : '';
  return `${rx.drug.genericName}${strength} — ${rx.source.facilityName}`;
}

/**
 * B2's card list, alert included: the most severe `InteractionAlert` on top (full width, the single
 * most prominent element on the screen — never colour alone, never more than one at `danger`), the
 * active prescriptions as cards, and a de-emphasised past group with no refill action. Presentational
 * and props-driven — no fetch, no mock import (cross-bundle contract, docs/briefs/WP4c.md).
 */
export function MedicinesList({
  prescriptions,
  alerts,
  nextDoseByPrescriptionId,
  tracked,
  locale,
  hrefBuilder,
  readOnly = false,
  addHref,
  safetyHref,
  className,
}: MedicinesListProps) {
  const active = prescriptions.filter((p) => p.status === 'active');
  const past = prescriptions.filter((p) => p.status !== 'active');
  const leadAlert = alerts[0];
  const rxById = new Map(prescriptions.map((p) => [p.id, p]));

  return (
    <div className={['flex flex-col gap-4', className].filter(Boolean).join(' ')}>
      {leadAlert && (
        <InteractionAlert
          severity={leadAlert.severity}
          reviewStatus={leadAlert.reviewStatus}
          title={t(ALERT_TITLE[leadAlert.severity], locale)}
          description={leadAlert.description}
          drugs={leadAlert.involvedPrescriptionIds.map((id) => drugLine(rxById.get(id), locale)).filter((v): v is string => v != null)}
          lang={locale}
          actions={
            alerts.length > 1 && safetyHref ? (
              <NavigateButton href={safetyHref} variant="secondary" lang={locale}>
                {t(copy.day.seeAllAlerts, locale)}
              </NavigateButton>
            ) : undefined
          }
        />
      )}

      {active.length === 0 && past.length === 0 ? (
        <EmptyState
          icon="capsule"
          title={t(copy.day.emptyMedicinesTitle, locale)}
          description={t(copy.day.emptyMedicinesDescription, locale)}
          action={
            !readOnly && addHref ? (
              <NavigateButton href={addHref} variant="secondary" icon="camera" lang={locale}>
                {t(copy.day.addPrescriptionAction, locale)}
              </NavigateButton>
            ) : undefined
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <section className="flex flex-col gap-3" aria-label={t(copy.day.activeMedicinesTitle, locale)}>
              <h2 className="type-h2">{t(copy.day.activeMedicinesTitle, locale)}</h2>
              {active.map((rx) => {
                const info = tracked ? nextDoseByPrescriptionId[rx.id] : undefined;
                const href = hrefBuilder ? hrefBuilder(rx) : undefined;
                if (!href) {
                  return (
                    <PrescriptionCard
                      key={rx.id}
                      prescription={rx}
                      dose={info ? { status: info.status } : undefined}
                      doseTimeLabel={info?.timeLabel}
                      lang={locale}
                    />
                  );
                }
                return (
                  <PrescriptionCardLink
                    key={rx.id}
                    href={href}
                    prescription={rx}
                    dose={info ? { status: info.status } : undefined}
                    doseTimeLabel={info?.timeLabel}
                    lang={locale}
                  />
                );
              })}
            </section>
          )}

          {past.length > 0 && (
            <section className="flex flex-col gap-3" aria-label={t(copy.day.pastMedicinesTitle, locale)}>
              <h2 className="type-h2">{t(copy.day.pastMedicinesTitle, locale)}</h2>
              {past.map((rx) => {
                const href = hrefBuilder ? hrefBuilder(rx) : undefined;
                const primaryName = rx.drug.brandName ?? rx.drug.genericName;
                return (
                  <Card
                    key={rx.id}
                    as={href ? 'a' : 'div'}
                    href={href}
                    aria-label={href ? primaryName : undefined}
                    className="flex flex-col gap-2"
                  >
                    <span className="type-body-strong">
                      {primaryName}
                      {rx.drug.brandName && <span className="type-body-small"> {rx.drug.genericName}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      <SectorChip sector={rx.source.sector} lang={locale} />
                      <span className="type-body-small">{rx.source.facilityName}</span>
                    </span>
                    <span className="type-body-small">
                      {rx.status === 'discontinued' && rx.discontinuedAt
                        ? interpolate(t(copy.day.discontinuedOnTemplate, locale), { date: formatDate(rx.discontinuedAt, locale) })
                        : t(copy.day.completedLabel, locale)}
                    </span>
                    {rx.status === 'discontinued' && rx.discontinuedReason && (
                      <span className="type-body-small">{interpolate(t(copy.day.discontinuedReasonTemplate, locale), { reason: rx.discontinuedReason })}</span>
                    )}
                  </Card>
                );
              })}
              <span className="type-label">{t(copy.day.pastMedicinesNote, locale)}</span>
            </section>
          )}
        </>
      )}
    </div>
  );
}
