'use strict';

/**
 * The SFDA extension (2026-09-26): scripts/build-demo-index.js maps the SFDA's top-registered oral
 * ingredients onto DDInter drug names to grow the index past its original 18-drug demo slice, and
 * scripts/build-why.js carries DDInter's own mechanism/management text for the graded pairs that
 * matter into data/interaction-why.json. Both scripts are one-shot build tools (like
 * scripts/build-demo-index.js already was), so - consistent with test/atc-scope.test.js's own
 * approach to that file - most of these tests check the properties of what they actually wrote:
 * data/interaction-index.json's meta.sfda fields, and data/interaction-why.json - not their
 * internals. One test (the exhaustive sfdaIngredientMap cross-check below) is the deliberate
 * exception: it imports build-demo-index.js's own sfdaCandidateKeys(), because re-implementing that
 * resolution logic here to check it would risk silently drifting from what the build actually does
 * - the one thing an exhaustive regression test for this exact class of bug cannot afford.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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

test('meta.sfda.droppedNotInLoadedFiles: every entry has a name and a count, and none of them made it into sfdaIngredientMap', () => {
  const { sfda, sfdaIngredientMap } = INDEX_JSON.meta;
  assert.ok(Array.isArray(sfda.droppedNotInLoadedFiles));
  for (const d of sfda.droppedNotInLoadedFiles) {
    assert.ok(typeof d.ingredient === 'string' && d.ingredient.length > 0);
    assert.ok(typeof d.products === 'number');
    assert.ok(!(d.ingredient.toUpperCase() in sfdaIngredientMap), d.ingredient + ' has no match in these loaded files, but is in sfdaIngredientMap');
  }
});

test('sfdaIngredientMap: every value is a drug the index actually has, every key is upper-cased, and known salt/hydrate/INN-synonym spellings collapse onto one index key (spot checks)', () => {
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
  // A build-local INN/USAN synonym (build-demo-index.js's own EXTRA_SYNONYMS, not shared normalise.js
  // SYNONYMS): "cefalexin" resolves to DDInter's "Cephalexin" spelling.
  assert.equal(map.CEFALEXIN, 'cephalexin');
});

test('sfdaIngredientMap really does keep EVERY registered spelling of a covered drug, checked exhaustively against data/build/top-ingredients.json with the build\'s own sfdaCandidateKeys - not only the hand-picked examples above', (t) => {
  const SFDA_TOP = path.join(__dirname, '..', 'data', 'build', 'top-ingredients.json');
  if (!fs.existsSync(SFDA_TOP)) { t.skip('data/build/top-ingredients.json is git-ignored raw input, not present in this checkout'); return; }
  const top = JSON.parse(fs.readFileSync(SFDA_TOP, 'utf8'));
  const { sfdaCandidateKeys } = require('../scripts/build-demo-index.js');
  const { sfdaIngredientMap } = INDEX_JSON.meta;
  assert.ok(Array.isArray(top.top) && top.top.length > 0, 'data/build/top-ingredients.json has no top[] list');
  let checked = 0;
  for (const item of top.top) {
    // Resolve exactly as the build does: the first candidate key that is an actual drug in the
    // FINAL index. An item can resolve to a real DDInter catalog entry yet still, correctly, be
    // outside the index (e.g. it ranks below the ones that filled the 100-drug quota) - that is
    // not a bug, so this only asserts something for a spelling that hits a drug the index really
    // has (an "index drug" - the same standard the finding's own suggested test uses).
    let key = null;
    for (const k of sfdaCandidateKeys(item.ingredient)) if (INDEX_JSON.drugs[k]) { key = k; break; }
    if (!key) continue;
    checked += 1;
    // Every SFDA spelling that hits a real index drug must be mapped, whether or not its own
    // spelling is what won that drug its slot in the chosen 100 - this is exactly the bug where
    // the quota-full branch skipped mapping a spelling of a drug that was already covered for
    // another reason (e.g. WARFARIN SODIUM -> warfarin, a seed ingredient already in the index
    // before the SFDA extension ever ran).
    assert.equal(sfdaIngredientMap[item.ingredient.toUpperCase()], key, item.ingredient + ' resolves to ' + key + ' (a drug the index has) but sfdaIngredientMap does not say so');
  }
  assert.ok(checked > 0, 'no top-ingredients.json entry resolved to an index drug - the cross-check ran against nothing');
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

test('interaction-why.json.pairs: every pair key is a real, graded row in interaction-index.json; mechanism/management verbatim; sourceSha256 checks out; summary is null or a doctor-unconfirmed AI draft', () => {
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
    assert.ok(w.summary === null || (w.summary && typeof w.summary === 'object'), key + ': summary must be null or {en, ar}');
    assert.equal(w.sourceSha256, crypto.createHash('sha256').update(w.mechanism + '\n' + w.management).digest('hex'), key + ': sourceSha256 does not match its own mechanism+management');
  }
});

test('interaction-why.json.pairs: no mechanism or management string still carries DDInter\'s adverse-event tag widget (the scraper artifact ending in the literal word "More")', () => {
  for (const [key, w] of Object.entries(WHY_JSON.pairs)) {
    assert.ok(!/ More$/.test(w.mechanism), key + ': mechanism still ends in the tag-widget list - ' + JSON.stringify(w.mechanism.slice(-80)));
    assert.ok(!/ More$/.test(w.management), key + ': management still ends in the tag-widget list - ' + JSON.stringify(w.management.slice(-80)));
  }
});

test('interaction-why.json.pairs: every non-null summary has both en and ar text, and its pair\'s sourceSha256 matches its mechanism+management text', () => {
  let checked = 0;
  for (const [key, w] of Object.entries(WHY_JSON.pairs)) {
    assert.equal(w.sourceSha256, crypto.createHash('sha256').update(w.mechanism + '\n' + w.management).digest('hex'), key + ': sourceSha256 does not match its own mechanism+management text');
    if (w.summary === null) continue;
    checked += 1;
    assert.ok(typeof w.summary.en === 'string' && w.summary.en.trim().length > 0, key + ': summary.en is missing or empty');
    assert.ok(typeof w.summary.ar === 'string' && w.summary.ar.trim().length > 0, key + ': summary.ar is missing or empty');
  }
  assert.ok(checked > 0, 'no pair had a non-null summary to check - the why-summaries merge did not run');
});

test('interaction-why.json keeps every existing (pre-extension) graded pair it has text for - ibuprofen x warfarin (Major) is still in it', () => {
  assert.ok(WHY_JSON.pairs['ibuprofen|warfarin'], 'the demo\'s own headline Major pair should have DDInter\'s "why" text');
  assert.equal(WHY_JSON.pairs['ibuprofen|warfarin'].level, 'Major');
});
