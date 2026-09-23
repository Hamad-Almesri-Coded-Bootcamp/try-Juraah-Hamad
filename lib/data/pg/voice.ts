/**
 * CR-069 — the patient's own Alexa turns, for the assistant panel to follow. Read under the
 * VERIFIED session through withSession(): the voice_turns policy (0012) returns rows only to the
 * patient they belong to, so a caregiver, reviewer or no session reads nothing. Not in the lead's
 * pg/ barrel: lib/assistant imports it directly, as the agent routes import ./agent.ts.
 */
import { withSession } from '@/lib/db/withSession';
import type { Session } from '@/types/views';

export interface VoiceTurnRow { seq: number; topic: string; language: 'ar' | 'en'; reply: string }

/** The newest turn's seq (0 when there is none) — the panel's starting point, so old turns are never replayed. */
export async function latestVoiceTurnSeq(session: Session): Promise<number> {
  return withSession(session, async (sql) => {
    const [r] = await sql`select coalesce(max(seq), 0) as seq from voice_turns`;
    return Number(r?.seq ?? 0);
  });
}

/** Turns after `afterSeq`, oldest first, at most 5. */
export async function voiceTurnsAfter(session: Session, afterSeq: number): Promise<VoiceTurnRow[]> {
  return withSession(session, async (sql) => {
    const rows = await sql`select seq, topic, language, reply from voice_turns where seq > ${afterSeq} order by seq limit 5`;
    return rows.map((r) => ({ seq: Number(r.seq), topic: String(r.topic), language: r.language === 'en' ? 'en' : 'ar', reply: String(r.reply) }));
  });
}
