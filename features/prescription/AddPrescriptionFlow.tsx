'use client';

/**
 * B4 — add / scan prescription (`/[locale]/app/medicines/add`): capture-or-upload → analysing →
 * confident | needs_review (read-only review-and-confirm) | unreadable (explicit failure, never a
 * fabricated record) → saved. `submitPrescriptionImage`'s mock decides the outcome from the chosen
 * image's byte size (0 bytes → unreadable, under 100 → needs_review, otherwise confident —
 * `lib/data/index.ts`'s own doc comment), which is what lets `tests/e2e/prescription.spec.ts` reach
 * every state deterministically by uploading a fixture of the right size, through the published API
 * only (never `lib/data/mock/**` directly — guard 3).
 *
 * Non-negotiable invariant: no text input for any prescriber-owned clinical field, anywhere. The
 * review step is `DetailRow`s only — read-only confirmation, never a form. The one write this screen
 * performs is `savePrescriptionDraft`, which creates a `Prescription`, never a `Dose.status` (G1).
 *
 * Maps onto G7's four states as: empty = idle, nothing chosen yet · loading = analysing · content =
 * confident/needs_review's review step · error = unreadable, drawn with the real `ErrorState`.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PhotoInput } from '@/components/ui/PhotoInput';
import { LoadingState } from '@/components/ui/LoadingState';
import { DetailRow } from '@/components/ui/DetailRow';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { savePrescriptionDraft, submitPrescriptionImage } from '@/lib/data';
import { formatDate } from '@/i18n/format';
import { formatDoseTimes, formatDurationDays, formatStrength, patternLabel } from './format';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { ExtractionOutcome } from '@/types/views';

type Phase = 'capture' | 'analysing' | 'review' | 'unreadable';
type ReviewOutcome = Extract<ExtractionOutcome, { kind: 'confident' | 'needs_review' }>;

export function AddPrescriptionFlow({ locale, patientId, backHref }: { locale: Locale; patientId: string; backHref: string }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('capture');
  const [outcome, setOutcome] = useState<ReviewOutcome | null>(null);
  const [pending, startTransition] = useTransition();

  function handlePhotoChange(file: File | null) {
    setPhoto(file);
    if (!file) return;
    setPhase('analysing');
    startTransition(() => {
      void (async () => {
        const result = await submitPrescriptionImage(patientId, file);
        if (result.kind === 'unreadable') {
          setPhase('unreadable');
          return;
        }
        setOutcome(result);
        setPhase('review');
      })();
    });
  }

  function handleRetry() {
    setPhoto(null);
    setOutcome(null);
    setPhase('capture');
  }

  function handleConfirm() {
    if (!outcome) return;
    startTransition(() => {
      void (async () => {
        await savePrescriptionDraft(patientId, outcome.draftId);
        router.push(backHref);
      })();
    });
  }

  const drug = outcome?.prescription.drug;
  const strength = formatStrength(drug, locale);
  const uncertain = outcome?.kind === 'needs_review' ? new Set(outcome.uncertainFields) : null;

  function reviewRow(label: string, value: string | number | null | undefined, fieldKey?: string) {
    const isUncertain = !!fieldKey && (uncertain?.has(fieldKey) ?? false);
    // One phrase, seen and heard alike (audit m7): the visible mark and the screen-reader label are
    // the same "Unclear in the photo", so no reading of the row says "unclear" twice in two wordings.
    const unclear = isUncertain ? t(copy.prescription.unclearFieldLabel, locale) : undefined;
    return <DetailRow label={label} value={value} lang={locale} emptyMark={unclear} emptyLabel={unclear} />;
  }

  return (
    <div className="flex flex-col gap-4 p-3 tablet:p-5">
      {phase === 'capture' && (
        <>
          <PhotoInput value={photo} onChange={handlePhotoChange} label={t(copy.prescription.b4PhotoLabel, locale)} lang={locale} />
          <p className="type-caption">{t(copy.prescription.b4PrescriberFieldsNote, locale)}</p>
        </>
      )}

      {phase === 'analysing' && (
        <>
          <LoadingState variant="detail" label={t(copy.prescription.b4AnalysingTitle, locale)} />
          <p className="type-body-strong">{t(copy.prescription.b4AnalysingTitle, locale)}</p>
          <p className="type-body-small">{t(copy.prescription.b4AnalysingBody, locale)}</p>
        </>
      )}

      {phase === 'review' && outcome && (
        <>
          {outcome.kind === 'needs_review' && (
            <InlineNotice tone="warning" title={t(copy.prescription.b4NeedsReviewNoticeTitle, locale)}>
              {t(copy.prescription.b4NeedsReviewNoticeBody, locale)}
            </InlineNotice>
          )}
          <h2 className="type-h2">{t(copy.prescription.b4ReviewHeading, locale)}</h2>
          <Card className="flex flex-col gap-2">
            {reviewRow(t(copy.prescription.rxGenericLabel, locale), drug?.genericName, 'genericName')}
            {reviewRow(t(copy.prescription.rxBrandLabel, locale), drug?.brandName, 'brandName')}
            {reviewRow(t(copy.prescription.rxStrengthLabel, locale), strength, 'strengthMg')}
            {reviewRow(t(copy.prescription.rxFrequencyLabel, locale), outcome.prescription.frequencyPerDay, 'frequencyPerDay')}
            {reviewRow(t(copy.prescription.rxDoseTimesLabel, locale), formatDoseTimes(outcome.prescription.doseTimes, locale), 'doseTimes')}
            {reviewRow(
              t(copy.prescription.rxStartDateLabel, locale),
              outcome.prescription.startDate ? formatDate(outcome.prescription.startDate, locale) : null,
              'startDate',
            )}
            {reviewRow(t(copy.prescription.rxDurationLabel, locale), formatDurationDays(outcome.prescription.durationDays, locale))}
            {reviewRow(t(copy.prescription.rxPatternLabel, locale), patternLabel(outcome.prescription.dosingPattern, locale))}
          </Card>
          <p className="type-caption">{t(copy.prescription.b4PrescriberFieldsNote, locale)}</p>
          <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleConfirm}>
            {t(copy.prescription.b4ConfirmButton, locale)}
          </Button>
        </>
      )}

      {phase === 'unreadable' && (
        <>
          <ErrorState
            title={t(copy.prescription.b4UnreadableTitle, locale)}
            description={t(copy.prescription.b4UnreadableDescription, locale)}
            onRetry={handleRetry}
            retryLabel={t(copy.prescription.b4RetryLabel, locale)}
          />
          <NavigateButton href={backHref} variant="quiet" lang={locale}>
            {t(copy.prescription.b4BackToMedicinesLabel, locale)}
          </NavigateButton>
        </>
      )}
    </div>
  );
}
