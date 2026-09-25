/**
 * AP-10 / CR-089 — the "being checked" state (D12, CR-084), derived from data that already exists:
 * no migration, no new contract field, no new data function. Pure: every value comes in as an
 * argument (the caller passes kuwaitNow(), rule 9), nothing is fetched here.
 *
 * A prescription is BEING CHECKED when all of these hold:
 *   1. screening runs on this server at all (`screeningLive`, lib/agent-webhooks/state.ts): with no
 *      screening configured nothing is checking it, and the screen must not say otherwise;
 *   2. it is active and unflagged (`needsReview: false`, the same test screenOrHold applies): a
 *      flagged prescription is not screened until its reviewer confirms it (TC-IX-06), and it
 *      already carries its own "awaiting review" note;
 *   3. its latest screening trigger is recent: the newest `prescription_added` or
 *      `prescription_field_confirmed` audit row for it (both written in the same transaction as the
 *      write that hands it to screening) is at most SCREENING_ANSWER_WINDOW_MINUTES old. Older rows,
 *      the seed's among them, predate screening and are never "being checked";
 *   4. no alert naming it has been raised since that trigger. Every answer the screening agent
 *      gives about a new prescription is an alert naming it: a finding, "cannot verify", "nothing
 *      found" (the `info` / `auto_cleared` marker CR-077 keeps), and the backend's own hold when n8n
 *      did not accept the job (which the screen then shows as that alert, not as "being checked");
 *   5. the patient has another active prescription: with none, the agent has nothing to screen it
 *      against and raises nothing (agents/knowledge/src/screening.js), so waiting would never end.
 *
 * What it cannot see without a schema change: a job n8n ACCEPTED and then failed to finish shows as
 * being checked until the window closes, then as nothing. The retry record proposed in CR-088 would
 * make that exact.
 */
import type { AuditEvent, InteractionAlert, Prescription } from '@/types/contracts';

/** The screening workflow answers in seconds; past this, a missing answer is n8n's failure, not a wait. */
export const SCREENING_ANSWER_WINDOW_MINUTES = 15;

const TRIGGERS: ReadonlySet<AuditEvent['type']> = new Set(['prescription_added', 'prescription_field_confirmed']);

export interface ScreeningStateInput {
  prescriptions: readonly Prescription[];
  alerts: readonly InteractionAlert[];
  activity: readonly AuditEvent[];
  /** kuwaitNow(), passed in by the caller (rule 9). */
  nowIso: string;
  /** lib/agent-webhooks/state.ts newPrescriptionsAwaitScreening(). */
  screeningLive: boolean;
}

/**
 * The backend's own rule for handing a prescription to screening (lib/agent-webhooks/core.ts
 * shouldScreen): `needsReview` decides, not `fieldReviewStatus`. A confident save carries
 * `fieldReviewStatus: 'pending'` beside `needsReview: false` (CR-054, the mock's oddity reproduced),
 * and it IS handed over, so it is being checked like any other.
 */
function awaitsReview(rx: Prescription): boolean {
  return rx.needsReview !== false;
}

/** The ids of the prescriptions that are being checked right now (usually none, at most the newest one or two). */
export function prescriptionsBeingChecked({ prescriptions, alerts, activity, nowIso, screeningLive }: ScreeningStateInput): Set<string> {
  const out = new Set<string>();
  if (!screeningLive) return out;
  const now = Date.parse(nowIso);
  if (Number.isNaN(now)) return out;
  const active = prescriptions.filter((p) => p.status === 'active');
  for (const rx of active) {
    if (awaitsReview(rx)) continue;
    if (!active.some((other) => other.id !== rx.id)) continue;
    let triggeredAt = Number.NEGATIVE_INFINITY;
    for (const e of activity) {
      if (e.relatedId !== rx.id || !TRIGGERS.has(e.type)) continue;
      const at = Date.parse(e.createdAt);
      if (!Number.isNaN(at) && at > triggeredAt) triggeredAt = at;
    }
    if (!Number.isFinite(triggeredAt)) continue;
    if (now - triggeredAt > SCREENING_ANSWER_WINDOW_MINUTES * 60_000) continue;
    const answered = alerts.some((a) => a.involvedPrescriptionIds.includes(rx.id) && Date.parse(a.createdAt) >= triggeredAt);
    if (!answered) out.add(rx.id);
  }
  return out;
}
