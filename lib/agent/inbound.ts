/**
 * CR-063 — the Telegram webhook's hand-off to the agents track. The app owns the bot's ONE webhook
 * (Telegram allows one per bot), so a patient's reply reaches the Adherence Agent only if the
 * webhook passes it on. This is that pass: after the neutral 200 has gone back to Telegram, a reply
 * from a chat whose subject is a patient, or an ACTIVE caregiver, is POSTed to the n8n inbound
 * workflow with a header secret. Nothing else is forwarded — an unknown chat, a disconnected or
 * superseded link, a caregiver whose invitation is not active (TC-AD-16) — and nothing is written.
 *
 * The payload names who the chat belongs to, so the agents never resolve a chat id themselves and
 * never see a Civil ID, a name or a phone number (0008). It carries no dose status: the agent
 * decides and writes one through POST /api/agent/doses/{id}/status like any other agent write.
 * A failed or unconfigured forward is quiet (G10: the chat is optional); it never retries into a
 * guess and never marks anything unanswered (rule 4).
 */
import { AGENT_INBOUND_SECRET, AGENT_INBOUND_URL } from '@/lib/config';
import { subjectForChat, type ChatSubject } from '@/lib/data/pg/channels';
import { replyUpdateOf, type ChatReply } from '@/lib/messaging/telegram';

export interface InboundPayload extends ChatReply {
  channel: 'telegram';
  subjectType: ChatSubject['subjectType'];
  subjectId: string;
  patientId: string;
  language: ChatSubject['language'];
  /** CR-092 (AP-05) - passed straight through from ChatSubject so the agent can say check-ins are
   * off instead of "no dose"; recording itself is still gated only by a dose's own `tracked`. */
  trackingOn: ChatSubject['trackingOn'];
}

export type ForwardResult =
  | { forwarded: true }
  | { forwarded: false; reason: 'not_configured' | 'not_a_reply' | 'no_subject' | 'refused'; status?: number };

/** A `/webhook/` URL of the ACTIVATED workflow. A `/webhook-test/` URL is a bug, never a fallback. */
export function inboundConfigured(url: string = AGENT_INBOUND_URL, secret: string = AGENT_INBOUND_SECRET): boolean {
  return /^https:\/\/[^/]+\/webhook\//.test(url) && !url.includes('/webhook-test/') && secret.length > 0;
}

export function inboundPayload(reply: ChatReply, subject: ChatSubject): InboundPayload {
  return {
    ...reply,
    channel: 'telegram',
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    patientId: subject.patientId,
    language: subject.language,
    trackingOn: subject.trackingOn,
  };
}

export async function forwardToAgents(payload: InboundPayload): Promise<ForwardResult> {
  if (!inboundConfigured()) return { forwarded: false, reason: 'not_configured' };
  try {
    const res = await fetch(AGENT_INBOUND_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-jurah-secret': AGENT_INBOUND_SECRET },
      body: JSON.stringify(payload),
    });
    return res.ok ? { forwarded: true } : { forwarded: false, reason: 'refused', status: res.status };
  } catch {
    return { forwarded: false, reason: 'refused' };
  }
}

/**
 * The whole relay, run by the webhook inside after(): configured? → a forwardable reply? → whose
 * chat? → forward. Each "no" is a quiet result, in that order, so an unconfigured deployment never
 * even reads the database.
 */
export async function relayReply(update: unknown): Promise<ForwardResult> {
  if (!inboundConfigured()) return { forwarded: false, reason: 'not_configured' };
  const reply = replyUpdateOf(update);
  if (!reply) return { forwarded: false, reason: 'not_a_reply' };
  const subject = await subjectForChat(reply.chatId);
  if (!subject) return { forwarded: false, reason: 'no_subject' };
  return forwardToAgents(inboundPayload(reply, subject));
}
