/**
 * Validation of a browser PushSubscription JSON for POST /api/push/subscription (P2-WP6). Pure.
 * Only the three values delivery needs survive; the endpoint must be https.
 */
import type { BrowserSubscription } from '@/lib/data/pg/channels';

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** A standard PushSubscription JSON: https endpoint, P-256 public key (65 bytes), 16-byte auth secret. */
export function parseBrowserSubscription(body: unknown): BrowserSubscription | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = b.endpoint;
  const p256dh = b.keys?.p256dh;
  const auth = b.keys?.auth;
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || typeof p256dh !== 'string' || typeof auth !== 'string') return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!B64URL.test(p256dh) || p256dh.length < 86 || p256dh.length > 90) return null;
  if (!B64URL.test(auth) || auth.length < 22 || auth.length > 24) return null;
  return { endpoint, p256dh, auth };
}
