'use strict';

/**
 * AP-08 step 4: the thresholds live in one constant (agents/eval/thresholds.js), copied from the spec.
 * This test re-reads docs/AI Agents Acceptance Criteria.md and fails if any number differs, or if a
 * sentence it reads from is no longer there (a missing input is a failure, never a pass).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { THRESHOLDS, SETS } = require('../eval/thresholds.js');

const SPEC = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'AI Agents Acceptance Criteria.md'), 'utf8').replace(/\r\n/g, '\n');
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5 };
const num = (s) => (/^\d+$/.test(s) ? Number(s) : WORDS[s.toLowerCase()]);

function section(title) {
  const start = SPEC.indexOf('\n## ' + title + '\n');
  assert.ok(start >= 0, 'the spec has no section "' + title + '"');
  const end = SPEC.indexOf('\n## ', start + 4);
  return SPEC.slice(start, end < 0 ? undefined : end);
}
function grab(text, re, what) {
  const m = text.match(re);
  assert.ok(m, 'the spec no longer says ' + what + ' in the form ' + re);
  return m.slice(1).map(num);
}

test('AP-08 step 4: every threshold and minimum equals docs/AI Agents Acceptance Criteria.md', () => {
  const ex = grab(section('1. Prescription Extraction Agent'), /\*\*Pass criteria:\*\* ≥(\d+)% field-level accuracy on core fields across ≥(\d+) /, 'the extraction pass criterion');
  assert.deepEqual([THRESHOLDS.extraction.minPercent, THRESHOLDS.extraction.minItems], ex);

  const ad = grab(section('2. Adherence Agent'), /\*\*Pass criteria:\*\* ≥(\d+)% correct intent classification on ≥(\d+) Kuwaiti-dialect phrases/, 'the adherence pass criterion');
  assert.deepEqual([THRESHOLDS.adherence.minPercent, THRESHOLDS.adherence.minItems], ad);
  const [adInput] = grab(section('2. Adherence Agent'), /\*\*Requires human-supplied input:\*\* ≥(\d+) Kuwaiti-dialect test phrases/, 'the adherence input');
  assert.equal(THRESHOLDS.adherence.minItems, adInput);

  const ix = section('4. Interaction Screening Agent');
  const [recall] = grab(ix, /\*\*Pass criteria:\*\* (\d+)% recall on the known-interaction test set/, 'the screening pass criterion');
  assert.equal(THRESHOLDS['screening-interacting'].minPercent, recall);
  const [pos, neg] = grab(ix, /≥(\d+) verified interacting pairs \(with citations\) and ≥(\d+) verified non-interacting pairs/, 'the screening input');
  assert.equal(THRESHOLDS['screening-interacting'].minItems, pos);
  assert.equal(THRESHOLDS['screening-non-interacting'].minItems, neg);
  // The spec gives the non-interacting set a size and no threshold: none is invented here.
  assert.equal(THRESHOLDS['screening-non-interacting'].minPercent, null);

  const tr = grab(section('5. Travel Check Agent'), /\*\*Pass criteria:\*\* ≥(\d+)% correct identification across ≥(\d+) sample foreign medication photos/, 'the travel pass criterion');
  assert.deepEqual([THRESHOLDS.travel.minPercent, THRESHOLDS.travel.minItems], tr);

  const ro = grab(section('6. Orchestrator Agent'),
    /\*\*Pass criteria:\*\* ≥(\d+)% correct routing across ≥(\d+) varied inputs, including at least (\w+) ambiguous between extraction and travel check .* and at least (\w+) from a caregiver/,
    'the routing pass criterion');
  const r = THRESHOLDS.routing;
  assert.deepEqual([r.minPercent, r.minItems, r.minBoxOrPrescription, r.minFromCaregiver], ro);
});

test('AP-08 step 4: one constant, frozen, and one entry per set the plan lists (section 9)', () => {
  assert.deepEqual(SETS, ['extraction', 'adherence', 'screening-interacting', 'screening-non-interacting', 'travel', 'routing']);
  assert.ok(Object.isFrozen(THRESHOLDS) && SETS.every((s) => Object.isFrozen(THRESHOLDS[s])));
  assert.throws(() => { 'use strict'; THRESHOLDS.adherence.minPercent = 50; });
  assert.equal(THRESHOLDS.adherence.minPercent, 90);
});

test('AP-08 step 4: no other file in agents/eval holds a threshold', () => {
  const dir = path.join(__dirname, '..', 'eval');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'thresholds.js')) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!/\b(minPercent|minItems|minBoxOrPrescription|minFromCaregiver)\s*:\s*\d/.test(src), f + ' defines a threshold of its own');
  }
});
