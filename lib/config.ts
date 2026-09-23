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
/**
 * P2-WP6 (BACKEND-NOTES §2: "wire the flags to the real channel state"): the chat is simulated
 * exactly while no bot token is configured server-side. Nothing is ever sent through the Bot API
 * while this is true, and the webhook answers 404 on every path (an empty token would make its
 * path secret a public constant).
 */
export const BOT_IS_SIMULATED: boolean = !process.env.JURAH_BOT_TOKEN;

/** Web push public key. Phase 1 subscribes to nothing; the service worker exists, the key does not. */
export const PUSH_PUBLIC_KEY: string =
  process.env.NEXT_PUBLIC_PUSH_PUBLIC_KEY ?? 'phase-2-vapid-public-key-placeholder';
/** P2-WP6: push is simulated exactly while no VAPID private key is configured server-side. */
export const PUSH_IS_SIMULATED: boolean = !process.env.JURAH_VAPID_PRIVATE_KEY;

// ---- Server-only values (P2-WP6). Never NEXT_PUBLIC_: Next inlines only NEXT_PUBLIC_* into a
// client bundle, so in a browser each of these reads as ''. Never logged, never rendered, never in
// a payload. Empty means "not configured" — every consumer refuses rather than falling open. ----
/** Telegram Bot API token (owed; empty until a bot exists). */
export const BOT_TOKEN: string = process.env.JURAH_BOT_TOKEN ?? '';
/** VAPID private key; its public half is PUSH_PUBLIC_KEY above. */
export const VAPID_PRIVATE_KEY: string = process.env.JURAH_VAPID_PRIVATE_KEY ?? '';
/**
 * Bearer credential for app/api/agent/** (WP7). Trimmed, as sessionSecret() is: a value pasted into
 * the host's dashboard can carry a trailing newline that no HTTP header can ever match, so an
 * untrimmed token refuses every caller (seen live on 2026-09-23). An all-blank value is still ''.
 */
export const AGENT_TOKEN: string = (process.env.JURAH_AGENT_TOKEN ?? '').trim();
/** Bearer credential for app/api/jobs/** (the expiry job). Trimmed, for the same reason. */
export const JOB_TOKEN: string = (process.env.JURAH_JOB_TOKEN ?? '').trim();
/**
 * CR-063: where the Telegram webhook forwards a chat reply to the agents track (the n8n inbound
 * webhook, a `/webhook/` URL — never `/webhook-test/`), and the header secret it sends with it.
 * Either empty → nothing is forwarded (fail closed; the chat stays optional, G10).
 */
/**
 * CR-067: the n8n workflow that answers the web-app assistant (agent-webchat), a `/webhook/` URL.
 * Authenticated with the same header secret as the relay. Empty → the assistant says it is
 * unavailable; nothing else changes.
 */
export const AGENT_CHAT_URL: string = (process.env.JURAH_AGENT_CHAT_URL ?? '').trim();
/**
 * CR-066: the drug-knowledge agents (agents/knowledge) the seam calls, each a `/webhook/` URL of an
 * activated n8n workflow, authenticated with the same header secret as the relay:
 *   - TRAVEL_CHECK  → checkDrugPhoto (C3) asks agent-travel-check;
 *   - EXTRACTION    → submitPrescriptionImage (B4) asks agent-extraction (save:false — the app keeps
 *                     its own draft → confirm → save flow);
 *   - SCREENING     → savePrescriptionDraft hands every saved, unflagged prescription to
 *                     agent-interaction-screening-ddinter.
 * Empty → that function keeps the CR-049 deterministic stub, byte for byte; nothing else changes.
 */
export const AGENT_TRAVEL_CHECK_URL: string = (process.env.JURAH_AGENT_TRAVEL_CHECK_URL ?? '').trim();
export const AGENT_EXTRACTION_URL: string = (process.env.JURAH_AGENT_EXTRACTION_URL ?? '').trim();
export const AGENT_SCREENING_URL: string = (process.env.JURAH_AGENT_SCREENING_URL ?? '').trim();
// Trimmed: a trailing newline in the secret would make fetch() refuse the header outright.
export const AGENT_INBOUND_URL: string = (process.env.JURAH_AGENT_INBOUND_URL ?? '').trim();
export const AGENT_INBOUND_SECRET: string = (process.env.JURAH_AGENT_INBOUND_SECRET ?? '').trim();
/** The deployment's own origin: builds the calendar feed's webcal:// URL and the VAPID subject. */
export const APP_ORIGIN: string = process.env.JURAH_APP_ORIGIN || 'http://localhost:3000';

/** Hawiati approval countdown, in seconds (the simulated identity step on A1 and X0). */
export const HAWIATI_COUNTDOWN_SECONDS = 25;

/** Name of the mock session cookie. Read by proxy.ts and the session module only. */
export const SESSION_COOKIE = 'jurah.session' as const;

// ---- Server-only session values (P2-WP2, D-018) — same pattern as WP6's block above. ----
/**
 * The HMAC key of the signed session cookie (JURAH_SESSION_SECRET). A FUNCTION, read at call time,
 * because the tsx scripts and the integration harness load .env.local after this module's first
 * import. Empty = not configured: nothing is signed and nothing verifies (fail closed). proxy.ts
 * reads the same variable itself (it must not depend on this module's server values at the edge).
 */
export function sessionSecret(): string {
  return (process.env.JURAH_SESSION_SECRET ?? '').trim();
}
/** The session cookie carries `Secure` in production builds (D-018). */
export const SESSION_COOKIE_SECURE: boolean = process.env.NODE_ENV === 'production';
