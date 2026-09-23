/**
 * Database row ↔ contract mapping for the engine (P2-WP4b), and the two loaders every engine write
 * starts from. The engine keeps its own mapper instead of importing lib/data/shapes/** (another
 * package's file, in flux): tests/unit/engine/rows.test.ts proves this mapper and WP3a's
 * `toPrescription` agree on every seed prescription.
 *
 * Built for the projection in ./sql.ts (dates via to_char, numerics cast to float8, timestamps via
 * iso_kw). For `date` and `numeric` columns it also accepts the raw driver's forms (a JS Date at UTC
 * midnight, a numeric string) — everything depletion reads — so WP3c may hand `depletionFor` an
 * uncast row. It does NOT reformat a raw `timestamptz` (a JS Date for prescribed_at /
 * field_reviewed_at would become a non-ISO string): select those through iso_kw().
 */
import type { Dose, Prescription } from '@/types/contracts';
import type { Tx } from '@/lib/db/withSession';
import { ENGINE_SQL } from './sql';

export type DbRow = Record<string, unknown>;

const isAbsent = (v: unknown): v is null | undefined => v === null || v === undefined;

function optStr(v: unknown): string | undefined {
  return isAbsent(v) ? undefined : String(v);
}

function optNum(v: unknown): number | undefined {
  return isAbsent(v) ? undefined : Number(v);
}

/** A `date` column: 'YYYY-MM-DD' text as projected, or the driver's Date (UTC midnight of that date). */
function optDate(v: unknown): string | undefined {
  if (isAbsent(v)) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/** Drops undefined keys so the key SET equals the seed literal's (never `undefined`, never `null`). */
function dropAbsent<T extends object>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (!isAbsent(v)) out[k] = v;
  return out as T;
}

export function prescriptionFromRow(r: DbRow): Prescription {
  const dispensing = isAbsent(r.dispensing_units_per_package)
    ? undefined
    : dropAbsent({
        unitsPerPackage: Number(r.dispensing_units_per_package),
        totalQuantityDispensed: Number(r.dispensing_total_quantity_dispensed),
        dispenseDate: optDate(r.dispensing_dispense_date) as string,
        brandActuallyDispensed: optStr(r.dispensing_brand_actually_dispensed),
      });
  return dropAbsent({
    id: String(r.id),
    patientId: String(r.patient_id),
    source: { facilityName: String(r.facility_name), sector: String(r.sector) as Prescription['source']['sector'] },
    drug: dropAbsent({
      genericName: String(r.generic_name),
      brandName: optStr(r.brand_name),
      strengthMg: optNum(r.strength_mg), // the number as written, in strengthUnit's unit — never converted
      strengthUnit: optStr(r.strength_unit) as Prescription['drug']['strengthUnit'],
    }),
    dosePerAdministration: Number(r.dose_per_administration),
    frequencyPerDay: optNum(r.frequency_per_day),
    durationDays: Number(r.duration_days),
    dosingPattern: String(r.dosing_pattern) as Prescription['dosingPattern'],
    startDate: optDate(r.start_date),
    doseTimes: isAbsent(r.dose_times) ? undefined : (r.dose_times as string[]).map(String),
    prescribedAt: optStr(r.prescribed_at),
    prescriberName: optStr(r.prescriber_name),
    timingRelativeToFood: optStr(r.timing_relative_to_food),
    routeOfAdministration: optStr(r.route_of_administration),
    specialNotes: optStr(r.special_notes),
    indication: optStr(r.indication),
    dispensing,
    needsReview: Boolean(r.needs_review),
    fieldReviewStatus: optStr(r.field_review_status) as Prescription['fieldReviewStatus'],
    fieldReviewNote: optStr(r.field_review_note),
    fieldReviewedBy: optStr(r.field_reviewed_by),
    fieldReviewedAt: optStr(r.field_reviewed_at),
    status: String(r.status) as Prescription['status'],
    discontinuedReason: optStr(r.discontinued_reason),
    discontinuedAt: optDate(r.discontinued_at),
  }) as Prescription;
}

/** Key order of a generated dose (id, prescriptionId, scheduledAt, status, tracked), then recordedAt, source. */
export function doseFromRow(r: DbRow): Dose {
  return dropAbsent({
    id: String(r.id),
    prescriptionId: String(r.prescription_id),
    scheduledAt: String(r.scheduled_at),
    status: String(r.status) as Dose['status'],
    tracked: isAbsent(r.tracked) ? undefined : Boolean(r.tracked),
    recordedAt: optStr(r.recorded_at),
    source: optStr(r.source) as Dose['source'],
  }) as Dose;
}

/** The prescription as the engine needs it, or null when the caller's session cannot see it (RLS). */
export async function loadPrescription(sql: Tx, prescriptionId: string): Promise<Prescription | null> {
  const rows = await sql.unsafe(ENGINE_SQL.loadPrescription, [prescriptionId]);
  const row = rows[0];
  return row ? prescriptionFromRow(row) : null;
}

/** Every dose of one prescription the caller can see, in generator order. */
export async function loadDoses(sql: Tx, prescriptionId: string): Promise<Dose[]> {
  const rows = await sql.unsafe(ENGINE_SQL.loadDoses, [prescriptionId]);
  return rows.map((r) => doseFromRow(r));
}

/** The jsonb parameter of ENGINE_SQL.insertDoses, as a value — the driver serialises it (see
 * lib/engine/sql.ts's header). `status` is deliberately not carried. */
export function doseInsertPayload(doses: readonly Dose[], source: NonNullable<Dose['source']>) {
  return doses.map((d) => ({ id: d.id, prescription_id: d.prescriptionId, scheduled_at: d.scheduledAt, tracked: d.tracked ?? true, source }));
}
