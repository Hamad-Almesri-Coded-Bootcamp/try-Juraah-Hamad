'use strict';

/**
 * Tests for scripts/build-why.js's pure functions: stripTagWidget (the DDInter adverse-event tag
 * widget cut) and computeWhyPairs (raw why-raw.json pairs + the interaction index -> this file's own
 * `pairs` object, plus every dropped/adjusted list main() logs). Fixtures only - never touches the
 * real, git-ignored data/build/why-raw.json or the committed data/interaction-why.json.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { stripTagWidget, isPlaceholderDash, computeWhyPairs } = require('../scripts/build-why.js');

function sha(mechanism, management) {
  return crypto.createHash('sha256').update(mechanism + '\n' + management).digest('hex');
}

// --------------------------------------------------------------- stripTagWidget

test('stripTagWidget: cuts DDInter\'s adverse-event tag list off the end (ends in the literal " More")', () => {
  const r = stripTagWidget('Coadministration may raise levels. abdominal distension angina angioedema More');
  assert.equal(r.text, 'Coadministration may raise levels.');
  assert.equal(r.cut, 'abdominal distension angina angioedema More');
});

test('stripTagWidget: ordinary prose that merely contains the word "more" is never touched', () => {
  const r = stripTagWidget('Monitor more closely if the dose is increased.');
  assert.equal(r.text, 'Monitor more closely if the dose is increased.');
  assert.equal(r.cut, null);
});

test('stripTagWidget: no sentence boundary to cut at - left unchanged rather than guessed', () => {
  const r = stripTagWidget('no period anywhere in here More');
  assert.equal(r.text, 'no period anywhere in here More');
  assert.equal(r.cut, null);
});

test('stripTagWidget: empty/falsy text is passed through', () => {
  assert.deepEqual(stripTagWidget(''), { text: '', cut: null });
  assert.deepEqual(stripTagWidget(null), { text: null, cut: null });
});

// --------------------------------------------------------------- isPlaceholderDash

test('isPlaceholderDash: only the exact single character "-" counts, never a hyphenated phrase', () => {
  assert.equal(isPlaceholderDash('-'), true);
  assert.equal(isPlaceholderDash('low-dose'), false);
  assert.equal(isPlaceholderDash(''), false);
  assert.equal(isPlaceholderDash('- '), false, 'already trimmed by the caller; a caller that forgets to trim is its own bug, not this function\'s to hide');
});

// --------------------------------------------------------------- computeWhyPairs fixtures

/** A tiny, self-consistent index: two drugs, A x B graded Major, C x D graded Unknown (ungraded). */
function makeIndex() {
  return {
    meta: { source: { citation: 'Test Citation 2026' }, builtAt: '2026-09-26' },
    drugs: {
      a: { ddinterId: 'DDA1', label: 'Drug A' },
      b: { ddinterId: 'DDB1', label: 'Drug B' },
      c: { ddinterId: 'DDC1', label: 'Drug C' },
      d: { ddinterId: 'DDD1', label: 'Drug D' }
    },
    pairs: {
      'a|b': { level: 'Major' },
      'c|d': { level: 'Unknown' }
    }
  };
}

test('computeWhyPairs: a normal pair is written with a correct sourceSha256 and the source text verbatim', () => {
  const index = makeIndex();
  const raw = {
    meta: { retrievedAt: '2026-09-20' },
    pairs: {
      'DDA1|DDB1': { idA: 'DDA1', nameA: 'Drug A', idB: 'DDB1', nameB: 'Drug B', level: 'Major', url: 'https://ddinter.scbdd.com/x/1/', mechanism: 'A raises B levels.', management: 'Monitor closely.' }
    }
  };
  const { sortedPairs, droppedOutOfScope, droppedNoIndexRow, droppedMissingText, droppedUngraded, droppedPlaceholderText } = computeWhyPairs({ index, raw });
  assert.deepEqual(Object.keys(sortedPairs), ['a|b']);
  assert.equal(sortedPairs['a|b'].mechanism, 'A raises B levels.');
  assert.equal(sortedPairs['a|b'].management, 'Monitor closely.');
  assert.equal(sortedPairs['a|b'].summary, null);
  assert.equal(sortedPairs['a|b'].sourceSha256, sha('A raises B levels.', 'Monitor closely.'));
  assert.deepEqual(droppedOutOfScope, []);
  assert.deepEqual(droppedNoIndexRow, []);
  assert.deepEqual(droppedMissingText, []);
  assert.deepEqual(droppedUngraded, []);
  assert.deepEqual(droppedPlaceholderText, []);
});

test('computeWhyPairs (reviewer finding, 2026-09-26): a pair whose management is DDInter\'s "-" placeholder is dropped, not written with "-" as advice', () => {
  const index = makeIndex();
  const raw = { meta: {}, pairs: { 'DDA1|DDB1': { idA: 'DDA1', nameA: 'A', idB: 'DDB1', nameB: 'B', level: 'Major', url: 'https://ddinter.scbdd.com/x/1/', mechanism: 'A raises B levels.', management: '-' } } };
  const { sortedPairs, droppedPlaceholderText } = computeWhyPairs({ index, raw });
  assert.deepEqual(sortedPairs, {}, 'the pair is dropped entirely, never written with management "-"');
  assert.equal(droppedPlaceholderText.length, 1);
  assert.match(droppedPlaceholderText[0], /a\|b.*management is DDInter's "-" placeholder/);
});

test('computeWhyPairs: a pair whose MECHANISM is the "-" placeholder is dropped the same way', () => {
  const index = makeIndex();
  const raw = { meta: {}, pairs: { 'DDA1|DDB1': { idA: 'DDA1', nameA: 'A', idB: 'DDB1', nameB: 'B', level: 'Major', url: 'https://ddinter.scbdd.com/x/1/', mechanism: '-', management: 'Monitor closely.' } } };
  const { sortedPairs, droppedPlaceholderText } = computeWhyPairs({ index, raw });
  assert.deepEqual(sortedPairs, {});
  assert.match(droppedPlaceholderText[0], /a\|b.*mechanism is DDInter's "-" placeholder/);
});

test('computeWhyPairs: a placeholder "-" is only recognised AFTER the tag-widget cut, so a real tag-widget pair is unaffected', () => {
  const index = makeIndex();
  const raw = {
    meta: {},
    pairs: {
      'DDA1|DDB1': {
        idA: 'DDA1', nameA: 'A', idB: 'DDB1', nameB: 'B', level: 'Major', url: 'https://ddinter.scbdd.com/x/1/',
        mechanism: 'A raises B levels.', management: 'Monitor closely. abdominal distension angina More'
      }
    }
  };
  const { sortedPairs, tagWidgetsCut, droppedPlaceholderText } = computeWhyPairs({ index, raw });
  assert.equal(sortedPairs['a|b'].management, 'Monitor closely.');
  assert.equal(tagWidgetsCut.length, 1);
  assert.deepEqual(droppedPlaceholderText, []);
});

test('computeWhyPairs: existing drop reasons are unchanged by the refactor - out of scope, no index row, ungraded, missing text', () => {
  const index = makeIndex();
  const raw = {
    meta: {},
    pairs: {
      'DDZ1|DDZ2': { idA: 'DDZ1', nameA: 'Z1', idB: 'DDZ2', nameB: 'Z2', level: 'Major', url: 'https://ddinter.scbdd.com/x/2/', mechanism: 'x', management: 'y' },
      'DDC1|DDD1': { idA: 'DDC1', nameA: 'C', idB: 'DDD1', nameB: 'D', level: 'Unknown', url: 'https://ddinter.scbdd.com/x/3/', mechanism: 'x', management: 'y' },
      'DDA1|DDD1': { idA: 'DDA1', nameA: 'A', idB: 'DDD1', nameB: 'D', level: 'Major', url: 'https://ddinter.scbdd.com/x/4/', mechanism: 'x', management: 'y' },
      'DDA1|DDB1': { idA: 'DDA1', nameA: 'A', idB: 'DDB1', nameB: 'B', level: 'Major', url: 'https://ddinter.scbdd.com/x/5/', mechanism: '', management: 'y' }
    }
  };
  // 'a|b' has no index row here on purpose (index.pairs only has 'a|b' in makeIndex(), so redefine
  // a pairs-less index to exercise droppedNoIndexRow without colliding with the missing-text case).
  const indexNoRow = { ...index, pairs: { 'c|d': index.pairs['c|d'] } };
  const { droppedOutOfScope, droppedNoIndexRow, droppedUngraded, droppedMissingText } = computeWhyPairs({ index: indexNoRow, raw });
  assert.equal(droppedOutOfScope.length, 1, 'DDZ1/DDZ2 are not in byDdinterId at all');
  assert.ok(droppedOutOfScope[0].includes('Z1 x Z2'));
  assert.equal(droppedUngraded.length, 1);
  assert.ok(droppedUngraded[0].startsWith('c|d'));
  assert.equal(droppedNoIndexRow.length, 2, 'a|d has no row, and a|b has no row in this cut-down index');
  assert.equal(droppedMissingText.length, 0, 'a|b was already dropped for having no index row, before the missing-text check ever ran on it');
});

test('computeWhyPairs: a level mismatch between why-raw and the index is logged, and the index\'s own level wins', () => {
  const index = makeIndex();
  const raw = { meta: {}, pairs: { 'DDA1|DDB1': { idA: 'DDA1', nameA: 'A', idB: 'DDB1', nameB: 'B', level: 'Moderate', url: 'https://ddinter.scbdd.com/x/1/', mechanism: 'x', management: 'y' } } };
  const { sortedPairs, levelMismatches } = computeWhyPairs({ index, raw });
  assert.equal(sortedPairs['a|b'].level, 'Major', 'the index\'s own level is authoritative');
  assert.equal(levelMismatches.length, 1);
});
