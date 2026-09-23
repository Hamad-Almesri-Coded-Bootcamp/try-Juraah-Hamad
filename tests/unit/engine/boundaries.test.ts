/**
 * P2-WP4b — rule 1 / G1 and rule 4, statically, over every lib/engine/*.ts file (comments
 * stripped) and over every ENGINE_SQL statement. Each scanner has a positive control, so the
 * suite cannot pass because it found nothing to look at (owner's standing rule).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ENGINE_SQL } from '@/lib/engine/sql';
import * as engine from '@/lib/engine';

const DIR = path.resolve(import.meta.dirname, '../../../lib/engine');
const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'));
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const code = Object.fromEntries(files.map((f) => [f, stripComments(readFileSync(path.join(DIR, f), 'utf8'))]));

const DOSE_WORD = /['"](upcoming|taken_on_time|taken_late|missed)['"]/;
const scanners = {
  statusLiteral: (s: string) => /\bstatus\s*:\s*['"`]/.test(s),
  statusAssignment: (s: string) => /\.status\s*=(?!=)/.test(s),
  missedOutsideComparison: (s: string) => [...s.matchAll(/['"]missed['"]/g)].some((m) => !/[!=]==\s*$/.test(s.slice(0, m.index))),
  sqlStatusWrite: (s: string) => /\bupdate\s+(public\.)?doses\b/i.test(s) || /\bset\s+status\s*=\s*'(taken_on_time|taken_late|missed)'/i.test(s),
  clock: (s: string) => /\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bREFERENCE_NOW\b|\bREFERENCE_DATE\b/.test(s),
};

describe('positive controls — every scanner flags what it is for', () => {
  it.each([
    ['statusLiteral', "const d = { status: 'missed' }"],
    ['statusAssignment', 'dose.sta' + "tus = 'missed'"], // split so guard 4 does not read the control sample as a write (as tests/unit/schedule/boundaries.test.ts does)
    ['missedOutsideComparison', "const s = cond ? ('missed' as const) : d.status"],
    ['sqlStatusWrite', "update doses set status = 'missed' where id = $1"],
    ['sqlStatusWrite', 'UPDATE public.doses SET tracked = false'],
    ['clock', 'const t = Date.now()'],
    ['clock', "import { REFERENCE_NOW } from '@/lib/config'"],
  ] as const)('%s flags: %s', (name, sample) => {
    expect(scanners[name](sample)).toBe(true);
  });
  it("and does not flag a comparison: d.status === 'missed'", () => {
    expect(scanners.missedOutsideComparison("if (d.status === 'missed') return")).toBe(false);
  });
});

describe('lib/engine/*.ts — nothing assigns a dose status, nothing reads a clock', () => {
  it('the scan has input: the six engine modules exist', () => {
    expect(files.sort()).toEqual(['depletion.ts', 'doses.ts', 'expiry.ts', 'index.ts', 'rows.ts', 'sql.ts']);
  });
  it.each(files)('%s: no `status:` literal, no `.status =`, no stray "missed", no update of doses, no clock', (f) => {
    const s = code[f]!;
    expect(scanners.statusLiteral(s)).toBe(false);
    expect(scanners.statusAssignment(s)).toBe(false);
    expect(scanners.missedOutsideComparison(s)).toBe(false);
    expect(scanners.sqlStatusWrite(s)).toBe(false);
    expect(scanners.clock(s)).toBe(false);
  });
  it('the only dose word in the engine is "upcoming", and only in comparisons or SQL filters', () => {
    for (const [f, s] of Object.entries(code)) {
      for (const m of s.matchAll(new RegExp(DOSE_WORD, 'g'))) {
        expect(m[1], `${f}: ${m[0]}`).toBe('upcoming');
      }
    }
  });
  it('doses.ts takes no clock: none of its exported functions has a nowIso parameter (rule 4)', () => {
    for (const fn of [engine.insertGeneratedDoses, engine.regenerateUpcoming, engine.applyRecompute, engine.applyDiscontinuation]) {
      expect(fn.toString()).not.toMatch(/nowIso|jurah\.now|Date\.parse/);
    }
  });
});

describe('ENGINE_SQL — every statement', () => {
  const statements = Object.entries(ENGINE_SQL);
  it('has input: 11 statements', () => expect(statements).toHaveLength(11));
  it.each(statements)('%s: no dose-status write, no Civil ID', (_n, text) => {
    expect(scanners.sqlStatusWrite(text)).toBe(false);
    expect(text).not.toMatch(/civil_id/i);
  });
  it('every delete from doses is restricted to upcoming rows', () => {
    const deletes = statements.filter(([, t]) => /delete\s+from\s+doses/i.test(t));
    expect(deletes.map(([n]) => n)).toEqual(['deleteUpcoming', 'deleteUpcomingIds']);
    for (const [, t] of deletes) expect(t).toMatch(/status = 'upcoming'/);
  });
  it('the dose insert does not carry a status column (the default is the generator\'s word)', () => {
    expect(ENGINE_SQL.insertDoses).toMatch(/insert into doses \(id, prescription_id, scheduled_at, tracked, source\)/);
    expect(ENGINE_SQL.insertDoses).not.toMatch(/\bstatus\b/);
  });
  it('the expiry statements never name doses', () => {
    for (const n of ['pendingInvitations', 'setClock', 'expireInvitations', 'recordJobRun'] as const) expect(ENGINE_SQL[n]).not.toMatch(/\bdoses\b/);
  });
});
