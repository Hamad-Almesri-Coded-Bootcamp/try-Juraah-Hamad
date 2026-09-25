/**
 * Guard A — AP-16: every static guard is in place and names its runtime proof. A table of five rows
 * (the AP-16 plan table, docs/AGENTS-POLISH-PLAN.md §7.3), each anchored on literal text that must be
 * on origin/main or written by this package — never on AP-04's oneScreeningCheck, which lands later.
 * A row with a missing file fails loudly ("guard input missing"); a row whose file exists but has
 * lost an anchor fails naming exactly which text is gone. check(sources) is pure (the test feeds it
 * deliberately edited copies); run() reads the real files.
 */
import { readFileSync } from 'node:fs';
import type { GuardResult, Violation } from './_shared';

export interface Source { path: string; text: string }
export interface Anchor { file: string; text: string }
export interface Row { label: string; anchors: Anchor[] }

export const ROWS: Row[] = [
  {
    label: 'No voice dose write (agents/scripts/check.js, run by cd agents && npm run check; runtime proof J12)',
    anchors: [
      { file: 'agents/scripts/check.js', text: 'async function assertVoiceCallsReadOnly(wf)' },
      { file: 'agents/scripts/check.js', text: 'await assertVoiceCallsReadOnly(wf);' },
      { file: 'agents/scripts/check.js', text: 'assert.rejects(assertVoiceCallsReadOnly(copy)' },
      { file: 'agents/scripts/check.js', text: 'Runtime proof: J12' },
    ],
  },
  {
    label: 'Screening on every path (guard R; J8, J13)',
    anchors: [
      { file: 'scripts/guards/screening-on-every-path.ts', text: 'Runtime proof: J8, J13' },
      { file: 'scripts/guards/run.ts', text: "from './screening-on-every-path'" },
    ],
  },
  {
    label: 'No drift (guard D and cd agents && npm run drift:static; the AP-13 read-back)',
    anchors: [
      { file: 'agents/scripts/drift.js', text: 'function staticDrift(' },
      { file: 'agents/scripts/drift.js', text: 'Runtime proof: the AP-13 read-back' },
      { file: 'agents/package.json', text: '"drift:static"' },
      { file: 'scripts/guards/no-drift.ts', text: 'Runtime proof: the AP-13 read-back' },
      { file: 'scripts/guards/run.ts', text: "from './no-drift'" },
    ],
  },
  {
    label: 'No token on a screen (tests/e2e/helpers/link-token.ts; J1)',
    anchors: [
      { file: 'tests/e2e/helpers/link-token.ts', text: 'export function linkTokenLeaks(' },
      { file: 'tests/e2e/helpers/link-token.ts', text: 'Runtime proof: J1' },
      { file: 'tests/e2e/ambient.spec.ts', text: 'linkTokenLeaks(' },
      { file: 'tests/e2e/caregiving.spec.ts', text: 'linkTokenLeaks(' },
      { file: 'tests/e2e/identity.spec.ts', text: 'linkTokenLeaks(' },
    ],
  },
  {
    label: 'Guard P (printed at every gate)',
    anchors: [
      { file: 'scripts/guards/placeholders.ts', text: "['agents']" },
      { file: 'scripts/guards/placeholders.ts', text: 'printed at every gate' },
      { file: 'scripts/guards/run.ts', text: "from './placeholders'" },
    ],
  },
];

/** The pure check, over any set of sources (the test feeds it deliberately edited copies). */
export function check(sources: Source[]): GuardResult {
  const byPath = new Map(sources.map((s) => [s.path, s.text]));
  const violations: Violation[] = [];
  const notes: string[] = [];
  for (const row of ROWS) {
    const files = [...new Set(row.anchors.map((a) => a.file))];
    const missingFiles = files.filter((f) => !byPath.has(f));
    if (missingFiles.length) {
      for (const f of missingFiles) violations.push({ file: f, line: 0, text: `${row.label}: ${f} was not scanned`, rule: 'guard input missing' });
      notes.push(`✗ ${row.label} — guard input missing (${missingFiles.join(', ')})`);
      continue;
    }
    const missingAnchors = row.anchors.filter((a) => !(byPath.get(a.file) ?? '').includes(a.text));
    if (missingAnchors.length) {
      for (const a of missingAnchors) violations.push({ file: a.file, line: 0, text: `${row.label}: missing "${a.text}"`, rule: 'runtime proof missing' });
      notes.push(`✗ ${row.label}`);
    } else {
      notes.push(`✓ ${row.label}`);
    }
  }
  return { name: 'guard A · AP-16: every static guard is in place and names its runtime proof', violations, notes };
}

export function run(): GuardResult {
  const files = [...new Set(ROWS.flatMap((r) => r.anchors.map((a) => a.file)))];
  const sources: Source[] = [];
  for (const f of files) {
    try {
      sources.push({ path: f, text: readFileSync(f, 'utf8') });
    } catch {
      // left out of `sources`; check() reports this file's row(s) as "guard input missing".
    }
  }
  return check(sources);
}
