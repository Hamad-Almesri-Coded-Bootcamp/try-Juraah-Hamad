'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { copy, DEFAULT_LOCALE, directionFor, t } from '@/i18n';
import './globals.css';

/**
 * H2 above the root layout — a failure the locale layout itself could not survive. Must render its
 * own <html>/<body> (Next's convention) and carries no shell of any kind: no tab bar, no app bar,
 * just the same ErrorState and a retry, in the default locale (there is no request context left to
 * read a locale from at this level).
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = DEFAULT_LOCALE;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={locale} dir={directionFor(locale)}>
      <body>
        <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center gap-3 p-3">
          <ErrorState title={t(copy.shell.errorTitle, locale)} description={t(copy.shell.errorBody, locale)} onRetry={retry} retryLabel={t(copy.shell.retry, locale)} />
        </main>
      </body>
    </html>
  );
}
