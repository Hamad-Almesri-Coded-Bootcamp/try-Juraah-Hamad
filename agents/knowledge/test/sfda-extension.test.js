'use strict';

/**
 * The SFDA extension (2026-09-26): scripts/build-demo-index.js maps the SFDA's top-registered oral
 * ingredients onto DDInter drug names to grow the index past its original 18-drug demo slice, and
 * scripts/build-why.js carries DDInter's own mechanism/management text for the graded pairs that
 * matter into data/interaction-why.json. Both scripts are one-shot build tools (like
 * scripts/build-demo-index.js already was), so - consistent with test/atc-scope.test.js's own
 * approach to that file - these tests check the properties of what they actually wrote:
 * data/interaction-index.json's meta.sfda fields, and data/interaction-why.json - not their
 * internals.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { INDEX_JSON } = require('./helpers');

const WHY_JSON = require(path.join(__dirname, '..', 'data', 'interaction-why.json'));

// ---------------------------------------------------------------- SFDA -> DDInter drug mapping
test('meta.sfda records the ranking source, at most 100 chosen drugs, and every one exists in the index', () => {
  const { sfda } = INDEX_JSON.meta;
  assert.ok(sfda, 'meta.sfda is missing');
  assert.ok(typeof sfda.rankingSource === 'string' && /SFDA/.test(sfda.rankingSource));
  assert.equal(sfda.target, 100);
  assert.ok(Array.isArray(sfda.chosen) && sfda.chosen.length > 0 && sfda.chosen.length <= 100);
  for (const c of sfda.chosen) {
    assert.ok(typeof c.ingredient === 'string' && c.ingredient.length > 0, 'chosen entry has the SFDA spelling that won it');
    assert.ok(typeof c.products === 'number' && c.products > 0, c.ingredient + ': products count');
    assert.ok(INDEX_JSON.drugs[c.indexKey], c.ingredient + ' -> ' + c.indexKey + ' is not a drug in the index');
  }
  // Descending by SFDA product count: the mapping keeps the ranking's own order, never re-sorts.
  for (let i = 1; i < sfda.chosen.length; i++) assert.ok(sfda.chosen[i - 1].products >= sfda.chosen[i].products, 'chosen stays in rank order');
});

test('meta.sfda.droppedNotInDdinter: every entry has a name and a count, and none of them made it into sfdaIngredientMap', () => {
  const { sfda, sfdaIngredientMap } = INDEX_JSON.meta;
  assert.ok(Array.isArray(sfda.droppedNotInDdinter));
  for (const d of sfda.droppedNotInDdinter) {
    assert.ok(typeof d.ingredient === 'string' && d.ingredient.length > 0);
    assert.ok(typeof d.products === 'number');
    assert.ok(!(d.ingredient.toUpperCase() in sfdaIngredientMap), d.ingredient + ' has no DDInter match, but is in sfdaIngredientMap');
  }
});

test('sfdaIngredientMap: every value is a drug the index actually has, every key is upper-cased, and a covered drug keeps ALL of its registered spellings - not only the one that won its slot', () => {
  const map = INDEX_JSON.meta.sfdaIngredientMap;
  assert.ok(map && Object.keys(map).length > 0);
  for (const [spelling, key] of Object.entries(map)) {
    assert.equal(spelling, spelling.toUpperCase(), spelling + ' is not upper-cased');
    assert.ok(INDEX_JSON.drugs[key], spelling + ' -> ' + key + ' is not a drug in the index');
  }
  // Same-molecule salt/hydrate spellings collapse onto ONE index key (candidateKeys' salt-stripping
  // fallback, src/normalise.js) - every registered spelling still keys onto the index, not only the
  // first one encountered in the SFDA ranking.
  assert.deepEqual(new Set(['SITAGLIPTIN PHOSPHATE', 'SITAGLIPTIN HYDROCHLORIDE', 'SITAGLIPTIN PHOSPHATE MONOHYDRATE'].map((s) => map[s])), new Set(['sitagliptin']));
  assert.deepEqual(new Set(['DICLOFENAC SODIUM', 'DICLOFENAC POTASSIUM'].map((s) => map[s])), new Set(['diclofenac']));
  assert.deepEqual(new Set(['COLECALCIFEROL', 'CHOLECALCIFEROL'].map((s) => map[s])), new Set(['cholecalciferol']));
  // A genuine INN/USAN synonym (src/normalise.js's SYNONYMS, not a salt) resolves the same way.
  assert.equal(map.PARACETAMOL, 'acetaminophen');
  assert.equal(map['METFORMIN HYDROCHLORIDE'], 'metformin');
});

test('every drug the index had before this extension is still in it (the SFDA cap only adds; PRODUCT-DECISIONS-style, an extension never drops a drug)', () => {
  // The nine seed ingredients are the part of the pre-extension index test/atc-scope.test.js already
  // pins down; this only re-asserts they are still covered after the SFDA additions.
  for (const name of ['warfarin', 'ibuprofen', 'metformin', 'atorvastatin', 'prednisolone', 'ciprofloxacin', 'levothyroxine', 'calcium carbonate', 'cholecalciferol']) {
    assert.ok(INDEX_JSON.drugs[name], name + ' is missing from the extended index');
  }
  assert.equal(INDEX_JSON.meta.categoryFilesLoaded.length, 8, 'all eight DDInter files are now loaded');
});

// ---------------------------------------------------------------- data/interaction-why.json shape
test('interaction-why.json meta: DDInter attribution, the CC BY-NC-SA 4.0 licence, and the index\'s own citation', () => {
  assert.equal(WHY_JSON.meta.source, 'DDInter 2.0');
  assert.equal(WHY_JSON.meta.url, 'https://ddinter.scbdd.com/');
  assert.equal(WHY_JSON.meta.licence, 'CC BY-NC-SA 4.0');
  assert.equal(WHY_JSON.meta.citation, INDEX_JSON.meta.source.citation, 'the same paper citation the index itself carries');
  assert.match(WHY_JSON.meta.summaries, /doctor confirms it/i, 'says a human accepts the AI draft before it is relied on (D23/D27-style)');
});

test('interaction-why.json.pairs: every pair key is a real, graded row in interaction-index.json; mechanism/management verbatim; sourceSha256 checks out; summary always null (no AI draft written yet)', () => {
  const keys = Object.keys(WHY_JSON.pairs);
  assert.ok(keys.length > 0);
  for (const key of keys) {
    const w = WHY_JSON.pairs[key];
    const row = INDEX_JSON.pairs[key];
    assert.ok(row, key + ' is not a pair in interaction-index.json');
    assert.equal(w.level, row.level, key + ': interaction-why.json must carry the INDEX\'s level, not its own snapshot');
    assert.ok(['Major', 'Moderate', 'Minor'].includes(w.level), key + ': ' + w.level + ' is not a graded level - an Unknown/ungraded pair has no place here');
    assert.ok(typeof w.url === 'string' && w.url.startsWith('https://ddinter.scbdd.com/'));
    assert.ok(typeof w.mechanism === 'string' && w.mechanism.trim().length > 0, key + ': empty mechanism should have been left out, not written');
    assert.ok(typeof w.management === 'string' && w.management.trim().length > 0, key + ': empty management should have been left out, not written');
    assert.equal(w.summary, null, key + ': summary must stay null until a doctor-confirmed AI draft exists');
    assert.equal(w.sourceSha256, crypto.createHash('sha256').update(w.mechanism + '\n' + w.management).digest('hex'), key + ': sourceSha256 does not match its own mechanism+management');
  }
});

test('interaction-why.json keeps every existing (pre-extension) graded pair it has text for - ibuprofen x warfarin (Major) is still in it', () => {
  assert.ok(WHY_JSON.pairs['ibuprofen|warfarin'], 'the demo\'s own headline Major pair should have DDInter\'s "why" text');
  assert.equal(WHY_JSON.pairs['ibuprofen|warfarin'].level, 'Major');
});
