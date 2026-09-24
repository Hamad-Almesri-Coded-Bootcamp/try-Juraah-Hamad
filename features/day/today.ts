/**
 * Daylight's Today (CR-071): the day in parts a person names (morning, afternoon, evening, night),
 * the day dial's dots, the next dose, the week strip and the greeting. Pure functions over data the
 * screen already reads; every "now" comes from `kuwaitNow()` / `kuwaitToday()` passed in (rule 9).
 */
import { copy, t } from '@/i18n';
import { formatDayLabel, formatDayOfMonth, formatWeekdayShort } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import { interpolate } from '@/features/shell/interpolate';
import type { DialDose, DialTone } from '@/components/ui/DayDial';
import type { WeekStripDay } from '@/components/ui/WeekStrip';
import type { DoseWithPrescription } from '@/types/views';
import { timeOfIso } from './format';

export type DayPart = 'lateNight' | 'morning' | 'afternoon' | 'evening' | 'night';

/** Minutes since midnight of an ISO time already in Kuwait's offset ("…T08:00:00+03:00" → 480). */
export function minutesOfIso(iso: string): number {
  const [h, m] = timeOfIso(iso).split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Before 05:00 and from 21:00 is night; 05:00–11:59 morning; 12:00–16:59 afternoon; 17:00–20:59 evening. */
export function partOfDay(minutes: number): DayPart {
  const h = Math.floor(minutes / 60);
  if (h < 5) return 'lateNight';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

const PART_LABEL = {
  lateNight: copy.daylight.partNight,
  morning: copy.daylight.partMorning,
  afternoon: copy.daylight.partAfternoon,
  evening: copy.daylight.partEvening,
  night: copy.daylight.partNight,
} as const;

export function partLabel(part: DayPart, locale: Locale): string {
  return t(PART_LABEL[part], locale);
}

export interface PartGroup {
  part: DayPart;
  doses: DoseWithPrescription[];
}

/** The day's doses (already in time order) as consecutive parts of the day. */
export function groupDosesByPart(doses: readonly DoseWithPrescription[]): PartGroup[] {
  const groups: PartGroup[] = [];
  for (const dose of doses) {
    const part = partOfDay(minutesOfIso(dose.scheduledAt));
    const last = groups.at(-1);
    if (last && last.part === part) last.doses.push(dose);
    else groups.push({ part, doses: [dose] });
  }
  return groups;
}

/**
 * A dose's dot on the dial. `tracked` decides FIRST (rule 3): an untracked dose is plain whatever
 * its status word says — in the seed every untracked dose also reads `upcoming`, so a dot keyed on
 * the word would look right and be wrong the day tracking changes.
 */
export function dialTone(dose: Pick<DoseWithPrescription, 'tracked' | 'status'>): DialTone {
  if (dose.tracked === false) return 'plain';
  return dose.status === 'upcoming' ? 'plain' : dose.status;
}

export function dialDoses(doses: readonly DoseWithPrescription[]): DialDose[] {
  return doses.map((d) => ({ minutes: minutesOfIso(d.scheduledAt), tone: dialTone(d) }));
}

/** The first dose scheduled after now, on the day that is today. Time only, never a status. */
export function nextDoseAfter(doses: readonly DoseWithPrescription[], nowIso: string): DoseWithPrescription | undefined {
  const now = minutesOfIso(nowIso);
  return doses.find((d) => minutesOfIso(d.scheduledAt) > now);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The week (Sunday first, as in Kuwait) that holds the day on screen. */
export function weekDays(selectedIso: string, todayIso: string, locale: Locale, hrefFor: (iso: string) => string): WeekStripDay[] {
  const weekday = new Date(`${selectedIso}T00:00:00Z`).getUTCDay();
  const sunday = addDaysIso(selectedIso, -weekday);
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysIso(sunday, i);
    const today = iso === todayIso;
    const full = formatDayLabel(iso, locale);
    return {
      iso,
      name: formatWeekdayShort(iso, locale),
      number: formatDayOfMonth(iso, locale),
      label: today ? `${full}${t(copy.daylight.listSeparator, locale)}${t(copy.daylight.todayMarker, locale)}` : full,
      href: hrefFor(iso),
      selected: iso === selectedIso,
      today,
    };
  });
}

/** "Good morning, Hamad" before noon, "Good evening" after; the name may be absent. */
export function greetingFor(nowIso: string, firstName: string | undefined, locale: Locale): string {
  const morning = minutesOfIso(nowIso) < 12 * 60;
  if (!firstName) return t(morning ? copy.daylight.greetingMorningNoName : copy.daylight.greetingEveningNoName, locale);
  return interpolate(t(morning ? copy.daylight.greetingMorning : copy.daylight.greetingEvening, locale), { name: firstName });
}
