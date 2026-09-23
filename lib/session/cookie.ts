/**
 * The session cookie (D-018): `jurah.session` = the HMAC-signed `{ session, sid, exp }` of
 * `lib/session/verify.ts`, httpOnly, SameSite=Lax, path "/", Secure in production. `cookies()` from
 * `next/headers` lives ONLY in this file. The cookie never carries a Civil ID.
 *
 * Reading: the signature is verified (verify.ts, the same code proxy.ts runs); with the postgres
 * backend the `sessions` row is ALSO required to be live (`revoked_at is null and expires_at >
 * jurah_now()`, lib/session/pg `isSessionLive`) — so a cookie replayed after sign-out is no session
 * at the seam (E-26). Every patient-scoped read reaches this through lib/data/pg/_shared.ts's
 * `sessionOf()`. The mock backend has no sessions table: signature only.
 *
 * Script context. `cookies()` needs a Next request; a plain script or test (print-shapes.ts, the
 * integration suite) has none, and `cookies()` throws. Then a module-level jar stands in:
 *   - `setScriptSession(session)` — a TRUSTED raw session (print-shapes' seeded actors); it has no
 *     sid, so no row is checked (D-24 in docs/backend-notes/p2-wp2.md — only reachable outside a
 *     request, where no browser can be the caller);
 *   - a signed cookie VALUE — what writeSessionCookie stores when a secret is configured, and what
 *     `setScriptCookie` replays; it is verified exactly as a request cookie is (E-25/E-26 tests).
 * Without a secret, script-context writes fall back to a raw session (mock print-shapes).
 */
import { cookies } from 'next/headers';
import { SESSION_COOKIE, SESSION_COOKIE_SECURE, sessionSecret } from '@/lib/config';
import { selectedBackend } from '@/lib/db/client';
import type { Session } from '@/types/views';
import { canonicalSession, newSessionId, sessionExpiry, signSession, verifySession } from './verify';

/** A verified session plus the id of its `sessions` row (null only for a trusted script session). */
export interface SessionClaims {
  session: Session;
  sid: string | null;
  exp: number | null;
}

type ScriptJar = { kind: 'raw'; session: Session | null } | { kind: 'cookie'; value: string };
let jar: ScriptJar = { kind: 'raw', session: null };

type CookieStore = Awaited<ReturnType<typeof cookies>>;
/** The request's cookie store, or null outside a Next request (script / test). */
async function requestStore(): Promise<CookieStore | null> {
  try {
    return await cookies();
  } catch {
    return null;
  }
}

/** `scripts/print-shapes.ts` only — sets the trusted raw session a script-context call runs as. */
export function setScriptSession(session: Session | null): void {
  jar = { kind: 'raw', session };
}

/** Tests only — replays a cookie value in script context (verified like a request cookie). */
export function setScriptCookie(value: string | null): void {
  jar = value ? { kind: 'cookie', value } : { kind: 'raw', session: null };
}

/** Tests only — the signed cookie value the last script-context write produced (or null). */
export function getScriptCookie(): string | null {
  return jar.kind === 'cookie' ? jar.value : null;
}

/**
 * A cookie value → its verified claims: signature and exp (verify.ts), then — postgres backend —
 * the live `sessions` row. Anything else → null.
 */
export async function claimsFromCookieValue(value: string | undefined | null): Promise<SessionClaims | null> {
  const payload = await verifySession(value, sessionSecret());
  if (!payload) return null;
  if (selectedBackend() === 'postgres') {
    const { isSessionLive } = await import('./pg');
    if (!(await isSessionLive(payload.session, payload.sid))) return null;
  }
  return { session: payload.session, sid: payload.sid, exp: payload.exp };
}

/** The verified session with its sid — for signOut/chooseRole and WP5's revocations. */
export async function readSessionClaims(): Promise<SessionClaims | null> {
  const store = await requestStore();
  if (store) return claimsFromCookieValue(store.get(SESSION_COOKIE)?.value);
  if (jar.kind === 'cookie') return claimsFromCookieValue(jar.value);
  return jar.session ? { session: canonicalSession(jar.session), sid: null, exp: null } : null;
}

/** The verified session (unchanged `Session` shape), or null. */
export async function readSessionCookie(): Promise<Session | null> {
  return (await readSessionClaims())?.session ?? null;
}

/**
 * Writes the signed cookie for `session`. `issued` names the `sessions` row it belongs to (the
 * postgres backend always passes it); without it (the mock backend) a fresh sid is minted and no
 * row exists — the mock verifies the signature only.
 */
export async function writeSessionCookie(session: Session, issued?: { sid: string; exp: number }): Promise<void> {
  const sid = issued?.sid ?? newSessionId();
  const exp = issued?.exp ?? sessionExpiry();
  const store = await requestStore();
  const secret = sessionSecret();
  if (!store) {
    jar = secret ? { kind: 'cookie', value: await signSession({ session, sid, exp }, secret) } : { kind: 'raw', session: canonicalSession(session) };
    return;
  }
  const value = await signSession({ session, sid, exp }, secret); // throws loudly without a secret
  store.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: SESSION_COOKIE_SECURE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await requestStore();
  if (!store) {
    jar = { kind: 'raw', session: null };
    return;
  }
  store.delete(SESSION_COOKIE);
}
