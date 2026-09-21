/**
 * G3s's content (list) — flagged prescriptions with uncertain fields marked, plus a quiet history
 * section for the ones already returned to their issuing clinic (CR-037, lead wave-2 gate):
 * `getFieldConfirmationQueue` now returns both groups in one array, each row's own
 * `fieldReviewStatus` (`'pending' | 'returned'`) telling them apart — never a second, free-lookup
 * call. Each card names the drug verbatim from the record (`rx-006`'s `genericName` is literally
 * `"(unreadable)"`, never invented text) and the patient first name; opening a pending card goes to
 * the detail screen where the values are confirmed or the prescription is returned, and opening a
 * returned one goes to that SAME route, which already renders an already-returned record read-only.
 */
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { copy, t } from '@/i18n';
import { interpolate } from '@/features/shell/interpolate';
import { uncertainFieldsLabel } from './format';
import type { Locale } from '@/i18n/locale';
import type { FieldQueueItem } from '@/types/views';

export function FieldQueueList({ items, locale, hrefBuilder }: { items: FieldQueueItem[]; locale: Locale; hrefBuilder: (item: FieldQueueItem) => string }) {
  const pending = items.filter((item) => item.fieldReviewStatus === 'pending');
  const returned = items.filter((item) => item.fieldReviewStatus === 'returned');

  if (items.length === 0) {
    return <EmptyState icon="capsule" title={t(copy.clinic.g3sEmptyTitle, locale)} description={t(copy.clinic.g3sEmptyBody, locale)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {pending.length === 0 ? (
        <EmptyState icon="capsule" title={t(copy.clinic.g3sEmptyTitle, locale)} description={t(copy.clinic.g3sEmptyBody, locale)} />
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((item) => {
            const title = `${item.genericName} · ${item.patientFirstName}`;
            return (
              <Card key={item.prescriptionId} as="a" href={hrefBuilder(item)} aria-label={title} className="flex flex-col gap-2">
                <span className="type-body-strong">{title}</span>
                {item.uncertainFields.length > 0 && (
                  <span className="type-body-small">
                    {interpolate(t(copy.clinic.g3sUncertainFieldsTemplate, locale), { fields: uncertainFieldsLabel(item.uncertainFields, locale) })}
                  </span>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {returned.length > 0 && (
        <section className="flex flex-col gap-2" aria-label={t(copy.clinic.g3sReturnedHeading, locale)}>
          <h2 className="type-h2">{t(copy.clinic.g3sReturnedHeading, locale)}</h2>
          <div className="flex flex-col gap-2">
            {returned.map((item) => {
              const title = `${item.genericName} · ${item.patientFirstName}`;
              return (
                <Card key={item.prescriptionId} as="a" href={hrefBuilder(item)} aria-label={title} flat className="flex flex-col gap-1">
                  <span className="type-body-strong">{title}</span>
                  <span className="type-caption">{t(copy.clinic.g3sReturnedRowStatus, locale)}</span>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
