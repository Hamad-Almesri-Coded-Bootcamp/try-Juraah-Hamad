'use strict';

/**
 * One adapter per evaluation set. Each sends its items through the exact prompt, schema and code
 * the committed workflow uses, and scores what the workflow would do with the model's answer:
 *
 *   extraction   agent-extraction (D3: the one extraction core): its "input (deterministic)" node
 *                builds the vision request, the model reads the image, its "validate
 *                (deterministic)" node turns the reading into the body it would save. Scored on the
 *                twelve core fields of that body against the ground truth.
 *   adherence    agent-telegram-inbound's "Gemini: classify the reply": the node's own prompt and
 *                schema (agents/lib/adherence.js, one string) and its models in fallback order, then
 *                trustClassification (G11, the same rule the "decide" node applies). Scored on intent.
 *   screening-*  agent-interaction-screening-ddinter (D2): no model. Each pair is two active
 *                prescriptions of one patient; its "screen (deterministic)" node decides.
 *   travel       agent-travel-check: its "input" node builds the vision request, its "check" node
 *                resolves the name against the SFDA brand map. Scored on the resolved ingredients.
 *   routing      no model router exists yet (AP-11 builds the Orchestrator): never measured here.
 *
 * An item whose model call or workflow step fails is an ERROR, not a wrong answer and never a right
 * one: a run with any error is not a measurement.
 */

const fs = require('node:fs');
const path = require('node:path');
const { loadWorkflow, runCode, chainContract, visionNode, AGENTS } = require('./workflow');
const { chatUrl, chatRequest, responseText, send } = require('./gemini');
const { fileOf } = require('./datasets');

const EVAL_PATIENT = 'eval-patient';

/** Thrown when the harness cannot measure a set at all (as opposed to one item failing). */
class NotMeasurable extends Error {}

// ------------------------------------------------------------------------------ adherence
function adherenceContract() {
  const A = require('../lib/adherence.js');
  const c = chainContract(loadWorkflow('agent-telegram-inbound'), 'Gemini: classify the reply');
  if (c.prompt !== A.CLASSIFY_PROMPT) throw new NotMeasurable('adherence - the committed agent-telegram-inbound does not carry agents/lib/adherence.js CLASSIFY_PROMPT: rebuild the workflows (cd agents && npm run build)');
  if (c.schemaText !== JSON.stringify(A.CLASSIFY_SCHEMA, null, 2)) throw new NotMeasurable('adherence - the committed agent-telegram-inbound does not carry agents/lib/adherence.js CLASSIFY_SCHEMA: rebuild the workflows');
  return { ...c, schema: A.CLASSIFY_SCHEMA, trust: A.trustClassification };
}

/** The chain turn with n8n's fallback: the next model only when the one before did not answer. */
async function chainTurn(ctx, c, text) {
  const failures = [];
  for (const m of c.models) {
    const res = await send(ctx.transport, { url: chatUrl(m.model), body: chatRequest({ prompt: c.prompt, schema: c.schema, text, temperature: m.temperature }) },
      { tries: m.tries, waitMs: m.waitMs }, ctx.sleep);
    if (res && res.statusCode === 200) {
      let parsed = null;
      try { parsed = JSON.parse(responseText(res.body) || ''); } catch (e) { parsed = null; }
      return { ok: true, model: m.model, parsed };
    }
    failures.push(m.model + ' answered HTTP ' + (res ? res.statusCode : 'none') + (res && res.error ? ' (' + res.error + ')' : ''));
  }
  return { ok: false, error: failures.join('; ') };
}

async function adherence(items, ctx) {
  const c = adherenceContract();
  const results = [];
  for (const it of items) {
    // The route node hands the chain text.slice(0, 500), and asks the model only for a non-blank reply.
    const text = it.text.slice(0, 500);
    let classification = {};
    let model = null;
    if (it.text.trim().length > 0) {
      const turn = await chainTurn(ctx, c, text);
      if (!turn.ok) { results.push({ id: it.id, error: turn.error }); continue; }
      model = turn.model;
      // An answer that does not parse is what n8n's output parser turns into an error item: unclear.
      classification = turn.parsed && typeof turn.parsed === 'object' ? turn.parsed : {};
    }
    const t = c.trust(classification);
    results.push({ id: it.id, correct: t.intent === it.expected, units: 1, unitsCorrect: t.intent === it.expected ? 1 : 0,
      expected: it.expected, got: t.intent, detail: { claimed: t.claimed, confidence: t.confidence, guardrail: t.guardrail, model } });
  }
  return results;
}

// ------------------------------------------------------------------------------ extraction
/** The twelve core fields scored for extraction: the Prescription contract's clinical fields. */
const CORE_FIELDS = ['facilityName', 'sector', 'genericName', 'brandName', 'strength', 'strengthUnit',
  'dosePerAdministration', 'frequencyPerDay', 'doseTimes', 'dosingPattern', 'durationDays', 'startDate'];
const TEXT_FIELDS = ['facilityName', 'genericName', 'brandName'];

/** The core fields of what the workflow would save; all null when it saves nothing. */
function savedFields(result) {
  const none = Object.fromEntries(CORE_FIELDS.map((f) => [f, null]));
  if (!result || result.ok !== true || !result.body || !result.body.prescription) return none;
  const p = result.body.prescription;
  const d = p.drug || {};
  const s = p.source || {};
  const v = (x) => (x === undefined ? null : x);
  return {
    facilityName: v(s.facilityName), sector: v(s.sector), genericName: v(d.genericName), brandName: v(d.brandName),
    strength: v(d.strengthMg), strengthUnit: v(d.strengthUnit), dosePerAdministration: v(p.dosePerAdministration),
    frequencyPerDay: v(p.frequencyPerDay), doseTimes: v(p.doseTimes), dosingPattern: v(p.dosingPattern),
    durationDays: v(p.durationDays), startDate: v(p.startDate),
  };
}

const normText = (s) => String(s).normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
function sameField(field, expected, got) {
  if (expected === null || got === null) return expected === null && got === null;
  if (field === 'doseTimes') {
    if (!Array.isArray(got) || got.length !== expected.length) return false;
    const a = expected.slice().sort();
    const b = got.slice().sort();
    return a.every((x, i) => x === b[i]);
  }
  if (TEXT_FIELDS.includes(field)) return normText(expected) === normText(got);
  return expected === got;
}

async function extraction(items, ctx, dir) {
  const wf = loadWorkflow('agent-extraction');
  const vision = visionNode(wf, 'Gemini: read the prescription');
  const results = [];
  for (const it of items) {
    const f = fileOf(dir, it);
    const [input] = await runCode(wf, 'input (deterministic)', { input: [{ body: { patientId: EVAL_PATIENT, imageBase64: f.base64, mimeType: f.mimeType, language: it.language, save: false } }] });
    if (!input || input.valid !== true) { results.push({ id: it.id, error: 'the workflow refused the file: ' + (input && input.error) }); continue; }
    const res = await send(ctx.transport, { url: vision.url, body: input.visionBody }, vision, ctx.sleep);
    if (!res || res.statusCode !== 200) { results.push({ id: it.id, error: 'the vision model answered HTTP ' + (res ? res.statusCode : 'none') + (res && res.error ? ' (' + res.error + ')' : '') }); continue; }
    const [v] = await runCode(wf, 'validate (deterministic)', { input: [res], refs: { 'input (deterministic)': [input] } });
    const got = savedFields(v && v.result);
    const wrong = CORE_FIELDS.filter((k) => !sameField(k, it.expected[k], got[k]));
    results.push({ id: it.id, correct: wrong.length === 0, units: CORE_FIELDS.length, unitsCorrect: CORE_FIELDS.length - wrong.length,
      expected: Object.fromEntries(wrong.map((k) => [k, it.expected[k]])), got: Object.fromEntries(wrong.map((k) => [k, got[k]])),
      detail: { outcome: v && v.result ? (v.result.ok ? (v.result.needsReview ? 'flagged' : 'confident') : v.result.code) : 'no result',
                uncertainFields: v && v.result && v.result.uncertainFields, finish: v && v.visionFinish } });
  }
  return results;
}

// ------------------------------------------------------------------------------ screening
function syntheticRx(id, genericName) {
  return {
    id, patientId: EVAL_PATIENT, source: { facilityName: 'Evaluation facility', sector: 'public' },
    drug: { genericName }, dosePerAdministration: 1, frequencyPerDay: 1, durationDays: 30, dosingPattern: 'daily',
    startDate: '2026-09-01', doseTimes: ['08:00'], needsReview: false, status: 'active',
  };
}

/** One pair through the DDInter workflow's own nodes -> the alerts it would raise, with their evidence. */
async function screenPair(item) {
  const wf = loadWorkflow('agent-interaction-screening-ddinter');
  const [input] = await runCode(wf, 'input (deterministic)', { input: [{ body: { patientId: EVAL_PATIENT, newPrescriptionId: 'eval-rx-b', language: 'en' } }] });
  if (!input || input.valid !== true) return { error: 'the workflow refused the request: ' + (input && input.error) };
  const out = await runCode(wf, 'screen (deterministic)', {
    input: [{ statusCode: 200, body: { prescriptions: [syntheticRx('eval-rx-a', item.drugA), syntheticRx('eval-rx-b', item.drugB)] } }],
    refs: { 'input (deterministic)': [input] },
  });
  const result = out[0] && out[0].result;
  if (!result || !result.evidence) return { error: 'the screen node returned no result' + (out[0] && out[0].error ? ' (' + out[0].error + ')' : '') };
  if (result.report && result.report.mustEscalate) return { error: 'the screen node withheld an alert that failed validation' };
  const findings = result.evidence.findings || [];
  return { findings: findings.map((f, i) => ({ type: f.findingType, severity: f.severity, citation: (result.alerts[i] && result.alerts[i].sourceCitation) || '' })) };
}

async function screeningInteracting(items) {
  const results = [];
  for (const it of items) {
    const r = await screenPair(it);
    if (r.error) { results.push({ id: it.id, error: r.error }); continue; }
    const hits = r.findings.filter((f) => f.type === 'interaction');
    // Recall, and every positive carries the matched record as its citation (section 4 pass criteria).
    const found = hits.length > 0 && hits.every((f) => f.citation.trim().length > 0);
    results.push({ id: it.id, correct: found, units: 1, unitsCorrect: found ? 1 : 0, expected: 'a graded interaction with a citation',
      got: found ? hits.map((f) => f.severity).join(', ') : (r.findings.map((f) => f.type).join(', ') || 'nothing'),
      detail: { citation: hits.length ? hits[0].citation.slice(0, 200) : null, expectedSeverity: it.expectedSeverity || null } });
  }
  return results;
}

async function screeningNonInteracting(items) {
  const results = [];
  for (const it of items) {
    const r = await screenPair(it);
    if (r.error) { results.push({ id: it.id, error: r.error }); continue; }
    const raised = r.findings.filter((f) => f.type === 'interaction' || f.type === 'duplicate_therapy');
    const clean = raised.length === 0;
    results.push({ id: it.id, correct: clean, units: 1, unitsCorrect: clean ? 1 : 0, expected: 'no interaction',
      got: r.findings.map((f) => f.type + (f.severity ? ' ' + f.severity : '')).join(', ') || 'nothing',
      // "not_covered" raises no interaction, and is also not a clearance: the index cannot verify the pair.
      detail: { notCovered: r.findings.some((f) => f.type === 'not_covered') } });
  }
  return results;
}

// ------------------------------------------------------------------------------ travel
async function travel(items, ctx, dir) {
  const { canonical } = require('../knowledge/src/normalise.js');
  const wf = loadWorkflow('agent-travel-check');
  const vision = visionNode(wf, 'Gemini: read the name on the box');
  const results = [];
  for (const it of items) {
    const f = fileOf(dir, it);
    const [input] = await runCode(wf, 'input (deterministic)', { input: [{ body: { patientId: EVAL_PATIENT, imageBase64: f.base64, mimeType: f.mimeType, language: 'en' } }] });
    if (!input || input.valid !== true) { results.push({ id: it.id, error: 'the workflow refused the file: ' + (input && input.error) }); continue; }
    const res = await send(ctx.transport, { url: vision.url, body: input.visionBody }, vision, ctx.sleep);
    if (!res || res.statusCode !== 200) { results.push({ id: it.id, error: 'the vision model answered HTTP ' + (res ? res.statusCode : 'none') + (res && res.error ? ' (' + res.error + ')' : '') }); continue; }
    // An empty profile: identification is scored here; screening against a profile is the screening sets.
    const [c] = await runCode(wf, 'check (deterministic)', {
      input: [res],
      refs: { 'input (deterministic)': [input], 'backend: active prescriptions': [{ statusCode: 200, body: { prescriptions: [] } }] },
    });
    const result = c && c.result;
    const cand = result && result.candidate;
    const want = [...new Set(it.expected.ingredients.map((x) => canonical(x)))].sort();
    const got = cand ? [...new Set(cand.ingredientKeys)].sort() : [];
    const ok = !!cand && got.length === want.length && got.every((x, i) => x === want[i]);
    results.push({ id: it.id, correct: ok, units: 1, unitsCorrect: ok ? 1 : 0, expected: want.join(' + '), got: got.join(' + ') || (result ? result.verdict : 'no result'),
      detail: { verdict: result && result.verdict, readAs: cand ? cand.readAs : (result && result.readAs) || null, brand: it.expected.brand } });
  }
  return results;
}

// ------------------------------------------------------------------------------ routing
async function routing() {
  const orchestrator = path.join(AGENTS, 'lib', 'orchestrator.js');
  throw new NotMeasurable(fs.existsSync(orchestrator)
    ? 'routing - agents/lib/orchestrator.js exists, but agents/eval/sets.js is not wired to it yet (AP-11 wires it, with its prompt and routes)'
    : 'routing - the Telegram workflow has no Orchestrator yet: every patient photo goes to extraction and no model chooses a route (AP-11 builds agents/lib/orchestrator.js and wires this set)');
}

const ADAPTERS = {
  extraction: { run: extraction, model: true, unit: 'fields' },
  adherence: { run: adherence, model: true, unit: 'replies' },
  'screening-interacting': { run: screeningInteracting, model: false, unit: 'pairs' },
  'screening-non-interacting': { run: screeningNonInteracting, model: false, unit: 'pairs' },
  travel: { run: travel, model: true, unit: 'photos' },
  // No model is called until AP-11 wires the Orchestrator: a missing key must not hide that.
  routing: { run: routing, model: false, unit: 'inputs' },
};

module.exports = { ADAPTERS, NotMeasurable, CORE_FIELDS, savedFields, sameField, syntheticRx, EVAL_PATIENT, adherenceContract };
