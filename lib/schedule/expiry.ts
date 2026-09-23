/**
 * Read-time invitation expiry (docs/Acceptance Criteria and Test Plan.md → PHASE 2 → "Caregiver
 * invitation path": "Expiry is enforced server-side at read time as well as by a job, so a stale
 * `pending` row is never treated as acceptable").
 *
 * The rule, exactly as the mock states it (lib/data/mock/caregivers.ts → `pendingInvitationsFor`
 * keeps `expiresAt > nowIso`; `acceptInvitation` refuses `expiresAt <= nowIso`): a `pending` row
 * whose `expiresAt` is at or before `nowIso` READS AS `expired`. Every other status — `active`,
 * `declined`, `expired`, `revoked` — is returned unchanged, whatever its `expiresAt` says (an
 * `active` row's `expiresAt` is history, not a deadline: cg-01's lies in the past and it stays
 * `active`).
 *
 * Pure. `nowIso` is ALWAYS a parameter (D-021, rule 9 / G3): nothing here reads a clock. Nothing
 * here mutates its input, and nothing here touches a `Dose` in any way.
 *
 * Comparison is by INSTANT, not by string: `Date.parse` of two ISO datetimes. For two strings in
 * the same `+03:00` offset (every seed value and every value the mock writes) this is identical to
 * the mock's string comparison; it stays correct when a Phase 2 database hands a timestamp back in
 * another offset (e.g. `...Z`), where a string comparison silently is not. An `expiresAt` that does
 * not parse FAILS CLOSED — it reads as expired, so a malformed row is never acceptable. A `nowIso`
 * that does not parse is a caller bug and throws.
 */
import type { Caregiver } from '@/types/contracts';

function instantOf(iso: string): number {
  return Date.parse(iso);
}

function nowInstant(nowIso: string): number {
  const t = instantOf(nowIso);
  if (Number.isNaN(t)) throw new RangeError(`foldInvitationExpiry: nowIso is not an ISO datetime: ${JSON.stringify(nowIso)}`);
  return t;
}

function isStalePending(caregiver: Caregiver, now: number): boolean {
  if (caregiver.status !== 'pending') return false;
  const expires = instantOf(caregiver.expiresAt);
  return Number.isNaN(expires) || expires <= now;
}

/** The status a caregiver row READS AS at `nowIso`: a stale `pending` row is `expired`; all else unchanged. */
export function foldInvitationExpiry(caregiver: Caregiver, nowIso: string): Caregiver['status'] {
  return isStalePending(caregiver, nowInstant(nowIso)) ? 'expired' : caregiver.status;
}

/**
 * The expiry job's selection: every row that is still stored as `pending` but reads as `expired`
 * at `nowIso`, in input order. Returns the rows themselves (not modified) — the writer half of
 * WP4 moves them to `expired` and appends `caregiver_invite_expired`; this function decides only
 * WHICH rows.
 */
export function invitationsToExpire(caregivers: readonly Caregiver[], nowIso: string): Caregiver[] {
  const now = nowInstant(nowIso);
  return caregivers.filter((c) => isStalePending(c, now));
}
