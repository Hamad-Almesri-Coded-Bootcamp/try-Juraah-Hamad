import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getFlaggedPrescription } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { FlaggedPrescriptionDetail } from '@/features/clinic/FlaggedPrescriptionDetail';
import { copy, t } from '@/i18n';

/** G3s — field confirmation, one prescription (`/[locale]/clinic/review/fields/[prescriptionId]`).
 * `getFlaggedPrescription` is the ONLY way this route reaches a patient's record — never a free
 * prescription lookup. */
export default async function FieldConfirmationDetailPage({ params }: { params: Promise<{ locale: string; prescriptionId: string }> }) {
  const { locale, prescriptionId } = await params;
  if (!isLocale(locale)) notFound();

  const prescription = await getFlaggedPrescription(prescriptionId);
  if (!prescription) notFound(); // not flagged, not found, or not this reviewer's

  const backHref = `/${locale}/clinic/review/fields`;

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar title={t(copy.clinic.g3sDetailTitle, locale)} backHref={backHref} backLabel={t(copy.vocabulary.back, locale)} />
      <FlaggedPrescriptionDetail prescription={prescription} locale={locale} backHref={backHref} />
    </div>
  );
}
