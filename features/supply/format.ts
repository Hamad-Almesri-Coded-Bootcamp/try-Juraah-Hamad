/**
 * Pure, presentational formatting helpers for D1 (features/supply/RefillList.tsx). No fetch, no
 * mock import, no clock read anywhere here — `RefillRequest.requestedAt` comes in as an argument
 * and every date is formatted from it, never from `Date.now()` (G3/rule 9).
 */
import { copy, t } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { interpolate } from '@/features/shell/interpolate';
import type { Locale } from '@/i18n/locale';
import type { RefillLine, RefillRequest } from '@/types/views';

/** `RefillLine.routedTo` / `RefillRequest.routedTo` already carries the routing sector the seam
 * derived from that prescription's own `source.sector` (lib/data/index.ts's `getRefillOverview`) —
 * this only maps the contract value to `SectorChip`'s `sector` prop, no re-derivation. */
export function sectorFromRoutedTo(routedTo: RefillLine['routedTo']): 'public' | 'private' {
  return routedTo === 'public_pharmacy' ? 'public' : 'private';
}

/** The routing destination, in the catalogue's own words — never the raw `'public_pharmacy'` /
 * `'private_pharmacy'` contract value (G9: no technical identifier reaches a screen). */
export function destinationLabel(routedTo: RefillLine['routedTo'], locale: Locale): string {
  return t(routedTo === 'public_pharmacy' ? copy.supply.d1DestinationPublic : copy.supply.d1DestinationPrivate, locale);
}

/** The already-requested InlineNotice's body — "This request routes to the public pharmacy." —
 * shown immediately after a fresh `requestRefill` and for a seeded pending row on first load
 * (docs/SCREENS.md D1 row: same list, that prescription now "requested" plus an InlineNotice). */
export function alreadyRequestedBody(routedTo: RefillLine['routedTo'], locale: Locale): string {
  return interpolate(t(copy.supply.d1AlreadyRequestedBodyTemplate, locale), { destination: destinationLabel(routedTo, locale) });
}

/** A `RefillRequest.status` word, in the fixed vocabulary this bundle owns (never the raw contract
 * value — `'requested' | 'approved' | 'denied'` are internal, not the label a patient reads). */
export function requestStatusLabel(status: RefillRequest['status'], locale: Locale): string {
  if (status === 'approved') return t(copy.supply.d1StatusApproved, locale);
  if (status === 'denied') return t(copy.supply.d1StatusDenied, locale);
  return t(copy.supply.d1StatusRequested, locale);
}

/** The "my requests" row's description — "Requested 20 September · routed to the public pharmacy"
 * (board: Refill.dc.html's own "طُلب ٢٠ سبتمبر · يُوجّه إلى الصيدلية الحكومية" anatomy, values from
 * the request itself rather than the board's own deviated numbers — CR-014). `requestedAt` is a
 * full Kuwait-offset ISO datetime; only its date slice is shown (mirrors AlertDetail's own
 * `reviewedAt.slice(0, 10)` pattern). */
export function requestLineDescription(request: Pick<RefillRequest, 'requestedAt' | 'routedTo'>, locale: Locale): string {
  return interpolate(t(copy.supply.d1RequestedOnTemplate, locale), {
    date: formatDate(request.requestedAt.slice(0, 10), locale),
    destination: destinationLabel(request.routedTo, locale),
  });
}

/** The one pending (`'requested'`) row for a prescription, if any — an `'approved'` or `'denied'`
 * request is a resolved past cycle and never suppresses a new request (docs/backend-notes/wp4f.md
 * §7 explains why only `'requested'` counts as "already requested" here). */
export function pendingRequestFor(requests: readonly RefillRequest[], prescriptionId: string): RefillRequest | undefined {
  return requests.find((r) => r.prescriptionId === prescriptionId && r.status === 'requested');
}
