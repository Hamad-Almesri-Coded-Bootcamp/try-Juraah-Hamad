'use client';

import { useRouter } from 'next/navigation';
import { ErrorState } from '@/components/ui/ErrorState';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

/**
 * B3's G7 error state: the same plain-sentence-plus-retry shape H2 uses (UX Principles §6 — no error
 * code, no blame), scoped to the screen's own content area. Reuses the shared `copy.shell` error
 * strings (the same ones `features/day/DayErrorState.tsx` reads) rather than duplicating them under
 * `copy.prescription` — that catalogue is generic system copy, not day- or prescription-specific.
 * `onRetry` drops the dev-only `?view=error` flag by navigating back to the clean route.
 */
export function PrescriptionErrorState({ locale, backHref }: { locale: Locale; backHref: string }) {
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
