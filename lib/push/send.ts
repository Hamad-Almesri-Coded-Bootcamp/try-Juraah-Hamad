/**
 * Web push delivery (P2-WP6) — VAPID via the pinned `web-push` package. Server-only.
 *
 * G12, "notifications alert, never collect", built into the only payload builder there is:
 *  - the payload is a WHITELIST — `{ title, body, url }` and nothing else. Every other key a
 *    caller passes (`actions`, `data`, `data.actions`, `tag`, `requireInteraction`, …) is dropped,
 *    so a notification can never carry an action button that could record anything (rule 1);
 *  - SAFETY-CRITICAL CONTENT IS NEVER ONLY IN A PAYLOAD. A payload is a pointer: `url` opens the
 *    screen that holds the full, reviewed content (an alert, a refill, an invitation), and `body`
 *    is never the only place a clinical fact is stated. A dropped, denied or never-delivered push
 *    therefore loses nothing — the same content is on that screen (tests/unit/push/payload.test.ts
 *    asserts the whitelist and states this rule).
 * public/sw.js (frozen) reads exactly these three keys and sets no actions.
 */
import webpush from 'web-push';
import { APP_ORIGIN, PUSH_IS_SIMULATED, PUSH_PUBLIC_KEY, VAPID_PRIVATE_KEY } from '@/lib/config';

export interface PushPayload {
  title: string;
  body: string;
  /** A same-origin path to open — the screen that carries the real content. */
  url: string;
}

/** A browser subscription, read server-side only (never projected, never logged). */
export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushResult =
  | { sent: true; statusCode: number }
  | { sent: false; reason: 'simulated' | 'no_https_origin' | 'bad_payload' | 'push_service_refused'; statusCode?: number };

/**
 * Builds the one payload shape a push may carry. Anything but the three string keys is stripped —
 * including `actions` and `data.actions` — and `url` must be a same-origin path (`/…`, never
 * `//host`), so a payload cannot point a patient anywhere else. Returns null when a key is missing.
 */
export function buildPushPayload(input: unknown): PushPayload | null {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const { title, body, url } = v;
  if (typeof title !== 'string' || typeof body !== 'string' || typeof url !== 'string') return null;
  if (!url.startsWith('/') || url.startsWith('//')) return null;
  return { title, body, url };
}

/** The serialised bytes that leave the server — built only from buildPushPayload's output. */
export function serialisePushPayload(input: unknown): string | null {
  const payload = buildPushPayload(input);
  return payload ? JSON.stringify(payload) : null;
}

/** VAPID requires an https: (or mailto:) subject; a plain-http origin cannot sign. */
function vapidSubject(): string | null {
  return APP_ORIGIN.startsWith('https://') ? APP_ORIGIN : null;
}

/** Sends one notification. A no-op while PUSH_IS_SIMULATED (no VAPID private key configured). */
export async function sendPush(target: PushTarget, input: unknown): Promise<PushResult> {
  if (PUSH_IS_SIMULATED) return { sent: false, reason: 'simulated' };
  const subject = vapidSubject();
  if (!subject) return { sent: false, reason: 'no_https_origin' };
  const bytes = serialisePushPayload(input);
  if (!bytes) return { sent: false, reason: 'bad_payload' };
  try {
    const res = await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      bytes,
      { vapidDetails: { subject, publicKey: PUSH_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY }, TTL: 3600 },
    );
    return { sent: true, statusCode: res.statusCode };
  } catch (e) {
    // The push service's refusal (expired endpoint, 410 Gone …) is never an error for the caller:
    // push is optional (G12) and a failed push blocks nothing. The endpoint itself is never logged.
    const statusCode = typeof (e as { statusCode?: unknown }).statusCode === 'number' ? (e as { statusCode: number }).statusCode : undefined;
    return { sent: false, reason: 'push_service_refused', statusCode };
  }
}
