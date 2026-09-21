/** Guard 3 — the seam: no component imports mock data, no component contains a fetch. */
import { walk, scan, rel, type GuardResult, UI_DIRS } from './_shared';

export function run(): GuardResult {
  const all = walk('.', ['.ts', '.tsx']).filter((f) => !rel(f).startsWith('scripts/'));
  // lib/session implements signIn against the same store (D-002): part of the seam, not a consumer of it.
  const outsideDataLayer = all.filter((f) => !rel(f).startsWith('lib/data/') && !rel(f).startsWith('lib/session/') && !rel(f).startsWith('tests/'));
  const ui = UI_DIRS.flatMap((d) => walk(d, ['.ts', '.tsx']));
  const v = [
    ...scan(outsideDataLayer, 'mock import outside lib/data', /from\s+['"](@\/)?lib\/data\/mock|from\s+['"]\.\.?\/.*mock(\/|['"])/),
    ...scan(ui, 'fetch in a component', /\bfetch\s*\(/),
    ...scan(ui, 'seed import in a component', /from\s+['"](@\/)?lib\/data\/mock/),
  ];
  return { name: 'guard 3 · seam: no mock import outside lib/data, no fetch in ui code', violations: v };
}
