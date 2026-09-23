/**
 * The signed session cookie (D-018) — sign and verify, Web Crypto ONLY (no `node:crypto`), so the
 * same module runs in `proxy.ts` and in the server session module: one verifier, never two that
 * can drift (BACKEND-PLAN risk 2).
 *
 *   cookie value = base64url(JSON{ session, sid, exp }) + "." + base64url(HMAC-SHA256(secret, <first part>))
 *
 * `session` is the unchanged `Session` shape; `sid` names the `sessions` row the data layer checks
 * for revocation (E-26); `exp` is epoch milliseconds on the FROZEN clock (D-021: REFERENCE_NOW,
 * never the wall clock) — the same instant as `sessions.expires_at`. The secret is the UTF-8 bytes
 * of JURAH_SESSION_SECRET; the caller passes it in (this module reads no environment).
 *
 * Verification: the MAC is checked with `crypto.subtle.verify` (a constant-time comparison inside
 * the Web Crypto implementation), BEFORE the payload is parsed; then the payload's shape; then
 * `exp > now`. Anything else → `null` = no session. Never throws on bad input.
 */
import { REFERENCE_NOW } from '@/lib/config';
import type { Role, Session } from '@/types/views';

export interface SessionPayload {
  session: Session;
  sid: string;
  exp: number;
}

/** Session lifetime. With the frozen clock (D-021) it is measured from REFERENCE_NOW. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** `exp` for a session issued "now" on the frozen clock. */
export function sessionExpiry(nowIso: string = REFERENCE_NOW): number {
  return Date.parse(nowIso) + SESSION_TTL_MS;
}

const ROLES: readonly Role[] = ['patient', 'caregiver', 'reviewer', 'admin'];
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/**
 * The canonical `Session` literal: keys in the mock's order (subjectId, role, linkedPatientId,
 * pendingInvitationOnly), an absent key left out — so what crosses the seam is byte-identical to
 * the mock's (`{"subjectId":"pt-01","role":"patient"}`, `{"subjectId":"cg-03","pendingInvitationOnly":true}`).
 */
export function canonicalSession(s: Session): Session {
  const out: Session = { subjectId: s.subjectId };
  if (s.role !== undefined) out.role = s.role;
  if (s.linkedPatientId !== undefined) out.linkedPatientId = s.linkedPatientId;
  if (s.pendingInvitationOnly) out.pendingInvitationOnly = true;
  return out;
}

function parseSession(v: unknown): Session | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.some((k) => !['subjectId', 'role', 'linkedPatientId', 'pendingInvitationOnly'].includes(k))) return null;
  if (typeof o.subjectId !== 'string' || o.subjectId === '') return null;
  if (o.role !== undefined && !ROLES.includes(o.role as Role)) return null;
  if (o.linkedPatientId !== undefined && typeof o.linkedPatientId !== 'string') return null;
  if (o.pendingInvitationOnly !== undefined && o.pendingInvitationOnly !== true) return null;
  // ROLES.md: a session is either a role or pending-only (the sessions table's own check).
  if (o.pendingInvitationOnly === true ? o.role !== undefined : o.role === undefined) return null;
  return canonicalSession(o as unknown as Session);
}

/** Signs a payload into a cookie value. Throws only on a missing secret (a configuration error). */
export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  if (!secret) throw new Error('JURAH_SESSION_SECRET is not set — refusing to issue an unsigned session (D-018)');
  const body = toBase64Url(encoder.encode(JSON.stringify({ session: canonicalSession(payload.session), sid: payload.sid, exp: payload.exp })));
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body)));
  return `${body}.${toBase64Url(mac)}`;
}

/**
 * The cookie value → its payload, or `null` for anything not signed by `secret`, malformed,
 * or expired at `nowMs` (default: the frozen clock). A missing secret verifies nothing.
 */
export async function verifySession(cookieValue: string | undefined | null, secret: string, nowMs: number = Date.parse(REFERENCE_NOW)): Promise<SessionPayload | null> {
  if (!cookieValue || !secret) return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;
  const [body, macText] = parts as [string, string];
  const mac = fromBase64Url(macText);
  const bodyBytes = fromBase64Url(body);
  if (!mac || !bodyBytes || mac.length !== 32) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), mac, encoder.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Record<string, unknown>;
  const session = parseSession(p.session);
  if (!session || typeof p.sid !== 'string' || p.sid === '' || typeof p.exp !== 'number' || !Number.isFinite(p.exp)) return null;
  if (!(p.exp > nowMs)) return null;
  return { session, sid: p.sid, exp: p.exp };
}

/** A random session id (128 bits, base64url). Web Crypto, so it is edge-safe too. */
export function newSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `ses_${toBase64Url(bytes)}`;
}
