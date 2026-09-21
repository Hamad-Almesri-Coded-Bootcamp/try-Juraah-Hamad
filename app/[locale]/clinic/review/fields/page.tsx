import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getReviewQueue, getFieldConfirmationQueue } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { ReviewerQueueShell } from '@/features/clinic/ReviewerQueueShell';
import { FieldQueueList } from '@/features/clinic/FieldQueueList';
import { ClinicErrorState } from '@/features/clinic/ClinicErrorState';
import { copy, t } from '@/i18n';

/**
 * G3s — reviewer queue, prescriptions awaiting field confirmation (`/[locale]/clinic/review/fields`),
 * rendered "in place" beside G1s via the shared `ReviewerQueueShell`.
 *
 * `?view=loading` / `?view=error` — same dev-only, production-gated G7-state flag as G1s's own page.
 */
export default async function FieldConfirmationQueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { view: rawView } = await searchParams;
  const view = process.env.NODE_ENV === 'production' ? undefined : rawView;
  const title = t(copy.clinic.reviewerQueuesTitle, locale);

  if (view === 'loading') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} />
        <div className="flex flex-col gap-4 p-3">
          <LoadingState variant="list" rows={3} label={t(copy.vocabulary.loading, locale)} />
        </div>
      </div>
    );
  }
  if (view === 'error') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} />
        <div className="flex flex-col gap-4 p-3">
          <ClinicErrorState locale={locale} backHref={`/${locale}/clinic/review/fields`} />
        </div>
      </div>
    );
  }

  const [findings, fields] = await Promise.all([getReviewQueue(), getFieldConfirmationQueue()]);

  return (
    <ReviewerQueueShell active="fields" findingsCount={findings.length} fieldsCount={fields.length} locale={locale}>
      <FieldQueueList items={fields} locale={locale} hrefBuilder={(item) => `/${locale}/clinic/review/fields/${item.prescriptionId}`} />
    </ReviewerQueueShell>
  );
}
