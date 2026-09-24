/**
 * G1s's content — every `pending_medical_review` alert, most severe first (already sorted by
 * `getReviewQueue`), one `AlertRow` per item: what (the severity and the drugs, which the row
 * localises), and as `metaLabel`, the one meta slot `AlertRow` offers, which patient (the first name,
 * in the reader's language) and how long it has waited. CR-036 (lead,
 * wave-2 gate): `ReviewQueueItem.waitedMinutes` is precomputed by the data layer against the reference
 * clock; `waitedLabel` only formats it, never derives it (guard 6 — no clock read anywhere here).
 * Server-compatible: no hooks, no state — `AlertRow`'s `href` is a real link, not a client `onClick`.
 */
import { AlertRow } from '@/components/ui/AlertRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { copy, t } from '@/i18n';
import { interpolate } from '@/features/shell/interpolate';
import { formatNumber } from '@/i18n/format';
import { localizeFirstName } from '@/i18n/localize';
import { waitedLabel } from './format';
import type { Locale } from '@/i18n/locale';
import type { ReviewQueueItem } from '@/types/views';

export function ReviewQueueList({ items, locale, hrefBuilder }: { items: ReviewQueueItem[]; locale: Locale; hrefBuilder: (item: ReviewQueueItem) => string }) {
  if (items.length === 0) {
    return <EmptyState icon="review" title={t(copy.clinic.g1sEmptyTitle, locale)} description={t(copy.clinic.g1sEmptyBody, locale)} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="type-body-small px-1 text-ink-muted">{interpolate(t(copy.clinic.g1sCountTemplate, locale), { count: formatNumber(items.length, locale) })}</p>
      {items.map((item) => (
        <AlertRow
          key={item.alertId}
          severity={item.severity}
          drugs={item.drugNames}
          reviewStatus="pending_medical_review"
          metaLabel={`${localizeFirstName(item.patientFirstName, locale)} · ${waitedLabel(item.waitedMinutes, locale)}`}
          href={hrefBuilder(item)}
          lang={locale}
        />
      ))}
    </div>
  );
}
