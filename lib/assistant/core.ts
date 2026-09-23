/**
 * CR-067 — the web-app assistant's server half, pure parts (unit-tested in
 * tests/unit/assistant/core.test.ts). The action in ./index.ts does the I/O.
 *
 * The assistant is READ-ONLY (CLAUDE.md rule 1): nothing here writes, and the n8n side
 * (agents/lib/webchat.js) records nothing either — "I took it" sends Telegram buttons instead.
 * Who is asking comes ONLY from the verified session, never from the request; only a patient
 * session is answered.
 */
import type { Locale } from '@/i18n/locale';
import type { InteractionAlert } from '@/types/contracts';
import type { Session } from '@/types/views';

export const MAX_MESSAGE_LENGTH = 500;

export type AssistantResult =
  | { ok: true; reply: string; telegramPrompted: boolean }
  /** App help for a visitor who is not a signed-in patient — a copy-catalogue key, resolved by the component. */
  | { ok: true; guestTopic: GuestTopic }
  | { ok: false; reason: 'invalid' | 'unavailable' };

export type AssistantAudience = 'patient' | 'guest';

/** The trimmed message, or null when it is empty, too long or not text. */
export function cleanMessage(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  return t.length > 0 && t.length <= MAX_MESSAGE_LENGTH ? t : null;
}

/** The patient the session belongs to — a patient session only (not a caregiver, reviewer, admin or pending-only). */
export function patientOf(session: Session | null): string | null {
  if (!session || session.pendingInvitationOnly || session.role !== 'patient' || !session.subjectId) return null;
  return session.subjectId;
}

/** A `/webhook/` URL of an activated workflow; a `/webhook-test/` URL is a bug, never a fallback. */
export function chatConfigured(url: string, secret: string): boolean {
  return /^https:\/\/[^/]+\/webhook\//.test(url) && !url.includes('/webhook-test/') && secret.length > 0;
}

/** The body n8n receives: the patient's id, the text, the locale, and ONLY what the alerts screen already shows. */
export function chatPayload(patientId: string, text: string, locale: Locale, alerts: readonly InteractionAlert[]) {
  return {
    patientId,
    text,
    language: locale,
    alerts: alerts.slice(0, 20).map((a) => ({ severity: a.severity, description: a.description, reviewStatus: a.reviewStatus })),
  };
}

/**
 * Anyone who is not a signed-in patient (landing, sign-in, caregiver, clinic) gets APP HELP only,
 * answered here from the copy catalogue: no n8n, no model, no database, so no one's medical data
 * is ever in reach and an anonymous visitor cannot spend the agents' quota. Keyed by the entries of
 * i18n/copy/assistant.ts; the component resolves the key to the reader's language.
 */
export type GuestTopic = 'guestTelegram' | 'guestRefill' | 'guestSignIn' | 'guestGeneral';
export function guestTopic(text: string): GuestTopic {
  const t = text.toLowerCase();
  if (/تيليقرام|تليقرام|تيليجرام|تلغرام|telegram/.test(t)) return 'guestTelegram';
  if (/إعادة صرف|اعادة صرف|تجديد|refill/.test(t)) return 'guestRefill';
  if (/دخول|أدخل|ادخل|تسجيل|هويتي|هوياتي|sign ?in|log ?in|login/.test(t)) return 'guestSignIn';
  return 'guestGeneral';
}

/** n8n's answer → a result; anything unexpected is "unavailable", never a made-up reply. */
export function readReply(status: number, body: unknown): AssistantResult {
  if (status < 200 || status >= 300 || !body || typeof body !== 'object') return { ok: false, reason: 'unavailable' };
  const b = body as { reply?: unknown; telegramPrompted?: unknown };
  if (typeof b.reply !== 'string' || b.reply.trim().length === 0) return { ok: false, reason: 'unavailable' };
  return { ok: true, reply: b.reply.slice(0, 2000), telegramPrompted: b.telegramPrompted === true };
}
