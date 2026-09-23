/**
 * Shared helpers for the Postgres implementation (lead-owned). Each package's `pg/<package>.ts`
 * imports from here. `notImplemented()` throws deliberately so no package can pass a test by
 * silently inheriting the mock; `sessionOf()` is the one place the seam reads the session cookie.
 */
import { readSessionCookie } from '@/lib/session/cookie';
import type { Session } from '@/types/views';

export const NOT_IMPLEMENTED = 'P2: not implemented — see the owning brief in docs/briefs/';
export function notImplemented(): never {
  throw new Error(NOT_IMPLEMENTED);
}
export async function sessionOf(): Promise<Session | null> {
  return readSessionCookie();
}
