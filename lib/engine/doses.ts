/**
 * The deterministic engine's database half for doses (P2-WP4b; docs/briefs/P2-WP4b.md). Library
 * functions the other packages call INSIDE THEIR OWN TRANSACTION: each takes the `sql` handle the
 * caller got from withSession()/withAgent()/withSystem(), and never opens a transaction, sets a
 * role or touches the clock. The arithmetic is lib/schedule/** (pure, unedited); this file only
 * loads, diffs and writes.
 *
 * The rules this file keeps (CLAUDE.md rules 1, 3, 4; G1):
 *  - Nothing here writes a dose status. No statement updates `doses`; inserts omit `status` (the
 *    column default is the generator's word); the only dose objects are the generator's.
 *  - A recorded dose is never deleted: every delete is restricted to `upcoming` rows, the
 *    `doses_delete_upcoming` policy refuses a recorded row to jurah_app regardless, and
 *    `regenerateUpcoming` re-counts the recorded rows after its delete and throws (rolling the
 *    caller's transaction back) if one vanished.
 *  - Nothing here compares a dose with "now": no function takes a clock.
 *
 * Which caller runs which (D-025): generation (`insertGeneratedDoses`, `regenerateUpcoming`) runs
 * under the acting patient's or reviewer's withSession(); recompute and discontinuation run under
 * withSystem() — jurah_agent holds no DELETE on doses, so under withAgent() any cancellation fails
 * `permission denied` (tested). The caller writes the audit rows of these operations
 * (`schedule_recomputed`, `prescription_discontinued`, `prescription_added`,
 * `prescription_field_confirmed`); nothing in this file appends one.
 */
import type { Dose, Prescription } from '@/types/contracts';
import type { Tx } from '@/lib/db/withSession';
import { generateDoses } from '@/lib/schedule/generate';
import { recomputeAfterReportedMiss } from '@/lib/schedule/recompute';
import { discontinuePrescription } from '@/lib/schedule/discontinue';
import { dateOf } from '@/lib/schedule/dates';
import { ENGINE_SQL } from './sql';
import { doseInsertPayload, loadDoses } from './rows';

/** Thrown only for a broken engine invariant — a bug, never a user-reachable refusal. Rolls the caller back. */
export class EngineInvariantError extends Error {
  constructor(message: string) {
    super(`engine invariant: ${message}`);
    this.name = 'EngineInvariantError';
  }
}

function assertOnlyUpcoming(doses: readonly Dose[], where: string): void {
  for (const d of doses) {
    if (d.status !== 'upcoming') throw new EngineInvariantError(`${where} would write dose ${d.id} with a recorded status`);
  }
}

async function insertDoses(sql: Tx, doses: readonly Dose[], source: NonNullable<Dose['source']>): Promise<void> {
  if (doses.length === 0) return;
  assertOnlyUpcoming(doses, 'insert');
  const rows = await sql.unsafe(ENGINE_SQL.insertDoses, [doseInsertPayload(doses, source)]);
  if (rows.length !== doses.length) throw new EngineInvariantError(`inserted ${rows.length} of ${doses.length} doses`);
}

async function recordedIds(sql: Tx, prescriptionId: string): Promise<string[]> {
  const rows = await sql.unsafe(ENGINE_SQL.recordedIds, [prescriptionId]);
  return rows.map((r) => String(r.id));
}

/**
 * Creation time (savePrescriptionDraft, the agent's extraction write): inserts the generator's
 * doses for a prescription that has none yet. `source: 'seed'` — the generator's own value and
 * what the mock stores, so the bytes of every later read equal BACKEND-NOTES §5. `tracked` is the
 * patient's tracking state now (the caller reads settings), fixed at generation (rule 3).
 * Returns the doses inserted (empty for a flagged/unconfirmed or incomplete record, CR-002).
 */
export async function insertGeneratedDoses(sql: Tx, prescription: Prescription, tracked: boolean): Promise<Dose[]> {
  const generated = generateDoses(prescription, tracked);
  await insertDoses(sql, generated, 'seed');
  return generated;
}

export interface Regeneration {
  /** ids of the `upcoming` rows removed. */
  deletedIds: string[];
  /** the generator's doses written back (every generated id not already recorded). */
  inserted: Dose[];
  /** ids of the recorded rows, identical before and after. */
  keptRecordedIds: string[];
}

/**
 * confirmPrescriptionFields' regeneration: deletes this prescription's `upcoming` rows and inserts
 * the generator's, in the caller's transaction. A generated id that is already RECORDED is
 * skipped explicitly (never `on conflict do nothing`): the recorded row stays exactly as the agent
 * wrote it. Divergence from the mock, which drops every dose of the prescription (D-30).
 */
export async function regenerateUpcoming(sql: Tx, prescription: Prescription, tracked: boolean): Promise<Regeneration> {
  const before = await recordedIds(sql, prescription.id);
  const deleted = await sql.unsafe(ENGINE_SQL.deleteUpcoming, [prescription.id]);
  const after = await recordedIds(sql, prescription.id);
  if (after.join('|') !== before.join('|')) {
    throw new EngineInvariantError(`recorded doses of ${prescription.id} changed during regeneration (${before.length} → ${after.length})`);
  }
  const recorded = new Set(after);
  const inserted = generateDoses(prescription, tracked).filter((g) => !recorded.has(g.id));
  await insertDoses(sql, inserted, 'seed');
  return { deletedIds: deleted.map((r) => String(r.id)), inserted, keptRecordedIds: after };
}

function fingerprint(d: Dose): string {
  return JSON.stringify([d.id, d.prescriptionId, d.scheduledAt, d.status, d.tracked ?? null, d.recordedAt ?? null, d.source ?? null]);
}

export interface RecomputeResult {
  changed: boolean;
  /** ids inserted (stamped `source: 'system'`, D-28). */
  addedIds: string[];
  /** ids of `upcoming` rows deleted. */
  droppedIds: string[];
}

/**
 * After the agent has RECORDED a miss (the status write is WP7's, and must come first — a call
 * before it is a no-op): loads this prescription's doses, runs `recomputeAfterReportedMiss`, and
 * writes only the difference. Added rows are stamped `source: 'system'` (D-28), with the
 * generator's `upcoming` and the `tracked` recompute carried; dropped rows must be `upcoming` and
 * are deleted. Writes no audit row — the caller appends `schedule_recomputed` (actor system).
 */
export async function applyRecompute(sql: Tx, prescription: Prescription, missedDoseId: string): Promise<RecomputeResult> {
  const existing = await loadDoses(sql, prescription.id);
  const result = recomputeAfterReportedMiss(prescription, existing, missedDoseId);
  if (!result.changed) return { changed: false, addedIds: [], droppedIds: [] };

  const before = new Map(existing.map((d) => [d.id, d]));
  const after = new Map(result.doses.filter((d) => d.prescriptionId === prescription.id).map((d) => [d.id, d]));

  const added = [...after.values()].filter((d) => !before.has(d.id));
  const dropped = existing.filter((d) => !after.has(d.id));
  for (const [id, d] of after) {
    const old = before.get(id);
    if (old && fingerprint(old) !== fingerprint(d)) throw new EngineInvariantError(`recompute altered the stored dose ${id}`);
  }
  assertOnlyUpcoming(dropped, 'recompute delete');

  const droppedIds = dropped.map((d) => d.id);
  if (droppedIds.length > 0) {
    const gone = await sql.unsafe(ENGINE_SQL.deleteUpcomingIds, [prescription.id, droppedIds]);
    if (gone.length !== droppedIds.length) throw new EngineInvariantError(`deleted ${gone.length} of ${droppedIds.length} stale doses`);
  }
  await insertDoses(sql, added, 'system');
  return { changed: true, addedIds: added.map((d) => d.id), droppedIds };
}

export type DiscontinuationRefusal = 'invalid_date' | 'not_active' | 'not_found';

export type DiscontinuationResult =
  | { ok: true; prescription: Prescription; cancelledDoseIds: string[] }
  | { ok: false; reason: DiscontinuationRefusal };

/**
 * Discontinues an active prescription (TC-RS-03): sets `status`, `discontinued_at` (the calendar
 * date of `discontinuedAt`, the same `dateOf` value the cancel boundary uses, so the two cannot
 * disagree) and `discontinued_reason`, then deletes the `upcoming` doses dated strictly after
 * that day (D-023 — the day itself is kept). Recorded doses are never touched, however backdated.
 *
 * Never throws for a refusal (D-29): a malformed date → `invalid_date` (the pure function's
 * RangeError, caught here, before any statement runs); an already discontinued/completed record →
 * `not_active`; a row the caller cannot see or that stopped being active → `not_found`. Writes no
 * audit row — the caller appends `prescription_discontinued`.
 */
export async function applyDiscontinuation(sql: Tx, prescription: Prescription, discontinuedAt: string, reason: string): Promise<DiscontinuationResult> {
  if (prescription.status !== 'active') return { ok: false, reason: 'not_active' };

  let existing: Dose[] = [];
  let outcome: ReturnType<typeof discontinuePrescription>;
  try {
    // Validate the date BEFORE touching the database: the pure function throws on a malformed one.
    discontinuePrescription(prescription, [], discontinuedAt, reason);
    existing = await loadDoses(sql, prescription.id);
    outcome = discontinuePrescription(prescription, existing, discontinuedAt, reason);
  } catch (e) {
    if (e instanceof RangeError) return { ok: false, reason: 'invalid_date' };
    throw e;
  }

  const lastDay = dateOf(discontinuedAt);
  const updated = await sql.unsafe(ENGINE_SQL.discontinuePrescription, [prescription.id, lastDay, reason]);
  if (updated.length === 0) return { ok: false, reason: 'not_found' };

  const byId = new Map(existing.map((d) => [d.id, d]));
  assertOnlyUpcoming(outcome.cancelledDoseIds.map((id) => byId.get(id)!), 'discontinuation delete');
  if (outcome.cancelledDoseIds.length > 0) {
    const gone = await sql.unsafe(ENGINE_SQL.deleteUpcomingIds, [prescription.id, outcome.cancelledDoseIds]);
    if (gone.length !== outcome.cancelledDoseIds.length) {
      throw new EngineInvariantError(`cancelled ${gone.length} of ${outcome.cancelledDoseIds.length} doses`);
    }
  }
  // The row as a later read returns it: discontinued_at is a `date` column.
  return { ok: true, prescription: { ...outcome.prescription, discontinuedAt: lastDay }, cancelledDoseIds: outcome.cancelledDoseIds };
}
