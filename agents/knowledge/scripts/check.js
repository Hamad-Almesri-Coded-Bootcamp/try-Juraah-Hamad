'use strict';

/**
 * Prove the GENERATED workflows, not just the source they came from:
 *   1. every file is ASCII-only, parses, and still carries its Arabic after un-escaping;
 *   2. node names are unique and every connection names a node that exists;
 *   3. every webhook requires header auth; every Code node compiles as n8n compiles it;
 *   4. no /webhook-test/ URL, no secret-shaped string, no credential blob; no dose, recompute or
 *      reviewer route is called; the only backend writes are POST /alerts and POST /prescriptions;
 *   5. the Code nodes EXECUTE, in workflow order, on the seed's scenarios - with n8n's $ / $input
 *      API stubbed and each HTTP node replaced by the response the backend (or Gemini) would give;
 *   6. every path from the webhook answers exactly once (responseNode workflows) or never (the
 *      onReceived screening workflow, which answers on receipt like the one it replaces), and every
 *      escalation ends in a Stop and Error node so a withheld or refused alert fails the execution.
 * Exit code 1 on any failure.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');
const NAMES = ['agent-interaction-screening-ddinter', 'agent-travel-check', 'agent-extraction'];
const RESPONSE_MODE = { 'agent-interaction-screening-ddinter': 'onReceived', 'agent-travel-check': 'responseNode', 'agent-extraction': 'responseNode' };
const WF = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', name + '.json'), 'ascii'));
const SEED = require('../test/seed-prescriptions.json');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

let failures = 0;
const check = (label, fn) => Promise.resolve().then(fn).then(
  () => console.log('  OK    ' + label),
  (e) => { failures += 1; console.log('  FAIL  ' + label + '\n        ' + String((e && e.stack) || e).split('\n').slice(0, 6).join('\n        ')); }
);

// --------------------------------------------------------------- static checks
async function staticChecks() {
  console.log('\n######## static');
  for (const name of NAMES) {
    const raw = fs.readFileSync(path.join(ROOT, 'workflows', name + '.json'));
    const wf = JSON.parse(raw.toString('ascii'));
    const text = raw.toString('ascii');
    await check(name + ': ASCII-only, parses, Arabic intact', () => {
      assert.ok([...raw].every((b) => b <= 0x7f), 'a byte above 0x7F');
      assert.match(JSON.stringify(wf), /[؀-ۿ]/, 'no Arabic survived un-escaping');
    });
    await check(name + ': unique node names, every connection resolves', () => {
      const names = wf.nodes.map((n) => n.name);
      assert.equal(new Set(names).size, names.length, 'duplicate node name');
      for (const [from, outs] of Object.entries(wf.connections)) {
        assert.ok(names.includes(from), 'connection from unknown node ' + from);
        for (const kind of Object.values(outs)) for (const branch of kind) for (const c of branch) assert.ok(names.includes(c.node), from + ' -> unknown ' + c.node);
      }
    });
    await check(name + ': one webhook, header auth, response mode ' + RESPONSE_MODE[name], () => {
      const hooks = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.webhook');
      assert.equal(hooks.length, 1);
      assert.equal(hooks[0].parameters.authentication, 'headerAuth');
      assert.equal(hooks[0].parameters.responseMode, RESPONSE_MODE[name]);
      assert.equal(wf.nodes.some((n) => n.type === 'n8n-nodes-base.respondToWebhook'), RESPONSE_MODE[name] === 'responseNode');
    });
    await check(name + ': every escalation ends in a Stop and Error node', () => {
      const stops = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.stopAndError');
      assert.ok(stops.length >= 1);
      for (const st of stops) {
        assert.equal(st.parameters.errorType, 'errorMessage');
        const into = Object.entries(wf.connections).filter(([, o]) => (o.main || []).flat().some((c) => c.node === st.name)).map(([f]) => f);
        assert.equal(into.length, 1, st.name + ' has one way in');
        const from = wf.nodes.find((n) => n.name === into[0]);
        assert.equal(from.type, 'n8n-nodes-base.if', st.name + ' is reached through an IF');
        const cond = from.parameters.conditions.conditions[0].leftValue;
        assert.ok(/mustEscalate|!\$json\.ok|\$json\.valid/.test(cond), st.name + ' guarded by ' + cond);
      }
    });
    await check(name + ': every path from the webhook answers ' + (RESPONSE_MODE[name] === 'responseNode' ? 'exactly once' : 'never (answered on receipt)'), () => {
      const expected = RESPONSE_MODE[name] === 'responseNode' ? 1 : 0;
      const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
      const next = (n) => ((wf.connections[n] && wf.connections[n].main) || []).flat().map((c) => c.node);
      const start = wf.nodes.find((n) => n.type === 'n8n-nodes-base.webhook').name;
      let paths = 0;
      const walk = (n, seen, responds) => {
        assert.ok(!seen.includes(n), 'cycle at ' + n);
        const r = responds + (byName[n].type === 'n8n-nodes-base.respondToWebhook' ? 1 : 0);
        const outs = next(n);
        if (outs.length === 0) { paths += 1; assert.equal(r, expected, 'path ' + seen.concat(n).join(' > ') + ' answers ' + r + ' times'); return; }
        for (const o of outs) walk(o, seen.concat(n), r);
      };
      walk(start, [], 0);
      assert.ok(paths >= 2);
    });
    await check(name + ': every Code node compiles', () => {
      for (const n of wf.nodes.filter((x) => x.type === 'n8n-nodes-base.code')) {
        try { new AsyncFunction('$input', '$', n.parameters.jsCode); } catch (e) { throw new Error(n.name + ': ' + e.message); }
      }
    });
    await check(name + ': no /webhook-test/, no secret, no credential blob, no forbidden route', () => {
      assert.ok(!text.includes('/webhook-test/'), '/webhook-test/ URL');
      assert.ok(!/Bearer\s+[A-Za-z0-9._-]{12,}/.test(text), 'an inline bearer token');
      assert.ok(!/"credentials"\s*:/.test(text), 'credentials are bound by hand, never shipped');
      assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(text), 'a Google API key');
      assert.ok(!/invalid\/api\/agent/.test(text), 'built with the placeholder backend URL');
      const http = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest');
      for (const n of http) {
        const url = String(n.parameters.url);
        if (/\/api\/agent/.test(url)) assert.ok(!/\/doses\b|\/schedule\/|\/status\b|review/i.test(url), n.name + ' calls a forbidden route: ' + url);
        else assert.ok(url.startsWith('https://generativelanguage.googleapis.com/') || (url === '={{ $json.rxUrl }}' && n.parameters.method === 'GET'), n.name + ' calls an unexpected host: ' + url);
        if (n.parameters.method === 'POST' && /\/api\/agent/.test(url)) assert.ok(/\/alerts$|\/prescriptions$/.test(url), n.name + ' writes ' + url);
      }
    });
  }
}

// --------------------------------------------------------------- the stubbed runtime
function runner(wf) {
  const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
  const out = {};
  const ref = (name) => {
    if (!(name in out)) throw new Error('Referenced node is unexecuted: ' + name);
    return { first: () => out[name][0], all: () => out[name] };
  };
  return {
    set(name, items) { assert.ok(byName[name], 'no node ' + name); out[name] = items; return items; },
    async code(name, input) {
      const n = byName[name];
      assert.ok(n && n.type === 'n8n-nodes-base.code', 'no Code node ' + name);
      const $input = { first: () => input[0], all: () => input };
      const result = await new AsyncFunction('$input', '$', n.parameters.jsCode).call({}, $input, ref);
      assert.ok(Array.isArray(result), name + ' must return an array of items');
      out[name] = result;
      return result;
    }
  };
}
const http = (statusCode, body) => [{ json: { statusCode, body } }];
const webhookItem = (body) => [{ json: { body } }];
const geminiText = (text, finishReason) => http(200, { candidates: [{ finishReason: finishReason || 'STOP', content: { parts: [{ text }] } }] });
/** A travel-check vision reading (the isMedicine/brandAsPrinted/ingredientsAsPrinted/strengthAsPrinted
 *  schema), JSON.stringified as the model's own answer text - any field left out reads as "not
 *  printed" (isMedicine defaults true, since most scenarios are about a medicine box). */
const medicineRead = (over) => JSON.stringify(Object.assign(
  { isMedicine: true, brandAsPrinted: null, ingredientsAsPrinted: [], strengthAsPrinted: null }, over));
const active = (patientId) => SEED.filter((p) => p.patientId === patientId && p.status === 'active');
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// --------------------------------------------------------------- scenarios
async function screeningScenarios() {
  console.log('\n######## agent-interaction-screening-ddinter');
  const wf = WF('agent-interaction-screening-ddinter');

  // AP-04/CR-074: the legacy agent-interaction-screening.json is retired, and this is the only
  // workflow on the path - no n8n workflow calls it any more (the backend's own requestScreening
  // does, waiting at most 8s (SCREENING_TIMEOUT_MS) for the 2xx this webhook answers on receipt).
  await check('the only workflow on jurah/screen-prescription: POST, headerAuth, onReceived', () => {
    const hook = wf.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
    assert.equal(hook.parameters.httpMethod, 'POST');
    assert.equal(hook.parameters.path, 'jurah/screen-prescription');
    assert.equal(hook.parameters.authentication, 'headerAuth');
    assert.equal(hook.parameters.responseMode, 'onReceived');
    const extraction = fs.readFileSync(path.join(ROOT, 'workflows', 'agent-extraction.json'), 'ascii');
    const travel = fs.readFileSync(path.join(ROOT, 'workflows', 'agent-travel-check.json'), 'ascii');
    assert.ok(!extraction.includes('screen-prescription'), 'agent-extraction no longer calls screening itself (AP-04)');
    assert.ok(!travel.includes('screen-prescription'), 'agent-travel-check never called screening');
  });

  // F2: vitamin D3 is in the index now (no interaction with Levothyroxine) - only the graded row remains.
  await check('seed pt-03, new rx-009: one alert POSTed (the DDInter Moderate warning), summary reports it 201', async () => {
    const r = runner(wf);
    const [inp] = await r.code('input (deterministic)', webhookItem({ patientId: 'pt-03', newPrescriptionId: 'rx-009', language: 'ar' }));
    assert.equal(inp.json.valid, true);
    assert.equal(inp.json.dryRun, false);
    assert.match(inp.json.rxUrl, /^https:\/\/tryjuraaah\.vercel\.app\/api\/agent\/patients\/pt-03\/prescriptions$/);
    const rx = r.set('backend: active prescriptions', http(200, { patientId: 'pt-03', prescriptions: active('pt-03') }));
    const items = await r.code('screen (deterministic)', rx);
    assert.equal(items.length, 1);
    assert.ok(items.every((i) => i.json.post === true));
    assert.deepEqual(items.map((i) => i.json.alert.severity), ['warning']);
    const posted = items.map((i, n) => ({ json: { statusCode: 201, body: { alert: Object.assign({ id: 'ia_' + n }, i.json.alert), delivered: [] } } }));
    r.set('backend: raise the alert', posted);
    const [sum] = await r.code('summary (deterministic)', posted);
    assert.equal(sum.json.ok, true);
    assert.deepEqual(sum.json.sent.map((s) => [s.statusCode, s.alertId]), [[201, 'ia_0']]);
  });

  await check('F2 - the demo case: seed pt-01 adds Ibuprofen (rx-002) -> Warfarin x Ibuprofen POSTed as DANGER and Ibuprofen x Metformin as a warning, both for a human first', async () => {
    const r = runner(wf);
    const [inp] = await r.code('input (deterministic)', webhookItem({ patientId: 'pt-01', newPrescriptionId: 'rx-002', language: 'ar' }));
    assert.equal(inp.json.valid, true);
    const rx = r.set('backend: active prescriptions', http(200, { patientId: 'pt-01', prescriptions: active('pt-01') }));
    const items = await r.code('screen (deterministic)', rx);
    assert.deepEqual(items.map((i) => i.json.alert.severity).sort(), ['danger', 'warning']);
    const danger = items.find((i) => i.json.alert.severity === 'danger').json.alert;
    assert.deepEqual([...danger.involvedPrescriptionIds].sort(), ['rx-001', 'rx-002']);
    assert.match(danger.sourceCitation, /DDInter 2\.0/);
    assert.match(danger.sourceCitation, /level "Major"/);
    assert.ok(items.every((i) => i.json.alert.reviewStatus === 'pending_medical_review'));
    console.log('        -> ' + danger.description);
  });

  await check('AP-06 - both drugs outside the loaded DDInter files (Ibuprofen x Ciprofloxacin): one info "cannot verify" alert POSTed for the reviewer, never "nothing recorded"', async () => {
    const r = runner(wf);
    await r.code('input (deterministic)', webhookItem({ patientId: 't-patient', newPrescriptionId: 't-2', language: 'en' }));
    const p = [
      { id: 't-1', status: 'active', needsReview: false, drug: { genericName: 'Ibuprofen' } },
      { id: 't-2', status: 'active', needsReview: false, drug: { genericName: 'Ciprofloxacin' } }
    ];
    const items = await r.code('screen (deterministic)', r.set('backend: active prescriptions', http(200, { prescriptions: p })));
    assert.equal(items.length, 1);
    assert.equal(items[0].json.post, true);
    const a = items[0].json.alert;
    assert.equal(a.severity, 'info');
    assert.equal(a.reviewStatus, 'pending_medical_review');
    assert.match(a.sourceCitation, /DDInter category files A, B, H/);
    assert.doesNotMatch(a.description, /no interaction is recorded/);
    console.log('        -> ' + a.description);
  });

  await check('AP-06 - one drug in a loaded category file (Metformin, A) x Calcium carbonate, no row: one auto_cleared "nothing recorded"', async () => {
    const r = runner(wf);
    await r.code('input (deterministic)', webhookItem({ patientId: 't-patient', newPrescriptionId: 't-2', language: 'en' }));
    const p = [
      { id: 't-1', status: 'active', needsReview: false, drug: { genericName: 'Metformin' } },
      { id: 't-2', status: 'active', needsReview: false, drug: { genericName: 'Calcium carbonate' } }
    ];
    const items = await r.code('screen (deterministic)', r.set('backend: active prescriptions', http(200, { prescriptions: p })));
    assert.equal(items.length, 1);
    assert.equal(items[0].json.alert.reviewStatus, 'auto_cleared');
  });

  await check('a refused danger alert (422) is escalated, never reported as done', async () => {
    const r = runner(wf);
    await r.code('input (deterministic)', webhookItem({ patientId: 't-patient', newPrescriptionId: 't-2' }));
    const p = [
      { id: 't-1', status: 'active', needsReview: false, drug: { genericName: 'Simvastatin' } },
      { id: 't-2', status: 'active', needsReview: false, drug: { genericName: 'Clarithromycin' } }
    ];
    const items = await r.code('screen (deterministic)', r.set('backend: active prescriptions', http(200, { prescriptions: p })));
    assert.equal(items[0].json.alert.severity, 'danger');
    const refused = items.map(() => ({ json: { statusCode: 422, body: { error: 'invalid_body' } } }));
    r.set('backend: raise the alert', refused);
    const [sum] = await r.code('summary (deterministic)', refused);
    assert.equal(sum.json.ok, false);
    assert.equal(sum.json.mustEscalate, true);
  });

  await check('no newPrescriptionId -> whole-profile dry run: nothing POSTed, alerts returned', async () => {
    const r = runner(wf);
    const [inp] = await r.code('input (deterministic)', webhookItem({ patientId: 'pt-03' }));
    assert.equal(inp.json.dryRun, true);
    const items = await r.code('screen (deterministic)', r.set('backend: active prescriptions', http(200, { prescriptions: active('pt-03') })));
    assert.equal(items.length, 1);
    assert.equal(items[0].json.post, false);
    const [sum] = await r.code('summary (deterministic)', items);
    assert.equal(sum.json.dryRun, true);
    assert.ok(sum.json.alerts.length > 0);
    assert.deepEqual(sum.json.sent, []);
  });

  await check('backend 404/401 -> nothing POSTed, an explicit error (never "no interaction")', async () => {
    for (const code of [404, 401, 503]) {
      const r = runner(wf);
      await r.code('input (deterministic)', webhookItem({ patientId: 'pt-99', newPrescriptionId: 'rx-1' }));
      const items = await r.code('screen (deterministic)', r.set('backend: active prescriptions', http(code, { error: 'x' })));
      assert.equal(items[0].json.post, false);
      const [sum] = await r.code('summary (deterministic)', items);
      assert.equal(sum.json.ok, false);
      assert.equal(sum.json.error, 'backend_prescriptions_http_' + code);
    }
  });

  await check('an id that is not an active prescription of this patient -> ok:false (the execution stops with an error)', async () => {
    const r = runner(wf);
    await r.code('input (deterministic)', webhookItem({ patientId: 'pt-03', newPrescriptionId: 'rx-001' }));
    const items = await r.code('screen (deterministic)', r.set('backend: active prescriptions', http(200, { prescriptions: active('pt-03') })));
    const [sum] = await r.code('summary (deterministic)', items);
    assert.equal(sum.json.ok, false);
    assert.equal(sum.json.error, 'not_an_active_prescription_of_this_patient');
  });

  await check('a flagged NEW prescription is expected, not an error: ok:true, screened:false', async () => {
    const r = runner(wf);
    await r.code('input (deterministic)', webhookItem({ patientId: 'pt-02', newPrescriptionId: 'rx-006' }));
    const items = await r.code('screen (deterministic)', r.set('backend: active prescriptions', http(200, { prescriptions: active('pt-02') })));
    const [sum] = await r.code('summary (deterministic)', items);
    assert.equal(sum.json.ok, true);
    assert.equal(sum.json.screened, false);
  });

  await check('a malformed body -> valid:false (the execution stops with an error), no backend call', async () => {
    for (const body of [{}, { patientId: 'pt 03' }, { patientId: 'pt-03', newPrescriptionId: '../x' }]) {
      const r = runner(wf);
      const [inp] = await r.code('input (deterministic)', webhookItem(body));
      assert.equal(inp.json.valid, false);
    }
  });
}

async function travelScenarios() {
  console.log('\n######## agent-travel-check');
  const wf = WF('agent-travel-check');

  async function run(body, rxResponse, visionResponse) {
    const r = runner(wf);
    const [inp] = await r.code('input (deterministic)', webhookItem(body));
    if (!inp.json.valid) return { input: inp.json };
    r.set('backend: active prescriptions', rxResponse);
    r.set('Gemini: read the name on the box', visionResponse);
    const [c] = await r.code('check (deterministic)', visionResponse);
    return { r, input: inp.json, check: c.json };
  }

  await check('the vision request carries the image inline and the schema-constrained prompt', async () => {
    const { input } = await run({ patientId: 'pt-03', imageBase64: TINY_PNG, mimeType: 'image/png' }, http(200, { prescriptions: [] }), geminiText(medicineRead({})));
    const parts = input.visionBody.contents[0].parts;
    assert.match(parts[0].text, /isMedicine/);
    assert.equal(parts[1].inlineData.mimeType, 'image/png');
    assert.equal(parts[1].inlineData.data, TINY_PNG);
    const gc = input.visionBody.generationConfig;
    assert.equal(gc.temperature, 0);
    assert.equal(gc.responseMimeType, 'application/json');
    assert.deepEqual(gc.responseSchema.required.sort(), ['brandAsPrinted', 'ingredientsAsPrinted', 'isMedicine', 'strengthAsPrinted']);
  });

  await check('not a medicine (decision (a)) -> not_a_medicine, decided before any lookup; no alert', async () => {
    const { check: c } = await run({ patientId: 'pt-03', imageBase64: TINY_PNG, mimeType: 'image/png' }, http(200, { prescriptions: active('pt-03') }), geminiText(medicineRead({ isMedicine: false })));
    assert.equal(c.post, false);
    assert.equal(c.result.verdict, 'not_a_medicine');
    assert.deepEqual(c.result.appOutcome, { kind: 'not_a_medicine' });
    assert.equal(c.result.candidate, null);
  });

  await check('malformed JSON from the model -> could_not_identify, named reason, fail closed', async () => {
    const { check: c } = await run({ patientId: 'pt-03', imageBase64: TINY_PNG, mimeType: 'image/png' }, http(200, { prescriptions: [] }), geminiText('not valid JSON at all'));
    assert.equal(c.post, false);
    assert.equal(c.result.verdict, 'could_not_identify');
    assert.equal(c.result.reason, 'model_response_unparseable');
  });

  await check('a medicine package with nothing legible on it -> could_not_identify; no alert', async () => {
    const { check: c } = await run({ patientId: 'pt-03', imageBase64: TINY_PNG, mimeType: 'image/png' }, http(200, { prescriptions: active('pt-03') }), geminiText(medicineRead({})));
    assert.equal(c.post, false);
    assert.equal(c.result.verdict, 'could_not_identify');
    assert.equal(c.result.reason, 'no_readable_text');
  });

  await check('danger: KLACID (brand plus strength) for a patient on Simvastatin -> alert POSTed, alertId in the app outcome', async () => {
    const p = [{ id: 't-1', status: 'active', needsReview: false, drug: { genericName: 'Simvastatin' }, source: { facilityName: 'F', sector: 'public' } }];
    const { r, check: c } = await run({ patientId: 't-patient', imageBase64: TINY_PNG, mimeType: 'image/jpeg', language: 'en' }, http(200, { prescriptions: p }),
      geminiText(medicineRead({ brandAsPrinted: 'KLACID', strengthAsPrinted: '500 mg' })));
    assert.equal(c.post, true);
    assert.equal(c.alert.reviewStatus, 'pending_medical_review');
    r.set('backend: raise the alert', http(201, { alert: Object.assign({ id: 'ia_77' }, c.alert), delivered: [] }));
    const [a] = await r.code('answer (deterministic)', http(201, {}));
    assert.equal(a.json.ok, true);
    assert.deepEqual(a.json.appOutcome, { kind: 'identified', drugName: 'Clarithromycin', verdict: 'interaction_found', alertId: 'ia_77' });
  });

  await check('danger alert refused by the backend -> mustEscalate, no alertId', async () => {
    const p = [{ id: 't-1', status: 'active', needsReview: false, drug: { genericName: 'Simvastatin' } }];
    const { r } = await run({ patientId: 't-patient', imageBase64: TINY_PNG, mimeType: 'image/jpeg' }, http(200, { prescriptions: p }), geminiText(medicineRead({ brandAsPrinted: 'KLACID' })));
    r.set('backend: raise the alert', http(422, { error: 'invalid_body' }));
    const [a] = await r.code('answer (deterministic)', http(422, {}));
    assert.equal(a.json.ok, false);
    assert.equal(a.json.mustEscalate, true);
    assert.ok(!('alertId' in a.json.appOutcome));
  });

  // F2: Warfarin, Ibuprofen and Metformin are in the index now, so the seed profile is checkable.
  await check('seed pt-01 photographs ZOCOR -> interaction_found (Simvastatin x Warfarin is in DDInter), app names Simvastatin', async () => {
    const { r, check: c } = await run({ patientId: 'pt-01', imageBase64: TINY_PNG, mimeType: 'image/png' }, http(200, { prescriptions: active('pt-01') }), geminiText(medicineRead({ brandAsPrinted: 'ZOCOR' })));
    assert.equal(c.result.verdict, 'interaction_found');
    const [a] = await r.code('answer (deterministic)', [{ json: c }]);
    assert.deepEqual(a.json.appOutcome, { kind: 'identified', drugName: 'Simvastatin', verdict: 'interaction_found' });
  });

  await check('bilingual box: brandAsPrinted holds the Latin name only, and still resolves ("Brufen" + Arabic print)', async () => {
    const { check: c } = await run({ patientId: 't-patient', imageBase64: TINY_PNG, mimeType: 'image/png', language: 'en' }, http(200, { prescriptions: [] }),
      geminiText(medicineRead({ brandAsPrinted: 'Brufen' })));
    assert.equal(c.result.verdict, 'no_interaction_found');
    assert.equal(c.result.candidate.ingredients[0], 'Ibuprofen');
  });

  await check('no brand printed: every ingredientsAsPrinted entry must resolve - a combination of two verified ingredients resolves', async () => {
    const { check: c } = await run({ patientId: 't-patient', imageBase64: TINY_PNG, mimeType: 'image/png', language: 'en' }, http(200, { prescriptions: [] }),
      geminiText(medicineRead({ ingredientsAsPrinted: ['Acetaminophen', 'Caffeine'] })));
    assert.equal(c.result.verdict, 'no_interaction_found');
    assert.deepEqual(c.result.candidate.ingredients.sort(), ['Acetaminophen', 'Caffeine']);
    assert.equal(c.result.candidate.isCombination, true);
  });

  await check('no brand printed: one ingredientsAsPrinted entry that does not resolve refuses the WHOLE reading, never a partial screen', async () => {
    const { check: c } = await run({ patientId: 't-patient', imageBase64: TINY_PNG, mimeType: 'image/png', language: 'en' }, http(200, { prescriptions: [] }),
      geminiText(medicineRead({ ingredientsAsPrinted: ['Acetaminophen', 'Notarealingredientxyz'] })));
    assert.equal(c.result.verdict, 'could_not_identify');
    assert.equal(c.result.reason, 'combination_ingredient_unresolved');
  });

  await check('AP-06 - an Ezetimibe box (no brand printed) for a patient on Amlodipine (both outside the loaded DDInter files) -> cannot_verify, app cannot_verify', async () => {
    const p = [{ id: 't-1', status: 'active', needsReview: false, drug: { genericName: 'Amlodipine' } }];
    const { check: c } = await run({ patientId: 't-patient', imageBase64: TINY_PNG, mimeType: 'image/png', language: 'en' }, http(200, { prescriptions: p }),
      geminiText(medicineRead({ ingredientsAsPrinted: ['Ezetimibe'] })));
    assert.equal(c.post, false);
    assert.equal(c.result.verdict, 'cannot_verify');
    assert.equal(c.result.reason, 'pair_outside_loaded_categories');
    assert.deepEqual(c.result.appOutcome, { kind: 'cannot_verify' });
  });

  await check('profile unreadable (backend 503) -> cannot_verify, profile_unavailable, never "no interaction"', async () => {
    const { check: c } = await run({ patientId: 'pt-03', imageBase64: TINY_PNG, mimeType: 'image/png' }, http(503, { error: 'unavailable' }), geminiText(medicineRead({ ingredientsAsPrinted: ['Ezetimibe'] })));
    assert.equal(c.post, false);
    assert.equal(c.result.verdict, 'cannot_verify');
    assert.equal(c.result.reason, 'profile_unavailable');
    assert.deepEqual(c.result.appOutcome, { kind: 'cannot_verify' });
    assert.match(c.error, /503/);
  });

  await check('nothing legible, with the backend also down (503) -> could_not_identify (G5 answers first; the profile is never even asked about)', async () => {
    const { check: c } = await run({ patientId: 'pt-03', imageBase64: TINY_PNG, mimeType: 'image/png' }, http(503, { error: 'unavailable' }), geminiText(medicineRead({})));
    assert.equal(c.result.verdict, 'could_not_identify');
  });

  await check('MAREVAN (unverified SFDA brand, AP-07 pending) -> cannot_verify, brand_not_verified - never resolved to Warfarin', async () => {
    const { check: c } = await run({ patientId: 'pt-03', imageBase64: TINY_PNG, mimeType: 'image/png' }, http(200, { prescriptions: active('pt-03') }), geminiText(medicineRead({ brandAsPrinted: 'MAREVAN' })));
    assert.equal(c.post, false);
    assert.equal(c.result.verdict, 'cannot_verify');
    assert.equal(c.result.reason, 'brand_not_verified');
    assert.deepEqual(c.result.appOutcome, { kind: 'cannot_verify' });
    assert.equal(c.result.candidate, null);
  });

  await check('decision (d): a pending brand PLUS a printed ingredient still refuses - ingredientsAsPrinted is never a fallback for an unverified brand', async () => {
    const { check: c } = await run({ patientId: 'pt-03', imageBase64: TINY_PNG, mimeType: 'image/png' }, http(200, { prescriptions: active('pt-03') }),
      geminiText(medicineRead({ brandAsPrinted: 'MAREVAN', ingredientsAsPrinted: ['Warfarin'] })));
    assert.equal(c.post, false);
    assert.equal(c.result.verdict, 'cannot_verify');
    assert.equal(c.result.reason, 'brand_not_verified');
    assert.equal(c.result.candidate, null, 'never resolved to Warfarin through the ingredient field');
  });

  await check('a truncated/blocked Gemini answer (finishReason != STOP) is never read as a name', async () => {
    for (const fr of ['MAX_TOKENS', 'SAFETY', 'RECITATION']) {
      const { check: c } = await run({ patientId: 'pt-03', imageBase64: TINY_PNG, mimeType: 'image/png' }, http(200, { prescriptions: [] }), geminiText(medicineRead({ brandAsPrinted: 'PANADOL COLD' }), fr));
      assert.equal(c.result.verdict, 'could_not_identify');
      assert.equal(c.error, 'vision_not_finished_' + fr);
    }
  });

  await check('Gemini down -> could_not_identify with the vision error named', async () => {
    const { check: c } = await run({ patientId: 'pt-03', imageBase64: TINY_PNG, mimeType: 'image/png' }, http(200, { prescriptions: [] }), http(429, { error: 'quota' }));
    assert.equal(c.result.verdict, 'could_not_identify');
    assert.equal(c.error, 'vision_http_429');
  });

  await check('bad input (no image, a PDF, not base64, a bad id) -> valid:false', async () => {
    for (const body of [{ patientId: 'pt-03' }, { patientId: 'pt-03', imageBase64: TINY_PNG, mimeType: 'application/pdf' },
                        { patientId: 'pt-03', imageBase64: 'not base64!', mimeType: 'image/png' }, { patientId: '', imageBase64: TINY_PNG, mimeType: 'image/png' }]) {
      const { input } = await run(body);
      assert.equal(input.valid, false, JSON.stringify(body));
    }
  });
}

async function extractionScenarios() {
  console.log('\n######## agent-extraction');
  const wf = WF('agent-extraction');
  const CLEAR = { isPrescription: true, facilityName: 'Farwaniya Hospital', sector: 'public', genericName: 'Amoxicillin', brandName: 'Amoxil',
    strength: 500, strengthUnit: 'mg', dosePerAdministration: 1, frequencyPerDay: 3, doseTimes: ['08:00', '14:00', '20:00'],
    dosingPattern: 'daily', durationDays: 7, startDate: '2026-09-24',
    confidence: { facilityName: 0.95, sector: 0.95, genericName: 0.95, brandName: 0.95, strength: 0.95, strengthUnit: 0.95,
                  dosePerAdministration: 0.95, frequencyPerDay: 0.95, doseTimes: 0.95, dosingPattern: 0.95, durationDays: 0.95, startDate: 0.95 } };

  async function run(body, vision) {
    const r = runner(wf);
    const [inp] = await r.code('input (deterministic)', webhookItem(body));
    if (!inp.json.valid) return { input: inp.json };
    r.set('Gemini: read the prescription', vision);
    const [v] = await r.code('validate (deterministic)', vision);
    return { r, input: inp.json, v: v.json };
  }

  await check('the vision request is schema-constrained JSON at temperature 0', async () => {
    const { input } = await run({ patientId: 'pt-01', imageBase64: TINY_PNG, mimeType: 'image/png' }, geminiText('{}'));
    const gc = input.visionBody.generationConfig;
    assert.equal(gc.temperature, 0);
    assert.equal(gc.responseMimeType, 'application/json');
    assert.ok(gc.responseSchema.properties.strengthUnit);
  });

  await check('save:false -> read and validate only; appOutcome confident; nothing saved or screened', async () => {
    const { r, v } = await run({ patientId: 'pt-01', imageBase64: TINY_PNG, mimeType: 'image/png' }, geminiText(JSON.stringify(CLEAR)));
    assert.equal(v.save, false);
    const [a] = await r.code('answer (deterministic)', [{ json: v }]);
    assert.equal(a.json.ok, true);
    assert.equal(a.json.appOutcome.kind, 'confident');
    assert.equal(a.json.saved, null);
    assert.equal(a.json.screening, null);
  });

  // AP-04: this workflow no longer calls jurah/screen-prescription itself - it reads the outcome the
  // backend's own screening already put in the SAME 201 body (AP-10 / CR-090's `screening` field).
  await check('save:true, unflagged, backend screening \'screened\' -> ok, no escalation', async () => {
    const { r, v } = await run({ patientId: 'pt-01', imageBase64: TINY_PNG, mimeType: 'image/png', save: true }, geminiText(JSON.stringify(CLEAR)));
    assert.equal(v.save, true);
    const saved = r.set('backend: save the prescription', http(201, { prescription: { id: 'rx_new1' }, doseCount: 21, screening: 'screened' }));
    const [after] = await r.code('after save', saved);
    assert.equal(after.json.screening, 'screened');
    assert.equal(after.json.notScreened, false);
    const [a] = await r.code('answer (deterministic)', [{ json: after.json }]);
    assert.equal(a.json.ok, true);
    assert.equal(a.json.mustEscalate, false);
    assert.equal(a.json.saved.prescriptionId, 'rx_new1');
    assert.deepEqual(a.json.screening, { outcome: 'screened' });
  });

  await check('save:true, unflagged, backend screening \'held\' -> ok, no escalation (n8n did not accept it, but a specialist already holds it)', async () => {
    const { r } = await run({ patientId: 'pt-01', imageBase64: TINY_PNG, mimeType: 'image/png', save: true }, geminiText(JSON.stringify(CLEAR)));
    const saved = r.set('backend: save the prescription', http(201, { prescription: { id: 'rx_new2' }, doseCount: 21, screening: 'held' }));
    const [after] = await r.code('after save', saved);
    assert.equal(after.json.notScreened, false);
    const [a] = await r.code('answer (deterministic)', [{ json: after.json }]);
    assert.equal(a.json.ok, true);
    assert.equal(a.json.mustEscalate, false);
    assert.deepEqual(a.json.screening, { outcome: 'held' });
  });

  for (const s of [{ label: '\'skipped\'', body: { prescription: { id: 'rx_new3a' }, doseCount: 21, screening: 'skipped' } },
                   { label: 'no screening field at all', body: { prescription: { id: 'rx_new3b' }, doseCount: 21 } }]) {
    await check(`save:true, unflagged, backend screening ${s.label} -> mustEscalate, ok:false (TC-IX invariant broke on the backend's own side)`, async () => {
      const { r } = await run({ patientId: 'pt-01', imageBase64: TINY_PNG, mimeType: 'image/png', save: true }, geminiText(JSON.stringify(CLEAR)));
      const [after] = await r.code('after save', r.set('backend: save the prescription', http(201, s.body)));
      assert.equal(after.json.notScreened, true);
      const [a] = await r.code('answer (deterministic)', [{ json: after.json }]);
      assert.equal(a.json.ok, false);
      assert.equal(a.json.mustEscalate, true);
      assert.equal(a.json.saved.prescriptionId, s.body.prescription.id);
    });
  }

  await check('a truncated Gemini answer is never parsed, so nothing is saved', async () => {
    const { v } = await run({ patientId: 'pt-01', imageBase64: TINY_PNG, mimeType: 'image/png', save: true }, geminiText(JSON.stringify(CLEAR), 'MAX_TOKENS'));
    assert.equal(v.save, false);
    assert.equal(v.result.code, 'not_a_prescription');
  });

  await check('save:true, flagged -> saved with needsReview; backend screening \'skipped\' as expected (TC-IX-06), no escalation', async () => {
    const flagged = Object.assign({}, CLEAR, { doseTimes: null });
    const { r, v } = await run({ patientId: 'pt-01', imageBase64: TINY_PNG, mimeType: 'image/png', save: true }, geminiText(JSON.stringify(flagged)));
    assert.equal(v.result.needsReview, true);
    const [after] = await r.code('after save', r.set('backend: save the prescription', http(201, { prescription: { id: 'rx_new4' }, doseCount: 0, screening: 'skipped' })));
    assert.equal(after.json.notScreened, false, 'a flagged prescription is not screened until a reviewer confirms it - that is not an error here');
    const [a] = await r.code('answer (deterministic)', [{ json: after.json }]);
    assert.equal(a.json.mustEscalate, false);
    assert.equal(a.json.appOutcome.kind, 'needs_review');
    assert.deepEqual(a.json.uncertainFields, ['doseTimes']);
  });

  await check('backend refuses the save (422) -> ok:false, no escalation (nothing was created to screen)', async () => {
    const { r } = await run({ patientId: 'pt-01', imageBase64: TINY_PNG, mimeType: 'image/png', save: true }, geminiText(JSON.stringify(CLEAR)));
    const [after] = await r.code('after save', r.set('backend: save the prescription', http(422, { error: 'constraint_violation', constraint: 'x' })));
    assert.equal(after.json.notScreened, false);
    const [a] = await r.code('answer (deterministic)', [{ json: after.json }]);
    assert.equal(a.json.ok, false);
    assert.equal(a.json.mustEscalate, false);
  });

  await check('not a prescription / unparseable / Gemini down -> unreadable, save never attempted', async () => {
    for (const vision of [geminiText(JSON.stringify({ isPrescription: false })), geminiText('not json'), http(500, {})]) {
      const { r, v } = await run({ patientId: 'pt-01', imageBase64: TINY_PNG, mimeType: 'image/png', save: true }, vision);
      assert.equal(v.save, false);
      const [a] = await r.code('answer (deterministic)', [{ json: v }]);
      assert.deepEqual(a.json.appOutcome, { kind: 'unreadable' });
      assert.equal(a.json.ok, false);
    }
  });
}

(async () => {
  await staticChecks();
  await screeningScenarios();
  await travelScenarios();
  await extractionScenarios();
  console.log('\n' + (failures ? failures + ' FAILED' : 'all checks passed'));
  process.exit(failures ? 1 : 0);
})();
