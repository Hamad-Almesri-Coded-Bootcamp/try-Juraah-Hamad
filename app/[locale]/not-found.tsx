import Link from 'next/link';
import { copy, DEFAULT_LOCALE } from '@/i18n';

/** H1 placeholder shell. WP3 replaces it with EmptyState + Button and the current shell's home. */
export default function NotFound() {
  const locale = DEFAULT_LOCALE;
  return (
    <main className="mx-auto max-w-content p-3 flex flex-col gap-3">
      <h1 className="text-h2">{copy.shell.notFoundTitle[locale]}</h1>
      <p className="text-body-small text-ink-muted">{copy.shell.notFoundBody[locale]}</p>
      <Link href={`/${locale}`} className="min-h-hit inline-flex items-center">
        {copy.shell.backHome[locale]}
      </Link>
    </main>
  );
}
