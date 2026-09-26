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
import { InlineNotice } from '@/components/ui/InlineNotice';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { savePrescriptionDraft, submitPrescriptionImage } from '@/lib/data';
import { draftFields } from './format';
import { PrescriptionFields } from './PrescriptionFields';
import { CaptureCard, ReadingCard } from './PhotoSteps';
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
  // A2: an awaited call itself failed (never reached an outcome) — the unreadable ErrorState swaps
  // in the generic photoSendFailed line instead of its usual, outcome-based description when set.
  const [sendFailed, setSendFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function handlePhotoChange(file: File | null) {
    setPhoto(file);
    if (!file) return;
    setSendFailed(false);
    setPhase('analysing');
    startTransition(() => {
      void (async () => {
        try {
          const result = await submitPrescriptionImage(patientId, file);
          if (result.kind === 'unreadable') {
            setPhase('unreadable');
            return;
          }
          setOutcome(result);
          setPhase('review');
        } catch {
          // A2: never leave the screen stuck on "analysing" — the conservative outcome, same as
          // any other unreadable answer.
          setSendFailed(true);
          setPhase('unreadable');
        }
      })();
    });
  }

  function handleRetry() {
    setPhoto(null);
    setOutcome(null);
    setSendFailed(false);
    setPhase('capture');
  }

  function handleConfirm() {
    if (!outcome) return;
    startTransition(() => {
      void (async () => {
        try {
          await savePrescriptionDraft(patientId, outcome.draftId);
          router.push(backHref);
        } catch {
          setSendFailed(true);
          setPhase('unreadable');
        }
      })();
    });
  }

  // Every field a photo can carry, read-only (never a form: the prescriber owns them). One the
  // extraction flagged keeps its own row, marked "Unclear in the photo" in one phrase, seen and heard
  // alike (audit m7); one the photo did not carry at all is named in the card's closing line.
  const uncertain = outcome?.kind === 'needs_review' ? new Set(outcome.uncertainFields) : undefined;

  return (
    <div className="flex flex-col gap-5 p-3 tablet:p-5">
      {phase === 'capture' && (
        <CaptureCard
          title={t(copy.prescription.b4CaptureTitle, locale)}
          body={t(copy.prescription.b4PrescriberFieldsNote, locale)}
          photoLabel={t(copy.prescription.b4PhotoLabel, locale)}
          photo={photo}
          onPhoto={handlePhotoChange}
          locale={locale}
        />
      )}

      {phase === 'analysing' && <ReadingCard title={t(copy.prescription.b4AnalysingTitle, locale)} body={t(copy.prescription.b4AnalysingBody, locale)} />}

      {phase === 'review' && outcome && (
        <>
          {outcome.kind === 'needs_review' && (
            <InlineNotice tone="warning" title={t(copy.prescription.b4NeedsReviewNoticeTitle, locale)}>
              {t(copy.prescription.b4NeedsReviewNoticeBody, locale)}
            </InlineNotice>
          )}
          <section className="flex flex-col gap-2">
            <h2 className="jr-group-title">{t(copy.prescription.b4ReviewHeading, locale)}</h2>
            <PrescriptionFields
              fields={draftFields(outcome.prescription, locale)}
              unclear={uncertain}
              missingTemplate={copy.prescription.b4NotInPhotoTemplate}
              locale={locale}
            />
          </section>
          <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleConfirm}>
            {t(copy.prescription.b4ConfirmButton, locale)}
          </Button>
        </>
      )}

      {phase === 'unreadable' && (
        <div className="flex flex-col items-center gap-3">
          <div className="jr-group w-full px-4">
            <ErrorState
              title={t(copy.prescription.b4UnreadableTitle, locale)}
              description={sendFailed ? t(copy.vocabulary.photoSendFailed, locale) : t(copy.prescription.b4UnreadableDescription, locale)}
              onRetry={handleRetry}
              retryLabel={t(copy.prescription.b4RetryLabel, locale)}
            />
          </div>
          <NavigateButton href={backHref} variant="quiet" lang={locale}>
            {t(copy.prescription.b4BackToMedicinesLabel, locale)}
          </NavigateButton>
        </div>
      )}
    </div>
  );
}
