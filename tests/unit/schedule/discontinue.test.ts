/**
 * discontinuePrescription — P2-WP4 (docs/briefs/P2-WP4.md), against the seed's own records and AI
 * Agents TC-RS-03 ("remaining future doses cancelled; status: discontinued with reason and
 * timestamp; past logs untouched"). The boundary is the generator's own: inclusive of the
 * discontinuation date (rx-004 stops generating "after 2026-06-28", not before it).
 */
import { describe, expect, it } from 'vitest';
import type { Dose, Prescription } from '@/types/contracts';
import { buildDoses, buildPrescriptions, buildSettings } from '@/lib/data/mock/seed';
import { generateDoses } from '@/lib/schedule/generate';
import { discontinuePrescription } from '@/lib/schedule/discontinue';
import { dateOf } from '@/lib/schedule/dates';

function seed() {
  const prescriptions = buildPrescriptions();
  const settings = buildSettings();
  const doses = buildDoses(prescriptions, new Map(settings.map((s) => [s.patientId, s])));
  const rx = (id: string): Prescription => {
    const p = prescriptions.find((x) => x.id === id);
    if (!p) throw new Error(`seed has no ${id}`);
    return p;
  };
  return { doses, rx };
}

const of = (doses: Dose[], rxId: string) => doses.filter((d) => d.prescriptionId === rxId);
const REASON = 'سبب تجريبي';

describe('discontinue — حمد\'s Metformin (rx-003, tracking off) on 2026-09-21', () => {
  const { doses, rx } = seed();
  const rx003 = rx('rx-003');
  const result = discontinuePrescription(rx003, doses, '2026-09-21', REASON);

  it('sets status, discontinuedAt and discontinuedReason — and nothing else on the prescription', () => {
    expect(result.prescription).toEqual({ ...rx003, status: 'discontinued', discontinuedAt: '2026-09-21', discontinuedReason: REASON });
  });

  it('keeps both doses ON the discontinuation date (inclusive, like the generator)', () => {
    expect(of(result.doses, 'rx-003').filter((d) => dateOf(d.scheduledAt) === '2026-09-21').map((d) => d.id)).toEqual(['rx-003-20260921-0800', 'rx-003-20260921-2000']);
  });

  it('cancels every upcoming dose after it, and lists exactly those ids', () => {
    const expected = of(doses, 'rx-003').filter((d) => dateOf(d.scheduledAt) > '2026-09-21').map((d) => d.id);
    expect(result.cancelledDoseIds).toEqual(expected);
    expect(expected).toHaveLength(2 * 81); // 2026-09-22 .. 2026-12-11 inclusive = 9 + 31 + 30 + 11 days (rx-003 runs 180 days from 2026-06-15)
    expect(of(result.doses, 'rx-003').filter((d) => dateOf(d.scheduledAt) > '2026-09-21')).toEqual([]);
  });

  it('agrees with the generator exactly: the remaining doses are generateDoses(the discontinued prescription)', () => {
    expect(of(result.doses, 'rx-003').map((d) => d.id)).toEqual(generateDoses(result.prescription, false).map((d) => d.id));
  });

  it('the untracked doses that remain are still tracked:false and upcoming — carried, never rewritten', () => {
    for (const d of of(result.doses, 'rx-003')) {
      expect(d.tracked).toBe(false);
      expect(d.status).toBe('upcoming');
    }
  });

  it('doses of every other prescription pass through untouched', () => {
    const others = (list: Dose[]) => list.filter((d) => d.prescriptionId !== 'rx-003');
    expect(others(result.doses)).toEqual(others(doses));
  });

  it('a full datetime discontinuedAt gives the same cut as the bare date, and is stored as given', () => {
    const r = discontinuePrescription(rx003, doses, '2026-09-21T09:15:00+03:00', REASON);
    expect(r.cancelledDoseIds).toEqual(result.cancelledDoseIds);
    expect(r.prescription.discontinuedAt).toBe('2026-09-21T09:15:00+03:00');
  });

  it('does not mutate its inputs', () => {
    const { doses: d2, rx: rx2 } = seed();
    const p = rx2('rx-003');
    const snapD = structuredClone(d2);
    const snapP = structuredClone(p);
    discontinuePrescription(p, d2, '2026-09-21', REASON);
    expect(d2).toEqual(snapD);
    expect(p).toEqual(snapP);
  });
});

describe('discontinue — سارة\'s Levothyroxine (rx-008, tracked): past logs untouched', () => {
  const { doses, rx } = seed();
  const rx008 = rx('rx-008');

  it('discontinued on 2026-09-21: every recorded dose is kept exactly, the future upcoming ones cancelled', () => {
    const r = discontinuePrescription(rx008, doses, '2026-09-21', REASON);
    const recorded = (list: Dose[]) => of(list, 'rx-008').filter((d) => d.status !== 'upcoming');
    expect(recorded(r.doses)).toEqual(recorded(doses));
    expect(recorded(r.doses).map((d) => d.id)).toEqual(['rx-008-20260919-0700', 'rx-008-20260920-0700', 'rx-008-20260921-0700']);
    expect(of(r.doses, 'rx-008').filter((d) => dateOf(d.scheduledAt) > '2026-09-21')).toEqual([]);
  });

  it('BACKDATED to 2026-09-20: the 2026-09-21 dose she already reported taken is NOT removed', () => {
    const r = discontinuePrescription(rx008, doses, '2026-09-20', REASON);
    const kept = r.doses.find((d) => d.id === 'rx-008-20260921-0700');
    expect(kept).toEqual(doses.find((d) => d.id === 'rx-008-20260921-0700'));
    expect(kept?.status).toBe('taken_on_time');
    expect(r.cancelledDoseIds).not.toContain('rx-008-20260921-0700');
    expect(r.cancelledDoseIds[0]).toBe('rx-008-20260922-0700');
  });

  it('rx-009 on the same patient is untouched', () => {
    const r = discontinuePrescription(rx008, doses, '2026-09-21', REASON);
    expect(of(r.doses, 'rx-009')).toEqual(of(doses, 'rx-009'));
  });
});

describe('discontinue — only an active prescription transitions', () => {
  const { doses, rx } = seed();

  it('rx-004 (already discontinued 2026-06-28) is returned unchanged; nothing cancelled', () => {
    const rx004 = rx('rx-004');
    const r = discontinuePrescription(rx004, doses, '2026-09-21', 'سبب آخر');
    expect(r.prescription).toEqual(rx004);
    expect(r.prescription.discontinuedAt).toBe('2026-06-28');
    expect(r.prescription.discontinuedReason).toBe('الطبيب أوقف الدواء بسبب آلام العضلات');
    expect(r.cancelledDoseIds).toEqual([]);
    expect(r.doses).toEqual(doses);
  });

  it('a completed prescription is returned unchanged', () => {
    const done: Prescription = { ...rx('rx-001'), status: 'completed' };
    const r = discontinuePrescription(done, doses, '2026-09-21', REASON);
    expect(r.prescription).toEqual(done);
    expect(r.cancelledDoseIds).toEqual([]);
  });

  it('a discontinuedAt that is not an ISO date throws', () => {
    expect(() => discontinuePrescription(rx('rx-001'), doses, '21/09/2026', REASON)).toThrow(RangeError);
    expect(() => discontinuePrescription(rx('rx-001'), doses, '', REASON)).toThrow(RangeError);
  });
});
