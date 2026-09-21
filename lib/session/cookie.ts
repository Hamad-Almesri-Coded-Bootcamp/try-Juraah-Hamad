/**
 * The mock session cookie (D-005): `{ subjectId, role, linkedPatientId?, pendingInvitationOnly? }`,
 * URI-encoded JSON, httpOnly, SameSite=Lax, path "/" — exactly the shape
 * `tests/e2e/helpers/session.ts` mints. `cookies()` from `next/headers` lives ONLY in this file
 * (docs/briefs/WP1.md, FILES YOU OWN).
 *
 * `next/headers`'s `cookies()` needs an active Next.js request context, which a plain script (e.g.
 * `scripts/print-shapes.ts`, run with `tsx`, outside Next entirely) never has. Rather than making
 * every script fake a request, this module falls back to an in-memory session when `cookies()`
 * throws — script/test use only, exported explicitly as such, never imported by a screen (guard 3
 * would catch it if it were: it is not a `lib/data/mock` import).
 */
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/config';
import type { Session } from '@/types/views';

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.subjectId === 'string' && (v.role === undefined || typeof v.role === 'string');
}

let scriptSession: Session | null = null;

/** `scripts/print-shapes.ts` only — sets the session a script-context call reads/writes as. */
export function setScriptSession(session: Session | null): void {
  scriptSession = session;
}

export async function readSessionCookie(): Promise<Session | null> {
  try {
    const store = await cookies();
    const raw = store.get(SESSION_COOKIE)?.value;
    if (!raw) return null;
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    return isSession(parsed) ? parsed : null;
  } catch {
    return scriptSession;
  }
}

export async function writeSessionCookie(session: Session): Promise<void> {
  try {
    const store = await cookies();
    store.set(SESSION_COOKIE, encodeURIComponent(JSON.stringify(session)), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  } catch {
    scriptSession = session;
  }
}

export async function clearSessionCookie(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(SESSION_COOKIE);
  } catch {
    scriptSession = null;
  }
}
