import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { requireRole } from '@/features/shell/gate';
import { CaregiverAlertDetail } from '@/features/caregiving/CaregiverAlertDetail';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';

/**
 * F3 — caregiver detail access, interaction alert detail: C2's content under C2's own title, read
 * only (opening never changes state). The caregiver shell has no alert list, so back goes to the
 * Medicines tab, where the alert is shown.
 */
export default async function CaregiverAlertDetailPage({ params }: { params: Promise<{ locale: string; alertId: string }> }) {
  const { locale, alertId } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireRole(locale, ['caregiver']);

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(screenTitles.C2, locale)}
        backHref={`/${locale}/care/medicines`}
        backLabel={t(copy.vocabulary.back, locale)}
        action={<LanguageSwitch locale={locale} role={session.role} subjectId={session.subjectId} />}
      />
      <CaregiverAlertDetail alertId={alertId} locale={locale} />
    </div>
  );
}
