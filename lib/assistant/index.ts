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
import { selectedBackend } from '@/lib/db/client';
import { latestVoiceTurnSeq, voiceTurnsAfter } from '@/lib/data/pg/voice';
import type { Locale } from '@/i18n/locale';
import {
  chatConfigured, chatPayload, cleanMessage, guestTopic, pageForGuest, patientOf, readReply, readVoiceTurn,
  type AssistantAudience, type AssistantResult, type VoiceTurn,
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
  let signedIn = false;
  try {
    const session = await getSession();
    signedIn = !!session;
    patientId = patientOf(session);
  } catch {
    patientId = null;
  }
  if (!patientId) {
    const topic = guestTopic(message);
    return { ok: true, guestTopic: topic, page: pageForGuest(topic, signedIn) };
  }
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

/**
 * CR-069 — the patient's Alexa turns after `after` (a seq). `after: null` asks only for the starting
 * point, so the panel never replays old turns. Anyone but a signed-in patient, the mock backend, or
 * any failure → nothing. Read-only, under the verified session (RLS: the patient's own rows only).
 */
export async function voiceTurns(after: number | null): Promise<{ latest: number; turns: VoiceTurn[] }> {
  try {
    const session = await getSession();
    if (!patientOf(session) || !session || selectedBackend() !== 'postgres') return { latest: after ?? 0, turns: [] };
    if (after === null || !Number.isInteger(after) || after < 0) return { latest: await latestVoiceTurnSeq(session), turns: [] };
    const rows = await voiceTurnsAfter(session, after);
    const turns = rows.map(readVoiceTurn).filter((x): x is VoiceTurn => x !== null);
    return { latest: rows.reduce((m, r) => Math.max(m, r.seq), after), turns };
  } catch {
    return { latest: after ?? 0, turns: [] };
  }
}
