/**
 * The remaining supply as a ring (Daylight, CR-071): the days in the middle, in the reader's digits with the
 * unit that agrees with the number, drawn by the design system's `ProgressRing`. Shared by D1's
 * cards and B3's supply card, so the two read the same figure the same way.
 *
 * Only ever rendered with real dispensing data: the caller passes `computeDepletion`'s numbers and
 * renders `copy.supply.supplyNoEstimate` instead when there is none (never an invented estimate).
 * The wrapper carries `role="progressbar"` with the plain numbers, like `DepletionMeter`, so the
 * meter is announced as one; the ring itself is decorative. Server-compatible, no hooks.
 */
import { ProgressRing } from '@/components/ui/ProgressRing';
import { interpolate } from '@/features/shell/interpolate';
import { copy, t } from '@/i18n';
import { formatCount, formatNumber, type PluralCopy } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';

/** At or below this many days the supply reads as low (DepletionMeter's own default). */
export const LOW_SUPPLY_DAYS = 7;

const DAYS_UNIT: PluralCopy = {
  one: copy.supply.supplyDaysUnitOne,
  two: copy.supply.supplyDaysUnitTwo,
  few: copy.supply.supplyDaysUnitFew,
  many: copy.supply.supplyDaysUnitMany,
  other: copy.supply.supplyDaysUnitOther,
};

export function isLowSupply(daysRemaining: number | null | undefined): boolean {
  return daysRemaining != null && daysRemaining <= LOW_SUPPLY_DAYS;
}

/** The count sentence, e.g. "بقي ٧٠ من ٩٠" (copy.supply.supplyCountTemplate). */
export function supplyCountLine(remaining: number, total: number, locale: Locale): string {
  return interpolate(t(copy.supply.supplyCountTemplate, locale), {
    remaining: formatNumber(remaining, locale),
    total: formatNumber(total, locale),
  });
}

export interface SupplyRingProps {
  remaining: number;
  total: number;
  daysRemaining: number | null;
  locale: Locale;
  size?: number;
}

export function SupplyRing({ remaining, total, daysRemaining, locale, size = 96 }: SupplyRingProps) {
  const pct = total > 0 ? (remaining / total) * 100 : 0;
  const low = isLowSupply(daysRemaining);
  return (
    <span
      role="progressbar"
      aria-valuenow={remaining}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={interpolate(t(copy.supply.supplyRingLabelTemplate, locale), {
        remaining: formatNumber(remaining, locale),
        total: formatNumber(total, locale),
      })}
      className="inline-flex flex-none"
    >
      <ProgressRing value={pct} size={size} stroke={9} tone={low ? 'warning' : 'navy'}>
        {daysRemaining != null ? (
          <>
            <span className={`jr-num text-h2 font-semibold ${low ? 'text-warning' : 'text-navy'}`}>{formatNumber(daysRemaining, locale)}</span>
            <span className="type-caption text-ink-muted">{formatCount(daysRemaining, locale, DAYS_UNIT)}</span>
          </>
        ) : (
          <span className="jr-num text-h2 font-semibold text-navy">{formatNumber(remaining, locale)}</span>
        )}
      </ProgressRing>
    </span>
  );
}
