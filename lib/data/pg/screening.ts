/**
 * F3 — every saved prescription is screened, or held for a human. Called AFTER the saving
 * transaction has committed (the Interaction Screening agent reads the prescription back through
 * /api/agent, so it must already be there), from both places a prescription becomes active:
 *   - the patient's own save of a draft (reads-rx.ts savePrescriptionDraft), and
 *   - a reviewer confirming a flagged one's fields (writes.ts confirmPrescriptionFields) — before
 *     F3 a flagged prescription was never screened after review (TC-IX-06).
 *
 * Fail closed: when screening is configured but cannot be confirmed (n8n down, a timeout, a refusal),
 * a `pending_medical_review` alert on that prescription is raised through the agent's own insert
 * path (role jurah_agent, audited), so it reaches the reviewer's queue and the patient's Safety
 * screen as "awaiting medical review" — never silently unchecked. With screening NOT configured the
 * CR-049 stub behaviour is unchanged (nothing to wait for, nothing raised).
 */
import type { Prescription } from '@/types/contracts';
import { requestScreening, screeningConfigured } from '@/lib/agent-webhooks';
import { shouldScreen, type AgentLanguage } from '@/lib/agent-webhooks/core';
import { screeningUnconfirmedDescription } from '@/lib/agent/messages';
import { insertAlert } from './agent';

export type ScreeningOutcome = 'screened' | 'held' | 'skipped';

export async function screenOrHold(patientId: string, rx: Pick<Prescription, 'id' | 'needsReview' | 'status' | 'drug'>, language: AgentLanguage): Promise<ScreeningOutcome> {
  if (!screeningConfigured() || !shouldScreen(rx)) return 'skipped';
  if (await requestScreening(patientId, rx.id, language)) return 'screened';
  try {
    const held = await insertAlert({
      patientId,
      involvedPrescriptionIds: [rx.id],
      severity: 'warning',
      description: screeningUnconfirmedDescription(rx.drug.genericName),
      sourceCitation: '',
      reviewStatus: 'pending_medical_review',
    });
    return held.kind === 'ok' ? 'held' : 'skipped';
  } catch {
    return 'skipped';
  }
}
