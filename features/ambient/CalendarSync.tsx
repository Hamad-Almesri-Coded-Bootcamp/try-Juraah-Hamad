'use client';

/**
 * E1 — calendar sync (`docs/wireframes/Calendar.dc.html`), Daylight (CR-071). Off: what subscribing
 * gives, gain-framed (UX Principles §13), in one card, and one subscribe action. On: the per-patient `webcal://` link in a
 * `CopyField` — the one place a token-bearing URL is shown on screen, the spec's own bounded
 * exception to rule 7/G9 (CLAUDE.md; SCREENS.md E1 row) — shown exactly as `enableCalendarSync` /
 * `getCalendarSubscription` return it, never constructed here. Short add-to-calendar instructions,
 * and the one-directional line (the external calendar never writes a dose status — G1).
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { CopyField } from '@/components/ui/CopyField';
import { Icon } from '@/components/ui/Icon';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { enableCalendarSync } from '@/lib/data';
import { copy, t } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import type { CalendarSubscription } from '@/types/contracts';

export function CalendarSync({
  patientId,
  subscription,
  locale,
}: {
  patientId: string;
  subscription: CalendarSubscription | null;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(subscription);

  function handleSubscribe() {
    startTransition(() => {
      void (async () => {
        const sub = await enableCalendarSync(patientId);
        setCurrent(sub);
        router.refresh();
      })();
    });
  }

  if (!current) {
    return (
      <div className="flex flex-col gap-5" data-testid="calendar-off">
        <div className="jr-group flex flex-col items-center gap-3 px-4 py-5 text-center">
          <Icon name="calendar" className="jr-fact__icon" />
          <p className="m-0 type-body">{t(copy.ambient.e1SubscribeBody, locale)}</p>
        </div>
        <Button variant="primary" size="lg" fullWidth lang={locale} icon="subscribe" loading={pending} onClick={handleSubscribe}>
          {t(copy.ambient.e1SubscribeAction, locale)}
        </Button>
        <InlineNotice tone="info" title={t(copy.ambient.e1OneDirectionalTitle, locale)}>
          {t(copy.ambient.e1OneDirectionalBody, locale)}
        </InlineNotice>
      </div>
    );
  }

  const steps = [copy.ambient.e1Step1, copy.ambient.e1Step2, copy.ambient.e1Step3];
  return (
    <div className="flex flex-col gap-5" data-testid="calendar-on">
      <div className="jr-group px-4 py-4">
        <CopyField label={t(copy.ambient.e1CopyFieldLabel, locale)} value={current.icsUrl} lang={locale} />
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="jr-group-title">{t(copy.ambient.e1HowToAddTitle, locale)}</h2>
        <ol className="jr-group m-0 flex list-none flex-col p-0">
          {steps.map((step, i) => (
            <li key={i} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
              <span className="jr-num flex size-5 flex-none items-center justify-center rounded-full bg-navy-tint type-body-strong text-navy" aria-hidden="true">
                {formatNumber(i + 1, locale)}
              </span>
              <span className="type-body">{t(step, locale)}</span>
            </li>
          ))}
        </ol>
      </section>
      <InlineNotice tone="info" title={t(copy.ambient.e1OneDirectionalTitle, locale)}>
        {t(copy.ambient.e1OneDirectionalBody, locale)}
      </InlineNotice>
    </div>
  );
}
