import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { SignInForm } from '@/features/identity/SignInForm';

/** A1 — sign-in / identity verification (mock). The page supplies the bar's actions (the assistant
 * and the language switch, which persists the choice for a signed-in patient); `SignInForm` draws
 * the sky, the sheet and the flow itself. */
export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  return <SignInForm locale={locale} actions={<LanguageSwitch locale={locale} role={session?.role} subjectId={session?.subjectId} />} />;
}
