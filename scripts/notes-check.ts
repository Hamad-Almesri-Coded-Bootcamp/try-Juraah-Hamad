/** Verification 14 — docs/BACKEND-NOTES.md has its seven sections; §1 and §5 carry a row per data function. */
import { readFileSync, existsSync } from 'node:fs';

const HEADINGS = [
  '## 1. The data-access surface',
  '## 2. Where the mock cheated',
  '## 3. Rules that are currently absences, and must become refusals',
  '## 4. Fields a screen depends on',
  '## 5. The shapes, verbatim',
  '## 6. Deferred to Phase 2 by design',
  '## 7. Things Phase 1 found out the hard way',
];
const notes = readFileSync('docs/BACKEND-NOTES.md', 'utf8');
let ok = true;
for (const h of HEADINGS) {
  const present = notes.includes(h);
  console.log(`${present ? '✓' : '✗'} ${h}`);
  ok = ok && present;
}
// The seam is declared as interfaces (DataApi, SessionApi) whose method signatures start a line: `  name(`.
function methodNames(path: string): string[] {
  const src = readFileSync(path, 'utf8');
  return [...src.matchAll(/^\s*(?:export\s+)?(?:declare\s+)?(?:async\s+)?(?:function\s+)?(\w+)\s*(?:<[^>]*>)?\s*\(/gm)]
    .map((m) => m[1]).filter((n) => n && !['if', 'for', 'while', 'switch', 'return', 'function', 'catch'].includes(n)) as string[];
}
const SURFACES = [
  { path: 'lib/data/api.ts', expected: 50 },
  { path: 'lib/session/api.ts', expected: 5 },
];
for (const { path, expected } of SURFACES) {
  if (!existsSync(path)) { console.log(`!! ${path} not present yet (WP1) — heading check only, NOT a pass for §1/§5`); continue; }
  const fns = methodNames(path);
  if (fns.length !== expected) { console.log(`✗ ${path} declares ${fns.length} functions; SCREENS.md says exactly ${expected}`); ok = false; }
  const s1 = notes.split('## 1.')[1]?.split('## 2.')[0] ?? '';
  const s5 = notes.split('## 5.')[1]?.split('## 6.')[0] ?? '';
  const missing1 = fns.filter((n) => !new RegExp(`^\\| \`?${n}\\b`, 'm').test(s1));
  const missing5 = fns.filter((n) => !new RegExp(`\\b${n}\\b`).test(s5));
  console.log(`§1 rows for ${path}: ${fns.length - missing1.length}/${fns.length}${missing1.length ? ' — missing: ' + missing1.join(', ') : ''}`);
  console.log(`§5 shapes for ${path}: ${fns.length - missing5.length}/${fns.length}${missing5.length ? ' — missing: ' + missing5.join(', ') : ''}`);
  ok = ok && missing1.length === 0 && missing5.length === 0;
}
process.exit(ok ? 0 : 1);
