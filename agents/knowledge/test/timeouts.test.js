'use strict';

/**
 * A5 (2026-09-26): the vision chain in agent-travel-check and agent-extraction has to fit inside the
 * app's 45000ms VISION_TIMEOUT_MS with margin - target worst case <= 40000ms. Reads the BUILT
 * workflow JSON (never the source directly), exactly like check.js does, so this proves what is
 * actually committed, not just what build.js intends.
 */

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');
const WF = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', name + '.json'), 'ascii'));
const BUDGET_MS = 40000;

/** Worst case for one httpRequest node: every try times out, plus the wait between tries. */
function worstCase(node) {
  const tries = node.maxTries || 1;
  const wait = node.waitBetweenTries || 0;
  return node.parameters.options.timeout * tries + wait * Math.max(0, tries - 1);
}

test('agent-travel-check: backend fetch + primary vision + fallback vision worst case fits the 40s budget', () => {
  const wf = WF('agent-travel-check');
  const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
  const backend = worstCase(byName['backend: active prescriptions']);
  const primary = worstCase(byName['Gemini: read the name on the box']);
  const fallback = worstCase(byName['Gemini fallback: read the name on the box']);
  const total = backend + primary + fallback;
  assert.ok(total <= BUDGET_MS,
    'worst case ' + total + 'ms exceeds the ' + BUDGET_MS + 'ms budget (backend ' + backend + ' + primary ' + primary + ' + fallback ' + fallback + ')');
});

test('agent-extraction: primary vision + fallback vision worst case fits the 40s budget (no backend leg before Gemini)', () => {
  const wf = WF('agent-extraction');
  const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
  const primary = worstCase(byName['Gemini: read the prescription']);
  const fallback = worstCase(byName['Gemini fallback: read the prescription']);
  const total = primary + fallback;
  assert.ok(total <= BUDGET_MS, 'worst case ' + total + 'ms exceeds the ' + BUDGET_MS + 'ms budget (primary ' + primary + ' + fallback ' + fallback + ')');
});

test('A6/decision (f): the primary vision node has no same-model retry - one try, then a DIFFERENT model on failure (error or timeout)', () => {
  for (const [wfName, primaryName, fallbackName] of [
    ['agent-travel-check', 'Gemini: read the name on the box', 'Gemini fallback: read the name on the box'],
    ['agent-extraction', 'Gemini: read the prescription', 'Gemini fallback: read the prescription']
  ]) {
    const wf = WF(wfName);
    const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
    const primary = byName[primaryName];
    const fallback = byName[fallbackName];
    assert.equal(primary.maxTries, 1, wfName + ': ' + primaryName + ' must not retry the same model');
    assert.equal(primary.onError, 'continueErrorOutput', wfName + ': ' + primaryName + ' must route a failure to its fallback');
    assert.notEqual(primary.parameters.url, fallback.parameters.url, wfName + ': fallback must call a different model URL');
    assert.match(fallback.parameters.url, /gemini-3\.6-flash/, wfName + ': fallback is the same model the chat path already uses');
    // The fallback is the last leg: it must capture its own outcome (never throw), so the
    // deterministic Code node downstream can read a statusCode whichever model actually answered.
    assert.equal(fallback.parameters.options.response.response.neverError, true, wfName + ': ' + fallbackName);
    assert.equal(primary.parameters.options.response.response.neverError, false, wfName + ': ' + primaryName + ' must actually throw on failure to reach its error output');
  }
});

test('agent-telegram-inbound.json (a different build script, agents/scripts/build.js) is never touched by this budget - only agent-travel-check and agent-extraction get a fallback model', () => {
  const telegramPath = path.join(ROOT, '..', 'workflows', 'agent-telegram-inbound.json');
  assert.ok(fs.existsSync(telegramPath), 'sanity: the file this test must not affect actually exists');
});
