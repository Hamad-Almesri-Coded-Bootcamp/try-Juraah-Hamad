/**
 * Probe helpers for the schema suite. Every probe runs in its OWN transaction on the owner
 * connection and is ALWAYS rolled back, so the seeded state is never changed by a test:
 *   - `rejects(as, sql, name)`  — the statement must fail, and the error must name `name`
 *     (a constraint name, a trigger's '<name>: …' prefix, or 'permission denied');
 *   - `accepts(as, sql, check)` — the statement must succeed; returns `check`'s first value,
 *     read in the same transaction before the rollback.
 * `as` is who runs it: the owner with a session GUC (constraints bind the owner; RLS does not),
 * or an application role with a forged, verified-shape session — exactly what withSession() sets.
 */
import { REFERENCE_NOW } from '@/lib/config';
import { getSql, type Tx } from '@/lib/db/client';

export type As =
  | { role: 'owner'; session?: Record<string, unknown> | null }
  | { role: 'jurah_app' | 'jurah_agent'; session: Record<string, unknown> | null };

const ROLLBACK = new Error('__rollback__');

export const SYSTEM: As = { role: 'owner', session: { role: 'system' } };
export const OWNER_NO_SESSION: As = { role: 'owner', session: null };
export const AGENT: As = { role: 'jurah_agent', session: { role: 'agent' } };
export const app = (session: Record<string, unknown>): As => ({ role: 'jurah_app', session });

/** The seeded sessions, civilId resolved as withSession() would (civil_id_for_session). */
export const S = {
  hamad: { subjectId: 'pt-01', role: 'patient', civilId: '255031200187' },
  fatima: { subjectId: 'pt-02', role: 'patient', civilId: '258071100342' },
  sara: { subjectId: 'pt-03', role: 'patient', civilId: '290022500654' },
  badr: { subjectId: 'pt-04', role: 'patient', civilId: '268110500413' },
  abdullah: { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01', civilId: '285061400412' },
  naserPending: { subjectId: 'cg-03', pendingInvitationOnly: true, civilId: '288110300229' },
  naserForgedCaregiver: { subjectId: 'cg-03', role: 'caregiver', linkedPatientId: 'pt-01', civilId: '288110300229' },
  khalidReviewer: { subjectId: 'acc-10', role: 'reviewer', civilId: '280012000961' },
  dana: { subjectId: 'acc-11', role: 'admin', civilId: '293080700148' },
} as const;

async function enter(tx: Tx, as: As): Promise<void> {
  await tx`select set_config('jurah.session', ${as.session ? JSON.stringify(as.session) : ''}, true),
                  set_config('jurah.now', ${REFERENCE_NOW}, true)`;
  if (as.role === 'jurah_app') await tx`set local role jurah_app`;
  if (as.role === 'jurah_agent') await tx`set local role jurah_agent`;
}

/** Runs fn in a transaction that is always rolled back; returns fn's value. */
export async function probe<T>(as: As, fn: (tx: Tx) => Promise<T>): Promise<T> {
  let out: T | undefined;
  try {
    await getSql().begin(async (tx) => {
      await enter(tx, as);
      out = await fn(tx);
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
  return out as T;
}

export interface PgError { message: string; constraint_name?: string; code?: string }

/** The statement must be refused, and the refusal must carry `name`. Returns the error. */
export async function rejects(as: As, statement: string, name: string): Promise<PgError> {
  let err: PgError | null = null;
  try {
    await probe(as, async (tx) => { await tx.unsafe(statement); });
  } catch (e) {
    err = e as PgError;
  }
  if (!err) throw new Error(`expected a refusal naming "${name}", but the statement was ACCEPTED:\n${statement}`);
  const text = `${err.constraint_name ?? ''} ${err.message}`;
  if (!text.includes(name)) throw new Error(`refused, but not by "${name}": ${text}`);
  return err;
}

/** The statement must succeed; returns the first column of `check`'s first row (same tx). */
export async function accepts(as: As, statement: string, check?: string): Promise<{ count: number; value: unknown }> {
  return probe(as, async (tx) => {
    const res = await tx.unsafe(statement);
    let value: unknown;
    if (check) {
      await tx`reset role`;
      const [row] = await tx.unsafe(check);
      value = row ? Object.values(row)[0] : undefined;
    }
    return { count: res.count, value };
  });
}
