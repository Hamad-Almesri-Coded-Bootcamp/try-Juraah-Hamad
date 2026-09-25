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

/**
 * Runtime: append one event to the live store — the only path that may push onto auditEvents.
 * AP-09: the next id is counted from the store itself. The store is shared by every bundle of the
 * server (lib/data/mock/store.ts), and a counter per module copy would hand out one id twice.
 */
export function append(store: StoreState, event: Omit<AuditEvent, 'id'>): AuditEvent {
  const liveCount = store.auditEvents.reduce((n, e) => (e.id.startsWith('ae-live-') ? n + 1 : n), 0);
  const full: AuditEvent = { ...event, id: `ae-live-${String(liveCount + 1).padStart(4, '0')}` };
  store.auditEvents.push(full);
  return full;
}

/** Kept for store.reset(). Nothing to reset: a fresh store has no live events, so ids start at one. */
export function resetLiveCounter(): void {
  // The next id is counted from the store (see append), so there is no counter to reset.
}
