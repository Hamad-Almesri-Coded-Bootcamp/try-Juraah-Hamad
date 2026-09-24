/**
 * B3's body, Daylight (CR-071), as a presentational view the caregiver's F3 can render too: F3 is
 * "identical to the patient's view minus actions" (UX §10), so it passes `refillHref={null}` and its
 * own read-only alert link, and nothing else differs. Props in, no fetch, no hooks.
 *
 * Leads with its answer: the medicine (large monogram, brand first then generic, sector and
 * facility), then a link when it is part of a serious interaction that still stands, the
 * needs-review line, how much and when (three facts), supply left (only with a dispensing record:
 * never an invented estimate), every contract field in one card (the empty ones named in one
 * closing line) and the dose history, windowed.
 *
 * Read-only (G1): the only controls navigate (refill, the alert) or disclose more history rows. Each
 * history row's pill is decided by that dose's own `tracked` (rule 3), never by its status word.
 */
import type { ReactNode } from 'react';
import { AlertRow } from '@/components/ui/AlertRow';
import { Icon, type IconName } from '@/components/ui/Icon';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { Monogram } from '@/components/ui/Monogram';
import { SectorChip } from '@/components/ui/SectorChip';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { interpolate } from '@/features/shell/interpolate';
import { SupplyRing, isLowSupply, supplyCountLine } from '@/features/supply/SupplyRing';
import { formatDoseCount } from '@/features/day/format';
import { copy, t } from '@/i18n';
import { formatDate, formatTime } from '@/i18n/format';
import { localizeFacility } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';
import { computeDepletion } from '@/lib/schedule/depletion';
import type { Dose, InteractionAlert, Prescription } from '@/types/contracts';
import { DoseHistorySection } from './DoseHistorySection';
import { PrescriptionFields } from './PrescriptionFields';
import { formatDurationDays, formatStrength, medicineNames, patternLabel, prescriptionFields, rxStatusLabel } from './format';

export interface PrescriptionDetailInteraction {
  severity: InteractionAlert['severity'];
  reviewStatus: InteractionAlert['reviewStatus'];
  /** Generic names as stored; AlertRow localises them. */
  drugs: string[];
  href: string;
}

export interface PrescriptionDetailViewProps {
  rx: Prescription;
  history: Pick<Dose, 'scheduledAt' | 'status' | 'tracked'>[];
  nowIso: string;
  locale: Locale;
  /** The standing danger finding this medicine is part of, if any (CR-069(g)). */
  interaction?: PrescriptionDetailInteraction | null;
  /** Where "Request a refill" goes. `null` renders no refill action (F3, or a stopped course). */
  refillHref?: string | null;
  /** The tracking-off line, in the caller's own voice; `null` when tracking is on. */
  trackingOffNote?: ReactNode;
}

function Fact({ icon, value, label }: { icon: IconName; value: ReactNode; label: ReactNode }) {
  return (
    <div className="jr-fact min-w-0">
      <Icon name={icon} className="jr-fact__icon" />
      <span className="jr-fact__value [overflow-wrap:anywhere]">{value}</span>
      <span className="jr-fact__label">{label}</span>
    </div>
  );
}

export function PrescriptionDetailView({ rx, history, nowIso, locale, interaction, refillHref = null, trackingOffNote }: PrescriptionDetailViewProps) {
  const { primary, generic } = medicineNames(rx.drug, locale);
  const strength = formatStrength(rx.drug, locale);
  // No `dispensing` → no ring, no estimate, no invented number (computeDepletion itself returns
  // all-null without a dispensing record).
  const depletion = rx.dispensing ? computeDepletion(rx) : null;
  const hasSupply = depletion != null && depletion.remaining != null && depletion.total != null;
  const low = isLowSupply(depletion?.daysRemaining);
  const active = rx.status === 'active';

  const facts: { key: string; icon: IconName; value: ReactNode; label: ReactNode }[] = [
    { key: 'dose', icon: 'capsule', value: formatDoseCount(rx.dosePerAdministration, locale), label: t(copy.prescription.b3EachTime, locale) },
  ];
  if (rx.doseTimes && rx.doseTimes.length > 0) {
    facts.push({
      key: 'times',
      icon: 'clock',
      value: (
        <span className="flex flex-wrap justify-center gap-x-2">
          {rx.doseTimes.map((hhmm) => (
            <span key={hhmm} className="jr-num">
              {formatTime(hhmm, locale)}
            </span>
          ))}
        </span>
      ),
      label: patternLabel(rx.dosingPattern, locale) ?? t(copy.prescription.rxDoseTimesLabel, locale),
    });
  }
  facts.push({
    key: 'duration',
    icon: 'calendar',
    value: formatDurationDays(rx.durationDays, locale),
    label: rx.startDate
      ? interpolate(t(copy.prescription.b3FromDateTemplate, locale), { date: formatDate(rx.startDate, locale) })
      : t(copy.prescription.rxDurationLabel, locale),
  });

  return (
    <div className="flex flex-col gap-5 p-3 tablet:p-5">
      <div className="flex flex-col gap-3 px-1">
        <div className="flex items-center gap-4">
          <Monogram name={primary} size="lg" />
          <div className="flex min-w-0 flex-col">
            <h2 className="jr-display text-h1 m-0 text-navy [overflow-wrap:anywhere]">
              {primary}
              {strength ? <span className="jr-num"> {strength}</span> : null}
            </h2>
            {generic ? <span className="type-body text-ink-muted">{generic}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SectorChip sector={rx.source.sector} lang={locale} />
          {rx.source.facilityName ? <span className="type-body-small text-ink-muted">{localizeFacility(rx.source.facilityName, locale)}</span> : null}
        </div>
        {/* A course that has ended says so where the medicine is named, in B2's own words. */}
        {!active ? (
          <p className="type-body-small m-0 flex items-center gap-2 font-semibold text-ink-muted">
            <Icon name="info" small />
            {rx.status === 'discontinued' && rx.discontinuedAt
              ? interpolate(t(copy.day.discontinuedOnTemplate, locale), { date: formatDate(rx.discontinuedAt, locale) })
              : rxStatusLabel(rx.status, locale)}
          </p>
        ) : null}
      </div>

      {interaction && (
        <AlertRow severity={interaction.severity} drugs={interaction.drugs} reviewStatus={interaction.reviewStatus} href={interaction.href} lang={locale} />
      )}

      {rx.needsReview && <InlineNotice tone="info" title={t(copy.prescription.rxNeedsReviewNote, locale)} />}

      <section className="flex flex-col gap-2">
        <h2 className="jr-group-title">{t(copy.prescription.b3TakingTitle, locale)}</h2>
        <div className={['grid gap-2 tablet:gap-3', facts.length === 3 ? 'grid-cols-3' : 'grid-cols-2'].join(' ')}>
          {facts.map((f) => (
            <Fact key={f.key} icon={f.icon} value={f.value} label={f.label} />
          ))}
        </div>
      </section>

      {active && (
        <section className="flex flex-col gap-2">
          <h2 className="jr-group-title">{t(copy.prescription.b3SupplyTitle, locale)}</h2>
          <div className="jr-group flex flex-col items-start gap-4 p-4">
            {hasSupply && depletion ? (
              <div className="flex w-full items-center gap-4">
                <SupplyRing remaining={depletion.remaining!} total={depletion.total!} daysRemaining={depletion.daysRemaining} locale={locale} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="type-body-strong text-navy">{supplyCountLine(depletion.remaining!, depletion.total!, locale)}</span>
                  {low ? (
                    <span className="type-body-small flex items-center gap-1 font-semibold text-warning">
                      <Icon name="warning" small />
                      {t(copy.vocabulary.lowSupply, locale)}
                    </span>
                  ) : null}
                  {rx.dispensing ? (
                    <span className="type-body-small text-ink-muted">
                      {interpolate(t(copy.supply.supplyDispensedOnTemplate, locale), { date: formatDate(rx.dispensing.dispenseDate, locale) })}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="type-body-small m-0 text-ink-muted">{t(copy.supply.supplyNoEstimate, locale)}</p>
            )}
            {refillHref ? (
              <NavigateButton href={refillHref} variant="secondary" icon="refresh" lang={locale}>
                {t(copy.prescription.refillButtonLabel, locale)}
              </NavigateButton>
            ) : null}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="jr-group-title">{t(copy.prescription.b3DetailsTitle, locale)}</h2>
        <PrescriptionFields fields={prescriptionFields(rx, locale)} locale={locale} />
      </section>

      {/* Windowed to 7 days either side of now, the plan under its own heading, the rest behind a
          "show all" disclosure (audit M8). */}
      <DoseHistorySection history={history} nowIso={nowIso} locale={locale} trackingOffNote={trackingOffNote} />
    </div>
  );
}
