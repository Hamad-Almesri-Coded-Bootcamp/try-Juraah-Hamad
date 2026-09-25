// @vitest-environment node
/**
 * AP-16 — guard P (scripts/guards/placeholders.ts), split into a pure check(sources) and a run()
 * that also scans agents/ as its own tally. Green on the real tree (a count of owed values is never
 * a violation, only "guard input missing" is). Red only when a whole scope — app or agents/ — was
 * not scanned at all, which the guard must report loudly rather than pass silently.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { walk, rel } from '../../../scripts/guards/_shared';
import { AGENT_DIRS, APP_DIRS, check, run, type Source } from '../../../scripts/guards/placeholders';

const EXTS = ['.ts', '.tsx', '.js', '.json'];
const MARKER_RE_G = /\[TO BE SUPPLIED\]|(?<![=!])[=:]\s*TO_BE_SUPPLIED\b/g;
// A non-global twin for .test(): a global regex's .test() advances its own lastIndex, so reusing one
// object across a loop of calls silently skips matches — .match() (used below) is unaffected by this.
const MARKER_RE = /\[TO BE SUPPLIED\]|(?<![=!])[=:]\s*TO_BE_SUPPLIED\b/;

/** Exactly what run() itself scans, so the fixture never drifts from production behaviour. */
function realSources(): Source[] {
  const files = [...APP_DIRS.flatMap((d) => walk(d, EXTS)), ...AGENT_DIRS.flatMap((d) => walk(d, EXTS))];
  return files.map((f) => ({ path: rel(f), text: readFileSync(f, 'utf8') }));
}

const agentsTally = (name: string): number => Number(/agents (\d+) missing/.exec(name)?.[1] ?? NaN);

describe('guard P on the real tree', () => {
  it('passes — a count of owed values is never a violation — and the agents/ scope is not empty', () => {
    const r = run();
    expect(r.violations).toEqual([]);
    const agentSources = realSources().filter((s) => s.path.startsWith('agents/'));
    expect(agentSources.length).toBeGreaterThan(0);
  });

  it('every listed marker line really holds the marker', () => {
    const r = check(realSources());
    const markerLines = (r.notes ?? []).filter((n) => /^  \S.*:\d+  /.test(n));
    expect(markerLines.length).toBeGreaterThan(0);
    for (const entry of markerLines) {
      const m = /^  (.+):(\d+) {2}/.exec(entry);
      expect(m, entry).not.toBeNull();
      const [, path, lineNo] = m as unknown as [string, string, string];
      const line = readFileSync(path, 'utf8').split('\n')[Number(lineNo) - 1] ?? '';
      expect(MARKER_RE.test(line), `${path}:${lineNo}`).toBe(true);
    }
  });

  it('the agents tally equals an independent count of [TO BE SUPPLIED] over the same agents/ files', () => {
    const agentSources = realSources().filter((s) => s.path.startsWith('agents/'));
    const independent = agentSources.reduce(
      (sum, { text }) =>
        sum +
        text
          .split('\n')
          .filter((line) => !/export const TO_BE_SUPPLIED/.test(line))
          .reduce((n, line) => n + (line.match(MARKER_RE_G)?.length ?? 0), 0),
      0,
    );
    const r = check(realSources());
    expect(agentsTally(r.name)).toBe(independent);
  });
});

describe('guard P goes red on a broken copy', () => {
  it('every agents/ file removed -> guard input missing', () => {
    const appOnly = realSources().filter((s) => !s.path.startsWith('agents/'));
    const r = check(appOnly);
    expect(r.violations).toEqual([{ file: AGENT_DIRS.join(', '), line: 0, text: 'no agents/ file was scanned', rule: 'guard input missing' }]);
  });

  it('every app file removed -> guard input missing', () => {
    const agentsOnly = realSources().filter((s) => s.path.startsWith('agents/'));
    const r = check(agentsOnly);
    expect(r.violations).toEqual([{ file: APP_DIRS.join(', '), line: 0, text: 'no app file was scanned', rule: 'guard input missing' }]);
  });

  it('no input at all -> both scopes missing', () => {
    const r = check([]);
    expect(r.violations).toEqual([
      { file: APP_DIRS.join(', '), line: 0, text: 'no app file was scanned', rule: 'guard input missing' },
      { file: AGENT_DIRS.join(', '), line: 0, text: 'no agents/ file was scanned', rule: 'guard input missing' },
    ]);
  });

  it('one agents/ file carrying two extra markers -> tally +2, both lines listed', () => {
    const sources = realSources();
    const before = check(sources);
    const target = 'agents/scripts/check.js';
    expect(sources.some((s) => s.path === target)).toBe(true);
    const linesForTarget = (r: ReturnType<typeof check>) => (r.notes ?? []).filter((n) => n.startsWith(`  ${target}:`));
    const before1177 = linesForTarget(before).length; // check.js already carries one, at its line 737
    const withExtra = sources.map((s) => (s.path === target ? { ...s, text: `${s.text}\n// [TO BE SUPPLIED]\n// [TO BE SUPPLIED]\n` } : s));
    const after = check(withExtra);
    expect(agentsTally(after.name)).toBe(agentsTally(before.name) + 2);
    expect(linesForTarget(after).length).toBe(before1177 + 2);
  });
});
