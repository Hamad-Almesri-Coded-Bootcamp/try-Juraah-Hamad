'use strict';

/**
 * AP-01 - the drift check (agents/scripts/drift.js). It must go red on a deliberately edited copy,
 * on a missing live workflow and on an unknown live one - and stay green when only the Alexa skill id
 * and device links differ (live-only config, never compared, never printed).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../scripts/drift.js');

const WF = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'agent-alexa.json'), 'utf8'));
const liveOf = (wf) => ({ [wf.name]: D.hashesOf(wf) });
const repoOf = (wf) => ({ [wf.name]: D.hashesOf(wf) });
const copy = (x) => JSON.parse(JSON.stringify(x));

test('identical workflows -> no drift', () => {
  assert.deepEqual(D.compare(repoOf(WF), liveOf(WF)).problems, []);
});

test('a deliberately edited Code node -> red, naming the node', () => {
  const live = copy(WF);
  const n = live.nodes.find((x) => x.name === 'speak (deterministic)');
  n.parameters.jsCode += '\n// edited in the n8n editor';
  const r = D.compare(repoOf(WF), liveOf(live));
  assert.equal(r.problems.length, 1);
  assert.match(r.report.join('\n'), /DRIFT {2}agent-alexa: speak \(deterministic\)/);
});

test('the Alexa skill id and device links are live-only config: set live, still no drift', () => {
  const live = copy(WF);
  const n = live.nodes.find((x) => x.name === 'alexa request (deterministic)');
  n.parameters.jsCode = n.parameters.jsCode.replace("const ALEXA_SKILL_ID = '';\nconst ALEXA_LINKS = {};",
    "const ALEXA_SKILL_ID = 'amzn1.ask.skill.x';\nconst ALEXA_LINKS = {\"amzn1.ask.account.y\":\"pt-03\"};");
  assert.deepEqual(D.compare(repoOf(WF), liveOf(live)).problems, []);
});

test('a committed workflow with no live counterpart, and a live one with no file -> both red', () => {
  const r = D.compare(repoOf(WF), { 'agent-mystery': D.hashesOf(WF) });
  assert.equal(r.problems.length, 2);
  assert.ok(r.problems.some((p) => /agent-alexa: committed, but no ACTIVE live workflow/.test(p)));
  assert.ok(r.problems.some((p) => /agent-mystery: live, but no committed workflow file/.test(p)));
});

test('CRLF in live code is not drift; a changed connection is', () => {
  const live = copy(WF);
  for (const n of live.nodes) if (typeof n.parameters.jsCode === 'string') n.parameters.jsCode = n.parameters.jsCode.replace(/\n/g, '\r\n');
  assert.deepEqual(D.compare(repoOf(WF), liveOf(live)).problems, []);
  delete live.connections['Answer Alexa'];
  assert.equal(D.compare(repoOf(WF), liveOf(live)).problems.length, 1);
});
