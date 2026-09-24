'use strict';

/**
 * AP-06: the ATC category scope. The WHO ATC codes of the seed ingredients (data/seed-drug-scope.json),
 * the categories the build copied into the index, and the build's cross-check of each category
 * against DDInter's own files.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { index, INDEX_JSON } = require('./helpers');
const { canonical } = require('../src/normalise');
const { categoriesOfCodes, atcProblems, seedAtcCategories, crossCheckCategories } = require('../src/atc');
const { loadedCategoriesOf, absenceIsConclusive, lookupPair } = require('../src/interactions');

const SCOPE = require(path.join(__dirname, '..', 'data', 'seed-drug-scope.json'));
const clone = (x) => JSON.parse(JSON.stringify(x));

test('the seed file\'s ATC data is well formed: level-5 codes, each with a WHO ATC/DDD index URL', () => {
  assert.deepEqual(atcProblems(SCOPE), []);
});

test('each of the nine seed ingredients carries its WHO ATC codes, and the categories they give', () => {
  const got = Object.fromEntries(SCOPE.seedIngredients.map((s) => [s.name, s.atc ? categoriesOfCodes(s.atc.codes.map((c) => c.code)) : null]));
  assert.deepEqual(got, {
    Warfarin: ['B'],                           // B01AA03
    Ibuprofen: ['C', 'G', 'M', 'R'],           // C01EB16, G02CC01, M01AE01, M02AA13, R02AX02
    Metformin: ['A'],                          // A10BA02
    Atorvastatin: ['C'],                       // C10AA05
    Prednisolone: ['A', 'C', 'D', 'H', 'R', 'S'],
    Ciprofloxacin: ['J', 'S'],                 // J01MA02, S01AE03, S02AA15, S03AA07
    Levothyroxine: ['H'],                      // H03AA01
    'Calcium carbonate': ['A'],                // A02AC01, A12AA04
    Cholecalciferol: ['A']                     // A11CC05
  });
});

test('every code that puts a seed drug in a loaded category was read on its own WHO code page', () => {
  const loaded = INDEX_JSON.meta.categoryFilesLoaded;
  let n = 0;
  for (const s of SCOPE.seedIngredients) {
    for (const c of s.atc.codes) {
      if (loaded.indexOf(c.code[0]) === -1) continue;
      n += 1;
      assert.equal(c.url, 'https://atcddd.fhi.no/atc_ddd_index/?code=' + c.code + '&showdescription=no', s.name + ' ' + c.code);
    }
  }
  assert.ok(n >= 9, 'the loaded-category codes were all checked: ' + n);
});

test('the index records the loaded DDInter category files, and each seed drug\'s categories exactly as the seed file gives them', () => {
  assert.deepEqual(INDEX_JSON.meta.categoryFilesLoaded, ['A', 'B', 'H']);
  assert.match(INDEX_JSON.meta.categoryRule, /only when at least one of its two drugs has an ATC category/);
  const atc = seedAtcCategories(SCOPE);
  for (const [k, cats] of atc) assert.deepEqual(INDEX_JSON.drugs[k].atcCategories, cats, k);
  for (const [k, d] of Object.entries(INDEX_JSON.drugs)) {
    if (!atc.has(k)) assert.equal(d.atcCategories, undefined, k + ' has categories with no source');
  }
});

test('the index cites the DDInter 2.0 paper as its publisher records it (Crossref / Europe PMC)', () => {
  assert.equal(INDEX_JSON.meta.source.citation,
    'Tian Y, Yi J, Wang N, Wu C, Peng J, Liu S, Yang G, Cao D. DDInter 2.0: an enhanced drug interaction resource with expanded data coverage, new interaction types, and improved user interface. Nucleic Acids Research 2025;53(D1):D1356-D1362. doi:10.1093/nar/gkae726.');
});

test('the rule: an absence is conclusive only when one drug is in a loaded category', () => {
  assert.deepEqual(loadedCategoriesOf('warfarin', index), ['B']);
  assert.deepEqual(loadedCategoriesOf('prednisolone', index), ['A', 'H']);
  assert.deepEqual(loadedCategoriesOf('ibuprofen', index), []);
  assert.deepEqual(loadedCategoriesOf('simvastatin', index), [], 'no ATC recorded = not loaded');
  assert.equal(absenceIsConclusive('ibuprofen', 'ciprofloxacin', index), false);
  assert.equal(absenceIsConclusive('ibuprofen', 'metformin', index), true);
  assert.equal(lookupPair('Ibuprofen', 'Ciprofloxacin', index).reason, 'pair_not_checkable');
  assert.equal(lookupPair('Atorvastatin', 'Ibuprofen', index).reason, 'pair_not_checkable');
  assert.equal(lookupPair('Levothyroxine', 'vitamin D3', index).reason, 'no_pair_in_source');
  assert.equal(lookupPair('Ibuprofen', 'Warfarin', index).found, true);
  assert.equal(lookupPair('Gliclazide', 'Warfarin', index).reason, 'drug_not_in_index');
});

test('malformed ATC data is refused, never read as "no category"', () => {
  const bad = (edit) => { const s = clone(SCOPE); edit(s.seedIngredients[0].atc); return atcProblems(s); };
  assert.match(bad((a) => { a.codes[0].code = 'B01AA3'; }).join(), /not a level-5 ATC code/);
  assert.match(bad((a) => { a.codes[0].url = 'https://example.org/'; }).join(), /no WHO ATC\/DDD index URL/);
  assert.match(bad((a) => { a.codes.push(clone(a.codes[0])); }).join(), /listed twice/);
  assert.match(bad((a) => { a.codes = []; }).join(), /atc.codes is empty/);
  assert.match(bad((a) => { a.searchUrl = 'https://example.org/'; }).join(), /searchUrl/);
  const s = clone(SCOPE); s.seedIngredients[0].atc.codes[0].code = 'X';
  assert.throws(() => seedAtcCategories(s), /ATC data is not usable/);
  const none = clone(SCOPE); delete none.seedIngredients[0].atc;
  assert.deepEqual(atcProblems(none), [], 'no atc block = unknown, allowed');
  assert.equal(seedAtcCategories(none).has(canonical('Warfarin')), false);
});

// ---------------------------------------------------------------- the build's cross-check (synthetic files)
const entries = new Map([['warfarin', { name: 'Warfarin', atc: { codes: [{ code: 'B01AA03', url: 'https://atcddd.fhi.no/atc_ddd_index/?code=B01AA03&showdescription=no' }] } }]]);
const files = (b, a, h) => ({ A: new Map([['warfarin', new Set(a)]]), B: new Map([['warfarin', new Set(b)]]), H: new Map([['warfarin', new Set(h)]]) });

test('cross-check: a category file that lists every partner seen elsewhere passes', () => {
  const r = crossCheckCategories(new Map([['warfarin', ['B']]]), files(['metformin', 'levothyroxine', 'aspirin'], ['metformin'], ['levothyroxine']), ['A', 'B', 'H'], entries);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.checks, ['warfarin in B: file B has 3 partners, including all 2 found in files A, H']);
});

test('cross-check: a partner found in another file but missing from the claimed file stops the build', () => {
  const r = crossCheckCategories(new Map([['warfarin', ['B']]]), files(['aspirin'], ['metformin'], []), ['A', 'B', 'H'], entries);
  assert.match(r.problems.join(), /file B lacks 1 of its 1 partners/);
});

test('cross-check: no row in the claimed file, or nothing to cross-check against, stops the build', () => {
  assert.match(crossCheckCategories(new Map([['warfarin', ['B']]]), files([], ['metformin'], []), ['A', 'B', 'H'], entries).problems.join(), /has no row for it/);
  assert.match(crossCheckCategories(new Map([['warfarin', ['B']]]), files(['aspirin'], [], []), ['A', 'B', 'H'], entries).problems.join(), /cannot be cross-checked/);
  const one = { B: new Map([['warfarin', new Set(['aspirin'])]]) };
  assert.match(crossCheckCategories(new Map([['warfarin', ['B']]]), one, ['B'], entries).problems.join(), /cannot be cross-checked/);
});

test('cross-check: a loaded category resting on a code not read on its own code page stops the build', () => {
  const e = new Map([['warfarin', { atc: { codes: [{ code: 'B01AA03', url: 'https://atcddd.fhi.no/atc_ddd_index/?name=warfarin' }] } }]]);
  const r = crossCheckCategories(new Map([['warfarin', ['B']]]), files(['metformin'], ['metformin'], []), ['A', 'B', 'H'], e);
  assert.match(r.problems.join(), /not read on its own WHO code page/);
});
