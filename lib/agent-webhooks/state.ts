/**
 * AP-10 / CR-089 — the one thing a SCREEN may learn about screening: whether a prescription saved
 * now is handed to the Interaction Screening agent at all. B2 and B3 show a new prescription as
 * "being checked" only when it is (features/prescription/screening-state.ts derives the state from
 * the prescription, its alerts and its audit rows; this flag says whether anything is checking).
 *
 *   - Postgres: only with the screening webhook configured (lib/data/pg/screening.ts then hands every
 *     unflagged save, reviewer confirmation, agent save and refill to it, or holds it). Production
 *     today has no JURAH_AGENT_SCREENING_URL, so it answers false and no screen claims a check that
 *     nobody runs.
 *   - The mock backend (tests, local runs): true. It stands for a configured backend whose screening
 *     has not answered yet; it never answers, so its new prescriptions stay "being checked". This is
 *     how the e2e suite and the screenshots see the state without a database.
 *
 * No URL, secret or identifier leaves this module: a boolean only.
 */
import { selectedBackend } from '@/lib/db/client';
import { screeningConfigured } from './index';

export function newPrescriptionsAwaitScreening(): boolean {
  return selectedBackend() === 'mock' || screeningConfigured();
}
