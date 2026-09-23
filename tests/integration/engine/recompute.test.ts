/**
 * P2-WP4b · Gate 4 — recompute after سارة's reported miss (rx-008-20260919-0700), against Postgres,
 * as the recompute route runs it: withSystem() (D-025). The caller — not the engine — appends
 * schedule_recomputed; the engine must write nothing at all when nothing changed.
 */
import { describe, expect, it } from 'vitest';
import { append } from '@/lib/db/audit';
import { applyRecompute } from '@/lib/engine/doses';
import { probe } from '../helpers';
import { SYSTEM_APP, count, digest, rxOf } from './_engine';

const TIMES = `select string_agg(iso_kw(scheduled_at), ',' order by scheduled_at) as t from doses where prescription_id = 'rx-008'`;

describe('applyRecompute — rx-008 after the 2026-09-19 miss', () => {
  it('changed:false, every scheduled time identical, the doses table byte-identical, and the engine wrote no audit row', async () => {
    const r = await probe(SYSTEM_APP, async (tx) => {
      const before = await digest(tx);
      const [t0] = await tx.unsafe(TIMES);
      const audit0 = await count(tx, 'select 1 from audit_events');
      await tx`set local role jurah_app`;
      const out = await applyRecompute(tx, await rxOf(tx, 'rx-008'), 'rx-008-20260919-0700');
      const engineAudit = await count(tx, 'select 1 from audit_events') - audit0;
      // The CALLER's row (the route, WP7) — written here to show the one row lands with actor system.
      await append(tx, { scope: 'patient', patientId: 'pt-03', actor: { role: 'system' }, type: 'schedule_recomputed', message: 'إعادة حساب جدول Levothyroxine بعد جرعة فائتة', relatedId: 'rx-008' });
      const callerAudit = (await tx.unsafe(`select actor_role::text || '|' || type::text || '|' || related_id as r from audit_events where type = 'schedule_recomputed' order by seq`)).map((x) => String(x.r));
      const [t1] = await tx.unsafe(TIMES);
      return { out, engineAudit, callerAudit, sameTimes: t0!.t === t1!.t, n180: String(t1!.t).split(',').length, before, after: await digest(tx) };
    });
    expect(r.out).toEqual({ changed: false, addedIds: [], droppedIds: [] });
    expect(r.engineAudit).toBe(0);
    expect(r.callerAudit).toEqual(['system|schedule_recomputed|rx-008', 'system|schedule_recomputed|rx-008']); // the seed's row + the caller's
    expect(r.sameTimes).toBe(true);
    expect(r.n180).toBe(180);
    expect(r.after).toEqual(r.before);
  });

  it('a generated dose missing from the store comes back stamped source system (D-28), upcoming, tracked', async () => {
    const r = await probe(SYSTEM_APP, async (tx) => {
      await tx`reset role`;
      await tx`delete from doses where id = 'rx-008-20260925-0700'`;
      await tx`set local role jurah_app`;
      const out = await applyRecompute(tx, await rxOf(tx, 'rx-008'), 'rx-008-20260919-0700');
      const [row] = await tx.unsafe(`select status::text || '|' || tracked || '|' || source::text as r from doses where id = 'rx-008-20260925-0700'`);
      return { out, row: row?.r };
    });
    expect(r.out).toEqual({ changed: true, addedIds: ['rx-008-20260925-0700'], droppedIds: [] });
    expect(r.row).toBe('upcoming|true|system');
  });
});
