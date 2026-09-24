import type * as React from 'react';
import { copy, t, type Locale } from '@/i18n';
import { AsWritten } from './AsWritten';

const EMPTY_MARK = '—'; // em dash — a structural mark, not translated copy

export interface DetailRowProps {
  label: React.ReactNode;
  /** null, undefined or '' renders the empty mark and an assistive 'Not recorded' — never 'undefined', never a collapsed row. */
  value?: React.ReactNode | null;
  /** Replaces the default em dash. */
  emptyMark?: string;
  /** Replaces the assistive text read in place of a missing value. */
  emptyLabel?: string;
  lang?: Locale;
  className?: string;
}

/**
 * A label/value pair built so a missing value never breaks the layout and never prints "undefined"
 * (docs/design-system/components/DetailRow.md). Every field the contract defines is rendered,
 * present or not.
 */
export function DetailRow({ label, value, emptyMark, emptyLabel, lang = 'en', className }: DetailRowProps) {
  const isEmpty = value === null || value === undefined || value === '';
  const classes = ['wsf-dr', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <span className="wsf-dr__label type-label">{label}</span>
      {isEmpty ? (
        <span className="wsf-dr__value wsf-dr__value--empty type-body">
          <span aria-hidden="true">{emptyMark ?? EMPTY_MARK}</span>
          <span className="wsf-sr">{emptyLabel ?? t(copy.vocabulary.empty, lang)}</span>
        </span>
      ) : (
        // A string value is data: a run in the other script (a note typed by a person) is declared as written.
        <span className="wsf-dr__value type-body">{typeof value === 'string' ? <AsWritten text={value} locale={lang} /> : value}</span>
      )}
    </div>
  );
}
