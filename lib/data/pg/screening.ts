/**
 * F3 / AP-10 — screening on every path: a prescription is screened, or held for a human. Called
 * AFTER the write has committed (the Interaction Screening agent reads the prescription back through
 * /api/agent, so it must already be there), from every place a prescription becomes, or stays,
 * something the patient relies on:
 *   - the patient's own save of a draft          (reads-rx.ts savePrescriptionDraft)
 *   - an agent's save, POST /api/agent/prescriptions (agent.ts insertExtractedPrescription)
 *   - a reviewer confirming a flagged one        (writes.ts confirmPrescriptionFields, TC-IX-06)
 *   - a refill request, D10 / CR-082              (writes.ts requestRefill: that prescription's pairs
 *                                                  are screened again)
 * scripts/guards/screening-on-every-path.ts fails the build when a function that creates or confirms
 * a prescription, or requests a refill, stops calling this.
 *
 * Awaited, never fire-and-forget: the caller's action returns only once n8n has ACCEPTED the job (at
 * most lib/agent-webhooks SCREENING_TIMEOUT_MS; the result arrives later, as alerts).
 *
 * Fail closed. When screening is configured but the request is not accepted (n8n down, a timeout, a
 * refusal), a `warning` / `pending_medical_review` alert on that prescription is raised through the
 * agent's own audited insert (role jurah_agent, `alert_raised` by actor agent). That hold is the
 * visible record of the miss: it reaches the reviewer's queue and the patient's Safety list, never
 * silently unchecked. If even the hold cannot be written, the miss is logged as an error in the
 * server log (the one place left), and the outcome is `skipped`. A retry record for such misses is
 * proposed in CR-088; it needs a migration, so it is not built.
 *
 * With screening NOT configured (production today: no JURAH_AGENT_SCREENING_URL) nothing is called,
 * nothing is raised and nothing is read: the CR-049 behaviour, unchanged, and the save path is
 * untouched. A flagged prescription (needsReview) is `skipped` too: its reviewer's confirmation
 * screens it.
 */
import type { Prescription } from '@/types/contracts';
import { requestScreening, screeningConfigured } from '@/lib/agent-webhooks';
import { shouldScreen, type AgentLanguage } from '@/lib/agent-webhooks/core';
import { screeningUnconfirmedDescription } from '@/lib/agent/messages';
import { insertAlert, patientLanguage } from './agent';

export type ScreeningOutcome = 'screened' | 'held' | 'skipped';

type Screenable = Pick<Prescription, 'id' | 'needsReview' | 'status' | 'drug'>;

/**
 * `language` is the patient's (the alerts are written in it); omitted, it is read from the patient's
 * settings under the agent role, because a reviewer's session may no longer see the patient.
 */
export async function screenOrHold(patientId: string, rx: Screenable, language?: AgentLanguage): Promise<ScreeningOutcome> {
  if (!screeningConfigured() || !shouldScreen(rx)) return 'skipped';
  const lang = language ?? (await patientLanguage(patientId));
  if (await requestScreening(patientId, rx.id, lang)) return 'screened';
  try {
    const held = await insertAlert({
      patientId,
      involvedPrescriptionIds: [rx.id],
      severity: 'warning',
      description: screeningUnconfirmedDescription(rx.drug.genericName, lang),
      sourceCitation: '',
      reviewStatus: 'pending_medical_review',
    });
    if (held.kind === 'ok') {
      console.warn(`[screening] not accepted by n8n; held for review: prescription ${rx.id} (alert ${held.alert.id})`);
      return 'held';
    }
    console.error(`[screening] NOT SCREENED AND NOT HELD: prescription ${rx.id}; the hold was refused (${held.kind})`);
  } catch {
    console.error(`[screening] NOT SCREENED AND NOT HELD: prescription ${rx.id}; the hold could not be written`);
  }
  return 'skipped';
}
