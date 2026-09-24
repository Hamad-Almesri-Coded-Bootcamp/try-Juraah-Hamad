import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { requireRole } from '@/features/shell/gate';
import { CaregiverToday } from '@/features/caregiving/CaregiverToday';

/**
 * F2 — caregiver home, Today (docs/wireframes/CaregiverHome.dc.html, CaregiverPlan.dc.html). The
 * screen is the patient's own Today composition (the sky carries the caregiver tab's title as the
 * one h1, and the bar's actions: the assistant and the language switch; UX Principles §1 and §12;
 * audit C7). It is the shell's home, so there is no back control.
 */
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

  return (
    <CaregiverToday
      caregiverId={session.subjectId}
      locale={locale}
      day={day}
      actions={<LanguageSwitch locale={locale} role={session.role} subjectId={session.subjectId} />}
    />
  );
}
