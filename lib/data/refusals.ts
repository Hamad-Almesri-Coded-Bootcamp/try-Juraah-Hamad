/**
 * The seam's refusal shapes (D-022, BACKEND-DIVERGENCES D-3) — BARREL, lead-owned: what a refused
 * call RETURNS, shared by lib/data/mock-impl.ts and lib/data/pg/ so the two cannot drift. Screens
 * have no try/catch — a refusal is a quiet shape, never a throw; the refusal itself happens in the
 * database. Each package edits only its own `refusals/<package>.ts`.
 */
export * from './refusals/reads-rx';
export * from './refusals/reads-clinic';
export * from './refusals/reads-supply';
export * from './refusals/reads-ambient';
export * from './refusals/writes';
export * from './refusals/channels';
