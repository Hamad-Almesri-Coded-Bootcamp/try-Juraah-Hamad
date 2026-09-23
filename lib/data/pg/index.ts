/**
 * The Postgres implementation behind the seam (D-016/D-020) — BARREL, lead-owned. Selected by
 * lib/data/index.ts when JURAH_DATA_BACKEND=postgres. Split by package at Gate 1 so no two
 * implementers edit one file: reads-rx (WP3a) · reads-clinic (WP3b) · reads-supply (WP3c) ·
 * reads-ambient (WP3d) · writes (WP5) · channels (WP6). Every function runs inside withSession();
 * RLS and the guard triggers do the refusing; a refused read comes back as the mock's refusal shape
 * (lib/data/refusals, D-022); projections go through lib/data/shapes (key order, BACKEND-PLAN §6).
 * Functions a package has not reached yet THROW (`_shared.ts`'s notImplemented) — never the mock.
 */
export * from './reads-rx';
export * from './reads-clinic';
export * from './reads-supply';
export * from './reads-ambient';
export * from './writes';
export * from './channels';
export { NOT_IMPLEMENTED } from './_shared';

import { PG_QUERIES_RX } from './reads-rx';
import { PG_QUERIES_AMBIENT } from './reads-ambient';
import { PG_QUERIES_SUPPLY } from './reads-supply';
import { PG_QUERIES_CLINIC } from './reads-clinic';
/** The real functions' SQL, so a gate proof can run the very same text through the MCP connector. */
export const PG_QUERIES = { ...PG_QUERIES_RX, ...PG_QUERIES_AMBIENT, ...PG_QUERIES_SUPPLY, ...PG_QUERIES_CLINIC } as const;
