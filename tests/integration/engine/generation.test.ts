/**
 * P2-WP4b · Gate 4 — generation against Postgres, at the frozen clock. Each test wipes the
 * doses of the prescriptions under test inside a rolled-back transaction (as the owner — the seed
 * wrote them), re-generates them through insertGeneratedDoses as withSystem() would, and reads
 * the seed's hand-computed tables back from the database.
 */
import { describe, expect, it } from 'vitest';
import { insertGeneratedDoses, regenerateUpcoming } from '@/lib/engine/doses';
import { OWNER_NO_SESSION, S, app, probe } from '../helpers';
import { SYSTEM_APP, count, dayRows, digest, rxOf } from './_engine';

const TRACKING: Record<string, boolean> = { 'pt-01': false, 'pt-02': false, 'pt-03': true };

async function regenerateFromScratch(tx: Parameters<Parameters<typeof probe>[1]>[0], ids: string[]) {
  await tx`reset role`;
  await tx.unsafe(`delete from doses where prescription_id in (select jsonb_array_elements_text($1::jsonb))`, [ids]);
  await tx`set local role jurah_app`;
  for (const id of ids) {
    const rx = await rxOf(tx, id);
    await insertGeneratedDoses(tx, rx, TRACKING[rx.patientId]!);
  }
}

describe('insertGeneratedDoses — the seed tables, from the database', () => {
  it('re-generating حمد and فاطمة (rx-001…rx-007) reproduces the seeded doses table byte for byte', async () => {
    const r = await probe(SYSTEM_APP, async (tx) => {
      const before = await digest(tx);
      await tx`set local role jurah_app`;
      await regenerateFromScratch(tx, ['rx-001', 'rx-002', 'rx-003', 'rx-004', 'rx-005', 'rx-006', 'rx-007']);
      return { before, after: await digest(tx) };
    });
    expect(r.after).toEqual(r.before);
  });

  it('حمد: six rows on 2026-09-21, three on 2026-09-26, all upcoming and tracked:false', async () => {
    const r = await probe(SYSTEM_APP, async (tx) => {
      await regenerateFromScratch(tx, ['rx-001', 'rx-002', 'rx-003', 'rx-004']);
      await tx`reset role`;
      return { d21: await dayRows(tx, 'pt-01', '2026-09-21'), d26: await dayRows(tx, 'pt-01', '2026-09-26') };
    });
    expect(r.d21).toEqual(['08:00 rx-002 upcoming false', '08:00 rx-003 upcoming false', '14:00 rx-002 upcoming false', '18:00 rx-001 upcoming false', '20:00 rx-002 upcoming false', '20:00 rx-003 upcoming false']);
    expect(r.d26).toEqual(['08:00 rx-003 upcoming false', '18:00 rx-001 upcoming false', '20:00 rx-003 upcoming false']);
  });

  it('فاطمة: rx-005 on the 20th and the 22nd, not the 21st; rx-006 and rx-007 generate zero rows', async () => {
    const r = await probe(SYSTEM_APP, async (tx) => {
      await regenerateFromScratch(tx, ['rx-005', 'rx-006', 'rx-007']);
      await tx`reset role`;
      return {
        d20: await dayRows(tx, 'pt-02', '2026-09-20'), d21: await dayRows(tx, 'pt-02', '2026-09-21'), d22: await dayRows(tx, 'pt-02', '2026-09-22'),
        flagged: await count(tx, `select 1 from doses where prescription_id in ('rx-006', 'rx-007')`),
      };
    });
    expect(r).toEqual({ d20: ['09:00 rx-005 upcoming false'], d21: [], d22: ['09:00 rx-005 upcoming false'], flagged: 0 });
  });
});

describe("سارة's seven rows — exact statuses, and regeneration cannot touch them", () => {
  const SEVEN = [
    'rx-008-20260919-0700|missed|true|2026-09-19T07:55:00+03:00|adherence_agent',
    'rx-008-20260920-0700|taken_on_time|true|2026-09-20T07:05:00+03:00|adherence_agent',
    'rx-009-20260920-1300|taken_on_time|true|2026-09-20T13:20:00+03:00|adherence_agent',
    'rx-009-20260920-2100|taken_late|true|2026-09-20T22:40:00+03:00|adherence_agent',
    'rx-008-20260921-0700|taken_on_time|true|2026-09-21T07:12:00+03:00|adherence_agent',
    'rx-009-20260921-1300|upcoming|true||seed',
    'rx-009-20260921-2100|upcoming|true||seed',
  ];
  const read = `select id || '|' || status || '|' || tracked || '|' || coalesce(iso_kw(recorded_at), '') || '|' || coalesce(source::text, '') as r
                from doses where id in (select jsonb_array_elements_text($1::jsonb))`;
  const ids = SEVEN.map((s) => s.split('|')[0]!);
  const sevenOf = async (tx: Parameters<Parameters<typeof probe>[1]>[0]) => {
    await tx`reset role`;
    const rows = await tx.unsafe(read, [ids]);
    const byId = new Map(rows.map((r) => [String(r.r).split('|')[0], String(r.r)]));
    return ids.map((id) => byId.get(id));
  };

  it('the seeded rows, and the two CR-051 rows on 2026-09-19 still upcoming', async () => {
    const r = await probe(SYSTEM_APP, async (tx) => ({
      seven: await sevenOf(tx),
      cr051: (await tx.unsafe(`select id || '|' || status || '|' || tracked as r from doses where id in ('rx-009-20260919-1300', 'rx-009-20260919-2100') order by id`)).map((x) => String(x.r)),
    }));
    expect(r.seven).toEqual(SEVEN);
    expect(r.cr051).toEqual(['rx-009-20260919-1300|upcoming|true', 'rx-009-20260919-2100|upcoming|true']);
  });

  it("سارة's own session regenerating rx-008 and rx-009 keeps all seven byte-identical and every recorded row", async () => {
    const r = await probe(app(S.sara), async (tx) => {
      const out8 = await regenerateUpcoming(tx, await rxOf(tx, 'rx-008'), true);
      const out9 = await regenerateUpcoming(tx, await rxOf(tx, 'rx-009'), true);
      const seven = await sevenOf(tx);
      return { kept: [...out8.keptRecordedIds, ...out9.keptRecordedIds], seven, recorded: await count(tx, `select 1 from doses where status <> 'upcoming'`) };
    });
    expect(r.seven).toEqual(SEVEN);
    expect(r.kept).toEqual(['rx-008-20260919-0700', 'rx-008-20260920-0700', 'rx-008-20260921-0700', 'rx-009-20260920-1300', 'rx-009-20260920-2100']);
    expect(r.recorded).toBe(5);
  });
});

describe('the DELETE policy, not the engine\'s WHERE clause, is what protects a recorded dose', () => {
  it("a patient session's bare `delete … where prescription_id = 'rx-008'` removes only the upcoming rows", async () => {
    const r = await probe(app(S.sara), async (tx) => {
      const del = await tx.unsafe(`delete from doses where prescription_id = 'rx-008'`);
      await tx`reset role`;
      return { deleted: del.count, recordedLeft: await count(tx, `select 1 from doses where prescription_id = 'rx-008' and status <> 'upcoming'`), left: await count(tx, `select 1 from doses where prescription_id = 'rx-008'`) };
    });
    expect(r.recordedLeft).toBe(3);
    expect(r.left).toBe(3);
    expect(r.deleted).toBe(177);
  });

  it("a forged patient session for حمد against سارة's rx-008: deletes nothing, and the insert is refused by RLS", async () => {
    const rx8 = await probe(OWNER_NO_SESSION, (tx) => rxOf(tx, 'rx-008'));
    await expect(probe(app(S.hamad), (tx) => regenerateUpcoming(tx, rx8, true))).rejects.toThrow(/row-level security/);
    const del = await probe(app(S.hamad), async (tx) => (await tx.unsafe(`delete from doses where prescription_id = 'rx-008'`)).count);
    expect(del).toBe(0);
  });

  it('under withAgent (jurah_agent) the engine cannot delete a dose at all — D-025 made observable', async () => {
    const rx8 = await probe(OWNER_NO_SESSION, (tx) => rxOf(tx, 'rx-008'));
    await expect(probe({ role: 'jurah_agent', session: { role: 'agent' } }, (tx) => regenerateUpcoming(tx, rx8, true))).rejects.toThrow(/permission denied for table doses/);
  });
});
