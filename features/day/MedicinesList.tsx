import { InteractionAlert } from '@/components/ui/InteractionAlert';
import { PrescriptionCard } from '@/components/ui/PrescriptionCard';
import { PrescriptionCardLink } from './PrescriptionCardLink';
import { SectorChip } from '@/components/ui/SectorChip';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { copy, t } from '@/i18n';
import { formatDate, formatStrength } from '@/i18n/format';
import { interpolate } from '@/features/shell/interpolate';
import { pendingDangerGuidance } from '@/features/safety/guidance';
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
  /** Builds the href the lead alert's "Open the alert" action pushes to — C2 (`/app/safety/[id]`) for
   * the patient, the read-only `/care/alerts/[id]` for a caregiver (F2: "danger alert shown, opens C2
   * content read-only"). The alert is the most prominent element on the screen, so it always opens
   * something (audit C6). `null` renders no open action — only for a consumer with no alert route. */
  alertHrefBuilder: ((alert: InteractionAlertRecord) => string) | null;
  /** true = the caregiver's read-only view: the empty state offers no add/scan action (a caregiver
   * cannot add the patient's prescriptions) and nothing here exposes a write control. Default false. */
  readOnly?: boolean;
  /** Where the empty state's "add a prescription" action points. Ignored when `readOnly`. */
  addHref?: string;
  /** Where "see all safety alerts" points — a second, quiet action beside "Open the alert", shown
   * only when more than one alert exists. */
  safetyHref?: string;
  className?: string;
}

const ALERT_TITLE = {
  danger: copy.day.alertTitleDanger,
  warning: copy.day.alertTitleWarning,
  info: copy.day.alertTitleInfo,
} as const;

/** "Warfarin ٥ ملغم — مستشفى الفروانية" — the drug name stays Latin (a name, not a unit); the strength
 * goes through the one shared formatter, digits and unit word following the locale (audit M7). */
function drugLine(rx: Prescription | undefined, locale: Locale): string | null {
  if (!rx) return null;
  const strength = rx.drug.strengthMg != null ? ` ${formatStrength(rx.drug.strengthMg, rx.drug.strengthUnit, locale)}` : '';
  return `${rx.drug.genericName}${strength} — ${rx.source.facilityName}`;
}

/**
 * B2's card list, alert included: the most severe `InteractionAlert` on top (full width, the single
 * most prominent element on the screen — never colour alone, never more than one at `danger`), the
 * active prescriptions as cards, and a de-emphasised past group with no refill action. Presentational
 * and props-driven — no fetch, no mock import (cross-bundle contract, docs/briefs/WP4c.md).
 *
 * Width: the root is a container; the card groups are one column until the content column is wide
 * enough for two (`@[720px]` — MedicinesDesktop.dc.html draws two across inside the 880px cap), and
 * the alert above them always spans the full width (navigation.md: prominence outranks layout
 * symmetry). The caregiver's F2 reuses this component and inherits the same shape.
 */
export function MedicinesList({
  prescriptions,
  alerts,
  nextDoseByPrescriptionId,
  tracked,
  locale,
  hrefBuilder,
  alertHrefBuilder,
  readOnly = false,
  addHref,
  safetyHref,
  className,
}: MedicinesListProps) {
  const active = prescriptions.filter((p) => p.status === 'active');
  const past = prescriptions.filter((p) => p.status !== 'active');
  const leadAlert = alerts[0];
  const rxById = new Map(prescriptions.map((p) => [p.id, p]));
  const leadAlertHref = leadAlert && alertHrefBuilder ? alertHrefBuilder(leadAlert) : undefined;
  const seeAllHref = alerts.length > 1 ? safetyHref : undefined;

  return (
    <div className={['@container flex flex-col gap-4', className].filter(Boolean).join(' ')}>
      {leadAlert && (
        <InteractionAlert
          severity={leadAlert.severity}
          reviewStatus={leadAlert.reviewStatus}
          title={t(ALERT_TITLE[leadAlert.severity], locale)}
          description={leadAlert.description}
          drugs={leadAlert.involvedPrescriptionIds.map((id) => drugLine(rxById.get(id), locale)).filter((v): v is string => v != null)}
          // §8 part two (what to do now) before part three (who is checking) — pending danger only.
          reviewLabel={pendingDangerGuidance(leadAlert, locale)}
          lang={locale}
          actions={
            leadAlertHref || seeAllHref ? (
              <>
                {/* Secondary and quiet only: inside a danger alert both restyle to on-fill
                    (InteractionAlert.md) — navy primary on red is not a checked pair. */}
                {leadAlertHref && (
                  <NavigateButton href={leadAlertHref} variant="secondary" lang={locale}>
                    {t(copy.day.openAlertAction, locale)}
                  </NavigateButton>
                )}
                {seeAllHref && (
                  <NavigateButton href={seeAllHref} variant="quiet" lang={locale}>
                    {t(copy.day.seeAllAlerts, locale)}
                  </NavigateButton>
                )}
              </>
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
              <div className="grid grid-cols-1 gap-3 @[720px]:grid-cols-2">
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
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className="flex flex-col gap-3" aria-label={t(copy.day.pastMedicinesTitle, locale)}>
              <h2 className="type-h2">{t(copy.day.pastMedicinesTitle, locale)}</h2>
              <div className="grid grid-cols-1 gap-3 @[720px]:grid-cols-2">
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
              </div>
              <span className="type-label">{t(copy.day.pastMedicinesNote, locale)}</span>
            </section>
          )}
        </>
      )}
    </div>
  );
}
