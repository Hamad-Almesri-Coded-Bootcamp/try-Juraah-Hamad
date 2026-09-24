'use strict';

/**
 * Generate agents/workflows/*.json from the tested source in agents/lib/*.js.
 *
 *   agents/lib/adherence.js   agents/lib/screening.js   agents/lib/extraction.js
 *        |  unit-tested by agents/test/*.test.js, and contract-tested against the backend's own
 *        |  validators by tests/unit/agent/agents-contract.test.ts
 *        v  node agents/scripts/build.js
 *   agents/workflows/agent-telegram-inbound.json       the relay (CR-063) -> adherence | extraction
 *   agents/workflows/agent-checkin-daily.json          08:00 Kuwait (+ a "send now" webhook)
 *   agents/workflows/agent-interaction-screening.json  one NEW prescription against the profile
 *
 * Every workflow is written ASCII-only (\uXXXX escapes): on 21 September raw Arabic went through a
 * Windows clipboard tool and reached the patient as CP850 mojibake. Never edit the jsCode inside
 * the generated JSON - edit agents/lib and rebuild.
 *
 * Nothing secret is in these files. Four n8n credentials are bound by hand after import
 * (agents/README.md): the agent bearer (Header Auth `Authorization: Bearer <JURAH_AGENT_TOKEN>`),
 * the inbound secret (Header Auth `x-jurah-secret`), the Telegram bot, and the Gemini key.
 *
 * Build-time, not secret:
 *   JURAH_API_BASE   the deployed backend's agent base, e.g. https://jurah.example/api/agent
 *   N8N_WEBHOOK_BASE the n8n instance's PRODUCTION webhook base (never /webhook-test/)
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const API_BASE = (process.env.JURAH_API_BASE || 'https://backend-not-deployed-yet.invalid/api/agent').replace(/\/+$/, '');
const N8N_WEBHOOK_BASE = (process.env.N8N_WEBHOOK_BASE || 'https://mohammad-aljry.app.n8n.cloud/webhook').replace(/\/+$/, '');
if (N8N_WEBHOOK_BASE.includes('/webhook-test')) throw new Error('N8N_WEBHOOK_BASE must be the production /webhook base, never /webhook-test');

/** The model every LLM node uses, and a fallback in a DIFFERENT quota bucket (verified live 21 Sep). */
const GEMINI_MODEL = 'models/gemini-3-flash-preview';
const GEMINI_FALLBACK_MODEL = 'models/gemini-3.6-flash';
const VISION_MODEL_PATH = 'gemini-3-flash-preview';

// ------------------------------------------------------------------------------ helpers
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Strip the CommonJS wrapper: an n8n Code node has no `module` and no `require`. */
function inline(file) {
  const src = read(file)
    // A Windows checkout (core.autocrlf=true) hands us CRLF; the committed workflows are LF.
    .replace(/\r\n/g, '\n')
    // A lib file's model contract (a model's prompt and schema) belongs to the model node, never to a
    // Code node: it is cut here, so no Code node's source changes when a prompt moves into agents/lib.
    .replace(/\n*\/\* ===== model contract[\s\S]*$/, '')
    .replace(/^'use strict';\s*/m, '')
    .replace(/^const \{[^}]*\} = require\('[^']+'\);\n/gm, '')
    .replace(/module\.exports\s*=\s*\{[\s\S]*?\};\s*$/m, '')
    .trimEnd();
  if (/\brequire\(/.test(src)) throw new Error(file + ': a require survived inlining');
  return '/* ===== generated from agents/' + file + ' - do not edit here; edit the source and rebuild ===== */\n' +
    src + '\n/* ===== end generated ===== */';
}
const ADHERENCE = inline('lib/adherence.js');
// AP-11: no model-contract marker (PHOTO_PROMPT/PHOTO_SCHEMA are built into the vision request by
// plain Code, like agents/knowledge/src/extraction.js's PROMPT/RESPONSE_SCHEMA - there is no chain
// node here to carry them instead), so this inlines whole, after ADHERENCE (it reads REPLIES).
const ORCHESTRATOR = inline('lib/orchestrator.js');
const SCREENING = inline('lib/screening.js');
// AP-03/D3: the Telegram copy is now built on the drug-knowledge core (agents/knowledge/src/extraction.js),
// which agents/lib/extraction.js requires and re-exports; both are inlined here, core first.
const EXTRACTION = inline('knowledge/src/extraction.js') + '\n\n' + inline('lib/extraction.js');
const VOICE = inline('lib/voice.js');
const VOICE_ACTIONS = inline('lib/voice-actions.js');
const WEBCHAT = inline('lib/webchat.js');

const uuid = (prefix, n) => prefix + String(n).padStart(12, '0');
const code = (id, name, jsCode, position) => ({
  parameters: { jsCode }, id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position,
});

/** A call to the backend under the agent bearer. Always the full response, never throws: the next
 * Code node reads statusCode and decides (a refused write must never read as "recorded"). */
function api(id, name, method, url, position, jsonBody) {
  const parameters = {
    method, url,
    authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 15000 },
  };
  if (jsonBody) Object.assign(parameters, { sendBody: true, specifyBody: 'json', jsonBody });
  return { parameters, id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position,
           retryOnFail: method === 'GET', maxTries: 2, waitBetweenTries: 1000 };
}

function ifNode(id, name, expression, position) {
  return {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: id + '-c', leftValue: expression, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      options: {},
    },
    id, name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position,
  };
}

function telegramText(id, name, position) {
  return {
    parameters: { chatId: '={{ $json.chatId }}', text: '={{ $json.text }}', additionalFields: { appendAttribution: false } },
    id, name, type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position, onError: 'continueRegularOutput',
  };
}

/** Three quick-reply buttons - the count is fixed, the labels and callback data come from the item. */
function telegramButtons(id, name, position) {
  const button = (i) => ({ text: '={{ $json.buttons[' + i + '].text }}', additionalFields: { callback_data: '={{ $json.buttons[' + i + '].data }}' } });
  return {
    parameters: {
      chatId: '={{ $json.chatId }}', text: '={{ $json.text }}',
      replyMarkup: 'inlineKeyboard',
      inlineKeyboard: { rows: [{ row: { buttons: [button(0), button(1), button(2)] } }] },
      additionalFields: { appendAttribution: false },
    },
    id, name, type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position, onError: 'continueRegularOutput',
  };
}

/** AP-11: the Orchestrator's own "is it a prescription or a medicine box?" - exactly two buttons,
 * never three. The three-button helper above is untouched. */
function telegramTwoButtons(id, name, position) {
  const button = (i) => ({ text: '={{ $json.buttons[' + i + '].text }}', additionalFields: { callback_data: '={{ $json.buttons[' + i + '].data }}' } });
  return {
    parameters: {
      chatId: '={{ $json.chatId }}', text: '={{ $json.text }}',
      replyMarkup: 'inlineKeyboard',
      inlineKeyboard: { rows: [{ row: { buttons: [button(0), button(1)] } }] },
      additionalFields: { appendAttribution: false },
    },
    id, name, type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position, onError: 'continueRegularOutput',
  };
}

const gemini = (id, name, model, position) => ({
  parameters: { modelName: model, options: { temperature: 0 } },
  retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
  id, name, type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', typeVersion: 1.1, position,
});

const link = (to, index = 0) => ({ node: to, type: 'main', index });
const main = (...outputs) => ({ main: outputs.map((o) => (Array.isArray(o) ? o : [o]).filter(Boolean).map((n) => link(n))) });

/** Escape every non-ASCII character; refuse to write if one survives or the file does not round-trip. */
function write(workflow) {
  const json = JSON.stringify(workflow, null, 2).replace(/[\u0080-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
  const offenders = [...json].filter((c) => c.charCodeAt(0) > 0x7f);
  if (offenders.length) throw new Error('refusing to write ' + workflow.name + ': non-ASCII survived');
  if (JSON.stringify(JSON.parse(json)) !== JSON.stringify(workflow)) throw new Error('refusing to write ' + workflow.name + ': no round trip');
  const dir = path.join(ROOT, 'workflows');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, workflow.name + '.json'), json, 'ascii');
  const lines = workflow.nodes.filter((n) => n.parameters && n.parameters.jsCode).reduce((s, n) => s + n.parameters.jsCode.split('\n').length, 0);
  console.log('wrote agents/workflows/' + workflow.name + '.json - ' + workflow.nodes.length + ' nodes, ' + lines + ' lines of Code-node JS, ' + Buffer.byteLength(json) + ' bytes, ASCII-only');
}

const CONFIG = "const API = " + JSON.stringify(API_BASE) + ";\nconst N8N = " + JSON.stringify(N8N_WEBHOOK_BASE) + ";";

// =============================================================== 1. agent-telegram-inbound
const IN = (n) => uuid('b1000000-0000-4000-8000-', n);

const ROUTE = CONFIG + '\n' + ADHERENCE + '\n' + ORCHESTRATOR + `

// The relay (CR-063) already resolved WHO this chat is, server-side, and only forwards a patient's
// or an ACTIVE caregiver's chat. Re-check the shape anyway: fail closed on anything unexpected.
const p = $input.first().json.body || {};
const ok = p && p.channel === 'telegram' && (p.subjectType === 'patient' || p.subjectType === 'caregiver') &&
  typeof p.patientId === 'string' && p.patientId && typeof p.chatId === 'string' && p.chatId && kuwaitDate(p.sentAt);
if (!ok) return [];

const tap = p.kind === 'callback' ? parseTap(p.text) : null;
// A tap carries the CHECK-IN message's time, not the tap's: the tap happened now (n8n's receipt).
const eventAt = p.kind === 'callback' ? new Date().toISOString() : p.sentAt;

// AP-11 - the Orchestrator decides the route; it never decides a dose, a time or a drug (D23).
const store = $getWorkflowStaticData('global');
const routeOpts = { store, now: Date.now() };
const route = routeInbound(p, routeOpts);
if (route === null) return [];

// A resumed or:rx / or:box tap names no file of its own - the remembered one (never trusted from
// the tap's own text) takes its place, so the EXISTING download nodes pick it up unchanged.
let photoFileId = p.photoFileId || null;
let documentFileId = p.documentFileId || null;
if (route === 'extraction' || route === 'travel') {
  const resumed = routeOpts.resumedFile;
  photoFileId = resumed && resumed.kind === 'photo' ? resumed.fileId : null;
  documentFileId = resumed && resumed.kind === 'document' ? resumed.fileId : null;
}
// 'reply' at THIS stage (before any download) is only ever a caregiver's own message, or an
// or:rx/or:box tap that is missing or has expired; 'other'/'unsure'/a file problem are decided
// later, only after the photo is downloaded and classified.
let reason = null;
let caregiverKind = null;
if (route === 'reply') {
  if (p.subjectType !== 'patient') {
    reason = 'caregiver';
    caregiverKind = p.photoFileId ? 'photo' : (p.documentFileId ? 'document' : 'text');
  } else {
    reason = 'photo_expired';
  }
}
return [{ json: {
  route, reason, caregiverKind, messageId: p.messageId || null,
  subjectType: p.subjectType, patientId: p.patientId, language: p.language === 'en' ? 'en' : 'ar', chatId: p.chatId,
  text: typeof p.text === 'string' ? p.text.slice(0, 500) : '',
  tap, eventAt,
  // The doses of the day the reply is about: a tap's check-in day, or the reply's own day.
  date: kuwaitDate(p.sentAt),
  needsModel: route === 'adherence' && p.subjectType === 'patient' && !tap && typeof p.text === 'string' && p.text.trim().length > 0,
  callbackQueryId: p.callbackQueryId || null,
  photoFileId, documentFileId,
  dosesUrl: API + '/patients/' + encodeURIComponent(p.patientId) + '/doses?date=' + kuwaitDate(p.sentAt),
} }];`;

// The classifier's prompt and schema live in agents/lib/adherence.js beside the rules that trust
// its answer, so this node and agents/eval send one string.
const { CLASSIFY_PROMPT } = require('../lib/adherence.js');
const CLASSIFY_SCHEMA = JSON.stringify(require('../lib/adherence.js').CLASSIFY_SCHEMA, null, 2);

const DECIDE = CONFIG + '\n' + ADHERENCE + `

// THE DETERMINISTIC LAYER. The model (if it ran at all) classified language; this decides.
const r = $('route (deterministic)').first().json;
const fetched = $('backend: doses of the day').first().json;
const doses = fetched.statusCode === 200 && fetched.body && Array.isArray(fetched.body.doses) ? fetched.body.doses : null;
const classified = r.needsModel ? ($input.first().json.output || $input.first().json) : null;

let decision;
if (doses === null && r.subjectType === 'patient') {
  decision = { outcome: 'refused', writes: [], askDoses: [], dose: null, reply: REPLIES[r.language].failed,
               reason: 'the backend did not return the doses (HTTP ' + fetched.statusCode + ')' };
} else {
  decision = decide({ subjectType: r.subjectType, language: r.language, sentAt: r.eventAt, doses: doses || [],
                      tap: r.tap, classification: classified });
}
const w = decision.writes || [];
const url = (x) => x.op === 'dose_status' ? API + '/doses/' + encodeURIComponent(x.doseId) + '/status' : API + '/schedule/recompute';
return [{ json: {
  ...r, decision,
  hasWrite: w.length > 0,
  write0: w[0] ? { url: url(w[0]), body: w[0].body } : null,
  write1: w[1] ? { url: url(w[1]), body: w[1].body } : null,
} }];`;

const AFTER_FIRST = `// Run the second write ONLY if the first one was accepted (a recompute needs the miss recorded).
const d = $('decide (deterministic)').first().json;
const first = $input.first().json;
return [{ json: { ...d, result0: { statusCode: first.statusCode }, runSecond: !!d.write1 && first.statusCode >= 200 && first.statusCode < 300 } }];`;

const REPLY = ADHERENCE + `

// What the patient reads - after the writes, from what the backend ACTUALLY answered.
const d = $('decide (deterministic)').first().json;
const results = [];
try { results[0] = { statusCode: $('backend: write 1').first().json.statusCode }; } catch (e) { /* did not run */ }
try { results[1] = { statusCode: $('backend: write 2 (recompute)').first().json.statusCode }; } catch (e) { /* did not run */ }
const out = replyAfterWrites(d.decision, results, d.language);
const items = [{ json: { chatId: d.chatId, text: out.reply, buttons: null, callbackQueryId: d.callbackQueryId,
  log: { outcome: d.decision.outcome, intent: d.decision.intent, doseId: d.decision.dose ? d.decision.dose.id : null,
         recorded: out.recorded, statuses: results.map((x) => x && x.statusCode), reason: d.decision.reason || null } } }];
// TC-AD-12 - more than one open dose: one message per dose, each with buttons naming it.
if (d.decision.outcome === 'ask_which' && d.decision.askDoses && d.decision.askDoses.length) {
  const c = buildCheckIn({ patientId: d.patientId, chatId: d.chatId, language: d.language, doses: d.decision.askDoses });
  for (const m of c.messages.slice(1)) items.push({ json: { chatId: m.chatId, text: m.text, buttons: m.buttons, callbackQueryId: null } });
}
return items;`;

const EX_REQUEST = EXTRACTION + `

// The image goes to the model; the model's reading comes back through extractFromTelegram. The
// caption travels alongside (context only for the model AND for the deterministic core below -
// the image always wins, TC-EX-06); a file problem is named and short-circuits validation.
const r = $('route (deterministic)').first().json;
const bin = $input.first().binary || {};
const key = Object.keys(bin)[0];
if (!key) return [{ json: { ...r, visionBody: null, caption: r.text || null, fileProblem: 'file_not_downloaded' } }];
const buffer = await this.helpers.getBinaryDataBuffer(0, key);
const mime = bin[key].mimeType || 'image/jpeg';
if (!/^(image\\/(jpeg|png|webp|heic|heif)|application\\/pdf)$/.test(mime) || buffer.length > 15 * 1024 * 1024) {
  return [{ json: { ...r, visionBody: null, caption: r.text || null, fileProblem: 'unsupported_file' } }];
}
const caption = r.text ? '\\nThe patient\\'s caption (context only - the image wins): ' + r.text : '';
return [{ json: { ...r, visionBody: {
  contents: [{ role: 'user', parts: [{ text: PROMPT + caption }, { inlineData: { mimeType: mime, data: buffer.toString('base64') } }] }],
  generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
}, caption: r.text || null, fileProblem: null } }];`;

const EX_VALIDATE = EXTRACTION + `

// THE DETERMINISTIC LAYER for extraction: the model's reading becomes a body, a flag, or a refusal.
// A model error or truncated answer is 'unreadable' with its reason named - never 'not_a_prescription'
// (AP-03): extractFromTelegram reads the raw Gemini response itself (readVision) and only reaches
// toPrescriptionBody with an actually-parsed, finished answer.
const r = $('extraction: build the vision request').first().json;
const res = $input.first().json;
const result = extractFromTelegram({ patientId: r.patientId, res, caption: r.caption, fileProblem: r.visionBody ? null : (r.fileProblem || 'no_file') });
return [{ json: { ...r, visionBody: undefined, result, body: result.ok ? result.body : null, visionStatus: res.statusCode } }];`;

const EX_REPLY = EXTRACTION + '\n' + CONFIG + `

const v = $('extraction: validate (deterministic)').first().json;
let statusCode = null;
let created = null;
try { const w = $('backend: save the prescription').first().json; statusCode = w.statusCode; created = w.body && w.body.prescription; } catch (e) { /* not saved */ }
const text = extractionReply({ result: v.result, statusCode, language: v.language });
// TC-IX invariant: a saved, unflagged prescription goes to screening before anything else.
const screen = !!(created && statusCode === 201 && !v.result.needsReview);
return [{ json: { chatId: v.chatId, text, buttons: null,
  screen, screeningUrl: N8N + '/jurah/screen-prescription',
  screeningBody: screen ? { patientId: v.patientId, newPrescriptionId: created.id, language: v.language } : null,
  log: { result: v.result.ok ? (v.result.needsReview ? 'flagged' : 'clear') : v.result.code, missing: v.result.missing || [], reason: v.result.reason || null, statusCode } } }];`;

// ---- AP-11: the Orchestrator's own photo branch (a real router: one narrow vision question, then
// a fixed set of deterministic outcomes - never a model deciding a route on its own say-so).
const ORCH_ASK = ORCHESTRATOR + `

// Downloaded once, whether the message was a photo or a document (routeInbound could not tell
// which without this). A PDF or anything unsupported is decided from its mime type alone - never
// asked to the model (Travel Check reads images only, so a PDF can only be a prescription).
const r = $('route (deterministic)').first().json;
const bin = $input.first().binary || {};
const key = Object.keys(bin)[0];
const buffer = key ? await this.helpers.getBinaryDataBuffer(0, key) : null;
const mime = key ? (bin[key].mimeType || 'application/octet-stream') : '';
const q = photoQuestion(mime, buffer);
if (!q.ok) return [{ json: { ...r, visionBody: null, mimeShortcut: null, fileProblem: q.reason } }];
return [{ json: { ...r, visionBody: q.visionBody, mimeShortcut: q.mimeShortcut, fileProblem: null } }];`;

const ORCH_DECIDE = ORCHESTRATOR + `

// THE DETERMINISTIC LAYER for the photo question. A PDF or a file problem is already decided
// (photoQuestion said so, above) and never reads the model's answer at all; everything else goes
// through decidePhoto's own floor (MIN_ROUTE_CONFIDENCE) - never a guess below it.
const a = $('orchestrator: ask what the photo is').first().json;
const res = $input.first().json;
let decided;
if (a.mimeShortcut) decided = { kind: a.mimeShortcut, confidence: 1, claimed: a.mimeShortcut, guardrail: null };
else if (a.fileProblem) decided = { kind: 'unsure', confidence: 0, claimed: null, guardrail: a.fileProblem };
else decided = decidePhoto(res);
// An unsure photo (never a file problem - there is nothing to resume against) is remembered ONCE,
// keyed by the ORIGINAL message id, so a later tap can resume it. Never the file id (it never
// appears in a callback), never the caption, never the chat id (rule 6/7).
if (decided.kind === 'unsure' && !a.fileProblem && a.messageId) {
  rememberPhoto($getWorkflowStaticData('global'), a.patientId, a.messageId, a.photoFileId || a.documentFileId,
    a.photoFileId ? 'photo' : 'document', Date.now());
}
let reason = null;
if (decided.kind === 'other') reason = 'other';
else if (decided.kind === 'unsure') reason = a.fileProblem ? 'file_problem' : 'unsure';
return [{ json: { ...a, decidedKind: decided.kind, reason } }];`;

const ORCH_REPLY = ADHERENCE + '\n' + ORCHESTRATOR + `

// Fed by either of two nodes (a caregiver or an expired tap, straight from route (deterministic);
// or other/unsure/a file problem, from decide (deterministic)) - both carry the same core fields,
// so this reads $input rather than a named node.
const j = $input.first().json;
const built = orchestratorReply({ reason: j.reason, kind: j.caregiverKind, language: j.language, messageId: j.messageId });
return [{ json: { chatId: j.chatId, text: built.text, buttons: built.buttons, callbackQueryId: j.callbackQueryId,
  log: { route: 'reply', reason: j.reason, patientId: j.patientId } } }];`;

const ORCH_TRAVEL_REQUEST = ORCHESTRATOR + '\n' + CONFIG + `

// The candidate for Travel Check - freshly classified as a medicine box, or a resumed or:box tap.
// Re-downloaded here rather than threaded through from classification (extraction does the same
// for a re-confirmed prescription): one clear source of the bytes that are actually sent.
const r = $('route (deterministic)').first().json;
const bin = $input.first().binary || {};
const key = Object.keys(bin)[0];
const travelUrl = N8N + '/jurah/travel-check';
if (!key) return [{ json: { ...r, travelUrl, travelBody: null, fileProblem: 'file_not_downloaded' } }];
const buffer = await this.helpers.getBinaryDataBuffer(0, key);
const mime = bin[key].mimeType || 'image/jpeg';
return [{ json: { ...r, travelUrl, fileProblem: null,
  travelBody: travelBody({ patientId: r.patientId, imageBase64: buffer.toString('base64'), mimeType: mime, language: r.language }) } }];`;

const ORCH_TRAVEL_REPLY = ORCHESTRATOR + `

// THE DETERMINISTIC LAYER for Travel Check's answer: one fixed line, chosen by verdict alone -
// never a direct instruction, never an all-clear when the call itself did not go cleanly.
const r = $('orchestrator: build the travel request').first().json;
const res = $input.first().json;
const text = r.fileProblem ? ORCH_TEXT[r.language === 'en' ? 'en' : 'ar'].file_problem
  : travelReply({ statusCode: res.statusCode, body: res.body, language: r.language });
return [{ json: { chatId: r.chatId, text, buttons: null, callbackQueryId: r.callbackQueryId,
  log: { route: 'travel', patientId: r.patientId, statusCode: res.statusCode,
         verdict: res.body && res.body.verdict, alertId: res.body && res.body.alertId, error: (res.body && res.body.error) || r.fileProblem } } }];`;

const inbound = {
  name: 'agent-telegram-inbound',
  nodes: [
    { parameters: { httpMethod: 'POST', path: 'jurah/telegram-inbound', authentication: 'headerAuth', responseMode: 'onReceived', options: {} },
      id: IN(1), name: 'Relay from the app (CR-063)', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-900, 0], webhookId: IN(1) },
    code(IN(2), 'route (deterministic)', ROUTE, [-680, 0]),
    ifNode(IN(3), 'a prescription photo?', "={{ $json.route === 'extraction' }}", [-460, 0]),
    // ---- adherence
    api(IN(4), 'backend: doses of the day', 'GET', '={{ $json.dosesUrl }}', [-240, 200]),
    ifNode(IN(5), 'needs the model?', "={{ $('route (deterministic)').first().json.needsModel }}", [-20, 200]),
    gemini(IN(6), 'Gemini (chat model)', GEMINI_MODEL, [120, 420]),
    gemini(IN(7), 'Gemini (fallback model)', GEMINI_FALLBACK_MODEL, [120, 560]),
    { parameters: { schemaType: 'manual', inputSchema: CLASSIFY_SCHEMA }, id: IN(8), name: 'Structured output',
      type: '@n8n/n8n-nodes-langchain.outputParserStructured', typeVersion: 1.2, position: [300, 420] },
    { parameters: { promptType: 'define', text: "={{ $('route (deterministic)').first().json.text }}", hasOutputParser: true, needsFallback: true,
                    messages: { messageValues: [{ message: CLASSIFY_PROMPT }] } },
      id: IN(9), name: 'Gemini: classify the reply', type: '@n8n/n8n-nodes-langchain.chainLlm', typeVersion: 1.5, position: [200, 200],
      onError: 'continueRegularOutput' },
    code(IN(10), 'decide (deterministic)', DECIDE, [420, 200]),
    ifNode(IN(11), 'anything to write?', '={{ $json.hasWrite }}', [640, 200]),
    api(IN(12), 'backend: write 1', 'POST', '={{ $json.write0.url }}', [860, 120], '={{ JSON.stringify($json.write0.body) }}'),
    code(IN(13), 'after write 1', AFTER_FIRST, [1080, 120]),
    ifNode(IN(14), 'second write?', '={{ $json.runSecond }}', [1300, 120]),
    api(IN(15), 'backend: write 2 (recompute)', 'POST', '={{ $json.write1.url }}', [1520, 40], '={{ JSON.stringify($json.write1.body) }}'),
    code(IN(16), 'reply (deterministic)', REPLY, [1740, 200]),
    ifNode(IN(17), 'with buttons?', '={{ Array.isArray($json.buttons) }}', [1960, 200]),
    telegramButtons(IN(18), 'Telegram: reply with buttons', [2180, 120]),
    telegramText(IN(19), 'Telegram: reply', [2180, 280]),
    { parameters: { resource: 'callback', queryId: "={{ $('reply (deterministic)').first().json.callbackQueryId }}", additionalFields: {} },
      id: IN(20), name: 'Telegram: close the tap', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [2400, 280],
      onError: 'continueRegularOutput', executeOnce: true },
    ifNode(IN(21), 'was it a tap?', "={{ !!$('reply (deterministic)').first().json.callbackQueryId }}", [2400, 120]),
    // ---- extraction
    { parameters: { resource: 'file', fileId: "={{ $json.photoFileId || $json.documentFileId }}", additionalFields: {} },
      id: IN(22), name: 'Telegram: download the file', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [-240, -240],
      onError: 'continueRegularOutput' },
    code(IN(23), 'extraction: build the vision request', EX_REQUEST, [-20, -240]),
    { parameters: { method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/' + VISION_MODEL_PATH + ':generateContent',
                    authentication: 'predefinedCredentialType', nodeCredentialType: 'googlePalmApi',
                    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.visionBody) }}',
                    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 60000 } },
      id: IN(24), name: 'Gemini: read the prescription', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [200, -240],
      retryOnFail: true, maxTries: 2, waitBetweenTries: 2000 },
    code(IN(25), 'extraction: validate (deterministic)', EX_VALIDATE, [420, -240]),
    ifNode(IN(26), 'a body to save?', '={{ !!$json.body }}', [640, -240]),
    api(IN(27), 'backend: save the prescription', 'POST', API_BASE + '/prescriptions', [860, -320], '={{ JSON.stringify($json.body) }}'),
    code(IN(28), 'extraction: reply (deterministic)', EX_REPLY, [1080, -240]),
    telegramText(IN(29), 'Telegram: extraction reply', [1300, -320]),
    ifNode(IN(30), 'screen it?', '={{ $json.screen }}', [1300, -160]),
    { parameters: { method: 'POST', url: '={{ $json.screeningUrl }}', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
                    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.screeningBody) }}',
                    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 30000 } },
      id: IN(31), name: 'n8n: screen the new prescription', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1520, -160] },
    // ---- AP-11: the Orchestrator (a real router: prescription | medicine_package | other | unsure)
    ifNode(IN(32), 'photo?', "={{ $json.route === 'photo' }}", [-460, -420]),
    ifNode(IN(33), 'medicine box?', "={{ $json.route === 'travel' }}", [-460, -560]),
    ifNode(IN(34), 'fixed reply?', "={{ $json.route === 'reply' }}", [-460, -680]),
    { parameters: { resource: 'file', fileId: "={{ $json.photoFileId || $json.documentFileId }}", additionalFields: {} },
      id: IN(35), name: 'orchestrator: download the photo', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [-240, -420],
      onError: 'continueRegularOutput' },
    code(IN(36), 'orchestrator: ask what the photo is', ORCH_ASK, [-20, -420]),
    { parameters: { method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/' + VISION_MODEL_PATH + ':generateContent',
                    authentication: 'predefinedCredentialType', nodeCredentialType: 'googlePalmApi',
                    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.visionBody) }}',
                    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 30000 } },
      id: IN(37), name: 'Gemini: what is this photo?', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [200, -420],
      retryOnFail: true, maxTries: 2, waitBetweenTries: 2000 },
    code(IN(38), 'orchestrator: decide (deterministic)', ORCH_DECIDE, [420, -420]),
    ifNode(IN(39), 'a prescription (photo)?', "={{ $json.decidedKind === 'prescription' }}", [640, -420]),
    ifNode(IN(40), 'a medicine box (photo)?', "={{ $json.decidedKind === 'medicine_package' }}", [640, -560]),
    { parameters: { resource: 'file', fileId: "={{ $json.photoFileId || $json.documentFileId }}", additionalFields: {} },
      id: IN(41), name: 'Telegram: download for travel check', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [860, -560],
      onError: 'continueRegularOutput' },
    code(IN(42), 'orchestrator: build the travel request', ORCH_TRAVEL_REQUEST, [1080, -560]),
    { parameters: { method: 'POST', url: '={{ $json.travelUrl }}', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
                    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.travelBody) }}',
                    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 60000 } },
      id: IN(43), name: 'n8n: travel check', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1300, -560] },
    code(IN(44), 'orchestrator: travel reply (deterministic)', ORCH_TRAVEL_REPLY, [1520, -560]),
    telegramText(IN(45), 'Telegram: travel reply', [1740, -560]),
    code(IN(46), 'orchestrator: reply (deterministic)', ORCH_REPLY, [860, -680]),
    ifNode(IN(47), 'with two buttons?', '={{ Array.isArray($json.buttons) }}', [1080, -680]),
    telegramTwoButtons(IN(48), 'Telegram: orchestrator choice', [1300, -760]),
    telegramText(IN(49), 'Telegram: orchestrator text', [1300, -600]),
    ifNode(IN(50), 'an orchestrator tap?', '={{ !!$json.callbackQueryId }}', [1520, -680]),
    { parameters: { resource: 'callback', queryId: '={{ $json.callbackQueryId }}', additionalFields: {} },
      id: IN(51), name: 'Telegram: close the photo tap', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [1740, -680],
      onError: 'continueRegularOutput', executeOnce: true },
  ],
  connections: {
    'Relay from the app (CR-063)': main('route (deterministic)'),
    'route (deterministic)': main('a prescription photo?'),
    'a prescription photo?': main('Telegram: download the file', 'photo?'),
    'photo?': main('orchestrator: download the photo', 'medicine box?'),
    'medicine box?': main('Telegram: download for travel check', 'fixed reply?'),
    'fixed reply?': main('orchestrator: reply (deterministic)', 'backend: doses of the day'),
    'orchestrator: download the photo': main('orchestrator: ask what the photo is'),
    'orchestrator: ask what the photo is': main('Gemini: what is this photo?'),
    'Gemini: what is this photo?': main('orchestrator: decide (deterministic)'),
    'orchestrator: decide (deterministic)': main('a prescription (photo)?'),
    'a prescription (photo)?': main('Telegram: download the file', 'a medicine box (photo)?'),
    'a medicine box (photo)?': main('Telegram: download for travel check', 'orchestrator: reply (deterministic)'),
    'Telegram: download for travel check': main('orchestrator: build the travel request'),
    'orchestrator: build the travel request': main('n8n: travel check'),
    'n8n: travel check': main('orchestrator: travel reply (deterministic)'),
    'orchestrator: travel reply (deterministic)': main(['Telegram: travel reply', 'an orchestrator tap?']),
    'orchestrator: reply (deterministic)': main(['with two buttons?', 'an orchestrator tap?']),
    'with two buttons?': main('Telegram: orchestrator choice', 'Telegram: orchestrator text'),
    'an orchestrator tap?': main('Telegram: close the photo tap'),
    'backend: doses of the day': main('needs the model?'),
    'needs the model?': main('Gemini: classify the reply', 'decide (deterministic)'),
    'Gemini: classify the reply': main('decide (deterministic)'),
    'Gemini (chat model)': { ai_languageModel: [[{ node: 'Gemini: classify the reply', type: 'ai_languageModel', index: 0 }]] },
    'Gemini (fallback model)': { ai_languageModel: [[{ node: 'Gemini: classify the reply', type: 'ai_languageModel', index: 1 }]] },
    'Structured output': { ai_outputParser: [[{ node: 'Gemini: classify the reply', type: 'ai_outputParser', index: 0 }]] },
    'decide (deterministic)': main('anything to write?'),
    'anything to write?': main('backend: write 1', 'reply (deterministic)'),
    'backend: write 1': main('after write 1'),
    'after write 1': main('second write?'),
    'second write?': main('backend: write 2 (recompute)', 'reply (deterministic)'),
    'backend: write 2 (recompute)': main('reply (deterministic)'),
    'reply (deterministic)': main('with buttons?'),
    'with buttons?': main('Telegram: reply with buttons', 'Telegram: reply'),
    'Telegram: reply': main('was it a tap?'),
    'was it a tap?': main('Telegram: close the tap'),
    'Telegram: download the file': main('extraction: build the vision request'),
    'extraction: build the vision request': main('Gemini: read the prescription'),
    'Gemini: read the prescription': main('extraction: validate (deterministic)'),
    'extraction: validate (deterministic)': main('a body to save?'),
    'a body to save?': main('backend: save the prescription', 'extraction: reply (deterministic)'),
    'backend: save the prescription': main('extraction: reply (deterministic)'),
    'extraction: reply (deterministic)': main(['Telegram: extraction reply', 'screen it?']),
    'screen it?': main('n8n: screen the new prescription'),
  },
  settings: { executionOrder: 'v1', timezone: 'Asia/Kuwait' },
};

// =============================================================== 2. agent-checkin-daily
const CK = (n) => uuid('b2000000-0000-4000-8000-', n);

const CK_PLAN = CONFIG + '\n' + ADHERENCE + `

// Eligibility is the BACKEND's (tracking on AND the latest link connected) - never decided here.
const res = $input.first().json;
if (res.statusCode !== 200 || !Array.isArray(res.body)) return [];
const today = kuwaitDate(new Date().toISOString());
// every_other_day: a fixed, documented parity (days since 2026-01-01 even) - never a guess per patient.
const dayIndex = Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 86400000);
return res.body
  .filter((e) => e && e.patientId && e.chatId)
  .filter((e) => e.frequency !== 'every_other_day' || dayIndex % 2 === 0)
  .map((e) => ({ json: { patientId: e.patientId, chatId: e.chatId, language: e.language === 'en' ? 'en' : 'ar', date: today,
                         dosesUrl: API + '/patients/' + encodeURIComponent(e.patientId) + '/doses?date=' + today } }));`;

const CK_BUILD = ADHERENCE + `

// One patient per item: a header, then one message per OPEN dose with three buttons naming it.
// TC-AD-10: sending is all this does. Nothing is ever recorded from silence.
const plans = $('plan (deterministic)').all();
const out = [];
$input.all().forEach((item, i) => {
  const plan = plans[i] && plans[i].json;
  const res = item.json;
  if (!plan || res.statusCode !== 200 || !res.body || !Array.isArray(res.body.doses)) return;
  const c = buildCheckIn({ patientId: plan.patientId, chatId: plan.chatId, language: plan.language, doses: res.body.doses });
  for (const m of c.messages) out.push({ json: { chatId: m.chatId, text: m.text, buttons: m.buttons } });
});
return out;`;

const checkin = {
  name: 'agent-checkin-daily',
  nodes: [
    { parameters: { rule: { interval: [{ field: 'days', triggerAtHour: 8, triggerAtMinute: 0 }] } },
      id: CK(1), name: 'Daily 08:00 (Kuwait)', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [-460, 0] },
    { parameters: { httpMethod: 'POST', path: 'jurah/checkin-now', authentication: 'headerAuth', responseMode: 'onReceived', options: {} },
      id: CK(2), name: 'Send now (demo)', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-460, 200], webhookId: CK(2) },
    api(CK(3), 'backend: who is eligible', 'GET', API_BASE + '/check-in-eligibility', [-240, 100]),
    code(CK(4), 'plan (deterministic)', CK_PLAN, [-20, 100]),
    api(CK(5), 'backend: doses of the day', 'GET', '={{ $json.dosesUrl }}', [200, 100]),
    code(CK(6), 'check-in (deterministic)', CK_BUILD, [420, 100]),
    ifNode(CK(7), 'with buttons?', '={{ Array.isArray($json.buttons) }}', [640, 100]),
    telegramButtons(CK(8), 'Telegram: dose with buttons', [860, 20]),
    telegramText(CK(9), 'Telegram: header', [860, 180]),
  ],
  connections: {
    'Daily 08:00 (Kuwait)': main('backend: who is eligible'),
    'Send now (demo)': main('backend: who is eligible'),
    'backend: who is eligible': main('plan (deterministic)'),
    'plan (deterministic)': main('backend: doses of the day'),
    'backend: doses of the day': main('check-in (deterministic)'),
    'check-in (deterministic)': main('with buttons?'),
    'with buttons?': main('Telegram: dose with buttons', 'Telegram: header'),
  },
  settings: { executionOrder: 'v1', timezone: 'Asia/Kuwait' },
};

// =============================================================== 3. agent-interaction-screening
const SC = (n) => uuid('b3000000-0000-4000-8000-', n);

const SC_INPUT = CONFIG + `
const b = $input.first().json.body || {};
const id = /^[A-Za-z0-9_-]{1,64}$/;
if (!id.test(String(b.patientId || '')) || !id.test(String(b.newPrescriptionId || ''))) return [];
return [{ json: { patientId: b.patientId, newPrescriptionId: b.newPrescriptionId, language: b.language === 'en' ? 'en' : 'ar',
                  rxUrl: API + '/patients/' + encodeURIComponent(b.patientId) + '/prescriptions' } }];`;

const SC_SCREEN = SCREENING + `

// THE DETERMINISTIC LAYER: no model in this workflow at all. Grounded pairs only; nothing cleared.
const input = $('input (deterministic)').first().json;
const res = $input.first().json;
if (res.statusCode !== 200 || !res.body || !Array.isArray(res.body.prescriptions)) return [];
const r = screenNewPrescription({ patientId: input.patientId, newPrescriptionId: input.newPrescriptionId,
                                  prescriptions: res.body.prescriptions, language: input.language });
return r.alerts.map((a) => ({ json: { alert: a, excluded: r.excluded } }));`;

const screening = {
  name: 'agent-interaction-screening',
  nodes: [
    { parameters: { httpMethod: 'POST', path: 'jurah/screen-prescription', authentication: 'headerAuth', responseMode: 'onReceived', options: {} },
      id: SC(1), name: 'Screen a new prescription', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-460, 0], webhookId: SC(1) },
    code(SC(2), 'input (deterministic)', SC_INPUT, [-240, 0]),
    api(SC(3), 'backend: active prescriptions', 'GET', '={{ $json.rxUrl }}', [-20, 0]),
    code(SC(4), 'screen (deterministic)', SC_SCREEN, [200, 0]),
    api(SC(5), 'backend: raise the alert', 'POST', API_BASE + '/alerts', [420, 0], '={{ JSON.stringify($json.alert) }}'),
  ],
  connections: {
    'Screen a new prescription': main('input (deterministic)'),
    'input (deterministic)': main('backend: active prescriptions'),
    'backend: active prescriptions': main('screen (deterministic)'),
    'screen (deterministic)': main('backend: raise the alert'),
  },
  settings: { executionOrder: 'v1', timezone: 'Asia/Kuwait' },
};

// =============================================================== 4. agent-alexa (demo, READ-ONLY)
const AX = (n) => uuid('b4000000-0000-4000-8000-', n);

/**
 * The skill id and the Alexa-user -> patient link table. Empty in the repository on purpose: an
 * empty table fails closed ("this device is not linked"), and the live values are set in the n8n
 * node itself (the userId arrives in the first request's execution data).
 */
const ALEXA_CONFIG = "const ALEXA_SKILL_ID = '';\nconst ALEXA_LINKS = {};";

const AX_PARSE = CONFIG + '\n' + ALEXA_CONFIG + '\n' + ADHERENCE + '\n' + VOICE + '\n' + VOICE_ACTIONS + `

const body = $input.first().json.body || {};
const nowIso = new Date().toISOString();
const p = parseAlexaRequest({ body, nowIso, skillId: ALEXA_SKILL_ID, links: ALEXA_LINKS });
const date = kuwaitDate(nowIso);
// CR-070: a plain free-talk question is answered without the model (Alexa waits at most 8 seconds).
const quick = p.ok && p.kind === 'FreeTalkIntent' ? quickFreeTalk(p.utterance) : null;
return [{ json: { ...p, nowIso, date, quick,
  dosesUrl: p.ok ? API + '/patients/' + encodeURIComponent(p.patientId) + '/doses?date=' + date : null,
  voiceTurnUrl: p.ok ? API + '/patients/' + encodeURIComponent(p.patientId) + '/voice-turns' : null } }];`;

// Free talk -> the voice kind (and, for "record", the doses the patient named). Everything after is code.
const AX_INTENT = VOICE + '\n' + VOICE_ACTIONS + `

const p = $('alexa request (deterministic)').first().json;
let kind = p.kind;
let items = [];
if (p.ok && p.kind === 'FreeTalkIntent' && p.quick) kind = p.quick;
else if (p.ok && p.kind === 'FreeTalkIntent') {
  let c = null;
  try { c = $input.first().json.output || $input.first().json; } catch (e) { /* the model did not run */ }
  const t = p.utterance ? trustFreeTalk(c, p.utterance) : { kind: 'AMAZON.FallbackIntent', items: [] };
  kind = t.kind;
  items = t.items;
}
// The Arabic skill has no free talk: its slotless RecordDoseIntent («سجل الجرعة», «خذيت دواي») is a record
// request that names no dose, so every open dose that is due gets its buttons. No model runs for it.
else if (p.ok && p.kind === 'RecordDoseIntent') kind = 'record';
// A record request reads the schedule and the chat too: only to choose which buttons go to Telegram.
const needsDoses = p.ok && (VOICE_INTENTS.includes(kind) || kind === 'record');
return [{ json: { ...p, kind, items, needsDoses } }];`;

const AX_SPEAK = VOICE + '\n' + VOICE_ACTIONS + `

// THE DETERMINISTIC LAYER for voice: Alexa (or, for free talk, Gemini) picked the intent; this picks every word.
// Voice records nothing (CR-073): a record request gets the fixed line, and the buttons go to the patient's own chat.
const p = $('voice intent (deterministic)').first().json;
let doses = null;
let chatId = null;
try {
  const d = $('backend: doses of the day').first().json;
  if (d.statusCode === 200 && d.body && Array.isArray(d.body.doses)) doses = d.body.doses;
} catch (e) { /* not fetched */ }
try {
  const e = $('backend: who is eligible').first().json;
  const mine = e.statusCode === 200 && Array.isArray(e.body) ? e.body.find((x) => x.patientId === p.patientId) : null;
  chatId = mine ? mine.chatId : null;
} catch (e) { /* not fetched */ }
let reply;
if (!p.ok && p.kind === 'refused') reply = { speech: '', endSession: true, promptDoses: [] };
else if (!p.ok) reply = { speech: p.language === 'en' ? 'This device is not linked to a Jur\\'ah account yet.' : 'هذا الجهاز مو مربوط بحساب في جرعة بعد.', endSession: true, promptDoses: [] };
else if (p.kind === 'record') reply = recordReply({ items: p.items, doses, nowIso: p.nowIso, language: p.language, hasChat: !!chatId });
else reply = voiceReply({ kind: p.kind, language: p.language, doses, nowIso: p.nowIso, hasChat: !!chatId });
return [{ json: {
  alexa: alexaResponse({ speech: reply.speech, endSession: reply.endSession, language: p.language }),
  refused: !p.ok && p.kind === 'refused',
  prompts: reply.promptDoses.map((d) => d.id), promptDoses: reply.promptDoses, chatId, language: p.language, patientId: p.patientId || null,
  // CR-069: what the patient's open web app should follow - a LINKED patient's turn only; the words are the ones just spoken.
  screen: p.ok && screenTopic(p.kind) && reply.speech ? { topic: screenTopic(p.kind), language: p.language, reply: reply.speech } : null,
  // Visible in the execution log, so the device can be linked: never spoken, never stored elsewhere.
  log: { kind: p.kind, userId: p.userId, reason: p.reason || null },
} }];`;

// Free talk's prompt and schema live in agents/lib/voice-actions.js beside trustFreeTalk, so this
// node and agents/eval send one string.
const AX_PROMPT_TEXT = require('../lib/voice-actions.js').FREE_TALK_PROMPT;
const AX_SCHEMA = JSON.stringify(require('../lib/voice-actions.js').FREE_TALK_SCHEMA, null, 2);

const AX_PROMPT = ADHERENCE + `

// "I forgot" or a record request by voice -> the doses' three buttons in the PATIENT'S OWN chat. The tap records it.
const s = $('speak (deterministic)').first().json;
if (!s.chatId || !s.promptDoses.length) return [];
const c = buildCheckIn({ patientId: s.patientId, chatId: s.chatId, language: s.language, doses: s.promptDoses });
const head = s.language === 'en' ? 'From your Alexa: confirm the dose you asked about 👇' : 'من أليكسا: أكّد الجرعة اللي سألت عنها 👇';
return [{ json: { chatId: s.chatId, text: head, buttons: null } }]
  .concat(c.messages.slice(1).map((m) => ({ json: { chatId: m.chatId, text: m.text, buttons: m.buttons } })));`;

const alexa = {
  name: 'agent-alexa',
  nodes: [
    { parameters: { httpMethod: 'POST', path: 'jurah/alexa', responseMode: 'responseNode', options: {} },
      id: AX(1), name: 'Alexa skill request', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-680, 0], webhookId: AX(1) },
    code(AX(2), 'alexa request (deterministic)', AX_PARSE, [-460, 0]),
    ifNode(AX(3), 'needs the schedule?', '={{ $json.ok && $json.needsDoses }}', [-240, 0]),
    api(AX(4), 'backend: doses of the day', 'GET', '={{ $json.dosesUrl }}', [-20, -120]),
    api(AX(5), 'backend: who is eligible', 'GET', API_BASE + '/check-in-eligibility', [200, -120]),
    { ...code(AX(6), 'speak (deterministic)', AX_SPEAK, [420, 0]), executeOnce: true },
    { parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify($json.alexa) }}', options: {} },
      id: AX(7), name: 'Answer Alexa', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [640, 0] },
    ifNode(AX(8), 'prompt Telegram?', "={{ $('speak (deterministic)').first().json.prompts.length > 0 }}", [860, 0]),
    code(AX(9), 'telegram prompt (deterministic)', AX_PROMPT, [1080, -80]),
    ifNode(AX(10), 'with buttons?', '={{ Array.isArray($json.buttons) }}', [1300, -80]),
    telegramButtons(AX(11), 'Telegram: dose buttons', [1520, -160]),
    telegramText(AX(12), 'Telegram: header', [1520, 0]),
    ifNode(AX(15), 'needs the model?', "={{ $json.ok && $json.kind === 'FreeTalkIntent' && !!$json.utterance && !$json.quick }}", [-460, 200]),
    // Alexa waits at most 8 seconds: one try, no retry waits; a failure is 'unclear', never a guess.
    // gemini-3-flash-preview took 11 s on a live voice turn; gemini-3.6-flash answered in 4.8 s - so for voice it goes first.
    { ...gemini(AX(17), 'Gemini (chat model)', GEMINI_FALLBACK_MODEL, [-400, 420]), retryOnFail: false, maxTries: 1 },
    { ...gemini(AX(18), 'Gemini (fallback model)', GEMINI_MODEL, [-400, 560]), retryOnFail: false, maxTries: 1 },
    { parameters: { schemaType: 'manual', inputSchema: AX_SCHEMA }, id: AX(19), name: 'Structured output',
      type: '@n8n/n8n-nodes-langchain.outputParserStructured', typeVersion: 1.2, position: [-220, 420] },
    { parameters: { promptType: 'define', text: "={{ $('alexa request (deterministic)').first().json.utterance || '-' }}", hasOutputParser: true, needsFallback: true,
                    messages: { messageValues: [{ message: AX_PROMPT_TEXT }] } },
      id: AX(16), name: 'Gemini: understand the sentence', type: '@n8n/n8n-nodes-langchain.chainLlm', typeVersion: 1.5, position: [-340, 200],
      onError: 'continueRegularOutput' },
    code(AX(20), 'voice intent (deterministic)', AX_INTENT, [-240, 0]),
    ifNode(AX(13), 'follow on screen?', "={{ $('speak (deterministic)').first().json.screen !== null }}", [860, 200]),
    api(AX(14), 'backend: voice turn for the screen', 'POST', "={{ $('alexa request (deterministic)').first().json.voiceTurnUrl }}", [1080, 200],
      "={{ JSON.stringify($('speak (deterministic)').first().json.screen) }}"),
  ],
  connections: {
    'Alexa skill request': main('alexa request (deterministic)'),
    'alexa request (deterministic)': main('needs the model?'),
    'needs the model?': main('Gemini: understand the sentence', 'voice intent (deterministic)'),
    'Gemini (chat model)': { ai_languageModel: [[{ node: 'Gemini: understand the sentence', type: 'ai_languageModel', index: 0 }]] },
    'Gemini (fallback model)': { ai_languageModel: [[{ node: 'Gemini: understand the sentence', type: 'ai_languageModel', index: 1 }]] },
    'Structured output': { ai_outputParser: [[{ node: 'Gemini: understand the sentence', type: 'ai_outputParser', index: 0 }]] },
    'Gemini: understand the sentence': main('voice intent (deterministic)'),
    'voice intent (deterministic)': main('needs the schedule?'),
    'needs the schedule?': main('backend: doses of the day', 'speak (deterministic)'),
    'backend: doses of the day': main('backend: who is eligible'),
    'backend: who is eligible': main('speak (deterministic)'),
    'speak (deterministic)': main('Answer Alexa'),
    'Answer Alexa': main(['prompt Telegram?', 'follow on screen?']),
    'follow on screen?': main('backend: voice turn for the screen'),
    'prompt Telegram?': main('telegram prompt (deterministic)'),
    'telegram prompt (deterministic)': main('with buttons?'),
    'with buttons?': main('Telegram: dose buttons', 'Telegram: header'),
  },
  settings: { executionOrder: 'v1', timezone: 'Asia/Kuwait' },
};

// =============================================================== 5. agent-webchat (CR-067, READ-ONLY)
const WC = (n) => uuid('b5000000-0000-4000-8000-', n);

// webchat.js without webchatReply: the classifier helpers only (webchatReply needs voice.js).
const WEBCHAT_HELPERS = WEBCHAT.replace(/\/\*\*\n \* The whole answer\.[\s\S]*$/, '');
if (!/function quickIntent/.test(WEBCHAT_HELPERS) || /function webchatReply/.test(WEBCHAT_HELPERS)) throw new Error('could not split webchat.js');

const WC_PARSE = CONFIG + '\n' + ADHERENCE + '\n' + WEBCHAT_HELPERS + `

// The app's server (lib/assistant) has already verified the PATIENT session and sends only that
// patient's id, the text, the locale and the alerts it read under that session. Fail closed anyway.
const b = $input.first().json.body || {};
const id = /^[A-Za-z0-9_-]{1,64}$/;
const text = typeof b.text === 'string' ? b.text.trim().slice(0, 500) : '';
if (!id.test(String(b.patientId || '')) || !text) return [{ json: { ok: false, language: b.language === 'en' ? 'en' : 'ar' } }];
const nowIso = new Date().toISOString();
const date = kuwaitDate(nowIso);
// The fast path: a suggestion button or a one-meaning phrase needs no model call (null = ask Gemini).
return [{ json: { ok: true, patientId: b.patientId, text, language: b.language === 'en' ? 'en' : 'ar', nowIso, date, quick: quickIntent(text),
  alerts: Array.isArray(b.alerts) ? b.alerts.slice(0, 20).map((a) => ({ severity: String(a.severity || ''), description: String(a.description || '').slice(0, 300), reviewStatus: String(a.reviewStatus || '') })) : [],
  dosesUrl: API + '/patients/' + encodeURIComponent(b.patientId) + '/doses?date=' + date } }];`;

const WC_INTENT = WEBCHAT_HELPERS + `
// The fast path's intent, else the model's - trusted only inside the list and above the floor (G11).
// Then: does the answer need the schedule, and does it need the patient's Telegram chat?
const p = $('chat request (deterministic)').first().json;
const c = $input.first().json.output || $input.first().json;
const intent = !p.ok ? 'unclear' : (p.quick || trustWebchatIntent(c));
return [{ json: { ...p, intent, viaModel: p.ok && !p.quick, needsDoses: p.ok && needsDoses(intent), needsChat: p.ok && needsChat(intent) } }];`;

const WC_ANSWER = VOICE + '\n' + WEBCHAT + `

// THE DETERMINISTIC LAYER: Gemini picked the intent; every word below comes from data or fixed text.
const q = $('intent (deterministic)').first().json;
let doses = null;
let chatId = null;
try {
  const d = $('backend: doses of the day').first().json;
  if (d.statusCode === 200 && d.body && Array.isArray(d.body.doses)) doses = d.body.doses;
} catch (e) { /* not fetched */ }
try {
  const e = $('backend: who is eligible').first().json;
  const mine = e.statusCode === 200 && Array.isArray(e.body) ? e.body.find((x) => x.patientId === q.patientId) : null;
  chatId = mine ? mine.chatId : null;
} catch (e) { /* not fetched */ }
const r = webchatReply({ intent: q.intent, language: q.language, doses, alerts: q.alerts, nowIso: q.nowIso, hasChat: !!chatId });
return [{ json: { reply: r.reply, intent: q.intent, prompts: r.promptDoses.map((d) => d.id),
  promptDoses: r.promptDoses, chatId, language: q.language, patientId: q.patientId } }];`;

const WC_PROMPT = ADHERENCE + `

// "I took it" / "I forgot" in the web chat -> that dose's buttons in the PATIENT'S OWN Telegram chat.
const s = $('answer (deterministic)').first().json;
if (!s.chatId || !s.promptDoses.length) return [];
const c = buildCheckIn({ patientId: s.patientId, chatId: s.chatId, language: s.language, doses: s.promptDoses });
const head = s.language === 'en' ? 'From the Jur\\'ah app: confirm your dose here 👇' : 'من تطبيق جرعة: أكّد جرعتك هنا 👇';
return [{ json: { chatId: s.chatId, text: head, buttons: null } }]
  .concat(c.messages.slice(1).map((m) => ({ json: { chatId: m.chatId, text: m.text, buttons: m.buttons } })));`;

// The web chat's prompt and schema live in agents/lib/webchat.js beside trustWebchatIntent, so this
// node and agents/eval send one string.
const WC_PROMPT_TEXT = require('../lib/webchat.js').WEBCHAT_PROMPT;
const WC_SCHEMA = JSON.stringify(require('../lib/webchat.js').WEBCHAT_SCHEMA, null, 2);

const webchat = {
  name: 'agent-webchat',
  nodes: [
    { parameters: { httpMethod: 'POST', path: 'jurah/webchat', authentication: 'headerAuth', responseMode: 'responseNode', options: {} },
      id: WC(1), name: 'App assistant request', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-900, 0], webhookId: WC(1) },
    code(WC(2), 'chat request (deterministic)', WC_PARSE, [-680, 0]),
    gemini(WC(3), 'Gemini (chat model)', GEMINI_MODEL, [-520, 220]),
    gemini(WC(4), 'Gemini (fallback model)', GEMINI_FALLBACK_MODEL, [-520, 360]),
    { parameters: { schemaType: 'manual', inputSchema: WC_SCHEMA }, id: WC(5), name: 'Structured output',
      type: '@n8n/n8n-nodes-langchain.outputParserStructured', typeVersion: 1.2, position: [-340, 220] },
    { parameters: { promptType: 'define', text: "={{ $('chat request (deterministic)').first().json.text || '-' }}", hasOutputParser: true, needsFallback: true,
                    messages: { messageValues: [{ message: WC_PROMPT_TEXT }] } },
      id: WC(6), name: 'Gemini: classify the question', type: '@n8n/n8n-nodes-langchain.chainLlm', typeVersion: 1.5, position: [-460, 0],
      onError: 'continueRegularOutput' },
    ifNode(WC(18), 'needs the model?', '={{ $json.ok && !$json.quick }}', [-560, 0]),
    code(WC(7), 'intent (deterministic)', WC_INTENT, [-240, 0]),
    ifNode(WC(8), 'needs the schedule?', '={{ $json.needsDoses }}', [-20, 0]),
    ifNode(WC(19), 'needs the chat?', "={{ $('intent (deterministic)').first().json.needsChat }}", [310, -120]),
    api(WC(9), 'backend: doses of the day', 'GET', '={{ $json.dosesUrl }}', [200, -120]),
    api(WC(10), 'backend: who is eligible', 'GET', API_BASE + '/check-in-eligibility', [420, -120]),
    code(WC(11), 'answer (deterministic)', WC_ANSWER, [640, 0]),
    { parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ reply: $json.reply, intent: $json.intent, telegramPrompted: $json.prompts.length > 0 }) }}', options: {} },
      id: WC(12), name: 'Answer the app', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [860, 0] },
    ifNode(WC(13), 'prompt Telegram?', "={{ $('answer (deterministic)').first().json.prompts.length > 0 }}", [1080, 0]),
    code(WC(14), 'telegram prompt (deterministic)', WC_PROMPT, [1300, -80]),
    ifNode(WC(15), 'with buttons?', '={{ Array.isArray($json.buttons) }}', [1520, -80]),
    telegramButtons(WC(16), 'Telegram: dose buttons', [1740, -160]),
    telegramText(WC(17), 'Telegram: header', [1740, 0]),
  ],
  connections: {
    'App assistant request': main('chat request (deterministic)'),
    'chat request (deterministic)': main('needs the model?'),
    'needs the model?': main('Gemini: classify the question', 'intent (deterministic)'),
    'Gemini (chat model)': { ai_languageModel: [[{ node: 'Gemini: classify the question', type: 'ai_languageModel', index: 0 }]] },
    'Gemini (fallback model)': { ai_languageModel: [[{ node: 'Gemini: classify the question', type: 'ai_languageModel', index: 1 }]] },
    'Structured output': { ai_outputParser: [[{ node: 'Gemini: classify the question', type: 'ai_outputParser', index: 0 }]] },
    'Gemini: classify the question': main('intent (deterministic)'),
    'intent (deterministic)': main('needs the schedule?'),
    'needs the schedule?': main('backend: doses of the day', 'answer (deterministic)'),
    'backend: doses of the day': main('needs the chat?'),
    'needs the chat?': main('backend: who is eligible', 'answer (deterministic)'),
    'backend: who is eligible': main('answer (deterministic)'),
    'answer (deterministic)': main('Answer the app'),
    'Answer the app': main('prompt Telegram?'),
    'prompt Telegram?': main('telegram prompt (deterministic)'),
    'telegram prompt (deterministic)': main('with buttons?'),
    'with buttons?': main('Telegram: dose buttons', 'Telegram: header'),
  },
  settings: { executionOrder: 'v1', timezone: 'Asia/Kuwait' },
};

for (const wf of [inbound, checkin, screening, alexa, webchat]) write(wf);
console.log('JURAH_API_BASE = ' + API_BASE + (process.env.JURAH_API_BASE ? '' : '   <- placeholder: rebuild with the deployed URL before import'));
