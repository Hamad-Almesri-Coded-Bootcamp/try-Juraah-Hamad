/**
 * Pure formatting helpers behind B3/B4 (features/prescription/format.ts). No clock read anywhere —
 * every date/number is passed in (G3/rule 9).
 */
import { describe, expect, it } from 'vitest';
import {
  draftFields,
  formatDoseTimes,
  formatDurationDays,
  formatStrength,
  historyWhen,
  medicineNames,
  patternLabel,
  prescriptionFields,
  rxStatusLabel,
  splitDoseHistory,
  timelineWhen,
} from '@/features/prescription/format';
import { buildPrescriptions } from '@/lib/data/mock/seed';
import type { Prescription } from '@/types/contracts';

const seedRx = (id: string): Prescription => buildPrescriptions().find((p) => p.id === id)!;

describe('formatStrength', () => {
  it('renders rx-008 as "50 mcg", never converting to 0.05 (guard U)', () => {
    expect(formatStrength({ strengthMg: 50, strengthUnit: 'mcg' }, 'en')).toBe('50 mcg');
  });

  it('defaults to "mg" when strengthUnit is absent', () => {
    expect(formatStrength({ strengthMg: 5 }, 'en')).toBe('5 mg');
  });

  it('returns null when strengthMg itself is absent (rx-006, core-fields-only)', () => {
    expect(formatStrength({}, 'en')).toBeNull();
    expect(formatStrength(undefined, 'en')).toBeNull();
  });
});

describe('formatDoseTimes', () => {
  it('joins every dose time in order', () => {
    expect(formatDoseTimes(['08:00', '14:00', '20:00'], 'en')).toBe('8:00 · 14:00 · 20:00');
  });

  it('returns null for an absent or empty list (rx-006)', () => {
    expect(formatDoseTimes(undefined, 'en')).toBeNull();
    expect(formatDoseTimes([], 'en')).toBeNull();
  });
});

describe('formatStrength — Arabic (audit M7)', () => {
  it('Arabic-Indic digits and the one Arabic unit word, never a Latin abbreviation', () => {
    expect(formatStrength({ strengthMg: 5 }, 'ar')).toBe('٥ ملغم');
    expect(formatStrength({ strengthMg: 50, strengthUnit: 'mcg' }, 'ar')).toBe('٥٠ ميكروغرام');
  });
});

describe('formatDurationDays', () => {
  it('renders the duration with its unit word', () => {
    expect(formatDurationDays(90, 'en')).toBe('90 days');
  });

  it('returns null when durationDays is absent', () => {
    expect(formatDurationDays(undefined, 'en')).toBeNull();
  });

  it('Arabic picks the counted-noun form — rx-002/rx-007 run 7 days (٧ أيام, never "٧ يومًا")', () => {
    expect(formatDurationDays(7, 'ar')).toBe('٧ أيام');
    expect(formatDurationDays(90, 'ar')).toBe('٩٠ يومًا');
    expect(formatDurationDays(180, 'ar')).toBe('١٨٠ يومًا');
    expect(formatDurationDays(1, 'en')).toBe('1 day');
  });
});

describe('splitDoseHistory — B3/F3 dose history window (audit M8)', () => {
  const now = '2026-09-21T09:15:00+03:00'; // REFERENCE_NOW, passed in — this module reads no clock
  const at = (date: string, time = '18:00') => ({ scheduledAt: `${date}T${time}:00+03:00` });
  // One dose a day, 1 Sept → 29 Nov: Warfarin's shape (rx-001, 90 days from 1 Sept).
  const days = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 1 + i));
    return d.toISOString().slice(0, 10);
  });
  const history = days.map((d) => at(d));

  it('splits at now: past newest-first, planned soonest-first, nothing dropped', () => {
    const split = splitDoseHistory(history, now);
    expect(split.past.length + split.planned.length).toBe(90);
    expect(split.past[0]!.scheduledAt).toBe('2026-09-20T18:00:00+03:00'); // today's 18:00 has not happened yet
    expect(split.past.at(-1)!.scheduledAt).toBe('2026-09-01T18:00:00+03:00');
    expect(split.planned[0]!.scheduledAt).toBe('2026-09-21T18:00:00+03:00');
    expect(split.planned.at(-1)!.scheduledAt).toBe('2026-11-29T18:00:00+03:00');
  });

  it('shows the last 7 days and the next 7 days (today included in each), and counts the rest', () => {
    const split = splitDoseHistory(history, now);
    // past window 15–21 Sept → 15..20 (six doses: today's 18:00 is still planned)
    expect(split.pastVisible).toBe(6);
    // planned window 21–27 Sept → seven doses
    expect(split.plannedVisible).toBe(7);
    expect(split.planned.slice(0, split.plannedVisible).at(-1)!.scheduledAt).toBe('2026-09-27T18:00:00+03:00');
  });

  it('a dose earlier today is past; a dose later today is planned', () => {
    const split = splitDoseHistory([at('2026-09-21', '08:00'), at('2026-09-21', '20:00')], now);
    expect(split.past.map((d) => d.scheduledAt)).toEqual(['2026-09-21T08:00:00+03:00']);
    expect(split.planned.map((d) => d.scheduledAt)).toEqual(['2026-09-21T20:00:00+03:00']);
  });

  it('a finished course (every dose older than the window — rx-004, stopped 28 June) shows its own last 7 days, never an empty list', () => {
    const june = Array.from({ length: 20 }, (_, i) => at(`2026-06-${String(9 + i).padStart(2, '0')}`, '21:00')); // 9–28 June
    const split = splitDoseHistory(june, now);
    expect(split.past.length).toBe(20);
    expect(split.pastVisible).toBe(7); // 22–28 June, the course's last week
    expect(split.past.slice(0, split.pastVisible).at(-1)!.scheduledAt).toBe('2026-06-22T21:00:00+03:00');
  });

  it('a course that starts later than the window shows its own first 7 days, never an empty list', () => {
    const october = Array.from({ length: 10 }, (_, i) => at(`2026-10-${String(10 + i).padStart(2, '0')}`)); // 10–19 Oct
    const split = splitDoseHistory(october, now);
    expect(split.plannedVisible).toBe(7); // 10–16 Oct
  });

  it('keeps each row object as given — tracked/status pass through untouched (rule 3)', () => {
    const row = { scheduledAt: '2026-09-19T18:00:00+03:00', tracked: false, status: 'upcoming' as const };
    expect(splitDoseHistory([row], now).past[0]).toBe(row);
  });
});

describe('patternLabel', () => {
  it('labels every dosing pattern', () => {
    expect(patternLabel('daily', 'en')).toBe('Daily');
    expect(patternLabel('alternate_day', 'en')).toBe('Every other day');
    expect(patternLabel('other', 'en')).toBe('Other pattern');
  });
});

describe('rxStatusLabel', () => {
  it('labels every prescription status', () => {
    expect(rxStatusLabel('active', 'en')).toBe('Active');
    expect(rxStatusLabel('completed', 'en')).toBe('Completed');
    expect(rxStatusLabel('discontinued', 'en')).toBe('Discontinued');
  });
});

describe('timelineWhen', () => {
  it('splits a scheduledAt into a date label and a time label', () => {
    const { dateLabel, timeLabel } = timelineWhen('2026-09-21T18:00:00+03:00', 'en');
    expect(dateLabel).toBe('September 21, 2026');
    expect(timeLabel).toBe('18:00');
  });
});

describe('medicineNames — brand first, in the reader’s language (CR-069(l), CR-071)', () => {
  it('leads with the brand and keeps the generic as the second line', () => {
    expect(medicineNames({ genericName: 'Warfarin', brandName: 'Marevan' }, 'en')).toEqual({ primary: 'Marevan', generic: 'Warfarin' });
    expect(medicineNames({ genericName: 'Warfarin', brandName: 'Marevan' }, 'ar')).toEqual({ primary: 'ماريفان', generic: 'وارفارين' });
  });
  it('a generic-only record leads with the generic and has no second line', () => {
    expect(medicineNames({ genericName: 'Prednisolone' }, 'ar')).toEqual({ primary: 'بريدنيزولون', generic: null });
  });
  it('never returns the seed’s literal "(unreadable)"', () => {
    for (const locale of ['ar', 'en'] as const) expect(medicineNames({ genericName: '(unreadable)' }, locale).primary).not.toContain('(unreadable)');
  });
});

describe('prescriptionFields — every contract field, named once (B3, F3)', () => {
  it('rx-001: every field is present in the list, dispensing included, with values only where the seed has them', () => {
    const fields = prescriptionFields(seedRx('rx-001'), 'en');
    expect(fields.map((f) => f.key)).toEqual([
      'genericName', 'brandName', 'strengthMg', 'dosePerAdministration', 'frequencyPerDay', 'dosingPattern', 'doseTimes', 'startDate',
      'durationDays', 'timingRelativeToFood', 'routeOfAdministration', 'indication', 'specialNotes', 'prescriberName', 'prescribedAt', 'status',
      'unitsPerPackage', 'totalQuantityDispensed', 'dispenseDate', 'brandActuallyDispensed',
    ]);
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f.value]));
    expect(byKey.strengthMg).toBe('5 mg');
    expect(byKey.dosePerAdministration).toBe('One tablet');
    expect(byKey.dispenseDate).toBe('September 1, 2026');
    expect(byKey.prescriberName).toBeNull(); // not in the seed, never invented
    expect(byKey.brandActuallyDispensed).toBeNull();
  });

  it('rx-004 (discontinued): the reason and date join the list, the reason in the reader’s language', () => {
    const en = Object.fromEntries(prescriptionFields(seedRx('rx-004'), 'en').map((f) => [f.key, f.value]));
    expect(en.discontinuedReason).toBe('The doctor stopped this medicine because of muscle pain.');
    expect(en.discontinuedAt).toBe('June 28, 2026');
  });

  it('rx-008: 50 mcg stays 50 mcg (guard U)', () => {
    expect(prescriptionFields(seedRx('rx-008'), 'en').find((f) => f.key === 'strengthMg')?.value).toBe('50 mcg');
  });

  it('Arabic values carry no Latin script and no Western digit (CR-071, audit M7)', () => {
    for (const id of ['rx-001', 'rx-004', 'rx-006', 'rx-008', 'rx-009']) {
      for (const f of prescriptionFields(seedRx(id), 'ar')) expect(`${f.label} ${f.value ?? ''}`).not.toMatch(/[A-Za-z0-9]/);
    }
  });
});

describe('draftFields — B4’s review keys are the contract’s own, so uncertainFields mark the right rows', () => {
  it('names the mock extraction’s uncertain fields by the same keys', () => {
    const keys = draftFields({ drug: { genericName: '(unreadable)' }, dosePerAdministration: 1, durationDays: 30, dosingPattern: 'daily' }, 'en').map((f) => f.key);
    for (const k of ['strengthMg', 'frequencyPerDay', 'startDate', 'doseTimes']) expect(keys).toContain(k);
  });
  it('absent values are null, never "undefined" or an empty string', () => {
    const fields = draftFields({ drug: { genericName: 'Ibuprofen' }, durationDays: 7 }, 'en');
    for (const f of fields) expect(f.value === null || (typeof f.value === 'string' && f.value.length > 0 && !f.value.includes('undefined'))).toBe(true);
  });
});

describe('historyWhen — a calm day label and the clock time', () => {
  it('weekday and date, no year; the time in the reader’s digits', () => {
    expect(historyWhen('2026-09-20T18:00:00+03:00', 'en')).toEqual({ dateLabel: 'Sunday, September 20', timeLabel: '18:00' });
    expect(historyWhen('2026-09-20T18:00:00+03:00', 'ar').timeLabel).toBe('١٨:٠٠');
  });
});
