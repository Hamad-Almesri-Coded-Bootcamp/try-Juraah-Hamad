/**
 * Discontinuation (docs/Acceptance Criteria and Test Plan.md → PHASE 2 → "Schedule & depletion
 * logic": "cancels remaining doses on discontinuation"; AI Agents TC-RS-03: "remaining future
 * doses cancelled; `status: discontinued` with reason and timestamp; past logs untouched").
 *
 * SEMANTICS (see docs/backend-notes/p2-wp4.md for why, and what the owner should confirm):
 *
 *  1. The prescription comes back as a NEW object with `status: 'discontinued'`, `discontinuedAt`
 *     and `discontinuedReason` set exactly as given. Nothing else on it changes.
 *  2. A dose is cancelled (removed from the returned list, its id listed in `cancelledDoseIds`)
 *     only if ALL of: it belongs to this prescription · it is still `upcoming` · its calendar date
 *     is strictly AFTER the calendar date of `discontinuedAt`. The discontinuation day itself is
 *     INCLUSIVE — the same boundary `generateDoses` applies (rx-004 stops generating "after
 *     2026-06-28", not before it) — so this function and the generator always agree, and a
 *     recompute after a discontinuation changes nothing. Both sides are reduced to "YYYY-MM-DD"
 *     with `dateOf`, so `discontinuedAt` may be a bare date (the seed's form) or a full datetime.
 *  3. A dose that carries a recorded status (anything but `upcoming`) is NEVER removed or changed,
 *     whatever its date — past logs are untouched (TC-RS-03), and a backdated discontinuation
 *     does not erase what the patient already reported.
 *  4. Doses of other prescriptions pass through untouched.
 *  5. Only an `active` prescription transitions. A prescription already `discontinued` (or
 *     `completed`) is returned unchanged with every dose kept and `cancelledDoseIds: []` — the
 *     first discontinuation's date and reason are the record; re-discontinuing does not rewrite
 *     them.
 *
 * Nothing here assigns a dose status (rule 1 / G1): doses are kept or dropped, never rewritten.
 * Nothing here compares a dose to "now" (rule 4): the only comparison is a dose's date against the
 * prescription's own `discontinuedAt`. Pure — no clock, no I/O, inputs are not mutated.
 */
import type { Dose, Prescription } from '@/types/contracts';
import { dateOf } from './dates';

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

export interface Discontinuation {
  prescription: Prescription;
  doses: Dose[];
  cancelledDoseIds: string[];
}

export function discontinuePrescription(
  prescription: Prescription,
  existingDoses: readonly Dose[],
  discontinuedAt: string,
  reason: string,
): Discontinuation {
  if (!ISO_DATE_PREFIX.test(discontinuedAt)) {
    throw new RangeError(`discontinuePrescription: discontinuedAt is not an ISO date: ${JSON.stringify(discontinuedAt)}`);
  }

  if (prescription.status !== 'active') {
    return { prescription: { ...prescription }, doses: existingDoses.map((d) => ({ ...d })), cancelledDoseIds: [] };
  }

  const lastDay = dateOf(discontinuedAt);
  const isCancelled = (d: Dose): boolean =>
    d.prescriptionId === prescription.id && d.status === 'upcoming' && dateOf(d.scheduledAt) > lastDay;

  const cancelledDoseIds: string[] = [];
  const kept: Dose[] = [];
  for (const d of existingDoses) {
    if (isCancelled(d)) cancelledDoseIds.push(d.id);
    else kept.push({ ...d });
  }

  return {
    prescription: { ...prescription, status: 'discontinued', discontinuedAt, discontinuedReason: reason },
    doses: kept,
    cancelledDoseIds,
  };
}
