import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { SignInForm } from '@/features/identity/SignInForm';

/** A1 — sign-in / identity verification (mock). `signin/layout.tsx` (WP3's) supplies the app bar
 * and language switch; this page renders only the flow itself. */
export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SignInForm locale={locale} />;
}
