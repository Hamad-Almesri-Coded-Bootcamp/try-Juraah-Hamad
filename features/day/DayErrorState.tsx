'use client';

import { useRouter } from 'next/navigation';
import { ErrorState } from '@/components/ui/ErrorState';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

/**
 * B1/B2's G7 error state: the same plain-sentence-plus-retry shape H2 uses (UX Principles §6 — no
 * error code, no blame), scoped to the screen's own content area rather than replacing the whole
 * shell. `onRetry` navigates back to the screen's clean route (dropping the `?view=error` dev flag —
 * see the page's own doc comment for why that flag exists and how it is read).
 */
export function DayErrorState({ locale, backHref }: { locale: Locale; backHref: string }) {
  const router = useRouter();
  return (
    <ErrorState
      title={t(copy.shell.errorTitle, locale)}
      description={t(copy.shell.errorBody, locale)}
      onRetry={() => router.push(backHref)}
      retryLabel={t(copy.shell.retry, locale)}
    />
  );
}
