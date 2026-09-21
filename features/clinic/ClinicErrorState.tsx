'use client';

/**
 * G7's error state for the clinic shell's own screens (X0, G1s, G3s, X1) — the same plain-sentence-
 * plus-retry shape H2/B1/C1 use (UX Principles §6: no error code, no blame), reusing the shared
 * `copy.shell.errorTitle`/`errorBody`/`retry` catalogue entries rather than redefining them here.
 * `onRetry` navigates back to the screen's own clean route, dropping the `?view=error` dev flag —
 * see each page's own doc comment for why that flag exists (same pattern as `features/day/
 * DayErrorState.tsx`).
 */
import { useRouter } from 'next/navigation';
import { ErrorState } from '@/components/ui/ErrorState';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

export function ClinicErrorState({ locale, backHref }: { locale: Locale; backHref: string }) {
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
