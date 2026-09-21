import { copy, isLocale } from '@/i18n';
import { notFound } from 'next/navigation';

/** H3 service-worker fallback. WP3 completes it: last known data with an "as of" line. */
export default async function OfflinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main className="mx-auto max-w-content p-3 flex flex-col gap-3">
      <h1 className="text-h2">{copy.shell.offlineTitle[locale]}</h1>
      <p className="text-body-small text-ink-muted">{copy.shell.offlineBody[locale]}</p>
    </main>
  );
}
