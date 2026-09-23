/**
 * F3 — caregiver detail access, prescription detail: B3's content minus every action (SCREENS.md;
 * UX Principles §10 — "identical to the patient's view minus actions"). Since audit M10 it reads
 * B3's own field labels (`copy.prescription.*`), B3's own value formatters
 * (`features/prescription/format`), B3's needs-review note and B3's windowed `DoseHistorySection`
 * (audit M8), so one field never has two names across the two shells (UX §3). Only the
 * caregiver-voice lines stay this bundle's own: the tracking-off note (the patient, not "you", has
 * tracking off) and the read-only note. No refill link, no Sheet — read-only by construction (G1,
 * CLAUDE.md rule 8); the only Button that can appear discloses more dose-history rows, and none
 * writes anything.
 */
import { DetailRow } from '@/components/ui/DetailRow';
import { SectorChip } from '@/components/ui/SectorChip';
import { DepletionMeter } from '@/components/ui/DepletionMeter';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { Card } from '@/components/ui/Card';
import { getDoseHistory, getPrescription, getSettings } from '@/lib/data';
import { computeDepletion } from '@/lib/schedule/depletion';
import { kuwaitNow } from '@/lib/config';
import { formatDate, formatNumber } from '@/i18n/format';
import { formatDoseCount } from '@/features/day/format';
import { formatDoseTimes, formatDurationDays, formatStrength, patternLabel, rxStatusLabel } from '@/features/prescription/format';
import { DoseHistorySection } from '@/features/prescription/DoseHistorySection';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

export async function CaregiverPrescriptionDetail({ prescriptionId, locale }: { prescriptionId: string; locale: Locale }) {
  const rx = await getPrescription(prescriptionId);
  if (!rx) {
    return <InlineNotice tone="info" title={t(copy.vocabulary.empty, locale)} />;
  }
  const [history, settings] = await Promise.all([getDoseHistory(prescriptionId), getSettings(rx.patientId)]);
  const depletion = rx.dispensing ? computeDepletion(rx) : null;
  const strength = formatStrength(rx.drug, locale);
  const num = (n: number | undefined) => (n == null ? null : formatNumber(n, locale));

  return (
    <div className="flex flex-col gap-4 p-3 tablet:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="type-h2">
          {rx.drug.genericName}
          {strength ? ` ${strength}` : ''}
        </h2>
        {rx.drug.brandName && <span className="type-body-small">{rx.drug.brandName}</span>}
        <div className="flex items-center gap-2">
          <SectorChip sector={rx.source.sector} lang={locale} />
          <span className="type-body-small">{rx.source.facilityName}</span>
        </div>
      </div>

      {/* B3's own note: one actor named for the same pending check (the medical reviewer), not two. */}
      {rx.needsReview && <InlineNotice tone="info" title={t(copy.prescription.rxNeedsReviewNote, locale)} />}

      <Card className="flex flex-col gap-2">
        <DetailRow label={t(copy.prescription.rxGenericLabel, locale)} value={rx.drug.genericName} lang={locale} />
        <DetailRow label={t(copy.prescription.rxBrandLabel, locale)} value={rx.drug.brandName} lang={locale} />
        <DetailRow label={t(copy.prescription.rxStrengthLabel, locale)} value={strength} lang={locale} />
        <DetailRow label={t(copy.prescription.rxDoseLabel, locale)} value={formatDoseCount(rx.dosePerAdministration, locale)} lang={locale} />
        <DetailRow label={t(copy.prescription.rxFrequencyLabel, locale)} value={num(rx.frequencyPerDay)} lang={locale} />
        <DetailRow label={t(copy.prescription.rxPatternLabel, locale)} value={patternLabel(rx.dosingPattern, locale)} lang={locale} />
        <DetailRow label={t(copy.prescription.rxDoseTimesLabel, locale)} value={formatDoseTimes(rx.doseTimes, locale)} lang={locale} />
        <DetailRow label={t(copy.prescription.rxStartDateLabel, locale)} value={rx.startDate ? formatDate(rx.startDate, locale) : null} lang={locale} />
        <DetailRow label={t(copy.prescription.rxDurationLabel, locale)} value={formatDurationDays(rx.durationDays, locale)} lang={locale} />
        <DetailRow label={t(copy.prescription.rxTimingLabel, locale)} value={rx.timingRelativeToFood} lang={locale} />
        <DetailRow label={t(copy.prescription.rxRouteLabel, locale)} value={rx.routeOfAdministration} lang={locale} />
        <DetailRow label={t(copy.prescription.rxIndicationLabel, locale)} value={rx.indication} lang={locale} />
        <DetailRow label={t(copy.prescription.rxNotesLabel, locale)} value={rx.specialNotes} lang={locale} />
        <DetailRow label={t(copy.prescription.rxPrescriberLabel, locale)} value={rx.prescriberName} lang={locale} />
        <DetailRow label={t(copy.prescription.rxPrescribedAtLabel, locale)} value={rx.prescribedAt ? formatDate(rx.prescribedAt, locale) : null} lang={locale} />
        <DetailRow label={t(copy.prescription.rxStatusLabel, locale)} value={rxStatusLabel(rx.status, locale)} lang={locale} />
        {rx.status === 'discontinued' && (
          <>
            <DetailRow label={t(copy.prescription.rxDiscontinuedReasonLabel, locale)} value={rx.discontinuedReason} lang={locale} />
            <DetailRow
              label={t(copy.prescription.rxDiscontinuedAtLabel, locale)}
              value={rx.discontinuedAt ? formatDate(rx.discontinuedAt, locale) : null}
              lang={locale}
            />
          </>
        )}
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="type-h2">{t(copy.prescription.rxDispensingTitle, locale)}</h2>
        <Card className="flex flex-col gap-2">
          <DetailRow label={t(copy.prescription.rxUnitsPerPackageLabel, locale)} value={num(rx.dispensing?.unitsPerPackage)} lang={locale} />
          <DetailRow label={t(copy.prescription.rxTotalDispensedLabel, locale)} value={num(rx.dispensing?.totalQuantityDispensed)} lang={locale} />
          <DetailRow
            label={t(copy.prescription.rxDispenseDateLabel, locale)}
            value={rx.dispensing ? formatDate(rx.dispensing.dispenseDate, locale) : null}
            lang={locale}
          />
          <DetailRow label={t(copy.prescription.rxBrandDispensedLabel, locale)} value={rx.dispensing?.brandActuallyDispensed} lang={locale} />
        </Card>
        {depletion && depletion.remaining !== null && depletion.total !== null && (
          <DepletionMeter remaining={depletion.remaining} total={depletion.total} daysRemaining={depletion.daysRemaining} lang={locale} />
        )}
      </div>

      <DoseHistorySection
        history={history}
        nowIso={kuwaitNow()}
        locale={locale}
        trackingOffNote={
          !settings.adherenceCheckInEnabled ? <p className="type-body-small">{t(copy.caregiving.f3DoseHistoryTrackingOffNote, locale)}</p> : null
        }
      />

      <p className="type-caption" style={{ textAlign: 'center' }}>
        {t(copy.caregiving.f3ReadOnlyRxNote, locale)}
      </p>
    </div>
  );
}
