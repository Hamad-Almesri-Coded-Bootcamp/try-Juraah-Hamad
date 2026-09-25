/**
 * Guard D — no drift, static half: the committed workflows regenerate byte-identically (AP-16 row 3;
 * agents/scripts/drift.js's staticDrift). The live half — does the live n8n instance match the
 * committed workflows? — has no static proxy: it stays owed to the AP-13 read-back after every
 * publish (cd agents && npm run drift -- --live <hashes.json>).
 * Runtime proof: the AP-13 read-back.
 */
import { createRequire } from 'node:module';
import type { GuardResult, Violation } from './_shared';

const require = createRequire(import.meta.url);

interface DriftModule {
  staticDrift?: (agentsRoot?: string) => { report: string[]; problems: string[] };
}

const NAME = 'guard D · no drift, static half: the committed workflows regenerate byte-identically';
const LIVE_HALF_NOTE =
  'the live half (does the live n8n instance match the committed workflows?) is owed to the AP-13 read-back: cd agents && npm run drift -- --live <hashes.json>, after every publish';

export function run(): GuardResult {
  let mod: DriftModule;
  try {
    mod = require('../../agents/scripts/drift.js') as DriftModule;
  } catch (e) {
    return {
      name: NAME,
      violations: [{ file: 'agents/scripts/drift.js', line: 0, text: `cannot load agents/scripts/drift.js: ${(e as Error).message}`, rule: 'guard input missing' }],
      notes: [],
    };
  }
  if (typeof mod.staticDrift !== 'function') {
    return {
      name: NAME,
      violations: [{ file: 'agents/scripts/drift.js', line: 0, text: 'agents/scripts/drift.js exports no staticDrift function', rule: 'guard input missing' }],
      notes: [],
    };
  }

  const { report, problems } = mod.staticDrift();
  const violations: Violation[] = problems.map((p) => ({ file: 'agents', line: 0, text: p, rule: 'no drift (static)' }));
  const notes = [
    violations.length === 0 ? `${report.length} workflow(s) regenerate byte-identically` : `${report.length} workflow(s) checked`,
    LIVE_HALF_NOTE,
  ];
  return { name: NAME, violations, notes };
}
