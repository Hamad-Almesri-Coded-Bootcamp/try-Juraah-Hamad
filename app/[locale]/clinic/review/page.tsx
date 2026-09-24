import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getReviewQueue, getFieldConfirmationQueue } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { LoadingState } from '@/components/ui/LoadingState';
import { ReviewerQueueShell } from '@/features/clinic/ReviewerQueueShell';
import { ReviewQueueList } from '@/features/clinic/ReviewQueueList';
import { ClinicErrorState } from '@/features/clinic/ClinicErrorState';
import { copy, t } from '@/i18n';

/**
 * G1s — reviewer queue, interaction findings (`/[locale]/clinic/review`). The clinic shell layout
 * already enforces the `reviewer` role and renders the simulated-role banner and TabBar.
 *
 * `?view=loading` / `?view=error` — the same dev-only, production-gated G7-state flag `app/[locale]/
 * app/page.tsx` (B1) established, read from this page's own `searchParams` prop (never
 * `useSearchParams` — D-008), never acting in a production build and carrying no seed data of its own.
 */
export default async function ReviewQueuePage({
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
        <AppBar title={title} action={<LanguageSwitch locale={locale} assistant={false} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <LoadingState variant="list" rows={3} label={t(copy.vocabulary.loading, locale)} />
        </div>
      </div>
    );
  }
  if (view === 'error') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} action={<LanguageSwitch locale={locale} assistant={false} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <ClinicErrorState locale={locale} backHref={`/${locale}/clinic/review`} />
        </div>
      </div>
    );
  }

  const [findings, fields] = await Promise.all([getReviewQueue(), getFieldConfirmationQueue()]);

  return (
    <ReviewerQueueShell active="findings" findingsCount={findings.length} fieldsCount={fields.length} locale={locale}>
      <ReviewQueueList items={findings} locale={locale} hrefBuilder={(item) => `/${locale}/clinic/review/${item.alertId}`} />
    </ReviewerQueueShell>
  );
}
