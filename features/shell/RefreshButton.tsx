'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import type { Locale } from '@/i18n/locale';

/** `router.refresh()` re-runs the server component tree — a real refresh attempt, not a client-only
 * replay. Shared by the offline page (H3) and the `LastKnown` failed-refresh wrapper. */
export function RefreshButton({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="secondary" size="lg" fullWidth icon="refresh" lang={locale} loading={pending} onClick={() => startTransition(() => router.refresh())}>
      {label}
    </Button>
  );
}
