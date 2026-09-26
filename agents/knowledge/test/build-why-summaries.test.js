'use strict';

/**
 * Tests for scripts/build-why-summaries.js's pure functions: batchFileNames (the git-ignored
 * why-summaries-<N>.json listing, in run order), collectBatchSummaries (batches -> one pairKey map,
 * failing closed on a malformed or duplicated entry) and applySummaries (the reviewer finding,
 * 2026-09-26: a batch summary is refused, never applied, when its sourceSha256 is missing or does
 * not match the pair's CURRENT one). Fixtures only - never touches the real, git-ignored
 * data/build/why-summaries-*.json or the committed data/interaction-why.json.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { batchFileNames, collectBatchSummaries, applySummaries } = require('../scripts/build-why-summaries.js');

// --------------------------------------------------------------- batchFileNames

test('batchFileNames: matches only why-summaries-<N>.json, sorted numerically (not lexically)', () => {
  assert.deepEqual(
    batchFileNames(['why-summaries-2.json', 'why-summaries-10.json', 'why-summaries-1.json', 'notes.txt', 'why-summaries-x.json']),
    ['why-summaries-1.json', 'why-summaries-2.json', 'why-summaries-10.json']
  );
});

test('batchFileNames: an empty or undefined listing gives no files', () => {
  assert.deepEqual(batchFileNames([]), []);
  assert.deepEqual(batchFileNames(undefined), []);
});

// --------------------------------------------------------------- collectBatchSummaries

test('collectBatchSummaries: reads en/ar/sourceSha256 per pair, across batches, skipping the "meta" key', () => {
  const batches = [
    { file: 'why-summaries-1.json', raw: { meta: { note: 'batch 1' }, 'a|b': { en: ' En text ', ar: ' Ar text ', sourceSha256: 'hash-ab' } } }
  ];
  const { summaries, malformed, duplicates } = collectBatchSummaries(batches);
  assert.deepEqual(malformed, []);
  assert.deepEqual(duplicates, []);
  assert.deepEqual(summaries.get('a|b'), { en: 'En text', ar: 'Ar text', sourceSha256: 'hash-ab', file: 'why-summaries-1.json' });
});

test('collectBatchSummaries: a missing or empty en/ar is malformed, never merged in with a blank', () => {
  const batches = [{ file: 'why-summaries-1.json', raw: { 'a|b': { en: '', ar: 'Ar text' }, 'c|d': { en: 'En text' }, 'e|f': { en: 'En', ar: '   ' } } }];
  const { summaries, malformed } = collectBatchSummaries(batches);
  assert.equal(summaries.size, 0);
  assert.deepEqual(malformed.sort(), ['why-summaries-1.json: a|b', 'why-summaries-1.json: c|d', 'why-summaries-1.json: e|f'].sort());
});

test('collectBatchSummaries: the same pair summarised in two different batch files is a duplicate, neither one wins silently', () => {
  const batches = [
    { file: 'why-summaries-1.json', raw: { 'a|b': { en: 'First', ar: 'Awwal', sourceSha256: 'h1' } } },
    { file: 'why-summaries-2.json', raw: { 'a|b': { en: 'Second', ar: 'Thani', sourceSha256: 'h1' } } }
  ];
  const { summaries, duplicates } = collectBatchSummaries(batches);
  assert.equal(summaries.get('a|b').en, 'First', 'the first batch to define the key is kept in the map; main() refuses to write at all once duplicates is non-empty');
  assert.equal(duplicates.length, 1);
  assert.match(duplicates[0], /a\|b \(why-summaries-1\.json and why-summaries-2\.json\)/);
});

test('collectBatchSummaries: a batch entry with no sourceSha256 at all is kept (not malformed) with sourceSha256: null - applySummaries decides what happens next', () => {
  const { summaries, malformed } = collectBatchSummaries([{ file: 'why-summaries-1.json', raw: { 'a|b': { en: 'En', ar: 'Ar' } } }]);
  assert.deepEqual(malformed, []);
  assert.equal(summaries.get('a|b').sourceSha256, null);
});

// --------------------------------------------------------------- applySummaries

function whyWith(pairs) {
  return { meta: {}, pairs };
}

test('applySummaries: a batch sourceSha256 matching the pair\'s current one is applied', () => {
  const why = whyWith({ 'a|b': { level: 'Major', mechanism: 'x', management: 'y', summary: null, sourceSha256: 'hash-ab' } });
  const summaries = new Map([['a|b', { en: 'En', ar: 'Ar', sourceSha256: 'hash-ab', file: 'why-summaries-1.json' }]]);
  const { applied, orphans, hashMismatches } = applySummaries(why, summaries);
  assert.equal(applied, 1);
  assert.deepEqual(orphans, []);
  assert.deepEqual(hashMismatches, []);
  assert.deepEqual(why.pairs['a|b'].summary, { en: 'En', ar: 'Ar' });
});

test('reviewer finding (2026-09-26): a batch sourceSha256 that does NOT match the pair\'s current one is refused - summary stays/becomes null, never the stale draft', () => {
  const why = whyWith({ 'a|b': { level: 'Major', mechanism: 'x (changed)', management: 'y', summary: { en: 'stale EN', ar: 'stale AR' }, sourceSha256: 'hash-ab-NEW' } });
  const summaries = new Map([['a|b', { en: 'Old draft EN', ar: 'Old draft AR', sourceSha256: 'hash-ab-OLD', file: 'why-summaries-1.json' }]]);
  const { applied, hashMismatches } = applySummaries(why, summaries);
  assert.equal(applied, 0);
  assert.equal(why.pairs['a|b'].summary, null, 'the stale summary is cleared, not left in place and not overwritten with the stale draft either');
  assert.equal(hashMismatches.length, 1);
  assert.match(hashMismatches[0], /a\|b .*hash-ab-OLD.*hash-ab-NEW/);
});

test('reviewer finding (2026-09-26): a batch entry with NO sourceSha256 at all is refused too (fail closed - a missing hash is never treated as a match)', () => {
  const why = whyWith({ 'a|b': { level: 'Major', mechanism: 'x', management: 'y', summary: null, sourceSha256: 'hash-ab' } });
  const summaries = new Map([['a|b', { en: 'En', ar: 'Ar', sourceSha256: null, file: 'why-summaries-1.json' }]]);
  const { applied, hashMismatches } = applySummaries(why, summaries);
  assert.equal(applied, 0);
  assert.equal(why.pairs['a|b'].summary, null);
  assert.equal(hashMismatches.length, 1);
  assert.match(hashMismatches[0], /MISSING/);
});

test('applySummaries: a summary for a pair no longer in interaction-why.json is an orphan, not written anywhere', () => {
  const why = whyWith({ 'a|b': { level: 'Major', mechanism: 'x', management: 'y', summary: null, sourceSha256: 'hash-ab' } });
  const summaries = new Map([['c|d', { en: 'En', ar: 'Ar', sourceSha256: 'hash-cd', file: 'why-summaries-1.json' }]]);
  const { applied, orphans, hashMismatches } = applySummaries(why, summaries);
  assert.equal(applied, 0);
  assert.deepEqual(hashMismatches, []);
  assert.equal(orphans.length, 1);
  assert.match(orphans[0], /c\|d \(why-summaries-1\.json\)/);
});

test('applySummaries: several pairs are handled independently in one pass (matched, mismatched, orphan together)', () => {
  const why = whyWith({
    'a|b': { level: 'Major', mechanism: 'x', management: 'y', summary: null, sourceSha256: 'hash-ab' },
    'e|f': { level: 'Minor', mechanism: 'p', management: 'q', summary: null, sourceSha256: 'hash-ef' }
  });
  const summaries = new Map([
    ['a|b', { en: 'En AB', ar: 'Ar AB', sourceSha256: 'hash-ab', file: 'why-summaries-1.json' }],
    ['e|f', { en: 'En EF', ar: 'Ar EF', sourceSha256: 'WRONG', file: 'why-summaries-1.json' }],
    ['g|h', { en: 'En GH', ar: 'Ar GH', sourceSha256: 'hash-gh', file: 'why-summaries-1.json' }]
  ]);
  const { applied, orphans, hashMismatches } = applySummaries(why, summaries);
  assert.equal(applied, 1);
  assert.equal(orphans.length, 1);
  assert.equal(hashMismatches.length, 1);
  assert.deepEqual(why.pairs['a|b'].summary, { en: 'En AB', ar: 'Ar AB' });
  assert.equal(why.pairs['e|f'].summary, null);
});
