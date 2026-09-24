// @vitest-environment node
/**
 * AP-10 — guard R (scripts/guards/screening-on-every-path.ts) and its red proof. The guard runs on
 * the real tree (green), then on DELIBERATELY EDITED COPIES of the real files (red): the screening
 * call removed from a trigger, moved inside the transaction, a new unscreened write added, and the
 * write hidden from the detector. A guard that cannot go red proves nothing.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check, KNOWN_TRIGGERS, run, type Source } from '../../../scripts/guards/screening-on-every-path';

const REAL = ['lib/data/pg/reads-rx.ts', 'lib/data/pg/agent.ts', 'lib/data/pg/writes.ts', 'lib/data/pg/screening.ts', 'lib/engine/sql.ts', 'lib/engine/doses.ts'];
const real = (): Source[] => REAL.map((path) => ({ path, text: readFileSync(path, 'utf8') }));
/** A copy of the real sources with one file's text edited; every edit must actually change it. */
function edited(path: string, ...edits: [from: string | RegExp, to: string][]): Source[] {
  return real().map((s) => {
    if (s.path !== path) return s;
    let text = s.text;
    for (const [from, to] of edits) {
      const next = text.replace(from, to);
      expect(next, `the edit ${String(from)} to ${path} did not apply`).not.toBe(text);
      text = next;
    }
    return { path, text };
  });
}
const rules = (r: ReturnType<typeof check>) => r.violations.map((v) => `${v.rule}: ${v.text}`);

describe('guard R on the real tree', () => {
  it('passes, and sees exactly the four write paths known today, each screening', () => {
    const r = run();
    expect(r.violations).toEqual([]);
    const full = check(real());
    expect(full.units.map((u) => `${u.file}#${u.name}`).sort()).toEqual([...KNOWN_TRIGGERS].sort());
    expect(full.units.every((u) => u.screens)).toBe(true);
    expect(full.units.find((u) => u.name === 'requestRefill')!.kinds).toEqual(['requests a refill (D10)']);
    expect(full.units.find((u) => u.name === 'confirmPrescriptionFields')!.kinds).toEqual(['confirms a prescription']);
  });
  it('the discontinuation update (lib/engine) and the return to clinic are not triggers', () => {
    const names = check(real()).units.map((u) => u.name);
    expect(names).not.toContain('applyDiscontinuation');
    expect(names).not.toContain('returnPrescriptionToClinic');
  });
});

describe('guard R goes red on a deliberately edited copy', () => {
  it('the screening call removed from requestRefill (D10)', () => {
    const r = check(edited('lib/data/pg/writes.ts', ['if (refilled) await screenOrHold(patientId, refilled);', 'void refilled;']));
    expect(rules(r)).toEqual(['screening on every path: requestRefill requests a refill (D10) and never calls screenOrHold/requestScreening after its commit']);
  });
  it('the screening call removed from savePrescriptionDraft', () => {
    const r = check(edited('lib/data/pg/reads-rx.ts', ['await screenOrHold(patientId, saved, language);', 'void language;']));
    expect(rules(r)).toEqual(['screening on every path: savePrescriptionDraft creates a prescription and never calls screenOrHold/requestScreening after its commit']);
  });
  it('the screening call removed from the agent route\'s insert', () => {
    const r = check(edited('lib/data/pg/agent.ts', ['const screening = await screenOrHold(saved.prescription.patientId, saved.prescription);', "const screening = 'skipped' as const;"]));
    expect(rules(r)).toEqual(['screening on every path: insertExtractedPrescription creates a prescription and never calls screenOrHold/requestScreening after its commit']);
  });
  it('TC-IX-06: the screening call removed from the reviewer\'s confirmation', () => {
    const r = check(edited('lib/data/pg/writes.ts', ['await screenOrHold(saved.patientId, saved);', 'void saved;']));
    expect(rules(r)).toEqual(['screening on every path: confirmPrescriptionFields confirms a prescription and never calls screenOrHold/requestScreening after its commit']);
  });
  it('the screening call moved INSIDE the transaction (before the commit the agent must read back)', () => {
    const r = check(edited(
      'lib/data/pg/writes.ts',
      ['await screenOrHold(saved.patientId, saved);', 'void saved;'],
      [/( *)return confirmed;(\r?\n)/, '$1await screenOrHold(before.patientId, confirmed);$2$1return confirmed;$2'],
    ));
    expect(rules(r)).toEqual([
      'screening on every path: confirmPrescriptionFields confirms a prescription and never calls screenOrHold/requestScreening after its commit',
      'screening after commit: confirmPrescriptionFields calls screening inside its transaction, before the commit the agent must read back',
    ]);
  });
  // The two fixtures below are TEXT handed to the detector, never run. They call their statement
  // through a `run` parameter because a test file may not hold a SQL call itself (guard 8).
  it('a NEW write path with no screening (an import from another clinic, say) is caught: an inline statement', () => {
    const extra: Source = {
      path: 'lib/data/pg/imports.ts',
      text: "export async function importPrescription(run: (q: string) => Promise<unknown>) {\n  await run(`insert into prescriptions (id) values ('rx_x')`);\n}\n",
    };
    expect(rules(check([...real(), extra]))).toEqual(['screening on every path: importPrescription creates a prescription and never calls screenOrHold/requestScreening after its commit']);
  });
  it('a NEW write path with no screening is caught: a query constant from another file (the codebase\'s own pattern)', () => {
    const extra: Source = {
      path: 'lib/data/pg/imports.ts',
      text: "import { PG_QUERIES_AGENT } from './agent';\nexport const importPrescription = async (run: (q: string) => Promise<unknown>) => {\n  await run(PG_QUERIES_AGENT.insertPrescription);\n};\n",
    };
    expect(rules(check([...real(), extra]))).toEqual(['screening on every path: importPrescription creates a prescription and never calls screenOrHold/requestScreening after its commit']);
  });
  it('a write hidden from the detector fails LOUDLY (input missing), never silently green', () => {
    const r = check(edited('lib/data/pg/writes.ts', [/insert into refill_requests/g, 'insert into refill_requests_renamed']));
    expect(rules(r)).toEqual([
      'guard input missing: no function found that requests a refill (D10)',
      'guard input missing: requestRefill is no longer recognised as a prescription write (moved, renamed, or hidden from the detector)',
    ]);
  });
  it('no input at all fails loudly', () => {
    const r = check([]);
    expect(r.violations.length).toBe(3 + KNOWN_TRIGGERS.length);
    expect(r.violations.every((v) => v.rule === 'guard input missing')).toBe(true);
  });
});
