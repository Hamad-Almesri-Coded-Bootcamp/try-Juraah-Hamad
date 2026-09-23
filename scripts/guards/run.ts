import { report } from './_shared';
import * as g2 from './no-raw-values';
import * as g3 from './seam';
import * as g4 from './no-dose-write';
import * as g5 from './logical-only';
import * as g6 from './no-clock';
import * as g7 from './no-literal-copy';
import * as gu from './no-unit-conversion';
import * as gp from './placeholders';
import * as g8 from './sql-only-in-db';
import * as g9 from './no-secrets';
import { existsSync } from 'node:fs';

async function main() {
  const guards = [g2, g3, g4, g5, g6, g7, g8, g9, gu, gp];
  let ok = true;
  console.log('Jur\u2019ah repository guards');
  for (const g of guards) ok = report(g.run()) && ok;
  const seedGuard = './seed-invariants.ts';
  if (existsSync('scripts/guards/seed-invariants.ts')) {
    // Added by WP1 once the seed exists (Gate 0 decision 1).
    const gs = (await import(seedGuard)) as { run: () => ReturnType<typeof g2.run> };
    ok = report(gs.run()) && ok;
  } else {
    console.log('\u00b7 guard S \u00b7 seed invariants \u2014 not yet present (WP1 adds it)');
  }
  if (!ok) { console.error('\nGuards failed.'); process.exit(1); }
  console.log('\nAll guards passed.');
}
main();
