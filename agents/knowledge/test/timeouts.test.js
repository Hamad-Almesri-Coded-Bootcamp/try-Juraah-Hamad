'use strict';

/**
 * A5 (2026-09-26, reviewer fix): the vision chain in agent-travel-check and agent-extraction has to
 * fit inside the app's 45000ms VISION_TIMEOUT_MS with margin - target worst case <= 40000ms. Reads
 * the BUILT workflow JSON (never the source directly), exactly like check.js does, so this proves
 * what is actually committed, not just what build.js intends.
 *
 * This walks wf.connections from the webhook trigger to the 'Answer' node itself, over every branch
 * a real execution can take (a plain edge, an `if` node's true/false outputs, a Gemini node's
 * onError -> fallback output), and asserts the COSTLIEST such path - never a hand-picked list of
 * node names. The original version of this test summed three named httpRequest nodes and missed a
 * fourth that runs later on the SAME critical path (the alert POST on travel check's danger branch,
 * the save POST on extraction's save:true branch): both workflows respond from the same 'Answer'
 * node reached AFTER that POST, so its timeout is part of the real worst case whether or not this
 * test's author remembered to name it. A node added anywhere between the webhook and 'Answer' in a
 * future change is covered automatically, with no edit needed here.
 */

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');
const WF = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', name + '.json'), 'ascii'));
const BUDGET_MS = 40000;

/** Worst case for one httpRequest node: every try times out, plus the wait between tries. A node
 *  only actually retries when n8n's own retryOnFail is true - api() sets retryOnFail for GET calls
 *  only (a refused write must never silently repeat), so a POST costs one timeout even when its
 *  maxTries field is left at api()'s default of 2. */
function worstCaseTries(node) {
  const tries = node.retryOnFail ? (node.maxTries || 1) : 1;
  const wait = node.waitBetweenTries || 0;
  return node.parameters.options.timeout * tries + wait * Math.max(0, tries - 1);
}

/** The cost of one node on the critical path: only an httpRequest node actually waits on the
 *  network. A Code/If/Webhook/RespondToWebhook node's own execution time is not part of this budget
 *  - exactly the assumption the original hand-picked sums already made for every node they left out. */
function nodeCost(node) {
  return node.type === 'n8n-nodes-base.httpRequest' ? worstCaseTries(node) : 0;
}

/** The worst-case (highest-cost) path cost from `fromName` to `toName` over wf's own connections,
 *  trying every output of every node on the way - whichever one a real execution actually takes. */
function worstPathCost(wf, fromName, toName) {
  const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
  const conns = wf.connections || {};
  assert.ok(byName[fromName], fromName + ': node not found in ' + wf.name);
  assert.ok(byName[toName], toName + ': node not found in ' + wf.name);
  let best = null;

  function walk(name, acc, onPath) {
    if (onPath.has(name)) return; // a cycle here would be a build bug, not a real n8n graph - never loop
    const total = acc + nodeCost(byName[name]);
    if (name === toName) { if (best === null || total > best) best = total; return; }
    const outs = conns[name];
    if (!outs || !Array.isArray(outs.main)) return;
    const nextPath = new Set(onPath);
    nextPath.add(name);
    for (const branch of outs.main) {
      for (const edge of branch || []) {
        if (edge && edge.node && byName[edge.node]) walk(edge.node, total, nextPath);
      }
    }
  }
  walk(fromName, 0, new Set());
  assert.ok(best !== null, 'no path found from ' + fromName + ' to ' + toName + ' in ' + wf.name);
  return best;
}

test('agent-travel-check: every path from the webhook to Answer fits the 40s budget, including the danger-path alert POST', () => {
  const wf = WF('agent-travel-check');
  const total = worstPathCost(wf, 'Check a medicine photo', 'Answer');
  assert.ok(total <= BUDGET_MS, 'worst case ' + total + 'ms exceeds the ' + BUDGET_MS + 'ms budget');
});

test('agent-extraction: every path from the webhook to Answer fits the 40s budget, including the save:true path\'s save POST', () => {
  const wf = WF('agent-extraction');
  const total = worstPathCost(wf, 'Extract a prescription', 'Answer');
  assert.ok(total <= BUDGET_MS, 'worst case ' + total + 'ms exceeds the ' + BUDGET_MS + 'ms budget');
});

test('regression: this walk actually catches the original bug - reverting the alert POST to api()\'s old 15000ms default blows the budget', () => {
  // Proves the graph walk above would have caught A5's original gap, not just that it is satisfied
  // by whatever numbers happen to be committed today.
  const wf = WF('agent-travel-check');
  const committed = wf.nodes.find((n) => n.name === 'backend: raise the alert');
  assert.ok(committed.parameters.options.timeout < 15000, 'the committed alert timeout must actually be tighter than api()\'s 15000ms default');
  const reverted = JSON.parse(JSON.stringify(wf));
  reverted.nodes.find((n) => n.name === 'backend: raise the alert').parameters.options.timeout = 15000;
  const total = worstPathCost(reverted, 'Check a medicine photo', 'Answer');
  assert.ok(total > BUDGET_MS, 'sanity: reverting the alert timeout to the old 15000ms default should blow the ' + BUDGET_MS + 'ms budget (got ' + total + 'ms) - otherwise this test cannot be trusted to catch the regression again');
});

test('agent-travel-check: the primary vision node has no same-model retry - one try, then a DIFFERENT model on failure (error or timeout)', () => {
  const wf = WF('agent-travel-check');
  const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
  const primary = byName['Gemini: read the name on the box'];
  const fallback = byName['Gemini fallback: read the name on the box'];
  assert.equal(primary.maxTries, 1, 'must not retry the same model');
  assert.equal(primary.onError, 'continueErrorOutput', 'must route a failure to its fallback');
  assert.notEqual(primary.parameters.url, fallback.parameters.url, 'fallback must call a different model URL');
  assert.match(fallback.parameters.url, /gemini-3\.6-flash/, 'fallback is the same model the chat path already uses');
  // The fallback is the last leg: it must capture its own outcome (never throw), so the
  // deterministic Code node downstream can read a statusCode whichever model actually answered.
  assert.equal(fallback.parameters.options.response.response.neverError, true);
  assert.equal(primary.parameters.options.response.response.neverError, false, 'must actually throw on failure to reach its error output');
});

test('agent-extraction: the primary vision node has no same-model retry - one try, then a DIFFERENT model on failure (error or timeout)', () => {
  const wf = WF('agent-extraction');
  const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
  const primary = byName['Gemini: read the prescription'];
  const fallback = byName['Gemini fallback: read the prescription'];
  assert.equal(primary.maxTries, 1, 'must not retry the same model');
  assert.equal(primary.onError, 'continueErrorOutput', 'must route a failure to its fallback');
  assert.notEqual(primary.parameters.url, fallback.parameters.url, 'fallback must call a different model URL');
  assert.match(fallback.parameters.url, /gemini-3\.6-flash/, 'fallback is the same model the chat path already uses');
  assert.equal(fallback.parameters.options.response.response.neverError, true);
  assert.equal(primary.parameters.options.response.response.neverError, false, 'must actually throw on failure to reach its error output');
});

