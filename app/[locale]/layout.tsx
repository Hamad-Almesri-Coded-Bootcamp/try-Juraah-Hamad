import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LOCALES, directionFor, isLocale, copy, t } from '@/i18n';
import { RegisterServiceWorker } from '@/components/pwa/RegisterServiceWorker';
import { AssistantLauncher } from '@/features/assistant/AssistantLauncher';
import '../globals.css';

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=Readex+Pro:wght@400;500;600;700&display=swap';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : 'ar';
  return {
    title: copy.shell.appName[l],
    description: copy.shell.appDescription[l],
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: copy.shell.appName[l], statusBarStyle: 'default' },
  };
}

export const viewport = { themeColor: '#062958', width: 'device-width', initialScale: 1 };

/**
 * Root layout: the locale segment sets `lang` and `dir` on <html> (G2, G6). Shell chrome (app bar,
 * tab bars, banners) is added per surface by WP3; this layout carries only the document.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} dir={directionFor(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_HREF} />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:block focus:rounded-sm focus:bg-navy focus:p-3 focus:text-on-fill"
        >
          {t(copy.shell.skipToContent, locale)}
        </a>
        {/* Route changes are smooth without React's ViewTransition (CR-071): a page's content fades in on
            arrival (daylight.css `jr-enter`) and a full page load cross-fades (`@view-transition`). The
            React boundary threw "Transition was aborted" on every server redirect (sign-in, the gate). */}
        {children}
        {/* CR-067: the assistant on every page; the server decides patient answers vs app help. */}
        <AssistantLauncher locale={locale} />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
