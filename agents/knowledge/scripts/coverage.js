'use strict';

/**
 * Which seed ingredients does data/interaction-index.json cover? Run after you replace the index with
 * one rebuilt from DDInter (see data/seed-drug-scope.json). Prints, never edits. Exit 0 always: an
 * uncovered drug is not an error - screening says "cannot verify" for it - but it is worth knowing.
 */
const path = require('node:path');
const { loadIndex, isCovered } = require('../src/interactions');
const { ingredientParts } = require('../src/normalise');

const index = loadIndex(require(path.join(__dirname, '..', 'data', 'interaction-index.json')));
const seed = require(path.join(__dirname, '..', 'test', 'seed-prescriptions.json'));

console.log('index: ' + (index.meta.source && index.meta.source.name) + ', built ' + index.meta.builtAt + ', ' + index.drugs.size + ' drugs, ' + index.pairs.size + ' pairs\n');
for (const p of seed) {
  for (const part of ingredientParts(p.drug.genericName)) {
    const k = isCovered(part.key, index);
    console.log((k ? '  covered      ' : '  NOT COVERED  ') + p.id.padEnd(8) + part.text + (k ? '  -> ' + k : ''));
  }
}
