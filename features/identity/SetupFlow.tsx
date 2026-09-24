'use client';

import { Suspense, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { updateSettings, completeOnboarding, requestPushPermission, startMessagingLink } from '@/lib/data';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { Icon, type IconName } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/LoadingState';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { InviteSheet } from '@/features/caregiving/InviteSheet';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

export interface SetupFlowProps {
  locale: Locale;
  patientId: string;
  initialLanguage: 'ar' | 'en';
}

const LAST_STEP = 3;

function clampStep(value: string | null): number {
  const n = Number(value ?? '0');
  return Number.isInteger(n) && n >= 0 && n <= LAST_STEP ? n : 0;
}

/**
 * A2 — first-run setup (D-008: `useSearchParams` always under Suspense). Runs once while
 * `onboardingCompleted` is false (`SetupPage` redirects away once it is true). The step lives in
 * the URL's `?step=` — a session-neutral place, per the brief ("no new storage mechanism") — so
 * reloading, sharing the link, or going back returns to the same step rather than restarting.
 *
 * Daylight (CR-071): no chrome and no assistant (the app layout marks this route `data-no-assistant`),
 * only the wordmark and the language switch in a light bar, the step indicator, and each step's
 * question as the screen's one h1. The three reminder offers are three equal cards with three equal
 * buttons, "Later" among them (UX §2/§13); inviting a caregiver and skipping are drawn equal too.
 */
function SetupBar({ locale, patientId }: { locale: Locale; patientId?: string }) {
  return (
    <header className="flex min-h-hit-lg items-center gap-2 px-3 pt-2 tablet:px-5 tablet:pt-4">
      <span className="jr-wordmark flex-1">{t(copy.shell.appName, locale)}</span>
      <LanguageSwitch locale={locale} role={patientId ? 'patient' : undefined} subjectId={patientId} assistant={false} />
    </header>
  );
}

const BODY = 'mx-auto flex w-full max-w-content flex-col gap-5 px-3 pb-5 pt-4 tablet:px-5 tablet:pt-6';
export function SetupFlow(props: SetupFlowProps) {
  return (
    <Suspense fallback={<SetupFlowSkeleton locale={props.locale} />}>
      <SetupFlowInner {...props} />
    </Suspense>
  );
}

function SetupFlowSkeleton({ locale }: { locale: Locale }) {
  return (
    <div className="relative flex min-h-full flex-col">
      <SetupBar locale={locale} />
      <div className={BODY}>
        <LoadingState variant="detail" label={t(copy.vocabulary.loading, locale)} />
      </div>
    </div>
  );
}

function SetupFlowInner({ locale, patientId, initialLanguage }: SetupFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = clampStep(searchParams.get('step'));
  const [language, setLanguage] = useState<'ar' | 'en'>(initialLanguage);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const steps = [
    t(copy.identity.setupStepLanguage, locale),
    t(copy.identity.setupStepNotifications, locale),
    t(copy.identity.setupStepInvite, locale),
    t(copy.identity.setupStepClosing, locale),
  ];

  function goToStep(next: number) {
    router.push(`/${locale}/app/setup?step=${next}`);
  }

  function handleLanguageContinue() {
    startTransition(() => {
      void (async () => {
        await updateSettings(patientId, { language });
        goToStep(1);
      })();
    });
  }

  function handleBrowserOffer() {
    startTransition(() => {
      void (async () => {
        await requestPushPermission({ subjectType: 'patient', subjectId: patientId });
        goToStep(2);
      })();
    });
  }

  function handleTelegramOffer() {
    startTransition(() => {
      void (async () => {
        await startMessagingLink({ subjectType: 'patient', subjectId: patientId });
        goToStep(2);
      })();
    });
  }

  function handleLaterOffer() {
    goToStep(2);
  }

  function handleSkipInvite() {
    goToStep(3);
  }

  function handleFinish() {
    startTransition(() => {
      void (async () => {
        await completeOnboarding(patientId);
        router.push(`/${locale}/app`);
      })();
    });
  }

  const offers: ReadonlyArray<{ icon: IconName; title: string; body: string; button: string; onClick: () => void; busy: boolean }> = [
    {
      icon: 'bell',
      title: t(copy.identity.browserOfferTitle, locale),
      body: t(copy.identity.browserOfferBody, locale),
      button: t(copy.identity.browserOfferButton, locale),
      onClick: handleBrowserOffer,
      busy: pending,
    },
    {
      icon: 'link',
      title: t(copy.identity.telegramOfferTitle, locale),
      body: t(copy.identity.telegramOfferBody, locale),
      button: t(copy.identity.telegramOfferButton, locale),
      onClick: handleTelegramOffer,
      busy: pending,
    },
    {
      icon: 'clock',
      title: t(copy.identity.laterOfferTitle, locale),
      body: t(copy.identity.laterOfferBody, locale),
      button: t(copy.identity.laterOfferButton, locale),
      onClick: handleLaterOffer,
      busy: false,
    },
  ];

  return (
    <div className="relative flex min-h-full flex-col">
      <SetupBar locale={locale} patientId={patientId} />
      <div className={BODY}>
        <StepIndicator steps={steps} current={step} label={t(copy.identity.setupProgressLabel, locale)} lang={locale} />

        {step === 0 && (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="type-h1 m-0 text-navy">{t(copy.identity.languageStepTitle, locale)}</h1>
              <p className="type-body m-0 text-ink-muted">{t(copy.identity.languageStepBody, locale)}</p>
            </div>
            <ChoiceGroup
              variant="segmented"
              name="setup-language"
              label={t(copy.identity.languageFieldLabel, locale)}
              value={language}
              onChange={(next) => setLanguage(next === 'en' ? 'en' : 'ar')}
              options={[
                { value: 'ar', label: t(copy.identity.languageOptionAr, locale) },
                { value: 'en', label: t(copy.identity.languageOptionEn, locale) },
              ]}
            />
            <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleLanguageContinue}>
              {t(copy.identity.continueLabel, locale)}
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="type-h1 m-0 text-navy">{t(copy.identity.notificationsStepTitle, locale)}</h1>
              <p className="type-body m-0 text-ink-muted">{t(copy.identity.notificationsStepBody, locale)}</p>
            </div>
            {/* Three legitimate paths, three EQUAL cards and buttons: same variant, size and width, none
                of them primary, "Later" an ordinary choice among them (UX §2/§13, audit M2). */}
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {offers.map((offer) => (
                <li key={offer.icon}>
                  {/* A column at phone width; from 834px a row, the button in a fixed-width slot so the
                      three stay the same width. */}
                  <Card className="flex flex-col items-start gap-3 p-4 tablet:grid tablet:grid-cols-[auto_minmax(0,1fr)_auto] tablet:items-center tablet:gap-x-4 tablet:gap-y-1">
                    <span className="jr-fact__icon inline-flex items-center justify-center tablet:row-span-2" aria-hidden="true">
                      <Icon name={offer.icon} />
                    </span>
                    <h2 className="type-h2 m-0 text-navy tablet:col-start-2">{offer.title}</h2>
                    <p className="type-body-small m-0 text-ink-muted tablet:col-start-2">{offer.body}</p>
                    <div className="w-full tablet:col-start-3 tablet:row-span-2 tablet:row-start-1 tablet:w-rail-wide">
                      <Button variant="secondary" size="lg" fullWidth lang={locale} loading={offer.busy} onClick={offer.onClick}>
                        {offer.button}
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
            <p className="type-body-small m-0 text-ink-muted">{t(copy.identity.equalWeightNote, locale)}</p>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="type-h1 m-0 text-navy">{t(copy.identity.inviteStepTitle, locale)}</h1>
              <p className="type-body m-0 text-ink-muted">{t(copy.identity.inviteStepBody, locale)}</p>
            </div>
            {/* Cross-bundle contract (WP4b brief, wired by the lead at the wave-1 gate): the invite
                step mounts bundle h's InviteSheet — the same two-step flow F1 uses. onDone fires
                whether the person invited or backed out, so it only closes the sheet; the person
                continues (or skips) the step themselves. Inviting and "not now" are drawn equal: a
                later is a legitimate answer (UX §2). */}
            <ul className="jr-group m-0 flex list-none flex-col p-0">
              {(
                [
                  ['users', copy.identity.inviteWhatTheySee],
                  ['shield', copy.identity.inviteWhatTheyCannot],
                ] as const
              ).map(([icon, line], i) => (
                <li key={icon} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <span className="mt-1 text-navy" aria-hidden="true">
                    <Icon name={icon} />
                  </span>
                  <span className="type-body text-navy">{t(line, locale)}</span>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 tablet:grid-cols-2">
              <Button variant="secondary" size="lg" fullWidth icon="users" lang={locale} onClick={() => setInviteOpen(true)}>
                {t(copy.identity.inviteOpenLabel, locale)}
              </Button>
              <Button variant="secondary" size="lg" fullWidth icon="clock" lang={locale} onClick={handleSkipInvite}>
                {t(copy.identity.skipInviteLabel, locale)}
              </Button>
            </div>
            {inviteOpen && <InviteSheet patientId={patientId} locale={locale} onDone={() => setInviteOpen(false)} />}
          </>
        )}

        {step === 3 && (
          <>
            <div className="flex flex-col items-start gap-3">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-navy text-on-fill" aria-hidden="true">
                <Icon name="check" />
              </span>
              <h1 className="type-h1 m-0 text-navy">{t(copy.identity.closingStepTitle, locale)}</h1>
              <p className="type-body m-0 text-ink-muted">{t(copy.identity.closingStepBody, locale)}</p>
            </div>
            <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleFinish}>
              {t(copy.identity.finishSetupLabel, locale)}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
