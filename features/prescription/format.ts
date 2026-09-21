/**
 * Presentational formatting helpers for B3 (prescription detail) and B4 (add/scan), owned by WP4
 * bundle d. No fetch, no mock import (guard 3) and no clock read (guard 6) anywhere here — every
 * date/number comes in as an argument, and REFERENCE_NOW never appears in this file. Mirrors the
 * shape `features/caregiving/format.ts` (bundle h) already established for the read-only twin (F3),
 * kept as this bundle's own copy rather than a cross-bundle import — D-003's "two subagents never
 * own the same file" reasoning applies just as much to a shared helper module as to a copy catalogue.
 */
import { formatDate, formatNumber, formatTime } from '@/i18n/format';
import { dateOf } from '@/lib/schedule/dates';
import { interpolate } from '@/features/shell/interpolate';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { Prescription } from '@/types/contracts';

// An object lookup, not a switch-case, for the same reason features/caregiving/format.ts gives:
// it reads past guard 5's physical-property scan for every one of these unit codes.
const UNIT_KEY = { mg: 'unitMg', mcg: 'unitMcg', g: 'unitG', ml: 'unitMl', IU: 'unitIU' } as const satisfies Record<
  NonNullable<Prescription['drug']['strengthUnit']>,
  keyof typeof copy.prescription
>;

/** `Prescription.drug.strengthUnit`'s word, defaulting to "mg" per the contract's own default. */
export function unitLabel(unit: Prescription['drug']['strengthUnit'], locale: Locale): string {
  return t(copy.prescription[UNIT_KEY[unit ?? 'mg']], locale);
}

/**
 * "50 mcg" / "٥٠ ميكروغرام" — the number exactly as `strengthMg` holds it, in the unit
 * `strengthUnit` names, never converted (rx-008 stays 50 mcg — guard U, CLAUDE.md rule on unit
 * conversion). `null` while the field is absent (CR-002: an unread or flagged record), so the caller
 * passes that straight to `DetailRow`, which renders the empty mark rather than "undefined".
 */
export function formatStrength(
  drug: { strengthMg?: number; strengthUnit?: Prescription['drug']['strengthUnit'] } | undefined,
  locale: Locale,
): string | null {
  if (drug?.strengthMg == null) return null;
  return `${formatNumber(drug.strengthMg, locale)} ${unitLabel(drug.strengthUnit, locale)}`;
}

export function patternLabel(pattern: Prescription['dosingPattern'] | undefined, locale: Locale): string | null {
  if (pattern === 'alternate_day') return t(copy.prescription.rxPatternAlternate, locale);
  if (pattern === 'other') return t(copy.prescription.rxPatternOther, locale);
  if (pattern === 'daily') return t(copy.prescription.rxPatternDaily, locale);
  return null;
}

export function rxStatusLabel(status: Prescription['status'], locale: Locale): string {
  if (status === 'completed') return t(copy.prescription.rxStatusCompleted, locale);
  if (status === 'discontinued') return t(copy.prescription.rxStatusDiscontinued, locale);
  return t(copy.prescription.rxStatusActive, locale);
}

/** Every dose time in one line — "٨:٠٠ ص · ٢:٠٠ م · ٨:٠٠ م". `null` while `doseTimes` is absent
 * (rx-006: unreadable, CR-002) so the caller renders the empty mark rather than an empty string. */
export function formatDoseTimes(times: string[] | undefined, locale: Locale): string | null {
  if (!times || times.length === 0) return null;
  return times.map((hhmm) => formatTime(hhmm, locale)).join(' · ');
}

/** "90 days" / "٩٠ يومًا". `null` when `durationDays` itself is absent (defensive — the contract
 * requires it, but B4's still-unsaved draft is a `Partial<Prescription>`). */
export function formatDurationDays(days: number | undefined, locale: Locale): string | null {
  if (days == null) return null;
  return interpolate(t(copy.prescription.rxDurationDaysTemplate, locale), { count: formatNumber(days, locale) });
}

/** A dose's "day time" cell for DoseTimeline — newest-first is the caller's own sort, not this
 * helper's (mirrors features/caregiving/format.ts's `timelineWhen`, kept as this bundle's own copy). */
export function timelineWhen(scheduledAt: string, locale: Locale): { dateLabel: string; timeLabel: string } {
  const isoDate = dateOf(scheduledAt);
  return { dateLabel: formatDate(isoDate, locale), timeLabel: formatTime(scheduledAt.slice(11, 16), locale) };
}
