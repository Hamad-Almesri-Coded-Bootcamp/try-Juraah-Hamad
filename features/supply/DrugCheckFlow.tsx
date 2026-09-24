'use client';

/**
 * C3 — travel / photo drug check (`/[locale]/app/safety/check`), pushed from C1. idle → analysing →
 * result | could_not_identify, mirroring `features/prescription/AddPrescriptionFlow.tsx`'s own
 * capture/analysing/outcome shape (B4, the closest sibling screen) as closely as the two screens'
 * different outcomes allow.
 *
 * Every outcome comes from `checkDrugPhoto` (this component adds no screening logic of its own, per
 * the brief). An `interaction_found` verdict with an `alertId` hands off to C2's own route for the
 * finding itself; this screen renders a summary `InteractionAlert` (severity="danger") that says the
 * risk, what to do now and, since the Daylight pass, who is checking it: the linked alert's own
 * `reviewStatus`, read once through the published seam (`getAlert`, no contract change) and shown in
 * the fixed vocabulary. Never the alert's citation, reviewer note or decision: that is C2's job alone.

 * could_not_identify is an explicit, honest state (ErrorState) — never a guessed drug — and creates
 * no record: `checkDrugPhoto` only reads the store in that branch (lib/data/index.ts), so nothing
 * here needs to undo anything.
 *
 * Maps onto G7's four states as: empty = idle, nothing chosen yet · loading = analysing · content =
 * result · error = could_not_identify, drawn with the real ErrorState (mirrors B4's own mapping).
 */
import { useRef, useState, useTransition } from 'react';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { InteractionAlert } from '@/components/ui/InteractionAlert';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { Monogram } from '@/components/ui/Monogram';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { CaptureCard, ReadingCard } from '@/features/prescription/PhotoSteps';
import { checkDrugPhoto, getAlert } from '@/lib/data';
import { localizeDrugName } from '@/i18n/localize';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { InteractionAlert as InteractionAlertRecord } from '@/types/contracts';
import type { DrugCheckOutcome } from '@/types/views';

type Phase = 'capture' | 'analysing' | 'result' | 'could_not_identify';

export function DrugCheckFlow({ locale, patientId, backHref }: { locale: Locale; patientId: string; backHref: string }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('capture');
  const [outcome, setOutcome] = useState<Extract<DrugCheckOutcome, { kind: 'identified' }> | null>(null);
  // Who is checking the finding (UX §8, part three): the linked alert's own review state, read
  // through the published seam after the check (`getAlert`), never guessed.
  const [reviewStatus, setReviewStatus] = useState<InteractionAlertRecord['reviewStatus'] | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  // A fresh photo, not the outcome of an earlier check — never reused across submissions.
  const requestSeq = useRef(0);

  function handlePhotoChange(file: File | null) {
    setPhoto(file);
    if (!file) return;
    const seq = ++requestSeq.current;
    setPhase('analysing');
    startTransition(() => {
      void (async () => {
        const result = await checkDrugPhoto(patientId, file);
        if (seq !== requestSeq.current) return; // superseded by a later photo
        if (result.kind === 'could_not_identify') {
          setPhase('could_not_identify');
          return;
        }
        let status: InteractionAlertRecord['reviewStatus'] | undefined;
        if (result.verdict === 'interaction_found' && result.alertId) {
          const alert = await getAlert(result.alertId);
          if (seq !== requestSeq.current) return;
          status = alert?.reviewStatus;
        }
        setReviewStatus(status);
        setOutcome(result);
        setPhase('result');
      })();
    });
  }

  function handleRetry() {
    setPhoto(null);
    setOutcome(null);
    setReviewStatus(undefined);
    setPhase('capture');
  }

  const drugName = outcome ? localizeDrugName(outcome.drugName, locale) : '';

  return (
    <div className="flex flex-col gap-5 p-3 tablet:p-5">
      {phase === 'capture' && (
        <CaptureCard
          title={t(copy.supply.c3CaptureTitle, locale)}
          body={t(copy.supply.c3CaptureBody, locale)}
          photoLabel={t(copy.supply.c3PhotoLabel, locale)}
          photo={photo}
          onPhoto={handlePhotoChange}
          locale={locale}
        />
      )}

      {phase === 'analysing' && <ReadingCard title={t(copy.supply.c3AnalysingTitle, locale)} body={t(copy.supply.c3AnalysingBody, locale)} />}

      {phase === 'result' && outcome && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="jr-group-title">{t(copy.supply.c3ResultHeading, locale)}</h2>
            <div className="jr-group flex items-center gap-4 p-4">
              <Monogram name={drugName} />
              <div className="flex min-w-0 flex-col">
                <span className="type-body-small text-ink-muted">{t(copy.supply.c3DrugLabel, locale)}</span>
                <span className="jr-display type-body-strong text-navy">{drugName}</span>
                <span className="type-body-small text-ink-muted">{t(copy.supply.c3ScreenedAgainstNote, locale)}</span>
              </div>
            </div>
          </section>

          {outcome.verdict === 'no_interaction' && (
            <InlineNotice tone="success" title={t(copy.supply.c3NoInteractionTitle, locale)}>
              {t(copy.supply.c3NoInteractionBody, locale)}
            </InlineNotice>
          )}

          {/* CR-066: the agent can find an interaction without raising an alert (a warning-level
              finding, a drug already taken). The finding is still shown — never a blank result. */}
          {outcome.verdict === 'interaction_found' && !outcome.alertId && (
            <InteractionAlert severity="warning" title={drugName} description={t(copy.supply.c3InteractionNoDetailsDescription, locale)} lang={locale} />
          )}

          {/* The finding in the three-part shape (UX §8): the risk, what to do now, and who is
              checking it (the alert's own review state, in the fixed vocabulary). The detail itself
              is C2's; this only opens it. */}
          {outcome.verdict === 'interaction_found' && outcome.alertId && (
            <InteractionAlert
              severity="danger"
              reviewStatus={reviewStatus}
              title={drugName}
              description={t(copy.supply.c3InteractionDescription, locale)}
              lang={locale}
              actions={
                <NavigateButton href={`/${locale}/app/safety/${outcome.alertId}`} variant="secondary" icon="shield" lang={locale}>
                  {t(copy.supply.c3OpenInteractionButton, locale)}
                </NavigateButton>
              }
            />
          )}

          <Button variant="secondary" icon="camera" fullWidth lang={locale} onClick={handleRetry} disabled={pending}>
            {t(copy.supply.c3CheckAnotherButton, locale)}
          </Button>
        </>
      )}

      {phase === 'could_not_identify' && (
        <div className="flex flex-col items-center gap-3">
          <div className="jr-group w-full px-4">
            <ErrorState
              title={t(copy.supply.c3CouldNotIdentifyTitle, locale)}
              description={t(copy.supply.c3CouldNotIdentifyBody, locale)}
              onRetry={handleRetry}
              retryLabel={t(copy.supply.c3CouldNotIdentifyRetryLabel, locale)}
            />
          </div>
          <NavigateButton href={backHref} variant="quiet" lang={locale}>
            {t(copy.safety.c1BackLabel, locale)}
          </NavigateButton>
        </div>
      )}
    </div>
  );
}
