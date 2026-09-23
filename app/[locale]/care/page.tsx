import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { requireRole } from '@/features/shell/gate';
import { CaregiverToday } from '@/features/caregiving/CaregiverToday';
import { copy, t } from '@/i18n';

/**
 * F2 — caregiver home, Today (docs/wireframes/CaregiverHome.dc.html, CaregiverPlan.dc.html). The app
 * bar carries the caregiver tab's own title and the language switch, as F3 does (UX Principles §1
 * and §12; audit C7). It is the shell's home, so there is no back control.
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
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(copy.shell.careTabToday, locale)}
        action={<LanguageSwitch locale={locale} role={session.role} subjectId={session.subjectId} />}
      />
      <CaregiverToday caregiverId={session.subjectId} locale={locale} day={day} />
    </div>
  );
}
