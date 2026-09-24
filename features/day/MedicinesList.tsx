import Link from 'next/link';
import { InteractionAlert } from '@/components/ui/InteractionAlert';
import { Icon } from '@/components/ui/Icon';
import { Monogram } from '@/components/ui/Monogram';
import { PrescriptionCard } from '@/components/ui/PrescriptionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { interpolate } from '@/features/shell/interpolate';
import { pendingDangerGuidance } from '@/features/safety/guidance';
import { medicineNames } from '@/features/prescription/format';
import { isLowSupply } from '@/features/supply/SupplyRing';
import { copy, t } from '@/i18n';
import { formatDate, formatDaysLeft, formatStrength, formatTime } from '@/i18n/format';
import { localizeDrugName, localizeFacility, localizeText } from '@/i18n/localize';
import { computeDepletion } from '@/lib/schedule/depletion';
import type { Locale } from '@/i18n/locale';
import type { DoseStatus } from '@/components/ui/StatusPill';
import type { InteractionAlert as InteractionAlertRecord, Prescription } from '@/types/contracts';
import { standingDangerAlerts } from './TodayView';
import { PrescriptionCardLink } from './PrescriptionCardLink';

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
  /** true = the caregiver's read-only view: no add/scan action anywhere (a caregiver cannot add the
   * patient's prescriptions) and nothing here exposes a write control. Default false. */
  readOnly?: boolean;
  /** Where the "add a prescription by photo" action points. Ignored when `readOnly`. */
  addHref?: string;
  /** Where "see all safety alerts" points — a second, quiet action beside "Open the alert", shown
   * only when more than one alert exists. */
  safetyHref?: string;
  className?: string;
}

/** A card with extra lines reads top-down: its monogram sits beside the name, not in the middle of
 * the card (a layout utility, as screens pass to Card; the theme centres the one-line card). */
const CARD_LAYOUT = 'items-start';

const ALERT_TITLE = {
  danger: copy.day.alertTitleDanger,
  warning: copy.day.alertTitleWarning,
  info: copy.day.alertTitleInfo,
} as const;

/** "ماريفان ٥ ملغم · مستشفى الفروانية" / "Marevan 5 mg · Farwaniya Hospital": brand first (CR-069(l)),
 * every part in the reader's language, the strength through the one shared formatter (audit M7),
 * the parts joined with " · " (never a dash). */
function drugLine(rx: Prescription | undefined, locale: Locale): string | null {
  if (!rx) return null;
  const { primary } = medicineNames(rx.drug, locale);
  const strength = rx.drug.strengthMg != null ? ` ${formatStrength(rx.drug.strengthMg, rx.drug.strengthUnit, locale)}` : '';
  const facility = rx.source.facilityName ? ` · ${localizeFacility(rx.source.facilityName, locale)}` : '';
  return `${primary}${strength}${facility}`;
}

/** The lines under an active card's name (Daylight): its dose times as small pills, the supply
 * only when the pharmacy recorded a dispensing (never an invented estimate), and a quiet line when
 * the medicine is part of a serious interaction that still stands. Spans only: the card is a button. */
function CardExtras({ rx, involved, locale }: { rx: Prescription; involved: boolean; locale: Locale }) {
  const depletion = rx.dispensing ? computeDepletion(rx) : null;
  const supply =
    depletion && depletion.remaining != null && depletion.total != null && depletion.daysRemaining != null
      ? { pct: depletion.total > 0 ? Math.max(0, Math.min(100, (depletion.remaining / depletion.total) * 100)) : 0, days: depletion.daysRemaining }
      : null;
  const low = isLowSupply(supply?.days);
  const times = rx.doseTimes ?? [];
  if (times.length === 0 && !supply && !involved) return null;
  return (
    <span className="mt-3 flex flex-col gap-3">
      {times.length > 0 && (
        <span className="flex flex-wrap gap-2" aria-label={t(copy.prescription.rxDoseTimesLabel, locale)}>
          {times.map((hhmm) => (
            <span key={hhmm} className="jr-num type-body-small inline-flex items-center rounded-full bg-navy-tint px-3 py-1 font-semibold text-navy">
              {formatTime(hhmm, locale)}
            </span>
          ))}
        </span>
      )}
      {supply && (
        <span className="flex flex-col gap-2">
          <span className={['type-body-small flex items-center gap-1 font-semibold', low ? 'text-warning' : 'text-navy'].join(' ')}>
            {low ? <Icon name="warning" small /> : null}
            {formatDaysLeft(supply.days, locale)}
            {low ? ` · ${t(copy.vocabulary.lowSupply, locale)}` : null}
          </span>
          <span className="block h-2 overflow-hidden rounded-full bg-navy-tint" aria-hidden="true">
            <span className={['block h-full rounded-full', low ? 'bg-warning' : 'bg-navy'].join(' ')} style={{ inlineSize: `${supply.pct}%` }} />
          </span>
        </span>
      )}
      {involved && (
        <span className="type-body-small flex items-center gap-1 font-semibold text-danger">
          <Icon name="danger" small />
          {t(copy.day.partOfSeriousInteraction, locale)}
        </span>
      )}
    </span>
  );
}

/**
 * B2's list, Daylight (CR-071): the most severe `InteractionAlert` first (full width, the single most
 * prominent element on the screen: never colour alone, never more than one at `danger`), then the
 * active medicines as rich cards, the way to add one by photo, and the past medicines as one calm
 * grouped list with their reason and date and no refill action. Presentational and props-driven: no
 * fetch, no mock import (cross-bundle contract, docs/briefs/WP4c.md).
 *
 * Width: the root is a container; the cards are one column until the content column is wide enough
 * for two (`@[720px]`), and the alert above them always spans the full width (navigation.md:
 * prominence outranks layout symmetry). The caregiver's F2 reuses this component with `readOnly`
 * and inherits the same shape, seeing exactly what the patient sees and never a write control.
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
  const involvedIds = new Set(standingDangerAlerts(alerts).flatMap((a) => a.involvedPrescriptionIds));
  const addAction =
    !readOnly && addHref ? (
      <NavigateButton href={addHref} variant="secondary" icon="camera" fullWidth lang={locale}>
        {t(copy.day.addPrescriptionAction, locale)}
      </NavigateButton>
    ) : null;

  // The lead alert's title names the drugs it is about ("Warfarin × Ibuprofen", as the row on Today
  // does); the fuller sentence stays the fallback when the involved medicines are not on this list.
  const leadDrugNames = leadAlert
    ? leadAlert.involvedPrescriptionIds.map((id) => rxById.get(id)?.drug.genericName).filter((n): n is string => Boolean(n))
    : [];

  return (
    <div className={['@container flex flex-col gap-5', className].filter(Boolean).join(' ')}>
      {leadAlert && (
        <InteractionAlert
          severity={leadAlert.severity}
          reviewStatus={leadAlert.reviewStatus}
          title={leadDrugNames.length > 1 ? leadDrugNames.map((n) => localizeDrugName(n, locale)).join(' × ') : t(ALERT_TITLE[leadAlert.severity], locale)}
          description={leadAlert.description}
          drugs={leadAlert.involvedPrescriptionIds.map((id) => drugLine(rxById.get(id), locale)).filter((v): v is string => v != null)}
          // §8: the risk (title, description), then what to do now and who is checking, in that
          // order, in the one line after the risk (pending danger only).
          reviewLabel={pendingDangerGuidance(leadAlert, locale, readOnly ? 'caregiver' : 'patient')}
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
              <h2 className="jr-group-title">
                {t(copy.day.activeMedicinesTitle, locale)}
              </h2>
              <div className="grid grid-cols-1 gap-3 @[720px]:grid-cols-2">
                {active.map((rx) => {
                  const info = tracked ? nextDoseByPrescriptionId[rx.id] : undefined;
                  const href = hrefBuilder ? hrefBuilder(rx) : undefined;
                  const extras = <CardExtras rx={rx} involved={involvedIds.has(rx.id)} locale={locale} />;
                  if (!href) {
                    return (
                      <PrescriptionCard key={rx.id} prescription={rx} dose={info ? { status: info.status } : undefined} doseTimeLabel={info?.timeLabel} lang={locale} className={CARD_LAYOUT}>
                        {extras}
                      </PrescriptionCard>
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
                      className={CARD_LAYOUT}
                    >
                      {extras}
                    </PrescriptionCardLink>
                  );
                })}
              </div>
            </section>
          )}

          {addAction}

          {past.length > 0 && (
            <section className="flex flex-col gap-3" aria-label={t(copy.day.pastMedicinesTitle, locale)}>
              <h2 className="jr-group-title">
                {t(copy.day.pastMedicinesTitle, locale)}
              </h2>
              <div className="grid grid-cols-1 gap-3 @[720px]:grid-cols-2">
                <ul className="jr-group m-0 list-none p-0">
                  {past.map((rx, i) => {
                    const href = hrefBuilder ? hrefBuilder(rx) : undefined;
                    const { primary, generic } = medicineNames(rx.drug, locale);
                    const when =
                      rx.status === 'discontinued' && rx.discontinuedAt
                        ? interpolate(t(copy.day.discontinuedOnTemplate, locale), { date: formatDate(rx.discontinuedAt, locale) })
                        : t(copy.day.completedLabel, locale);
                    const reason =
                      rx.status === 'discontinued' && rx.discontinuedReason
                        ? interpolate(t(copy.day.discontinuedReasonTemplate, locale), { reason: localizeText(rx.discontinuedReason, locale) })
                        : null;
                    const body = (
                      <>
                        <Monogram name={primary} muted />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="type-body-strong text-navy">
                            {primary}
                            {generic ? <span className="type-body-small font-normal text-ink-muted"> · {generic}</span> : null}
                          </span>
                          <span className="type-body-small text-ink-muted">{when}</span>
                          {reason ? <span className="type-body-small text-ink-muted">{reason}</span> : null}
                        </span>
                        {href ? <Icon name="chevron" mirror className="flex-none text-border-strong" /> : null}
                      </>
                    );
                    const rowClass = 'flex items-center gap-3 px-4 py-3 text-navy no-underline';
                    return (
                      <li key={rx.id} className={i > 0 ? 'border-t border-border' : undefined}>
                        {href ? (
                          <Link href={href} className={`${rowClass} wsf-focus hover:bg-surface-app`}>
                            {body}
                          </Link>
                        ) : (
                          <div className={rowClass}>{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <p className="type-body-small m-0 px-1 text-ink-muted">{t(copy.day.pastMedicinesNote, locale)}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
