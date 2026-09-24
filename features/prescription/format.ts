/**
 * Presentational formatting helpers for B3 (prescription detail) and B4 (add/scan), owned by WP4
 * bundle d. No fetch, no mock import (guard 3) and no clock read (guard 6) anywhere here — every
 * date/number comes in as an argument, and REFERENCE_NOW never appears in this file. Mirrors the
 * shape `features/caregiving/format.ts` (bundle h) already established for the read-only twin (F3),
 * kept as this bundle's own copy rather than a cross-bundle import — D-003's "two subagents never
 * own the same file" reasoning applies just as much to a shared helper module as to a copy catalogue.
 */
import { formatCount, formatDate, formatDayLabel, formatNumber, formatStrength as formatStrengthValue, formatTime, formatUnit, type PluralCopy } from '@/i18n/format';
import { localizeDrugName, localizePersonName, localizeText } from '@/i18n/localize';
import { dateOf, daysBetween } from '@/lib/schedule/dates';
import { formatDoseCount } from '@/features/day/format';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { Prescription } from '@/types/contracts';

/** The names on the box, in the reader's language, brand first (CR-069(l)): `primary` is the brand
 * when there is one, else the generic; `generic` is the second line, only when a brand leads. The
 * seed's "(unreadable)" becomes words (localizeDrugName), never the literal. */
export function medicineNames(
  drug: { genericName?: string; brandName?: string } | undefined,
  locale: Locale,
): { primary: string; generic: string | null } {
  const generic = localizeDrugName(drug?.genericName ?? '', locale);
  if (drug?.brandName) return { primary: localizeDrugName(drug.brandName, locale), generic };
  return { primary: generic, generic: null };
}

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

/** A dose-history row's day, calm and short — "Sunday, September 20" / "الأحد، ٢٠ سبتمبر" — and
 * its clock time (Daylight: the history reads as a list of days, not of full dates). */
export function historyWhen(scheduledAt: string, locale: Locale): { dateLabel: string; timeLabel: string } {
  return { dateLabel: formatDayLabel(dateOf(scheduledAt), locale), timeLabel: formatTime(scheduledAt.slice(11, 16), locale) };
}

/** One labelled field of the prescription, its value already in the reader's language, or `null`
 * when the record holds none. */
export interface PrescriptionField {
  key: string;
  label: string;
  value: string | null;
}

/**
 * Every field of the `Prescription` contract a reader sees, dispensing included, in one order, each
 * value formatted and localised (numbers in the locale's digits, drug names, people and free text
 * through i18n/localize.ts). B3 lays them out in its details card; F3 can read the very same list,
 * so the two cannot drift into two words for one field (audit M10). Nothing is dropped: a field
 * with no value comes back with `value: null`, and the screen names it rather than hiding it.
 */
export function prescriptionFields(rx: Prescription, locale: Locale): PrescriptionField[] {
  const num = (n: number | undefined) => (n == null ? null : formatNumber(n, locale));
  const text = (s: string | undefined) => (s ? localizeText(s, locale) : null);
  const date = (iso: string | undefined) => (iso ? formatDate(iso.slice(0, 10), locale) : null);
  const f = (key: string, label: string, value: string | null | undefined): PrescriptionField => ({ key, label, value: value || null });
  const fields: PrescriptionField[] = [
    f('genericName', t(copy.prescription.rxGenericLabel, locale), localizeDrugName(rx.drug.genericName, locale)),
    f('brandName', t(copy.prescription.rxBrandLabel, locale), rx.drug.brandName ? localizeDrugName(rx.drug.brandName, locale) : null),
    f('strengthMg', t(copy.prescription.rxStrengthLabel, locale), formatStrength(rx.drug, locale)),
    f('dosePerAdministration', t(copy.prescription.rxDoseLabel, locale), formatDoseCount(rx.dosePerAdministration, locale)),
    f('frequencyPerDay', t(copy.prescription.rxFrequencyLabel, locale), num(rx.frequencyPerDay)),
    f('dosingPattern', t(copy.prescription.rxPatternLabel, locale), patternLabel(rx.dosingPattern, locale)),
    f('doseTimes', t(copy.prescription.rxDoseTimesLabel, locale), formatDoseTimes(rx.doseTimes, locale)),
    f('startDate', t(copy.prescription.rxStartDateLabel, locale), date(rx.startDate)),
    f('durationDays', t(copy.prescription.rxDurationLabel, locale), formatDurationDays(rx.durationDays, locale)),
    f('timingRelativeToFood', t(copy.prescription.rxTimingLabel, locale), text(rx.timingRelativeToFood)),
    f('routeOfAdministration', t(copy.prescription.rxRouteLabel, locale), text(rx.routeOfAdministration)),
    f('indication', t(copy.prescription.rxIndicationLabel, locale), text(rx.indication)),
    f('specialNotes', t(copy.prescription.rxNotesLabel, locale), text(rx.specialNotes)),
    f('prescriberName', t(copy.prescription.rxPrescriberLabel, locale), rx.prescriberName ? localizePersonName(rx.prescriberName, locale) : null),
    f('prescribedAt', t(copy.prescription.rxPrescribedAtLabel, locale), date(rx.prescribedAt)),
    f('status', t(copy.prescription.rxStatusLabel, locale), rxStatusLabel(rx.status, locale)),
  ];
  if (rx.status === 'discontinued') {
    fields.push(
      f('discontinuedReason', t(copy.prescription.rxDiscontinuedReasonLabel, locale), text(rx.discontinuedReason)),
      f('discontinuedAt', t(copy.prescription.rxDiscontinuedAtLabel, locale), date(rx.discontinuedAt)),
    );
  }
  fields.push(
    f('unitsPerPackage', t(copy.prescription.rxUnitsPerPackageLabel, locale), num(rx.dispensing?.unitsPerPackage)),
    f('totalQuantityDispensed', t(copy.prescription.rxTotalDispensedLabel, locale), num(rx.dispensing?.totalQuantityDispensed)),
    f('dispenseDate', t(copy.prescription.rxDispenseDateLabel, locale), date(rx.dispensing?.dispenseDate)),
    f(
      'brandActuallyDispensed',
      t(copy.prescription.rxBrandDispensedLabel, locale),
      rx.dispensing?.brandActuallyDispensed ? localizeDrugName(rx.dispensing.brandActuallyDispensed, locale) : null,
    ),
  );
  return fields;
}

/**
 * B4's review step: the fields a photo can carry, from the still-unsaved draft (a
 * `Partial<Prescription>`), in B3's order and words. Keys are the contract's own field names, so
 * the extraction's `uncertainFields` ("strengthMg", "doseTimes"…) mark the matching rows.
 */
export function draftFields(draft: Partial<Prescription>, locale: Locale): PrescriptionField[] {
  const f = (key: string, label: string, value: string | null | undefined): PrescriptionField => ({ key, label, value: value || null });
  return [
    f('genericName', t(copy.prescription.rxGenericLabel, locale), draft.drug?.genericName ? localizeDrugName(draft.drug.genericName, locale) : null),
    f('brandName', t(copy.prescription.rxBrandLabel, locale), draft.drug?.brandName ? localizeDrugName(draft.drug.brandName, locale) : null),
    f('strengthMg', t(copy.prescription.rxStrengthLabel, locale), formatStrength(draft.drug, locale)),
    f('dosePerAdministration', t(copy.prescription.rxDoseLabel, locale), draft.dosePerAdministration != null ? formatDoseCount(draft.dosePerAdministration, locale) : null),
    f('frequencyPerDay', t(copy.prescription.rxFrequencyLabel, locale), draft.frequencyPerDay != null ? formatNumber(draft.frequencyPerDay, locale) : null),
    f('dosingPattern', t(copy.prescription.rxPatternLabel, locale), patternLabel(draft.dosingPattern, locale)),
    f('doseTimes', t(copy.prescription.rxDoseTimesLabel, locale), formatDoseTimes(draft.doseTimes, locale)),
    f('startDate', t(copy.prescription.rxStartDateLabel, locale), draft.startDate ? formatDate(draft.startDate, locale) : null),
    f('durationDays', t(copy.prescription.rxDurationLabel, locale), formatDurationDays(draft.durationDays, locale)),
  ];
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
