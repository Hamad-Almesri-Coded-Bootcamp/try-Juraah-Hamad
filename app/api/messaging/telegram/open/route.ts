/**
 * GET /api/messaging/telegram/open?locale=ar|en — F1: opens the Jur'ah bot on Telegram with the
 * signed-in person's OWN pending link, so pressing Start there sends `/start <token>` and the
 * webhook (./../webhook/[secret]) connects the chat.
 *
 * Rule 7: the token never reaches a screen. The page links here, to this route, with no token;
 * the token is read on the server, under the verified session (RLS: only that person's own
 * messaging link), and leaves only in this redirect's Location header to t.me.
 *
 * Anything else — no session, a pending-only invitee, no pending link (not started, expired,
 * already connected), the bot simulated or Telegram not answering — goes back to the
 * notifications screen, which shows the link's real state. Never an error page for an optional
 * channel (G10).
 */
import { getSession } from '@/lib/session';
import { getMessagingLink } from '@/lib/data';
import { botUsername, startLink } from '@/lib/messaging/telegram';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const back = () => new Response(null, { status: 303, headers: { ...noStore, Location: `/${locale}/app/more/notifications` } });

  let session;
  try {
    session = await getSession();
  } catch {
    return back();
  }
  if (!session || session.pendingInvitationOnly || !session.subjectId) return back();
  const subjectType = session.role === 'patient' ? 'patient' : session.role === 'caregiver' ? 'caregiver' : null;
  if (!subjectType) return back();

  const link = await getMessagingLink({ subjectType, subjectId: session.subjectId }).catch(() => null);
  if (!link || link.status !== 'pending' || !link.linkToken) return back();
  const username = await botUsername();
  const target = username ? startLink(username, link.linkToken) : null;
  if (!target) return back();
  return new Response(null, { status: 302, headers: { ...noStore, Location: target } });
}
