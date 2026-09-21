/**
 * Lead tooling (wave gates): merge docs/backend-notes/wp4*.md fragments into docs/BACKEND-NOTES.md.
 *
 * Each fragment structures its content as `## §N. <title>` sections; this appends every section's
 * body to the end of the main file's corresponding `## N.` section, prefixed with an attribution
 * line. Idempotent: a fragment already merged (marker `<!-- merged: <name> -->` present in the main
 * file) is skipped, so the script can run at every gate. The lead still reads every fragment —
 * this moves text, it does not review it.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const MAIN = 'docs/BACKEND-NOTES.md';
const DIR = 'docs/backend-notes';

let main = readFileSync(MAIN, 'utf8');
const fragments = readdirSync(DIR)
  .filter((f) => /^wp4[a-z]\.md$/.test(f))
  .sort();

// The main file's section boundaries: `## N. Title` for N in 1..7.
function sectionBounds(doc: string, n: number): { insertAt: number } {
  const startMatch = doc.match(new RegExp(`^## ${n}\\. .*$`, 'm'));
  if (!startMatch || startMatch.index === undefined) throw new Error(`main file lacks section ${n}`);
  const rest = doc.slice(startMatch.index + startMatch[0].length);
  const next = rest.search(/^## \d\. /m);
  const end = next === -1 ? doc.length : startMatch.index + startMatch[0].length + next;
  return { insertAt: end };
}

let merged = 0;
for (const file of fragments) {
  const name = basename(file, '.md');
  const marker = `<!-- merged: ${name} -->`;
  if (main.includes(marker)) {
    console.log(`= ${name} already merged, skipped`);
    continue;
  }
  const frag = readFileSync(join(DIR, file), 'utf8');
  // Split the fragment on its own `## §N.` headings.
  // A fragment heads its sections `## §N. Title` or `## §N — Title`; both are accepted.
  const parts = [...frag.matchAll(/^## §(\d)[.\s—-][^\n]*\n([\s\S]*?)(?=^## §\d[.\s—-]|(?![\s\S]))/gm)];
  if (parts.length === 0) {
    console.log(`! ${name} has no §-sections, skipped`);
    continue;
  }
  // Insert deepest-section-first so earlier insert offsets stay valid.
  const inserts = parts
    .map((m) => ({ n: Number(m[1]), body: (m[2] ?? '').trim() }))
    .filter((p) => p.body.length > 0)
    .sort((a, b) => b.n - a.n);
  for (const { n, body } of inserts) {
    const { insertAt } = sectionBounds(main, n);
    const block = `\n*From \`${DIR}/${file}\` (${name}, merged at its wave's gate):*\n\n${body}\n`;
    main = main.slice(0, insertAt) + block + main.slice(insertAt);
  }
  main += `\n${marker}\n`;
  merged += 1;
  console.log(`+ ${name}: merged sections ${inserts.map((i) => `§${i.n}`).reverse().join(', ')}`);
}

writeFileSync(MAIN, main);
console.log(merged === 0 ? 'nothing to merge' : `merged ${merged} fragment(s)`);
