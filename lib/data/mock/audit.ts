/**
 * Audit-event assembly. AuditEvent.id follows D-005 (`ae-001…`, assigned in createdAt order) — the
 * seed builds its events unordered and this module sorts and numbers them once, so no timestamp in
 * `seed.ts` has to be hand-sequenced. `append()` is the ONE path every mutation uses to add a row
 * to the live store, so append-only is a property of the code, not a convention.
 */
import type { AuditEvent } from '@/types/contracts';
import type { StoreState } from './types';

/** Seed-time: sort by createdAt and assign ae-001… in that order (D-005). */
export function assignAuditIds(events: Omit<AuditEvent, 'id'>[]): AuditEvent[] {
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return sorted.map((e, i) => ({ ...e, id: `ae-${String(i + 1).padStart(3, '0')}` }));
}

let liveCounter = 0;

/** Runtime: append one event to the live store — the only path that may push onto auditEvents. */
export function append(store: StoreState, event: Omit<AuditEvent, 'id'>): AuditEvent {
  liveCounter += 1;
  const full: AuditEvent = { ...event, id: `ae-live-${String(liveCounter).padStart(4, '0')}` };
  store.auditEvents.push(full);
  return full;
}

/** Reset the live-append counter — called by store.reset() so a fresh store starts from zero. */
export function resetLiveCounter(): void {
  liveCounter = 0;
}
