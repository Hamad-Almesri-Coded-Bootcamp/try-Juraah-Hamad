/**
 * The mock store — a module-level singleton with an explicit `reset()` (D-002, owner's condition
 * 1). Built fresh from `seed.ts` on load and on every `reset()`; every unit test calls `reset()`
 * in `beforeEach`. No client component reads this module (guard 3) — it is reachable only through
 * `lib/data/index.ts` and `lib/session/**` (which is part of the seam, D-002).
 */
import { buildSeedState } from './seed';
import { resetLiveCounter } from './audit';
import type { StoreState } from './types';

let state: StoreState = buildSeedState();

/** The live singleton. Callers mutate its arrays in place; nothing outside lib/data/mock reads it. */
export function getStore(): StoreState {
  return state;
}

/** Rebuilds the store from the seed. Every unit test calls this in beforeEach (docs/briefs/WP1.md §3). */
export function reset(): StoreState {
  resetLiveCounter();
  state = buildSeedState();
  return state;
}
