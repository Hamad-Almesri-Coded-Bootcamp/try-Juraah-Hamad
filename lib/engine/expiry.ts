/**
 * The invitation-expiry job's database half (P2-WP4b; API-SURFACE §B `/api/jobs/expire-invitations`,
 * E-20, E-03). Called by the job route inside withSystem() — the caregiver_transitions trigger
 * admits `pending → expired` for the system actor alone, and job_runs admits only the system actor.
 *
 *  1. Reads every stored-`pending` row (id, linked patient, status, expiresAt — never a Civil ID).
 *  2. Selects with `invitationsToExpire(rows, nowIso)` (lib/schedule/expiry.ts, instant comparison).
 *  3. Sets the transaction's clock to `nowIso` (`jurah.now`, transaction-local): `nowIso` IS the
 *     clock (D-021), and the trigger and every column default read jurah_now(), so the database
 *     and the selection must agree. In production the seam passes REFERENCE_NOW, which is already
 *     the value withSystem() set, so this changes nothing; a test that advances the clock passes a
 *     later value and the whole transaction sees it.
 *  4. Updates the selected rows to `expired` with the trigger's own condition in the WHERE clause,
 *     appends one `caregiver_invite_expired` per row flipped (actor system, the seed's message,
 *     relatedId = the invitation; createdAt = jurah_now(), the moment the job ran), and writes one
 *     job_runs row — also when nothing expired, so "the job ran" is provable.
 *
 * TOUCHES NO `doses` ROW (rule 4, E-03): there is no "overdue → missed" job anywhere.
 * A malformed `nowIso` is refused before any statement runs, never thrown (D-29).
 */
import type { Caregiver } from '@/types/contracts';
import type { Tx } from '@/lib/db/withSession';
import { append } from '@/lib/db/audit';
import { invitationsToExpire } from '@/lib/schedule/expiry';
import { ENGINE_SQL } from './sql';

export const INVITE_EXPIRED_MESSAGE = 'انتهت صلاحية دعوة مقدّم رعاية';

export type ExpiryResult = { ok: true; expiredIds: string[] } | { ok: false; reason: 'invalid_now' };

/** What the selection reads. The rest of `Caregiver` (civilId, name …) is never selected. */
type PendingRow = Pick<Caregiver, 'id' | 'linkedPatientId' | 'status' | 'expiresAt'>;

export async function expireInvitations(sql: Tx, nowIso: string): Promise<ExpiryResult> {
  if (Number.isNaN(Date.parse(nowIso))) return { ok: false, reason: 'invalid_now' };

  const rows = await sql.unsafe(ENGINE_SQL.pendingInvitations, []);
  const pending: PendingRow[] = rows.map((r) => ({
    id: String(r.id),
    linkedPatientId: String(r.linked_patient_id),
    status: String(r.status) as Caregiver['status'],
    expiresAt: String(r.expires_at),
  }));
  let selected: PendingRow[];
  try {
    // invitationsToExpire reads only `status` and `expiresAt` (lib/schedule/expiry.ts).
    selected = invitationsToExpire(pending as unknown as Caregiver[], nowIso);
  } catch (e) {
    if (e instanceof RangeError) return { ok: false, reason: 'invalid_now' };
    throw e;
  }

  await sql.unsafe(ENGINE_SQL.setClock, [nowIso]);
  const flipped = selected.length === 0 ? [] : await sql.unsafe(ENGINE_SQL.expireInvitations, [selected.map((c) => c.id)]);
  const flippedById = new Map(flipped.map((r) => [String(r.id), String(r.linked_patient_id)]));

  const expiredIds: string[] = [];
  for (const c of selected) {
    const patientId = flippedById.get(c.id);
    if (patientId === undefined) continue;
    await append(sql, {
      scope: 'patient', patientId, actor: { role: 'system' }, type: 'caregiver_invite_expired',
      message: INVITE_EXPIRED_MESSAGE, relatedId: c.id,
    });
    expiredIds.push(c.id);
  }
  await sql.unsafe(ENGINE_SQL.recordJobRun, [expiredIds.length]);
  return { ok: true, expiredIds };
}
