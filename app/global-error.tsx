'use client';

import { copy, DEFAULT_LOCALE, directionFor } from '@/i18n';
import './globals.css';

/** H2 for a failure above the locale layout. Must render its own <html>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = DEFAULT_LOCALE;
  return (
    <html lang={locale} dir={directionFor(locale)}>
      <body>
        <main className="mx-auto max-w-content p-3 flex flex-col gap-3">
          <h1 className="text-h2">{copy.shell.errorTitle[locale]}</h1>
          <p className="text-body-small text-ink-muted">{copy.shell.errorBody[locale]}</p>
          <button type="button" onClick={reset} className="min-h-hit-lg rounded-md bg-navy text-on-fill px-3">
            {copy.shell.retry[locale]}
          </button>
        </main>
      </body>
    </html>
  );
}
