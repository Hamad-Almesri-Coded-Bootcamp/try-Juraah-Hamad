'use strict';

/**
 * AP-01 - the drift check: does the live n8n instance run exactly what the repository generates?
 * AP-16 (row 3, "no drift") adds the STATIC half below: do the committed workflows regenerate
 * byte-identically from the source that is actually committed? The live half (does the live n8n
 * instance match the committed workflows?) is unchanged - --live / --api / --snippet, exactly as
 * before. Runtime proof: the AP-13 read-back (npm run drift -- --live <hashes.json>, run after every
 * publish) - the static half below has no live counterpart to prove; it either regenerates
 * byte-identically or it does not.
 *
 * Both sides are reduced to one sha-256 per node by the SAME normalisation (NORMALISE_SOURCE below):
 * ids, positions, credential ids, versionId and timestamps are dropped; node type, typeVersion,
 * parameters (Code-node source included, CRLF folded) and the execution settings are kept. The Alexa
 * skill id and device links are live-only config on purpose (the repository ships them empty) - they
 * are replaced by a marker before hashing and are never printed. AP-18: agent-error's Telegram node
 * carries the same kind of live-only config - the team's real chat id, set by hand after import - so
 * a literal (non-expression) `chatId` is masked the same way before hashing; every other workflow's
 * Telegram nodes address `chatId` with a `={{ ... }}` expression, so this never hides drift in one of
 * those.
 *
 *   node scripts/drift.js --snippet            print the snippet to run in the n8n page (it prints the live hashes)
 *   node scripts/drift.js --live live.json     compare the repository with those live hashes; exit 1 on any drift
 *   N8N_BASE_URL=... N8N_API_KEY=... node scripts/drift.js --api   the same, reading the live side from the n8n API
 *   node scripts/drift.js --static              regenerate every committed workflow in a scratch copy
 *                                                and diff it against the committed JSON; exit 1 on any diff
 *
 * It FAILS (exit 1) when a node differs, when a committed workflow has no live counterpart, and when a
 * live Jur'ah workflow (name starting "agent-") has no committed file. A missing input is a failure,
 * never a pass.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DIRS = [path.join(__dirname, '..', 'workflows'), path.join(__dirname, '..', 'knowledge', 'workflows')];
/** A build-time value, not a secret: the API base every committed workflow carries once generated
 * for the demo. The static half always regenerates against this, never against N8N_WEBHOOK_BASE or
 * whatever else happens to be in the shell's environment, so the check is the same on every machine. */
const PROD_API_BASE = 'https://tryjuraaah.vercel.app/api/agent';

/** One source of truth for the normalisation: eval'd here, and pasted verbatim into the n8n page. */
const NORMALISE_SOURCE = String.raw`(function normaliseNode(n) {
  var CFG = /const ALEXA_SKILL_ID = .*;\nconst ALEXA_LINKS = .*;/;
  var p = JSON.parse(JSON.stringify(n.parameters || {}));
  if (typeof p.jsCode === 'string') p.jsCode = p.jsCode.replace(/\r\n/g, '\n').replace(CFG, '<ALEXA_CONFIG>');
  // AP-18: a literal chatId (never one written as an '={{ ... }}' expression) is live-only config,
  // masked the same way as the Alexa skill id and device links above.
  if (typeof p.chatId === 'string' && p.chatId.slice(0, 2) !== '={') p.chatId = '<CHAT_ID>';
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

const foldCRLF = (s) => s.replace(/\r\n/g, '\n');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function clearJsonFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) fs.unlinkSync(path.join(dir, f));
}

/**
 * Runs one package's own generator - `scripts.build` in `<dir>/package.json`, in `dir` - against
 * PROD_API_BASE, with N8N_WEBHOOK_BASE removed from the child's environment so nothing but that base
 * can reach a committed workflow. `scripts.build` may chain several commands with `&&`
 * (agents/package.json does: build.js, then build-error-workflow.js); every part must be exactly
 * `node <script>`, or it is reported as a problem, never silently skipped or run anyway. A generator
 * that exits non-zero is caught here and reported too, named by the package (never left to crash the
 * caller, so a second package still gets checked). Returns a list of problems - empty is success.
 */
function regenerate(dir) {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch (e) {
    return [`${dir}: cannot read package.json (${e.message})`];
  }
  const label = pkg.name || dir;
  const build = (pkg.scripts && pkg.scripts.build) || '';
  const parts = build.split('&&').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return [`${label}: package.json has no scripts.build`];
  const env = { ...process.env, JURAH_API_BASE: PROD_API_BASE };
  delete env.N8N_WEBHOOK_BASE;
  const problems = [];
  for (const part of parts) {
    const m = /^node\s+(\S+)$/.exec(part);
    if (!m) { problems.push(`${label}: scripts.build has a part that is not "node <script>": ${part}`); continue; }
    try {
      execFileSync(process.execPath, [m[1]], { cwd: dir, env, stdio: 'pipe' });
    } catch (e) {
      const detail = (e.stderr && e.stderr.toString().trim().split('\n')[0]) || e.message;
      problems.push(`${label}: ${part} failed: ${detail}`);
    }
  }
  return problems;
}

/**
 * The static half of "no drift" (AP-16 row 3): does every committed workflow regenerate
 * byte-identically from the generator that is actually committed? Copies `agentsRoot` into a scratch
 * temp directory (never writes under `agentsRoot` itself, and removes the copy in a finally block),
 * deletes the copy's own workflows/*.json and knowledge/workflows/*.json, regenerates both packages,
 * then compares the copy's freshly generated files against the ORIGINAL committed ones. The committed
 * side is read with CRLF folded to LF (the generated JSON is ASCII-only LF; git ls-files --eol shows
 * some of these files checked out as CRLF on Windows even though the repository stores them as LF).
 * A committed file no generator wrote, a generated file that is not committed, any byte difference and
 * a generator that failed are all "problems" - never silently skipped. Returns { report, problems }.
 */
function staticDrift(agentsRoot = ROOT) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jurah-drift-'));
  const report = [];
  const problems = [];
  try {
    copyDir(agentsRoot, tmp);
    clearJsonFiles(path.join(tmp, 'workflows'));
    clearJsonFiles(path.join(tmp, 'knowledge', 'workflows'));

    problems.push(...regenerate(tmp));
    if (fs.existsSync(path.join(tmp, 'knowledge', 'package.json'))) problems.push(...regenerate(path.join(tmp, 'knowledge')));

    for (const sub of ['workflows', path.join('knowledge', 'workflows')]) {
      const committedDir = path.join(agentsRoot, sub);
      const generatedDir = path.join(tmp, sub);
      const committed = fs.existsSync(committedDir) ? fs.readdirSync(committedDir).filter((f) => f.endsWith('.json')) : [];
      const generated = fs.existsSync(generatedDir) ? fs.readdirSync(generatedDir).filter((f) => f.endsWith('.json')) : [];
      const names = [...new Set([...committed, ...generated])].sort();
      for (const name of names) {
        const label = path.join(sub, name).split(path.sep).join('/');
        if (committed.includes(name) && !generated.includes(name)) {
          report.push(`DIFF   ${label}  (committed, no generator wrote it)`);
          problems.push(`${label}: committed, but no generator wrote it`);
          continue;
        }
        if (!committed.includes(name) && generated.includes(name)) {
          report.push(`DIFF   ${label}  (generated, not committed)`);
          problems.push(`${label}: generated, but not committed`);
          continue;
        }
        const c = foldCRLF(fs.readFileSync(path.join(committedDir, name), 'utf8'));
        const g = fs.readFileSync(path.join(generatedDir, name), 'utf8');
        if (c === g) report.push(`same   ${label}`);
        else { report.push(`DIFF   ${label}`); problems.push(`${label}: differs from the committed file`); }
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return { report, problems };
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
  if (args.includes('--static')) {
    const { report, problems } = staticDrift();
    for (const line of report) console.log(line);
    if (problems.length) {
      console.log('\nSTATIC DRIFT: ' + problems.length + ' problem(s)');
      for (const p of problems) console.log('  - ' + p);
      console.log('\nrebuild: JURAH_API_BASE=' + PROD_API_BASE + ' npm run build; never hand-edit a workflow');
      process.exitCode = 1;
    } else {
      console.log('\nno static drift (' + report.length + ' workflows regenerate byte-identically)');
      console.log('the live half is not checked here: after every publish, run npm run drift -- --live <hashes.json> (the AP-13 read-back)');
    }
    return;
  }
  let live;
  if (args.includes('--api')) live = await liveFromApi();
  else {
    const i = args.indexOf('--live');
    if (i < 0 || !args[i + 1]) throw new Error('usage: drift.js --snippet | --live <live-hashes.json> | --api | --static');
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
module.exports = { normaliseNode, hashesOf, repoHashes, compare, NORMALISE_SOURCE, staticDrift, regenerate, PROD_API_BASE };
