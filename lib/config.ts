/**
 * The one configuration module (Master Prompt: "one config module holds the API base URL, the
 * auth token, the bot handle, the push public-key placeholder and REFERENCE_NOW").
 * Phase 2 changes VALUES here, never the shape. No other file may read process.env.
 */

/** The frozen clock from docs/Seed Dataset.md. Every "is this past / is this today" decision uses it (G3). */
export const REFERENCE_NOW = '2026-09-21T09:15:00+03:00' as const;
export const REFERENCE_TIME_ZONE = 'Asia/Kuwait' as const;

/** The only place a Date may be constructed from the clock. Components call this, never Date.now(). */
export function referenceNow(): Date {
  return new Date(REFERENCE_NOW);
}

/**
 * The loud marker for a value the project owner still owes (the real sourceCitation, the copy
 * deck, the real bot handle — three items; the demo script is not a code artifact). scripts/guards/placeholders.ts counts every
 * occurrence and reports it at each gate. Never replace it with an invented or plausible value.
 */
export const TO_BE_SUPPLIED = '[TO BE SUPPLIED]' as const;

/** Phase 2 API base. Phase 1 performs no fetch anywhere; this is read by nothing yet. */
export const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

/** Phase 2 session/auth token slot. Phase 1 uses a mock cookie session and never sends a token. */
export const AUTH_TOKEN: string | null = null;

/**
 * The messaging bot handle. The spec fixes the PLACEHOLDER `@jurah_bot` for Phase 1 — no such bot
 * exists — and every screen that shows it says the chat is simulated. Swapping in the real handle
 * is a one-line change to REAL_BOT_HANDLE below (or the env var), nowhere else.
 */
export const BOT_HANDLE: string = process.env.NEXT_PUBLIC_BOT_HANDLE ?? '@jurah_bot';
/** The real handle is owed by the project owner. Until it lands, the chat is labelled simulated. */
export const REAL_BOT_HANDLE: string = TO_BE_SUPPLIED;
export const BOT_IS_SIMULATED = REAL_BOT_HANDLE === TO_BE_SUPPLIED;

/** Web push public key. Phase 1 subscribes to nothing; the service worker exists, the key does not. */
export const PUSH_PUBLIC_KEY: string =
  process.env.NEXT_PUBLIC_PUSH_PUBLIC_KEY ?? 'phase-2-vapid-public-key-placeholder';
export const PUSH_IS_SIMULATED = true;

/** Hawiati approval countdown, in seconds (the simulated identity step on A1 and X0). */
export const HAWIATI_COUNTDOWN_SECONDS = 25;

/** Name of the mock session cookie. Read by proxy.ts and the session module only. */
export const SESSION_COOKIE = 'jurah.session' as const;
