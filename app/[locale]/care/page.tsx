import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { requireRole } from '@/features/shell/gate';
import { CaregiverToday } from '@/features/caregiving/CaregiverToday';

/** F2 — caregiver home, Today (docs/wireframes/CaregiverHome.dc.html, CaregiverPlan.dc.html). */
export default async function CaregiverTodayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireRole(locale, ['caregiver']);
  const { day } = await searchParams;

  return <CaregiverToday caregiverId={session.subjectId} locale={locale} day={day} />;
}
