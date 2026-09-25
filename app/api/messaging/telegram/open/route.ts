/**
 * POST /api/messaging/telegram/open. AP-09 (CR-083, CR-086): the one way a screen links Telegram.
 *
 * E5, A2's Telegram offer and F4 each render a small form (features/ambient/TelegramLinkForm.tsx)
 * that posts `locale` and `from` here. This handler, under the verified session:
 *   1. refuses anything that is not a same-origin POST (the Origin host must be this request's own
 *      host, as Next checks for a Server Action; no Origin is a refusal);
 *   2. accepts only a patient, or a caregiver whose invitation is ACTIVE (getCaregiverLink answers
 *      only for an active caregiver; startMessagingLink is refused by the database trigger
 *      link_caregiver_must_be_active as well, rule 5);
 *   3. mints the person's own link through the seam (startMessagingLink: single use, 15 minutes,
 *      one live token per subject; lib/data/pg/channels.ts, unchanged);
 *   4. answers 303 to https://t.me/<bot>?start=<token>, the bot's @username as Telegram reports it
 *      for the configured token (getMe, CR-085).
 *
 * The token leaves the server only in that Location header (rule 7). Every other answer is a 303
 * back to the screen the form came from, with no token: no session, a pending-only invitee, a
 * clinic role, a caregiver who is not active, a cross-site post, a refused mint, or Telegram not
 * answering getMe (then nothing is minted). While the bot is simulated (no JURAH_BOT_TOKEN: local
 * runs, previews) the link is minted and the person goes back to the screen, which says the chat
 * is a demo and shows the @jurah_bot placeholder; nothing is ever sent to a t.me address then.
 * A refusal is never an error page for an optional channel (rule 2, G10); a real failure (the
 * database unreachable) is not disguised as a refusal and throws, as the seam itself does. Every
 * answer carries no-store and no-referrer.
 */
import { getSession } from '@/lib/session';
import { getCaregiverLink, startMessagingLink } from '@/lib/data';
import { BOT_IS_SIMULATED } from '@/lib/config';
import { botUsername, startLink } from '@/lib/messaging/telegram';
import { isLinkFrom, linkReturnPath, type LinkFrom } from '@/lib/messaging/link';
import type { Locale } from '@/i18n/locale';
import type { Subject } from '@/types/views';

export const dynamic = 'force-dynamic';

const PRIVATE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } as const;

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { ...PRIVATE, Location: location } });
}

/** The first x-forwarded-host value, else Host (the order Next's Server Action check uses). */
function requestHost(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('host');
}

/** A browser always sends Origin on a POST; a missing, opaque ("null") or foreign one is refused. */
function isSameOriginPost(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const host = requestHost(request);
  return !!host && originHost === host;
}

async function formFields(request: Request): Promise<{ locale: Locale; from: LinkFrom }> {
  let form: FormData | null = null;
  try {
    form = await request.formData();
  } catch {
    form = null;
  }
  const locale = form?.get('locale') === 'en' ? 'en' : 'ar';
  const from = form?.get('from');
  return { locale, from: isLinkFrom(from) ? from : 'notifications' };
}

/** The session's own subject, or null: a patient, or a caregiver whose invitation is active. */
async function ownSubject(): Promise<Subject | null> {
  const session = await getSession();
  if (!session || session.pendingInvitationOnly || !session.subjectId) return null;
  if (session.role === 'patient') return { subjectType: 'patient', subjectId: session.subjectId };
  if (session.role !== 'caregiver') return null;
  const link = await getCaregiverLink(session.subjectId);
  if (!link.patientId) return null;
  return { subjectType: 'caregiver', subjectId: session.subjectId };
}

export async function POST(request: Request): Promise<Response> {
  const { locale, from } = await formFields(request);
  const back = (role?: Subject['subjectType']) => redirect(linkReturnPath(locale, from, role));

  if (!isSameOriginPost(request)) return back();
  const subject = await ownSubject();
  if (!subject) return back();

  // A real bot whose name Telegram does not give back cannot be opened: mint nothing.
  const username = BOT_IS_SIMULATED ? null : await botUsername();
  if (!BOT_IS_SIMULATED && !username) return back(subject.subjectType);

  const link = await startMessagingLink(subject);
  if (link.status !== 'pending' || !link.linkToken) return back(subject.subjectType);
  if (BOT_IS_SIMULATED || !username) return back(subject.subjectType);

  const target = startLink(username, link.linkToken);
  return target ? redirect(target) : back(subject.subjectType);
}
