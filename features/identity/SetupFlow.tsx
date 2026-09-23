'use client';

import { Suspense, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { updateSettings, completeOnboarding, requestPushPermission, startMessagingLink } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { LoadingState } from '@/components/ui/LoadingState';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { InviteSheet } from '@/features/caregiving/InviteSheet';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
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
 */
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
      <AppBar title={t(screenTitles.A2, locale)} />
      <div className="mx-auto w-full max-w-content p-3 tablet:p-5">
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

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(screenTitles.A2, locale)}
        backHref={`/${locale}/app`}
        backLabel={t(copy.vocabulary.back, locale)}
        action={<LanguageSwitch locale={locale} role="patient" subjectId={patientId} />}
      />
      <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-3 tablet:p-5">
        <StepIndicator steps={steps} current={step} label={t(copy.identity.setupProgressLabel, locale)} lang={locale} />

        {step === 0 && (
          <>
            <h1 className="type-h1">{t(copy.identity.languageStepTitle, locale)}</h1>
            <p className="type-body">{t(copy.identity.languageStepBody, locale)}</p>
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
            <h1 className="type-h1">{t(copy.identity.notificationsStepTitle, locale)}</h1>
            <p className="type-body">{t(copy.identity.notificationsStepBody, locale)}</p>
            {/* Three legitimate paths, three EQUAL buttons — same variant, size and width, none of
                them primary (UX §2/§13, brand book; audit M2). The board draws primary + secondary +
                secondary; the spec wins, and the deviation is the lead's to log. */}
            <Card className="flex flex-col gap-3">
              <span className="type-body-strong">{t(copy.identity.browserOfferTitle, locale)}</span>
              <span className="type-body-small">{t(copy.identity.browserOfferBody, locale)}</span>
              <Button variant="secondary" size="lg" fullWidth icon="subscribe" lang={locale} loading={pending} onClick={handleBrowserOffer}>
                {t(copy.identity.browserOfferButton, locale)}
              </Button>
            </Card>
            <Card className="flex flex-col gap-3">
              <span className="type-body-strong">{t(copy.identity.telegramOfferTitle, locale)}</span>
              <span className="type-body-small">{t(copy.identity.telegramOfferBody, locale)}</span>
              <Button variant="secondary" size="lg" fullWidth icon="link" lang={locale} loading={pending} onClick={handleTelegramOffer}>
                {t(copy.identity.telegramOfferButton, locale)}
              </Button>
            </Card>
            <Card className="flex flex-col gap-3">
              <span className="type-body-strong">{t(copy.identity.laterOfferTitle, locale)}</span>
              <span className="type-body-small">{t(copy.identity.laterOfferBody, locale)}</span>
              <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={handleLaterOffer}>
                {t(copy.identity.laterOfferButton, locale)}
              </Button>
            </Card>
            <span className="type-caption">{t(copy.identity.equalWeightNote, locale)}</span>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="type-h1">{t(copy.identity.inviteStepTitle, locale)}</h1>
            <p className="type-body">{t(copy.identity.inviteStepBody, locale)}</p>
            {/* Cross-bundle contract (WP4b brief, wired by the lead at the wave-1 gate): the invite
                step mounts bundle h's InviteSheet — the same two-step flow F1 uses. onDone fires
                whether the person invited or backed out, so it only closes the sheet; the person
                continues (or skips) the step themselves. */}
            <Button variant="primary" size="lg" fullWidth lang={locale} onClick={() => setInviteOpen(true)}>
              {t(copy.identity.inviteOpenLabel, locale)}
            </Button>
            <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={handleSkipInvite}>
              {t(copy.identity.skipInviteLabel, locale)}
            </Button>
            {inviteOpen && <InviteSheet patientId={patientId} locale={locale} onDone={() => setInviteOpen(false)} />}
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="type-h1">{t(copy.identity.closingStepTitle, locale)}</h1>
            <p className="type-body">{t(copy.identity.closingStepBody, locale)}</p>
            <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleFinish}>
              {t(copy.identity.finishSetupLabel, locale)}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
