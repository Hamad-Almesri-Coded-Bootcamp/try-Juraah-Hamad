/**
 * Projection literals (BACKEND-PLAN §6) — BARREL, lead-owned. Every Postgres read is mapped to its
 * contract shape through an object literal that fixes KEY ORDER to the mock's, because Gate 3
 * compares the serialised string. Each package edits only its own `shapes/<package>.ts`.
 */
export * from './shapes/_core';
export * from './shapes/reads-rx';
export * from './shapes/reads-clinic';
export * from './shapes/reads-supply';
export * from './shapes/reads-ambient';
export * from './shapes/writes';
export * from './shapes/channels';
