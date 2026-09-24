import type * as React from 'react';
import Link from 'next/link';
import { Icon, type IconName } from './Icon';
import { copy, t, type Locale } from '@/i18n';
import { localizeDrugName } from '@/i18n/localize';
import type { InteractionAlert } from '@/types/contracts';

/** InteractionAlert.severity, narrowed locally per index.d.ts (Severity). */
export type Severity = InteractionAlert['severity'];
/** InteractionAlert.reviewStatus, narrowed locally per index.d.ts (ReviewStatus). */
export type ReviewStatus = InteractionAlert['reviewStatus'];

const ICON_BY_SEVERITY: Record<Severity, IconName> = { info: 'info', warning: 'warning', danger: 'danger' };
const VOCAB_BY_SEVERITY: Record<Severity, 'severityInfo' | 'severityWarning' | 'severityDanger'> = {
  info: 'severityInfo',
  warning: 'severityWarning',
  danger: 'severityDanger',
};

export interface AlertRowProps {
  severity: Severity;
  /** The interacting drugs, one per line item — joined for the row's headline when `title` is not set. */
  drugs: string[];
  reviewStatus: ReviewStatus;
  /** Overrides the default drugs.join(' + ') headline. */
  title?: React.ReactNode;
  /** Patient/sector line for a reviewer queue, e.g. "حمد سالم المطيري · قطاع عام". */
  metaLabel?: React.ReactNode;
  /** The review line: the vocabulary's sentence by default, another line, or `null` for none (a reviewer's queue). */
  reviewLabel?: React.ReactNode | null;
  href?: string;
  onOpen?: () => void;
  lang?: Locale;
  className?: string;
}

/**
 * One interaction finding in a list — severity, the drugs involved, and the review state, legible
 * without opening it (Build Prompts prompt 1). Used on the patient's safety list and both reviewer
 * queues. `pending_medical_review` renders `warning`, never `success` or `danger` alone.
 */
export function AlertRow({ severity, drugs, reviewStatus, title, metaLabel, reviewLabel, href, onOpen, lang = 'en', className }: AlertRowProps) {
  const interactive = Boolean(href) || Boolean(onOpen);
  const classes = ['jr-alert-row', `jr-alert-row--${severity}`, interactive ? 'wsf-focus' : null, className]
    .filter(Boolean)
    .join(' ');
  const severityWord = t(copy.vocabulary[VOCAB_BY_SEVERITY[severity]], lang);
  const reviewWord = t(copy.vocabulary[reviewStatus], lang);

  const body = (
    <>
      <span className="jr-alert-row__head">
        <span className="jr-alert-row__severity type-label">
          <Icon name={ICON_BY_SEVERITY[severity]} small />
          <span>{severityWord}</span>
        </span>
        {interactive ? <Icon name="chevron" mirror className="jr-alert-row__go" /> : null}
      </span>
      <span className="jr-alert-row__title type-body-strong">{title ?? drugs.map((d) => localizeDrugName(d, lang)).join(' × ')}</span>
      {metaLabel ? <span className="jr-alert-row__meta type-body-small">{metaLabel}</span> : null}
      {reviewLabel === null ? null : <span className="jr-alert-row__review type-body-small">{reviewLabel ?? reviewWord}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={classes}>
        {body}
      </button>
    );
  }
  return <div className={classes}>{body}</div>;
}
