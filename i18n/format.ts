/**
 * Locale-aware number/time/date formatting (docs/briefs/WP1.md §7; UX Principles §3/§12). Arabic
 * uses Arabic-Indic digits, exactly as every Arabic board does (`٨:٠٠`, `٥٠٠`) via `Intl` with
 * `-u-nu-arab`; English uses Western digits. Times keep `HH:mm` order; numerals never mirror
 * (real-world things — including digits — never mirror between RTL and LTR, UX Principles §12).
 */
import type { Locale } from './locale';
import type { CopyEntry } from './copy/shell';
import { vocabulary } from './copy/vocabulary';
import type { Prescription } from '@/types/contracts';

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

/** `Prescription.drug.strengthUnit` — the contract's five unit codes (default "mg"). */
export type StrengthUnit = NonNullable<Prescription['drug']['strengthUnit']>;

/** ONE word per unit, everywhere (UX Principles §3: no Latin abbreviation in Arabic, one word per
 * concept). The Arabic spellings are the ones the prescription and caregiving catalogues already
 * carried (audit M7 found a third, `ملغ`, in the clinic). */
const UNIT_WORD: Readonly<Record<StrengthUnit, CopyEntry>> = {
  mg: vocabulary.unitMg,
  mcg: vocabulary.unitMcg,
  g: vocabulary.unitG,
  ml: vocabulary.unitMl,
  IU: vocabulary.unitIU,
};

/** true for one of the contract's unit codes — for callers holding a unit as a loose string. */
export function isStrengthUnit(value: string | undefined): value is StrengthUnit {
  return value !== undefined && Object.prototype.hasOwnProperty.call(UNIT_WORD, value);
}

/** The unit's word alone — "mg" / "ملغم". */
export function formatUnit(unit: StrengthUnit | undefined, locale: Locale): string {
  return UNIT_WORD[unit ?? 'mg'][locale];
}

/**
 * The one strength formatter (audit M7): "50 mcg" / "٥٠ ميكروغرام", "400 mg" / "٤٠٠ ملغم". The
 * number is shown exactly as `strengthMg` holds it, in the unit `strengthUnit` names — never
 * converted (rx-008 stays 50 mcg; guard U). Digits follow the locale like every other number.
 */
export function formatStrength(value: number, unit: StrengthUnit | undefined, locale: Locale): string {
  return `${formatNumber(value, locale)} ${formatUnit(unit, locale)}`;
}

/** Plural categories `Intl.PluralRules` yields — Arabic uses all six, English `one` and `other`. */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** One copy variant per plural category; `other` is required and is the fallback for any category
 * a catalogue does not spell out. Each template carries `{count}` where the number goes (the `one`
 * and `two` Arabic forms may omit it: "يوم واحد", "يومين"). */
export type PluralCopy = { readonly other: CopyEntry } & Partial<Readonly<Record<Exclude<PluralCategory, 'other'>, CopyEntry>>>;

/** The category a count takes in a language. An explicit `zero` variant, when a catalogue gives one,
 * is also used for 0 in a language whose rules have no zero category (English), so "0 days" never has
 * to be the only way to say it. */
export function pluralCategory(n: number, locale: Locale, forms?: PluralCopy): PluralCategory {
  if (n === 0 && forms?.zero) return 'zero';
  return new Intl.PluralRules(locale).select(n) as PluralCategory;
}

/**
 * A counted phrase in the grammatically right form — Arabic counts agree with their noun (يوم
 * واحد · يومين · ٣–١٠ أيام · ١١–٩٩ يومًا · ١٠٠ يوم), so a single "{count} أيام" template is wrong
 * for most numbers (audit M7: "٧٠ أيام"). The number itself is formatted in the locale's digits.
 */
export function formatCount(n: number, locale: Locale, forms: PluralCopy): string {
  const entry = forms[pluralCategory(n, locale, forms)] ?? forms.other;
  return entry[locale].replace('{count}', formatNumber(n, locale));
}

const DAYS_LEFT: PluralCopy = {
  zero: vocabulary.daysLeftZero,
  one: vocabulary.daysLeftOne,
  two: vocabulary.daysLeftTwo,
  few: vocabulary.daysLeftFew,
  many: vocabulary.daysLeftMany,
  other: vocabulary.daysLeftOther,
};

/** DepletionMeter's caption — "70 days of supply left" / "باقي ٧٠ يومًا من الكمية". */
export function formatDaysLeft(days: number, locale: Locale): string {
  return formatCount(days, locale, DAYS_LEFT);
}
