'use client';

/**
 * X0 — clinic entry (`/clinic`), Civil ID sign-in: "same simulation, same states as A1" (SCREENS.md)
 * — the empty/countdown/lapsed/retry states and the kept-input-on-error behaviour are the same
 * ritual A1 runs, reusing `@/features/identity/wait` and `HAWIATI_COUNTDOWN_SECONDS` so the timing
 * is identical, never re-implemented.
 *
 * Reuse note (DEPENDENCIES): `features/identity/SignInForm.tsx` hardcodes its post-approval
 * destinations (`/${locale}/gate`, `/${locale}/signin/choose`) rather than taking a destination or
 * outcome callback, so it cannot be reused as-is for X0's different `multiple_roles` destination
 * (`/clinic/choose`, not `/signin/choose`) or for the extra "is this even a clinic role" refusal
 * step below. Reported in the WP4i report; this component composes the same states from the same
 * ui primitives (`TextField`, `Button`, `Countdown`, `InlineNotice`) instead.
 *
 * Rule 6 / G9, and the brief's own wording: a non-clinic ID (no claims at all, a pending-invitation
 * -only claim, or a resolved patient/caregiver role) is meant to be refused with the SAME wording as
 * A1's `no_claims` — imported verbatim from `copy.identity`, never redefined here. That works exactly
 * as designed for `no_claims` (`signIn` writes no cookie at all for it, so nothing outside this
 * component ever reacts to it). It does NOT reach the user for `pending_invitation_only` or a
 * non-clinic `single_role`/`multiple_roles` outcome — logged as CR-039 in `docs/DECISIONS.md` and
 * `docs/backend-notes/wp4i.md` §3/§7, and reported rather than silently worked around, since the
 * cause sits entirely outside this bundle's files:
 *
 * `signIn` writes a session cookie for those three outcomes as part of the SAME request/response that
 * resolves the call (`lib/session/index.ts`). Setting a cookie inside a Server Function lets Next.js
 * return fresh server-rendered UI for the current route in that same round trip
 * (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`), and this project's
 * OWN existing, cross-bundle infrastructure reacts to that fresh cookie before this component's
 * `resolveDestination` ever runs: `proxy.ts`'s `pendingInvitationOnly` rule and the clinic layout's own
 * `isEntry` check (`app/[locale]/clinic/layout.tsx`, "do not edit" per this bundle's file list) both
 * redirect a non-clinic session away from `/clinic` — measured at well under one second, faster than
 * the ~2.1s Hawiati countdown this component still shows. By the time `resolveDestination` would run,
 * the browser has usually already left this page. This component still implements the intended
 * refusal for when that changes (only `no_claims` observably reaches it today), but no longer calls
 * `signOut` for the other three cases — an earlier version did, and since the browser had by then
 * already moved on to the person's own legitimate shell, that stale call actively signed them back out
 * of it. Left uncalled here, that harm cannot recur; the pre-existing redirects are unaffected either
 * way, since they fire before any of this component's own code — signOut included — gets a chance to.
 */
import { useRef, useState, useTransition } from 'react';
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
import { wait } from '@/features/identity/wait';

const APPROVAL_DELAY_MS = 1500;
const COMPLETED_DISPLAY_MS = 600;

type Phase = 'form' | 'countdown' | 'refused';

const CLINIC_ROLES = new Set(['reviewer', 'admin']);

export function ClinicSignInForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [civilId, setCivilId] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>('form');
  const [countdownState, setCountdownState] = useState<'running' | 'completed' | 'lapsed'>('running');
  const [pending, startTransition] = useTransition();
  const cancelledRef = useRef(false);

  function resolveDestination(outcome: Extract<SignInOutcome, { kind: 'no_claims' | 'pending_invitation_only' | 'single_role' | 'multiple_roles' }>) {
    if (outcome.kind === 'no_claims') {
      setPhase('refused');
      return;
    }
    if (outcome.kind === 'pending_invitation_only') {
      // Intended behaviour once CR-039 is fixed upstream: refuse, never leave a clinic-door attempt
      // signed into F0's pending claim. Today, proxy.ts's own pendingInvitationOnly rule has already
      // redirected the browser to /invitation before this line runs (see the doc comment above) — no
      // `signOut` call here, since one used to fire against whatever page the browser had *already*
      // moved on to, signing that page back out from under the person.
      setPhase('refused');
      return;
    }
    if (outcome.kind === 'single_role') {
      if (CLINIC_ROLES.has(outcome.session.role ?? '')) {
        router.push(`/${locale}/gate`);
        return;
      }
      // Intended behaviour once CR-039 is fixed upstream: refuse a patient/caregiver-only ID rather
      // than let them in. Today, the clinic layout's own isEntry check has already redirected the
      // browser to /gate (then that role's own shell) before this line runs — same reasoning as above.
      setPhase('refused');
      return;
    }
    // multiple_roles — in this seed, exactly a reviewer+admin account (د. خالد); guarded anyway.
    if (outcome.options.every((o) => CLINIC_ROLES.has(o.role))) {
      router.push(`/${locale}/clinic/choose`);
      return;
    }
    setPhase('refused');
  }

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

  function handleTryAnother() {
    setCivilId('');
    setFieldError(undefined);
    setPhase('form');
  }

  return (
    <div className="mx-auto flex max-w-content flex-col gap-4 p-3 tablet:p-5">
      {phase === 'form' && (
        <>
          <div className="flex flex-col gap-2">
            <span className="type-caption">{t(copy.clinic.x0Kicker, locale)}</span>
            <h1 className="type-h1">{t(copy.clinic.x0Title, locale)}</h1>
            <p className="type-body">{t(copy.clinic.x0Body, locale)}</p>
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
          <Button variant="primary" size="lg" fullWidth icon="shield" lang={locale} loading={pending} disabled={!civilId} onClick={handleSubmit}>
            {t(copy.identity.continueLabel, locale)}
          </Button>
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

      {phase === 'refused' && (
        <div data-testid="clinic-refused" className="flex flex-col gap-4">
          <InlineNotice tone="info" title={t(copy.identity.noClaimsTitle, locale)}>
            {t(copy.identity.noClaimsBody, locale)}
          </InlineNotice>
          <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={handleTryAnother}>
            {t(copy.clinic.x0TryAnotherNumber, locale)}
          </Button>
        </div>
      )}
    </div>
  );
}
