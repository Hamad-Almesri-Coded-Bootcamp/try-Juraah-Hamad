/**
 * F3 — caregiver detail access, prescription detail (B3's content minus every action — SCREENS.md).
 * `features/day` (bundle c) had not landed when this bundle was built, so this composes its own
 * read from the ui components (DEPENDENCIES §1), following the `CaregiverDetail` board and B3's row
 * unread. No Button, no Sheet, no refill link — read-only by construction (G1, CLAUDE.md rule 8).
 */
import { DetailRow } from '@/components/ui/DetailRow';
import { SectorChip } from '@/components/ui/SectorChip';
import { DoseTimeline } from '@/components/ui/DoseTimeline';
import { DepletionMeter } from '@/components/ui/DepletionMeter';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { getDoseHistory, getPrescription, getSettings } from '@/lib/data';
import { computeDepletion } from '@/lib/schedule/depletion';
import { formatDate } from '@/i18n/format';
import { formatDoseTimes, formatStrength, patternLabel, rxStatusLabel, timelineWhen } from './format';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

export async function CaregiverPrescriptionDetail({ prescriptionId, locale }: { prescriptionId: string; locale: Locale }) {
  const rx = await getPrescription(prescriptionId);
  if (!rx) {
    return <InlineNotice tone="info" title={t(copy.vocabulary.empty, locale)} />;
  }
  const [history, settings] = await Promise.all([getDoseHistory(prescriptionId), getSettings(rx.patientId)]);
  const depletion = rx.dispensing ? computeDepletion(rx) : null;

  return (
    <div className="flex flex-col gap-3 p-3 tablet:p-5">
      <DetailRow label={t(copy.caregiving.f3RxGenericLabel, locale)} value={rx.drug.genericName} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxBrandLabel, locale)} value={rx.drug.brandName} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxStrengthLabel, locale)} value={formatStrength(rx.drug, locale)} lang={locale} />
      <div className="flex items-center gap-2">
        <SectorChip sector={rx.source.sector} lang={locale} />
        <span className="type-body">{rx.source.facilityName}</span>
      </div>
      <DetailRow label={t(copy.caregiving.f3RxStatusLabel, locale)} value={rxStatusLabel(rx.status, locale)} lang={locale} />
      {rx.status === 'discontinued' && (
        <>
          <DetailRow label={t(copy.caregiving.f3RxDiscontinuedReasonLabel, locale)} value={rx.discontinuedReason} lang={locale} />
          <DetailRow label={t(copy.caregiving.f3RxDiscontinuedAtLabel, locale)} value={rx.discontinuedAt ? formatDate(rx.discontinuedAt, locale) : null} lang={locale} />
        </>
      )}
      <DetailRow label={t(copy.caregiving.f3RxDoseLabel, locale)} value={rx.dosePerAdministration} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxFrequencyLabel, locale)} value={rx.frequencyPerDay} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxPatternLabel, locale)} value={patternLabel(rx.dosingPattern, locale)} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxDoseTimesLabel, locale)} value={formatDoseTimes(rx.doseTimes, locale)} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxStartDateLabel, locale)} value={rx.startDate ? formatDate(rx.startDate, locale) : null} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxDurationLabel, locale)} value={rx.durationDays} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxTimingLabel, locale)} value={rx.timingRelativeToFood} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxRouteLabel, locale)} value={rx.routeOfAdministration} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxIndicationLabel, locale)} value={rx.indication} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxNotesLabel, locale)} value={rx.specialNotes} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxPrescriberLabel, locale)} value={rx.prescriberName} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxPrescribedAtLabel, locale)} value={rx.prescribedAt ? formatDate(rx.prescribedAt, locale) : null} lang={locale} />

      {rx.needsReview && <InlineNotice tone="info" title={t(copy.caregiving.f3RxNeedsReviewNote, locale)} />}

      <span className="type-h2">{t(copy.caregiving.f3RxDispensingTitle, locale)}</span>
      <DetailRow label={t(copy.caregiving.f3RxUnitsPerPackageLabel, locale)} value={rx.dispensing?.unitsPerPackage} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxTotalDispensedLabel, locale)} value={rx.dispensing?.totalQuantityDispensed} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxDispenseDateLabel, locale)} value={rx.dispensing ? formatDate(rx.dispensing.dispenseDate, locale) : null} lang={locale} />
      <DetailRow label={t(copy.caregiving.f3RxBrandDispensedLabel, locale)} value={rx.dispensing?.brandActuallyDispensed} lang={locale} />
      {depletion && depletion.remaining !== null && depletion.total !== null && (
        <DepletionMeter remaining={depletion.remaining} total={depletion.total} daysRemaining={depletion.daysRemaining} lang={locale} />
      )}

      <span className="type-h2">{t(copy.caregiving.f3DoseHistoryTitle, locale)}</span>
      {!settings.adherenceCheckInEnabled && <p className="type-body-small">{t(copy.caregiving.f3DoseHistoryTrackingOffNote, locale)}</p>}
      <DoseTimeline
        items={[...history]
          .reverse()
          .map((d) => ({ ...timelineWhen(d.scheduledAt, locale), status: d.status, tracked: d.tracked }))}
        lang={locale}
      />

      <p className="type-caption" style={{ textAlign: 'center' }}>
        {t(copy.caregiving.f3ReadOnlyRxNote, locale)}
      </p>
    </div>
  );
}
