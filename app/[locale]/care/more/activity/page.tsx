import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { requireRole } from '@/features/shell/gate';
import { CaregiverActivity } from '@/features/caregiving/CaregiverActivity';
import { copy, t } from '@/i18n';

/** F3 — caregiver detail access, activity feed (E2's content). */
export default async function CaregiverActivityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireRole(locale, ['caregiver']);

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(copy.shell.moreActivity, locale)}
        backHref={`/${locale}/care/more`}
        backLabel={t(copy.vocabulary.back, locale)}
        action={<LanguageSwitch locale={locale} role={session.role} subjectId={session.subjectId} />}
      />
      <CaregiverActivity caregiverId={session.subjectId} locale={locale} />
    </div>
  );
}
