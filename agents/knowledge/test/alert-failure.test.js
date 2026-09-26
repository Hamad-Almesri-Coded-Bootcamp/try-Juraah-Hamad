'use strict';

/**
 * Final review (2026-09-26): a timeout or dropped connection on the travel check's alert write must
 * never lose the danger finding. `neverError` covers HTTP statuses only; a thrown error used to stop
 * the execution before 'Answer', and the app then showed "could not identify". With
 * onError: 'continueRegularOutput' the error reaches 'answer (deterministic)' as an item without a
 * 201, so the patient still gets interaction_found (no alert link) and the run escalates.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JURAH_API_BASE = process.env.JURAH_API_BASE || 'https://example.test/api/agent';
const { travel } = require('../scripts/build.js');

const node = (name) => travel.nodes.find((n) => n.name === name);
const runAnswer = (items) => new Function('$', node('answer (deterministic)').parameters.jsCode)((name) => ({ first: () => items[name] }))[0].json;
const danger = { post: true, error: null, alert: { severity: 'danger' }, result: { verdict: 'interaction_found', appOutcome: { kind: 'identified', drugName: 'Ibuprofen', verdict: 'interaction_found' } } };

test('the alert write continues on a thrown error instead of stopping the run', () => {
  assert.equal(node('backend: raise the alert').onError, 'continueRegularOutput');
});

test('a thrown alert write still answers interaction_found, without an alert link, and escalates', () => {
  const j = runAnswer({
    'check (deterministic)': { json: danger },
    'backend: raise the alert': { json: { error: { message: 'timeout of 6000ms exceeded' } } },
  });
  assert.deepEqual(j.appOutcome, { kind: 'identified', drugName: 'Ibuprofen', verdict: 'interaction_found' });
  assert.equal(j.alertId, null);
  assert.equal(j.mustEscalate, true);
});

test('a written alert still carries its id to the app', () => {
  const j = runAnswer({
    'check (deterministic)': { json: danger },
    'backend: raise the alert': { json: { statusCode: 201, body: { alert: { id: 'ia_01TESTALERT' } } } },
  });
  assert.equal(j.appOutcome.alertId, 'ia_01TESTALERT');
  assert.equal(j.mustEscalate, false);
  assert.equal(j.ok, true);
});
