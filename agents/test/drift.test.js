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

// AP-18: agent-error's Telegram node ships an owed literal chatId (build-error-workflow.js's own
// TEAM_CHAT_ID constant); the lead sets the team's real chat id only in the live node after import.
// That must never read as drift - but any OTHER change to that same node, or to any other node,
// still must.
const { TEAM_CHAT_ID } = require('../scripts/build-error-workflow.js');
test('AP-18: agent-error\'s real chat id (set live, after import) is live-only config - no drift; any other change to it still is', () => {
  const EWF = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'agent-error.json'), 'utf8'));
  const telegramNode = (wf) => wf.nodes.find((n) => n.type === 'n8n-nodes-base.telegram');
  assert.equal(telegramNode(EWF).parameters.chatId, TEAM_CHAT_ID, 'the committed file ships the owed marker, never a real chat id');

  const liveWithRealChat = copy(EWF);
  telegramNode(liveWithRealChat).parameters.chatId = '-1002345678901'; // a real n8n Telegram chat id shape
  assert.deepEqual(D.compare(repoOf(EWF), liveOf(liveWithRealChat)).problems, []);

  const liveEdited = copy(liveWithRealChat);
  telegramNode(liveEdited).parameters.text = '={{ $json.text }} edited';
  const r = D.compare(repoOf(EWF), liveOf(liveEdited));
  assert.equal(r.problems.length, 1);
  assert.match(r.report.join('\n'), /DRIFT {2}agent-error: Telegram: notify the team/);

  const liveCodeEdited = copy(liveWithRealChat);
  const codeNode = liveCodeEdited.nodes.find((n) => n.type === 'n8n-nodes-base.code');
  codeNode.parameters.jsCode += '\n// edited live';
  const r2 = D.compare(repoOf(EWF), liveOf(liveCodeEdited));
  assert.equal(r2.problems.length, 1);
  assert.match(r2.report.join('\n'), /DRIFT {2}agent-error: message \(deterministic\)/);
});

// A chatId written as an n8n expression (every OTHER workflow's Telegram send) must never be masked -
// only a literal value is live-only config.
test('an expression chatId (every other Telegram send) is never masked: a real change to it is drift', () => {
  const live = copy(WF); // agent-alexa has no Telegram node with a literal chatId to begin with, but
  // the masking rule itself must still tell a literal from an expression on ANY node shape.
  const n1 = D.normaliseNode({ type: 'n8n-nodes-base.telegram', typeVersion: 1.2, parameters: { chatId: '={{ $json.chatId }}', text: 'a' } });
  const n2 = D.normaliseNode({ type: 'n8n-nodes-base.telegram', typeVersion: 1.2, parameters: { chatId: '={{ $json.otherChatId }}', text: 'a' } });
  assert.notEqual(n1, n2, 'two different expressions must not hash equal');
  const n3 = D.normaliseNode({ type: 'n8n-nodes-base.telegram', typeVersion: 1.2, parameters: { chatId: '5550001', text: 'a' } });
  const n4 = D.normaliseNode({ type: 'n8n-nodes-base.telegram', typeVersion: 1.2, parameters: { chatId: '5550002', text: 'a' } });
  assert.equal(n3, n4, 'two literal chat ids must hash equal (masked) - this is the only case that should');
});
