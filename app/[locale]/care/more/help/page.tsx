import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { requireRole } from '@/features/shell/gate';
import { CaregiverHelp } from '@/features/caregiving/CaregiverHelp';
import { copy, t } from '@/i18n';

/** F5 — caregiver help (docs/wireframes/CaregiverHelp.dc.html). */
export default async function CaregiverHelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireRole(locale, ['caregiver']);

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(copy.shell.moreHelp, locale)}
        backHref={`/${locale}/care/more`}
        backLabel={t(copy.vocabulary.back, locale)}
        action={<LanguageSwitch locale={locale} role={session.role} subjectId={session.subjectId} />}
      />
      <CaregiverHelp locale={locale} />
    </div>
  );
}
