/**
 * AP-09 (CR-083, CR-086): the one way a screen links Telegram. The button is a form that POSTs to
 * TELEGRAM_OPEN_PATH; that route handler mints the person's own link under their session and
 * answers 303 to t.me/<bot>?start=<token>. The token exists only in that Location header: no
 * screen, no RSC payload and no client state ever holds it (rule 7).
 *
 * This module is safe for both sides (no server import): the form reads the path and the field
 * names, the route reads the same names and the return paths.
 */
import type { Locale } from '@/i18n/locale';
import type { MessagingLink } from '@/types/contracts';

/** The route handler every link form posts to (app/api/messaging/telegram/open/route.ts). */
export const TELEGRAM_OPEN_PATH = '/api/messaging/telegram/open';

/** The screens that carry the form. The route sends the person back to one of these, never to a
 * path the request names (no open redirect). */
export const LINK_FROM = ['notifications', 'setup', 'profile'] as const;
export type LinkFrom = (typeof LINK_FROM)[number];

export function isLinkFrom(value: unknown): value is LinkFrom {
  return typeof value === 'string' && (LINK_FROM as readonly string[]).includes(value);
}

/** Where the route answers when it does not open Telegram (and, while the bot is simulated, where
 * the minted link is shown). A caregiver always goes back to F4; a patient to E5 or to A2's next step. */
export function linkReturnPath(locale: Locale, from: LinkFrom, role?: 'patient' | 'caregiver'): string {
  if (role === 'caregiver' || (!role && from === 'profile')) return `/${locale}/care/more/profile`;
  if (from === 'setup') return `/${locale}/app/setup?step=2`;
  return `/${locale}/app/more/notifications`;
}

/**
 * The link as a screen may hold it: the state and the date only. The token and the chat id are
 * dropped on the server, before the value is serialised into a client component's props, so they
 * are not in the page's HTML or its RSC payload either (rule 7).
 */
export function linkForScreen(link: MessagingLink): MessagingLink {
  const view: MessagingLink = { id: link.id, subjectType: link.subjectType, subjectId: link.subjectId, channel: link.channel, status: link.status };
  if (link.connectedAt) view.connectedAt = link.connectedAt;
  return view;
}
