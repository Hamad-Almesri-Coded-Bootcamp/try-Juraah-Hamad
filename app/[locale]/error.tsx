'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { homePathFor } from '@/features/shell/tabs';
import { getSession } from '@/lib/session';
import { copy, t } from '@/i18n';
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/i18n/locale';
import type { Role } from '@/types/views';

/**
 * H2 — application error. One plain sentence, retry (`retry()` — this Next version's replacement
 * for `reset()`, per node_modules/next/dist/docs), and a way back. Never an error code, never blame.
 * A Client Component (error boundaries must be) cannot receive `params`, so the locale comes from
 * the URL itself and the shell home from a client-side session read.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const pathname = usePathname();
  const segment = pathname.split('/')[1];
  const locale: Locale = isLocale(segment) ? segment : DEFAULT_LOCALE;
  const [role, setRole] = useState<Role | undefined>(undefined);

  useEffect(() => {
    console.error(error);
    let cancelled = false;
    void getSession().then((session) => {
      if (!cancelled) setRole(session?.role);
    });
    return () => {
      cancelled = true;
    };
  }, [error]);

  const home = role ? homePathFor(role, locale) : `/${locale}`;
  const isClinic = role === 'reviewer' || role === 'admin';
  const label = !role ? t(copy.shell.backHome, locale) : isClinic ? t(copy.shell.backToQueue, locale) : t(copy.shell.backToToday, locale);

  return (
    <main id="main-content" className="mx-auto flex min-h-dvh max-w-content flex-col justify-center gap-3 p-3">
      <ErrorState title={t(copy.shell.errorTitle, locale)} description={t(copy.shell.errorBody, locale)} onRetry={retry} retryLabel={t(copy.shell.retry, locale)} />
      <NavigateButton href={home} variant="secondary" size="lg" fullWidth lang={locale}>
        {label}
      </NavigateButton>
    </main>
  );
}
