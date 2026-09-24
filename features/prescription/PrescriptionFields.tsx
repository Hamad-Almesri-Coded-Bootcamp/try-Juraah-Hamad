/**
 * The details card of B3 (and B4's review step, and F3 when it reuses B3): every field in ONE white
 * card, the fields that hold a value as label/value pairs in two columns, and every field that holds
 * none named once in a single closing line ("Not recorded for this prescription: …"). Nothing is
 * dropped (the spec's "every field of the contract"), and no field shows an empty mark or a dash.
 *
 * Each pair is the design system's `DetailRow`; the grid only lays them out. A field listed in
 * `unclear` (B4: the photo held it, but not legibly) keeps its own row with the "unclear in the
 * photo" mark instead of joining the closing line, so the reader sees exactly which parts to check.
 * Every named field carries `data-field-label`, so a parity test can compare the set of fields two
 * screens name without caring how each lays them out. Presentational, no hooks, no fetch.
 */
import { Fragment } from 'react';
import { DetailRow } from '@/components/ui/DetailRow';
import { copy, t, type CopyEntry } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { PrescriptionField } from './format';

export interface PrescriptionFieldsProps {
  fields: PrescriptionField[];
  locale: Locale;
  /** Field keys whose value is absent because the photo was unclear (B4 needs_review). */
  unclear?: ReadonlySet<string>;
  /** The closing line's sentence, with `{fields}` where the names go. Default: B3's. */
  missingTemplate?: CopyEntry;
  className?: string;
}

/** "a, b, and c" / "أ وب وج", with each name wrapped so it stays one addressable element. */
function NameList({ names, locale }: { names: string[]; locale: Locale }) {
  const parts = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).formatToParts(names);
  return (
    <>
      {parts.map((part, i) =>
        part.type === 'element' ? (
          <span key={i} data-field-label="" className="text-navy">
            {part.value}
          </span>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        ),
      )}
    </>
  );
}

export function PrescriptionFields({ fields, locale, unclear, missingTemplate = copy.prescription.b3NotRecordedTemplate, className }: PrescriptionFieldsProps) {
  const unclearLabel = t(copy.prescription.unclearFieldLabel, locale);
  const shown = fields.filter((f) => f.value != null || unclear?.has(f.key));
  const missing = fields.filter((f) => f.value == null && !unclear?.has(f.key));
  const [before, after = ''] = t(missingTemplate, locale).split('{fields}');

  return (
    <div className={['jr-group', className].filter(Boolean).join(' ')}>
      <div className="grid grid-cols-2 pt-1">
        {shown.map((field, i) => (
          // One cell per field; a hairline between rows of the grid (the row's two cells share a
          // height, so their lines meet). Each DetailRow is alone in its cell, so none draws its own.
          <div key={field.key} className={['min-w-0 px-4 [overflow-wrap:anywhere]', i >= 2 ? 'border-t border-border' : null].filter(Boolean).join(' ')}>
            {field.value != null ? (
              <DetailRow label={<span data-field-label="">{field.label}</span>} value={field.value} lang={locale} />
            ) : (
              <DetailRow label={<span data-field-label="">{field.label}</span>} value={null} emptyMark={unclearLabel} emptyLabel={unclearLabel} lang={locale} />
            )}
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <p className="type-body-small m-0 border-t border-border bg-surface-app px-4 py-3 text-ink-muted">
          {before}
          <NameList names={missing.map((f) => f.label)} locale={locale} />
          {after}
        </p>
      )}
    </div>
  );
}
