/**
 * recomputeAfterReportedMiss — P2-WP4 (docs/briefs/P2-WP4.md), against the seed's own records
 * (lib/data/mock/seed.ts → buildPrescriptions/buildSettings/buildDoses) and AI Agents TC-RS-01,
 * 02, 04, 05, 07. The seed's reported miss is rx-008-20260919-0700 (سارة, Levothyroxine).
 */
import { describe, expect, it } from 'vitest';
import type { Dose, Prescription } from '@/types/contracts';
import { buildDoses, buildPrescriptions, buildSettings } from '@/lib/data/mock/seed';
import { generateDoses } from '@/lib/schedule/generate';
import { recomputeAfterReportedMiss } from '@/lib/schedule/recompute';
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
  return { prescriptions, doses, rx };
}

const SEED_MISS = 'rx-008-20260919-0700';

/** A test-only overlay: the agent path having recorded a miss (tests may construct statuses; lib code may not). */
function reportMiss(doses: Dose[], id: string): Dose[] {
  return doses.map((d) => (d.id === id ? { ...d, status: 'missed' as const, tracked: true, recordedAt: `${d.scheduledAt.slice(0, 11)}23:00:00+03:00`, source: 'adherence_agent' as const } : d));
}

describe('recompute — the seed reported miss (rx-008, 2026-09-19 07:00) — TC-RS-01', () => {
  const { doses, rx } = seed();
  const rx008 = rx('rx-008');
  const result = recomputeAfterReportedMiss(rx008, doses, SEED_MISS);

  it('changes nothing: changed:false, the identical set of scheduledAt values', () => {
    expect(result.changed).toBe(false);
    const before = doses.filter((d) => d.prescriptionId === 'rx-008').map((d) => d.scheduledAt).sort();
    const after = result.doses.filter((d) => d.prescriptionId === 'rx-008').map((d) => d.scheduledAt).sort();
    expect(after).toEqual(before);
    expect(after).toHaveLength(180);
  });

  it('returns the input dose list unchanged, in its own order', () => {
    expect(result.doses).toEqual(doses);
  });

  it('the missed dose stays logged, exactly as the agent path wrote it (not deleted, not rewritten)', () => {
    const missed = result.doses.find((d) => d.id === SEED_MISS);
    expect(missed).toEqual({
      id: SEED_MISS, prescriptionId: 'rx-008', scheduledAt: '2026-09-19T07:00:00+03:00',
      status: 'missed', tracked: true, recordedAt: '2026-09-19T07:55:00+03:00', source: 'adherence_agent',
    });
  });

  it('every recorded dose of سارة is carried through untouched', () => {
    const recordedBefore = doses.filter((d) => d.status !== 'upcoming');
    const recordedAfter = result.doses.filter((d) => d.status !== 'upcoming');
    expect(recordedAfter).toEqual(recordedBefore);
    expect(recordedAfter).toHaveLength(5);
  });

  it('does not mutate its inputs', () => {
    const { doses: d2, rx: rx2 } = seed();
    const p = rx2('rx-008');
    const snapD = structuredClone(d2);
    const snapP = structuredClone(p);
    const r = recomputeAfterReportedMiss(p, d2, SEED_MISS);
    expect(d2).toEqual(snapD);
    expect(p).toEqual(snapP);
    expect(r.doses[0]).not.toBe(d2[0]); // copies, not aliases
  });
});

describe('recompute — alternate-day cadence survives a reported miss (rx-005) — TC-RS-02', () => {
  // فاطمة's tracking is off in the seed, so no miss can be recorded on her doses. The cadence test
  // needs a tracked rx-005: the same prescription generated for a tracking-on patient, with the
  // 2026-09-20 dose reported missed by the (test-simulated) agent path.
  const { rx } = seed();
  const rx005 = rx('rx-005');
  const missId = 'rx-005-20260920-0900';
  const doses = reportMiss(generateDoses(rx005, true), missId);
  const result = recomputeAfterReportedMiss(rx005, doses, missId);
  const dates = result.doses.map((d) => dateOf(d.scheduledAt));

  it('changed:false — nothing moves', () => {
    expect(result.changed).toBe(false);
    expect(result.doses).toEqual(doses);
  });

  it('still lands on 14 · 16 · 18 · 20 · 22 · 24 September, and never on the 21st', () => {
    expect(dates.slice(0, 6)).toEqual(['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-20', '2026-09-22', '2026-09-24']);
    expect(dates).not.toContain('2026-09-21');
    expect(dates).not.toContain('2026-09-23');
  });

  it('30 doses over the 60-day span, every one an even number of days from startDate', () => {
    expect(result.doses).toHaveLength(30);
    for (const d of dates) expect((Date.parse(`${d}T00:00:00Z`) - Date.parse('2026-09-14T00:00:00Z')) / 86_400_000 % 2).toBe(0);
  });

  it('a collapsed (daily) schedule in storage is REPAIRED back to alternate-day, the miss kept', () => {
    const collapsedExtra: Dose = { id: 'rx-005-20260921-0900', prescriptionId: 'rx-005', scheduledAt: '2026-09-21T09:00:00+03:00', status: 'upcoming', tracked: true, source: 'seed' };
    const r = recomputeAfterReportedMiss(rx005, [...doses, collapsedExtra], missId);
    expect(r.changed).toBe(true);
    expect(r.doses.map((d) => d.id)).not.toContain('rx-005-20260921-0900');
    expect(r.doses.find((d) => d.id === missId)?.status).toBe('missed');
    expect(r.doses).toHaveLength(30);
  });
});

describe('recompute — boundaries of the duration and the three-times-daily case', () => {
  const { rx } = seed();
  const rx002 = rx('rx-002');

  it('TC-RS-04: a miss on rx-002\'s last dose (2026-09-25 20:00) never extends past startDate + durationDays', () => {
    const missId = 'rx-002-20260925-2000';
    const doses = reportMiss(generateDoses(rx002, true), missId);
    const r = recomputeAfterReportedMiss(rx002, doses, missId);
    expect(r.changed).toBe(false);
    expect(r.doses.filter((d) => dateOf(d.scheduledAt) > '2026-09-25')).toEqual([]);
    expect(r.doses).toHaveLength(21);
  });

  it('TC-RS-05: three-times-daily — every day keeps all three doseTimes after a miss', () => {
    const missId = 'rx-002-20260921-0800';
    const doses = reportMiss(generateDoses(rx002, true), missId);
    const r = recomputeAfterReportedMiss(rx002, doses, missId);
    const byDay = new Map<string, string[]>();
    for (const d of r.doses) byDay.set(dateOf(d.scheduledAt), [...(byDay.get(dateOf(d.scheduledAt)) ?? []), d.scheduledAt.slice(11, 16)]);
    expect([...byDay.keys()]).toEqual(['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']);
    for (const times of byDay.values()) expect(times).toEqual(['08:00', '14:00', '20:00']);
  });
});

describe('recompute — reconciliation rules', () => {
  const { doses, rx } = seed();
  const rx008 = rx('rx-008');

  it('a missing upcoming dose is restored from the generator, tracked from the missed dose, status upcoming', () => {
    const gap = 'rx-008-20260925-0700';
    const r = recomputeAfterReportedMiss(rx008, doses.filter((d) => d.id !== gap), SEED_MISS);
    expect(r.changed).toBe(true);
    expect(r.doses.find((d) => d.id === gap)).toEqual({
      id: gap, prescriptionId: 'rx-008', scheduledAt: '2026-09-25T07:00:00+03:00', status: 'upcoming', tracked: true, source: 'seed',
    });
  });

  it('an existing upcoming dose is kept as it is — its tracked and source are carried through, not regenerated', () => {
    const id = 'rx-008-20260930-0700';
    const edited = doses.map((d) => (d.id === id ? { ...d, source: 'system' as const } : d));
    const r = recomputeAfterReportedMiss(rx008, edited, SEED_MISS);
    expect(r.changed).toBe(false);
    expect(r.doses.find((d) => d.id === id)?.source).toBe('system');
  });

  it('doses of other prescriptions pass through untouched', () => {
    const r = recomputeAfterReportedMiss(rx008, doses.filter((d) => d.id !== 'rx-008-20260925-0700'), SEED_MISS);
    const others = (list: Dose[]) => list.filter((d) => d.prescriptionId !== 'rx-008');
    expect(others(r.doses)).toEqual(others(doses));
  });

  it('after a discontinuation, recompute agrees with it: changed:false (same inclusive boundary as the generator)', () => {
    const disc = discontinuePrescription(rx008, doses, '2026-09-22', 'test');
    const r = recomputeAfterReportedMiss(disc.prescription, disc.doses, SEED_MISS);
    expect(r.changed).toBe(false);
    expect(r.doses.filter((d) => d.prescriptionId === 'rx-008' && dateOf(d.scheduledAt) > '2026-09-22')).toEqual([]);
  });
});

describe('recompute — no-op when the call is not a reported miss on this prescription', () => {
  const { doses, rx } = seed();
  const rx008 = rx('rx-008');

  it.each([
    ['an unknown dose id', 'rx-008-20990101-0700'],
    ['a dose of another prescription', 'rx-009-20260920-2100'],
    ['a dose still upcoming (no miss recorded)', 'rx-008-20260925-0700'],
    ['a dose recorded as taken', 'rx-008-20260920-0700'],
  ])('%s → changed:false, input returned even when storage has a gap to repair', (_label, id) => {
    // A gap the recompute WOULD repair if the call were valid — so changed:false proves the refusal.
    const input = doses.filter((d) => d.id !== 'rx-008-20260926-0700');
    const r = recomputeAfterReportedMiss(rx008, input, id);
    expect(r.changed).toBe(false);
    expect(r.doses).toEqual(input);
  });

  it('a "miss" on a tracked:false dose is impossible input → no-op', () => {
    const untracked = doses.map((d) => (d.id === SEED_MISS ? { ...d, tracked: false } : d)).filter((d) => d.id !== 'rx-008-20260925-0700');
    const r = recomputeAfterReportedMiss(rx008, untracked, SEED_MISS);
    expect(r.changed).toBe(false);
    expect(r.doses).toEqual(untracked);
  });

  it('TC-RS-07: a prescription flagged for review and not confirmed is never recomputed', () => {
    const flagged: Prescription = { ...rx008, needsReview: true, fieldReviewStatus: 'pending' };
    const r = recomputeAfterReportedMiss(flagged, doses, SEED_MISS);
    expect(r.changed).toBe(false);
    expect(r.doses).toEqual(doses);
  });

  it('a flagged prescription that the reviewer CONFIRMED is recomputed normally', () => {
    const confirmed: Prescription = { ...rx008, needsReview: true, fieldReviewStatus: 'confirmed' };
    const r = recomputeAfterReportedMiss(confirmed, doses.filter((d) => d.id !== 'rx-008-20260925-0700'), SEED_MISS);
    expect(r.changed).toBe(true);
    expect(r.doses.some((d) => d.id === 'rx-008-20260925-0700')).toBe(true);
  });
});
