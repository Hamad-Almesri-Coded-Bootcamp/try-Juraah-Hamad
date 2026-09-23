/**
 * Shared projection helpers (lead-owned). Every `lib/data/shapes/<package>.ts` imports from here.
 * Absent optional fields are dropped (never `undefined`, never `null`) so the key SET matches the
 * mock's; each literal fixes KEY ORDER to the mock's because Gate 3 compares serialised strings.
 */
export type DbRow = Record<string, unknown>;

/** Drops keys whose value is undefined or null, keeping the literal's order. */
export function compact<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) out[k] = v;
  return out as T;
}

export const str = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : String(v));
export const num = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));
