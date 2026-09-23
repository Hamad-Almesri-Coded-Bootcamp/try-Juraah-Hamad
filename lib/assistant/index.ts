'use server';
/**
 * CR-067 — the web-app assistant's server actions. A screen imports these and nothing else; no
 * component contains a fetch (guard 3).
 *
 * askAssistant, always in this order: the message is valid, or refuse → the VERIFIED session:
 *   - a patient → the patient's own alerts, read under that session through the seam (RLS) → n8n
 *     (agent-webchat) with the header secret → its reply, or "unavailable";
 *   - anyone else (no session, caregiver, reviewer, admin, pending-only) → app help from the copy
 *     catalogue, decided here: no n8n, no model, no database read, no medical data in reach.
 * Nothing is written anywhere on either path.
 */
import { AGENT_CHAT_URL, AGENT_INBOUND_SECRET } from '@/lib/config';
import { getSession } from '@/lib/session';
import { getAlerts } from '@/lib/data';
import type { Locale } from '@/i18n/locale';
import {
  chatConfigured, chatPayload, cleanMessage, guestTopic, patientOf, readReply, type AssistantAudience, type AssistantResult,
} from './core';

/** Who the panel is talking to — decides its intro and suggestions. Never throws: unknown is a guest. */
export async function assistantAudience(): Promise<AssistantAudience> {
  try {
    return patientOf(await getSession()) ? 'patient' : 'guest';
  } catch {
    return 'guest';
  }
}

export async function askAssistant(text: string, locale: Locale): Promise<AssistantResult> {
  const message = cleanMessage(text);
  if (!message) return { ok: false, reason: 'invalid' };
  let patientId: string | null = null;
  try {
    patientId = patientOf(await getSession());
  } catch {
    patientId = null;
  }
  if (!patientId) return { ok: true, guestTopic: guestTopic(message) };
  if (!chatConfigured(AGENT_CHAT_URL, AGENT_INBOUND_SECRET)) return { ok: false, reason: 'unavailable' };
  const language: Locale = locale === 'en' ? 'en' : 'ar';
  try {
    const alerts = await getAlerts(patientId);
    const res = await fetch(AGENT_CHAT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-jurah-secret': AGENT_INBOUND_SECRET },
      body: JSON.stringify(chatPayload(patientId, message, language, Array.isArray(alerts) ? alerts : [])),
      signal: AbortSignal.timeout(25_000),
    });
    return readReply(res.status, await res.json().catch(() => null));
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
