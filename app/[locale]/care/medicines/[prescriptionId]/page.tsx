import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { requireRole } from '@/features/shell/gate';
import { CaregiverPrescriptionDetail } from '@/features/caregiving/CaregiverPrescriptionDetail';
import { copy, t } from '@/i18n';

/**
 * F3 — caregiver detail access, prescription detail (B3's content minus every action). Titled with
 * the caregiver tab's label, never the patient's "My Medicines" (audit M10).
 */
export default async function CaregiverPrescriptionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; prescriptionId: string }>;
}) {
  const { locale, prescriptionId } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireRole(locale, ['caregiver']);

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(copy.shell.careTabMedicines, locale)}
        backHref={`/${locale}/care/medicines`}
        backLabel={t(copy.vocabulary.back, locale)}
        action={<LanguageSwitch locale={locale} role={session.role} subjectId={session.subjectId} />}
      />
      <CaregiverPrescriptionDetail prescriptionId={prescriptionId} locale={locale} />
    </div>
  );
}
