'use strict';

/**
 * Merge data/build/why-summaries-*.json (git-ignored; each an AI-drafted batch of {en, ar,
 * sourceSha256} summaries of the mechanism/management text in data/interaction-why.json - one file
 * per generation run, "Batch N of ...") onto data/interaction-why.json's own pairs[key].summary.
 *
 * A pair with no summary in any batch file keeps summary: null (build-why.js's own default) -
 * never invented. Every summary this script merges in is still an unverified AI draft (D23/D27
 * -style human-in-the-loop, same as every other agent-drafted clinical value in this project): a
 * doctor confirms it before it is relied on. This script never writes, edits or judges summary
 * TEXT - drafting and reviewing the words is a separate, human-reviewed step; this only merges
 * already-drafted batches onto their pair and checks their shape (both languages present, no pair
 * summarised twice by different batches).
 *
 * Reviewer finding (2026-09-26, "fix-data"): a summary is drafted against the mechanism/management
 * TEXT beside it, not against the pair key alone - build-why.js recomputes sourceSha256 (a hash of
 * that exact text) on every rebuild, so if DDInter's own page changes, a rebuild gives the pair a
 * NEW sourceSha256 while an OLD batch file still carries the stale draft. Every batch entry now
 * carries the sourceSha256 it was drafted against; a batch entry whose hash is missing or does not
 * match the pair's CURRENT sourceSha256 is refused (summary set to null, logged), never silently
 * applied - fail closed, same as every other agent-drafted clinical value in this project, because
 * an AI paraphrase of text that has since changed is worse than no summary at all.
 *
 *   node scripts/build-why-summaries.js             write data/interaction-why.json
 *   node scripts/build-why-summaries.js --dry-run   print what would change, write nothing
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WHY = path.join(ROOT, 'data', 'interaction-why.json');
const BUILD = path.join(ROOT, 'data', 'build');

/** Batch file names in this directory listing, oldest ("why-summaries-1.json") first. Pure given a
 *  directory listing - never reads the filesystem itself, so a test can hand it a fake list. */
function batchFileNames(dirEntries) {
  return (dirEntries || [])
    .filter((f) => /^why-summaries-\d+\.json$/.test(f))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));
}

/**
 * Collect every batch's {en, ar, sourceSha256} entries into one pairKey -> {en, ar, sourceSha256,
 * file} map, failing closed (via the returned `malformed`/`duplicates` lists, never a thrown error -
 * main() decides what to do with them) on a missing/empty en or ar, or a pair summarised twice by
 * different batches - a data problem in the git-ignored input, never guessed past. `sourceSha256`
 * absent from an entry is kept as `null` here (not a malformed entry on its own - a missing hash is
 * a REFUSAL case in applySummaries, handled there so every "why was this refused" reason lives in
 * one place). `batches`: [{ file, raw }], raw already JSON.parsed. Pure: no I/O.
 */
function collectBatchSummaries(batches) {
  const summaries = new Map();
  const malformed = [];
  const duplicates = [];
  for (const { file, raw } of batches) {
    for (const [key, entry] of Object.entries(raw)) {
      if (key === 'meta') continue;
      const en = entry && typeof entry.en === 'string' ? entry.en.trim() : '';
      const ar = entry && typeof entry.ar === 'string' ? entry.ar.trim() : '';
      if (!en || !ar) { malformed.push(file + ': ' + key); continue; }
      if (summaries.has(key)) { duplicates.push(key + ' (' + summaries.get(key).file + ' and ' + file + ')'); continue; }
      const sourceSha256 = entry && typeof entry.sourceSha256 === 'string' && entry.sourceSha256 ? entry.sourceSha256 : null;
      summaries.set(key, { en, ar, sourceSha256, file });
    }
  }
  return { summaries, malformed, duplicates };
}

/**
 * Apply collected batch summaries onto `why.pairs` in place. A pair whose batch entry has no
 * sourceSha256, or one that does not match why.pairs[key].sourceSha256 (the hash of THAT pair's
 * current mechanism+management, stamped by build-why.js), is refused: its summary is set to null
 * and the refusal is logged in `hashMismatches`, never silently applied. Mutates and returns `why`;
 * does no I/O itself. Pure given already-parsed `why` and a `summaries` map (e.g. collectBatchSummaries's).
 */
function applySummaries(why, summaries) {
  let applied = 0;
  const orphans = [];
  const hashMismatches = [];
  for (const [key, s] of summaries) {
    const pair = why.pairs[key];
    if (!pair) { orphans.push(key + ' (' + s.file + ')'); continue; }
    if (!s.sourceSha256 || s.sourceSha256 !== pair.sourceSha256) {
      hashMismatches.push(key + ' (' + s.file + '): batch sourceSha256 ' + (s.sourceSha256 || 'MISSING') + ', pair is now ' + pair.sourceSha256);
      pair.summary = null;
      continue;
    }
    pair.summary = { en: s.en, ar: s.ar };
    applied += 1;
  }
  return { why, applied, orphans, hashMismatches };
}

function main() {
  const dry = process.argv.includes('--dry-run');
  if (!fs.existsSync(WHY)) throw new Error('no data/interaction-why.json - run scripts/build-why.js first');
  const why = JSON.parse(fs.readFileSync(WHY, 'utf8'));

  const files = fs.existsSync(BUILD) ? batchFileNames(fs.readdirSync(BUILD)) : [];
  if (files.length === 0) throw new Error('no data/build/why-summaries-*.json to merge (git-ignored AI-draft batches - copy them in before running this)');

  const batches = files.map((f) => ({ file: f, raw: JSON.parse(fs.readFileSync(path.join(BUILD, f), 'utf8')) }));
  const { summaries, malformed, duplicates } = collectBatchSummaries(batches);
  // Fail closed: a malformed draft or a pair summarised twice by different batches is a data
  // problem in the git-ignored input, not something this script guesses its way past.
  if (malformed.length) throw new Error('malformed summary entries (missing/empty en or ar) - nothing written:\n  ' + malformed.join('\n  '));
  if (duplicates.length) throw new Error('the same pair has a summary in more than one batch file - nothing written:\n  ' + duplicates.join('\n  '));

  const { applied, orphans, hashMismatches } = applySummaries(why, summaries);

  const stillNull = Object.keys(why.pairs).filter((k) => why.pairs[k].summary === null);
  console.log('summary batch files: ' + files.join(', '));
  console.log('summary entries read: ' + summaries.size + ', applied: ' + applied +
    ', orphaned (no matching pair in interaction-why.json): ' + orphans.length +
    ', refused (sourceSha256 missing or stale): ' + hashMismatches.length);
  for (const o of orphans) console.log('  orphan (not written; pair no longer in scope): ' + o);
  for (const m of hashMismatches) console.log('  refused, summary set to null: ' + m);
  console.log('pairs still summary: null (no draft yet, or refused above): ' + stillNull.length + ' of ' + Object.keys(why.pairs).length);

  if (!dry) fs.writeFileSync(WHY, JSON.stringify(why, null, 2) + '\n');
  console.log(dry ? '(dry run - nothing written)' : 'wrote data/interaction-why.json');
}

if (require.main === module) main();

module.exports = { batchFileNames, collectBatchSummaries, applySummaries, WHY, BUILD };
