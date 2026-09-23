/**
 * A recording stand-in for the transaction handle (P2-WP4b unit tests). It runs no SQL: every
 * statement the engine emits is recorded — by its ENGINE_SQL name when it is one of the engine's
 * statements, as 'audit_insert' for lib/db/audit.ts's tagged insert — and the test's responder
 * decides the rows it returns. The integration suite runs the same functions against Postgres.
 */
import type { Tx } from '@/lib/db/withSession';
import { ENGINE_SQL, type EngineStatement } from '@/lib/engine/sql';

export interface Recorded {
  name: EngineStatement | 'audit_insert' | 'unknown';
  text: string;
  params: unknown[];
}

export type Responder = (name: Recorded['name'], params: unknown[]) => Record<string, unknown>[];

const byText = new Map<string, EngineStatement>(Object.entries(ENGINE_SQL).map(([k, v]) => [v, k as EngineStatement]));

function result(rows: Record<string, unknown>[]): Record<string, unknown>[] & { count: number } {
  return Object.assign([...rows], { count: rows.length });
}

export function fakeTx(respond: Responder = () => []): { sql: Tx; log: Recorded[] } {
  const log: Recorded[] = [];
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('$?');
    const name: Recorded['name'] = /insert\s+into\s+audit_events/i.test(text) ? 'audit_insert' : 'unknown';
    log.push({ name, text, params: values });
    return Promise.resolve(result(respond(name, values)));
  };
  const unsafe = (text: string, params: unknown[] = []) => {
    const name: Recorded['name'] = byText.get(text) ?? 'unknown';
    log.push({ name, text, params });
    return Promise.resolve(result(respond(name, params)));
  };
  return { sql: Object.assign(tag, { unsafe }) as unknown as Tx, log };
}

/** A contract Dose as the ENGINE_SQL.loadDoses projection returns it. */
export function doseRow(d: { id: string; prescriptionId: string; scheduledAt: string; status: string; tracked?: boolean; recordedAt?: string; source?: string }) {
  return {
    id: d.id, prescription_id: d.prescriptionId, scheduled_at: d.scheduledAt, status: d.status,
    tracked: d.tracked ?? true, recorded_at: d.recordedAt ?? null, source: d.source ?? null,
  };
}
