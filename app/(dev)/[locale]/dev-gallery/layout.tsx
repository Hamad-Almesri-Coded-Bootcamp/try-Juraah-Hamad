import { notFound } from 'next/navigation';
import { directionFor, isLocale } from '@/i18n';
import '../../../globals.css';

/**
 * Root layout of the dev-only components gallery (Gate 2). A second root layout, in its own route
 * group, so the gallery carries no shell chrome. Never reachable in a production build.
 * Exempt from guards 2 and 7 and from eslint jsx-no-literals by path (app/(dev)/**).
 */
// axe's document-title rule: a root layout owns the <title>. Dev-only page; a literal is allowed here.
export const metadata = { title: 'Jur’ah — components gallery (dev)' };

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&family=IBM+Plex+Sans:wght@400;600&display=swap';

export default async function GalleryLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} dir={directionFor(locale)}>
      <head>
        <link rel="stylesheet" href={FONTS_HREF} />
      </head>
      <body>{children}</body>
    </html>
  );
}
