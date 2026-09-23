'use server';
/**
 * CR-067 — the web-app assistant's one server action. A screen imports `askAssistant` and nothing
 * else; no component contains a fetch (guard 3).
 *
 * Order, always: the VERIFIED session → a patient, or refuse → the message is valid, or refuse →
 * the patient's own alerts, read under that session through the seam (RLS) → n8n (agent-webchat)
 * with the header secret → its reply, or "unavailable". Nothing is written anywhere on this path.
 */
import { AGENT_CHAT_URL, AGENT_INBOUND_SECRET } from '@/lib/config';
import { getSession } from '@/lib/session';
import { getAlerts } from '@/lib/data';
import type { Locale } from '@/i18n/locale';
import { chatConfigured, chatPayload, cleanMessage, patientOf, readReply, type AssistantResult } from './core';

export async function askAssistant(text: string, locale: Locale): Promise<AssistantResult> {
  const patientId = patientOf(await getSession());
  if (!patientId) return { ok: false, reason: 'not_a_patient' };
  const message = cleanMessage(text);
  if (!message) return { ok: false, reason: 'invalid' };
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
