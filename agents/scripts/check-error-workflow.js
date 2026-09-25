'use strict';

/**
 * AP-18 (docs/AGENTS-POLISH-PLAN.md 7.3, step 1) - proves agents/workflows/agent-error.json, not
 * just its source (mirrors the split agents/scripts/check.js keeps against agents/scripts/build.js):
 *   1. exactly three nodes, these types, in this order: Error Trigger, Code, Telegram;
 *   2. wired Error Trigger -> Code -> Telegram, nothing else;
 *   3. the Telegram send's chatId is exactly build-error-workflow.js's own owed-value constant
 *      (never a real value or an expression), and no credential is committed;
 *   4. the Code node compiles as n8n compiles a Code node, and its source can never read the failed
 *      run's own error text (agents/lib/error-alert.js's whole point);
 *   5. this workflow is never set as its own error workflow (or a failed send here would loop);
 *   6. the committed file is ASCII and byte-identical to what scripts/build-error-workflow.js
 *      currently generates - nobody hand-edited it after the last rebuild.
 * Exit code 1 on the first failure, same convention as check.js and drift.js.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { buildWorkflow, serialise, ROOT, TEAM_CHAT_ID } = require('./build-error-workflow.js');

const FILE = path.join(ROOT, 'workflows', 'agent-error.json');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const EXPECTED_TYPES = ['n8n-nodes-base.errorTrigger', 'n8n-nodes-base.code', 'n8n-nodes-base.telegram'];
// The one canonical owed-value text lives in build-error-workflow.js; read back, never retyped, so
// the two files can never quietly disagree on its exact spelling.
const OWED_CHAT_ID = TEAM_CHAT_ID;

/** One connection's `main` output is exactly one link, to `to`. */
function connectsOnlyTo(conn, from, to) {
  const out = conn[from] && conn[from].main;
  return Array.isArray(out) && out.length === 1 && Array.isArray(out[0]) && out[0].length === 1 &&
    out[0][0] && out[0][0].node === to && out[0][0].type === 'main';
}

/**
 * The structural proof, on ANY workflow object - the committed one, or an edited-in-memory copy
 * (agents/test/error-workflow.test.js proves this goes red on each). Throws on the first breach,
 * naming it; never silently passes on a shape it does not recognise.
 */
function checkErrorWorkflow(wf) {
  assert.ok(wf && Array.isArray(wf.nodes), 'agent-error: not a workflow object');
  const types = wf.nodes.map((n) => n.type);
  assert.deepEqual(types, EXPECTED_TYPES,
    'agent-error must hold exactly an Error Trigger, one Code node and one Telegram node, in that order (got: ' + types.join(', ') + ')');
  const [trigger, codeNode, telegram] = wf.nodes;

  const conn = wf.connections || {};
  assert.deepEqual(Object.keys(conn).sort(), [trigger.name, codeNode.name].sort(),
    'agent-error must connect exactly ' + trigger.name + ' -> ' + codeNode.name + ' -> ' + telegram.name + ', nothing else');
  assert.ok(connectsOnlyTo(conn, trigger.name, codeNode.name), trigger.name + ' must connect to exactly ' + codeNode.name);
  assert.ok(connectsOnlyTo(conn, codeNode.name, telegram.name), codeNode.name + ' must connect to exactly ' + telegram.name);

  assert.equal(telegram.parameters && telegram.parameters.chatId, OWED_CHAT_ID,
    'the Telegram node\'s chatId must be the literal owed marker ' + OWED_CHAT_ID + ', never a real value or an expression');
  assert.equal(typeof (telegram.parameters && telegram.parameters.text), 'string', 'the Telegram node must send text');
  assert.ok(!('credentials' in telegram), 'no credential may be committed - it is bound by hand after import (agents/README.md)');

  const js = codeNode.parameters && codeNode.parameters.jsCode;
  assert.equal(typeof js, 'string', 'the Code node has no jsCode');
  new AsyncFunction('$input', '$now', js); // must compile exactly as n8n compiles a Code node
  assert.ok(!/\.error\s*\.\s*(message|stack|description)\b/i.test(js), 'the Code node reads the failed run\'s own error text (message/stack/description)');
  assert.ok(!/\bexecution\s*\.\s*error\b/i.test(js), 'the Code node names the execution\'s error object directly');

  assert.ok(!('errorWorkflow' in (wf.settings || {})), 'agent-error must never be set as its own error workflow - a failed send here must not loop');
}

/** The file-level proof: ASCII, and byte-identical to a build run right now from the same source.
 * `file` is overridable so a test can point at a path that does not exist (Node's own ENOENT is the
 * red proof for "a missing file" - never special-cased away). */
function checkCommittedFile(file = FILE) {
  const raw = fs.readFileSync(file); // Buffer; throws ENOENT if the file is missing - that IS the check
  assert.ok([...raw].every((b) => b <= 0x7f), file + ': a byte above 0x7F (not ASCII)');
  // A Windows checkout (core.autocrlf) holds the file with CRLF; the build writes LF. Line endings are
  // not content, so both sides are compared with LF (as drift.js and the knowledge build do).
  const committed = raw.toString('ascii').replace(/\r\n/g, '\n');
  checkErrorWorkflow(JSON.parse(committed));
  const fresh = serialise(buildWorkflow()).replace(/\r\n/g, '\n');
  assert.equal(committed, fresh, file + ' is not what scripts/build-error-workflow.js currently generates - rebuild it');
}

function main() {
  checkCommittedFile();
  console.log('  OK    agent-error: exactly Error Trigger -> Code -> Telegram, chatId owed, no failed-run data read, matches a fresh build, ASCII');
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.log('  FAIL  agent-error: ' + String((e && e.message) || e).split('\n').join('\n        '));
    process.exitCode = 1;
  }
}
module.exports = { checkErrorWorkflow, checkCommittedFile };
