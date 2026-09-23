/**
 * The generator's boundaries, as the Phase 2 spec names them (docs/Acceptance Criteria and Test
 * Plan.md → PHASE 2 → "Schedule & depletion logic"; docs/BACKEND-PLAN.md Gate 4), asserted on the
 * SEED'S OWN RECORDS — lib/data/mock/seed.ts → buildPrescriptions() / buildSettings() /
 * buildDoses() — rather than on hand-copied fixtures, so a drift between the seed module and
 * docs/Seed Dataset.md → "Doses" fails here. Plus rule 4 (silence is not evidence): no function in
 * lib/schedule turns an unanswered dose into `missed`, whatever `nowIso` it is handed.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Dose } from '@/types/contracts';
import { REFERENCE_NOW } from '@/lib/config';
import { buildCaregivers, buildDoses, buildPrescriptions, buildSettings } from '@/lib/data/mock/seed';
import * as schedule from '@/lib/schedule';
import { dosesOnDate } from '@/lib/schedule/group';
import { dateOf } from '@/lib/schedule/dates';

function seedDoses(): Dose[] {
  const prescriptions = buildPrescriptions();
  const settings = buildSettings();
  return buildDoses(prescriptions, new Map(settings.map((s) => [s.patientId, s])));
}

const doses = seedDoses();
const HAMAD = ['rx-001', 'rx-002', 'rx-003', 'rx-004'];
const SARA = ['rx-008', 'rx-009'];
const forRx = (ids: string[]) => doses.filter((d) => ids.includes(d.prescriptionId));
const hhmm = (d: Dose) => d.scheduledAt.slice(11, 16);

describe('حمد — 2026-09-21, tracking off (docs/Seed Dataset.md → "Doses")', () => {
  const day = dosesOnDate(forRx(HAMAD), '2026-09-21');

  it('exactly six rows at 08:00 ×2, 14:00, 18:00, 20:00 ×2', () => {
    expect(day.map(hhmm)).toEqual(['08:00', '08:00', '14:00', '18:00', '20:00', '20:00']);
  });

  it('the seed\'s drugs at each time: Metformin + Ibuprofen, Ibuprofen, Warfarin, Metformin + Ibuprofen', () => {
    const at = (t: string) => new Set(day.filter((d) => hhmm(d) === t).map((d) => d.prescriptionId));
    expect(at('08:00')).toEqual(new Set(['rx-003', 'rx-002']));
    expect(at('14:00')).toEqual(new Set(['rx-002']));
    expect(at('18:00')).toEqual(new Set(['rx-001']));
    expect(at('20:00')).toEqual(new Set(['rx-003', 'rx-002']));
  });

  it('every row tracked:false, status upcoming, source seed — including the two 08:00 rows already behind REFERENCE_NOW', () => {
    for (const d of day) {
      expect(d.tracked).toBe(false);
      expect(d.status).toBe('upcoming');
      expect(d.source).toBe('seed');
      expect(d.recordedAt).toBeUndefined();
    }
  });

  it('no dose of حمد carries a recorded status anywhere in his schedule', () => {
    expect(forRx(HAMAD).filter((d) => d.status !== 'upcoming' || d.tracked !== false)).toEqual([]);
  });
});

describe('حمد — the duration boundary: rx-002 ends 2026-09-25', () => {
  it('2026-09-25 still has all three Ibuprofen doses', () => {
    expect(dosesOnDate(forRx(['rx-002']), '2026-09-25').map(hhmm)).toEqual(['08:00', '14:00', '20:00']);
  });

  it('2026-09-26: three rows — Metformin ×2 and Warfarin — and no Ibuprofen', () => {
    const day = dosesOnDate(forRx(HAMAD), '2026-09-26');
    expect(day).toHaveLength(3);
    expect(day.map((d) => [hhmm(d), d.prescriptionId])).toEqual([['08:00', 'rx-003'], ['18:00', 'rx-001'], ['20:00', 'rx-003']]);
  });

  it('rx-002 has no dose after 2026-09-25 at all, and 21 in total (7 days × 3)', () => {
    expect(forRx(['rx-002']).filter((d) => dateOf(d.scheduledAt) > '2026-09-25')).toEqual([]);
    expect(forRx(['rx-002'])).toHaveLength(21);
  });
});

describe('حمد — the discontinuation boundary: rx-004 generates nothing after 2026-06-28', () => {
  it('nothing after 2026-06-28', () => {
    expect(forRx(['rx-004']).filter((d) => dateOf(d.scheduledAt) > '2026-06-28')).toEqual([]);
  });

  it('the discontinuation day itself is inclusive: one 21:00 dose on 2026-06-28', () => {
    expect(dosesOnDate(forRx(['rx-004']), '2026-06-28').map(hhmm)).toEqual(['21:00']);
  });

  it('2026-04-02 .. 2026-06-28 inclusive = 88 doses', () => {
    expect(forRx(['rx-004'])).toHaveLength(88);
  });
});

describe('فاطمة — the alternate-day cadence (rx-005) and the unconfirmed records', () => {
  const rx005 = forRx(['rx-005']);

  it('doses on 14, 16, 18, 20, 22 and 24 September', () => {
    const sept = rx005.map((d) => dateOf(d.scheduledAt)).filter((d) => d <= '2026-09-24');
    expect(sept).toEqual(['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-20', '2026-09-22', '2026-09-24']);
  });

  it('none on the 21st — the empty day', () => {
    expect(dosesOnDate(rx005, '2026-09-21')).toEqual([]);
    expect(dosesOnDate(doses.filter((d) => ['rx-005', 'rx-006', 'rx-007'].includes(d.prescriptionId)), '2026-09-21')).toEqual([]);
  });

  it('rx-006 (pending review) and rx-007 (returned) generate zero doses', () => {
    expect(forRx(['rx-006'])).toEqual([]);
    expect(forRx(['rx-007'])).toEqual([]);
  });
});

describe('سارة — the seven stated rows on 19–21 September, exactly', () => {
  const byId = new Map(doses.map((d) => [d.id, d]));
  const at = (date: string, time: string) => `${date}T${time}:00+03:00`;
  const STATED: Array<[string, Partial<Dose>]> = [
    ['rx-008-20260919-0700', { status: 'missed', recordedAt: at('2026-09-19', '07:55'), source: 'adherence_agent' }],
    ['rx-008-20260920-0700', { status: 'taken_on_time', recordedAt: at('2026-09-20', '07:05'), source: 'adherence_agent' }],
    ['rx-009-20260920-1300', { status: 'taken_on_time', recordedAt: at('2026-09-20', '13:20'), source: 'adherence_agent' }],
    ['rx-009-20260920-2100', { status: 'taken_late', recordedAt: at('2026-09-20', '22:40'), source: 'adherence_agent' }],
    ['rx-008-20260921-0700', { status: 'taken_on_time', recordedAt: at('2026-09-21', '07:12'), source: 'adherence_agent' }],
    ['rx-009-20260921-1300', { status: 'upcoming', recordedAt: undefined }],
    ['rx-009-20260921-2100', { status: 'upcoming', recordedAt: undefined }],
  ];

  it.each(STATED)('%s', (id, expected) => {
    const d = byId.get(id);
    expect(d).toBeDefined();
    expect(d?.tracked).toBe(true);
    expect(d?.status).toBe(expected.status);
    expect(d?.recordedAt).toBe(expected.recordedAt);
    if (expected.source) expect(d?.source).toBe(expected.source);
  });

  it('the only recorded statuses in the whole seed are these five, all from the agent — none from the UI', () => {
    const recorded = doses.filter((d) => d.status !== 'upcoming');
    expect(recorded.map((d) => d.id).sort()).toEqual(STATED.slice(0, 5).map(([id]) => id).sort());
    for (const d of doses) expect(d.source === 'seed' || d.source === 'adherence_agent').toBe(true);
  });

  it('every سارة dose is tracked:true', () => {
    for (const d of forRx(SARA)) expect(d.tracked).toBe(true);
  });

  it('the generator also produces rx-009 13:00 / 21:00 on 2026-09-19 — not in the seed table, upcoming, never inferred missed', () => {
    // docs/Seed Dataset.md lists seven rows for 19–21 Sept; the generated schedule holds nine
    // (rx-009 starts 2026-09-05). The two unlisted rows are tracked, past REFERENCE_NOW and
    // unanswered — and upcoming. Logged in docs/backend-notes/p2-wp4.md for the owner.
    for (const id of ['rx-009-20260919-1300', 'rx-009-20260919-2100']) {
      expect(byId.get(id)?.status).toBe('upcoming');
      expect(byId.get(id)?.tracked).toBe(true);
    }
    expect(forRx(SARA).filter((d) => ['2026-09-19', '2026-09-20', '2026-09-21'].includes(dateOf(d.scheduledAt)))).toHaveLength(9);
  });
});

// ---------------------------------------------------------------------------------------------
// Rule 4 — silence is not evidence.
// ---------------------------------------------------------------------------------------------

const LATER = '2026-09-24T09:15:00+03:00'; // REFERENCE_NOW + three days

describe('rule 4 — a later nowIso through every function in the package leaves every upcoming dose upcoming', () => {
  it('LATER is three days after REFERENCE_NOW', () => {
    expect((Date.parse(LATER) - Date.parse(REFERENCE_NOW)) / 86_400_000).toBe(3);
  });

  it('the functions that take a clock take it as a parameter, and they never touch a dose', () => {
    const before = structuredClone(doses);
    schedule.invitationsToExpire(buildCaregivers(), LATER);
    for (const c of buildCaregivers()) schedule.foldInvitationExpiry(c, LATER);
    expect(doses).toEqual(before);
  });

  it('recompute and discontinue, run across the seed, never move an upcoming dose to any other status', () => {
    const prescriptions = buildPrescriptions();
    const upcomingBefore = new Set(doses.filter((d) => d.status === 'upcoming').map((d) => d.id));
    const results: Dose[][] = [];
    for (const rx of prescriptions) {
      results.push(schedule.recomputeAfterReportedMiss(rx, doses, 'rx-008-20260919-0700').doses);
      if (rx.status === 'active') results.push(schedule.discontinuePrescription(rx, doses, LATER, 'test').doses);
    }
    for (const out of results) {
      for (const d of out) if (upcomingBefore.has(d.id)) expect(d.status).toBe('upcoming');
      // The purest fixtures: tracked, unanswered, already in the past at REFERENCE_NOW.
      for (const id of ['rx-009-20260919-1300', 'rx-009-20260919-2100', 'rx-003-20260921-0800', 'rx-002-20260921-0800']) {
        const d = out.find((x) => x.id === id);
        if (d) expect(d.status).toBe('upcoming');
      }
    }
  });

  it('no function in lib/schedule takes a dose and a clock together: recompute/discontinue have no nowIso', () => {
    expect(schedule.recomputeAfterReportedMiss.length).toBe(3);
    expect(schedule.discontinuePrescription.length).toBe(4);
    expect(schedule.generateDoses.length).toBe(2);
  });
});

// Built from pieces so this test file does not itself contain the pattern guard 4 scans for.
const DOSE_WORDS = ['upcoming', 'taken_on_time', 'taken_late', 'miss' + 'ed'].join('|');
const STATUS_LITERAL = new RegExp(`\\bstatus\\s*:\\s*['"](${DOSE_WORDS})['"]`);
const STATUS_ASSIGN = new RegExp('\\.sta' + 'tus\\s*=(?!=)');
// Any `'missed'` literal that is not the right-hand side of a === / !== comparison: an assignment,
// an object value, a ternary branch, an array element, a return — every way of producing the word.
const MISSED_LITERAL_ASSIGN = new RegExp(`(?<![!=]==\\s*)['"]miss${'ed'}['"]`);
const CLOCK_READ = /\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bREFERENCE_NOW\b|\breferenceNow\b|\bREFERENCE_DATE\b/;
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const SCHEDULE_DIR = path.resolve(process.cwd(), 'lib/schedule');
const sources = readdirSync(SCHEDULE_DIR).filter((f) => f.endsWith('.ts')).map((f) => ({ file: f, code: stripComments(readFileSync(path.join(SCHEDULE_DIR, f), 'utf8')) }));

describe('rule 1 / rule 4 — static: no code path in lib/schedule assigns a dose status', () => {
  it('positive control: the patterns DO catch what they are meant to catch (never green by absence)', () => {
    expect(STATUS_LITERAL.test("{ status: '" + 'miss' + "ed' }")).toBe(true);
    expect(STATUS_LITERAL.test("{ status: 'taken_late' }")).toBe(true);
    expect(STATUS_ASSIGN.test('x.sta' + "tus = 'anything'")).toBe(true);
    expect(STATUS_ASSIGN.test("x.status === 'upcoming'")).toBe(false);
    expect(MISSED_LITERAL_ASSIGN.test("s = '" + 'miss' + "ed'")).toBe(true);
    expect(MISSED_LITERAL_ASSIGN.test("s === '" + 'miss' + "ed'")).toBe(false);
    expect(MISSED_LITERAL_ASSIGN.test("s !== '" + 'miss' + "ed'")).toBe(false);
    expect(MISSED_LITERAL_ASSIGN.test("late ? ('" + 'miss' + "ed' as const) : s")).toBe(true);
    expect(MISSED_LITERAL_ASSIGN.test("return '" + 'miss' + "ed';")).toBe(true);
    expect(CLOCK_READ.test('Date.' + 'now()')).toBe(true);
  });

  it('the scan actually has input: the new modules and the generator are all present and non-empty', () => {
    const names = sources.map((s) => s.file);
    for (const f of ['generate.ts', 'recompute.ts', 'discontinue.ts', 'expiry.ts', 'index.ts']) expect(names).toContain(f);
    for (const s of sources) expect(s.code.trim().length).toBeGreaterThan(0);
  });

  it.each(sources.map((s) => [s.file, s.code] as const))('%s: no .status assignment, missed appears only as a comparison, status literal only upcoming and only in the generator', (file, code) => {
    expect(STATUS_ASSIGN.test(code)).toBe(false);
    expect(MISSED_LITERAL_ASSIGN.test(code)).toBe(false);
    const literal = code.match(new RegExp(STATUS_LITERAL.source, 'g')) ?? [];
    if (file === 'generate.ts') expect(literal).toEqual(["status: 'upcoming'"]);
    else expect(literal).toEqual([]);
  });

  it('recompute, discontinue, expiry, group and generate read no clock of any kind', () => {
    for (const s of sources.filter((x) => ['recompute.ts', 'discontinue.ts', 'expiry.ts', 'group.ts', 'generate.ts'].includes(x.file))) {
      expect([s.file, CLOCK_READ.test(s.code)]).toEqual([s.file, false]);
    }
  });

  it('no exported function\'s name says it marks or records a dose, and no exported body assigns missed', () => {
    const fns = Object.entries(schedule).filter(([, v]) => typeof v === 'function') as Array<[string, (...a: unknown[]) => unknown]>;
    expect(fns.length).toBeGreaterThanOrEqual(10);
    for (const [name, fn] of fns) {
      expect(name).not.toMatch(/missed|(mark|record|set|log|write)\w*(dose|status|miss)/i);
      expect(STATUS_ASSIGN.test(fn.toString())).toBe(false);
      expect(MISSED_LITERAL_ASSIGN.test(fn.toString())).toBe(false);
    }
  });
});
