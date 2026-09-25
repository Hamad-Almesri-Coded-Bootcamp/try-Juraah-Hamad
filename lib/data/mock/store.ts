/**
 * The mock store — a module-level singleton with an explicit `reset()` (D-002, owner's condition
 * 1). Built fresh from `seed.ts` on load and on every `reset()`; every unit test calls `reset()`
 * in `beforeEach`. No client component reads this module (guard 3) — it is reachable only through
 * `lib/data/index.ts` and `lib/session/**` (which is part of the seam, D-002).
 */
import { buildSeedState } from './seed';
import { resetLiveCounter } from './audit';
import type { StoreState } from './types';

/**
 * AP-09 (CR-086): ONE store per server process, kept on globalThis. Next bundles a route handler
 * (app/api/**) apart from the pages, so a plain module-level `let` gave each its own copy: the
 * Telegram link route minted a link the pages never saw (a local run showed E5 still "not
 * connected" after the route's 303). The pages, the Server Actions and the route handlers now read
 * and write the same store, as they read and write the same database under postgres.
 */
const KEY = '__jurahMockStore';
type Holder = { state: StoreState };
const shared = globalThis as typeof globalThis & { [KEY]?: Holder };
function holder(): Holder {
  return (shared[KEY] ??= { state: buildSeedState() });
}

/** The live singleton. Callers mutate its arrays in place; nothing outside lib/data/mock reads it. */
export function getStore(): StoreState {
  return holder().state;
}

/** Rebuilds the store from the seed. Every unit test calls this in beforeEach (docs/briefs/WP1.md §3). */
export function reset(): StoreState {
  resetLiveCounter();
  holder().state = buildSeedState();
  return holder().state;
}
