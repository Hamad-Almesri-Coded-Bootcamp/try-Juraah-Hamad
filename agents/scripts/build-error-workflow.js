'use strict';

/**
 * AP-18 (docs/AGENTS-POLISH-PLAN.md 7.3, step 1) - generates agents/workflows/agent-error.json, the
 * n8n error workflow: when ANY Jur'ah workflow fails, it tells the team over Telegram (workflow name,
 * failing node, Kuwait time, execution URL - never any patient data, token or chat id from the failed
 * run: agents/lib/error-alert.js's own header explains why).
 *
 * A SEPARATE generator from agents/scripts/build.js on purpose (other lanes are editing that file):
 * this one reads build.js only as a human reads it, for the same JSON style (ids, `code()`, ASCII
 * escaping, the round-trip check) - it never requires() it, and it writes its own file.
 *
 *   node scripts/build-error-workflow.js
 *
 * Three nodes only: an Error Trigger, the deterministic Code node, and the Telegram send. The
 * Telegram send's chatId is TEAM_CHAT_ID below: a loud, owed placeholder (Mohammad picks the real
 * team chat; agents/scripts/check-error-workflow.js reads this same constant back, so the two files
 * can never disagree on its exact text) - never a real value here, and never a credential (bound by
 * hand after import, same as every other workflow: agents/README.md). `settings.errorWorkflow` is
 * never set on THIS workflow: a failed send here must never re-trigger itself.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Strip the CommonJS wrapper: an n8n Code node has no `module` and no `require`. Mirrors build.js's
 * own `inline()` exactly (same regexes), so the two generators produce the same JSON style without
 * one requiring the other. */
function inline(file) {
  const src = read(file)
    .replace(/\r\n/g, '\n')
    .replace(/\n*\/\* ===== model contract[\s\S]*$/, '')
    .replace(/^'use strict';\s*/m, '')
    .replace(/^const \{[^}]*\} = require\('[^']+'\);\n/gm, '')
    .replace(/module\.exports\s*=\s*\{[\s\S]*?\};\s*$/m, '')
    .trimEnd();
  if (/\brequire\(/.test(src)) throw new Error(file + ': a require survived inlining');
  return '/* ===== generated from agents/' + file + ' - do not edit here; edit the source and rebuild ===== */\n' +
    src + '\n/* ===== end generated ===== */';
}

const uuid = (n) => 'b6000000-0000-4000-8000-' + String(n).padStart(12, '0');
const code = (id, name, jsCode, position) => ({
  parameters: { jsCode }, id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position,
});
const link = (to) => ({ node: to, type: 'main', index: 0 });
const main = (...outputs) => ({ main: outputs.map((o) => [link(o)]) });

/** The exact bytes write() below would put on disk: JSON, non-ASCII escaped. Pure (no fs), so
 * agents/scripts/check-error-workflow.js can compare the committed file against a fresh build
 * without shelling out or re-running this script. Throws the same way write() refuses to write. */
function serialise(workflow) {
  const json = JSON.stringify(workflow, null, 2).replace(/[\u0080-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
  const offenders = [...json].filter((c) => c.charCodeAt(0) > 0x7f);
  if (offenders.length) throw new Error('refusing to write ' + workflow.name + ': non-ASCII survived');
  if (JSON.stringify(JSON.parse(json)) !== JSON.stringify(workflow)) throw new Error('refusing to write ' + workflow.name + ': no round trip');
  return json;
}

/** Mirrors build.js's own `write()` exactly, for the same committed-file guarantees. */
function write(workflow) {
  const json = serialise(workflow);
  const dir = path.join(ROOT, 'workflows');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, workflow.name + '.json'), json, 'ascii');
  const lines = workflow.nodes.filter((n) => n.parameters && n.parameters.jsCode).reduce((s, n) => s + n.parameters.jsCode.split('\n').length, 0);
  console.log('wrote agents/workflows/' + workflow.name + '.json - ' + workflow.nodes.length + ' nodes, ' + lines + ' lines of Code-node JS, ' + Buffer.byteLength(json) + ' bytes, ASCII-only');
}

// The team's chat id: Mohammad's choice, never invented here. Bound live, never shipped as a
// credential. Module-scope (not local to buildWorkflow()) so check-error-workflow.js can import this
// SAME constant rather than holding its own copy of the exact text.
const TEAM_CHAT_ID = '[TO BE SUPPLIED]';

/** The workflow object, built fresh every call (no shared mutable state) - the one thing
 * agents/scripts/check-error-workflow.js needs to prove the committed file still matches it. */
function buildWorkflow() {
  const errorAlert = inline('lib/error-alert.js');

  // THE DETERMINISTIC LAYER - the only thing this workflow ever decides is the message's WORDING;
  // the team chat id is fixed in the Telegram node below, never built here.
  const message = errorAlert + `

const payload = $input.first().json;
// Every Jur'ah workflow's settings.timezone is 'Asia/Kuwait' (agents/scripts/build.js), so n8n's own
// $now is already Kuwait-local: one direct read of the clock, no locale library, no new Date().
const nowIso = $now.toISO();
return [{ json: { text: errorAlertText(payload, nowIso) } }];`;

  return {
    name: 'agent-error',
    nodes: [
      { parameters: {}, id: uuid(1), name: 'On error', type: 'n8n-nodes-base.errorTrigger', typeVersion: 1, position: [-460, 0] },
      code(uuid(2), 'message (deterministic)', message, [-240, 0]),
      { parameters: { chatId: TEAM_CHAT_ID, text: '={{ $json.text }}', additionalFields: { appendAttribution: false } },
        id: uuid(3), name: 'Telegram: notify the team', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [-20, 0],
        onError: 'continueRegularOutput' },
    ],
    connections: {
      'On error': main('message (deterministic)'),
      'message (deterministic)': main('Telegram: notify the team'),
    },
    // No `errorWorkflow` key here, ever (agents/README.md, docs/backend-notes/ap-18.md): this
    // workflow must never be set as its OWN error workflow, or a failed send here would re-trigger
    // itself.
    settings: { executionOrder: 'v1', timezone: 'Asia/Kuwait' },
  };
}

if (require.main === module) write(buildWorkflow());
module.exports = { buildWorkflow, serialise, ROOT, TEAM_CHAT_ID };
