'use client';

import { useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/session';
import { HAWIATI_COUNTDOWN_SECONDS } from '@/lib/config';
import { Brand } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import { formatNumber } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import type { SignInOutcome } from '@/types/views';
import { ApprovalWait } from './ApprovalWait';
import { wait } from './wait';
import { CIVIL_ID_ERROR_COPY, civilIdProblem, normaliseCivilId, type CivilIdFieldError } from './civilId';

/**
 * A1 — sign-in / identity verification (mock). One Civil ID field; only the seed's twelve test IDs
 * resolve to anything (ROLES.md). `signIn` itself decides the outcome (steps 1–4); this component
 * only adds the "open the Hawiati app and approve" ritual on top of a valid ID (step 5) before
 * acting on the outcome, and never routes anywhere for `not_in_test_list`.
 *
 * `no_claims` renders the SAME static copy regardless of which Civil ID produced it — the branch
 * below never reads or displays the value the visitor typed, which is what keeps a no-account ID
 * (`277091900873`) and a no-role account (منى, طلال, دلال) byte-identical (rule 6 / G9).
 *
 * Daylight (CR-071, V2SignIn / V2SignInWait): a navy sky with the wordmark and the tagline, then a
 * sheet with the one h1, the Civil ID field, the primary Continue and three small numbered steps.
 * The wait is the whole sky (`ApprovalWait`). From 1440px the sky and the sheet stand side by side.
 * `actions` is the bar's assistant and language switch, rendered by the page (it knows the session).
 */
const APPROVAL_DELAY_MS = 1500;
const COMPLETED_DISPLAY_MS = 600;
type Phase = 'form' | 'countdown' | 'no_claims';

export function SignInForm({ locale, actions }: { locale: Locale; actions?: ReactNode }) {
  const router = useRouter();
  const [civilId, setCivilId] = useState('');
  const [fieldError, setFieldError] = useState<CivilIdFieldError | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>('form');
  const [countdownState, setCountdownState] = useState<'running' | 'completed' | 'lapsed'>('running');
  const [pending, startTransition] = useTransition();
  const cancelledRef = useRef(false);
  const attemptedIdRef = useRef('');

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
  function attempt(id: string) {
    cancelledRef.current = false;
    attemptedIdRef.current = id;
    startTransition(() => {
      void (async () => {
        const outcome = await signIn(id);
        if (cancelledRef.current) return;
        if (outcome.kind === 'not_in_test_list') {
          setPhase('form');
          setFieldError('not_in_test_list');
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

  /** The form's action — a client function, so React blocks a native submit before hydration (a
   * tap on a slow phone would otherwise reload the page and drop what was typed). */
  function handleSubmit() {
    if (pending) return;
    const id = normaliseCivilId(civilId);
    const problem = civilIdProblem(id);
    if (problem) {
      setFieldError(problem);
      return;
    }
    attempt(id);
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
    attempt(attemptedIdRef.current);
  }

  const steps = [copy.identity.signInStep1, copy.identity.signInStep2, copy.identity.signInStep3];

  if (phase === 'countdown') {
    return (
      <div className="flex flex-1 flex-col">
        <ApprovalWait
          seconds={HAWIATI_COUNTDOWN_SECONDS}
          state={countdownState}
          onLapse={handleLapse}
          onRetry={handleRetry}
          onCancel={handleCancel}
          locale={locale}
          actions={actions}
          className="flex-1 tablet:mb-4"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col desktop:grid desktop:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      {/* The sky: the wordmark, the tagline and the plain note that this sign-in is a simulation. */}
      <header className="jr-sky pb-6 tablet:pb-5 desktop:mb-4 desktop:justify-between">
        <div className="jr-sky__top">
          <span className="flex-1" />
          {actions}
        </div>
        <div className="flex flex-col gap-1 pt-4 tablet:pt-2">
          <Brand name={t(copy.shell.appName, locale)} className="jr-display text-display desktop:text-[3.5rem] desktop:leading-[4.25rem]" />
          <span className="jr-sky__subtitle">{t(copy.identity.signInTitle, locale)}</span>
        </div>
        <p className="jr-sky__eyebrow type-body-small m-0 flex items-center gap-2">
          <Icon name="info" small />
          {t(copy.identity.signInKicker, locale)}
        </p>
      </header>

      <div className="jr-sheet flex flex-col px-3 pb-5 pt-5 tablet:px-5 desktop:justify-center desktop:px-6">
        <div className="mx-auto flex w-full max-w-content flex-col gap-5">
          {phase === 'form' && (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="type-h1 m-0 text-navy">{t(screenTitles.A1, locale)}</h1>
                <p className="type-body m-0 text-ink-muted">{t(copy.identity.signInBody, locale)}</p>
              </div>
              {/* A real form: Enter submits, and Continue is never disabled-until-valid (audit M14). */}
              <form action={handleSubmit} noValidate className="flex flex-col gap-4">
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
                  error={fieldError ? t(CIVIL_ID_ERROR_COPY[fieldError], locale) : undefined}
                  lang={locale}
                />
                {fieldError === 'not_in_test_list' && <p className="type-body-small m-0 text-ink-muted">{t(copy.identity.invalidIdHint, locale)}</p>}
                <Button type="submit" variant="primary" size="lg" fullWidth icon="shield" lang={locale} loading={pending}>
                  {t(copy.identity.continueLabel, locale)}
                </Button>
              </form>
              <section aria-labelledby="signin-steps" className="flex flex-col gap-3">
                <h2 id="signin-steps" className="type-label m-0 text-center text-ink-muted">
                  {t(copy.identity.signInStepsLabel, locale)}
                </h2>
                <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0">
                  {steps.map((step, i) => (
                    <li key={step.en} className="flex flex-col items-center gap-2 text-center">
                      <span className="jr-fact__icon jr-num inline-flex items-center justify-center font-semibold" aria-hidden="true">
                        {formatNumber(i + 1, locale)}
                      </span>
                      <span className="type-body-small text-ink-muted">{t(step, locale)}</span>
                    </li>
                  ))}
                </ol>
              </section>
              <Link href={`/${locale}`} className="wsf-btn wsf-btn--quiet wsf-focus type-label self-center">
                {t(copy.identity.backToLanding, locale)}
              </Link>
            </>
          )}

          {/* The same words whichever Civil ID produced this: nothing here reads what was typed, so an ID
              with no account and an account with no role render byte for byte alike (rule 6 / G9). */}
          {phase === 'no_claims' && (
            <div data-testid="no-claims" className="flex flex-col gap-5">
              <div className="flex flex-col items-start gap-3">
                <span className="jr-fact__icon inline-flex items-center justify-center" aria-hidden="true">
                  <Icon name="info" />
                </span>
                <h1 className="type-h1 m-0 text-navy">{t(copy.identity.noClaimsTitle, locale)}</h1>
                <p className="type-body m-0 text-ink-muted">{t(copy.identity.noClaimsBody, locale)}</p>
              </div>
              <div className="jr-group flex items-start gap-3 p-4">
                <span className="inline-flex size-hit shrink-0 items-center justify-center rounded-sm bg-navy-tint text-navy" aria-hidden="true">
                  <Icon name="users" />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="type-body-strong m-0 text-navy">{t(copy.identity.noClaimsCardTitle, locale)}</p>
                  <p className="type-body-small m-0 text-ink-muted">{t(copy.identity.noClaimsCardBody, locale)}</p>
                </div>
              </div>
              <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={() => router.push(`/${locale}`)}>
                {t(copy.identity.backToLanding, locale)}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
