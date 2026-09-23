/**
 * Shared bits of the P2-WP4b integration suite. Every probe runs in a transaction that is ALWAYS
 * rolled back (../helpers.ts `probe`), so the seeded state never changes between tests; the
 * harness re-seeds per file regardless (../setup.ts).
 */
import type { Tx } from '@/lib/db/client';
import type { Prescription } from '@/types/contracts';
import { loadPrescription } from '@/lib/engine/rows';
import { app, type As } from '../helpers';

/** withSystem() exactly: role jurah_app, actor system (D-025 — the recompute/discontinue/expiry paths). */
export const SYSTEM_APP: As = app({ role: 'system' });

/** One md5 over every column of every dose row — "byte-identical before/after". */
export const DOSES_DIGEST = `
  select count(*)::int as n,
         md5(string_agg(concat_ws('|', id, prescription_id, iso_kw(scheduled_at), status, tracked, iso_kw(recorded_at), source), ',' order by id)) as md5
  from doses`;

export async function digest(tx: Tx): Promise<{ n: number; md5: string }> {
  await tx`reset role`;
  const [r] = await tx.unsafe(DOSES_DIGEST);
  return { n: Number(r!.n), md5: String(r!.md5) };
}

export async function rxOf(tx: Tx, id: string): Promise<Prescription> {
  const p = await loadPrescription(tx, id);
  if (!p) throw new Error(`${id} not visible`);
  return p;
}

/** A day's rows as `HH:mm rx-id status tracked` in (scheduled_at, id) order, read as the owner. */
export async function dayRows(tx: Tx, patientId: string, isoDate: string): Promise<string[]> {
  const rows = await tx.unsafe(
    `select to_char(d.scheduled_at at time zone 'Asia/Kuwait', 'HH24:MI') || ' ' || d.prescription_id || ' ' || d.status || ' ' || d.tracked as r
     from doses d join prescriptions p on p.id = d.prescription_id
     where p.patient_id = $1 and (d.scheduled_at at time zone 'Asia/Kuwait')::date = $2::date
     order by d.scheduled_at, d.id`, [patientId, isoDate]);
  return rows.map((r) => String(r.r));
}

export async function count(tx: Tx, q: string, params: unknown[] = []): Promise<number> {
  const [r] = await tx.unsafe(`select count(*)::int as n from (${q}) x`, params as never[]);
  return Number(r!.n);
}
