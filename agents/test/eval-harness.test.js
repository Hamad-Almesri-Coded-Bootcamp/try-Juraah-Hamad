'use strict';

/**
 * AP-08 - agents/eval/run.js against its plan (docs/AGENTS-POLISH-PLAN.md 7.3):
 *   step 2  each item goes through the exact prompt, schema and code the workflow uses, and is
 *           scored against the spec threshold;
 *   step 3  no dataset, or fewer items than the minimum, is NOT MEASURED with exit code 1;
 *   acceptance  red on the committed (empty) sets, green on a one-item smoke file in a temporary
 *           folder outside the repository.
 * No test calls a real model: the transport is injected. Fixture phrases come from the spec's own
 * table (section 2); fixture drug pairs and brands come from the committed DDInter index and SFDA
 * brand map. None of them is an evaluation item: the datasets stay empty until people supply them.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { evaluate, passes, shownPercent, writeSmokeExample } = require('../eval/run.js');
const { validate } = require('../eval/schema.js');
const { loadSet, insideRepository } = require('../eval/datasets.js');
const A = require('../lib/adherence.js');
const X = require('../knowledge/src/extraction.js');
const INDEX = require('../knowledge/data/interaction-index.json');
const BRANDS = require('../knowledge/data/brand-map.json');

const AGENTS = path.join(__dirname, '..');
const noSleep = async () => {};

function tmp(t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jurah-eval-'));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
}
const writeSet = (dir, set, items, extra = {}) => {
  const file = path.join(dir, set + '.json');
  fs.writeFileSync(file, JSON.stringify({ set, ...extra, items }, null, 2));
  return file;
};
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a0a50000000049454e44ae426082', 'hex');
const printer = () => { const out = []; return { out, print: (l) => out.push(l) }; };
const gemini = (text, finishReason = 'STOP') => ({ statusCode: 200, body: { candidates: [{ finishReason, content: { parts: [{ text }] } }] } });

// The spec's own language table (AI Agents Acceptance Criteria section 2).
const SPEC_TABLE = [['خذيته', 'taken_on_time'], ['أخذته', 'taken_on_time'], ['خذيته بس متأخر شوي', 'taken_late'], ['ما خذيته', 'missed'],
  ['نسيت أخذه', 'missed'], ['خلص الدوا', 'ran_out'], ['ما بقى عندي', 'ran_out'], ['دكتوري قال أوقف الدواء', 'discontinued_by_doctor']];
const adherenceItems = (n) => Array.from({ length: n }, (_, i) => ({ id: 'spec-' + i, text: SPEC_TABLE[i % SPEC_TABLE.length][0],
  expected: SPEC_TABLE[i % SPEC_TABLE.length][1], verifiedBy: 'test fixture from the spec table, not a dataset item' }));
/** A fake model that answers the spec's intent for a phrase, except for the item ids in `wrong`. */
function adherenceModel(items, { wrong = [], confidence = 0.9 } = {}) {
  const calls = [];
  let i = 0;
  const transport = async (req) => {
    calls.push(req);
    const it = items[i++];
    const intent = wrong.includes(it.id) ? 'unclear' : it.expected;
    return gemini(JSON.stringify({ intent, confidence, quote: req.body.contents[0].parts[0].text }));
  };
  return { transport, calls };
}

test('AP-08 acceptance: the runner is red on the committed empty sets - every set NOT MEASURED, exit code 1', () => {
  const r = spawnSync(process.execPath, ['eval/run.js'], { cwd: AGENTS, encoding: 'utf8', env: { ...process.env, GEMINI_API_KEY: '' } });
  assert.equal(r.status, 1);
  assert.deepEqual(r.stdout.trim().split(/\r?\n/), [
    'NOT MEASURED: extraction has 0 of 10 items',
    'NOT MEASURED: adherence has 0 of 20 items',
    'NOT MEASURED: screening-interacting has 0 of 3 items',
    'NOT MEASURED: screening-non-interacting has 0 of 3 items',
    'NOT MEASURED: travel has 0 of 5 items',
    'NOT MEASURED: routing has 0 of 15 items',
    '',
    '0 of 6 sets measured; 0 passed - exit code 1: every set must be measured and pass',
  ]);
});

test('AP-08 step 3: fewer items than the minimum is NOT MEASURED, and the model is never called', async (t) => {
  const dir = tmp(t);
  const items = adherenceItems(19);
  writeSet(dir, 'adherence', items);
  const m = adherenceModel(items);
  const p = printer();
  const r = await evaluate({ sets: ['adherence'], datasetsDir: dir, transport: m.transport, sleep: noSleep, print: p.print, env: {} });
  assert.equal(r.exitCode, 1);
  assert.equal(p.out[0], 'NOT MEASURED: adherence has 19 of 20 items');
  assert.equal(m.calls.length, 0);
});

test('AP-08 step 3: a missing, invalid or still-owed data file is NOT MEASURED', async (t) => {
  const dir = tmp(t);
  const run = async () => { const p = printer(); const r = await evaluate({ sets: ['adherence'], datasetsDir: dir, transport: adherenceModel([]).transport, print: p.print, env: {} }); return { r, line: p.out[0] }; };

  let x = await run();
  assert.equal(x.r.exitCode, 1);
  assert.match(x.line, /^NOT MEASURED: adherence - the data file .*adherence\.json does not exist$/);

  fs.writeFileSync(path.join(dir, 'adherence.json'), '{ not json');
  assert.match((await run()).line, /^NOT MEASURED: adherence - the data file is not valid JSON/);

  writeSet(dir, 'adherence', [{ id: 'a', text: 'خذيته', expected: 'taken', verifiedBy: 'x y' }]);
  assert.match((await run()).line, /^NOT MEASURED: adherence - the data file does not match adherence\.schema\.json: \$\.items\[0\]\.expected: must be one of/);

  const owedValue = ['TO', 'BE', 'SUPPLIED'].join(' ');
  writeSet(dir, 'adherence', adherenceItems(20).map((it, i) => (i === 3 ? { ...it, verifiedBy: '[' + owedValue + ']' } : it)));
  assert.equal((await run()).line, 'NOT MEASURED: adherence - item "spec-3" still holds an owed-value marker');

  writeSet(dir, 'adherence', adherenceItems(20), { owed: '[' + owedValue + '] by the team' });
  assert.equal((await run()).line, 'NOT MEASURED: adherence still carries its owed-value marker: delete "owed" from the data file once the set is supplied');
});

test('AP-08 step 3: a model set without GEMINI_API_KEY in the shell is NOT MEASURED', async (t) => {
  const dir = tmp(t);
  writeSet(dir, 'adherence', adherenceItems(20));
  const p = printer();
  const r = await evaluate({ sets: ['adherence'], datasetsDir: dir, print: p.print, env: {} });
  assert.equal(r.exitCode, 1);
  assert.equal(p.out[0], 'NOT MEASURED: adherence needs GEMINI_API_KEY in this shell (it is read from the environment only, never from a file)');
});

test('AP-08 step 3: a failed model call is NOT MEASURED, never scored as "unclear" - both models tried under the node retry policy', async (t) => {
  const dir = tmp(t);
  // Every expected intent is "unclear": counting a failure as unclear would score 100%.
  writeSet(dir, 'adherence', adherenceItems(20).map((it) => ({ ...it, expected: 'unclear' })));
  const urls = [];
  const transport = async (req) => { urls.push(req.url); return { statusCode: 503, body: null }; };
  const p = printer();
  const r = await evaluate({ sets: ['adherence'], datasetsDir: dir, transport, sleep: noSleep, print: p.print, env: {} });
  assert.equal(r.exitCode, 1);
  assert.match(p.out[0], /^NOT MEASURED: adherence - 20 of 20 items could not be run, so this is not a measurement: spec-0 \(models\/gemini-3-flash-preview answered HTTP 503; models\/gemini-3\.6-flash answered HTTP 503\)/);
  // agent-telegram-inbound: each Gemini node retries 3 times, then n8n falls back to the second model.
  assert.deepEqual(urls.slice(0, 6), [
    ...Array(3).fill('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent'),
    ...Array(3).fill('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent'),
  ]);
});

test('AP-08 step 2: adherence sends the node\'s own prompt, schema and model, then applies G11 - 18 of 20 passes at 90%, 17 of 20 fails', async (t) => {
  const dir = tmp(t);
  const items = adherenceItems(20);
  writeSet(dir, 'adherence', items);

  let m = adherenceModel(items, { wrong: ['spec-4', 'spec-9'] });
  let p = printer();
  let r = await evaluate({ sets: ['adherence'], datasetsDir: dir, transport: m.transport, sleep: noSleep, print: p.print, env: {} });
  assert.equal(r.exitCode, 0);
  assert.equal(p.out[0], 'PASS adherence: 18 of 20 replies correct (90.0%) - the spec needs at least 90% correct intent classification on Kuwaiti-dialect replies on at least 20 items (section 2, Adherence Agent)');
  assert.match(p.out[1], /^ {8}miss spec-4: expected missed, got unclear/);
  const req = m.calls[0];
  assert.equal(req.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent');
  assert.equal(req.body.systemInstruction.parts[0].text, A.CLASSIFY_PROMPT);
  assert.deepEqual(req.body.generationConfig, { responseMimeType: 'application/json', responseSchema: A.CLASSIFY_SCHEMA, temperature: 0 });
  assert.equal(req.body.contents[0].parts[0].text, 'خذيته');

  m = adherenceModel(items, { wrong: ['spec-1', 'spec-2', 'spec-3'] });
  p = printer();
  r = await evaluate({ sets: ['adherence'], datasetsDir: dir, transport: m.transport, sleep: noSleep, print: p.print, env: {} });
  assert.equal(r.exitCode, 1);
  assert.match(p.out[0], /^FAIL adherence: 17 of 20 replies correct \(85\.0%\)/);
});

test('AP-08 step 2: G11 in the score - an answer below 0.7, an unknown intent or an unparsable answer is "unclear"', async (t) => {
  const dir = tmp(t);
  const items = adherenceItems(20);
  const file = writeSet(dir, 'adherence', items);
  const answers = [JSON.stringify({ intent: 'taken_on_time', confidence: 0.69, quote: 'x' }), JSON.stringify({ intent: 'took_it', confidence: 1, quote: 'x' }), 'not json'];
  let i = 0;
  const transport = async () => gemini(answers[i++ % answers.length]);
  const r = await evaluate({ sets: ['adherence'], datasetsDir: dir, transport, sleep: noSleep, print: () => {}, env: {} });
  assert.ok(fs.existsSync(file));
  assert.equal(r.sets[0].status, 'FAIL');
  assert.equal(r.sets[0].correct, 0);
  assert.deepEqual([...new Set(r.sets[0].results.map((x) => x.got))], ['unclear']);
});

test('AP-08: a score is compared on whole counts and never rounded into a pass', () => {
  assert.equal(passes(9, 10, 90), true);
  assert.equal(passes(179, 199, 90), false);
  assert.equal(shownPercent(179, 199), '89.9');
  assert.equal(passes(14, 15, 95), false);
  assert.equal(shownPercent(14, 15), '93.3');
  assert.equal(passes(2, 3, 100), false);
  assert.equal(shownPercent(2, 3), '66.6');
});

test('AP-08 acceptance: green on a one-item smoke file in a temporary folder, with an injected model - and never a measurement', async (t) => {
  const dir = tmp(t);
  const file = writeSet(dir, 'adherence', [{ id: 'smoke-1', text: 'خذيته', expected: 'taken_on_time', verifiedBy: 'the spec table, section 2' }]);
  const outFile = path.join(dir, 'result.json');
  const m = adherenceModel([{ id: 'smoke-1', expected: 'taken_on_time' }]);
  const p = printer();
  const r = await evaluate({ smoke: file, transport: m.transport, sleep: noSleep, print: p.print, env: {}, outFile });
  assert.equal(r.exitCode, 0);
  assert.deepEqual(p.out, [
    'SMOKE OK adherence: 1 of 1 replies correct (100.0%) - a plumbing check on 1 item(s), NOT a measurement (the spec needs at least 20 items)',
    '',
    'smoke check passed - this is not a measurement of any threshold',
  ]);
  assert.equal(JSON.parse(fs.readFileSync(outFile, 'utf8')).smoke, true);
});

test('AP-08: --smoke-example writes the spec\'s first reply to a temporary folder, and without a key it is NOT MEASURED', async (t) => {
  const ex = writeSmokeExample();
  t.after(() => fs.rmSync(ex.dir, { recursive: true, force: true }));
  assert.equal(insideRepository(ex.file), false);
  const m = adherenceModel([{ id: 'spec-table-1', expected: 'taken_on_time' }]);
  const r = await evaluate({ smoke: ex.file, transport: m.transport, sleep: noSleep, print: () => {}, env: {} });
  assert.equal(r.exitCode, 0);
  assert.equal(m.calls[0].body.contents[0].parts[0].text, SPEC_TABLE[0][0]);

  const cli = spawnSync(process.execPath, ['eval/run.js', '--smoke-example'], { cwd: AGENTS, encoding: 'utf8', env: { ...process.env, GEMINI_API_KEY: '' } });
  assert.equal(cli.status, 1);
  const lines = cli.stdout.trim().split(/\r?\n/);
  const tmpFile = lines[0].replace('smoke file (temporary, removed afterwards): ', '');
  assert.equal(lines[1], 'NOT MEASURED: adherence needs GEMINI_API_KEY in this shell (it is read from the environment only, never from a file)');
  assert.equal(fs.existsSync(tmpFile), false, 'the temporary smoke file is removed');
});

test('AP-08: a smoke file inside the repository is refused', async () => {
  const p = printer();
  const r = await evaluate({ smoke: path.join(AGENTS, 'eval', 'datasets', 'adherence.json'), transport: async () => gemini('{}'), print: p.print, env: {} });
  assert.equal(r.exitCode, 1);
  assert.match(p.out[0], /^NOT MEASURED: a smoke file must live in a temporary folder outside the repository/);
});

// ------------------------------------------------------------------------------ extraction
const TRUTH = {
  isPrescription: true, facilityName: 'Evaluation clinic', sector: 'private', genericName: 'Amoxicillin', brandName: 'Amoxil',
  strength: 500, strengthUnit: 'mg', dosePerAdministration: 1, frequencyPerDay: 3, doseTimes: ['08:00', '14:00', '20:00'],
  dosingPattern: 'daily', durationDays: 7, startDate: '2026-09-20',
};
const sure = (over = {}) => ({ ...Object.fromEntries(X.CONFIDENCE_KEYS.map((k) => [k, 0.95])), ...over });
function extractionItem(dir, id, extra = {}) {
  fs.writeFileSync(path.join(dir, id + '.png'), PNG);
  return { id, file: id + '.png', layout: 'typed', language: 'en', synthetic: true, suppliedBy: 'test fixture', expected: { ...TRUTH }, ...extra };
}

test('AP-08 step 2: extraction runs agent-extraction\'s own nodes - PROMPT and RESPONSE_SCHEMA to the node\'s URL, scored on the twelve core fields', async (t) => {
  const dir = tmp(t);
  const file = writeSet(dir, 'extraction', [extractionItem(dir, 'rx-1')]);
  const calls = [];
  let reading = { ...TRUTH, doseTimes: ['20:00', '08:00', '14:00'], facilityName: '  evaluation   CLINIC ', confidence: sure() };
  const transport = async (req) => { calls.push(req); return gemini(JSON.stringify(reading)); };

  let p = printer();
  let r = await evaluate({ smoke: file, transport, sleep: noSleep, print: p.print, env: {} });
  assert.equal(r.exitCode, 0, p.out.join('\n'));
  assert.match(p.out[0], /^SMOKE OK extraction: 12 of 12 fields correct across 1 prescriptions \(100\.0%\)/);
  assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent');
  assert.equal(calls[0].body.contents[0].parts[0].text, X.PROMPT);
  assert.deepEqual(calls[0].body.generationConfig, { temperature: 0, responseMimeType: 'application/json', responseSchema: X.RESPONSE_SCHEMA });
  assert.equal(calls[0].body.contents[0].parts[1].inlineData.data, PNG.toString('base64'));

  // An unsure strength is left unset by the deterministic layer: one field missed, and the smoke goes red.
  reading = { ...TRUTH, confidence: sure({ strength: 0.5 }) };
  p = printer();
  r = await evaluate({ smoke: file, transport, sleep: noSleep, print: p.print, env: {} });
  assert.equal(r.exitCode, 1);
  assert.match(p.out[0], /^SMOKE FAILED extraction: 10 of 12 fields correct/);
  assert.match(p.out[1], /miss rx-1: expected \{"strength":500,"strengthUnit":"mg"\}, got \{"strength":null,"strengthUnit":null\}/);

  // TC-EX-04: not a prescription -> nothing saved; a ground truth of "not a prescription" scores every field.
  reading = { isPrescription: false, confidence: sure() };
  const nope = { ...TRUTH, isPrescription: false };
  for (const k of Object.keys(nope)) if (k !== 'isPrescription') nope[k] = null;
  const dir2 = tmp(t);
  const file2 = writeSet(dir2, 'extraction', [extractionItem(dir2, 'rx-2', { expected: nope })]);
  r = await evaluate({ smoke: file2, transport, sleep: noSleep, print: () => {}, env: {} });
  assert.equal(r.exitCode, 0);
  assert.equal(r.sets[0].correct, 12);

  // A truncated answer is not a reading (the workflow's finishReason rule).
  const truncated = async () => gemini(JSON.stringify({ ...TRUTH, confidence: sure() }), 'MAX_TOKENS');
  r = await evaluate({ smoke: file, transport: truncated, sleep: noSleep, print: () => {}, env: {} });
  assert.equal(r.sets[0].correct, 0);
});

test('AP-08 step 3: an extraction set must be representative - typed and handwritten, Arabic and English', async (t) => {
  const dir = tmp(t);
  const items = Array.from({ length: 10 }, (_, i) => extractionItem(dir, 'rx-' + i, { language: i % 2 ? 'ar' : 'en' }));
  writeSet(dir, 'extraction', items);
  const p = printer();
  const r = await evaluate({ sets: ['extraction'], datasetsDir: dir, transport: async () => gemini('{}'), print: p.print, env: {} });
  assert.equal(r.exitCode, 1);
  assert.equal(p.out[0], 'NOT MEASURED: extraction has no handwritten prescription (the spec asks for typed and handwritten, Arabic and English)');
});

// ------------------------------------------------------------------------------ screening
const levels = (want) => Object.entries(INDEX.pairs).filter(([, v]) => want.includes(v.level)).map(([k]) => k.split('|'));
const label = (key) => INDEX.drugs[key].label;
function noPairs(n) {
  const keys = Object.keys(INDEX.drugs).sort();
  const out = [];
  for (let i = 0; i < keys.length && out.length < n; i++) {
    for (let j = i + 1; j < keys.length && out.length < n; j++) if (!INDEX.pairs[keys[i] + '|' + keys[j]]) out.push([keys[i], keys[j]]);
  }
  return out;
}

test('AP-08 step 2: screening recall through the DDInter workflow\'s own nodes (TC-IX-01) - every graded pair found with its citation', async (t) => {
  const dir = tmp(t);
  const graded = levels(['Major', 'Moderate']).slice(0, 3);
  assert.equal(graded.length, 3, 'the committed index has fewer than 3 graded pairs');
  const items = graded.map(([a, b], i) => ({ id: 'ix-' + i, drugA: label(a), drugB: label(b), citation: 'test fixture: the committed DDInter index row', verifiedBy: 'test fixture' }));
  writeSet(dir, 'screening-interacting', items);
  let p = printer();
  let r = await evaluate({ sets: ['screening-interacting'], datasetsDir: dir, print: p.print, env: {} });
  assert.equal(r.exitCode, 0, p.out.join('\n'));
  assert.match(p.out[0], /^PASS screening-interacting: 3 of 3 pairs correct \(100\.0%\) - the spec needs at least 100% recall/);

  // A drug the index does not cover is "cannot verify", not a finding: recall misses it, and 100% is not met.
  writeSet(dir, 'screening-interacting', [...items.slice(0, 2), { ...items[2], drugB: 'Zzqxtril' }]);
  p = printer();
  r = await evaluate({ sets: ['screening-interacting'], datasetsDir: dir, print: p.print, env: {} });
  assert.equal(r.exitCode, 1);
  assert.match(p.out[0], /^FAIL screening-interacting: 2 of 3 pairs correct \(66\.6%\)/);
  assert.match(p.out[1], /miss ix-2: expected a graded interaction with a citation, got not_covered/);
});

test('AP-08 step 2: non-interacting pairs are reported, with no invented threshold (TC-IX-02)', async (t) => {
  const dir = tmp(t);
  const pairs = noPairs(3);
  writeSet(dir, 'screening-non-interacting', pairs.map(([a, b], i) => ({ id: 'no-' + i, drugA: label(a), drugB: label(b), basis: 'test fixture: no row in the committed index', verifiedBy: 'test fixture' })));
  const p = printer();
  const r = await evaluate({ sets: ['screening-non-interacting'], datasetsDir: dir, print: p.print, env: {} });
  assert.equal(r.exitCode, 0, p.out.join('\n'));
  assert.match(p.out[0], /^REPORTED screening-non-interacting: 3 of 3 pairs correct \(100\.0%\) - pairs that raised no interaction \(reported; the spec sets no threshold for this set\)/);
});

// ------------------------------------------------------------------------------ travel
test('AP-08 step 2: travel runs agent-travel-check\'s own nodes - its BRAND_PROMPT, then the SFDA brand map', async (t) => {
  const dir = tmp(t);
  const brand = BRANDS.brands.find((b) => b.verified === true);
  fs.writeFileSync(path.join(dir, 'box.png'), PNG);
  const file = writeSet(dir, 'travel', [{ id: 'box-1', file: 'box.png', expected: { brand: brand.brand, ingredients: brand.ingredients }, suppliedBy: 'test fixture' }]);
  const calls = [];
  const transport = async (req) => { calls.push(req); return gemini(brand.brand); };
  const p = printer();
  const r = await evaluate({ smoke: file, transport, sleep: noSleep, print: p.print, env: {} });
  assert.equal(r.exitCode, 0, p.out.join('\n'));
  assert.match(p.out[0], /^SMOKE OK travel: 1 of 1 photos correct/);
  const wf = JSON.parse(fs.readFileSync(path.join(AGENTS, 'knowledge', 'workflows', 'agent-travel-check.json'), 'utf8'));
  const code = wf.nodes.find((n) => n.name === 'input (deterministic)').parameters.jsCode;
  const brandPrompt = JSON.parse(code.match(/^const BRAND_PROMPT = (".*");$/m)[1]);
  assert.equal(calls[0].body.contents[0].parts[0].text, brandPrompt);
  assert.deepEqual(calls[0].body.generationConfig, { temperature: 0 });

  // G5: the model's UNREADABLE is honoured - not identified.
  const r2 = await evaluate({ smoke: file, transport: async () => gemini('UNREADABLE'), sleep: noSleep, print: () => {}, env: {} });
  assert.equal(r2.exitCode, 1);
  assert.equal(r2.sets[0].results[0].got, 'could_not_identify');
});

// ------------------------------------------------------------------------------ routing
function routingItems(dir, { box = 3, carer = 1 } = {}) {
  fs.writeFileSync(path.join(dir, 'photo.png'), PNG);
  const items = [];
  for (let i = 0; i < box; i++) items.push({ id: 'box-' + i, from: 'patient', kind: 'photo', file: 'photo.png', expected: 'clarify', boxOrPrescription: true });
  for (let i = 0; i < carer; i++) items.push({ id: 'carer-' + i, from: 'active_caregiver', kind: 'text', text: 'أبوي خذ الدوا', expected: 'caregiver_reply' });
  while (items.length < 15) items.push({ id: 'text-' + items.length, from: 'patient', kind: 'text', text: 'خذيته', expected: 'adherence' });
  return items;
}

test('AP-08 step 2: routing is NOT MEASURED while no Orchestrator exists (AP-11), even with a full set', async (t) => {
  const dir = tmp(t);
  writeSet(dir, 'routing', routingItems(dir));
  const p = printer();
  // No key and no transport: what stops the measurement is the missing Orchestrator, and the output says so.
  const r = await evaluate({ sets: ['routing'], datasetsDir: dir, print: p.print, env: {} });
  assert.equal(r.exitCode, 1);
  assert.match(p.out[0], /^NOT MEASURED: routing - the Telegram workflow has no Orchestrator yet/);
});

test('AP-08 step 3: a routing set needs 3 box-or-prescription confusions and 1 caregiver message (section 6)', async (t) => {
  const dir = tmp(t);
  writeSet(dir, 'routing', routingItems(dir, { box: 2 }));
  let p = printer();
  await evaluate({ sets: ['routing'], datasetsDir: dir, print: p.print, env: {} });
  assert.equal(p.out[0], 'NOT MEASURED: routing has 2 of 3 box-or-prescription confusions');
  writeSet(dir, 'routing', routingItems(dir, { carer: 0 }));
  p = printer();
  await evaluate({ sets: ['routing'], datasetsDir: dir, print: p.print, env: {} });
  assert.equal(p.out[0], 'NOT MEASURED: routing has 0 of 1 caregiver messages');
});

// ------------------------------------------------------------------------------ the key, the schemas, the item rules
test('AP-08: GEMINI_API_KEY is never printed, even when an error message carries it', async (t) => {
  const dir = tmp(t);
  writeSet(dir, 'adherence', adherenceItems(20));
  const key = 'eval-test-key-0123456789';
  const transport = async () => { throw new Error('refused for key ' + key); };
  const p = printer();
  await evaluate({ sets: ['adherence'], datasetsDir: dir, transport, sleep: noSleep, print: p.print, env: { GEMINI_API_KEY: key } });
  assert.ok(p.out.join('\n').includes('[redacted]'));
  assert.ok(!p.out.join('\n').includes(key));
});

test('AP-08: the dataset schemas are enforced, and a keyword the validator does not know is an error', () => {
  const s = { type: 'object', required: ['a'], additionalProperties: false, properties: { a: { type: ['integer', 'null'], minimum: 1 } } };
  assert.deepEqual(validate(s, { a: 2 }), []);
  assert.deepEqual(validate(s, { a: null }), []);
  assert.deepEqual(validate(s, { a: 0 }), ['$.a: below 1']);
  assert.deepEqual(validate(s, { a: 1.5 }), ['$.a: must be integer or null, is number']);
  assert.deepEqual(validate(s, { b: 1 }), ['$: missing "a"', '$: unknown field "b"']);
  assert.throws(() => validate({ type: 'string', format: 'date' }, 'x'), /does not support the keyword "format"/);
  // Every committed schema uses only supported keywords, and every committed data file is valid.
  for (const set of ['extraction', 'adherence', 'screening-interacting', 'screening-non-interacting', 'travel', 'routing']) {
    const r = loadSet(set, path.join(AGENTS, 'eval', 'datasets', set + '.json'));
    assert.deepEqual(r.problems, [], set);
    assert.deepEqual(r.items, [], set + ' must stay empty until people supply it');
    assert.ok(r.owed.startsWith('[' + ['TO', 'BE', 'SUPPLIED'].join(' ') + '] by '), set + ' must keep its owed-value marker while empty');
  }
});

test('AP-08: rules a schema cannot state are checked item by item', async (t) => {
  const dir = tmp(t);
  const nope = { ...TRUTH, isPrescription: false };
  const bad = [
    extractionItem(dir, 'e1', { expected: nope }),
    extractionItem(dir, 'e2', { expected: { ...TRUTH, strengthUnit: null } }),
    extractionItem(dir, 'e3', { expected: { ...TRUTH, doseTimes: ['08:00'] } }),
  ];
  const r = loadSet('extraction', writeSet(dir, 'extraction', bad));
  assert.equal(r.problems.length, 3);
  assert.match(r.problems[0], /^item "e1": isPrescription is false, so every other expected field must be null/);
  assert.match(r.problems[1], /^item "e2": expected\.strength and expected\.strengthUnit go together/);
  assert.match(r.problems[2], /^item "e3": expected\.doseTimes has 1 times for a frequencyPerDay of 3/);

  const rr = loadSet('routing', writeSet(dir, 'routing', [{ id: 'r1', from: 'patient', kind: 'photo', expected: 'extraction' }, { id: 'r2', from: 'patient', kind: 'text', expected: 'adherence', boxOrPrescription: true, text: 'x' }]));
  assert.deepEqual(rr.problems, ['item "r1": a photo needs its file', 'item "r2": boxOrPrescription is only for a photo or a document']);

  const rs = loadSet('screening-interacting', writeSet(dir, 'screening-interacting', [{ id: 's1', drugA: 'Warfarin', drugB: 'warfarin', citation: 'a citation text', verifiedBy: 'x y' }]));
  assert.deepEqual(rs.problems, ['item "s1": drugA and drugB are the same drug']);

  const rm = loadSet('travel', writeSet(dir, 'travel', [{ id: 't1', file: 'missing.png', expected: { brand: 'B', ingredients: ['Simvastatin'] }, suppliedBy: 'x y' }]));
  assert.deepEqual(rm.problems, ['item "t1": the file missing.png does not exist next to the data file']);
});
