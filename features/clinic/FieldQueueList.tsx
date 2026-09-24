/**
 * G3s's content (list) — flagged prescriptions with uncertain fields marked, plus a quiet history
 * section for the ones already returned to their issuing clinic (CR-037, lead wave-2 gate):
 * `getFieldConfirmationQueue` now returns both groups in one array, each row's own
 * `fieldReviewStatus` (`'pending' | 'returned'`) telling them apart — never a second, free-lookup
 * call. Each row names the drug from the record in the reader's language (`rx-006`'s `genericName`
 * is literally `"(unreadable)"`, which reads as words, never as an invented name) and the patient's
 * first name; opening a pending row goes to
 * the detail screen where the values are confirmed or the prescription is returned, and opening a
 * returned one goes to that SAME route, which already renders an already-returned record read-only.
 * Each group is one `jr-group` of `MenuRow`s (the design system's row for the clinic lists).
 */
import { EmptyState } from '@/components/ui/EmptyState';
import { MenuRow } from '@/components/ui/MenuRow';
import { copy, t } from '@/i18n';
import { interpolate } from '@/features/shell/interpolate';
import { localizeDrugName, localizeFirstName } from '@/i18n/localize';
import { uncertainFieldsLabel } from './format';
import type { Locale } from '@/i18n/locale';
import type { FieldQueueItem } from '@/types/views';

/** "اسم غير واضح · فاطمة": the drug as the record names it (localised; "(unreadable)" becomes words,
 * never the literal) and the patient's first name, in the reader's language. */
function rowTitle(item: FieldQueueItem, locale: Locale): string {
  return `${localizeDrugName(item.genericName, locale)} · ${localizeFirstName(item.patientFirstName, locale)}`;
}

export function FieldQueueList({ items, locale, hrefBuilder }: { items: FieldQueueItem[]; locale: Locale; hrefBuilder: (item: FieldQueueItem) => string }) {
  const pending = items.filter((item) => item.fieldReviewStatus === 'pending');
  const returned = items.filter((item) => item.fieldReviewStatus === 'returned');
  const empty = <EmptyState icon="capsule" title={t(copy.clinic.g3sEmptyTitle, locale)} description={t(copy.clinic.g3sEmptyBody, locale)} />;

  if (items.length === 0) return empty;

  // Group, don't box: one card per group, a hairline between rows (Daylight).
  return (
    <div className="flex flex-col gap-5">
      {pending.length === 0 ? (
        empty
      ) : (
        <section className="flex flex-col gap-2" aria-label={t(copy.clinic.g3sPendingHeading, locale)}>
          <h2 className="jr-group-title">{t(copy.clinic.g3sPendingHeading, locale)}</h2>
          <div className="jr-group">
            {pending.map((item) => (
              <MenuRow
                key={item.prescriptionId}
                icon="capsule"
                label={rowTitle(item, locale)}
                description={
                  item.uncertainFields.length > 0
                    ? interpolate(t(copy.clinic.g3sUncertainFieldsTemplate, locale), { fields: uncertainFieldsLabel(item.uncertainFields, locale) })
                    : undefined
                }
                href={hrefBuilder(item)}
              />
            ))}
          </div>
        </section>
      )}

      {returned.length > 0 && (
        <section className="flex flex-col gap-2" aria-label={t(copy.clinic.g3sReturnedHeading, locale)}>
          <h2 className="jr-group-title">{t(copy.clinic.g3sReturnedHeading, locale)}</h2>
          <div className="jr-group">
            {returned.map((item) => (
              <MenuRow
                key={item.prescriptionId}
                icon="inbox"
                label={rowTitle(item, locale)}
                description={t(copy.clinic.g3sReturnedRowStatus, locale)}
                href={hrefBuilder(item)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
