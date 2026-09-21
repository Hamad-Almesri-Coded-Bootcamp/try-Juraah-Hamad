/**
 * B3 — prescription detail (`/[locale]/app/medicines/[prescriptionId]`), the patient's own read-only
 * view: every `Prescription` contract field including the dispensing block, via `DetailRow`s
 * (WP4d brief); `SectorChip`; a read-only `DoseTimeline`; and the one patient action this screen owns
 * — a secondary Button into D1 (refill, bundle f's screen, wave 3) carrying this rx in `?rx=`
 * (DEPENDENCIES: a placeholder page already exists there; this bundle only links to it).
 *
 * Composed independently of `features/caregiving/CaregiverPrescriptionDetail` (F3, read at
 * DEPENDENCIES §1 for parity — see docs/backend-notes/wp4d.md §7 for the drift found) rather than
 * imported, so a change to the caregiver's read-only view can never silently change the patient's.
 * Nothing here can create or change a `Dose.status` (G1): every row is `DetailRow`/`DoseTimeline`,
 * never a control, and the only Button on this screen navigates, it does not write.
 */
import { DetailRow } from '@/components/ui/DetailRow';
import { SectorChip } from '@/components/ui/SectorChip';
import { DoseTimeline } from '@/components/ui/DoseTimeline';
import { DepletionMeter } from '@/components/ui/DepletionMeter';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { getDoseHistory, getPrescription, getSettings } from '@/lib/data';
import { computeDepletion } from '@/lib/schedule/depletion';
import { formatDate } from '@/i18n/format';
import { formatDoseTimes, formatDurationDays, formatStrength, patternLabel, rxStatusLabel, timelineWhen } from './format';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

export async function PrescriptionDetail({
  prescriptionId,
  locale,
  emptyBackHref,
}: {
  prescriptionId: string;
  locale: Locale;
  emptyBackHref: string;
}) {
  const rx = await getPrescription(prescriptionId);
  if (!rx) {
    // G7's empty state for a detail route: a prescription id that does not exist, or exists for a
    // different patient (getPrescription's own session check already returned null either way — it
    // never distinguishes the two to this screen, and this screen does not either).
    return (
      <div className="p-3">
        <EmptyState
          title={t(copy.prescription.b3EmptyTitle, locale)}
          description={t(copy.prescription.b3EmptyDescription, locale)}
          action={
            <NavigateButton href={emptyBackHref} variant="secondary" lang={locale}>
              {t(copy.prescription.b3EmptyAction, locale)}
            </NavigateButton>
          }
        />
      </div>
    );
  }

  const [history, settings] = await Promise.all([getDoseHistory(prescriptionId), getSettings(rx.patientId)]);
  // No `dispensing` → no meter, no estimate, no invented number (computeDepletion itself returns
  // all-null without a dispensing record; the `rx.dispensing ? ... : null` guard is belt-and-braces).
  const depletion = rx.dispensing ? computeDepletion(rx) : null;
  const strength = formatStrength(rx.drug, locale);

  return (
    <div className="flex flex-col gap-4 p-3">
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

      {rx.needsReview && <InlineNotice tone="info" title={t(copy.prescription.rxNeedsReviewNote, locale)} />}

      {/* Every contract field, present or not — DetailRow renders the empty mark rather than
          "undefined" (rx-006, the core-fields-only record, has no brand name, strength, frequency,
          start date or dose times, and this list still holds its shape). */}
      <Card className="flex flex-col gap-2">
        <DetailRow label={t(copy.prescription.rxGenericLabel, locale)} value={rx.drug.genericName} lang={locale} />
        <DetailRow label={t(copy.prescription.rxBrandLabel, locale)} value={rx.drug.brandName} lang={locale} />
        <DetailRow label={t(copy.prescription.rxStrengthLabel, locale)} value={strength} lang={locale} />
        <DetailRow label={t(copy.prescription.rxDoseLabel, locale)} value={rx.dosePerAdministration} lang={locale} />
        <DetailRow label={t(copy.prescription.rxFrequencyLabel, locale)} value={rx.frequencyPerDay} lang={locale} />
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
        <span className="type-h2">{t(copy.prescription.rxDispensingTitle, locale)}</span>
        {/* The block itself never disappears, dispensed or not (DetailRow.md: "don't hide the block
            it sits in") — only the DepletionMeter below is conditional on a real dispensing record. */}
        <Card className="flex flex-col gap-2">
          <DetailRow label={t(copy.prescription.rxUnitsPerPackageLabel, locale)} value={rx.dispensing?.unitsPerPackage} lang={locale} />
          <DetailRow label={t(copy.prescription.rxTotalDispensedLabel, locale)} value={rx.dispensing?.totalQuantityDispensed} lang={locale} />
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

      <div className="flex flex-col gap-2">
        <span className="type-h2">{t(copy.prescription.doseHistoryTitle, locale)}</span>
        {/* Tracking-off note keys off Settings.adherenceCheckInEnabled, never off any dose's status
            word (rule 3) — and each DoseTimeline row's own pill visibility keys off that dose's own
            `tracked`, not this note, so the two can never silently disagree. */}
        {!settings.adherenceCheckInEnabled && <InlineNotice tone="info">{t(copy.prescription.doseHistoryTrackingOffNote, locale)}</InlineNotice>}
        {history.length === 0 ? (
          <p className="type-body-small">{t(copy.prescription.doseHistoryEmpty, locale)}</p>
        ) : (
          <DoseTimeline
            items={[...history].reverse().map((d) => ({ ...timelineWhen(d.scheduledAt, locale), status: d.status, tracked: d.tracked }))}
            lang={locale}
          />
        )}
      </div>

      {rx.status === 'active' && (
        <NavigateButton href={`/${locale}/app/more/refill?rx=${rx.id}`} variant="secondary" size="lg" fullWidth lang={locale}>
          {t(copy.prescription.refillButtonLabel, locale)}
        </NavigateButton>
      )}
    </div>
  );
}
