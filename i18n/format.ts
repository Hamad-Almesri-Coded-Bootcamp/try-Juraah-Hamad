/**
 * Locale-aware number/time/date formatting (docs/briefs/WP1.md §7; UX Principles §3/§12). Arabic
 * uses Arabic-Indic digits, exactly as every Arabic board does (`٨:٠٠`, `٥٠٠`) via `Intl` with
 * `-u-nu-arab`; English uses Western digits. Times keep `HH:mm` order; numerals never mirror
 * (real-world things — including digits — never mirror between RTL and LTR, UX Principles §12).
 */
import type { Locale } from './locale';

function numberingLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar-u-nu-arab' : 'en';
}

/** Gregorian calendar always — Kuwait's `ar` ICU locale defaults to Islamic otherwise, and every
 * date in this product (REFERENCE_NOW, every seed date) is a Gregorian ISO date. */
const DATE_OPTS = { calendar: 'gregory', timeZone: 'UTC' } as const;

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(numberingLocale(locale)).format(value);
}

/** "HH:mm" in, locale-appropriate digits out — hour unpadded, minute always two digits (٨:٠٠, 20:00). */
export function formatTime(hhmm: string, locale: Locale): string {
  const [h, m] = hhmm.split(':').map(Number);
  const hour = new Intl.NumberFormat(numberingLocale(locale)).format(h ?? 0);
  const minute = new Intl.NumberFormat(numberingLocale(locale), { minimumIntegerDigits: 2 }).format(m ?? 0);
  return `${hour}:${minute}`;
}

/** A full written-out date — "21 September 2026" / "٢١ سبتمبر ٢٠٢٦" (UX Principles §3: "dates are written out"). */
export function formatDate(isoDate: string, locale: Locale): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat(numberingLocale(locale), { day: 'numeric', month: 'long', year: 'numeric', ...DATE_OPTS }).format(d);
}

/** A schedule-header label — weekday plus written-out day and month, no year (B1's date display). */
export function formatDayLabel(isoDate: string, locale: Locale): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat(numberingLocale(locale), { weekday: 'long', day: 'numeric', month: 'long', ...DATE_OPTS }).format(d);
}
