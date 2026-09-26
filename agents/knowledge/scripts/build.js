'use strict';

/**
 * Generate agents/knowledge/workflows/*.json from the tested source in agents/knowledge/src/*.js
 * and the data in agents/knowledge/data/*.json.
 *
 *   src/*.js  -- unit-tested by test/*.test.js, and contract-tested against the backend's own
 *                validators by tests/unit/agent/knowledge-contract.test.ts
 *        v  node scripts/build.js
 *   workflows/agent-interaction-screening-ddinter.json   POST jurah/screen-prescription - the ONLY
 *                                                        workflow on this path (AP-04/CR-074 retired
 *                                                        the legacy agents/workflows/agent-interaction-
 *                                                        screening.json it used to share it with).
 *                                                        Every caller today is the backend's own
 *                                                        requestScreening (lib/agent-webhooks/core.ts
 *                                                        screeningPayload), after a save, an agent's
 *                                                        save, a reviewer's confirmation or a refill
 *                                                        (AP-10) - no n8n workflow calls it any more.
 *   workflows/agent-travel-check.json                    POST jurah/travel-check
 *   workflows/agent-extraction.json                      POST jurah/extract-prescription - reads the
 *                                                        backend's own screening outcome (AP-10's 201
 *                                                        body); it never calls screening itself (AP-04)
 *
 * The source is INLINED into each Code node (no Execute Workflow sub-workflow to re-select by hand
 * after import - that manual step is gone). Every file is written ASCII-only (\uXXXX escapes), as
 * agents/scripts/build.js does, because raw Arabic once reached a patient as mojibake through a
 * Windows clipboard. Never edit the jsCode inside the generated JSON - edit src/ and rebuild.
 *
 * Nothing secret is in these files. Three n8n credentials are bound by hand after import (README):
 * the agent bearer (Header Auth `Authorization: Bearer <JURAH_AGENT_TOKEN>`), the inbound secret
 * (Header Auth `x-jurah-secret: <JURAH_AGENT_INBOUND_SECRET>`), and the Gemini key.
 *
 * Build-time, not secret:
 *   JURAH_API_BASE    the deployed backend's agent base, e.g. https://tryjuraaah.vercel.app/api/agent
 *   N8N_WEBHOOK_BASE  the n8n instance's PRODUCTION webhook base (never /webhook-test/)
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
if (!process.env.JURAH_API_BASE) {
  throw new Error('JURAH_API_BASE is required (e.g. JURAH_API_BASE=https://tryjuraaah.vercel.app/api/agent npm run build) - refusing to write workflows that point nowhere');
}
const API_BASE = process.env.JURAH_API_BASE.replace(/\/+$/, '');
const N8N_WEBHOOK_BASE = (process.env.N8N_WEBHOOK_BASE || 'https://mohammad-aljry.app.n8n.cloud/webhook').replace(/\/+$/, '');
if (N8N_WEBHOOK_BASE.includes('/webhook-test')) throw new Error('N8N_WEBHOOK_BASE must be the production /webhook base, never /webhook-test');
if (!/^https:\/\//.test(API_BASE)) throw new Error('JURAH_API_BASE must be https');

// Travel Check's vision prompt and schema live in src/travel-check.js (CR-099(b)): required here
// rather than kept as a second copy, so the prompt this script sends and the one src/ tests against
// are the same string.
const { BRAND_PROMPT, RESPONSE_SCHEMA: TC_RESPONSE_SCHEMA } = require('../src/travel-check');

/** The primary vision model (verified live in agents/scripts/build.js on 21 Sep), and decision (f)'s
 *  fallback (2026-09-26): the same model agent-telegram-inbound's chat path already falls back to.
 *  Used for agent-travel-check and agent-extraction only - see the gemini() node builder (A5/A6). */
const PRIMARY_VISION_MODEL = 'gemini-3-flash-preview';
const FALLBACK_VISION_MODEL = 'gemini-3.6-flash';
const visionUrl = (model) => 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';

// ------------------------------------------------------------------------------ inlining
// A Windows checkout (core.autocrlf=true) hands us CRLF; the committed workflows are LF.
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

/** One src file without its CommonJS wrapper: an n8n Code node has no `module` and no `require`. */
function strip(file) {
  let src = read(file).replace(/^'use strict';\s*/m, '');
  src = src.replace(/^const \{[\s\S]*?\} = require\('\.\/[a-z-]+'\);\n/gm, '');
  src = src.replace(/module\.exports\s*=\s*\{[\s\S]*?\};\s*$/m, '');
  if (/\brequire\(/.test(src) || /module\.exports/.test(src)) throw new Error(file + ': a require/module.exports survived inlining');
  return src.trimEnd();
}
function inline(files) {
  return files.map((f) => '/* ===== generated from agents/knowledge/' + f + ' - do not edit here; edit the source and rebuild ===== */\n' + strip(f)).join('\n\n') +
    '\n/* ===== end generated ===== */';
}
const dataConst = (name, file) => 'const ' + name + ' = ' + JSON.stringify(JSON.parse(read(file))) + ';';

const CORE = ['src/normalise.js', 'src/severity.js', 'src/interactions.js', 'src/text.js', 'src/validate.js', 'src/screening.js'];
const SCREENING_SRC = dataConst('INDEX_JSON', 'data/interaction-index.json') + '\n' + inline(CORE) +
  '\nconst INDEX = loadIndex(INDEX_JSON);';
// CR-078 / AP-07: buildPendingNames needs the pendingVerification list to be an array - a guard that
// silently treated a missing or malformed list as "no pending brands" would pass with its input
// missing, which is worse than no guard. Checked at BUILD time (Node), never inside the Code node.
const BRAND_MAP_DATA = JSON.parse(read('data/brand-map.json'));
if (!Array.isArray(BRAND_MAP_DATA.pendingVerification && BRAND_MAP_DATA.pendingVerification.brands)) {
  throw new Error('data/brand-map.json: pendingVerification.brands must be an array - refusing to build agent-travel-check with the unverified-brand list missing');
}
// Decision (c), 2026-09-26: the whole Saudi SFDA registered-drug list becomes the brand source.
// Produced by another builder (agents/knowledge/data/sfda-brands.json); a missing file is simply "no
// SFDA rows" - never a build failure, since the brand-map.json rows alone are a complete build on
// their own (this is exactly how the file behaved before the SFDA source existed).
const SFDA_PATH = path.join(ROOT, 'data/sfda-brands.json');
const SFDA_NAMES_JSON = fs.existsSync(SFDA_PATH) ? JSON.stringify(JSON.parse(read('data/sfda-brands.json')).names || {}) : '{}';
const TRAVEL_SRC = dataConst('INDEX_JSON', 'data/interaction-index.json') + '\n' + dataConst('BRAND_MAP_JSON', 'data/brand-map.json') + '\n' +
  'const SFDA_NAMES = ' + SFDA_NAMES_JSON + ';\n' +
  inline(['src/normalise.js', 'src/severity.js', 'src/interactions.js', 'src/resolve.js', 'src/text.js', 'src/validate.js', 'src/screening.js', 'src/travel-check.js']) +
  '\nconst INDEX = loadIndex(INDEX_JSON);\nconst BRAND_INDEX = buildBrandIndex(BRAND_MAP_JSON.brands, INDEX, SFDA_NAMES);' +
  '\nconst PENDING_NAMES = buildPendingNames(BRAND_MAP_JSON.pendingVerification.brands);';
const EXTRACTION_SRC = inline(['src/extraction.js']);
const CONFIG = 'const API = ' + JSON.stringify(API_BASE) + ';\nconst N8N = ' + JSON.stringify(N8N_WEBHOOK_BASE) + ';';

/** Shared by every input node: the id shape the backend uses, and the image rules. */
const INPUT_HELPERS = `
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const IMAGE_TYPES = /^(image\\/(jpeg|png|webp|heic|heif))$/;
// 10 MB of image is ~13.4 MB of base64 - under n8n's default 16 MB request payload limit.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
function imageOf(b, allowPdf) {
  const mime = typeof b.mimeType === 'string' ? b.mimeType.toLowerCase() : '';
  const data = typeof b.imageBase64 === 'string' ? b.imageBase64.replace(/^data:[^,]*,/, '').replace(/\\s+/g, '') : '';
  if (!(IMAGE_TYPES.test(mime) || (allowPdf && mime === 'application/pdf'))) return { error: 'unsupported_mime_type' };
  if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return { error: 'image_missing_or_not_base64' };
  const bytes = Math.floor(data.length * 3 / 4);
  if (bytes > MAX_IMAGE_BYTES) return { error: 'image_too_large' };
  return { mime, data, bytes };
}`;

// ------------------------------------------------------------------------------ node builders
const uuid = (prefix, n) => prefix + String(n).padStart(12, '0');
const code = (id, name, jsCode, position) => ({ parameters: { jsCode }, id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position });

/** A call to the backend under the agent bearer. Full response, never throws: the next Code node
 * reads statusCode and decides (a refused write must never read as "done"). `opts` overrides the
 * timeout/retry defaults (A5: agent-travel-check's own backend fetch has to fit a tight budget
 * alongside its vision call - see the time-budget comment above the travel workflow's nodes). */
function api(id, name, method, url, position, jsonBody, opts) {
  const o = opts || {};
  const maxTries = o.maxTries || 2;
  const parameters = {
    method, url,
    authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: o.timeout || 15000 }
  };
  if (jsonBody) Object.assign(parameters, { sendBody: true, specifyBody: 'json', jsonBody });
  return { parameters, id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position,
           retryOnFail: (method === 'GET') && maxTries > 1, maxTries, waitBetweenTries: o.waitBetweenTries || 1000 };
}

/** A vision call. A5/A6 (2026-09-26): ONE try per model, never a same-model retry - on failure
 * (error or timeout) a node built with `hasFallback:true` routes to its error output instead of
 * throwing the whole execution, so it can be wired to a second gemini() node calling
 * FALLBACK_VISION_MODEL with the same body (decision (f)). The last leg in a chain omits
 * `hasFallback` and keeps `neverError:true`, so the deterministic Code node reads its outcome the
 * same way whichever model actually answered. */
function gemini(id, name, jsonBodyExpr, position, opts) {
  const o = opts || {};
  const node = {
    parameters: {
      method: 'POST', url: visionUrl(o.model || PRIMARY_VISION_MODEL),
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googlePalmApi',
      sendBody: true, specifyBody: 'json', jsonBody: jsonBodyExpr,
      options: { response: { response: { fullResponse: true, neverError: !o.hasFallback } }, timeout: o.timeout || 60000 }
    },
    id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position, retryOnFail: false, maxTries: 1, waitBetweenTries: 2000
  };
  if (o.hasFallback) node.onError = 'continueErrorOutput';
  return node;
}

function ifNode(id, name, expression, position) {
  return {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: id + '-c', leftValue: expression, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      },
      options: {}
    },
    id, name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position
  };
}

const webhook = (id, name, pathName, position, responseMode) => ({
  parameters: { httpMethod: 'POST', path: pathName, authentication: 'headerAuth', responseMode: responseMode || 'responseNode', options: {} },
  id, name, type: 'n8n-nodes-base.webhook', typeVersion: 2, position, webhookId: id
});

/** Fails the n8n execution AFTER the caller has its answer, so it shows in the execution list and
 * triggers the instance's error workflow. This is how "mustEscalate" reaches a human. */
const stopWithError = (id, name, message, position) => ({
  parameters: { errorType: 'errorMessage', errorMessage: message },
  id, name, type: 'n8n-nodes-base.stopAndError', typeVersion: 1, position
});

const respond = (id, name, position, responseCode) => ({
  parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify($json) }}', options: responseCode ? { responseCode } : {} },
  id, name, type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position
});

const link = (to) => ({ node: to, type: 'main', index: 0 });
const main = (...outputs) => ({ main: outputs.map((o) => (Array.isArray(o) ? o : [o]).filter(Boolean).map((n) => link(n))) });

/** A generated Code node this large means something got inlined that should not have been (most
 *  likely data/sfda-brands.json, once it exists) - fail the build rather than ship an n8n Code node
 *  this size. */
const CODE_NODE_LIMIT_BYTES = 2 * 1024 * 1024;

/** Escape every non-ASCII character; refuse to write if one survives or the file does not round-trip. */
function write(workflow) {
  for (const n of workflow.nodes) {
    if (n.parameters && typeof n.parameters.jsCode === 'string') {
      const bytes = Buffer.byteLength(n.parameters.jsCode, 'utf8');
      if (bytes > CODE_NODE_LIMIT_BYTES) {
        throw new Error('refusing to write ' + workflow.name + ': Code node "' + n.name + '" is ' + bytes +
          ' bytes, over the ' + CODE_NODE_LIMIT_BYTES + '-byte limit (check data/sfda-brands.json is not unexpectedly huge)');
      }
    }
  }
  const json = JSON.stringify(workflow, null, 2).replace(/[\u0080-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
  if ([...json].some((c) => c.charCodeAt(0) > 0x7f)) throw new Error('refusing to write ' + workflow.name + ': non-ASCII survived');
  if (JSON.stringify(JSON.parse(json)) !== JSON.stringify(workflow)) throw new Error('refusing to write ' + workflow.name + ': no round trip');
  const dir = path.join(ROOT, 'workflows');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, workflow.name + '.json'), json, 'ascii');
  const lines = workflow.nodes.filter((n) => n.parameters && n.parameters.jsCode).reduce((s, n) => s + n.parameters.jsCode.split('\n').length, 0);
  console.log('wrote agents/knowledge/workflows/' + workflow.name + '.json - ' + workflow.nodes.length + ' nodes, ' + lines + ' lines of Code-node JS, ' + Buffer.byteLength(json) + ' bytes, ASCII-only');
}

// =============================================================== 1. interaction screening
const SC = (n) => uuid('c1000000-0000-4000-8000-', n);

const SC_INPUT = CONFIG + '\n' + INPUT_HELPERS + `

// Body: { patientId, newPrescriptionId, language }. AP-04: every caller today is the backend's own
// requestScreening (lib/agent-webhooks/core.ts screeningPayload) - after a save, an agent's save, a
// reviewer's confirmation or a refill (AP-10, D10). No n8n workflow calls this directly any more.
// newPrescriptionId absent -> a whole-profile DRY RUN (nothing is sent to the backend; read the result
// in the execution's 'summary (deterministic)' node).
const b = $input.first().json.body || {};
const patientId = String(b.patientId || '');
const newPrescriptionId = b.newPrescriptionId === undefined || b.newPrescriptionId === null ? null : String(b.newPrescriptionId);
if (!ID.test(patientId) || (newPrescriptionId !== null && !ID.test(newPrescriptionId))) {
  return [{ json: { valid: false, ok: false, error: 'invalid_body', expected: '{ patientId, newPrescriptionId?, language?, dryRun? }' } }];
}
return [{ json: { valid: true, patientId, newPrescriptionId, language: b.language === 'en' ? 'en' : 'ar',
                  dryRun: newPrescriptionId === null || b.dryRun === true,
                  rxUrl: API + '/patients/' + encodeURIComponent(patientId) + '/prescriptions' } }];`;

const SC_SCREEN = SCREENING_SRC + `

// THE DETERMINISTIC LAYER: no model in this workflow at all. Grounded DDInter rows only; nothing cleared
// that could not be checked. Every alert is a POST /api/agent/alerts body, already validated.
const input = $('input (deterministic)').first().json;
const res = $input.first().json;
if (res.statusCode !== 200 || !res.body || !Array.isArray(res.body.prescriptions)) {
  return [{ json: { post: false, error: 'backend_prescriptions_http_' + res.statusCode, result: null } }];
}
const result = screenNewPrescription({ patientId: input.patientId, newPrescriptionId: input.newPrescriptionId,
  prescriptions: res.body.prescriptions, language: input.language, index: INDEX, dryRun: input.dryRun });
if (result.dryRun || result.alerts.length === 0) return [{ json: { post: false, error: null, result } }];
// One item per alert, all with post:true - never a mix, so exactly one branch runs downstream.
return result.alerts.map((alert) => ({ json: { post: true, error: null, alert, result } }));`;

const SC_SUMMARY = `
// The run's outcome, from what the backend ACTUALLY answered. Runs once (all items). Visible in the
// execution; a failure stops the execution with an error (next nodes).
const screened = $('screen (deterministic)').all().map((i) => i.json);
const first = screened[0] || {};
const result = first.result;
const posted = first.post === true;
const responses = posted ? $input.all().map((i) => i.json) : [];
const sent = posted ? screened.map((s, i) => ({
  severity: s.alert.severity, reviewStatus: s.alert.reviewStatus,
  statusCode: responses[i] ? responses[i].statusCode : null,
  alertId: responses[i] && responses[i].statusCode === 201 && responses[i].body && responses[i].body.alert ? responses[i].body.alert.id : null,
  error: responses[i] && responses[i].statusCode !== 201 ? (responses[i].body || null) : null
})) : [];
const refused = sent.filter((x) => x.statusCode !== 201);
// A danger alert the backend did not accept is the one outcome a human must see.
const mustEscalate = refused.some((x) => x.severity === 'danger') || !!(result && result.report && result.report.mustEscalate);
// A flagged NEW prescription is expected (screened once a reviewer confirms it); an id that is not an
// active prescription of this patient is a caller error.
const callerError = !!(result && result.screened === false && result.reason === 'not_an_active_prescription_of_this_patient');
return [{ json: {
  ok: !first.error && !callerError && refused.length === 0 && !mustEscalate,
  error: first.error || (callerError ? 'not_an_active_prescription_of_this_patient' : null) ||
    (refused.length ? 'backend_refused_' + refused.length + '_alert(s)' : null) || (mustEscalate ? 'alert_withheld_by_validation' : null),
  mustEscalate,
  screened: result ? result.screened : false,
  reason: result ? result.reason : null,
  dryRun: result ? result.dryRun : null,
  excluded: result ? result.excluded : [],
  alerts: result && result.dryRun ? result.alerts : undefined,
  sent,
  report: result ? result.report : null,
  evidence: result ? result.evidence : null
} }];`;

const screening = {
  name: 'agent-interaction-screening-ddinter',
  nodes: [
    // onReceived, exactly like the workflow it replaces: agent-telegram-inbound's call gets its 200 at
    // once and never waits on (or times out on) the screening itself. The outcome is the execution:
    // a failure or a withheld alert FAILS it (Stop and Error), so it surfaces in n8n.
    webhook(SC(1), 'Screen a new prescription', 'jurah/screen-prescription', [-680, 0], 'onReceived'),
    code(SC(2), 'input (deterministic)', SC_INPUT, [-460, 0]),
    ifNode(SC(3), 'valid request?', '={{ $json.valid }}', [-240, 0]),
    api(SC(4), 'backend: active prescriptions', 'GET', '={{ $json.rxUrl }}', [-20, -80]),
    code(SC(5), 'screen (deterministic)', SC_SCREEN, [200, -80]),
    ifNode(SC(6), 'send alerts?', '={{ $json.post }}', [420, -80]),
    api(SC(7), 'backend: raise the alert', 'POST', API_BASE + '/alerts', [640, -160], '={{ JSON.stringify($json.alert) }}'),
    code(SC(8), 'summary (deterministic)', SC_SUMMARY, [860, -80]),
    ifNode(SC(9), 'failed or withheld?', '={{ !$json.ok }}', [1080, -80]),
    stopWithError(SC(10), 'Stop: screening failed - a human must look', "={{ 'Screening ' + ($json.error || 'failed') + (($json.mustEscalate) ? ' - an alert was withheld or refused; see the summary node' : '') }}", [1300, -160]),
    stopWithError(SC(11), 'Stop: invalid request', "={{ 'Invalid screening request: ' + $json.error }}", [-20, 120])
  ],
  connections: {
    'Screen a new prescription': main('input (deterministic)'),
    'input (deterministic)': main('valid request?'),
    'valid request?': main('backend: active prescriptions', 'Stop: invalid request'),
    'backend: active prescriptions': main('screen (deterministic)'),
    'screen (deterministic)': main('send alerts?'),
    'send alerts?': main('backend: raise the alert', 'summary (deterministic)'),
    'backend: raise the alert': main('summary (deterministic)'),
    'summary (deterministic)': main('failed or withheld?'),
    'failed or withheld?': main('Stop: screening failed - a human must look')
  },
  settings: { executionOrder: 'v1', timezone: 'Asia/Kuwait' }
};

// =============================================================== 2. travel check
const TC = (n) => uuid('c2000000-0000-4000-8000-', n);

const TC_INPUT = CONFIG + '\n' + INPUT_HELPERS + `

const BRAND_PROMPT = ${JSON.stringify(BRAND_PROMPT)};
const TC_RESPONSE_SCHEMA = ${JSON.stringify(TC_RESPONSE_SCHEMA)};
// Body: { patientId, imageBase64, mimeType, language }. The profile is read from the BACKEND, never from the caller.
const b = $input.first().json.body || {};
const patientId = String(b.patientId || '');
if (!ID.test(patientId)) return [{ json: { valid: false, ok: false, error: 'invalid_patient_id' } }];
const img = imageOf(b, false);
if (img.error) return [{ json: { valid: false, ok: false, error: img.error } }];
return [{ json: { valid: true, patientId, language: b.language === 'en' ? 'en' : 'ar',
  rxUrl: API + '/patients/' + encodeURIComponent(patientId) + '/prescriptions',
  visionBody: { contents: [{ role: 'user', parts: [{ text: BRAND_PROMPT }, { inlineData: { mimeType: img.mime, data: img.data } }] }],
                generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: TC_RESPONSE_SCHEMA } } } }];`;

const TC_CHECK = TRAVEL_SRC + `

// THE DETERMINISTIC LAYER: the model read the box; this decides everything else.
const input = $('input (deterministic)').first().json;
const rx = $('backend: active prescriptions').first().json;
const vision = $input.first().json;
const rxOk = rx.statusCode === 200 && !!rx.body && Array.isArray(rx.body.prescriptions);
let visionRead = null;
let finish = null;
if (vision.statusCode === 200) {
  try {
    finish = vision.body.candidates[0].finishReason || null;
    // A truncated, blocked or otherwise unfinished answer is not a reading: never parsed.
    if (finish === 'STOP') {
      const parsed = JSON.parse(vision.body.candidates[0].content.parts.map((p) => p.text || '').join(''));
      // A light shape check, same depth as extraction's own validate step: the deep semantics (is
      // brandAsPrinted a string-or-null, etc.) are travelCheck's job, not this Code node's.
      if (parsed && typeof parsed === 'object' && typeof parsed.isMedicine === 'boolean' && Array.isArray(parsed.ingredientsAsPrinted)) visionRead = parsed;
    }
  } catch (e) { visionRead = null; }
}
// Never "no interaction" when the profile could not be read: travelCheck itself fails closed
// (VERDICT.CANNOT_VERIFY, reason profile_unavailable) whenever prescriptions is not an array - a
// not-a-medicine photo, an unusable model answer or an unresolved name still answer first, unchanged.
const result = travelCheck({ patientId: input.patientId, visionRead, prescriptions: rxOk ? rx.body.prescriptions : null,
  index: INDEX, brandIndex: BRAND_INDEX, language: input.language, pendingNames: PENDING_NAMES });
result.visionStatus = vision.statusCode;
return [{ json: { post: !!result.alert,
  error: !rxOk ? 'backend_prescriptions_http_' + rx.statusCode : (vision.statusCode !== 200 ? 'vision_http_' + vision.statusCode : (finish !== 'STOP' ? 'vision_not_finished_' + finish : null)),
  alert: result.alert, result } }];`;

const TC_ANSWER = `
const c = $('check (deterministic)').first().json;
const result = c.result;
let alertStatus = null;
let alertId = null;
try {
  const w = $('backend: raise the alert').first().json;
  alertStatus = w.statusCode;
  if (w.statusCode === 201 && w.body && w.body.alert) alertId = w.body.alert.id;
} catch (e) { /* no alert was raised */ }
const appOutcome = Object.assign({}, result.appOutcome);
if (alertId && appOutcome.kind === 'identified' && appOutcome.verdict === 'interaction_found') appOutcome.alertId = alertId;
const mustEscalate = (c.post && alertStatus !== 201) || !!result.mustEscalate;
return [{ json: { ok: !c.error && !mustEscalate, error: c.error || (c.post && alertStatus !== 201 ? 'backend_refused_alert_' + alertStatus : null),
  mustEscalate, appOutcome, verdict: result.verdict, message: result.message || null, alertId,
  result: Object.assign({}, result, { alert: undefined }) } }];`;

const travel = {
  name: 'agent-travel-check',
  nodes: [
    webhook(TC(1), 'Check a medicine photo', 'jurah/travel-check', [-900, 0]),
    code(TC(2), 'input (deterministic)', TC_INPUT, [-680, 0]),
    ifNode(TC(3), 'valid request?', '={{ $json.valid }}', [-460, 0]),
    // A5 (2026-09-26): the backend fetch and the vision call run one after another (never in
    // parallel), so their worst cases ADD. Budget, worst case: backend 8000 + primary 14000 +
    // fallback 14000 = 36000ms, inside the app's 45000ms VISION_TIMEOUT_MS with margin - see
    // agents/knowledge/test/timeouts.test.js, which reads this built file and re-adds these numbers.
    api(TC(4), 'backend: active prescriptions', 'GET', '={{ $json.rxUrl }}', [-240, -80], undefined, { timeout: 8000, maxTries: 1 }),
    gemini(TC(5), 'Gemini: read the name on the box', "={{ JSON.stringify($('input (deterministic)').first().json.visionBody) }}", [-20, -160],
      { timeout: 14000, hasFallback: true }),
    // A6/decision (f): the primary model failed (error or timeout) - one fallback try, same body, a
    // different model. Never a second same-model retry (agent-travel-check dropped that with A5).
    gemini(TC(14), 'Gemini fallback: read the name on the box', "={{ JSON.stringify($('input (deterministic)').first().json.visionBody) }}", [-20, 0],
      { model: FALLBACK_VISION_MODEL, timeout: 14000 }),
    code(TC(6), 'check (deterministic)', TC_CHECK, [200, -80]),
    ifNode(TC(7), 'a danger finding?', '={{ $json.post }}', [420, -80]),
    api(TC(8), 'backend: raise the alert', 'POST', API_BASE + '/alerts', [640, -160], '={{ JSON.stringify($json.alert) }}'),
    code(TC(9), 'answer (deterministic)', TC_ANSWER, [860, -80]),
    respond(TC(10), 'Answer', [1080, -80]),
    respond(TC(11), 'Answer: invalid request', [-240, 120], 422),
    ifNode(TC(12), 'escalate?', '={{ $json.mustEscalate }}', [1300, -80]),
    stopWithError(TC(13), 'Stop: danger alert not raised - a human must look', "={{ 'Travel check: ' + ($json.error || 'a danger alert was not accepted') }}", [1520, -160])
  ],
  connections: {
    'Check a medicine photo': main('input (deterministic)'),
    'input (deterministic)': main('valid request?'),
    'valid request?': main('backend: active prescriptions', 'Answer: invalid request'),
    'backend: active prescriptions': main('Gemini: read the name on the box'),
    'Gemini: read the name on the box': main('check (deterministic)', 'Gemini fallback: read the name on the box'),
    'Gemini fallback: read the name on the box': main('check (deterministic)'),
    'check (deterministic)': main('a danger finding?'),
    'a danger finding?': main('backend: raise the alert', 'answer (deterministic)'),
    'backend: raise the alert': main('answer (deterministic)'),
    'answer (deterministic)': main('Answer'),
    'Answer': main('escalate?'),
    'escalate?': main('Stop: danger alert not raised - a human must look')
  },
  settings: { executionOrder: 'v1', timezone: 'Asia/Kuwait' }
};

// =============================================================== 3. extraction
const EX = (n) => uuid('c3000000-0000-4000-8000-', n);

const EX_INPUT = CONFIG + '\n' + INPUT_HELPERS + '\n' + EXTRACTION_SRC + `

// Body: { patientId, imageBase64, mimeType, language, save, source? }.
//   save:true  -> write through POST /api/agent/prescriptions (the agent path) and, when the saved record
//                 is unflagged, screen it before anything else (the TC-IX invariant).
//   otherwise  -> read and validate only; the caller gets appOutcome (the app's ExtractionOutcome minus
//                 draftId, which the backend assigns) and the exact body it would save.
const b = $input.first().json.body || {};
const patientId = String(b.patientId || '');
if (!ID.test(patientId)) return [{ json: { valid: false, ok: false, error: 'invalid_patient_id' } }];
const img = imageOf(b, true);
if (img.error) return [{ json: { valid: false, ok: false, error: img.error } }];
const source = b.source && typeof b.source === 'object' ? { facilityName: b.source.facilityName, sector: b.source.sector } : null;
return [{ json: { valid: true, patientId, language: b.language === 'en' ? 'en' : 'ar', save: b.save === true, source,
  visionBody: { contents: [{ role: 'user', parts: [{ text: PROMPT }, { inlineData: { mimeType: img.mime, data: img.data } }] }],
                generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA } } } }];`;

const EX_VALIDATE = EXTRACTION_SRC + `

// THE DETERMINISTIC LAYER for extraction: the model's reading becomes a body, a flag, or a refusal.
const input = $('input (deterministic)').first().json;
const res = $input.first().json;
let model = null;
let finish = null;
if (res.statusCode === 200) {
  try {
    finish = res.body.candidates[0].finishReason || null;
    // A truncated or blocked answer is never parsed as a reading.
    if (finish === 'STOP') model = JSON.parse(res.body.candidates[0].content.parts.map((x) => x.text || '').join(''));
  } catch (e) { model = null; }
}
const result = toPrescriptionBody({ patientId: input.patientId, model, source: input.source });
return [{ json: { save: input.save && result.ok, visionStatus: res.statusCode, visionFinish: finish, result } }];`;

const EX_AFTER_SAVE = `
const v = $('validate (deterministic)').first().json;
const w = $input.first().json;
const created = w.statusCode === 201 && w.body && w.body.prescription ? w.body.prescription : null;
// AP-04: the backend now screens on every path it saves or confirms a prescription (AP-10, D10) and
// hands its outcome back in the SAME response - this workflow reads it instead of calling screening
// itself. w.body.screening is 'screened' | 'held' | 'skipped' (lib/data/pg/agent.ts
// insertExtractedPrescription). A saved, UNFLAGGED prescription whose outcome is neither breaks the
// TC-IX invariant on the backend's own side: escalate rather than let it pass as final.
const screening = created ? (w.body.screening || null) : null;
const notScreened = !!(created && !v.result.needsReview && screening !== 'screened' && screening !== 'held');
return [{ json: { saveStatus: w.statusCode, saveError: created ? null : (w.body || null), created,
  screening, notScreened } }];`;

const EX_ANSWER = `
const v = $('validate (deterministic)').first().json;
let saved = null;
try { saved = $('after save').first().json; } catch (e) { /* not saved */ }
const result = v.result;
const wantedSave = $('input (deterministic)').first().json.save;
// A saved, unflagged prescription the backend itself did not screen breaks the TC-IX invariant: escalate.
const mustEscalate = !!(saved && saved.notScreened);
const ok = result.ok && (!wantedSave || (saved && saved.saveStatus === 201)) && !mustEscalate;
return [{ json: {
  ok,
  mustEscalate,
  appOutcome: result.appOutcome,
  needsReview: result.ok ? result.needsReview : null,
  uncertainFields: result.ok ? result.uncertainFields : [],
  code: result.ok ? null : result.code,
  missing: result.ok ? [] : result.missing,
  body: result.ok ? result.body : null,
  visionStatus: v.visionStatus,
  visionFinish: v.visionFinish,
  saved: saved ? { statusCode: saved.saveStatus, prescriptionId: saved.created ? saved.created.id : null, error: saved.saveError } : null,
  screening: saved && saved.screening ? { outcome: saved.screening } : null
} }];`;

const extraction = {
  name: 'agent-extraction',
  nodes: [
    webhook(EX(1), 'Extract a prescription', 'jurah/extract-prescription', [-900, 0]),
    code(EX(2), 'input (deterministic)', EX_INPUT, [-680, 0]),
    ifNode(EX(3), 'valid request?', '={{ $json.valid }}', [-460, 0]),
    // A5/A6 (2026-09-26): no backend leg before the vision call here (unlike travel check), so the
    // whole 45000ms VISION_TIMEOUT_MS budget is the two vision tries. Worst case 19000 + 19000 =
    // 38000ms, inside budget with margin - see agents/knowledge/test/timeouts.test.js.
    // Both nodes name 'input (deterministic)' explicitly (never plain $json): the fallback is fed
    // from the primary's ERROR output, where $json would be n8n's error item, not the vision body.
    gemini(EX(4), 'Gemini: read the prescription', "={{ JSON.stringify($('input (deterministic)').first().json.visionBody) }}", [-240, -160], { timeout: 19000, hasFallback: true }),
    gemini(EX(16), 'Gemini fallback: read the prescription', "={{ JSON.stringify($('input (deterministic)').first().json.visionBody) }}", [-240, 0],
      { model: FALLBACK_VISION_MODEL, timeout: 19000 }),
    code(EX(5), 'validate (deterministic)', EX_VALIDATE, [-20, -80]),
    ifNode(EX(6), 'save it?', '={{ $json.save }}', [200, -80]),
    api(EX(7), 'backend: save the prescription', 'POST', API_BASE + '/prescriptions', [420, -160], '={{ JSON.stringify($json.result.body) }}'),
    code(EX(8), 'after save', EX_AFTER_SAVE, [640, -160]),
    code(EX(11), 'answer (deterministic)', EX_ANSWER, [860, -80]),
    respond(EX(12), 'Answer', [1080, -80]),
    respond(EX(13), 'Answer: invalid request', [-240, 120], 422),
    ifNode(EX(14), 'escalate?', '={{ $json.mustEscalate }}', [1300, -80]),
    stopWithError(EX(15), 'Stop: saved but not screened - a human must look', "={{ 'Extraction: prescription ' + ($json.saved && $json.saved.prescriptionId) + ' was saved, but the backend did not screen it (' + (($json.screening && $json.screening.outcome) || 'none') + ')' }}", [1520, -160])
  ],
  connections: {
    'Extract a prescription': main('input (deterministic)'),
    'input (deterministic)': main('valid request?'),
    'valid request?': main('Gemini: read the prescription', 'Answer: invalid request'),
    'Gemini: read the prescription': main('validate (deterministic)', 'Gemini fallback: read the prescription'),
    'Gemini fallback: read the prescription': main('validate (deterministic)'),
    'validate (deterministic)': main('save it?'),
    'save it?': main('backend: save the prescription', 'answer (deterministic)'),
    'backend: save the prescription': main('after save'),
    'after save': main('answer (deterministic)'),
    'answer (deterministic)': main('Answer'),
    'Answer': main('escalate?'),
    'escalate?': main('Stop: saved but not screened - a human must look')
  },
  settings: { executionOrder: 'v1', timezone: 'Asia/Kuwait' }
};

// Guarded so a test can `require()` this file (after setting a dummy JURAH_API_BASE) to reach
// `write` and `CODE_NODE_LIMIT_BYTES` directly, without the side effect of overwriting the real
// committed workflows with test/dummy content. `node scripts/build.js` still runs exactly as before.
if (require.main === module) {
  for (const wf of [screening, travel, extraction]) write(wf);
  console.log('JURAH_API_BASE = ' + API_BASE);
  console.log('N8N_WEBHOOK_BASE = ' + N8N_WEBHOOK_BASE);
}

module.exports = { write, screening, travel, extraction, CODE_NODE_LIMIT_BYTES };
