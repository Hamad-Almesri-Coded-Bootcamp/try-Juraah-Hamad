/**
 * Pure, presentational formatting helpers for B1/B2 (features/day). No clock read anywhere here —
 * every date/time comes in as an argument (G3/rule 9); the caller (the page) is the one place that
 * resolves "today" against `REFERENCE_NOW`. No fetch, no mock import — these functions only shape
 * strings and group already-fetched data.
 */
import { copy, t } from '@/i18n';
import { formatCount, formatStrength, formatTime, type PluralCopy } from '@/i18n/format';
import { interpolate } from '@/features/shell/interpolate';
import type { Locale } from '@/i18n/locale';
import type { DoseWithPrescription } from '@/types/views';

/** The "HH:mm" slice of a Kuwait-offset ISO datetime ("2026-09-21T18:00:00+03:00" → "18:00") — string
 * slicing, never a Date (mirrors lib/schedule/dates.ts's own `dateOf`). */
export function timeOfIso(scheduledAtIso: string): string {
  return scheduledAtIso.slice(11, 16);
}

const DOSE_COUNT: PluralCopy = {
  one: copy.day.doseAmountOne,
  two: copy.day.doseAmountTwo,
  few: copy.day.doseAmountFewTemplate,
  many: copy.day.doseAmountManyTemplate,
  other: copy.day.doseAmountManyTemplate,
};

/** `dosePerAdministration` as a person says it — "One tablet" / "حبة واحدة" — never a bare number
 * (UX Principles §3). Also B3/F3's "Dose" row value (audit M9). */
export function formatDoseCount(count: number, locale: Locale): string {
  return formatCount(count, locale, DOSE_COUNT);
}

/** One dose's already-formatted amount line — "One tablet · 500 mg" / "حبة واحدة · ٥٠٠ ملغم" — the
 * shape DoseRow.md asks for ("this component does no maths"). The strength goes through the one
 * shared formatter (audit M7), in the unit `strengthUnit` names, never converted (rx-008 is 50 mcg,
 * never 0.05 — CLAUDE.md rule on unit conversion). */
export function formatDoseAmount(
  dose: Pick<DoseWithPrescription, 'dosePerAdministration' | 'drug'>,
  locale: Locale,
): string {
  const amount = formatDoseCount(dose.dosePerAdministration, locale);
  const { strengthMg, strengthUnit } = dose.drug;
  if (strengthMg == null) return amount;
  return `${amount} · ${formatStrength(strengthMg, strengthUnit, locale)}`;
}

/** One dose's already-formatted clock time — "٨:٠٠ ص" / "8:00 AM" is out of scope (no AM/PM word in
 * the seed's vocabulary); this renders the same "HH:mm" style every board shows. */
export function formatDoseTime(scheduledAtIso: string, locale: Locale): string {
  return formatTime(timeOfIso(scheduledAtIso), locale);
}

/** B2's card time label — always "Today {time}" (the card only ever looks at REFERENCE_DATE's own
 * doses, never a navigated day — board: "اليوم ٨:٠٠ م"). */
export function formatTodayDoseTimeLabel(scheduledAtIso: string, locale: Locale): string {
  return interpolate(t(copy.day.todayAtTemplate, locale), { time: formatDoseTime(scheduledAtIso, locale) });
}

export interface TimeGroup {
  time: string; // "HH:mm", the group's sort key
  doses: DoseWithPrescription[];
}

/** Groups one day's already-fetched, already-ascending doses by exact clock time — one ScheduleGroup
 * per distinct time, in the order they arrive (getDosesForDay already returns them ascending). */
export function groupDosesByTime(doses: readonly DoseWithPrescription[]): TimeGroup[] {
  const groups: TimeGroup[] = [];
  for (const dose of doses) {
    const time = timeOfIso(dose.scheduledAt);
    const last = groups.at(-1);
    if (last && last.time === time) last.doses.push(dose);
    else groups.push({ time, doses: [dose] });
  }
  return groups;
}

/** "the next or most recent dose" (SCREENS.md B2): among one prescription's doses for a single
 * reference day (already ascending), the latest one at-or-before `referenceIso`, or — if none has
 * happened yet — the earliest upcoming one. Returns undefined for a prescription with no dose that
 * day (the card then shows no dose row at all — PrescriptionCard's own contract). */
export function pickNextOrMostRecent(
  dosesForRx: readonly DoseWithPrescription[],
  referenceIso: string,
): DoseWithPrescription | undefined {
  let mostRecentPast: DoseWithPrescription | undefined;
  for (const dose of dosesForRx) {
    if (dose.scheduledAt <= referenceIso) mostRecentPast = dose;
  }
  return mostRecentPast ?? dosesForRx[0];
}
