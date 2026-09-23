/**
 * Recomputation after a REPORTED miss (docs/Acceptance Criteria and Test Plan.md → PHASE 2 →
 * "Schedule & depletion logic": "recomputes on a *reported* missed dose without collapsing an
 * alternate-day cadence"; AI Agents TC-RS-01/02/04/07). The Rescheduling Agent decides WHEN to
 * call this; this function computes WHAT — "dose-time arithmetic is traceable to a deterministic
 * code path".
 *
 * SEMANTICS (see docs/backend-notes/p2-wp4.md for why, and what the owner should confirm):
 *
 *  A reported miss changes nothing about WHEN the remaining doses fall. The schedule is a function
 *  of the prescription's own fields alone (`startDate`, `doseTimes`, `dosingPattern`,
 *  `frequencyPerDay`, `durationDays`, and `discontinuedAt` when discontinued) — the generator
 *  never reads a miss, so a miss cannot shift, compress or collapse the cadence. "Recompute" is
 *  therefore a RECONCILIATION of this prescription's `upcoming` doses against
 *  `generateDoses(prescription, tracked)`:
 *
 *   1. Every dose of this prescription that carries a recorded status (anything but `upcoming`) is
 *      kept exactly as it is — including the missed dose itself, whose status the agent path wrote.
 *      This function never writes a status (rule 1 / G1).
 *   2. For every generated dose whose id is not already recorded: if an `upcoming` dose with that
 *      id already exists it is kept AS IT IS (its `tracked` and `source` carried through — rule 3);
 *      otherwise the generator's dose is added (status `upcoming`, set by the generator only).
 *   3. Every existing `upcoming` dose of this prescription the generator no longer produces is
 *      dropped (e.g. past a discontinuation date — never past `startDate + durationDays`, TC-RS-04,
 *      because the generator never goes there).
 *   4. Doses of other prescriptions pass through untouched.
 *   5. `tracked` for a dose that did not exist before is taken from the missed dose
 *      (`missed.tracked ?? true`, the contract's default): the miss was recorded, so that dose
 *      was tracked, and the agent never runs for a tracking-off patient (TC-RS-06).
 *
 *  No-op — `{ doses: <input, copied>, changed: false }` — when the call is not a reported miss on
 *  this prescription: the id is not in `existingDoses`, belongs to another prescription, is not
 *  recorded as a miss, or is `tracked: false` (an untracked dose is never given a status, so a
 *  "miss" on one is impossible input). Also a no-op for a prescription still flagged for review
 *  and not confirmed (TC-RS-07: "no schedule generated OR RECOMPUTED for it at all").
 *
 *  `changed` is true only if the returned dose set differs from the input (a dose added, dropped
 *  or altered). For every seed prescription it is false.
 *
 *  Order: other prescriptions' doses first, in input order; then this prescription's doses
 *  ascending by `scheduledAt`, ties by `id`. When `changed` is false the input order is returned
 *  unchanged.
 *
 * Nothing here compares a dose's time to "now" (rule 4): there is no `nowIso` parameter at all.
 * Pure — no clock, no I/O, no model call, inputs are not mutated.
 */
import type { Dose, Prescription } from '@/types/contracts';
import { generateDoses } from './generate';

export interface Recomputation {
  doses: Dose[];
  changed: boolean;
}

function fingerprint(d: Dose): string {
  return JSON.stringify([d.id, d.prescriptionId, d.scheduledAt, d.status, d.tracked ?? null, d.recordedAt ?? null, d.source ?? null]);
}

function sameDoseSet(a: readonly Dose[], b: readonly Dose[]): boolean {
  if (a.length !== b.length) return false;
  const fa = a.map(fingerprint).sort();
  const fb = b.map(fingerprint).sort();
  return fa.every((f, i) => f === fb[i]);
}

export function recomputeAfterReportedMiss(
  prescription: Prescription,
  existingDoses: readonly Dose[],
  missedDoseId: string,
): Recomputation {
  const unchanged = (): Recomputation => ({ doses: existingDoses.map((d) => ({ ...d })), changed: false });

  const reported = existingDoses.find((d) => d.id === missedDoseId);
  if (!reported || reported.prescriptionId !== prescription.id) return unchanged();
  if (reported.status !== 'missed' || reported.tracked === false) return unchanged();
  if (prescription.needsReview && prescription.fieldReviewStatus !== 'confirmed') return unchanged();

  const others = existingDoses.filter((d) => d.prescriptionId !== prescription.id);
  const mine = existingDoses.filter((d) => d.prescriptionId === prescription.id);

  const recorded = mine.filter((d) => d.status !== 'upcoming');
  const recordedIds = new Set(recorded.map((d) => d.id));
  const upcomingById = new Map(mine.filter((d) => d.status === 'upcoming').map((d) => [d.id, d]));

  const tracked = reported.tracked ?? true;
  const regenerated = generateDoses(prescription, tracked)
    .filter((g) => !recordedIds.has(g.id))
    .map((g) => upcomingById.get(g.id) ?? g);

  const reconciled = [...recorded, ...regenerated].map((d) => ({ ...d }));
  if (sameDoseSet(mine, reconciled)) return unchanged();

  reconciled.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id));
  return { doses: [...others.map((d) => ({ ...d })), ...reconciled], changed: true };
}
