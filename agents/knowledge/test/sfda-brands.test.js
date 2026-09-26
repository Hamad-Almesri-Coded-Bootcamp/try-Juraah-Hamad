'use strict';

/**
 * Tests for scripts/build-sfda-brands.js: the pure transform functions on
 * small fixture rows, then sanity checks on the real built file,
 * data/sfda-brands.json - which must already be built (npm run build:sfda-brands
 * or `node scripts/build-sfda-brands.js`) before this suite runs, the same way
 * data/sfda-brands.json is expected to be committed alongside this test.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  computeBaseTradeName,
  ingredientSet,
  buildNamesIndex,
  buildBrandsFile,
  INPUT_PATH,
  OUTPUT_PATH
} = require('../scripts/build-sfda-brands.js');

// --------------------------------------------------------------- fixtures

test('strength removal: a plain "NUMBER UNIT" strength token is stripped', () => {
  assert.equal(computeBaseTradeName('WIDGET 500 MG TAB'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 600MG'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 1 G TABLET'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 1000 IU'), 'WIDGET');
  assert.equal(computeBaseTradeName('0.1% W/V WIDGET'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 5MG/ML SOLUTION'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 15MG-ML SOLU'), 'WIDGET');
});

test('form removal: dosage-form words are stripped, wherever they sit and whatever punctuation touches them', () => {
  assert.equal(computeBaseTradeName('WIDGET SYRUP'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET TABLETS'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET CAPSULE'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET F.C. TABLETS'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET FILM COATED TABLET'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET film-coated tablet'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET SUSPENSION*'), 'WIDGET', 'a form word followed by stray punctuation (not whitespace) is still a whole word');
  assert.equal(computeBaseTradeName('WIDGET PRE-FILLED SYRINGE'), 'WIDGET');
  // A near-miss spelling of a form word is NOT the form word and is left alone
  // (this build corrects no typos in the source data):
  assert.equal(computeBaseTradeName('WIDGET TABLETE'), 'WIDGET TABLETE');
});

test('pack-count removal: "(NUMBER PACK-WORD)" is stripped; an unrelated bracket is not', () => {
  assert.equal(computeBaseTradeName('WIDGET (30 SACHET)'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET (50 SACHETS)'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET (10 TABLETS)'), 'WIDGET');
  // A parenthetical that is not "number + pack word" is real distinguishing
  // text in the SFDA data (e.g. peritoneal-dialysis formula letters) and is
  // kept, not guessed away:
  assert.equal(computeBaseTradeName('WIDGET (F-A)'), 'WIDGET F A');
  assert.equal(computeBaseTradeName('WIDGET (9)'), 'WIDGET 9');
});

test('multi-ingredient split: scientificName commas become a sorted, deduplicated, uppercased set', () => {
  assert.deepEqual(
    ingredientSet('SODIUM CHLORIDE,POTASSIUM CHLORIDE,TRI SODIUM CITRATE,DEXTROSE'),
    ['DEXTROSE', 'POTASSIUM CHLORIDE', 'SODIUM CHLORIDE', 'TRI SODIUM CITRATE']
  );
  assert.deepEqual(ingredientSet('Aspirin, paracetamol, Caffeine'), ['ASPIRIN', 'CAFFEINE', 'PARACETAMOL']);
  assert.deepEqual(ingredientSet('Warfarin,warfarin'), ['WARFARIN'], 'a repeated ingredient in one row is deduplicated');
  assert.deepEqual(ingredientSet(''), []);
  assert.deepEqual(ingredientSet(null), []);
});

test('line extensions stay distinct: EXTRA, XR, PLUS, FORTE, NIGHT, ADVANCE, COLD & FLU, SR are kept, not stripped', () => {
  const base = computeBaseTradeName('WIDGET 500 MG TAB');
  const extensions = [
    'WIDGET EXTRA 500 MG TAB', 'WIDGET XR 500 MG TAB', 'WIDGET PLUS 500 MG TAB',
    'WIDGET FORTE 500 MG TAB', 'WIDGET NIGHT 500 MG TAB', 'WIDGET ADVANCE 500 MG TAB',
    'WIDGET COLD & FLU TAB', 'WIDGET SR 500 MG TAB'
  ];
  const got = extensions.map(computeBaseTradeName);
  assert.deepEqual(got, [
    'WIDGET EXTRA', 'WIDGET XR', 'WIDGET PLUS', 'WIDGET FORTE',
    'WIDGET NIGHT', 'WIDGET ADVANCE', 'WIDGET COLD & FLU', 'WIDGET SR'
  ]);
  // Every one of them is a different key from the bare brand and from each other.
  const allNames = new Set([base, ...got]);
  assert.equal(allNames.size, 1 + got.length, 'every extension, and the bare brand, is its own distinct name');
});

test('one base name can hold two distinct ingredient sets', () => {
  const rows = [
    { tradeName: 'COMBIWIDGET TAB', scientificName: 'PARACETAMOL', strength: '500', dosageForm: 'Tablet', regNo: 'r1', page: 1 },
    { tradeName: 'COMBIWIDGET TAB', scientificName: 'PARACETAMOL,CAFFEINE', strength: '500,30', dosageForm: 'Tablet', regNo: 'r2', page: 1 },
    { tradeName: 'COMBIWIDGET TAB', scientificName: 'CAFFEINE,PARACETAMOL', strength: '500,30', dosageForm: 'Tablet', regNo: 'r3', page: 1 }
  ];
  const names = buildNamesIndex(rows);
  assert.deepEqual(Object.keys(names), ['COMBIWIDGET']);
  assert.deepEqual(names['COMBIWIDGET'], [['PARACETAMOL'], ['CAFFEINE', 'PARACETAMOL']], 'two distinct sets, the third row a duplicate of the second (order-independent) and not repeated');
});

test('a trade name that strips to nothing keeps the plain uppercased trade name', () => {
  assert.equal(computeBaseTradeName('500 MG TAB'), '500 MG TAB');
  assert.equal(computeBaseTradeName(''), '');
  assert.equal(computeBaseTradeName(null), '');
});

test('buildBrandsFile: meta counts match the rows and names actually produced', () => {
  const rows = [
    { tradeName: 'A TAB', scientificName: 'X', strength: '1', dosageForm: 'Tablet', regNo: 'r1', page: 1 },
    { tradeName: 'B TAB', scientificName: 'Y', strength: '1', dosageForm: 'Tablet', regNo: 'r2', page: 1 }
  ];
  const out = buildBrandsFile(rows, { sha256: 'deadbeef' });
  assert.equal(out.meta.rows, 2);
  assert.equal(out.meta.names, 2);
  assert.equal(out.meta.sha256, 'deadbeef');
  assert.equal(out.meta.source, 'Saudi Food and Drug Authority public registered-drug list');
  assert.equal(out.meta.url, 'https://www.sfda.gov.sa/en/drugs-list');
  assert.equal(typeof out.meta.method, 'string');
  assert.ok(out.meta.method.length > 0 && !out.meta.method.includes('\n'), 'method is a one-line string');
});

// --------------------------------------------------------- the built file

test('sanity: data/sfda-brands.json exists and parses', () => {
  assert.ok(fs.existsSync(OUTPUT_PATH), 'run `node scripts/build-sfda-brands.js` before this suite');
});

test('sanity: meta.names equals the number of keys actually in names', () => {
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  assert.equal(built.meta.names, Object.keys(built.names).length);
});

test('sanity: meta.rows equals the rows read from the local (git-ignored) input file', (t) => {
  if (!fs.existsSync(INPUT_PATH)) {
    t.skip('data/build/sfda-rows.json is git-ignored and not present in this checkout - cannot cross-check meta.rows here');
    return;
  }
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  const rows = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  assert.equal(built.meta.rows, rows.length);
});

test('sanity: BRUFEN maps to an ibuprofen set', () => {
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  assert.ok(Object.prototype.hasOwnProperty.call(built.names, 'BRUFEN'), 'BRUFEN is absent from the built file - cannot assert what it maps to');
  assert.deepEqual(built.names.BRUFEN, [['IBUPROFEN']]);
});

test('sanity: GLUCOPHAGE maps to a metformin set', () => {
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  assert.ok(Object.prototype.hasOwnProperty.call(built.names, 'GLUCOPHAGE'), 'GLUCOPHAGE is absent from the built file - cannot assert what it maps to');
  // The SFDA register's own scientific name is "METFORMIN HYDROCHLORIDE" (the
  // salt), not the bare INN "METFORMIN" - this build does not strip salt
  // forms from ingredient names, so the real value is asserted as-is.
  assert.deepEqual(built.names.GLUCOPHAGE, [['METFORMIN HYDROCHLORIDE']]);
});

test('sanity: PANADOL EXTRA differs from PANADOL, both present with their real ingredient sets', () => {
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  assert.ok(Object.prototype.hasOwnProperty.call(built.names, 'PANADOL'), 'PANADOL is absent from the built file');
  assert.ok(Object.prototype.hasOwnProperty.call(built.names, 'PANADOL EXTRA'), 'PANADOL EXTRA is absent from the built file');
  assert.deepEqual(built.names.PANADOL, [['PARACETAMOL']]);
  assert.deepEqual(built.names['PANADOL EXTRA'], [['CAFFEINE CITRATE', 'PARACETAMOL']]);
  assert.notDeepEqual(built.names.PANADOL, built.names['PANADOL EXTRA']);
});

test('sanity: the built file is under 1.5 MB', () => {
  const bytes = fs.statSync(OUTPUT_PATH).size;
  assert.ok(bytes < 1.5 * 1024 * 1024, 'sfda-brands.json is ' + bytes + ' bytes, at or over the 1.5 MB limit');
});

test('sanity: the built file is ASCII-safe (every byte < 128)', () => {
  const buf = fs.readFileSync(OUTPUT_PATH);
  let firstBad = -1;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] >= 128) { firstBad = i; break; }
  }
  assert.equal(firstBad, -1, firstBad === -1 ? '' : ('non-ASCII byte at offset ' + firstBad));
});
