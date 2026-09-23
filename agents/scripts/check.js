'use strict';

/**
 * Prove the GENERATED workflows, not just the source they came from:
 *   1. every file is ASCII-only, parses, and still carries its Arabic after un-escaping;
 *   2. every connection names a node that exists; node names are unique;
 *   3. every Code node compiles as n8n compiles it (an async function body);
 *   4. no /webhook-test/ URL, no secret-shaped string, no credential blob in any file;
 *   5. the Code nodes EXECUTE, in workflow order, on the spec's scenarios - with n8n's $ / $input
 *      API stubbed and each HTTP node replaced by the response the backend would give.
 * Exit code 1 on the first failure.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');
const WF = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', name + '.json'), 'ascii'));
const NAMES = ['agent-telegram-inbound', 'agent-checkin-daily', 'agent-interaction-screening'];
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

let failures = 0;
const check = (label, fn) => {
  return Promise.resolve().then(fn).then(
    () => console.log('  OK    ' + label),
    (e) => { failures += 1; console.log('  FAIL  ' + label + '\n        ' + String(e && e.message || e).split('\n').join('\n        ')); },
  );
};

// --------------------------------------------------------------- static checks
async function staticChecks() {
  console.log('\n######## static');
  for (const name of NAMES) {
    const raw = fs.readFileSync(path.join(ROOT, 'workflows', name + '.json'));
    const wf = JSON.parse(raw.toString('ascii'));
    await check(name + ': ASCII-only, parses, Arabic intact', () => {
      assert.ok([...raw].every((b) => b <= 0x7f), 'a byte above 0x7F');
      if (name !== 'agent-interaction-screening' || true) assert.match(JSON.stringify(wf), /[؀-ۿ]/, 'no Arabic survived un-escaping');
    });
    await check(name + ': unique node names, every connection resolves', () => {
      const names = wf.nodes.map((n) => n.name);
      assert.equal(new Set(names).size, names.length, 'duplicate node name');
      for (const [from, outs] of Object.entries(wf.connections)) {
        assert.ok(names.includes(from), 'connection from unknown node ' + from);
        for (const kind of Object.values(outs)) for (const branch of kind) for (const c of branch) assert.ok(names.includes(c.node), from + ' -> unknown ' + c.node);
      }
    });
    await check(name + ': every Code node compiles', () => {
      for (const n of wf.nodes.filter((x) => x.type === 'n8n-nodes-base.code')) {
        try { new AsyncFunction('$input', '$', n.parameters.jsCode); } catch (e) { throw new Error(n.name + ': ' + e.message); }
      }
    });
    await check(name + ': no /webhook-test/, no secret, no credential blob', () => {
      const text = raw.toString('ascii');
      assert.ok(!text.includes('/webhook-test/'), '/webhook-test/ URL');
      assert.ok(!/Bearer\s+[A-Za-z0-9._-]{12,}/.test(text), 'an inline bearer token');
      assert.ok(!/"credentials"\s*:/.test(text), 'credentials are bound by hand, never shipped');
      assert.ok(!/api\.telegram\.org\/bot\d/.test(text), 'a bot token in a URL');
      assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(text), 'a Google API key');
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
    out,
    set(name, items) { out[name] = items; return items; },
    async code(name, input, binary) {
      const n = byName[name];
      assert.ok(n && n.type === 'n8n-nodes-base.code', 'no Code node ' + name);
      const $input = { first: () => input[0], all: () => input };
      const ctx = { helpers: { getBinaryDataBuffer: async () => binary } };
      const result = await new AsyncFunction('$input', '$', n.parameters.jsCode).call(ctx, $input, ref);
      out[name] = result;
      return result;
    },
  };
}
const http = (statusCode, body) => [{ json: { statusCode, body } }];

// --------------------------------------------------------------- scenarios
const ON_TIME = ['taken_on_time'][0];
const OPEN = ['upcoming'][0];
const dose = (id, prescriptionId, hhmm, word, brandName) => ({
  id, prescriptionId, scheduledAt: '2026-09-24T' + hhmm + ':00+03:00', status: word, recordedAt: null,
  genericName: prescriptionId === 'rx-008' ? 'Levothyroxine' : 'Calcium carbonate + vitamin D3', brandName: brandName || null,
  strengthMg: prescriptionId === 'rx-008' ? 50 : 500, strengthUnit: prescriptionId === 'rx-008' ? 'mcg' : null,
  dosePerAdministration: 1, timingRelativeToFood: null,
});
const DAY = { patientId: 'pt-03', date: '2026-09-24', doses: [
  dose('rx-008-20260924-0700', 'rx-008', '07:00', OPEN, 'Eltroxin'),
  dose('rx-009-20260924-1300', 'rx-009', '13:00', OPEN),
  dose('rx-009-20260924-2100', 'rx-009', '21:00', OPEN),
] };
const relay = (over) => [{ json: { body: {
  kind: 'message', chatId: '5550001', messageId: 1, sentAt: '2026-09-24T07:20:00+03:00', text: 'خذيته',
  photoFileId: null, documentFileId: null, callbackQueryId: null,
  channel: 'telegram', subjectType: 'patient', subjectId: 'pt-03', patientId: 'pt-03', language: 'ar', ...over } } }];

/** Walk the adherence path of agent-telegram-inbound exactly as its connections do. */
async function inbound({ payload, dosesResponse = http(200, DAY), model, write1 = 200, write2 = 200 }) {
  const wf = WF('agent-telegram-inbound');
  const r = runner(wf);
  const routed = await r.code('route (deterministic)', payload);
  if (routed.length === 0) return { dropped: true };
  assert.equal(routed[0].json.route, 'adherence');
  r.set('backend: doses of the day', dosesResponse);
  const decideInput = routed[0].json.needsModel ? [{ json: { output: model } }] : dosesResponse;
  const [d] = await r.code('decide (deterministic)', decideInput);
  const calls = [];
  if (d.json.hasWrite) {
    calls.push({ url: d.json.write0.url, body: d.json.write0.body });
    r.set('backend: write 1', http(write1, {}));
    const [after] = await r.code('after write 1', r.out['backend: write 1']);
    if (after.json.runSecond) {
      calls.push({ url: d.json.write1.url, body: d.json.write1.body });
      r.set('backend: write 2 (recompute)', http(write2, {}));
    }
  }
  const replies = await r.code('reply (deterministic)', [{ json: {} }]);
  return { routed: routed[0].json, decision: d.json.decision, calls, replies: replies.map((x) => x.json) };
}

async function scenarios() {
  console.log('\n######## agent-telegram-inbound (adherence)');
  await check('«خذيته» at 07:20 -> one POST doses/rx-008-20260924-0700/status taken_on_time; the patient reads "recorded"', async () => {
    const s = await inbound({ payload: relay({}), model: { intent: 'taken_on_time', confidence: 0.96, quote: 'خذيته' } });
    assert.equal(s.calls.length, 1);
    assert.match(s.calls[0].url, /\/api\/agent\/doses\/rx-008-20260924-0700\/status$/);
    assert.equal(s.calls[0].body.status, ON_TIME);
    assert.equal(s.calls[0].body.source, 'adherence_agent');
    assert.match(s.replies[0].text, /في وقتها/);
    console.log('        -> ' + s.replies[0].text);
  });
  await check('«نسيت» at 08:30 -> status missed, THEN recompute reported_miss; both answered 200', async () => {
    const s = await inbound({ payload: relay({ text: 'نسيت', sentAt: '2026-09-24T08:30:00+03:00' }), model: { intent: 'missed', confidence: 0.93, quote: 'نسيت' } });
    assert.deepEqual(s.calls.map((c) => c.url.replace(/^.*\/api\/agent/, '')), ['/doses/rx-008-20260924-0700/status', '/schedule/recompute']);
    assert.deepEqual(s.calls[1].body, { prescriptionId: 'rx-008', reason: 'reported_miss', missedDoseId: 'rx-008-20260924-0700' });
    console.log('        -> ' + s.replies[0].text);
  });
  await check('the status write refused (409) -> the recompute never runs and the reply never says "recorded"', async () => {
    const s = await inbound({ payload: relay({ text: 'نسيت', sentAt: '2026-09-24T08:30:00+03:00' }), model: { intent: 'missed', confidence: 0.93, quote: 'نسيت' }, write1: 409 });
    assert.equal(s.calls.length, 1);
    assert.doesNotMatch(s.replies[0].text, /سجّلنا/);
    console.log('        -> ' + s.replies[0].text);
  });
  await check('G11: the model says missed @ 0.45 -> nothing written, one clarifying question', async () => {
    const s = await inbound({ payload: relay({ text: 'ايه' }), model: { intent: 'missed', confidence: 0.45, quote: 'ايه' } });
    assert.equal(s.calls.length, 0);
    assert.match(s.replies[0].text, /ما فهمت/);
  });
  await check('the model node failed (quota) -> no classification -> unclear, nothing written', async () => {
    const s = await inbound({ payload: relay({ text: 'خذيته' }), model: { error: '429' } });
    assert.equal(s.calls.length, 0);
  });
  await check('TC-AD-14: «أبوي خذ الدوا» from an ACTIVE caregiver -> no model, no write, "only the patient"', async () => {
    const s = await inbound({ payload: relay({ subjectType: 'caregiver', subjectId: 'cg-01', patientId: 'pt-01', text: 'أبوي خذ الدوا' }) });
    assert.equal(s.routed.needsModel, false);
    assert.equal(s.calls.length, 0);
    assert.match(s.replies[0].text, /المريض بنفسه/);
    console.log('        -> ' + s.replies[0].text);
  });
  await check('TC-AD-07: a tap d:rx-009-20260924-1300:taken_late -> that dose, no model call', async () => {
    const s = await inbound({ payload: relay({ kind: 'callback', text: 'd:rx-009-20260924-1300:taken_late', callbackQueryId: 'cbq-1', sentAt: '2026-09-24T08:00:00+03:00' }) });
    assert.equal(s.routed.needsModel, false);
    assert.match(s.calls[0].url, /rx-009-20260924-1300\/status$/);
    assert.equal(s.calls[0].body.status, ['taken_late'][0]);
    assert.equal(s.replies[0].callbackQueryId, 'cbq-1');
  });
  await check('a tap naming another patient’s dose -> refused, nothing written', async () => {
    const s = await inbound({ payload: relay({ kind: 'callback', text: 'd:rx-001-20260924-0800:taken_on_time', callbackQueryId: 'cbq-2' }) });
    assert.equal(s.calls.length, 0);
  });
  await check('TC-AD-12: «خذيته» at 22:00 with three open doses -> no write; a question + one button message per dose', async () => {
    const s = await inbound({ payload: relay({ sentAt: '2026-09-24T22:00:00+03:00' }), model: { intent: 'taken_on_time', confidence: 0.97, quote: 'خذيته' } });
    assert.equal(s.calls.length, 0);
    assert.equal(s.replies.length, 4);
    assert.deepEqual(s.replies.slice(1).map((m) => m.buttons.length), [3, 3, 3]);
    assert.equal(s.replies[1].buttons[0].data, 'd:rx-008-20260924-0700:taken_on_time');
  });
  await check('the backend is down (doses 503) -> nothing written, an honest failure reply', async () => {
    const s = await inbound({ payload: relay({}), dosesResponse: http(503, { error: 'unavailable' }), model: { intent: 'taken_on_time', confidence: 0.96, quote: 'خذيته' } });
    assert.equal(s.calls.length, 0);
    assert.match(s.replies[0].text, /صار خلل/);
  });
  await check('a malformed relay body is dropped before anything runs', async () => {
    for (const body of [{}, { channel: 'telegram', subjectType: 'admin', patientId: 'pt-01', chatId: '1', sentAt: '2026-09-24T08:00:00+03:00' }]) {
      const s = await inbound({ payload: [{ json: { body } }] });
      assert.equal(s.dropped, true);
    }
  });

  console.log('\n######## agent-telegram-inbound (extraction)');
  await check('a prescription photo -> routed to extraction; the vision reply becomes a body; 201 -> screening requested', async () => {
    const wf = WF('agent-telegram-inbound');
    const r = runner(wf);
    const [routed] = await r.code('route (deterministic)', relay({ text: 'وصفتي', photoFileId: 'AgAC-large' }));
    assert.equal(routed.json.route, 'extraction');
    const [req] = await r.code('extraction: build the vision request', [{ json: {}, binary: { data: { mimeType: 'image/jpeg' } } }], Buffer.from('fake-jpeg-bytes'));
    assert.equal(req.json.visionBody.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
    assert.equal(req.json.visionBody.generationConfig.responseMimeType, 'application/json');
    const reading = { isPrescription: true, facilityName: 'مستشفى العدان', sector: 'public', genericName: 'Amoxicillin', brandName: 'Amoxil',
      strength: 500, strengthUnit: 'mg', dosePerAdministration: 1, frequencyPerDay: 3, doseTimes: ['08:00', '14:00', '20:00'],
      dosingPattern: 'daily', durationDays: 7, startDate: '2026-09-24',
      confidence: { brandName: 0.95, strengthMg: 0.95, frequencyPerDay: 0.95, startDate: 0.9, doseTimes: 0.9 } };
    const [v] = await r.code('extraction: validate (deterministic)', http(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(reading) }] } }] }));
    assert.equal(v.json.result.ok, true);
    assert.equal(v.json.body.patientId, 'pt-03');
    r.set('backend: save the prescription', http(201, { prescription: { id: 'rx_new1' }, doseCount: 21 }));
    const [reply] = await r.code('extraction: reply (deterministic)', [{ json: {} }]);
    assert.equal(reply.json.screen, true);
    assert.deepEqual(reply.json.screeningBody, { patientId: 'pt-03', newPrescriptionId: 'rx_new1', language: 'ar' });
    assert.match(reply.json.screeningUrl, /\/webhook\/jurah\/screen-prescription$/);
    console.log('        -> ' + reply.json.text);
  });
  await check('TC-EX-04: a medicine box photo -> isPrescription false -> nothing saved, never screened', async () => {
    const r = runner(WF('agent-telegram-inbound'));
    await r.code('route (deterministic)', relay({ photoFileId: 'AgAC-box' }));
    await r.code('extraction: build the vision request', [{ json: {}, binary: { data: { mimeType: 'image/png' } } }], Buffer.from('x'));
    const [v] = await r.code('extraction: validate (deterministic)', http(200, { candidates: [{ content: { parts: [{ text: '{"isPrescription":false}' }] } }] }));
    assert.equal(v.json.body, null);
    const [reply] = await r.code('extraction: reply (deterministic)', [{ json: {} }]);
    assert.equal(reply.json.screen, false);
    assert.match(reply.json.text, /ما تبين إنها وصفة/);
  });
  await check('a flagged extraction is saved for the reviewer and NOT screened yet (TC-IX-06)', async () => {
    const r = runner(WF('agent-telegram-inbound'));
    await r.code('route (deterministic)', relay({ photoFileId: 'AgAC-blurry' }));
    await r.code('extraction: build the vision request', [{ json: {}, binary: { data: { mimeType: 'image/jpeg' } } }], Buffer.from('x'));
    const reading = { isPrescription: true, facilityName: 'عيادة الياسمين', sector: 'private', genericName: 'Ciprofloxacin', dosePerAdministration: 1,
      frequencyPerDay: 2, dosingPattern: 'daily', durationDays: 5, confidence: {} };
    const [v] = await r.code('extraction: validate (deterministic)', http(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(reading) }] } }] }));
    assert.equal(v.json.body.needsReview, true);
    r.set('backend: save the prescription', http(201, { prescription: { id: 'rx_new2' }, doseCount: 0 }));
    const [reply] = await r.code('extraction: reply (deterministic)', [{ json: {} }]);
    assert.equal(reply.json.screen, false);
    assert.match(reply.json.text, /بيراجعها مختص طبي/);
  });

  console.log('\n######## agent-checkin-daily');
  await check('eligibility -> only the backend’s patients; one header + one button message per OPEN dose', async () => {
    const r = runner(WF('agent-checkin-daily'));
    const plans = await r.code('plan (deterministic)', http(200, [{ patientId: 'pt-03', chatId: '5550001', language: 'ar', frequency: 'daily' }]));
    assert.equal(plans.length, 1);
    assert.match(plans[0].json.dosesUrl, /\/patients\/pt-03\/doses\?date=\d{4}-\d{2}-\d{2}$/);
    const msgs = await r.code('check-in (deterministic)', http(200, DAY));
    assert.equal(msgs.length, 4);
    assert.equal(msgs[0].json.buttons, null);
    assert.deepEqual(msgs.slice(1).map((m) => m.json.buttons.map((b) => b.data)[2]),
      ['d:rx-008-20260924-0700:missed', 'd:rx-009-20260924-1300:missed', 'd:rx-009-20260924-2100:missed']);
    console.log('        -> ' + msgs[0].json.text.split('\n').join(' | '));
  });
  await check('TC-AD-08/09: nobody eligible, or the backend refuses -> nothing sent', async () => {
    const r = runner(WF('agent-checkin-daily'));
    assert.equal((await r.code('plan (deterministic)', http(200, []))).length, 0);
    assert.equal((await r.code('plan (deterministic)', http(401, { error: 'unauthorized' }))).length, 0);
  });

  console.log('\n######## agent-interaction-screening');
  await check('TC-IX-01 on the seed: a new rx-002 Ibuprofen against rx-001 Warfarin -> one danger alert body, pending review', async () => {
    const r = runner(WF('agent-interaction-screening'));
    const [input] = await r.code('input (deterministic)', [{ json: { body: { patientId: 'pt-01', newPrescriptionId: 'rx-002', language: 'ar' } } }]);
    assert.match(input.json.rxUrl, /\/patients\/pt-01\/prescriptions$/);
    const rx = (id, genericName, needsReview = false) => ({ id, patientId: 'pt-01', drug: { genericName }, needsReview, status: 'active' });
    const alerts = await r.code('screen (deterministic)', http(200, { patientId: 'pt-01', prescriptions: [rx('rx-001', 'Warfarin'), rx('rx-002', 'Ibuprofen'), rx('rx-003', 'Metformin')] }));
    const danger = alerts.filter((a) => a.json.alert.severity === 'danger');
    assert.equal(danger.length, 1);
    assert.equal(danger[0].json.alert.reviewStatus, 'pending_medical_review');
    assert.equal(danger[0].json.alert.sourceCitation, '[TO BE SUPPLIED]');
    console.log('        -> ' + danger[0].json.alert.description);
  });
  await check('an id that is not an id is dropped before any read', async () => {
    const r = runner(WF('agent-interaction-screening'));
    assert.equal((await r.code('input (deterministic)', [{ json: { body: { patientId: "pt-01' or 1=1", newPrescriptionId: 'rx-1' } } }])).length, 0);
  });
}

(async () => {
  await staticChecks();
  await scenarios();
  console.log('\n' + (failures === 0 ? 'all checks passed' : failures + ' check(s) FAILED'));
  process.exit(failures === 0 ? 0 : 1);
})();
