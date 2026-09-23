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
  | { ok: true; reply: string; telegramPrompted: boolean; intent: WebchatIntent; page: AssistantPage | null }
  /** App help for a visitor who is not a signed-in patient — a copy-catalogue key, resolved by the component. */
  | { ok: true; guestTopic: GuestTopic; page: AssistantPage | null }
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

/**
 * The intents agent-webchat can answer with (agents/lib/webchat.js WEBCHAT_INTENTS). Anything else
 * n8n sends back is read as 'unclear' — the panel then asks back instead of moving anywhere.
 */
export const WEBCHAT_INTENTS = [
  'next_dose', 'dose_amount', 'today', 'forgot', 'took_it', 'safety', 'help_telegram', 'help_refill', 'help_general', 'unclear',
] as const;
export type WebchatIntent = (typeof WEBCHAT_INTENTS)[number];

/**
 * The screen an answer is about — the panel opens it behind the conversation. Doses → Today; a dose
 * the patient reports (recorded from Telegram) → Activity, where the recorded row appears; 'unclear'
 * → nowhere (the panel asks back first).
 */
export type AssistantPage = 'today' | 'activity' | 'safety' | 'notifications' | 'refill' | 'help' | 'signin';
const PAGE_FOR_INTENT: Record<WebchatIntent, AssistantPage | null> = {
  next_dose: 'today', dose_amount: 'today', today: 'today', forgot: 'activity', took_it: 'activity',
  safety: 'safety', help_telegram: 'notifications', help_refill: 'refill', help_general: 'help', unclear: null,
};
export function pageForIntent(intent: WebchatIntent): AssistantPage | null {
  return PAGE_FOR_INTENT[intent];
}
/** A visitor with NO session is moved to Sign in for the topics that need one; a signed-in caregiver or reviewer stays put. */
export function pageForGuest(topic: GuestTopic, signedIn: boolean): AssistantPage | null {
  return !signedIn && topic !== 'guestGeneral' ? 'signin' : null;
}
/** The path under /{locale} for each page — all in the patient shell except Sign in. */
export const PAGE_PATH: Record<AssistantPage, string> = {
  today: '/app', activity: '/app/more/activity', safety: '/app/safety', notifications: '/app/more/notifications',
  refill: '/app/more/refill', help: '/app/more/help', signin: '/signin',
};

/** n8n's answer → a result; anything unexpected is "unavailable", never a made-up reply. */
export function readReply(status: number, body: unknown): AssistantResult {
  if (status < 200 || status >= 300 || !body || typeof body !== 'object') return { ok: false, reason: 'unavailable' };
  const b = body as { reply?: unknown; telegramPrompted?: unknown; intent?: unknown };
  if (typeof b.reply !== 'string' || b.reply.trim().length === 0) return { ok: false, reason: 'unavailable' };
  const intent: WebchatIntent = (WEBCHAT_INTENTS as readonly unknown[]).includes(b.intent) ? (b.intent as WebchatIntent) : 'unclear';
  return { ok: true, reply: b.reply.slice(0, 2000), telegramPrompted: b.telegramPrompted === true, intent, page: pageForIntent(intent) };
}

/**
 * CR-069 — the screen follows the voice. A turn the patient had with Alexa (agent-alexa → voice_turns),
 * as the panel receives it. The topic list is agents/lib/voice.js screenTopic's; anything else is
 * dropped, never guessed.
 */
export const VOICE_TOPICS = ['launch', 'next_dose', 'dose_amount', 'today', 'forgot', 'unclear', 'bye'] as const;
export type VoiceTopic = (typeof VOICE_TOPICS)[number];
export interface VoiceTurn { seq: number; topic: VoiceTopic; language: 'ar' | 'en'; reply: string; page: AssistantPage | null }

const PAGE_FOR_VOICE: Record<VoiceTopic, AssistantPage | null> = {
  launch: null, next_dose: 'today', dose_amount: 'today', today: 'today', forgot: 'activity', unclear: null, bye: null,
};

/** A row → a turn, or null for anything outside the list (the panel shows nothing for it). */
export function readVoiceTurn(row: { seq: number; topic: string; language: string; reply: string }): VoiceTurn | null {
  if (!(VOICE_TOPICS as readonly string[]).includes(row.topic) || !Number.isFinite(row.seq) || !row.reply) return null;
  const topic = row.topic as VoiceTopic;
  return { seq: row.seq, topic, language: row.language === 'en' ? 'en' : 'ar', reply: row.reply.slice(0, 2000), page: PAGE_FOR_VOICE[topic] };
}
