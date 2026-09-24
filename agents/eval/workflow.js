'use strict';

/**
 * The committed n8n workflows as the evaluation's source of truth. The harness never re-implements
 * a workflow: it runs the workflow's OWN Code nodes (the exact code n8n runs, read from
 * agents/workflows and agents/knowledge/workflows) and replaces only the model call and the
 * backend reads. For a Basic LLM Chain node it reads the node's own prompt, schema and models.
 */

const fs = require('node:fs');
const path = require('node:path');

const AGENTS = path.join(__dirname, '..');
const FILES = {
  'agent-telegram-inbound': 'workflows/agent-telegram-inbound.json',
  'agent-webchat': 'workflows/agent-webchat.json',
  'agent-alexa': 'workflows/agent-alexa.json',
  'agent-extraction': 'knowledge/workflows/agent-extraction.json',
  'agent-travel-check': 'knowledge/workflows/agent-travel-check.json',
  'agent-interaction-screening-ddinter': 'knowledge/workflows/agent-interaction-screening-ddinter.json',
};
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const cache = new Map();
function loadWorkflow(name) {
  if (!FILES[name]) throw new Error('no committed workflow is known as ' + name);
  if (!cache.has(name)) {
    const file = path.join(AGENTS, FILES[name]);
    if (!fs.existsSync(file)) throw new Error('the committed workflow ' + FILES[name] + ' does not exist');
    cache.set(name, JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  return cache.get(name);
}

function nodeOf(wf, name, type) {
  const n = wf.nodes.find((x) => x.name === name);
  if (!n) throw new Error('the committed workflow ' + wf.name + ' has no node "' + name + '"');
  if (type && n.type !== type) throw new Error(wf.name + ' / "' + name + '" is a ' + n.type + ', not a ' + type);
  return n;
}

const compiled = new Map();
/**
 * Run one committed Code node as n8n does: an async function body over `$input` and `$`.
 *   input  the JSON of the items arriving at the node
 *   refs   { "<node name>": [json, ...] } for every $('<node name>') the code reads
 * Returns the JSON of the items it outputs.
 */
async function runCode(wf, name, { input, refs = {} }) {
  const n = nodeOf(wf, name, 'n8n-nodes-base.code');
  const key = wf.name + '\u0000' + name;
  if (!compiled.has(key)) compiled.set(key, new AsyncFunction('$input', '$', n.parameters.jsCode));
  const wrap = (list) => list.map((json) => ({ json }));
  const items = wrap(input);
  const $input = { first: () => items[0], all: () => items };
  const $ = (ref) => {
    if (!Object.prototype.hasOwnProperty.call(refs, ref)) throw new Error('"' + name + '" read the node "' + ref + '", which the evaluation did not supply');
    const r = wrap(refs[ref]);
    return { first: () => r[0], all: () => r };
  };
  const out = await compiled.get(key).call({ helpers: {} }, $input, $);
  return (Array.isArray(out) ? out : []).map((x) => x && x.json);
}

/** Every connection of `type` that ends at `target`, as { from, index }. */
function into(wf, target, type) {
  const out = [];
  for (const [from, outputs] of Object.entries(wf.connections || {})) {
    for (const branch of outputs[type] || []) for (const c of branch) if (c.node === target) out.push({ from, index: c.index });
  }
  return out.sort((a, b) => a.index - b.index);
}

/**
 * The model contract of a Basic LLM Chain node, read from the node itself: its one prompt message
 * (n8n sends it as the system message), the manual schema of its structured-output parser, and its
 * Gemini models in fallback order with each model node's temperature and retry policy.
 */
function chainContract(wf, chainName) {
  const chain = nodeOf(wf, chainName, '@n8n/n8n-nodes-langchain.chainLlm');
  const mv = chain.parameters.messages && chain.parameters.messages.messageValues;
  if (!Array.isArray(mv) || mv.length !== 1 || typeof mv[0].message !== 'string') throw new Error(wf.name + ' / "' + chainName + '" must carry exactly one prompt message');
  if (mv[0].type !== undefined && mv[0].type !== 'SystemMessagePromptTemplate') {
    throw new Error(wf.name + ' / "' + chainName + '": the prompt is a ' + mv[0].type + ' message; the evaluation sends it as the system instruction');
  }
  const parsers = into(wf, chainName, 'ai_outputParser').map((x) => nodeOf(wf, x.from, '@n8n/n8n-nodes-langchain.outputParserStructured'));
  if (parsers.length !== 1 || parsers[0].parameters.schemaType !== 'manual') throw new Error(wf.name + ' / "' + chainName + '" must have one manual structured-output parser');
  const models = into(wf, chainName, 'ai_languageModel').map((x) => nodeOf(wf, x.from, '@n8n/n8n-nodes-langchain.lmChatGoogleGemini'));
  if (models.length === 0) throw new Error(wf.name + ' / "' + chainName + '" has no Gemini model');
  return {
    prompt: mv[0].message,
    schemaText: parsers[0].parameters.inputSchema,
    textExpression: chain.parameters.text,
    models: models.map((m) => ({
      node: m.name,
      model: m.parameters.modelName,
      temperature: m.parameters.options ? m.parameters.options.temperature : undefined,
      tries: m.retryOnFail ? (m.maxTries || 1) : 1,
      waitMs: m.retryOnFail ? (m.waitBetweenTries || 0) : 0,
    })),
  };
}

/** An HTTP node that calls Gemini's generateContent: its URL and its retry policy. */
function visionNode(wf, name) {
  const n = nodeOf(wf, name, 'n8n-nodes-base.httpRequest');
  const url = n.parameters.url;
  if (!/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/[A-Za-z0-9._-]+:generateContent$/.test(String(url))) {
    throw new Error(wf.name + ' / "' + name + '" does not call a fixed Gemini generateContent URL (' + url + ')');
  }
  return { url, tries: n.retryOnFail ? (n.maxTries || 1) : 1, waitMs: n.retryOnFail ? (n.waitBetweenTries || 0) : 0 };
}

module.exports = { AGENTS, FILES, loadWorkflow, nodeOf, runCode, chainContract, visionNode };
