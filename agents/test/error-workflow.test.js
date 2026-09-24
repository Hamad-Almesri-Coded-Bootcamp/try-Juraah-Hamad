'use strict';

/**
 * AP-18 (docs/AGENTS-POLISH-PLAN.md 7.3, steps 1 and 5).
 *  - errorAlertText (agents/lib/error-alert.js): the message never carries the failed run's OWN
 *    data - only its shape (workflow name, last node, execution URL, the Kuwait time passed in).
 *  - checkErrorWorkflow (agents/scripts/check-error-workflow.js), added once agent-error.json exists:
 *    the generated workflow has exactly the three expected nodes, wired in order, an owed literal
 *    chatId, a Code node that cannot read the failed run's error text, and a committed file that is
 *    byte-identical to a fresh build. Proven red on edited copies, the same way agents/scripts/check.js
 *    proves its own assertions red (agents/scripts/drift.js's own test does the same for drift).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { errorAlertText, FALLBACK } = require('../lib/error-alert.js');
const { buildWorkflow } = require('../scripts/build-error-workflow.js');
const { checkErrorWorkflow, checkCommittedFile } = require('../scripts/check-error-workflow.js');

const copy = (x) => JSON.parse(JSON.stringify(x));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const POISONED = {
  workflow: { id: 'wf_1', name: 'agent-telegram-inbound' },
  execution: {
    id: '4821',
    url: 'https://mohammad-aljry.app.n8n.cloud/workflow/wf_1/executions/4821',
    lastNodeExecuted: 'backend: doses of the day',
    mode: 'trigger',
    // Fake, but shaped like the real thing: a Civil ID, a Telegram chat id, two token-shaped strings.
    error: {
      message: 'refused for patient 289011200123, chat 5550001, token abcDEF012345token',
      description: 'civil id 289011200123 could not be verified, link token xyzToken98765',
      stack: 'Error: chat 5550001 token abcDEF012345token\n    at Object.<anonymous> (/x/y.js:1:1)',
    },
  },
  trigger: { mode: 'manual' },
};
const NOW = '2026-09-24T13:45:00.000+03:00';

test('errorAlertText names the workflow, the node, the Kuwait time and the execution URL', () => {
  const text = errorAlertText(POISONED, NOW);
  assert.match(text, /agent-telegram-inbound/);
  assert.match(text, /backend: doses of the day/);
  assert.match(text, /2026-09-24T13:45:00\.000\+03:00/);
  assert.match(text, /https:\/\/mohammad-aljry\.app\.n8n\.cloud\/workflow\/wf_1\/executions\/4821/);
});

test('never the failed run\'s own data: no Civil ID, chat id or token, from error.message, .description or .stack', () => {
  const text = errorAlertText(POISONED, NOW);
  assert.doesNotMatch(text, /289011200123/, 'the Civil ID survived');
  assert.doesNotMatch(text, /5550001/, 'the chat id survived');
  assert.doesNotMatch(text, /abcDEF012345token|xyzToken98765/, 'a token-shaped string survived');
  assert.doesNotMatch(text, /refused for patient|could not be verified/, 'the raw error text survived');
});

test('ASCII-only, no em dash - plain text for the team, not app copy', () => {
  const text = errorAlertText(POISONED, NOW);
  assert.ok([...text].every((c) => c.charCodeAt(0) <= 0x7f), 'a non-ASCII character in the alert text');
  assert.ok(!text.includes(String.fromCharCode(0x2014)), 'an em dash in the alert text');
});

test('a missing or malformed payload never throws, and falls back honestly instead of guessing', () => {
  for (const bad of [null, undefined, {}, { workflow: null }, { execution: 'nope' }, 'not an object', 42, []]) {
    const text = errorAlertText(bad, NOW);
    assert.match(text, new RegExp(FALLBACK.replace(/[()]/g, '\\$&')));
  }
});

test('a non-string or blank field falls back too, and an overlong one is capped, not truncating the message shape', () => {
  const text = errorAlertText({ workflow: { name: 123 }, execution: { lastNodeExecuted: '   ', url: 'x'.repeat(500) } }, 'now');
  assert.match(text, /Jur'ah workflow failed: \(not given\)/);
  assert.match(text, /Node: \(not given\)/);
  assert.ok(text.includes('x'.repeat(200) + '...'), 'the long field was capped with an ellipsis');
  assert.ok(!text.includes('x'.repeat(201)), 'the long field was not capped');
});

test('runtime proof: the GENERATED Code node, executed as n8n would run it ($input, $now stubbed), builds the message and drops the failed run\'s own error text', async () => {
  const wf = buildWorkflow();
  const codeNode = wf.nodes.find((n) => n.type === 'n8n-nodes-base.code');
  const $input = { first: () => ({ json: copy(POISONED) }) };
  const $now = { toISO: () => NOW };
  const fn = new AsyncFunction('$input', '$now', codeNode.parameters.jsCode);
  const [item] = await fn($input, $now);
  assert.match(item.json.text, /agent-telegram-inbound/);
  assert.match(item.json.text, /backend: doses of the day/);
  assert.match(item.json.text, /2026-09-24T13:45:00\.000\+03:00/);
  assert.doesNotMatch(item.json.text, /289011200123|5550001|abcDEF012345token|xyzToken98765/, 'the failed run\'s own data reached the message');
});

// ---- agents/scripts/check-error-workflow.js: the static guard over the GENERATED workflow, proven
// both green (the committed file, as it stands) and red (edited copies, and a file that is not there).
test('checkCommittedFile: the committed agent-error.json passes and matches a fresh build (green)', () => {
  assert.doesNotThrow(() => checkCommittedFile());
});

test('checkErrorWorkflow goes RED on a numeric chatId (not the literal owed marker)', () => {
  const wf = buildWorkflow();
  wf.nodes[2].parameters.chatId = 123456789;
  assert.throws(() => checkErrorWorkflow(wf), /chatId/);
});

test('checkErrorWorkflow goes RED on a Code node edited to read the failed run\'s error.message', () => {
  const wf = buildWorkflow();
  wf.nodes[1].parameters.jsCode += '\nconsole.log($input.first().json.execution.error.message);';
  assert.throws(() => checkErrorWorkflow(wf), /error text/);
});

test('checkErrorWorkflow goes RED on a fourth node', () => {
  const wf = buildWorkflow();
  wf.nodes.push({ parameters: {}, id: 'b6000000-0000-4000-8000-0000000000ff', name: 'extra', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [0, 0] });
  assert.throws(() => checkErrorWorkflow(wf), /exactly an Error Trigger/);
});

test('checkErrorWorkflow goes RED on a committed credential, and on being set as its own error workflow', () => {
  const withCred = buildWorkflow();
  withCred.nodes[2].credentials = { telegramApi: { id: '1', name: 'x' } };
  assert.throws(() => checkErrorWorkflow(withCred), /credential/);

  const selfLooping = buildWorkflow();
  selfLooping.settings.errorWorkflow = 'agent-error';
  assert.throws(() => checkErrorWorkflow(selfLooping), /own error workflow/);
});

test('checkCommittedFile goes RED on a missing file - Node\'s own ENOENT, never special-cased away', () => {
  const missing = path.join(__dirname, '..', 'workflows', 'agent-error-does-not-exist.json');
  assert.throws(() => checkCommittedFile(missing), /ENOENT|no such file/);
});
