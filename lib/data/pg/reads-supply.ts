/**
 * Postgres implementation — refills and the calendar read. Owned by package WP3c (lead split at Gate 1). Every function
 * runs inside withSession(); RLS/guard triggers refuse; zero rows → the mock's refusal shape
 * (lib/data/refusals/<package>.ts, D-022); projections through lib/data/shapes/<package>.ts (key
 * order). Reads never write (E-48): no append(), no insert, no update anywhere in this file.
 */
import type { DataApi } from '../api';
import { sessionOf } from './_shared';
import { withSession } from '@/lib/db/withSession';
import { depletionFor } from '@/lib/engine/depletion';
import { calendarSubscriptionRefusal, refillOverviewRefusal, refillRequestsRefusal } from '../refusals/reads-supply';
import { toCalendarSubscriptionRead, toRefillLine, toRefillRequest } from '../shapes/reads-supply';

/** Parameterised ($1). Numerics ::float8, dates to_char, timestamps iso_kw(). */
export const PG_QUERIES_SUPPLY = {
  // Active prescriptions of the patient, seed/insertion order (seq) = the mock's store order.
  // `can_read_patient($1)` is stated explicitly on top of RLS: prescriptions_select also lets a
  // reviewer see ANY needs_review row, whereas the mock's canReadPatient admits a reviewer only
  // with an OPEN queue item for this patient — the explicit gate makes the two identical.
  // CR-040 (OPEN): flagged (needs_review / pending / returned) prescriptions are INCLUDED, as the mock.
  // routedTo is derived here from the prescription's own sector (BACKEND-NOTES §2 routing rule).
  // The columns are every one lib/engine/depletion.ts (WP4b → computeDepletion, unedited) reads.
  getRefillOverview: `
    select p.id, p.patient_id, p.facility_name, p.sector::text as sector, p.generic_name, p.brand_name,
           p.dose_per_administration::float8 as dose_per_administration, p.frequency_per_day,
           p.duration_days, p.dosing_pattern::text as dosing_pattern,
           p.dispensing_units_per_package,
           p.dispensing_total_quantity_dispensed::float8 as dispensing_total_quantity_dispensed,
           to_char(p.dispensing_dispense_date, 'YYYY-MM-DD') as dispensing_dispense_date,
           p.dispensing_brand_actually_dispensed,
           p.needs_review, p.status::text as status,
           case when p.sector = 'public' then 'public_pharmacy' else 'private_pharmacy' end as routed_to
    from prescriptions p
    where p.patient_id = $1 and p.status = 'active' and can_read_patient(p.patient_id)
    order by p.seq`,
  // refills_select is exactly can_read_patient(patient_id) — the mock's gate.
  getRefillRequests: `
    select r.id, r.patient_id, r.prescription_id, iso_kw(r.requested_at) as requested_at,
           r.routed_to::text as routed_to, r.status::text as status
    from refill_requests r
    where r.patient_id = $1
    order by r.seq`,
  // calendar_select: the owning patient's own session only (and the system actor, which the seam
  // never passes). A caregiver, reviewer or admin gets zero rows → null, as the mock.
  getCalendarSubscription: `
    select c.patient_id, c.ics_url, c.token
    from calendar_subscriptions c
    where c.patient_id = $1`,
} as const;

export const getRefillOverview: DataApi['getRefillOverview'] = async (patientId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_SUPPLY.getRefillOverview, [patientId]);
    if (rows.length === 0) return refillOverviewRefusal();
    return rows.map((r) => toRefillLine(r, depletionFor(r)));
  });
};

export const getRefillRequests: DataApi['getRefillRequests'] = async (patientId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_SUPPLY.getRefillRequests, [patientId]);
    if (rows.length === 0) return refillRequestsRefusal();
    return rows.map(toRefillRequest);
  });
};

export const getCalendarSubscription: DataApi['getCalendarSubscription'] = async (patientId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_SUPPLY.getCalendarSubscription, [patientId]);
    return row ? toCalendarSubscriptionRead(row) : calendarSubscriptionRefusal();
  });
};
