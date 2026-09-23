/**
 * Pure formatting/grouping helpers behind B1/B2 (features/day/format.ts). No clock read anywhere —
 * every date/time is passed in, matching the file's own doc comment (G3/rule 9).
 */
import { describe, expect, it } from 'vitest';
import { formatDoseAmount, formatDoseCount, formatDoseTime, formatTodayDoseTimeLabel, groupDosesByTime, pickNextOrMostRecent, timeOfIso } from '@/features/day/format';
import type { DoseWithPrescription } from '@/types/views';

function dose(overrides: Partial<DoseWithPrescription> & Pick<DoseWithPrescription, 'scheduledAt'>): DoseWithPrescription {
  return {
    id: `d-${overrides.scheduledAt}`,
    prescriptionId: 'rx-002',
    status: 'upcoming',
    tracked: false,
    source: 'seed',
    drug: { genericName: 'Ibuprofen', brandName: 'Brufen', strengthMg: 400 },
    dosePerAdministration: 1,
    ...overrides,
  };
}

describe('timeOfIso', () => {
  it('slices the HH:mm out of a Kuwait-offset ISO datetime', () => {
    expect(timeOfIso('2026-09-21T18:00:00+03:00')).toBe('18:00');
  });
});

describe('groupDosesByTime', () => {
  it("groups حمد's six seed doses (08:00×2, 14:00, 18:00, 20:00×2) into four time groups", () => {
    const doses = [
      dose({ scheduledAt: '2026-09-21T08:00:00+03:00', prescriptionId: 'rx-003' }),
      dose({ scheduledAt: '2026-09-21T08:00:00+03:00', prescriptionId: 'rx-002' }),
      dose({ scheduledAt: '2026-09-21T14:00:00+03:00', prescriptionId: 'rx-002' }),
      dose({ scheduledAt: '2026-09-21T18:00:00+03:00', prescriptionId: 'rx-001' }),
      dose({ scheduledAt: '2026-09-21T20:00:00+03:00', prescriptionId: 'rx-003' }),
      dose({ scheduledAt: '2026-09-21T20:00:00+03:00', prescriptionId: 'rx-002' }),
    ];
    const groups = groupDosesByTime(doses);
    expect(groups.map((g) => g.time)).toEqual(['08:00', '14:00', '18:00', '20:00']);
    expect(groups[0]!.doses).toHaveLength(2);
    expect(groups[3]!.doses).toHaveLength(2);
  });

  it('returns an empty array for an empty day', () => {
    expect(groupDosesByTime([])).toEqual([]);
  });
});

describe('pickNextOrMostRecent', () => {
  const referenceIso = '2026-09-21T09:15:00+03:00'; // REFERENCE_NOW
  it('picks the most recent dose that has already passed', () => {
    const doses = [
      dose({ scheduledAt: '2026-09-21T08:00:00+03:00' }),
      dose({ scheduledAt: '2026-09-21T14:00:00+03:00' }),
      dose({ scheduledAt: '2026-09-21T20:00:00+03:00' }),
    ];
    expect(pickNextOrMostRecent(doses, referenceIso)!.scheduledAt).toBe('2026-09-21T08:00:00+03:00');
  });

  it('picks the earliest upcoming dose when none has passed yet', () => {
    const doses = [dose({ scheduledAt: '2026-09-21T14:00:00+03:00' }), dose({ scheduledAt: '2026-09-21T20:00:00+03:00' })];
    expect(pickNextOrMostRecent(doses, referenceIso)!.scheduledAt).toBe('2026-09-21T14:00:00+03:00');
  });

  it('returns undefined for a prescription with no dose that day', () => {
    expect(pickNextOrMostRecent([], referenceIso)).toBeUndefined();
  });
});

describe('formatDoseAmount', () => {
  it('formats a single tablet with its strength, English', () => {
    expect(formatDoseAmount({ dosePerAdministration: 1, drug: { genericName: 'Warfarin', strengthMg: 5 } }, 'en')).toBe('One tablet · 5 mg');
  });

  it('appends the strengthUnit exactly as written — never converts it (rx-008, 50 mcg, never 0.05)', () => {
    expect(formatDoseAmount({ dosePerAdministration: 1, drug: { genericName: 'Levothyroxine', strengthMg: 50, strengthUnit: 'mcg' } }, 'en')).toBe('One tablet · 50 mcg');
  });

  it('omits the strength line entirely when strengthMg is absent', () => {
    expect(formatDoseAmount({ dosePerAdministration: 1, drug: { genericName: '(unreadable)' } }, 'en')).toBe('One tablet');
  });

  it('Arabic: Arabic-Indic digits and the Arabic unit word, never "mg" (audit M7)', () => {
    expect(formatDoseAmount({ dosePerAdministration: 1, drug: { genericName: 'Ibuprofen', strengthMg: 400 } }, 'ar')).toBe('حبة واحدة · ٤٠٠ ملغم');
    expect(formatDoseAmount({ dosePerAdministration: 1, drug: { genericName: 'Levothyroxine', strengthMg: 50, strengthUnit: 'mcg' } }, 'ar')).toBe('حبة واحدة · ٥٠ ميكروغرام');
  });
});

describe('formatDoseCount — the amount as a person says it (audit M9, UX §3: never a bare number)', () => {
  it('one and several, in both languages', () => {
    expect(formatDoseCount(1, 'en')).toBe('One tablet');
    expect(formatDoseCount(1, 'ar')).toBe('حبة واحدة');
    expect(formatDoseCount(2, 'en')).toBe('2 tablets');
    expect(formatDoseCount(2, 'ar')).not.toMatch(/[0-9]/);
  });
});

describe('formatDoseTime / formatTodayDoseTimeLabel', () => {
  it('formats the clock time in English digits', () => {
    expect(formatDoseTime('2026-09-21T18:00:00+03:00', 'en')).toBe('18:00');
  });

  it('prefixes "Today" for the B2 card label', () => {
    expect(formatTodayDoseTimeLabel('2026-09-21T20:00:00+03:00', 'en')).toBe('Today 20:00');
  });
});
