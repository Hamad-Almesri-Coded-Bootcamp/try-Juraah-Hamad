/**
 * The deterministic engine's database half (P2-WP4b). Library functions only — no seam function,
 * no route: lib/data/pg/** (WP3/WP5) and app/api/** (WP6/WP7) call these inside their own
 * transaction. See docs/backend-notes/p2-wp4b.md.
 */
export {
  insertGeneratedDoses, regenerateUpcoming, applyRecompute, applyDiscontinuation, EngineInvariantError,
  type Regeneration, type RecomputeResult, type DiscontinuationResult, type DiscontinuationRefusal,
} from './doses';
export { depletionFor, type Depletion } from './depletion';
export { expireInvitations, INVITE_EXPIRED_MESSAGE, type ExpiryResult } from './expiry';
export { prescriptionFromRow, doseFromRow, loadPrescription, loadDoses, type DbRow } from './rows';
export { ENGINE_SQL, PRESCRIPTION_COLUMNS, DOSE_COLUMNS } from './sql';
