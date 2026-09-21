import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { AddPrescriptionFlow } from '@/features/prescription/AddPrescriptionFlow';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';

/** B4 — add / scan prescription. Pushed from B2 / B1's empty state. */
export default async function AddPrescriptionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await getSession();
  if (!session || session.role !== 'patient') notFound(); // defensive — the shell layout already gates this

  const backHref = `/${locale}/app/medicines`;

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(screenTitles.B4, locale)}
        backHref={backHref}
        backLabel={t(copy.vocabulary.back, locale)}
        action={<LanguageSwitch locale={locale} role="patient" subjectId={session.subjectId} />}
      />
      <AddPrescriptionFlow locale={locale} patientId={session.subjectId} backHref={backHref} />
    </div>
  );
}
