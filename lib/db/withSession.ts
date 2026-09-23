/**
 * The ONLY way product code runs SQL (D-017, BACKEND-PLAN risk 3; guard 8 proves no other file
 * does). Every call is one transaction that:
 *   1. as the connection's owner role, resolves the caller's own Civil ID through
 *      `civil_id_for_session(...)` — the one SECURITY DEFINER function withSession() calls; its
 *      EXECUTE is revoked from both application roles, so no seam query can resolve anyone's;
 *   2. `set local role jurah_app` (or `jurah_agent`) — bound by RLS, no BYPASSRLS;
 *   3. `set_config('jurah.session', {subjectId, role, linkedPatientId, pendingInvitationOnly,
 *      civilId}, true)` and `set_config('jurah.now', REFERENCE_NOW, true)` — both transaction-
 *      local, so a pooled connection can never carry one caller's session into another's query;
 *   4. runs `fn`, then commits — or rolls back if `fn` throws (a guard trigger's raise included).
 * A null session sets an EMPTY `jurah.session`: `jurah_session()` is then NULL and every policy
 * returns zero rows.
 */
import { REFERENCE_NOW } from '@/lib/config';
import type { Session } from '@/types/views';
import { getSql, type Tx } from './client';

export type { Tx } from './client';

type AppRole = 'jurah_app' | 'jurah_agent';

async function run<T>(role: AppRole, resolve: (tx: Tx) => Promise<Record<string, unknown> | null>, fn: (sql: Tx) => Promise<T>): Promise<T> {
  const sql = getSql();
  const result = await sql.begin(async (tx) => {
    const payload = await resolve(tx);
    if (role === 'jurah_app') await tx`set local role jurah_app`;
    else await tx`set local role jurah_agent`;
    await tx`select set_config('jurah.session', ${payload ? JSON.stringify(payload) : ''}, true),
                    set_config('jurah.now', ${REFERENCE_NOW}, true)`;
    return fn(tx);
  });
  return result as T;
}

/** A seam call under the verified session (or none). */
export function withSession<T>(session: Session | null, fn: (sql: Tx) => Promise<T>): Promise<T> {
  return run('jurah_app', async (tx) => {
    if (!session) return null;
    const rows = await tx`select civil_id_for_session(${session.subjectId}, ${session.role ?? null}::role_t, ${!!session.pendingInvitationOnly}) as civil_id`;
    const civilId = (rows[0]?.civil_id as string | null | undefined) ?? null;
    return {
      subjectId: session.subjectId,
      role: session.role,
      linkedPatientId: session.linkedPatientId,
      pendingInvitationOnly: session.pendingInvitationOnly,
      civilId,
    };
  }, fn);
}

/** The agent integration point (app/api/agent/**, WP7): role jurah_agent, actor 'agent'. */
export function withAgent<T>(fn: (sql: Tx) => Promise<T>): Promise<T> {
  return run('jurah_agent', async () => ({ role: 'agent' }), fn);
}

/** The webhook / job / ICS paths (WP5, WP6): role jurah_app, actor 'system'. */
export function withSystem<T>(fn: (sql: Tx) => Promise<T>): Promise<T> {
  return run('jurah_app', async () => ({ role: 'system' }), fn);
}
