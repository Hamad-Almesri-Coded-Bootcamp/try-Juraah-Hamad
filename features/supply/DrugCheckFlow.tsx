'use client';

/**
 * C3 — travel / photo drug check (`/[locale]/app/safety/check`), pushed from C1. idle → analysing →
 * result | could_not_identify, mirroring `features/prescription/AddPrescriptionFlow.tsx`'s own
 * capture/analysing/outcome shape (B4, the closest sibling screen) as closely as the two screens'
 * different outcomes allow.
 *
 * Every outcome comes from `checkDrugPhoto` alone (docs/SCREENS.md C3 row lists no other data
 * function) — this component adds no screening logic of its own, per the brief. An
 * `interaction_found` verdict hands off to C2's own route for the finding itself: the mock only ever
 * sets this verdict when a `danger`-severity alert exists for the identified prescription
 * (lib/data/index.ts's own `checkDrugPhoto`), so this screen renders a summary `InteractionAlert`
 * (severity="danger", no `reviewStatus` — this screen genuinely does not know it, having called only
 * `checkDrugPhoto`) and a button into C2, never the alert's citation, reviewer note or decision —
 * that is C2's job alone (never re-implemented here).
 *
 * could_not_identify is an explicit, honest state (ErrorState) — never a guessed drug — and creates
 * no record: `checkDrugPhoto` only reads the store in that branch (lib/data/index.ts), so nothing
 * here needs to undo anything.
 *
 * Maps onto G7's four states as: empty = idle, nothing chosen yet · loading = analysing · content =
 * result · error = could_not_identify, drawn with the real ErrorState (mirrors B4's own mapping).
 */
import { useRef, useState, useTransition } from 'react';
import { PhotoInput } from '@/components/ui/PhotoInput';
import { LoadingState } from '@/components/ui/LoadingState';
import { Card } from '@/components/ui/Card';
import { DetailRow } from '@/components/ui/DetailRow';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { InteractionAlert } from '@/components/ui/InteractionAlert';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { checkDrugPhoto } from '@/lib/data';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { DrugCheckOutcome } from '@/types/views';

type Phase = 'capture' | 'analysing' | 'result' | 'could_not_identify';

export function DrugCheckFlow({ locale, patientId, backHref }: { locale: Locale; patientId: string; backHref: string }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('capture');
  const [outcome, setOutcome] = useState<Extract<DrugCheckOutcome, { kind: 'identified' }> | null>(null);
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
        setOutcome(result);
        setPhase('result');
      })();
    });
  }

  function handleRetry() {
    setPhoto(null);
    setOutcome(null);
    setPhase('capture');
  }

  return (
    <div className="flex flex-col gap-4 p-3 tablet:p-5">
      {phase === 'capture' && <PhotoInput value={photo} onChange={handlePhotoChange} label={t(copy.supply.c3PhotoLabel, locale)} lang={locale} />}

      {phase === 'analysing' && (
        <>
          <LoadingState variant="detail" label={t(copy.supply.c3AnalysingTitle, locale)} />
          <p className="type-body-strong">{t(copy.supply.c3AnalysingTitle, locale)}</p>
          <p className="type-body-small">{t(copy.supply.c3AnalysingBody, locale)}</p>
        </>
      )}

      {phase === 'result' && outcome && (
        <>
          <h2 className="type-h2">{t(copy.supply.c3ResultHeading, locale)}</h2>
          <Card className="flex flex-col gap-2">
            <DetailRow label={t(copy.supply.c3DrugLabel, locale)} value={outcome.drugName} lang={locale} />
          </Card>
          <p className="type-caption">{t(copy.supply.c3ScreenedAgainstNote, locale)}</p>

          {outcome.verdict === 'no_interaction' && (
            <InlineNotice tone="success" title={t(copy.supply.c3NoInteractionTitle, locale)}>
              {t(copy.supply.c3NoInteractionBody, locale)}
            </InlineNotice>
          )}

          {outcome.verdict === 'interaction_found' && outcome.alertId && (
            <InteractionAlert
              severity="danger"
              title={outcome.drugName}
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
        <>
          <ErrorState
            title={t(copy.supply.c3CouldNotIdentifyTitle, locale)}
            description={t(copy.supply.c3CouldNotIdentifyBody, locale)}
            onRetry={handleRetry}
            retryLabel={t(copy.supply.c3CouldNotIdentifyRetryLabel, locale)}
          />
          <NavigateButton href={backHref} variant="quiet" lang={locale}>
            {t(copy.safety.c1BackLabel, locale)}
          </NavigateButton>
        </>
      )}
    </div>
  );
}
