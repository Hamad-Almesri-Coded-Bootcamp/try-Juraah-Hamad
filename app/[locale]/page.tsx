import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n';
import { getSession } from '@/lib/session';
import { resolveLandingCta } from '@/features/landing/cta';
import { LandingPage } from '@/features/landing/LandingPage';

/**
 * L1 — the public landing page at `/[locale]` (docs/Acceptance Criteria and Test Plan.md, G11).
 * Replaces WP0's scaffold placeholder. No data-layer call: `getSession()` is the session module
 * (lib/session), not the data-access layer (lib/data) — the only read this route performs, used
 * solely to point the primary action at the right destination for a signed-in viewer.
 */
export default async function LandingRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  const cta = resolveLandingCta(session, locale);
  return <LandingPage locale={locale} cta={cta} />;
}
