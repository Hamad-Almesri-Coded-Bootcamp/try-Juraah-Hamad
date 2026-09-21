/**
 * Depletion, unit-tested against docs/Seed Dataset.md's dispensing figures and the read of them in
 * docs/DECISIONS.md CR-014 ("rx-001 90 dispensed 2026-09-01 at 1/day → ≈70/90, ≈70 days; rx-003 60
 * dispensed 2026-09-01 at 2/day → ≈20/60, ≈10 days"), computed against REFERENCE_NOW (2026-09-21).
 */
import { describe, expect, it } from 'vitest';
import type { Prescription } from '@/types/contracts';
import { computeDepletion } from '@/lib/schedule/depletion';

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

const rx005NoDispensing: Prescription = {
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

const rx009NoDispensing: Prescription = {
  id: 'rx-009',
  patientId: 'pt-03',
  source: { facilityName: 'عيادة النخبة الطبية', sector: 'private' },
  drug: { genericName: 'Calcium carbonate + vitamin D3', strengthMg: 500 },
  dosePerAdministration: 1,
  frequencyPerDay: 2,
  durationDays: 90,
  dosingPattern: 'daily',
  startDate: '2026-09-05',
  doseTimes: ['13:00', '21:00'],
  needsReview: false,
  fieldReviewStatus: 'confirmed',
  status: 'active',
};

describe('computeDepletion', () => {
  it('rx-001: 90 dispensed 2026-09-01 at 1/day → 70 remaining, 70 days', () => {
    expect(computeDepletion(rx001)).toEqual({ remaining: 70, total: 90, daysRemaining: 70 });
  });

  it('rx-003: 60 dispensed 2026-09-01 at 2/day → 20 remaining, 10 days', () => {
    expect(computeDepletion(rx003)).toEqual({ remaining: 20, total: 60, daysRemaining: 10 });
  });

  it('rx-005 (no dispensing) → no estimate at all', () => {
    expect(computeDepletion(rx005NoDispensing)).toEqual({ remaining: null, total: null, daysRemaining: null });
  });

  it('rx-009 (no dispensing) → no estimate at all', () => {
    expect(computeDepletion(rx009NoDispensing)).toEqual({ remaining: null, total: null, daysRemaining: null });
  });
});
