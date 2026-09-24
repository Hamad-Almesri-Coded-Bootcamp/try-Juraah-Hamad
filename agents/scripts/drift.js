'use strict';

/**
 * AP-01 - the drift check: does the live n8n instance run exactly what the repository generates?
 *
 * Both sides are reduced to one sha-256 per node by the SAME normalisation (NORMALISE_SOURCE below):
 * ids, positions, credential ids, versionId and timestamps are dropped; node type, typeVersion,
 * parameters (Code-node source included, CRLF folded) and the execution settings are kept. The Alexa
 * skill id and device links are live-only config on purpose (the repository ships them empty) - they
 * are replaced by a marker before hashing and are never printed.
 *
 *   node scripts/drift.js --snippet            print the snippet to run in the n8n page (it prints the live hashes)
 *   node scripts/drift.js --live live.json     compare the repository with those live hashes; exit 1 on any drift
 *   N8N_BASE_URL=... N8N_API_KEY=... node scripts/drift.js --api   the same, reading the live side from the n8n API
 *
 * It FAILS (exit 1) when a node differs, when a committed workflow has no live counterpart, and when a
 * live Jur'ah workflow (name starting "agent-") has no committed file. A missing input is a failure,
 * never a pass.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DIRS = [path.join(__dirname, '..', 'workflows'), path.join(__dirname, '..', 'knowledge', 'workflows')];

/** One source of truth for the normalisation: eval'd here, and pasted verbatim into the n8n page. */
const NORMALISE_SOURCE = String.raw`(function normaliseNode(n) {
  var CFG = /const ALEXA_SKILL_ID = .*;\nconst ALEXA_LINKS = .*;/;
  var p = JSON.parse(JSON.stringify(n.parameters || {}));
  if (typeof p.jsCode === 'string') p.jsCode = p.jsCode.replace(/\r\n/g, '\n').replace(CFG, '<ALEXA_CONFIG>');
  var sort = function (v) { if (Array.isArray(v)) return v.map(sort); if (v && typeof v === 'object') { var o = {}; Object.keys(v).sort().forEach(function (k) { o[k] = sort(v[k]); }); return o; } return v; };
  return JSON.stringify(sort({ type: n.type, typeVersion: n.typeVersion, parameters: p, executeOnce: !!n.executeOnce, retryOnFail: !!n.retryOnFail, maxTries: n.maxTries || null, onError: n.onError || null }));
})`;
// eslint-disable-next-line no-eval
const normaliseNode = eval(NORMALISE_SOURCE);
const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);

function hashesOf(workflow) {
  const nodes = {};
  for (const n of workflow.nodes) nodes[n.name] = sha(normaliseNode(n));
  const conn = sha(JSON.stringify(workflow.connections || {}));
  return { nodes, connections: conn };
}

function repoHashes() {
  const out = {};
  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const wf = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      out[wf.name] = hashesOf(wf);
    }
  }
  return out;
}

const SNIPPET = `// Paste in the browser console on your n8n instance (logged in). It prints the live hashes as JSON.
(async () => {
  const normaliseNode = ${NORMALISE_SOURCE};
  const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  const list = (await (await fetch('/rest/workflows?limit=250')).json()).data.filter((w) => /^agent-/.test(w.name) && w.active && !w.isArchived);
  const out = {};
  for (const w of list) {
    const wf = (await (await fetch('/rest/workflows/' + w.id)).json()).data;
    const nodes = {};
    for (const n of wf.nodes) nodes[n.name] = await sha(normaliseNode(n));
    out[wf.name] = { id: wf.id, nodes, connections: await sha(JSON.stringify(wf.connections || {})) };
  }
  console.log(JSON.stringify(out));
  return out;
})();`;

async function liveFromApi() {
  const base = (process.env.N8N_BASE_URL || '').replace(/\/$/, '');
  const key = process.env.N8N_API_KEY || '';
  if (!base || !key) throw new Error('--api needs N8N_BASE_URL and N8N_API_KEY in the environment');
  const get = async (p) => { const r = await fetch(base + '/api/v1' + p, { headers: { 'X-N8N-API-KEY': key } }); if (!r.ok) throw new Error('n8n API ' + r.status + ' on ' + p); return r.json(); };
  const list = (await get('/workflows?active=true&limit=250')).data.filter((w) => /^agent-/.test(w.name));
  const out = {};
  for (const w of list) { const wf = await get('/workflows/' + w.id); out[wf.name] = { id: wf.id, ...hashesOf(wf) }; }
  return out;
}

function compare(repo, live) {
  const problems = [];
  const report = [];
  for (const [name, r] of Object.entries(repo)) {
    const l = live[name];
    if (!l) { problems.push(name + ': committed, but no ACTIVE live workflow of that name'); continue; }
    const differ = [];
    for (const [node, h] of Object.entries(r.nodes)) {
      if (!(node in l.nodes)) differ.push(node + ' (only in the repository)');
      else if (l.nodes[node] !== h) differ.push(node);
    }
    for (const node of Object.keys(l.nodes)) if (!(node in r.nodes)) differ.push(node + ' (only live)');
    if (l.connections !== r.connections) differ.push('(connections)');
    report.push((differ.length ? 'DRIFT  ' : 'same   ') + name + (differ.length ? ': ' + differ.join(', ') : ''));
    if (differ.length) problems.push(name + ': ' + differ.length + ' difference(s)');
  }
  for (const name of Object.keys(live)) if (!repo[name]) problems.push(name + ': live, but no committed workflow file');
  return { report, problems };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--snippet')) { console.log(SNIPPET); return; }
  let live;
  if (args.includes('--api')) live = await liveFromApi();
  else {
    const i = args.indexOf('--live');
    if (i < 0 || !args[i + 1]) throw new Error('usage: drift.js --snippet | --live <live-hashes.json> | --api');
    live = JSON.parse(fs.readFileSync(args[i + 1], 'utf8'));
  }
  const { report, problems } = compare(repoHashes(), live);
  for (const line of report) console.log(line);
  if (problems.length) {
    console.log('\nDRIFT: ' + problems.length + ' problem(s)');
    for (const p of problems) console.log('  - ' + p);
    process.exitCode = 1;
  } else console.log('\nno drift');
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exitCode = 1; });
module.exports = { normaliseNode, hashesOf, repoHashes, compare, NORMALISE_SOURCE };
