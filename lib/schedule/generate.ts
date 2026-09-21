/**
 * The deterministic dose generator (docs/briefs/WP1.md §5; docs/Seed Dataset.md → "Doses").
 * Pure: no clock read here at all — a prescription's schedule does not depend on "now", only on
 * its own fields, so day navigation both ways (past and future) works without regenerating
 * anything. `REFERENCE_NOW` is used only where "is this past/today" is actually decided (screens,
 * depletion) — never inside this function.
 *
 * CR-002 invariant (2): returns [] unless `startDate` is present and
 * `doseTimes.length === frequencyPerDay`. Also empty for a flagged record not yet confirmed
 * (Backend Foundations, "Schedule & depletion logic": "skips any prescription whose needsReview is
 * true and whose fieldReviewStatus is not confirmed"), and generates nothing after `discontinuedAt`
 * (inclusive of the discontinuation date itself — the seed's rx-004 stops generating "after
 * 2026-06-28", not before it).
 */
import type { Dose, Prescription } from '@/types/contracts';
import { addDays, daysBetween, toKuwaitIso } from './dates';

export function generateDoses(prescription: Prescription, patientTrackingOn: boolean): Dose[] {
  const { startDate, doseTimes, frequencyPerDay, durationDays, dosingPattern, needsReview, fieldReviewStatus, status, discontinuedAt } = prescription;

  if (needsReview && fieldReviewStatus !== 'confirmed') return [];
  if (!startDate || !doseTimes || doseTimes.length === 0) return [];
  if (frequencyPerDay === undefined || doseTimes.length !== frequencyPerDay) return [];
  if (dosingPattern !== 'daily' && dosingPattern !== 'alternate_day') return []; // 'other' — unsupported, reported (docs/briefs/WP1.md §5)
  if (durationDays <= 0) return [];

  const doses: Dose[] = [];

  for (let offset = 0; offset < durationDays; offset++) {
    const date = addDays(startDate, offset);
    if (status === 'discontinued' && discontinuedAt && date > discontinuedAt) break;
    if (dosingPattern === 'alternate_day' && offset % 2 !== 0) continue;

    for (const time of doseTimes) {
      doses.push({
        id: `${prescription.id}-${date.replace(/-/g, '')}-${time.replace(':', '')}`,
        prescriptionId: prescription.id,
        scheduledAt: toKuwaitIso(date, time),
        status: 'upcoming', // G4 — never inferred; overlays are applied by the seed module, not here
        tracked: patientTrackingOn, // v5 — fixed at generation time, per the patient's state then
        source: 'seed',
      });
    }
  }

  return doses;
}

/** Re-exported for callers that need the day-count helper without pulling in generation. */
export { daysBetween };
