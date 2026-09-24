import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';

/**
 * A1/A1b's layout: no shell, no tab bar, nothing to get lost in (navigation.md). Each screen draws
 * its own top in the Daylight look (CR-071): A1 a navy sky with the wordmark, A1b a light bar. So
 * the layout carries only the main region; the screen's one h1 is the page's own (the old app bar
 * put the app name in a second h1).
 */
export default async function SignInLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div id="main-content" className="flex min-h-dvh flex-col pb-0">
      {children}
    </div>
  );
}
