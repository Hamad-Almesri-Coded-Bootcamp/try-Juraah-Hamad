/**
 * Refusal shapes for refills and the calendar read — owned by package WP3c (lead split at Gate 1, D-020/D-022). Only that package edits this file;
 * `lib/data/refusals.ts` is the barrel the lead owns. Rules: docs/briefs/P2-common.md.
 *
 * A refused read and a legitimately empty one are the same bytes (a patient with no active
 * prescription and a caregiver whose invitation is not `active` both see `[]`) — the screen can
 * tell nothing apart, which is the point (E-21).
 */
import type { CalendarSubscription, RefillRequest } from '@/types/contracts';
import type { RefillLine } from '@/types/views';

/** getRefillOverview — no session, a non-`active` caregiver, a reviewer with no queue item for the
 * patient, an admin, or another patient: the empty list. */
export function refillOverviewRefusal(): RefillLine[] {
  return [];
}

/** getRefillRequests — the same readers as the overview are refused the same way: `[]`. */
export function refillRequestsRefusal(): RefillRequest[] {
  return [];
}

/** getCalendarSubscription — patient-self only; everyone else (a caregiver included, as the mock
 * does) gets `null`, which is also the patient's own "not enabled yet" state. */
export function calendarSubscriptionRefusal(): CalendarSubscription | null {
  return null;
}
