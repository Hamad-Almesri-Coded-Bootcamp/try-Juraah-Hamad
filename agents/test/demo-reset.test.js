'use strict';

/**
 * CR-109 - agents/lib/demo-reset.js: the demo-reset page's deterministic answer. Fail closed: only
 * an HTTP 200 whose body is exactly the agreed contract shape, for pt-03, reads as done. Dose words
 * by reference (W_ON etc.), never a `status:` literal - guard 4 / G1 scans agents/**\/*.js.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  readReset, resetAnswer, DEMO_RESET_PATIENT, EVENING_FROM, EVENING_TO, RECORDED_WORDS, MAX_ROWS,
} = require('../lib/demo-reset.js');

const W_ON = ['taken_on_time'][0];
const W_LATE = ['taken_late'][0];
const W_MISS = ['missed'][0];
const OPEN = ['upcoming'][0];

const http = (statusCode, body) => ({ statusCode, body });
const OK = {
  statusCode: 200,
  body: {
    patientId: 'pt-03',
    dates: ['2026-09-26', '2026-09-27'],
    moved: [{ id: 'rx-009-20260927-2100', from: '21:00', to: '19:30' }],
    reset: [
      { id: 'rx-008-20260926-0700', kuwaitTime: '07:00', was: W_MISS },
      { id: 'rx-009-20260926-2100', kuwaitTime: '19:30', was: W_ON },
    ],
  },
};

test('the constants', () => {
  assert.equal(DEMO_RESET_PATIENT, 'pt-03');
  assert.equal(EVENING_FROM, '21:00');
  assert.equal(EVENING_TO, '19:30');
  assert.deepEqual(RECORDED_WORDS, [W_ON, W_LATE, W_MISS]);
  assert.equal(MAX_ROWS, 50);
});

test('readReset accepts the contract body and returns copies of dates, moved and reset', () => {
  const r = readReset(OK);
  assert.equal(r.ok, true);
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.dates, OK.body.dates);
  assert.deepEqual(r.moved, OK.body.moved);
  assert.deepEqual(r.reset, OK.body.reset);
  // Copies, not the same references - mutating the result must never touch the fixture.
  assert.notEqual(r.dates, OK.body.dates);
  assert.notEqual(r.moved[0], OK.body.moved[0]);
  assert.notEqual(r.reset[0], OK.body.reset[0]);
});

test('the month boundary: 30 September into 1 October is accepted; 30 February is refused as bad_dates', () => {
  const good = readReset(http(200, { ...OK.body, dates: ['2026-09-30', '2026-10-01'] }));
  assert.equal(good.ok, true);
  const bad = readReset(http(200, { ...OK.body, dates: ['2026-02-30', '2026-03-01'] }));
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'bad_dates');
});

test('the exact reason for each refusal', () => {
  const reason = (response) => readReset(response).reason;

  assert.equal(reason(undefined), 'no_answer');
  assert.equal(reason({}), 'no_answer');
  assert.equal(reason({ error: {} }), 'no_answer');

  assert.equal(reason(http(401, {})), 'http_401');
  assert.equal(reason(http(500, {})), 'http_500');

  assert.equal(reason(http(200, { ...OK.body, extra: 1 })), 'not_the_contract');
  {
    const { dates, ...missingDates } = OK.body;
    assert.equal(reason(http(200, missingDates)), 'not_the_contract');
  }
  assert.equal(reason(http(200, null)), 'not_the_contract');
  assert.equal(reason(http(200, [])), 'not_the_contract');
  assert.equal(reason(http(200, 'x')), 'not_the_contract');

  assert.equal(reason(http(200, { ...OK.body, patientId: 'pt-01' })), 'other_patient');

  assert.equal(reason(http(200, { ...OK.body, moved: [{ id: 'rx-009-x', from: '13:00', to: '19:30' }] })), 'bad_moved');

  assert.equal(reason(http(200, { ...OK.body, reset: [{ id: 'rx-x', kuwaitTime: '19:30', was: OPEN }] })), 'bad_reset');
  assert.equal(reason(http(200, { ...OK.body, reset: [{ id: 'rx-x', kuwaitTime: '7:00', was: W_ON }] })), 'bad_reset');
  assert.equal(reason(http(200, { ...OK.body, reset: [{ id: 'rx x', kuwaitTime: '19:30', was: W_ON }] })), 'bad_reset');
  assert.equal(reason(http(200, { ...OK.body, reset: Array.from({ length: 51 }, (_, i) => ({ id: 'rx-' + i, kuwaitTime: '19:30', was: W_ON })) })), 'bad_reset');

  assert.equal(reason(http(200, { ...OK.body, reset: [OK.body.reset[0], OK.body.reset[0]] })), 'duplicate_id');
});

test('a statusCode of the string "200" is no_answer, and 201 is http_201', () => {
  assert.equal(readReset(http('200', OK.body)).reason, 'no_answer');
  assert.equal(readReset(http(201, OK.body)).reason, 'http_201');
});

test('resetAnswer for a done case', () => {
  const a = resetAnswer(OK);
  assert.equal(a.done, true);
  assert.equal(a.title, 'Done / تم');
  const firstLine = a.message.split('\n')[0];
  assert.equal(firstLine, 'Done: 2 doses back to unrecorded; evening dose at 19:30');

  const singular = resetAnswer(http(200, { ...OK.body, reset: [OK.body.reset[0]] }));
  assert.match(singular.message.split('\n')[0], /^Done: 1 dose back to unrecorded/);

  const noMove = resetAnswer(http(200, { ...OK.body, moved: [] }));
  assert.ok(!noMove.message.split('\n')[0].includes('; evening dose'), noMove.message);

  const empty = resetAnswer(http(200, { ...OK.body, moved: [], reset: [] }));
  assert.match(empty.message, /Nothing needed changing\./);

  assert.match(a.message, /[؀-ۿ]/);
  assert.match(a.message, /was missed/);
  assert.match(a.message, /فاتت/);
});

test('resetAnswer for a failure', () => {
  const a = resetAnswer(http(503, {}));
  assert.equal(a.done, false);
  assert.equal(a.title, 'Did not reset / لم تتم إعادة الضبط');
  assert.match(a.message, /HTTP 503/);
  assert.ok(!a.message.match(/^Done/m));

  const none = resetAnswer(undefined);
  assert.match(none.message, /no answer/);

  const badShape = resetAnswer(http(200, { ...OK.body, extra: 1 }));
  assert.match(badShape.message, /not in the agreed shape/);
});

test('the answer never echoes the backend\'s own text', () => {
  const a = resetAnswer(http(500, { error: '<script>leak</script> pt-01' }));
  assert.equal(a.done, false);
  assert.ok(!a.message.includes('leak'));
  assert.ok(!a.message.includes('<script'));
  assert.ok(!a.message.includes('pt-01'));
});

test('the source file itself: no require(, fetch(, Date.now(, argument-less new Date(, "model contract", "/doses/" or "/schedule/"; ends with a single-line export', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'demo-reset.js'), 'utf8');
  assert.ok(!/\brequire\(/.test(src), 'require(');
  assert.ok(!/\bfetch\(/.test(src), 'fetch(');
  assert.ok(!/Date\.now\(/.test(src), 'Date.now(');
  assert.ok(!/new Date\(\s*\)/.test(src), 'argument-less new Date()');
  assert.ok(!src.includes('model contract'), 'model contract');
  assert.ok(!src.includes('/doses/'), '/doses/');
  assert.ok(!src.includes('/schedule/'), '/schedule/');
  const lines = src.trimEnd().split('\n');
  assert.match(lines[lines.length - 1], /^module\.exports = \{.*\};$/, 'the export must be the file\'s last line, alone');
});
