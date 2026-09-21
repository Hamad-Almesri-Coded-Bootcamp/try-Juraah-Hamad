/**
 * Pure formatting helpers behind B3/B4 (features/prescription/format.ts). No clock read anywhere —
 * every date/number is passed in (G3/rule 9).
 */
import { describe, expect, it } from 'vitest';
import { formatDoseTimes, formatDurationDays, formatStrength, patternLabel, rxStatusLabel, timelineWhen } from '@/features/prescription/format';

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

describe('formatDurationDays', () => {
  it('renders the duration with its unit word', () => {
    expect(formatDurationDays(90, 'en')).toBe('90 days');
  });

  it('returns null when durationDays is absent', () => {
    expect(formatDurationDays(undefined, 'en')).toBeNull();
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
