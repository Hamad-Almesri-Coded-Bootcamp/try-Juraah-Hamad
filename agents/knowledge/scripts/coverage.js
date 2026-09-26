'use strict';

/**
 * What can data/interaction-index.json check for the seed? Prints, never edits.
 *
 *   1. each seed ingredient (data/seed-drug-scope.json): covered (its DDInter id), or absent with
 *      the reason; its WHO ATC top-level categories and whether any of their files is loaded;
 *   2. each seed pair - every ingredient of one prescription against every ingredient of another
 *      prescription of the same patient (test/seed-prescriptions.json, the seed copy) - as
 *      checkable (a DDInter row, or no row with one drug in a loaded category file) or
 *      CANNOT VERIFY, with the reason; and whether screening runs on it today.
 *
 * Exit 1 only when the inputs cannot be trusted: the index does not record its loaded category
 * files, the seed file's ATC data is malformed, or the index's categories differ from the seed
 * file's (the index was not rebuilt). An uncovered or uncheckable drug is not an error - screening
 * says "cannot verify" for it - and is listed.
 */
const path = require('node:path');
const { loadIndex, isCovered, categoryFilesLoaded, loadedCategoriesOf, lookupPair } = require('../src/interactions');
const { ingredientParts, canonical } = require('../src/normalise');
const { seedAtcCategories, atcProblems } = require('../src/atc');
const { exclusionReason } = require('../src/screening');

const indexJson = require(path.join(__dirname, '..', 'data', 'interaction-index.json'));
const index = loadIndex(indexJson);
const scope = require(path.join(__dirname, '..', 'data', 'seed-drug-scope.json'));
const seed = require(path.join(__dirname, '..', 'test', 'seed-prescriptions.json'));

const problems = [];
const loaded = categoryFilesLoaded(index);
if (loaded.length === 0) problems.push('the index records no loaded DDInter category files (meta.categoryFilesLoaded) - rebuild it with scripts/build-demo-index.js; until then every absent pair is "cannot verify"');
problems.push(...atcProblems(scope));
const atc = problems.length ? new Map() : seedAtcCategories(scope);
// SFDA extension (2026-09-26): scripts/build-demo-index.js now fails closed PER CODE, not only per
// build - a seed drug's code that sits in a loaded category but was never individually confirmed on
// its own WHO page (meta.categoryClaimsSkipped) is left out of what gets written, same as if that
// category were never loaded for it at all. So the index's stored categories are the seed file's own
// minus any skipped ones, not a byte-for-byte copy of the seed file (which would defeat the point of
// the skip).
const skipped = new Set((index.meta && index.meta.categoryClaimsSkipped) || []);
for (const [k, cats] of atc) {
  const d = index.drugs.get(k);
  const expected = cats.filter((c) => !skipped.has(k + ':' + c));
  if (d && JSON.stringify(d.atcCategories || null) !== JSON.stringify(expected.length ? expected : null)) {
    problems.push(k + ': the index has ATC categories ' + JSON.stringify(d.atcCategories || null) + ', data/seed-drug-scope.json minus any skipped claim gives ' + JSON.stringify(expected) + ' - rebuild the index');
  }
}
if (atc.size) {
  for (const [k, d] of index.drugs) {
    if (d.atcCategories !== undefined && !atc.has(k)) problems.push(k + ': the index has ATC categories with no source in data/seed-drug-scope.json - rebuild the index');
  }
}

const notFound = new Set((index.meta.drugsNotFoundInSource || []).map((x) => canonical(x)));
const label = (k) => (index.drugs.get(k) ? index.drugs.get(k).label : k);
const catText = (k) => {
  const d = index.drugs.get(k);
  if (!d || !Array.isArray(d.atcCategories) || d.atcCategories.length === 0) return 'ATC unknown (treated as not loaded)';
  const l = loadedCategoriesOf(k, index);
  return 'ATC ' + d.atcCategories.join(', ') + (l.length ? ' - file ' + l.join(', ') + ' loaded' : ' - none loaded');
};

console.log('index: ' + (index.meta.source && index.meta.source.name) + ', built ' + index.meta.builtAt + ', ' + index.drugs.size + ' drugs, ' + index.pairs.size + ' pairs');
console.log('DDInter category files loaded: ' + (loaded.length ? loaded.join(', ') : 'NONE RECORDED'));

console.log('\nseed ingredients (data/seed-drug-scope.json)');
for (const s of scope.seedIngredients) {
  const k = isCovered(s.name, index);
  const name = s.name.padEnd(18);
  if (k) {
    const d = index.drugs.get(k);
    console.log('  covered      ' + name + d.ddinterId.padEnd(12) + catText(k));
  } else {
    const why = notFound.has(canonical(s.name))
      ? 'absent from DDInter files ' + loaded.join(', ') + ' (build: in scope, no row names it)'
      : 'absent from the index - rebuild it with scripts/build-demo-index.js';
    console.log('  NOT COVERED  ' + name + why);
  }
}

console.log('\nseed pairs (each ingredient of one prescription against each ingredient of another, same patient)');
const counts = { checkable: 0, cannot: 0 };
const patients = [...new Set(seed.map((p) => p.patientId))];
for (const pid of patients) {
  const rx = seed.filter((p) => p.patientId === pid);
  for (let i = 0; i < rx.length; i++) {
    for (let j = i + 1; j < rx.length; j++) {
      const p = rx[i];
      const q = rx[j];
      const off = [p, q].map((x) => [x.id, exclusionReason(x)]).filter(([, why]) => why);
      const screened = off.length === 0 ? 'screened today' : 'not screened today: ' + off.map(([id, why]) => id + ' ' + why).join(', ');
      for (const a of ingredientParts(p.drug.genericName)) {
        for (const b of ingredientParts(q.drug.genericName)) {
          const res = lookupPair(a.key, b.key, index);
          let verdict;
          let why;
          if (res.found) {
            verdict = 'checkable';
            why = 'DDInter row, level "' + res.level + '" (' + res.drugA.ddinterId + ' x ' + res.drugB.ddinterId + ')' +
              (res.unclassified ? ': ungraded, sent to the reviewer (G8)' : ': ' + res.severity);
          } else if (res.reason === 'no_pair_in_source') {
            verdict = 'checkable';
            const via = [res.keyA, res.keyB].filter((k) => loadedCategoriesOf(k, index).length).map((k) => label(k) + ' (' + loadedCategoriesOf(k, index).join(', ') + ')');
            why = 'no DDInter row, and the category file' + (via.length > 1 ? 's' : '') + ' of ' + via.join(' and ') + (via.length > 1 ? ' are' : ' is') + ' loaded: no interaction recorded';
          } else if (res.reason === 'pair_not_checkable') {
            verdict = 'CANNOT VERIFY';
            why = 'no row, and neither drug is in a loaded category file: ' + label(res.keyA) + ' ' + catText(res.keyA) + '; ' + label(res.keyB) + ' ' + catText(res.keyB);
          } else if (res.reason === 'same_ingredient') {
            verdict = 'checkable';
            why = 'the same ingredient twice: a duplicate-therapy warning';
          } else {
            verdict = 'CANNOT VERIFY';
            why = 'not in the index: ' + [a, b].filter((x) => !isCovered(x.key, index)).map((x) => x.text).join(', ');
          }
          counts[verdict === 'checkable' ? 'checkable' : 'cannot'] += 1;
          console.log('  ' + verdict.padEnd(14) + pid + '  ' + (p.id + ' x ' + q.id).padEnd(17) + (a.text + ' x ' + b.text).padEnd(42) + why + '  [' + screened + ']');
        }
      }
    }
  }
}
console.log('\n' + counts.checkable + ' seed pairs checkable, ' + counts.cannot + ' cannot verify');

if (problems.length) {
  console.log('\nINPUT PROBLEMS:');
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
