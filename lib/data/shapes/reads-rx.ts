/**
 * Projection literals for prescriptions and doses — owned by package WP3a (lead split at Gate 1, D-020/D-022). Only that package edits this file;
 * `lib/data/shapes.ts` is the barrel the lead owns. Rules: docs/briefs/P2-common.md.
 */
import type { Dose, Prescription } from '@/types/contracts';
import type { DoseWithPrescription } from '@/types/views';
import { compact, num, str, type DbRow } from './_core';

/** Prescription — the seed literal's order; the review/discontinuation tail in the order the seed
 * rows carry it (rx-007: status, note, by, at; rx-004: status, reason, date). */
export function toPrescription(r: DbRow): Prescription {
  const dispensing = r.dispensing_units_per_package === null || r.dispensing_units_per_package === undefined ? undefined : compact({
    unitsPerPackage: Number(r.dispensing_units_per_package),
    totalQuantityDispensed: Number(r.dispensing_total_quantity_dispensed),
    dispenseDate: String(r.dispensing_dispense_date),
    brandActuallyDispensed: str(r.dispensing_brand_actually_dispensed),
  });
  return compact({
    id: String(r.id),
    patientId: String(r.patient_id),
    source: { facilityName: String(r.facility_name), sector: r.sector as Prescription['source']['sector'] },
    drug: compact({
      genericName: String(r.generic_name),
      brandName: str(r.brand_name),
      strengthMg: num(r.strength_mg), // the number as written, in strengthUnit's unit — never converted
      strengthUnit: str(r.strength_unit) as Prescription['drug']['strengthUnit'],
    }),
    dosePerAdministration: Number(r.dose_per_administration),
    frequencyPerDay: num(r.frequency_per_day),
    durationDays: Number(r.duration_days),
    dosingPattern: r.dosing_pattern as Prescription['dosingPattern'],
    startDate: str(r.start_date),
    doseTimes: (r.dose_times as string[] | null) ?? undefined,
    prescribedAt: str(r.prescribed_at),
    prescriberName: str(r.prescriber_name),
    timingRelativeToFood: str(r.timing_relative_to_food),
    routeOfAdministration: str(r.route_of_administration),
    specialNotes: str(r.special_notes),
    indication: str(r.indication),
    dispensing,
    needsReview: Boolean(r.needs_review),
    fieldReviewStatus: str(r.field_review_status) as Prescription['fieldReviewStatus'],
    fieldReviewNote: str(r.field_review_note),
    fieldReviewedBy: str(r.field_reviewed_by),
    fieldReviewedAt: str(r.field_reviewed_at),
    status: r.status as Prescription['status'],
    discontinuedReason: str(r.discontinued_reason),
    discontinuedAt: str(r.discontinued_at),
  }) as Prescription;
}

/** Dose — the generator's literal order (id, prescriptionId, scheduledAt, status, tracked, source)
 * with the seed overlay's recordedAt between tracked and source (buildDoses' overlaid literal). */
export function toDose(r: DbRow): Dose {
  return compact({
    id: String(r.id),
    prescriptionId: String(r.prescription_id),
    scheduledAt: String(r.scheduled_at),
    status: r.status as Dose['status'],
    tracked: r.tracked === null || r.tracked === undefined ? undefined : Boolean(r.tracked),
    recordedAt: str(r.recorded_at),
    source: str(r.source) as Dose['source'],
  }) as Dose;
}

/** DoseWithPrescription — the mock's `{...dose, prescriptionId, drug, dosePerAdministration}`:
 * the dose's keys first, then `drug` (strengthUnit only when stored — rx-008), then
 * `dosePerAdministration`. Expects the dose columns plus generic_name, brand_name, strength_mg,
 * strength_unit, dose_per_administration. */
export function toDoseWithPrescription(r: DbRow): DoseWithPrescription {
  return {
    ...toDose(r),
    drug: compact({
      genericName: String(r.generic_name),
      brandName: str(r.brand_name),
      strengthMg: num(r.strength_mg),
      strengthUnit: str(r.strength_unit) as Prescription['drug']['strengthUnit'],
    }),
    dosePerAdministration: Number(r.dose_per_administration),
  } as DoseWithPrescription;
}

// ---------------------------------------------------------------------------------------------
// CR-049 — the deterministic, SIMULATED extraction provider (the mock's byte-size switch). The
// literals below are the mock's (lib/data/mock-impl.ts submitPrescriptionImage) in its key order;
// tests/unit/data/rx-shapes.test.ts proves the two produce the same bytes.
// ---------------------------------------------------------------------------------------------

/** The 1–99-byte branch: a flagged draft with every clinical field unread. */
export function needsReviewDraft(): Partial<Prescription> {
  return { drug: { genericName: '(unreadable)' }, dosePerAdministration: 1, durationDays: 30, dosingPattern: 'daily', needsReview: true, fieldReviewStatus: 'pending', status: 'active' };
}
export const NEEDS_REVIEW_UNCERTAIN_FIELDS = ['strengthMg', 'frequencyPerDay', 'startDate', 'doseTimes'] as const;

/** The ≥100-byte branch: a confident Brufen draft starting on the day of scanning (CR-035). */
export function confidentDraft(startDate: string): Partial<Prescription> {
  return {
    drug: { genericName: 'Ibuprofen', brandName: 'Brufen', strengthMg: 400 }, dosePerAdministration: 1,
    frequencyPerDay: 3, durationDays: 7, dosingPattern: 'daily', doseTimes: ['08:00', '14:00', '20:00'],
    startDate,
    needsReview: false, status: 'active',
  };
}

/** The mock's savePrescriptionDraft record built from a draft (or, for the REFUSAL literal, from no
 * draft at all — never saved). `source` is fabricated exactly as the mock does (CR-042, D-19, not
 * yet enforced). `fieldReviewStatus` falls back to 'pending' even for a confident draft — the
 * mock's own `?? 'pending'`, reproduced for byte equality (see docs/backend-notes/p2-wp3a.md). */
export function prescriptionFromDraft(id: string, patientId: string, draft: Partial<Prescription> | undefined): Prescription {
  return compact({
    id, patientId,
    source: { facilityName: '', sector: 'public' as const },
    drug: draft?.drug ?? { genericName: '(unreadable)' },
    dosePerAdministration: draft?.dosePerAdministration ?? 1,
    frequencyPerDay: draft?.frequencyPerDay,
    durationDays: draft?.durationDays ?? 30,
    dosingPattern: draft?.dosingPattern ?? 'daily',
    startDate: draft?.startDate,
    doseTimes: draft?.doseTimes,
    needsReview: draft?.needsReview ?? true,
    fieldReviewStatus: draft?.fieldReviewStatus ?? 'pending',
    status: 'active' as const,
  }) as Prescription;
}
