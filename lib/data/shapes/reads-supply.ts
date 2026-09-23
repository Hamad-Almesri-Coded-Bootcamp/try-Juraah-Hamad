/**
 * Projection literals for refills and the calendar read — owned by package WP3c (lead split at Gate 1, D-020/D-022). Only that package edits this file;
 * `lib/data/shapes.ts` is the barrel the lead owns. Rules: docs/briefs/P2-common.md.
 *
 * Every literal copies the mock's KEY ORDER (lib/data/mock-impl.ts), because Gate 3 compares the
 * serialised string against tests/fixtures/shapes.json.
 */
import type { CalendarSubscription, RefillRequest } from '@/types/contracts';
import type { RefillLine } from '@/types/views';
import type { Depletion } from '@/lib/schedule/depletion';
import { str, type DbRow } from './_core';

/**
 * RefillLine — the mock's literal order: prescriptionId, genericName, brandName, remaining, total,
 * daysRemaining, routedTo. ONLY brandName is dropped when absent (the mock's `brandName: undefined`
 * vanishes in JSON — rx-005/6/7); the three depletion numbers stay as explicit `null` (the fixture
 * carries `"remaining":null` for a prescription with no dispensing), so compact() is NOT used here.
 * routedTo is derived in SQL from the prescription's own sector. The depletion `d` comes from
 * WP4b's lib/engine/depletion.ts (`depletionFor(row)` → computeDepletion unedited), so the refill
 * screen and the engine map one prescriptions row the same way.
 */
export function toRefillLine(r: DbRow, d: Depletion): RefillLine {
  const brandName = str(r.brand_name);
  return {
    prescriptionId: String(r.id),
    genericName: String(r.generic_name),
    ...(brandName === undefined ? {} : { brandName }),
    remaining: d.remaining,
    total: d.total,
    daysRemaining: d.daysRemaining,
    routedTo: r.routed_to as RefillLine['routedTo'],
  };
}

/** RefillRequest — the seed literal's order (id, patientId, prescriptionId, requestedAt, routedTo, status). */
export function toRefillRequest(r: DbRow): RefillRequest {
  return {
    id: String(r.id),
    patientId: String(r.patient_id),
    prescriptionId: String(r.prescription_id),
    requestedAt: String(r.requested_at),
    routedTo: r.routed_to as RefillRequest['routedTo'],
    status: r.status as RefillRequest['status'],
  };
}

/** CalendarSubscription — patientId, icsUrl, token (the table stores token before ics_url; the
 * contract's order wins). created_at is never projected. Named `…Read` because WP6's
 * shapes/channels.ts exports an identical `toCalendarSubscription` for enableCalendarSync and the
 * lead-owned barrel cannot re-export two members of one name (TS2308). */
export function toCalendarSubscriptionRead(r: DbRow): CalendarSubscription {
  return {
    patientId: String(r.patient_id),
    icsUrl: String(r.ics_url),
    token: String(r.token),
  };
}
