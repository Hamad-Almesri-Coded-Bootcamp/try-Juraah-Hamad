/**
 * P2-WP4b — the engine's row mappers and depletionFor, against the seed's own records
 * (lib/data/mock/seed.ts). A prescription is turned into the row the database projection returns
 * (ENGINE_SQL.loadPrescription's column aliases) and into the row the raw driver returns (numeric
 * as a string, `date` as a Date); both must map back to the seed record exactly, agree with WP3a's
 * projection literal, and give computeDepletion's own answer.
 */
import { describe, expect, it } from 'vitest';
import type { Prescription } from '@/types/contracts';
import { buildDoses, buildPrescriptions, buildSettings } from '@/lib/data/mock/seed';
import { computeDepletion } from '@/lib/schedule/depletion';
import { depletionFor } from '@/lib/engine/depletion';
import { doseFromRow, prescriptionFromRow } from '@/lib/engine/rows';
import { toPrescription } from '@/lib/data/shapes/reads-rx';
import { doseRow } from './fakeTx';

/** The row ENGINE_SQL.loadPrescription (and lib/data/pg/reads-rx.ts) projects for this record. */
function projectedRow(p: Prescription): Record<string, unknown> {
  return {
    id: p.id, patient_id: p.patientId, facility_name: p.source.facilityName, sector: p.source.sector,
    generic_name: p.drug.genericName, brand_name: p.drug.brandName ?? null, strength_mg: p.drug.strengthMg ?? null,
    strength_unit: p.drug.strengthUnit ?? null, dose_per_administration: p.dosePerAdministration,
    frequency_per_day: p.frequencyPerDay ?? null, duration_days: p.durationDays, dosing_pattern: p.dosingPattern,
    start_date: p.startDate ?? null, dose_times: p.doseTimes ?? null, prescribed_at: p.prescribedAt ?? null,
    prescriber_name: p.prescriberName ?? null, timing_relative_to_food: p.timingRelativeToFood ?? null,
    route_of_administration: p.routeOfAdministration ?? null, special_notes: p.specialNotes ?? null, indication: p.indication ?? null,
    dispensing_units_per_package: p.dispensing?.unitsPerPackage ?? null,
    dispensing_total_quantity_dispensed: p.dispensing?.totalQuantityDispensed ?? null,
    dispensing_dispense_date: p.dispensing?.dispenseDate ?? null,
    dispensing_brand_actually_dispensed: p.dispensing?.brandActuallyDispensed ?? null,
    needs_review: p.needsReview, field_review_status: p.fieldReviewStatus ?? null, field_reviewed_by: p.fieldReviewedBy ?? null,
    field_reviewed_at: p.fieldReviewedAt ?? null, field_review_note: p.fieldReviewNote ?? null, status: p.status,
    discontinued_reason: p.discontinuedReason ?? null, discontinued_at: p.discontinuedAt ?? null,
  };
}

/** The same row as the `postgres` driver hands it back without casts: numeric → string, date → Date. */
function rawDriverRow(p: Prescription): Record<string, unknown> {
  const r = projectedRow(p);
  const asDate = (v: unknown) => (typeof v === 'string' ? new Date(`${v}T00:00:00Z`) : v);
  const asNumeric = (v: unknown) => (typeof v === 'number' ? String(v) : v);
  return {
    ...r,
    strength_mg: asNumeric(r.strength_mg), dose_per_administration: asNumeric(r.dose_per_administration),
    dispensing_total_quantity_dispensed: asNumeric(r.dispensing_total_quantity_dispensed),
    start_date: asDate(r.start_date), dispensing_dispense_date: asDate(r.dispensing_dispense_date), discontinued_at: asDate(r.discontinued_at),
  };
}

const prescriptions = buildPrescriptions();

describe('prescriptionFromRow — every seed prescription survives the row round trip', () => {
  it.each(prescriptions.map((p) => [p.id, p] as const))('%s — projected row', (_id, p) => {
    expect(prescriptionFromRow(projectedRow(p))).toEqual(p);
  });
  it.each(prescriptions.map((p) => [p.id, p] as const))('%s — raw driver row (numeric strings, Date dates)', (_id, p) => {
    expect(prescriptionFromRow(rawDriverRow(p))).toEqual(p);
  });
  it.each(prescriptions.map((p) => [p.id, p] as const))('%s — agrees with WP3a toPrescription on the same row', (_id, p) => {
    expect(prescriptionFromRow(projectedRow(p))).toEqual(toPrescription(projectedRow(p)));
  });
  it('rx-008 keeps strengthMg 50 in mcg — never converted', () => {
    const rx = prescriptionFromRow(rawDriverRow(prescriptions.find((p) => p.id === 'rx-008')!));
    expect(rx.drug).toEqual({ genericName: 'Levothyroxine', brandName: 'Eltroxin', strengthMg: 50, strengthUnit: 'mcg' });
  });
});

describe('depletionFor — computeDepletion, unedited, on the mapped row', () => {
  it.each(prescriptions.map((p) => [p.id, p] as const))('%s', (_id, p) => {
    expect(depletionFor(projectedRow(p))).toEqual(computeDepletion(p));
    expect(depletionFor(rawDriverRow(p))).toEqual(computeDepletion(p));
  });
  it('no dispensing (rx-005, rx-009) → null, never an estimate', () => {
    for (const id of ['rx-005', 'rx-009']) {
      expect(depletionFor(projectedRow(prescriptions.find((p) => p.id === id)!))).toEqual({ remaining: null, total: null, daysRemaining: null });
    }
  });
  it('rx-003 (60 tablets from 2026-09-01, 2/day, 20 days elapsed at REFERENCE_NOW) → 20 remaining, 10 days', () => {
    expect(depletionFor(projectedRow(prescriptions.find((p) => p.id === 'rx-003')!))).toEqual({ remaining: 20, total: 60, daysRemaining: 10 });
  });
});

describe('doseFromRow — every seed dose survives the row round trip', () => {
  const settings = buildSettings();
  const doses = buildDoses(prescriptions, new Map(settings.map((s) => [s.patientId, s])));
  it(`all ${doses.length} doses`, () => {
    const back = doses.map((d) => doseFromRow(doseRow(d)));
    expect(JSON.stringify(back)).toBe(JSON.stringify(doses));
  });
});
