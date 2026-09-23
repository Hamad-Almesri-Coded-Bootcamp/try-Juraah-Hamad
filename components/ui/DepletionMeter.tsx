import { useId } from 'react';
import type * as React from 'react';
import { Icon } from './Icon';
import { copy, t, type Locale } from '@/i18n';
import { formatDaysLeft, formatNumber } from '@/i18n/format';

const DEFAULT_LOW_AT_DAYS = 7;

export interface DepletionMeterProps {
  label?: React.ReactNode;
  /** Units left from dispensing.totalQuantityDispensed minus what has been taken. */
  remaining: number;
  /** The dispensed total the bar is measured against. */
  total: number;
  /** Days to depletion, computed by the deterministic layer — this component does no arithmetic. */
  daysRemaining?: number | null;
  /** Unit word, e.g. 'حبة' or 'tablets'. */
  unit?: React.ReactNode;
  /** At or below this many days the meter reads as low: warning fill plus the low-supply word. Default 7. */
  lowAtDays?: number;
  lang?: Locale;
  className?: string;
}

/**
 * Remaining quantity and days to depletion for one prescription, written out as numbers and drawn
 * as a bar behind them (docs/design-system/components/DepletionMeter.md). Does no arithmetic: every
 * value is passed in already computed by the schedule layer.
 *
 * `lang` also sets the digits (audit M7): the visible count and the days caption are formatted for
 * the language (٧٠ / ٩٠, "باقي ٧٠ يومًا من الكمية"), and the caption takes the grammatical noun form
 * for its number. `aria-valuenow`/`aria-valuemax` stay plain numbers — they are data, not text.
 */
export function DepletionMeter({
  label,
  remaining,
  total,
  daysRemaining,
  unit,
  lowAtDays = DEFAULT_LOW_AT_DAYS,
  lang = 'en',
  className,
}: DepletionMeterProps) {
  const countId = useId();
  const labelId = useId();
  const low = daysRemaining != null && daysRemaining <= lowAtDays;
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  const classes = ['wsf-dep', low ? 'wsf-dep--low' : null, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="wsf-dep__head">
        {label ? (
          <span id={labelId} className="wsf-dep__label type-body-strong">
            {label}
          </span>
        ) : null}
        <span id={countId} className="wsf-dep__count type-body-strong">
          {formatNumber(remaining, lang)} / {formatNumber(total, lang)}
          {unit ? <> {unit}</> : null}
        </span>
      </div>
      <div
        className="wsf-dep__track"
        role="progressbar"
        aria-valuenow={remaining}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-labelledby={label ? `${labelId} ${countId}` : countId}
      >
        <div className="wsf-dep__fill" style={{ inlineSize: `${pct}%` }} />
      </div>
      {daysRemaining != null ? (
        <span className="wsf-dep__note type-body-small">
          {low ? <Icon name="warning" small /> : null}
          {formatDaysLeft(daysRemaining, lang)}
          {low ? <> · {t(copy.vocabulary.lowSupply, lang)}</> : null}
        </span>
      ) : null}
    </div>
  );
}
