/**
 * The agent integration point's one gate (P2-WP7, API-SURFACE §B):
 *   - a request that carries a VERIFIED user session cookie is 403 `{ error: 'forbidden' }` —
 *     whatever else it carries, a valid bearer included. No patient, caregiver, reviewer or admin
 *     session ever reaches an agent route (E-01), and never gets a 200;
 *   - otherwise `Authorization: Bearer <JURAH_AGENT_TOKEN>`, compared in constant time; missing or
 *     wrong → 401 `{ error: 'unauthorized' }`. An unset token refuses everyone (fail closed).
 * The session is read through lib/session's exported `getSession`, as it is (WP2's signed cookie):
 * an unsigned or tampered cookie is no session, so such a request falls through to the bearer check
 * and is 401 without a valid token. If the session lookup itself fails (e.g. the database is
 * unreachable), a request that presented the session cookie is refused 403, never let through.
 */
import { timingSafeEqual } from 'node:crypto';
import { AGENT_TOKEN, SESSION_COOKIE } from '@/lib/config';
import { getSession } from '@/lib/session';
import { json } from './http';

export function bearerMatches(header: string | null, expected: string): boolean {
  if (!expected || !header) return false;
  const m = /^Bearer (.+)$/.exec(header);
  if (!m?.[1]) return false;
  const a = Buffer.from(m[1], 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function presentsSessionCookie(request: Request): boolean {
  const cookie = request.headers.get('cookie') ?? '';
  return cookie.split(';').some((c) => c.trim().startsWith(`${SESSION_COOKIE}=`));
}

/** null ⇔ the caller is the agent; otherwise the refusal to return as is. */
export async function refuseUnlessAgent(request: Request): Promise<Response | null> {
  let hasSession = false;
  try {
    hasSession = (await getSession()) !== null;
  } catch {
    hasSession = presentsSessionCookie(request);
  }
  if (hasSession) return json(403, { error: 'forbidden' });
  if (!bearerMatches(request.headers.get('authorization'), AGENT_TOKEN)) return json(401, { error: 'unauthorized' });
  return null;
}
