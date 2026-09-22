import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getAlertForReview, getReviewQueue } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { ReviewerDecision } from '@/features/clinic/ReviewerDecision';
import { copy, t } from '@/i18n';

/** G2s — reviewer decision (`/[locale]/clinic/review/[alertId]`). `getAlertForReview` is the ONLY
 * way this route reaches a patient (via the alert's own `patientId`) — never a free lookup.
 * `getReviewQueue` is read as well, for the queue pane the 1280 board (ReviewerDesktop.dc.html)
 * draws beside the decision at wide widths — the same session-scoped read G1s makes, nothing more. */
export default async function ReviewerDecisionPage({ params }: { params: Promise<{ locale: string; alertId: string }> }) {
  const { locale, alertId } = await params;
  if (!isLocale(locale)) notFound();

  const [view, queue] = await Promise.all([getAlertForReview(alertId), getReviewQueue()]);
  if (!view.alert.patientId) notFound(); // no such alert, or none in this reviewer's queue

  const backHref = `/${locale}/clinic/review`;

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar title={t(copy.clinic.g2sTitle, locale)} backHref={backHref} backLabel={t(copy.vocabulary.back, locale)} />
      <ReviewerDecision view={view} locale={locale} backHref={backHref} queue={queue} queueBasePath={backHref} />
    </div>
  );
}
