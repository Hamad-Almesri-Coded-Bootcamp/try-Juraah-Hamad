'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/session';
import { HAWIATI_COUNTDOWN_SECONDS } from '@/lib/config';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Countdown } from '@/components/ui/Countdown';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { TextField } from '@/components/ui/TextField';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { SignInOutcome } from '@/types/views';
import { wait } from './wait';

/**
 * A1 — sign-in / identity verification (mock). One Civil ID field; only the seed's twelve test IDs
 * resolve to anything (ROLES.md). `signIn` itself decides the outcome (steps 1–4); this component
 * only adds the "open the Hawiati app and approve" ritual on top of a valid ID (step 5) before
 * acting on the outcome, and never routes anywhere for `not_in_test_list`.
 *
 * `no_claims` renders the SAME static copy regardless of which Civil ID produced it — the branch
 * below never reads or displays the value the visitor typed, which is what keeps a no-account ID
 * (`277091900873`) and a no-role account (منى, طلال, دلال) byte-identical (rule 6 / G9).
 */
const APPROVAL_DELAY_MS = 1500;
const COMPLETED_DISPLAY_MS = 600;

type Phase = 'form' | 'countdown' | 'no_claims';

export function SignInForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [civilId, setCivilId] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>('form');
  const [countdownState, setCountdownState] = useState<'running' | 'completed' | 'lapsed'>('running');
  const [pending, startTransition] = useTransition();
  const cancelledRef = useRef(false);

  function resolveDestination(outcome: Extract<SignInOutcome, { kind: 'no_claims' | 'pending_invitation_only' | 'single_role' | 'multiple_roles' }>) {
    switch (outcome.kind) {
      case 'no_claims':
        setPhase('no_claims');
        return;
      case 'pending_invitation_only':
        router.push(`/${locale}/invitation`);
        return;
      case 'single_role':
        // A0 resolves the shell home (and بدر's onboarding redirect) from the session it just wrote.
        router.push(`/${locale}/gate`);
        return;
      case 'multiple_roles':
        router.push(`/${locale}/signin/choose`);
    }
  }

  /** One attempt: classify the ID, then — for anything but `not_in_test_list` — run the visible
   * "open the app and approve" wait (step 5, ROLES.md) before acting on the outcome. Shared by the
   * initial submit and by retrying a lapsed countdown against the same ID. */
  function attempt() {
    cancelledRef.current = false;
    startTransition(() => {
      void (async () => {
        const outcome = await signIn(civilId);
        if (cancelledRef.current) return;
        if (outcome.kind === 'not_in_test_list') {
          setPhase('form');
          setFieldError(t(copy.identity.invalidIdError, locale));
          return;
        }
        setPhase('countdown');
        setCountdownState('running');
        await wait(APPROVAL_DELAY_MS);
        if (cancelledRef.current) return;
        setCountdownState('completed');
        await wait(COMPLETED_DISPLAY_MS);
        if (cancelledRef.current) return;
        resolveDestination(outcome);
      })();
    });
  }

  function handleSubmit() {
    if (!civilId || pending) return;
    attempt();
  }

  function handleCancel() {
    cancelledRef.current = true;
    setPhase('form');
    setCountdownState('running');
  }

  function handleLapse() {
    setCountdownState('lapsed');
  }

  function handleRetry() {
    attempt();
  }

  return (
    <div className="mx-auto flex max-w-content flex-col gap-4 p-3 tablet:p-5">
      {phase === 'form' && (
        <>
          <div className="flex flex-col gap-2">
            <span className="type-caption">{t(copy.identity.signInKicker, locale)}</span>
            <h1 className="type-h1">{t(copy.identity.signInTitle, locale)}</h1>
            <p className="type-body">{t(copy.identity.signInBody, locale)}</p>
          </div>
          <TextField
            label={t(copy.identity.civilIdLabel, locale)}
            value={civilId}
            onChange={(e) => {
              setCivilId(e.target.value);
              setFieldError(undefined);
            }}
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            helperText={t(copy.identity.civilIdHelper, locale)}
            error={fieldError}
            lang={locale}
          />
          {fieldError && <p className="type-caption">{t(copy.identity.invalidIdHint, locale)}</p>}
          <Button variant="primary" size="lg" fullWidth icon="shield" lang={locale} loading={pending} disabled={!civilId} onClick={handleSubmit}>
            {t(copy.identity.continueLabel, locale)}
          </Button>
          <Link href={`/${locale}`} className="wsf-btn wsf-btn--quiet wsf-focus type-label">
            {t(copy.identity.backToLanding, locale)}
          </Link>
        </>
      )}

      {phase === 'countdown' && (
        <Card className="flex flex-col items-center gap-3">
          <Countdown
            seconds={HAWIATI_COUNTDOWN_SECONDS}
            state={countdownState}
            label={t(copy.identity.countdownLabel, locale)}
            onLapse={handleLapse}
            onRetry={handleRetry}
            onCancel={handleCancel}
            cancelLabel={t(copy.identity.cancelLabel, locale)}
            retryLabel={t(copy.vocabulary.retry, locale)}
            lang={locale}
          />
        </Card>
      )}

      {phase === 'no_claims' && (
        <div data-testid="no-claims" className="flex flex-col gap-4">
          <InlineNotice tone="info" title={t(copy.identity.noClaimsTitle, locale)}>
            {t(copy.identity.noClaimsBody, locale)}
          </InlineNotice>
          <Card className="flex flex-col gap-2">
            <span className="type-body-strong">{t(copy.identity.noClaimsCardTitle, locale)}</span>
            <span className="type-body-small">{t(copy.identity.noClaimsCardBody, locale)}</span>
          </Card>
          <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={() => router.push(`/${locale}`)}>
            {t(copy.identity.backToLanding, locale)}
          </Button>
        </div>
      )}
    </div>
  );
}
