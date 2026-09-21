import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { getPatient } from '@/lib/data';
import { SetupFlow } from '@/features/identity/SetupFlow';

/**
 * A2 — first-run setup. `app/[locale]/app/layout.tsx` (WP3's) already `requireRole`s this route to
 * `patient` and hides the tab bar here. Runs once while `onboardingCompleted` is false — once it is
 * true, this redirects to Today so the flow never runs twice (SCREENS.md pass criterion).
 */
export default async function SetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await getSession();
  if (!session || session.role !== 'patient') notFound();

  const patient = await getPatient(session.subjectId);
  if (!patient) notFound();
  if (patient.onboardingCompleted) redirect(`/${locale}/app`);

  return <SetupFlow locale={locale} patientId={session.subjectId} initialLanguage={patient.language} />;
}
