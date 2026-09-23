/**
 * POST / DELETE /api/push/subscription — the browser's push subscription (API-SURFACE §B, P2-WP6).
 *
 * Auth is the signed session cookie; the subject is ALWAYS the session's own (a body that names
 * another subject is 403, never obeyed). POST `{ endpoint, keys: { p256dh, auth } }` stores the
 * subscription server-side only against the subject's live push_subscriptions row (the row
 * requestPushPermission made — that seam call writes the audit row); DELETE sets the row
 * `revoked` and nulls the endpoint columns. Nothing here returns the endpoint or its keys.
 * A denied or absent subscription blocks no feature (G12): no other route or seam call reads it.
 *
 *   401 no session · 403 a session with no patient/caregiver subject, or a body naming another
 *   subject · 422 a malformed body, or no live row to attach to · 204 done
 *   (503 under the mock backend, which stores no subscription.)
 */
import { selectedBackend } from '@/lib/db/client';
import { sessionOf } from '@/lib/data/pg/_shared';
import { attachPushEndpointForSession, revokePushEndpointForSession } from '@/lib/data/pg/channels';
import { parseBrowserSubscription } from '@/lib/push/subscription';
import type { Session } from '@/types/views';

function json(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

async function subjectSession(): Promise<Session | Response> {
  const session = await sessionOf();
  if (!session) return json(401, 'unauthorized');
  if (session.role !== 'patient' && session.role !== 'caregiver') return json(403, 'forbidden');
  return session;
}

/** A body may name its subject; if it does, it must be the session's own. */
function namesAnotherSubject(body: unknown, session: Session): boolean {
  const subject = (body as { subject?: { subjectType?: unknown; subjectId?: unknown } } | null)?.subject;
  if (subject === undefined) return false;
  return subject?.subjectType !== session.role || subject?.subjectId !== session.subjectId;
}

export async function POST(request: Request): Promise<Response> {
  const session = await subjectSession();
  if (session instanceof Response) return session;
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return json(422, 'invalid_body');
  }
  if (namesAnotherSubject(body, session)) return json(403, 'forbidden');
  const sub = parseBrowserSubscription(body);
  if (!sub) return json(422, 'invalid_body');
  if (selectedBackend() !== 'postgres') return json(503, 'unavailable');
  const result = await attachPushEndpointForSession(session, sub);
  return result === 'stored' ? new Response(null, { status: 204 }) : json(422, 'no_live_subscription');
}

export async function DELETE(): Promise<Response> {
  const session = await subjectSession();
  if (session instanceof Response) return session;
  if (selectedBackend() !== 'postgres') return json(503, 'unavailable');
  await revokePushEndpointForSession(session);
  return new Response(null, { status: 204 });
}
