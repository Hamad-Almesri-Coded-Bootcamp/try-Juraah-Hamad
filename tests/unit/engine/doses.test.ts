/**
 * P2-WP4b — the engine's write logic against the seed at the frozen clock, with a recording fake
 * transaction (./fakeTx.ts): what each function reads, what it writes, and above all what it never
 * writes. The same functions run against Postgres in tests/integration/engine/*.test.ts.
 */
import { describe, expect, it } from 'vitest';
import type { Dose, Prescription } from '@/types/contracts';
import { buildDoses, buildPrescriptions, buildSettings } from '@/lib/data/mock/seed';
import { generateDoses } from '@/lib/schedule/generate';
import { dosesOnDate } from '@/lib/schedule/group';
import { applyDiscontinuation, applyRecompute, insertGeneratedDoses, regenerateUpcoming, EngineInvariantError } from '@/lib/engine/doses';
import { doseRow, fakeTx, type Recorded } from './fakeTx';

const prescriptions = buildPrescriptions();
const settings = buildSettings();
const seedDoses = buildDoses(prescriptions, new Map(settings.map((s) => [s.patientId, s])));
const rx = (id: string): Prescription => structuredClone(prescriptions.find((p) => p.id === id)!);
const dosesOf = (id: string): Dose[] => seedDoses.filter((d) => d.prescriptionId === id);
const trackingOn = (patientId: string) => settings.find((s) => s.patientId === patientId)?.adherenceCheckInEnabled ?? false;

/** Every statement name that writes. None of them may be an update of doses — no such statement exists. */
const WRITES = new Set(['insertDoses', 'deleteUpcoming', 'deleteUpcomingIds', 'discontinuePrescription', 'expireInvitations', 'recordJobRun', 'audit_insert', 'setClock']);
const writes = (log: Recorded[]) => log.filter((r) => WRITES.has(r.name));
const inserted = (log: Recorded[]) =>
  log.filter((r) => r.name === 'insertDoses').flatMap((r) => r.params[0] as Record<string, unknown>[]);
const noStatusWrite = (log: Recorded[]) => {
  for (const r of log) {
    expect(r.name).not.toBe('unknown');
    expect(r.text).not.toMatch(/update\s+doses/i);
  }
  for (const row of inserted(log)) expect(Object.keys(row)).toEqual(['id', 'prescription_id', 'scheduled_at', 'tracked', 'source']);
};

/** A responder over an in-memory copy of one prescription's doses, applying the engine's own statements. */
function doseTable(initial: Dose[]) {
  let rows = initial.map((d) => ({ ...d }));
  return {
    rows: () => rows,
    respond: (name: Recorded['name'], params: unknown[]) => {
      if (name === 'loadDoses') return rows.filter((d) => d.prescriptionId === params[0]).map(doseRow);
      if (name === 'recordedIds') return rows.filter((d) => d.prescriptionId === params[0] && d.status !== 'upcoming').map((d) => ({ id: d.id })).sort((a, b) => a.id.localeCompare(b.id));
      if (name === 'deleteUpcoming') {
        const gone = rows.filter((d) => d.prescriptionId === params[0] && d.status === 'upcoming');
        rows = rows.filter((d) => !gone.includes(d));
        return gone.map((d) => ({ id: d.id }));
      }
      if (name === 'deleteUpcomingIds') {
        const ids = new Set(params[1] as string[]);
        const gone = rows.filter((d) => d.prescriptionId === params[0] && d.status === 'upcoming' && ids.has(d.id));
        rows = rows.filter((d) => !gone.includes(d));
        return gone.map((d) => ({ id: d.id }));
      }
      if (name === 'insertDoses') {
        const add = params[0] as { id: string; prescription_id: string; scheduled_at: string; tracked: boolean; source: Dose['source'] }[];
        for (const a of add) {
          if (rows.some((d) => d.id === a.id)) throw new Error(`duplicate key doses_pkey ${a.id}`);
          rows.push({ id: a.id, prescriptionId: a.prescription_id, scheduledAt: a.scheduled_at, status: 'upcoming', tracked: a.tracked, source: a.source });
        }
        return add.map((a) => ({ id: a.id }));
      }
      if (name === 'discontinuePrescription') return [{ id: params[0] }];
      return [];
    },
  };
}

describe('insertGeneratedDoses — creation time, the seed tables at the frozen clock', () => {
  const generateAll = async () => {
    const t = doseTable([]);
    const { sql, log } = fakeTx(t.respond);
    for (const p of prescriptions) await insertGeneratedDoses(sql, p, trackingOn(p.patientId));
    return { rows: t.rows(), log };
  };

  it("reproduces the seed's generated doses exactly (source 'seed', tracked from settings)", async () => {
    const { rows, log } = await generateAll();
    const expected = prescriptions.flatMap((p) => generateDoses(p, trackingOn(p.patientId)));
    expect(JSON.stringify(rows)).toBe(JSON.stringify(expected));
    expect(new Set(inserted(log).map((r) => r.source))).toEqual(new Set(['seed']));
    noStatusWrite(log);
  });

  it('حمد: six rows on 2026-09-21, three on 2026-09-26, every one tracked:false', async () => {
    const { rows } = await generateAll();
    const hamad = rows.filter((d) => ['rx-001', 'rx-002', 'rx-003', 'rx-004'].includes(d.prescriptionId));
    const day = (iso: string) => dosesOnDate(hamad, iso).map((d) => `${d.scheduledAt.slice(11, 16)} ${d.prescriptionId}`);
    expect(day('2026-09-21')).toEqual(['08:00 rx-002', '08:00 rx-003', '14:00 rx-002', '18:00 rx-001', '20:00 rx-002', '20:00 rx-003']);
    expect(day('2026-09-26')).toEqual(['08:00 rx-003', '18:00 rx-001', '20:00 rx-003']);
    expect(hamad.every((d) => d.tracked === false && d.status === 'upcoming' && d.source === 'seed')).toBe(true);
  });

  it('فاطمة: rx-005 on 2026-09-20 and 2026-09-22, nothing on 2026-09-21', async () => {
    const { rows } = await generateAll();
    const f = rows.filter((d) => d.prescriptionId === 'rx-005');
    expect(dosesOnDate(f, '2026-09-20').map((d) => d.id)).toEqual(['rx-005-20260920-0900']);
    expect(dosesOnDate(f, '2026-09-21')).toEqual([]);
    expect(dosesOnDate(f, '2026-09-22').map((d) => d.id)).toEqual(['rx-005-20260922-0900']);
  });

  it('rx-006 and rx-007 generate nothing — and no insert statement is even issued', async () => {
    for (const id of ['rx-006', 'rx-007']) {
      const { sql, log } = fakeTx();
      expect(await insertGeneratedDoses(sql, rx(id), false)).toEqual([]);
      expect(log).toEqual([]);
    }
  });
});

describe('regenerateUpcoming — confirmation-time regeneration never touches a recorded dose', () => {
  it("سارة's rx-008: deletes only upcoming, re-inserts the generator's minus the recorded ids, keeps the three recorded rows byte-identical", async () => {
    const t = doseTable(dosesOf('rx-008'));
    const recordedBefore = JSON.stringify(t.rows().filter((d) => d.status !== 'upcoming'));
    const { sql, log } = fakeTx(t.respond);
    const r = await regenerateUpcoming(sql, rx('rx-008'), true);
    expect(r.keptRecordedIds).toEqual(['rx-008-20260919-0700', 'rx-008-20260920-0700', 'rx-008-20260921-0700']);
    expect(r.inserted.some((d) => r.keptRecordedIds.includes(d.id))).toBe(false);
    expect(JSON.stringify(t.rows().filter((d) => d.status !== 'upcoming'))).toBe(recordedBefore);
    expect(t.rows()).toHaveLength(dosesOf('rx-008').length);
    noStatusWrite(log);
  });

  it('throws (so the caller rolls back) if a recorded dose vanished during the delete', async () => {
    const t = doseTable(dosesOf('rx-008'));
    let calls = 0;
    const { sql } = fakeTx((name, params) => {
      if (name === 'recordedIds' && ++calls === 2) return [{ id: 'rx-008-20260920-0700' }]; // two of three gone
      return t.respond(name, params);
    });
    await expect(regenerateUpcoming(sql, rx('rx-008'), true)).rejects.toBeInstanceOf(EngineInvariantError);
  });
});

describe('applyRecompute — after the reported miss', () => {
  it('rx-008 after rx-008-20260919-0700 → changed:false, zero writes, zero audit rows', async () => {
    const t = doseTable(dosesOf('rx-008'));
    const { sql, log } = fakeTx(t.respond);
    const r = await applyRecompute(sql, rx('rx-008'), 'rx-008-20260919-0700');
    expect(r).toEqual({ changed: false, addedIds: [], droppedIds: [] });
    expect(log.map((l) => l.name)).toEqual(['loadDoses']);
    expect(writes(log)).toEqual([]);
    expect(JSON.stringify(t.rows())).toBe(JSON.stringify(dosesOf('rx-008'))); // every time identical
  });

  it('a generated dose missing from the store is re-added with source "system" (D-28), status from the generator only', async () => {
    const missing = 'rx-008-20260925-0700';
    const t = doseTable(dosesOf('rx-008').filter((d) => d.id !== missing));
    const { sql, log } = fakeTx(t.respond);
    const r = await applyRecompute(sql, rx('rx-008'), 'rx-008-20260919-0700');
    expect(r).toEqual({ changed: true, addedIds: [missing], droppedIds: [] });
    expect(inserted(log)).toEqual([{ id: missing, prescription_id: 'rx-008', scheduled_at: '2026-09-25T07:00:00+03:00', tracked: true, source: 'system' }]);
    expect(log.some((l) => l.name === 'audit_insert')).toBe(false);
    noStatusWrite(log);
  });

  it('a stale upcoming dose (a collapsed alternate-day day planted on rx-005) is deleted; recorded rows never are', async () => {
    const f = generateDoses(rx('rx-005'), true).map((d) => (d.id === 'rx-005-20260920-0900' ? { ...d, status: 'missed' as const, recordedAt: '2026-09-20T10:00:00+03:00', source: 'adherence_agent' as const } : d));
    const planted: Dose = { id: 'rx-005-20260921-0900', prescriptionId: 'rx-005', scheduledAt: '2026-09-21T09:00:00+03:00', status: 'upcoming', tracked: true, source: 'seed' };
    const t = doseTable([...f, planted]);
    const { sql, log } = fakeTx(t.respond);
    const r = await applyRecompute(sql, rx('rx-005'), 'rx-005-20260920-0900');
    expect(r).toEqual({ changed: true, addedIds: [], droppedIds: ['rx-005-20260921-0900'] });
    expect(t.rows().find((d) => d.id === 'rx-005-20260920-0900')?.status).toBe('missed');
    expect(dosesOnDate(t.rows(), '2026-09-21')).toEqual([]);
    noStatusWrite(log);
  });

  it('a call BEFORE the miss is recorded (the dose still upcoming) is a no-op — recompute never infers a miss', async () => {
    const t = doseTable(dosesOf('rx-009'));
    const { sql, log } = fakeTx(t.respond);
    // rx-009-20260919-1300: tracked, past REFERENCE_NOW, unanswered (CR-051) — silence is not evidence.
    expect(await applyRecompute(sql, rx('rx-009'), 'rx-009-20260919-1300')).toEqual({ changed: false, addedIds: [], droppedIds: [] });
    expect(writes(log)).toEqual([]);
    expect(t.rows().find((d) => d.id === 'rx-009-20260919-1300')?.status).toBe('upcoming');
  });
});

describe('applyDiscontinuation — D-023, D-29', () => {
  it('rx-003 at 2026-09-21: every upcoming dose after the 21st cancelled, the 21st kept, the prescription updated with the date', async () => {
    const t = doseTable(dosesOf('rx-003'));
    const { sql, log } = fakeTx(t.respond);
    const r = await applyDiscontinuation(sql, rx('rx-003'), '2026-09-21', 'الطبيب أوقف الدواء');
    if (!r.ok) throw new Error(r.reason);
    const upd = log.find((l) => l.name === 'discontinuePrescription')!;
    expect(upd.params).toEqual(['rx-003', '2026-09-21', 'الطبيب أوقف الدواء']);
    expect(r.prescription).toMatchObject({ status: 'discontinued', discontinuedAt: '2026-09-21', discontinuedReason: 'الطبيب أوقف الدواء' });
    expect(t.rows().every((d) => d.scheduledAt.slice(0, 10) <= '2026-09-21')).toBe(true);
    expect(dosesOnDate(t.rows(), '2026-09-21').map((d) => d.id)).toEqual(['rx-003-20260921-0800', 'rx-003-20260921-2000']);
    expect(r.cancelledDoseIds).toHaveLength(dosesOf('rx-003').filter((d) => d.scheduledAt.slice(0, 10) > '2026-09-21').length);
    expect(r.cancelledDoseIds[0]).toBe('rx-003-20260922-0800');
    expect(log.some((l) => l.name === 'audit_insert')).toBe(false);
    noStatusWrite(log);
  });

  it('a full datetime is stored as its calendar date — the same value the cancel boundary used', async () => {
    const t = doseTable(dosesOf('rx-003'));
    const { sql, log } = fakeTx(t.respond);
    const r = await applyDiscontinuation(sql, rx('rx-003'), '2026-09-21T09:15:00+03:00', 'x');
    expect(r.ok && r.prescription.discontinuedAt).toBe('2026-09-21');
    expect(log.find((l) => l.name === 'discontinuePrescription')!.params[1]).toBe('2026-09-21');
  });

  it("backdated to 2026-09-19 on سارة's rx-008: the recorded 20th and 21st survive", async () => {
    const t = doseTable(dosesOf('rx-008'));
    const { sql } = fakeTx(t.respond);
    const r = await applyDiscontinuation(sql, rx('rx-008'), '2026-09-19', 'x');
    expect(r.ok).toBe(true);
    expect(t.rows().filter((d) => d.status !== 'upcoming').map((d) => d.id)).toEqual(['rx-008-20260919-0700', 'rx-008-20260920-0700', 'rx-008-20260921-0700']);
    expect(t.rows().filter((d) => d.status === 'upcoming' && d.scheduledAt.slice(0, 10) > '2026-09-19')).toEqual([]);
  });

  it('a malformed date → { ok:false, invalid_date }, returned (never thrown), before any statement runs', async () => {
    const { sql, log } = fakeTx();
    await expect(applyDiscontinuation(sql, rx('rx-003'), 'yesterday', 'x')).resolves.toEqual({ ok: false, reason: 'invalid_date' });
    expect(log).toEqual([]);
  });

  it('rx-004 (already discontinued) → not_active, nothing rewritten', async () => {
    const { sql, log } = fakeTx();
    await expect(applyDiscontinuation(sql, rx('rx-004'), '2026-09-21', 'x')).resolves.toEqual({ ok: false, reason: 'not_active' });
    expect(log).toEqual([]);
  });

  it('the update matched no row (RLS, or no longer active) → not_found, no dose deleted', async () => {
    const t = doseTable(dosesOf('rx-003'));
    const { sql, log } = fakeTx((name, params) => (name === 'discontinuePrescription' ? [] : t.respond(name, params)));
    await expect(applyDiscontinuation(sql, rx('rx-003'), '2026-09-21', 'x')).resolves.toEqual({ ok: false, reason: 'not_found' });
    expect(log.some((l) => l.name === 'deleteUpcomingIds')).toBe(false);
  });
});
