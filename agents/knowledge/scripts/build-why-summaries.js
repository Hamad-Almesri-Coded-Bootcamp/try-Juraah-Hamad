'use strict';

/**
 * Merge data/build/why-summaries-*.json (git-ignored; each an AI-drafted batch of {en, ar}
 * summaries of the mechanism/management text in data/interaction-why.json - one file per
 * generation run, "Batch N of ...") onto data/interaction-why.json's own pairs[key].summary.
 *
 * A pair with no summary in any batch file keeps summary: null (build-why.js's own default) -
 * never invented. Every summary this script merges in is still an unverified AI draft (D23/D27
 * -style human-in-the-loop, same as every other agent-drafted clinical value in this project): a
 * doctor confirms it before it is relied on. This script never writes, edits or judges summary
 * TEXT - drafting and reviewing the words is a separate, human-reviewed step; this only merges
 * already-drafted batches onto their pair and checks their shape (both languages present, no pair
 * summarised twice by different batches).
 *
 *   node scripts/build-why-summaries.js             write data/interaction-why.json
 *   node scripts/build-why-summaries.js --dry-run   print what would change, write nothing
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WHY = path.join(ROOT, 'data', 'interaction-why.json');
const BUILD = path.join(ROOT, 'data', 'build');

function main() {
  const dry = process.argv.includes('--dry-run');
  if (!fs.existsSync(WHY)) throw new Error('no data/interaction-why.json - run scripts/build-why.js first');
  const why = JSON.parse(fs.readFileSync(WHY, 'utf8'));

  const files = fs.existsSync(BUILD)
    ? fs.readdirSync(BUILD)
        .filter((f) => /^why-summaries-\d+\.json$/.test(f))
        .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]))
    : [];
  if (files.length === 0) throw new Error('no data/build/why-summaries-*.json to merge (git-ignored AI-draft batches - copy them in before running this)');

  const summaries = new Map();   // pairKey -> { en, ar, file }
  const malformed = [];
  const duplicates = [];
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(BUILD, f), 'utf8'));
    for (const [key, entry] of Object.entries(raw)) {
      if (key === 'meta') continue;
      const en = entry && typeof entry.en === 'string' ? entry.en.trim() : '';
      const ar = entry && typeof entry.ar === 'string' ? entry.ar.trim() : '';
      if (!en || !ar) { malformed.push(f + ': ' + key); continue; }
      if (summaries.has(key)) { duplicates.push(key + ' (' + summaries.get(key).file + ' and ' + f + ')'); continue; }
      summaries.set(key, { en, ar, file: f });
    }
  }
  // Fail closed: a malformed draft or a pair summarised twice by different batches is a data
  // problem in the git-ignored input, not something this script guesses its way past.
  if (malformed.length) throw new Error('malformed summary entries (missing/empty en or ar) - nothing written:\n  ' + malformed.join('\n  '));
  if (duplicates.length) throw new Error('the same pair has a summary in more than one batch file - nothing written:\n  ' + duplicates.join('\n  '));

  let applied = 0;
  const orphans = [];
  for (const [key, s] of summaries) {
    if (!why.pairs[key]) { orphans.push(key + ' (' + s.file + ')'); continue; }
    why.pairs[key].summary = { en: s.en, ar: s.ar };
    applied += 1;
  }

  const stillNull = Object.keys(why.pairs).filter((k) => why.pairs[k].summary === null);
  console.log('summary batch files: ' + files.join(', '));
  console.log('summary entries read: ' + summaries.size + ', applied: ' + applied + ', orphaned (no matching pair in interaction-why.json): ' + orphans.length);
  for (const o of orphans) console.log('  orphan (not written; pair no longer in scope): ' + o);
  console.log('pairs still summary: null (no draft yet): ' + stillNull.length + ' of ' + Object.keys(why.pairs).length);

  if (!dry) fs.writeFileSync(WHY, JSON.stringify(why, null, 2) + '\n');
  console.log(dry ? '(dry run - nothing written)' : 'wrote data/interaction-why.json');
}

main();
