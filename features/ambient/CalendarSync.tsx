'use client';

/**
 * E1 — calendar sync (`docs/wireframes/Calendar.dc.html`). Off: what subscribing gives, gain-framed
 * (UX Principles §13), and one subscribe action. On: the per-patient `webcal://` link in a
 * `CopyField` — the one place a token-bearing URL is shown on screen, the spec's own bounded
 * exception to rule 7/G9 (CLAUDE.md; SCREENS.md E1 row) — shown exactly as `enableCalendarSync` /
 * `getCalendarSubscription` return it, never constructed here. Short add-to-calendar instructions,
 * and the one-directional line (the external calendar never writes a dose status — G1).
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { CopyField } from '@/components/ui/CopyField';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { enableCalendarSync } from '@/lib/data';
import { copy, t } from '@/i18n';
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
      <div className="flex flex-col gap-4" data-testid="calendar-off">
        <p className="type-body">{t(copy.ambient.e1SubscribeBody, locale)}</p>
        <Button variant="primary" size="lg" fullWidth lang={locale} icon="subscribe" loading={pending} onClick={handleSubscribe}>
          {t(copy.ambient.e1SubscribeAction, locale)}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="calendar-on">
      <CopyField label={t(copy.ambient.e1CopyFieldLabel, locale)} value={current.icsUrl} lang={locale} />
      <div className="flex flex-col gap-2">
        <span className="type-label">{t(copy.ambient.e1HowToAddTitle, locale)}</span>
        <ol className="flex flex-col gap-1 ps-5 type-body">
          <li>{t(copy.ambient.e1Step1, locale)}</li>
          <li>{t(copy.ambient.e1Step2, locale)}</li>
          <li>{t(copy.ambient.e1Step3, locale)}</li>
        </ol>
      </div>
      <InlineNotice tone="info" title={t(copy.ambient.e1OneDirectionalTitle, locale)}>
        {t(copy.ambient.e1OneDirectionalBody, locale)}
      </InlineNotice>
    </div>
  );
}
