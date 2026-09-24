import type * as React from 'react';
import { Icon } from './Icon';
import { Monogram } from './Monogram';
import { StatusPill, type DoseStatus } from './StatusPill';
import type { Locale } from '@/i18n';
import { localizeDrugName } from '@/i18n/localize';
import { AsWritten } from './AsWritten';

export interface DoseRowProps {
  dose: {
    status: DoseStatus;
    /** false (or a patient with tracking off) renders no pill at all — decided by this flag, NEVER
     * by `status`. Default true. See CLAUDE.md rule 3 / G10. */
    tracked?: boolean;
  };
  drug: { genericName: string; brandName?: string; strengthMg?: number; strengthUnit?: string };
  /** Already-formatted dose amount with its unit, e.g. "حبة واحدة · ٥٠٠ ملغم" — the caller formats it
   * (features/day/format.ts → i18n/format.ts's one strength formatter, audit M7). No maths done here. */
  amountLabel: React.ReactNode;
  /** Already-formatted dose time. Optional — a row inside ScheduleGroup already sits under a time header. */
  timeLabel?: React.ReactNode;
  /** The only interaction this row may ever offer: a link into the prescription detail. */
  href?: string;
  /** Or a click handler that opens the same detail. Never a status-recording action (G1). */
  onOpen?: () => void;
  lang?: Locale;
  className?: string;
}

/**
 * One scheduled dose: drug, dose amount, and — only when tracked — its StatusPill. READ-ONLY by
 * contract (G1): the single optional affordance opens the prescription detail and nothing else.
 *
 * The no-status variant is not a fallback: `dose.tracked === false` renders a calm plan entry with
 * no pill, no placeholder and no gap where a pill would be, chosen by `tracked` alone — never by
 * `dose.status`, which in the seed reads "upcoming" on every untracked dose too (CLAUDE.md rule 3).
 */
export function DoseRow({ dose, drug, amountLabel, timeLabel, href, onOpen, lang = 'en', className }: DoseRowProps) {
  const interactive = Boolean(href) || Boolean(onOpen);
  const classes = ['jr-dose-row', interactive ? 'wsf-focus' : null, className].filter(Boolean).join(' ');
  const showPill = dose.tracked !== false;

  // Brand first, then the generic name (CR-069(l), PrescriptionCard.md: the pair patients lose), each
  // in the reader's script (CR-071). The monogram repeats the first letters of the name on the box.
  const brand = drug.brandName ? localizeDrugName(drug.brandName, lang) : undefined;
  const generic = localizeDrugName(drug.genericName, lang);
  const primary = brand ?? generic;

  const body = (
    <>
      <Monogram name={!drug.brandName && drug.genericName === '(unreadable)' ? '(unreadable)' : primary} />
      <span className="jr-dose-row__body">
        <span className="jr-dose-row__name type-body-strong">
          <span className="jr-dose-row__brand">
            <AsWritten text={primary} locale={lang} />
          </span>
        </span>
        <span className="jr-dose-row__amount type-body-small">
          {brand ? (
            <span className="jr-dose-row__generic">
              <AsWritten text={generic} locale={lang} /> ·{' '}
            </span>
          ) : null}
          {amountLabel}
        </span>
        {showPill ? (
          <span className="jr-dose-row__status">
            <StatusPill status={dose.status} lang={lang} />
          </span>
        ) : null}
      </span>
      {timeLabel ? <span className="jr-dose-row__time type-label">{timeLabel}</span> : null}
      {interactive && !timeLabel ? <Icon name="chevron" mirror className="jr-dose-row__go" /> : null}
    </>
  );

  if (href) {
    return (
      // A plain anchor, on purpose: the G1 runtime proof (tests/e2e/g1-today-tracking-off.spec.ts)
      // requires the dose list to carry ZERO click handlers, and next/link attaches one. The browser's
      // own cross-document view transition (daylight.css `@view-transition`) keeps the move smooth.
      <a href={href} className={classes} data-testid="dose-row">
        {body}
      </a>
    );
  }
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={classes} data-testid="dose-row">
        {body}
      </button>
    );
  }
  return (
    <div className={classes} data-testid="dose-row">
      {body}
    </div>
  );
}
