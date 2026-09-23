/**
 * Presentational formatting helpers for B3 (prescription detail) and B4 (add/scan), owned by WP4
 * bundle d. No fetch, no mock import (guard 3) and no clock read (guard 6) anywhere here — every
 * date/number comes in as an argument, and REFERENCE_NOW never appears in this file. Mirrors the
 * shape `features/caregiving/format.ts` (bundle h) already established for the read-only twin (F3),
 * kept as this bundle's own copy rather than a cross-bundle import — D-003's "two subagents never
 * own the same file" reasoning applies just as much to a shared helper module as to a copy catalogue.
 */
import { formatCount, formatDate, formatStrength as formatStrengthValue, formatTime, formatUnit, type PluralCopy } from '@/i18n/format';
import { dateOf, daysBetween } from '@/lib/schedule/dates';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { Prescription } from '@/types/contracts';

/** `Prescription.drug.strengthUnit`'s word, defaulting to "mg" per the contract's own default — the
 * one shared unit vocabulary (i18n/format.ts, audit M7), never a catalogue of this bundle's own. */
export function unitLabel(unit: Prescription['drug']['strengthUnit'], locale: Locale): string {
  return formatUnit(unit, locale);
}

/**
 * "50 mcg" / "٥٠ ميكروغرام" — the number exactly as `strengthMg` holds it, in the unit
 * `strengthUnit` names, never converted (rx-008 stays 50 mcg — guard U, CLAUDE.md rule on unit
 * conversion). A thin wrapper over the one shared formatter (i18n/format.ts, audit M7). `null` while
 * the field is absent (CR-002: an unread or flagged record), so the caller passes that straight to
 * `DetailRow`, which renders the empty mark rather than "undefined".
 */
export function formatStrength(
  drug: { strengthMg?: number; strengthUnit?: Prescription['drug']['strengthUnit'] } | undefined,
  locale: Locale,
): string | null {
  if (drug?.strengthMg == null) return null;
  return formatStrengthValue(drug.strengthMg, drug.strengthUnit, locale);
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

const DURATION_DAYS: PluralCopy = {
  one: copy.prescription.rxDurationDaysOne,
  two: copy.prescription.rxDurationDaysTwo,
  few: copy.prescription.rxDurationDaysFew,
  many: copy.prescription.rxDurationDaysMany,
  other: copy.prescription.rxDurationDaysOther,
};

/** "90 days" / "٩٠ يومًا", "7 days" / "٧ أيام" — the Arabic noun agrees with its count (audit M7).
 * `null` when `durationDays` itself is absent (defensive — the contract requires it, but B4's
 * still-unsaved draft is a `Partial<Prescription>`). */
export function formatDurationDays(days: number | undefined, locale: Locale): string | null {
  if (days == null) return null;
  return formatCount(days, locale, DURATION_DAYS);
}

/** A dose's "day time" cell for DoseTimeline — newest-first is the caller's own sort, not this
 * helper's (mirrors features/caregiving/format.ts's `timelineWhen`, kept as this bundle's own copy). */
export function timelineWhen(scheduledAt: string, locale: Locale): { dateLabel: string; timeLabel: string } {
  const isoDate = dateOf(scheduledAt);
  return { dateLabel: formatDate(isoDate, locale), timeLabel: formatTime(scheduledAt.slice(11, 16), locale) };
}

/** How far either side of today B3/F3's dose history shows before its "show all" disclosure (audit M8). */
export const DOSE_HISTORY_WINDOW_DAYS = 7;

export interface DoseHistorySplit<T> {
  /** Doses at or before now, newest first — the history proper. */
  past: T[];
  /** Doses after now, soonest first — the plan, never labelled as history. */
  planned: T[];
  /** How many of `past` (a prefix) fall within the last `windowDays` calendar days, today included —
   * or, when none does (a finished course), within the course's own last `windowDays` days. */
  pastVisible: number;
  /** How many of `planned` (a prefix) fall within the next `windowDays` calendar days, today included —
   * or, when none does (a course that starts later), within the course's own first `windowDays` days. */
  plannedVisible: number;
}

/**
 * B3/F3's dose history, split at `nowIso` into what already happened and what is planned, with the
 * window each shows before "show all" (audit M8: 90 flat rows, future dates up to 29 November under
 * "Dose history"). Pure — `nowIso` comes from the caller's clock helper (`kuwaitNow()`), never read
 * here. Nothing is dropped: `past` + `planned` is every row given, and each row object passes through
 * untouched, so `tracked` still alone decides whether a pill renders (rule 3). `scheduledAt` and
 * `nowIso` are both Kuwait-offset ISO strings, so they compare as strings (no Date needed).
 */
export function splitDoseHistory<T extends { scheduledAt: string }>(
  history: readonly T[],
  nowIso: string,
  windowDays: number = DOSE_HISTORY_WINDOW_DAYS,
): DoseHistorySplit<T> {
  const today = dateOf(nowIso);
  const ascending = [...history].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const past = ascending.filter((d) => d.scheduledAt <= nowIso).reverse();
  const planned = ascending.filter((d) => d.scheduledAt > nowIso);
  // Anchored at today; if nothing falls there, at the nearest dose instead, so a stopped course (rx-004,
  // 28 June) or a later-starting one never opens as an empty list with only a "show all" under it.
  const pastInWindow = (anchor: string) => past.filter((d) => daysBetween(dateOf(d.scheduledAt), anchor) < windowDays).length;
  const plannedInWindow = (anchor: string) => planned.filter((d) => daysBetween(anchor, dateOf(d.scheduledAt)) < windowDays).length;
  const pastVisible = pastInWindow(today) || (past[0] ? pastInWindow(dateOf(past[0].scheduledAt)) : 0);
  const plannedVisible = plannedInWindow(today) || (planned[0] ? plannedInWindow(dateOf(planned[0].scheduledAt)) : 0);
  return { past, planned, pastVisible, plannedVisible };
}
