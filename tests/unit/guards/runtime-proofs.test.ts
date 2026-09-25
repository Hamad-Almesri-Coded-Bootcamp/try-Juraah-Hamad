// @vitest-environment node
/**
 * AP-16 — guard A (scripts/guards/runtime-proofs.ts): every static guard the AP-16 table lists is in
 * place and names its runtime proof. Green on the real tree, all five rows passing. Red on
 * deliberately edited copies, each naming its own row: a runtime-proof line removed, the guarded call
 * itself removed, a guard dropped from run.ts's own imports, an anchor removed from a spec, and a
 * required file missing entirely ("guard input missing", never a silent pass).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check, ROWS, run, type Source } from '../../../scripts/guards/runtime-proofs';

function real(): Source[] {
  const files = [...new Set(ROWS.flatMap((r) => r.anchors.map((a) => a.file)))];
  return files.map((path) => ({ path, text: readFileSync(path, 'utf8') }));
}

/** A copy of the real sources with every occurrence of `from` in one file replaced by `to`. */
function edited(path: string, from: string, to: string): Source[] {
  return real().map((s) => {
    if (s.path !== path) return s;
    const text = s.text.replaceAll(from, to);
    expect(text, `the edit to ${path} did not apply`).not.toBe(s.text);
    return { path, text };
  });
}

describe('guard A on the real tree', () => {
  it('passes, with all five rows checked off', () => {
    const r = run();
    expect(r.violations).toEqual([]);
    expect((r.notes ?? []).filter((n) => n.startsWith('✓'))).toHaveLength(ROWS.length);
    expect(ROWS).toHaveLength(5);
  });
});

describe('guard A goes red on a deliberately edited copy', () => {
  it('the J12 runtime-proof line removed from check.js', () => {
    const r = check(edited('agents/scripts/check.js', 'Runtime proof: J12', 'nothing here'));
    expect(r.violations).toEqual([
      { file: 'agents/scripts/check.js', line: 0, text: `${ROWS[0]!.label}: missing "Runtime proof: J12"`, rule: 'runtime proof missing' },
    ]);
  });

  it('the guarded call itself removed from check.js ("await assertVoiceCallsReadOnly(wf);")', () => {
    const r = check(edited('agents/scripts/check.js', 'await assertVoiceCallsReadOnly(wf);', 'void wf;'));
    expect(r.violations).toEqual([
      { file: 'agents/scripts/check.js', line: 0, text: `${ROWS[0]!.label}: missing "await assertVoiceCallsReadOnly(wf);"`, rule: 'runtime proof missing' },
    ]);
  });

  it("no-drift dropped from run.ts's own imports", () => {
    const r = check(edited('scripts/guards/run.ts', "from './no-drift'", "from './no-drift-renamed'"));
    expect(r.violations).toEqual([
      { file: 'scripts/guards/run.ts', line: 0, text: `${ROWS[2]!.label}: missing "from './no-drift'"`, rule: 'runtime proof missing' },
    ]);
  });

  it('"linkTokenLeaks(" removed from identity.spec.ts', () => {
    const r = check(edited('tests/e2e/identity.spec.ts', 'linkTokenLeaks(', 'somethingElse('));
    expect(r.violations).toEqual([
      { file: 'tests/e2e/identity.spec.ts', line: 0, text: `${ROWS[3]!.label}: missing "linkTokenLeaks("`, rule: 'runtime proof missing' },
    ]);
  });

  it('link-token.ts missing entirely -> guard input missing, never a silent pass', () => {
    const r = check(real().filter((s) => s.path !== 'tests/e2e/helpers/link-token.ts'));
    expect(r.violations).toEqual([
      { file: 'tests/e2e/helpers/link-token.ts', line: 0, text: `${ROWS[3]!.label}: tests/e2e/helpers/link-token.ts was not scanned`, rule: 'guard input missing' },
    ]);
  });

  it('no input at all fails loudly for every row, never a silent pass', () => {
    const r = check([]);
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.violations.every((v) => v.rule === 'guard input missing')).toBe(true);
    expect(new Set(r.violations.map((v) => v.text.split(':')[0])).size).toBeGreaterThanOrEqual(1);
  });
});
