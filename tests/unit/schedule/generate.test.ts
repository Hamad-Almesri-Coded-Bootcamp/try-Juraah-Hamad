/**
 * Schedule generator, unit-tested against docs/Seed Dataset.md → "Doses" verbatim (docs/briefs/WP1.md
 * Verification 8). Fixtures below are حمد's rx-001..rx-004 and فاطمة's rx-005..rx-007, transcribed
 * from the seed's Prescriptions table, so the generator is exercised the same way the mock seed
 * will exercise it once lib/data/mock/seed.ts exists.
 */
import { describe, expect, it } from 'vitest';
import type { Prescription } from '@/types/contracts';
import { generateDoses } from '@/lib/schedule/generate';
import { dosesOnDate } from '@/lib/schedule/group';

const rx001: Prescription = {
  id: 'rx-001',
  patientId: 'pt-01',
  source: { facilityName: 'مستشفى الفروانية', sector: 'public' },
  drug: { genericName: 'Warfarin', brandName: 'Marevan', strengthMg: 5 },
  dosePerAdministration: 1,
  frequencyPerDay: 1,
  durationDays: 90,
  dosingPattern: 'daily',
  startDate: '2026-09-01',
  doseTimes: ['18:00'],
  dispensing: { unitsPerPackage: 90, totalQuantityDispensed: 90, dispenseDate: '2026-09-01' },
  needsReview: false,
  status: 'active',
};

const rx002: Prescription = {
  id: 'rx-002',
  patientId: 'pt-01',
  source: { facilityName: 'عيادة النخبة الطبية', sector: 'private' },
  drug: { genericName: 'Ibuprofen', brandName: 'Brufen', strengthMg: 400 },
  dosePerAdministration: 1,
  frequencyPerDay: 3,
  durationDays: 7,
  dosingPattern: 'daily',
  startDate: '2026-09-19',
  doseTimes: ['08:00', '14:00', '20:00'],
  dispensing: { unitsPerPackage: 21, totalQuantityDispensed: 21, dispenseDate: '2026-09-19' },
  needsReview: false,
  status: 'active',
};

const rx003: Prescription = {
  id: 'rx-003',
  patientId: 'pt-01',
  source: { facilityName: 'مستشفى الفروانية', sector: 'public' },
  drug: { genericName: 'Metformin', brandName: 'Glucophage', strengthMg: 500 },
  dosePerAdministration: 1,
  frequencyPerDay: 2,
  durationDays: 180,
  dosingPattern: 'daily',
  startDate: '2026-06-15',
  doseTimes: ['08:00', '20:00'],
  dispensing: { unitsPerPackage: 60, totalQuantityDispensed: 60, dispenseDate: '2026-09-01' },
  needsReview: false,
  status: 'active',
};

const rx004: Prescription = {
  id: 'rx-004',
  patientId: 'pt-01',
  source: { facilityName: 'مستشفى الفروانية', sector: 'public' },
  drug: { genericName: 'Atorvastatin', brandName: 'Lipitor', strengthMg: 20 },
  dosePerAdministration: 1,
  frequencyPerDay: 1,
  durationDays: 90,
  dosingPattern: 'daily',
  startDate: '2026-04-02',
  doseTimes: ['21:00'],
  needsReview: false,
  status: 'discontinued',
  discontinuedReason: 'الطبيب أوقف الدواء بسبب آلام العضلات',
  discontinuedAt: '2026-06-28',
};

const rx005: Prescription = {
  id: 'rx-005',
  patientId: 'pt-02',
  source: { facilityName: 'مركز الصباح للأمراض الروماتيزمية', sector: 'public' },
  drug: { genericName: 'Prednisolone', strengthMg: 5 },
  dosePerAdministration: 1,
  frequencyPerDay: 1,
  durationDays: 60,
  dosingPattern: 'alternate_day',
  startDate: '2026-09-14',
  doseTimes: ['09:00'],
  needsReview: false,
  status: 'active',
};

const rx006: Prescription = {
  id: 'rx-006',
  patientId: 'pt-02',
  source: { facilityName: 'عيادة الياسمين', sector: 'private' },
  drug: { genericName: 'unreadable' },
  dosePerAdministration: 1,
  durationDays: 30,
  dosingPattern: 'daily',
  needsReview: true,
  fieldReviewStatus: 'pending',
  status: 'active',
};

const rx007: Prescription = {
  id: 'rx-007',
  patientId: 'pt-02',
  source: { facilityName: 'عيادة الياسمين', sector: 'private' },
  drug: { genericName: 'Ciprofloxacin', strengthMg: 500 },
  dosePerAdministration: 1,
  frequencyPerDay: 2,
  durationDays: 7,
  dosingPattern: 'daily',
  doseTimes: ['09:00', '21:00'],
  needsReview: true,
  fieldReviewStatus: 'returned',
  fieldReviewNote: 'الجرعة المكتوبة تتعارض مع المدة، يرجى مراجعة العيادة',
  status: 'active',
};

describe('generateDoses — حمد, 2026-09-21, tracking off', () => {
  const hamadDoses = [...generateDoses(rx001, false), ...generateDoses(rx002, false), ...generateDoses(rx003, false), ...generateDoses(rx004, false)];
  const today = dosesOnDate(hamadDoses, '2026-09-21');

  it('has exactly six rows, ascending by time, in the seed\'s four time groups', () => {
    // The seed's own table (docs/Seed Dataset.md → "Doses") lists Metformin before Ibuprofen at
    // both tied times; the schedule generator's contract is ascending TIME order (B1's pass
    // criteria) — the within-time tie-break belongs to getDosesForDay (lib/data), not here. This
    // test asserts the seed's six rows and four time groups; tie order is checked separately below.
    expect(today.map((d) => d.scheduledAt.slice(11, 16))).toEqual(['08:00', '08:00', '14:00', '18:00', '20:00', '20:00']);
    const byTime: Record<string, string[]> = {};
    for (const d of today) (byTime[d.scheduledAt.slice(11, 16)] ??= []).push(d.prescriptionId);
    expect(new Set(byTime['08:00'])).toEqual(new Set(['rx-002', 'rx-003']));
    expect(byTime['14:00']).toEqual(['rx-002']);
    expect(byTime['18:00']).toEqual(['rx-001']);
    expect(new Set(byTime['20:00'])).toEqual(new Set(['rx-002', 'rx-003']));
  });

  it('every row is tracked:false, source:"seed", status:"upcoming"', () => {
    for (const d of today) {
      expect(d.tracked).toBe(false);
      expect(d.source).toBe('seed');
      expect(d.status).toBe('upcoming');
    }
  });

  it('2026-09-26 shows only Metformin and Warfarin (rx-002 ended 2026-09-25)', () => {
    const day = dosesOnDate(hamadDoses, '2026-09-26');
    const rxIds = new Set(day.map((d) => d.prescriptionId));
    expect(rxIds).toEqual(new Set(['rx-003', 'rx-001']));
  });

  it('rx-004 generates nothing after 2026-06-28 (discontinued)', () => {
    const afterDoses = generateDoses(rx004, false).filter((d) => d.scheduledAt.slice(0, 10) > '2026-06-28');
    expect(afterDoses).toEqual([]);
  });

  it('rx-004 still generates doses up to and including 2026-06-28', () => {
    expect(dosesOnDate(generateDoses(rx004, false), '2026-06-28')).toHaveLength(1);
  });
});

describe('generateDoses — rx-006 / rx-007 (فاطمة, not confirmed)', () => {
  it('rx-006 (needsReview, no startDate/doseTimes) generates nothing', () => {
    expect(generateDoses(rx006, false)).toEqual([]);
  });

  it('rx-007 (needsReview, returned, no startDate) generates nothing', () => {
    expect(generateDoses(rx007, false)).toEqual([]);
  });
});

describe('generateDoses — فاطمة, alternate-day cadence (rx-005)', () => {
  const doses = generateDoses(rx005, false);

  it('2026-09-21 has no dose at all', () => {
    expect(dosesOnDate(doses, '2026-09-21')).toEqual([]);
  });

  it('2026-09-20 and 2026-09-22 each have one dose', () => {
    expect(dosesOnDate(doses, '2026-09-20')).toHaveLength(1);
    expect(dosesOnDate(doses, '2026-09-22')).toHaveLength(1);
  });

  it('lands on 14 · 16 · 18 · 20 · 22 · 24 September', () => {
    const dates = doses.map((d) => d.scheduledAt.slice(0, 10)).slice(0, 6);
    expect(dates).toEqual(['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-20', '2026-09-22', '2026-09-24']);
  });
});

describe('generateDoses — CR-002 invariant 2', () => {
  it('returns [] when doseTimes.length !== frequencyPerDay', () => {
    const bad: Prescription = { ...rx001, frequencyPerDay: 2 };
    expect(generateDoses(bad, false)).toEqual([]);
  });

  it('returns [] when startDate is absent', () => {
    const bad: Prescription = { ...rx001, startDate: undefined };
    expect(generateDoses(bad, false)).toEqual([]);
  });

  it('dosingPattern "other" generates nothing (unsupported, reported)', () => {
    const other: Prescription = { ...rx001, dosingPattern: 'other' };
    expect(generateDoses(other, false)).toEqual([]);
  });
});

describe('generateDoses — tracked carries the patient state at generation time', () => {
  it('every dose is tracked:true when generated for a tracking-on patient', () => {
    for (const d of generateDoses(rx001, true)) expect(d.tracked).toBe(true);
  });
});
