import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { AppBar } from '@/components/ui/AppBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { LastKnown } from '@/features/shell/LastKnown';
import { PrescriptionDetail } from '@/features/prescription/PrescriptionDetail';
import { PrescriptionErrorState } from '@/features/prescription/PrescriptionErrorState';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import { REFERENCE_NOW } from '@/lib/config';

/**
 * B3 — prescription detail. Pushed from B1/B2 (bundle c's cards link here — CR-032). `?view=` is the
 * same dev-only, self-contained G7 demo flag `app/[locale]/app/page.tsx` documents: read from this
 * page's own `searchParams` prop (D-008 — never `useSearchParams`), gated to non-production, and
 * never a documented product feature.
 */
export default async function PrescriptionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; prescriptionId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale, prescriptionId } = await params;
  if (!isLocale(locale)) notFound();
  const { view: rawView } = await searchParams;
  const view = process.env.NODE_ENV === 'production' ? undefined : rawView;

  const backHref = `/${locale}/app/medicines`;
  const title = t(screenTitles.B3, locale);

  if (view === 'loading') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} backHref={backHref} backLabel={t(copy.vocabulary.back, locale)} action={<LanguageSwitch locale={locale} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <LoadingState variant="detail" label={t(copy.vocabulary.loading, locale)} />
        </div>
      </div>
    );
  }
  if (view === 'error') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} backHref={backHref} backLabel={t(copy.vocabulary.back, locale)} action={<LanguageSwitch locale={locale} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <PrescriptionErrorState locale={locale} backHref={backHref} />
        </div>
      </div>
    );
  }

  const session = await getSession();
  if (!session || session.role !== 'patient') notFound(); // defensive — the shell layout already gates this
  const action = <LanguageSwitch locale={locale} role="patient" subjectId={session.subjectId} />;

  const content = <PrescriptionDetail prescriptionId={prescriptionId} locale={locale} emptyBackHref={backHref} />;

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar title={title} backHref={backHref} backLabel={t(copy.vocabulary.back, locale)} action={action} />
      {view === 'offline' ? (
        <LastKnown asOf={REFERENCE_NOW} locale={locale}>
          {content}
        </LastKnown>
      ) : (
        content
      )}
    </div>
  );
}
