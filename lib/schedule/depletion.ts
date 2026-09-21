/**
 * Depletion — docs/briefs/WP1.md §5: `remaining = totalQuantityDispensed − doses scheduled since
 * dispenseDate × dosePerAdministration`, `daysRemaining` from the daily consumption rate, `null`
 * when `dispensing` is absent (never a fabricated estimate — B3, D1). Reads `REFERENCE_NOW` (G3)
 * through `lib/config`, never `Date.now()`.
 */
import type { Prescription } from '@/types/contracts';
import { REFERENCE_DATE, daysBetween } from './dates';

export interface Depletion {
  remaining: number | null;
  total: number | null;
  daysRemaining: number | null;
}

export function computeDepletion(prescription: Prescription): Depletion {
  const { dispensing, dosePerAdministration, frequencyPerDay, dosingPattern } = prescription;
  if (!dispensing || frequencyPerDay === undefined) return { remaining: null, total: null, daysRemaining: null };

  const dosesPerDay = dosingPattern === 'alternate_day' ? frequencyPerDay / 2 : frequencyPerDay;
  const dailyConsumption = dosesPerDay * dosePerAdministration;

  // Full calendar days elapsed between the dispense date and today (today itself not yet fully consumed).
  const daysElapsed = Math.max(0, daysBetween(dispensing.dispenseDate, REFERENCE_DATE));
  const consumed = daysElapsed * dailyConsumption;
  const remaining = Math.max(0, dispensing.totalQuantityDispensed - consumed);
  const daysRemaining = dailyConsumption > 0 ? Math.floor(remaining / dailyConsumption) : null;

  return { remaining, total: dispensing.totalQuantityDispensed, daysRemaining };
}
