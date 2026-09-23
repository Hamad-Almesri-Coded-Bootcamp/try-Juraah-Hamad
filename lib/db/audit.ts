/**
 * The ONE application insert path into `audit_events` (SCHEMA.md §1; guard 8 greps for any other
 * `insert into audit_events` outside this file, the migrations, the seed and the integration
 * tests). Always called with the transaction handle withSession()/withAgent()/withSystem() gave
 * the caller, so the row is written under the caller's role and RLS, inside the caller's
 * transaction, and rolls back with it. Two database-side guarantees back it: the check
 * `audit_message_no_civil_id` (no twelve-digit run in any message) and `audit_dose_status_actor`
 * (dose_status_recorded only by agent/system — that row is in any case written by the trigger
 * doses_status_recorded_audit, never here).
 */
import type { AuditEvent } from '@/types/contracts';
import type { Tx } from './client';
import { newId } from './ids';

export type NewAuditEvent = Omit<AuditEvent, 'id' | 'createdAt'> & { createdAt?: string };

/** Appends one event; returns its opaque id (`ae_<ULID>`). `createdAt` defaults to jurah_now(). */
export async function append(sql: Tx, event: NewAuditEvent): Promise<string> {
  const id = newId('ae');
  await sql`
    insert into audit_events (id, scope, patient_id, actor_role, actor_id, type, message, created_at, related_id)
    values (${id}, ${event.scope}::audit_scope_t, ${event.patientId ?? null}, ${event.actor.role}::actor_role_t,
            ${event.actor.id ?? null}, ${event.type}::audit_type_t, ${event.message},
            coalesce(${event.createdAt ?? null}::timestamptz, jurah_now()), ${event.relatedId ?? null})`;
  return id;
}
