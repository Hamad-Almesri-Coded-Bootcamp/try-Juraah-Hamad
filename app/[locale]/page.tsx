import { copy, isLocale } from '@/i18n';
import { notFound } from 'next/navigation';

/** L1 placeholder. Bundle (a) replaces this file. */
export default async function LandingPlaceholder({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main className="mx-auto max-w-content p-3 flex flex-col gap-4">
      <h1 className="text-h1">{copy.shell.appName[locale]}</h1>
      <p className="text-body text-ink-muted">{copy.shell.scaffoldNotice[locale]}</p>
    </main>
  );
}
