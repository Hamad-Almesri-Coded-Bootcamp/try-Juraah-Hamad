/**
 * P2-WP4b · Gate 4 — discontinuation against Postgres (D-023), as the route runs it: withSystem().
 */
import { describe, expect, it } from 'vitest';
import { applyDiscontinuation } from '@/lib/engine/doses';
import { OWNER_NO_SESSION, S, app, probe } from '../helpers';
import { SYSTEM_APP, count, dayRows, rxOf } from './_engine';

const RECORDED = `select string_agg(concat_ws('|', id, status, iso_kw(recorded_at), source), ',' order by id) as r from doses where status <> 'upcoming'`;

describe('applyDiscontinuation — rx-003 at 2026-09-21', () => {
  it('doses after the 21st gone, the 21st kept, recorded rows untouched, the prescription row discontinued', async () => {
    const r = await probe(SYSTEM_APP, async (tx) => {
      await tx`reset role`;
      const [rec0] = await tx.unsafe(RECORDED);
      const after21Before = await count(tx, `select 1 from doses where prescription_id = 'rx-003' and (scheduled_at at time zone 'Asia/Kuwait')::date > '2026-09-21'`);
      await tx`set local role jurah_app`;
      const out = await applyDiscontinuation(tx, await rxOf(tx, 'rx-003'), '2026-09-21', 'الطبيب أوقف الدواء');
      await tx`reset role`;
      const [rec1] = await tx.unsafe(RECORDED);
      const [rx] = await tx.unsafe(`select status::text || '|' || to_char(discontinued_at, 'YYYY-MM-DD') || '|' || discontinued_reason as r from prescriptions where id = 'rx-003'`);
      return {
        ok: out.ok, cancelled: out.ok ? out.cancelledDoseIds.length : -1, after21Before,
        after21: await count(tx, `select 1 from doses where prescription_id = 'rx-003' and (scheduled_at at time zone 'Asia/Kuwait')::date > '2026-09-21'`),
        d21: (await dayRows(tx, 'pt-01', '2026-09-21')).filter((x) => x.includes('rx-003')),
        recordedSame: rec0!.r === rec1!.r, rx: rx!.r,
        engineAudit: await count(tx, `select 1 from audit_events where type = 'prescription_discontinued'`),
      };
    });
    expect(r.ok).toBe(true);
    expect(r.after21Before).toBe(162); // 2026-09-22 … 2026-12-11, two a day
    expect(r.cancelled).toBe(162);
    expect(r.after21).toBe(0);
    expect(r.d21).toEqual(['08:00 rx-003 upcoming false', '20:00 rx-003 upcoming false']);
    expect(r.recordedSame).toBe(true);
    expect(r.rx).toBe('discontinued|2026-09-21|الطبيب أوقف الدواء');
    expect(r.engineAudit).toBe(0); // the caller appends prescription_discontinued
  });

  it("backdated on سارة's rx-008 to 2026-09-19: her recorded 20th and 21st survive", async () => {
    const r = await probe(SYSTEM_APP, async (tx) => {
      const out = await applyDiscontinuation(tx, await rxOf(tx, 'rx-008'), '2026-09-19', 'x');
      await tx`reset role`;
      return { ok: out.ok, left: (await tx.unsafe(`select id || '|' || status as r from doses where prescription_id = 'rx-008' and (scheduled_at at time zone 'Asia/Kuwait')::date >= '2026-09-19' order by id`)).map((x) => String(x.r)) };
    });
    expect(r).toEqual({ ok: true, left: ['rx-008-20260919-0700|missed', 'rx-008-20260920-0700|taken_on_time', 'rx-008-20260921-0700|taken_on_time'] });
  });

  it('refusals come back as values, never thrown: invalid_date, not_active (rx-004), not_found (a patient session — the trigger path is closed to it)', async () => {
    const rx3 = await probe(OWNER_NO_SESSION, (tx) => rxOf(tx, 'rx-003'));
    const rx4 = await probe(OWNER_NO_SESSION, (tx) => rxOf(tx, 'rx-004'));
    expect(await probe(SYSTEM_APP, (tx) => applyDiscontinuation(tx, rx3, 'not a date', 'x'))).toEqual({ ok: false, reason: 'invalid_date' });
    expect(await probe(SYSTEM_APP, (tx) => applyDiscontinuation(tx, rx4, '2026-09-21', 'x'))).toEqual({ ok: false, reason: 'not_active' });
    // حمد's own session: the prescriptions_update policy admits reviewer/system only → 0 rows → not_found, no dose deleted.
    const own = await probe(app(S.hamad), async (tx) => ({ out: await applyDiscontinuation(tx, rx3, '2026-09-21', 'x'), n: await count(tx, `select 1 from doses where prescription_id = 'rx-003'`) }));
    expect(own).toEqual({ out: { ok: false, reason: 'not_found' }, n: 360 });
  });
});
