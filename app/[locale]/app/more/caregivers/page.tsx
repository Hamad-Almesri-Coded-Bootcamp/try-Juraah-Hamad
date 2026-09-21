import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { CaregiverList } from '@/features/caregiving/CaregiverList';
import { getCaregivers } from '@/lib/data';
import { getSession } from '@/lib/session';
import { copy, t } from '@/i18n';

/** F1 — caregiver management, patient side (docs/wireframes/Caregivers.dc.html, InviteMasked.dc.html). */
export default async function CaregiversPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await getSession();
  const patientId = session?.role === 'patient' ? session.subjectId : '';
  const caregivers = await getCaregivers(patientId);

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(copy.caregiving.f1Title, locale)}
        backHref={`/${locale}/app/more`}
        backLabel={t(copy.vocabulary.back, locale)}
        action={<LanguageSwitch locale={locale} role={session?.role} subjectId={patientId} />}
      />
      <CaregiverList caregivers={caregivers} patientId={patientId} locale={locale} />
    </div>
  );
}
