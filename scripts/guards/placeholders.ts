/**
 * Guard P — the three values the owner still owes (real sourceCitation, copy deck, real bot handle;
 * the demo script is the owner's own deliverable, not a code artifact, and is never counted). Counts and lists, never fails; reported at every gate.
 *  (a) every literal `[TO BE SUPPLIED]` / `= TO_BE_SUPPLIED` marker in code — a value that is missing;
 *  (b) every `placeholder: true` copy entry under i18n/copy — wording the bilingual deck has not
 *      replaced yet. Copy is marked with a flag rather than with the literal marker because a screen
 *      full of "[TO BE SUPPLIED]" cannot be reviewed for layout, direction or state; the flag keeps the
 *      count honest while the draft wording keeps the screen reviewable.
 * A value is never invented and never plausible-looking.
 */
import { walk, rel, type GuardResult } from './_shared';
import { readFileSync } from 'node:fs';

export function run(): GuardResult {
  const files = ['app', 'components', 'features', 'lib', 'i18n', 'types', 'public', 'design'].flatMap((d) => walk(d, ['.ts', '.tsx', '.js', '.json']));
  const markers: string[] = [];
  let markerCount = 0;
  let copyCount = 0;
  const copyFiles: Record<string, number> = {};
  for (const f of files) {
    const r = rel(f);
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const n = (line.match(/\[TO BE SUPPLIED\]|(?<![=!])[=:]\s*TO_BE_SUPPLIED\b/g) ?? []).length;
      if (n && !/export const TO_BE_SUPPLIED/.test(line)) { markerCount += n; markers.push(`${r}:${i + 1}  ${line.trim().slice(0, 120)}`); }
      if (r.startsWith('i18n/copy/') && /placeholder:\s*true/.test(line)) { copyCount++; copyFiles[r] = (copyFiles[r] ?? 0) + 1; }
    });
  }
  const notes = [
    `missing values marked [TO BE SUPPLIED]: ${markerCount}`,
    ...(markers.length ? markers : ['  none']),
    `copy entries awaiting the bilingual deck (placeholder: true): ${copyCount}`,
    ...Object.entries(copyFiles).map(([f, n]) => `  ${f}: ${n}`),
  ];
  return { name: `guard P \u00b7 owed values: ${markerCount} missing, ${copyCount} placeholder copy entries`, violations: [], notes };
}
