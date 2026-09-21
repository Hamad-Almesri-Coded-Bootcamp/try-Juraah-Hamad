'use client';

import { copy, DEFAULT_LOCALE } from '@/i18n';

/** H2 placeholder shell. WP3 replaces it with ErrorState. Never an error code, never blame. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = DEFAULT_LOCALE;
  return (
    <main className="mx-auto max-w-content p-3 flex flex-col gap-3">
      <h1 className="text-h2">{copy.shell.errorTitle[locale]}</h1>
      <p className="text-body-small text-ink-muted">{copy.shell.errorBody[locale]}</p>
      <button type="button" onClick={reset} className="min-h-hit-lg rounded-md bg-navy text-on-fill px-3">
        {copy.shell.retry[locale]}
      </button>
    </main>
  );
}
