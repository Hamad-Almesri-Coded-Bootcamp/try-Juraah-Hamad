'use strict';

/**
 * AP-08 "one string": the prompt and schema each model node sends live in the lib module that owns
 * the logic, and the committed workflow carries exactly those. The evaluation reads the same exports
 * (agents/eval/sets.js), so the workflow and the evaluation send one string.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadWorkflow, chainContract } = require('../eval/workflow.js');
const A = require('../lib/adherence.js');
const W = require('../lib/webchat.js');
const V = require('../lib/voice-actions.js');

const CHAINS = [
  { wf: 'agent-telegram-inbound', node: 'Gemini: classify the reply', prompt: A.CLASSIFY_PROMPT, schema: A.CLASSIFY_SCHEMA, lib: 'adherence.js' },
  { wf: 'agent-webchat', node: 'Gemini: classify the question', prompt: W.WEBCHAT_PROMPT, schema: W.WEBCHAT_SCHEMA, lib: 'webchat.js' },
  { wf: 'agent-alexa', node: 'Gemini: understand the sentence', prompt: V.FREE_TALK_PROMPT, schema: V.FREE_TALK_SCHEMA, lib: 'voice-actions.js' },
];

for (const c of CHAINS) {
  test('AP-08 one string: ' + c.wf + ' "' + c.node + '" sends agents/lib/' + c.lib + "'s prompt and schema", () => {
    assert.equal(typeof c.prompt, 'string');
    assert.ok(c.prompt.length > 200);
    const got = chainContract(loadWorkflow(c.wf), c.node);
    assert.equal(got.prompt, c.prompt);
    assert.equal(got.schemaText, JSON.stringify(c.schema, null, 2));
    assert.ok(got.models.length >= 1 && got.models.every((m) => /^models\/gemini-/.test(m.model)));
  });
}

test('AP-08 one string: each schema offers exactly the intents its trust rule accepts (G11)', () => {
  assert.deepEqual(A.CLASSIFY_SCHEMA.properties.intent.enum, A.INTENTS);
  assert.deepEqual(W.WEBCHAT_SCHEMA.properties.intent.enum, W.WEBCHAT_INTENTS);
  assert.deepEqual(V.FREE_TALK_SCHEMA.properties.intent.enum, V.FREE_INTENTS);
  assert.deepEqual(V.FREE_TALK_SCHEMA.properties.items.items.properties.status.enum, V.RECORD_WORDS);
});

test('AP-08 one string: no Code node carries a model contract, and build.js holds no prompt text of its own', () => {
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'workflows')).filter((x) => x.endsWith('.json'))) {
    const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', f), 'utf8'));
    for (const n of wf.nodes.filter((x) => x.type === 'n8n-nodes-base.code')) {
      assert.doesNotMatch(n.parameters.jsCode, /model contract|CLASSIFY_PROMPT|WEBCHAT_PROMPT|FREE_TALK_PROMPT|CLASSIFY_SCHEMA|WEBCHAT_SCHEMA|FREE_TALK_SCHEMA/, f + ' / ' + n.name);
    }
  }
  const build = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build.js'), 'utf8');
  for (const words of ['You classify ONE short reply', 'You classify ONE message a patient typed', 'You read ONE sentence a patient said']) {
    assert.ok(!build.includes(words), 'build.js still holds the prompt starting "' + words + '"');
  }
});
