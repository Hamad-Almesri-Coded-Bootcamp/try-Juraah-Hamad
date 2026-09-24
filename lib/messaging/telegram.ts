/**
 * Telegram Bot API (P2-WP6) — server-only. The bot token comes from lib/config.ts (JURAH_BOT_TOKEN,
 * never NEXT_PUBLIC_, never in the repository) and is never logged: a failed call reports only
 * the HTTP status.
 *
 * While BOT_IS_SIMULATED (no token — the real bot handle is still owed) nothing is ever
 * sent, and `webhookSecret()` is null so the webhook route answers 404 on every path: an empty
 * token would otherwise make the path secret `sha256('')`, a constant anyone can compute.
 *
 * The chat is optional (G10): a failed send is a quiet result, never a thrown error, and nothing
 * else in the product waits on it.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { BOT_IS_SIMULATED, BOT_TOKEN } from '@/lib/config';

export type TelegramResult = { sent: true } | { sent: false; reason: 'simulated' | 'bot_api_refused'; status?: number };

/** Hex characters of sha256(BOT_TOKEN) used as the webhook path secret. */
export const WEBHOOK_SECRET_LENGTH = 40;

/** The webhook path secret, or null while no bot token is configured. */
export function webhookSecret(): string | null {
  if (BOT_IS_SIMULATED || !BOT_TOKEN) return null;
  return createHash('sha256').update(BOT_TOKEN, 'utf8').digest('hex').slice(0, WEBHOOK_SECRET_LENGTH);
}

/** Constant-time comparison of a presented path segment against the secret. */
export function isWebhookSecret(presented: string): boolean {
  const secret = webhookSecret();
  if (!secret) return false;
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The link token in a `/start <token>` message (Telegram's deep-link payload: `[A-Za-z0-9_-]`,
 * 1–64 characters). Anything else — another command, free text, a malformed payload — is null.
 */
export function parseStartToken(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const m = /^\/start(?:@[A-Za-z0-9_]+)? ([A-Za-z0-9_-]{1,64})$/.exec(text.trim());
  return m ? (m[1] ?? null) : null;
}

/** `{ token, chatId }` from a Telegram update, or null. The chat id is stringified (Telegram sends a number). */
export function startUpdateOf(update: unknown): { token: string; chatId: string } | null {
  if (!update || typeof update !== 'object') return null;
  const message = (update as { message?: unknown }).message;
  if (!message || typeof message !== 'object') return null;
  const m = message as { text?: unknown; chat?: { id?: unknown; type?: unknown } };
  const token = parseStartToken(m.text);
  const id = m.chat?.id;
  if (!token || (typeof id !== 'number' && typeof id !== 'string')) return null;
  const chatId = String(id);
  if (!/^-?[0-9]{1,20}$/.test(chatId)) return null;
  return { token, chatId };
}

/** One text message through the Bot API. A no-op while the bot is simulated. */
export async function sendMessage(chatId: string, text: string): Promise<TelegramResult> {
  if (BOT_IS_SIMULATED || !BOT_TOKEN) return { sent: false, reason: 'simulated' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return res.ok ? { sent: true } : { sent: false, reason: 'bot_api_refused', status: res.status };
  } catch {
    return { sent: false, reason: 'bot_api_refused' };
  }
}

/**
 * F1 — the bot's own @username, asked of Telegram (`getMe`) rather than written anywhere: the handle
 * the owner still owed is simply what the configured token answers to. Cached for the life of the
 * server instance; null while simulated or when Telegram does not answer (the caller falls back).
 */
let cachedUsername: string | null = null;
export async function botUsername(): Promise<string | null> {
  if (BOT_IS_SIMULATED || !BOT_TOKEN) return null;
  if (cachedUsername) return cachedUsername;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { ok?: boolean; result?: { username?: unknown } };
    const name = body.ok && typeof body.result?.username === 'string' ? body.result.username : null;
    cachedUsername = name && /^[A-Za-z0-9_]{5,32}$/.test(name) ? name : null;
    return cachedUsername;
  } catch {
    return null;
  }
}

/** The Telegram deep link that opens the bot and sends `/start <token>` — for the server's redirect only. */
export function startLink(username: string, token: string): string | null {
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username) || !/^[A-Za-z0-9_-]{1,64}$/.test(token)) return null;
  return `https://t.me/${username}?start=${token}`;
}

/**
 * CR-063 — a chat update the agents track should see: a typed message, a photo or document (with
 * its caption as the text), or a quick-reply tap (TC-AD-07, Telegram's `callback_query`, whose
 * `data` is the text). Never a `/start …` message — linking is the webhook's own path, and a
 * malformed `/start` must not leak out of it. Only the fields the agents need are kept; `sentAt`
 * is Telegram's own timestamp (seconds), never this server's clock (G3).
 */
export interface ChatReply {
  kind: 'message' | 'callback';
  chatId: string;
  messageId: number;
  sentAt: string;
  text: string | null;
  photoFileId: string | null;
  documentFileId: string | null;
  /** Present for a quick-reply tap, so the agent can answer the tap itself. */
  callbackQueryId: string | null;
}

type TgMessage = {
  message_id?: unknown; date?: unknown; text?: unknown; caption?: unknown;
  chat?: { id?: unknown };
  photo?: { file_id?: unknown; file_size?: unknown }[];
  document?: { file_id?: unknown };
};

const chatIdOf = (m: TgMessage | undefined): string | null => {
  const id = m?.chat?.id;
  if (typeof id !== 'number' && typeof id !== 'string') return null;
  const s = String(id);
  return /^-?[0-9]{1,20}$/.test(s) ? s : null;
};
const sentAtOf = (date: unknown): string | null =>
  typeof date === 'number' && Number.isInteger(date) && date > 0 ? new Date(date * 1000).toISOString() : null;
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

export function replyUpdateOf(update: unknown): ChatReply | null {
  if (!update || typeof update !== 'object') return null;
  const u = update as { message?: TgMessage; callback_query?: { id?: unknown; data?: unknown; message?: TgMessage } };

  if (u.callback_query && typeof u.callback_query === 'object') {
    const q = u.callback_query;
    const chatId = chatIdOf(q.message);
    const sentAt = sentAtOf(q.message?.date);
    const data = str(q.data);
    if (!chatId || !sentAt || !data || typeof q.message?.message_id !== 'number' || !str(q.id)) return null;
    return {
      kind: 'callback', chatId, messageId: q.message.message_id, sentAt, text: data.slice(0, 4096),
      photoFileId: null, documentFileId: null, callbackQueryId: String(q.id),
    };
  }

  const m = u.message;
  if (!m || typeof m !== 'object') return null;
  const chatId = chatIdOf(m);
  const sentAt = sentAtOf(m.date);
  if (!chatId || !sentAt || typeof m.message_id !== 'number') return null;
  const text = str(m.text) ?? str(m.caption);
  if (text !== null && /^\/start(?:@|\s|$)/.test(text.trim())) return null;
  const photos = Array.isArray(m.photo) ? m.photo.filter((p) => str(p?.file_id)) : [];
  // Telegram lists a photo's sizes smallest first; the last is the largest.
  const photoFileId = photos.length > 0 ? String(photos[photos.length - 1]!.file_id) : null;
  const documentFileId = str(m.document?.file_id);
  if (text === null && !photoFileId && !documentFileId) return null;
  return {
    kind: 'message', chatId, messageId: m.message_id, sentAt, text: text === null ? null : text.slice(0, 4096),
    photoFileId, documentFileId, callbackQueryId: null,
  };
}
