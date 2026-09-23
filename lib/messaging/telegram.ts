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
