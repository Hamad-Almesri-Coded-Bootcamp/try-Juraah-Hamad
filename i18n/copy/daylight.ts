/**
 * Copy for the Daylight redesign's shared pieces (CR-071, 2026-09-24): the parts of the day, the
 * greeting, the day dial, the week strip. Fusha Arabic, plain English, no em dash. Screens' own new
 * strings live in their own catalogue files; these are the ones more than one screen uses.
 */
import type { Copy } from './shell';

export const daylight = {
  // The day, in the words a person uses for it (Today, the caregiver's Today)
  partMorning: { ar: 'الصباح', en: 'Morning', placeholder: true },
  partAfternoon: { ar: 'بعد الظهر', en: 'Afternoon', placeholder: true },
  partEvening: { ar: 'المساء', en: 'Evening', placeholder: true },
  partNight: { ar: 'الليل', en: 'Night', placeholder: true },
  now: { ar: 'الآن', en: 'Now', placeholder: true },

  // The greeting at the top of a home screen; {name} is the reader's own first name
  greetingMorning: { ar: 'صباح الخير، {name}', en: 'Good morning, {name}', placeholder: true },
  greetingEvening: { ar: 'مساء الخير، {name}', en: 'Good evening, {name}', placeholder: true },
  greetingMorningNoName: { ar: 'صباح الخير', en: 'Good morning', placeholder: true },
  greetingEveningNoName: { ar: 'مساء الخير', en: 'Good evening', placeholder: true },

  // The day dial's centre
  nextDose: { ar: 'الجرعة القادمة', en: 'Next dose', placeholder: true },
  noMoreDosesToday: { ar: 'لا جرعات أخرى اليوم', en: 'No more doses today', placeholder: true },
  noDosesThisDay: { ar: 'لا جرعات في هذا اليوم', en: 'No doses on this day', placeholder: true },
  dosesOnThisDay: { ar: 'جرعات هذا اليوم', en: 'Doses on this day', placeholder: true },

  // The week strip
  weekLabel: { ar: 'أيام الأسبوع', en: 'Days of the week', placeholder: true },
  todayMarker: { ar: 'اليوم', en: 'today', placeholder: true },
  // Between two parts of one accessible name ("Monday, 21 September, today")
  listSeparator: { ar: '، ', en: ', ', placeholder: true },

  // The caregiver's home, above the patient's day; {name} is the patient's first name
  caregiverDayOf: { ar: 'جدول {name} اليوم', en: '{name}’s day', placeholder: true },
} as const satisfies Copy<string>;
