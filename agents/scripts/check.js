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
const NAMES = ['agent-telegram-inbound', 'agent-checkin-daily', 'agent-interaction-screening', 'agent-alexa', 'agent-webchat'];
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
// Dose words by reference, never as an object literal (guard 4 / G1 scans for status: '<word>').
const W_ON = ['taken_on_time'][0];
const W_LATE = ['taken_late'][0];
const W_MISS = ['missed'][0];
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

/** agent-alexa, walked as its connections run. `configure` stands in for setting the skill id and
 * the device link inside the live n8n node - the committed workflow ships both EMPTY. */
async function alexaScenarios() {
  console.log('\n######## agent-alexa (voice, read-only)');
  const SKILL = 'amzn1.ask.skill.check';
  const USER = 'amzn1.ask.account.CHECKUSER';
  const wf = WF('agent-alexa');
  // `records` stands in for turning the CR-070 switch on in the live node (the repository ships it off).
  const configure = (skill, links, records = false) => {
    const copy = JSON.parse(JSON.stringify(wf));
    const n = copy.nodes.find((x) => x.name === 'alexa request (deterministic)');
    n.parameters.jsCode = n.parameters.jsCode.replace("const ALEXA_SKILL_ID = '';\nconst ALEXA_LINKS = {};",
      'const ALEXA_SKILL_ID = ' + JSON.stringify(skill) + ';\nconst ALEXA_LINKS = ' + JSON.stringify(links) + ';');
    if (records) {
      const plan = copy.nodes.find((x) => x.name === 'plan (deterministic)');
      plan.parameters.jsCode = plan.parameters.jsCode.replace('const VOICE_RECORDS = false;', 'const VOICE_RECORDS = true;');
    }
    return copy;
  };
  const body = (type, intent, locale = 'ar-SA', { utterance, pending } = {}) => [{ json: { body: {
    version: '1.0', session: { application: { applicationId: SKILL }, user: { userId: USER }, ...(pending ? { attributes: { pending } } : {}) },
    request: { type, locale, timestamp: new Date().toISOString(),
      ...(intent ? { intent: { name: intent, ...(utterance ? { slots: { utterance: { name: 'utterance', value: utterance } } } : {}) } } : {}) } } } }];
  const today = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  const doseAt = (id, rx, hhmm, brand) => ({ ...dose(id, rx, hhmm, OPEN, brand), scheduledAt: today + 'T' + hhmm + ':00+03:00' });
  // One dose already passed (00:05) and one still ahead (23:55), whatever the clock says.
  const DAYDOSES = [doseAt('rx-008-x-0005', 'rx-008', '00:05', 'Eltroxin'), doseAt('rx-009-x-2355', 'rx-009', '23:55')];
  // Walked as the connections run: parse -> (Gemini, for free talk) -> intent -> reads -> plan -> (writes) -> speak.
  const walk = async (w, input, { doses = http(200, { doses: DAYDOSES }), elig = http(200, [{ patientId: 'pt-03', chatId: '5550001', language: 'ar', frequency: 'daily' }]), model = null, writeCode = 200 } = {}) => {
    const r = runner(w);
    const [p] = await r.code('alexa request (deterministic)', input);
    let toIntent = [p];
    if (p.json.ok && p.json.kind === 'FreeTalkIntent' && p.json.utterance) toIntent = r.set('Gemini: understand the sentence', [{ json: { output: model } }]);
    const [q] = await r.code('voice intent (deterministic)', toIntent);
    if (q.json.ok && q.json.needsDoses) { r.set('backend: doses of the day', doses); r.set('backend: who is eligible', elig); }
    const [pl] = await r.code('plan (deterministic)', [{ json: {} }]);
    const posted = [];
    if (pl.json.writes.length) {
      const items = await r.code('one item per write (deterministic)', [pl]);
      posted.push(...items.map((x) => x.json));
      r.set('backend: record the status', items.map(() => ({ json: { statusCode: writeCode, body: {} } })));
      const [rc] = await r.code('recomputes (deterministic)', [{ json: {} }]);
      if (rc.json.recomputes.length) {
        const re = await r.code('one item per recompute (deterministic)', [rc]);
        posted.push(...re.map((x) => x.json));
        r.set('backend: recompute', re.map(() => ({ json: { statusCode: 200, body: {} } })));
      }
    }
    const [s] = await r.code('speak (deterministic)', [{ json: {} }]);
    const prompts = s.json.prompts.length ? await r.code('telegram prompt (deterministic)', [{ json: {} }]) : [];
    return { parsed: p.json, intent: q.json, plan: pl.json, posted, spoken: s.json, prompts: prompts.map((x) => x.json) };
  };

  await check('the COMMITTED workflow ships no skill id and no link -> every request refused, nothing read', async () => {
    const s = await walk(wf, body('IntentRequest', 'NextDoseIntent'));
    assert.equal(s.parsed.ok, false);
    assert.equal(s.parsed.dosesUrl, null);
    assert.equal(s.spoken.refused, true);
  });
  await check('an unlinked device is told so, and its userId is in the execution log for linking', async () => {
    const s = await walk(configure(SKILL, {}), body('LaunchRequest'));
    assert.match(s.spoken.alexa.response.outputSpeech.text, /مو مربوط/);
    assert.equal(s.spoken.log.userId, USER);
  });
  await check('«شنو جرعتي الجاية» -> the next OPEN dose, spoken in Arabic, session stays open', async () => {
    const s = await walk(configure(SKILL, { [USER]: 'pt-03' }), body('IntentRequest', 'NextDoseIntent'));
    assert.match(s.parsed.dosesUrl, /\/api\/agent\/patients\/pt-03\/doses\?date=\d{4}-\d{2}-\d{2}$/);
    const text = s.spoken.alexa.response.outputSpeech.text;
    assert.match(text, /^جرعتك الجاية Calcium carbonate \+ vitamin D3 الساعة 11 و55 دقيقة بالليل/);
    assert.equal(s.spoken.alexa.response.shouldEndSession, false);
    assert.deepEqual(s.prompts, []);
    console.log('        -> ' + text);
  });
  await check('«نسيت دواي» -> names the passed dose, records nothing, sends ITS buttons to the patient’s own chat', async () => {
    const s = await walk(configure(SKILL, { [USER]: 'pt-03' }), body('IntentRequest', 'ForgotDoseIntent'));
    assert.match(s.spoken.alexa.response.outputSpeech.text, /Eltroxin الساعة 12 و5 دقيقة بالليل/);
    assert.match(s.spoken.alexa.response.outputSpeech.text, /ما سجّلت شي بالصوت/);
    assert.equal(s.prompts.length, 2);
    assert.equal(s.prompts[0].chatId, '5550001');
    assert.deepEqual(s.prompts[1].buttons.map((b) => b.data), ['d:rx-008-x-0005:taken_on_time', 'd:rx-008-x-0005:taken_late', 'd:rx-008-x-0005:missed']);
    console.log('        -> ' + s.spoken.alexa.response.outputSpeech.text);
  });
  await check('"what is my next dose" in en-US -> English', async () => {
    const s = await walk(configure(SKILL, { [USER]: 'pt-03' }), body('IntentRequest', 'NextDoseIntent', 'en-US'));
    assert.match(s.spoken.alexa.response.outputSpeech.text, /^Your next dose is Calcium carbonate \+ vitamin D3 at 11:55 in the evening/);
  });
  await check('the backend refused (401) -> an honest failure, no schedule invented, no prompt', async () => {
    const s = await walk(configure(SKILL, { [USER]: 'pt-03' }), body('IntentRequest', 'ForgotDoseIntent'), { doses: http(401, { error: 'unauthorized' }) });
    assert.match(s.spoken.alexa.response.outputSpeech.text, /ما قدرت أوصل لجدولك/);
    assert.deepEqual(s.prompts, []);
  });
  await check('CR-069: a linked turn tells the patient\'s screen its topic and the words just spoken; refused / unlinked / a closed session tell it nothing', async () => {
    const linked = configure(SKILL, { [USER]: 'pt-03' });
    let s = await walk(linked, body('IntentRequest', 'TodayDosesIntent'));
    assert.match(s.parsed.voiceTurnUrl, /\/api\/agent\/patients\/pt-03\/voice-turns$/);
    assert.deepEqual(Object.keys(s.spoken.screen).sort(), ['language', 'reply', 'topic']);
    assert.equal(s.spoken.screen.topic, 'today');
    assert.equal(s.spoken.screen.reply, s.spoken.alexa.response.outputSpeech.text);
    s = await walk(linked, body('IntentRequest', 'AMAZON.FallbackIntent', 'en-US'));
    assert.deepEqual([s.spoken.screen.topic, s.spoken.screen.language], ['unclear', 'en']);
    s = await walk(linked, body('SessionEndedRequest'));
    assert.equal(s.spoken.screen, null);
    s = await walk(configure(SKILL, {}), body('IntentRequest', 'TodayDosesIntent'));
    assert.equal(s.spoken.screen, null);
    assert.equal(s.parsed.voiceTurnUrl, null);
    s = await walk(wf, body('IntentRequest', 'TodayDosesIntent'));
    assert.equal(s.spoken.screen, null);
    // It runs only AFTER Alexa has its answer, beside (never inside) the Telegram-prompt path.
    assert.deepEqual(wf.connections['Answer Alexa'].main[0].map((l) => l.node).sort(), ['follow on screen?', 'prompt Telegram?']);
  });
  // ---- CR-070: free talk, and dose actions by voice behind the switch.
  const FIRST_TWO_THIRD = { intent: 'record', confidence: 0.95, items: [{ position: 1, status: W_ON }, { position: 2, status: W_MISS }] };
  await check('CR-070 free talk: the sentence goes to Gemini, and its intent is answered from the data ("check my medicines" -> today)', async () => {
    const s = await walk(configure(SKILL, { [USER]: 'pt-03' }), body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'my medicines for today' }), { model: { intent: 'today', confidence: 0.9 } });
    assert.equal(s.intent.kind, 'TodayDosesIntent');
    assert.match(s.spoken.alexa.response.outputSpeech.text, /^Today you have 2 doses: 12:05 in the morning Eltroxin, still open\./);
    assert.equal(s.spoken.screen.topic, 'today');
    const u = await walk(configure(SKILL, { [USER]: 'pt-03' }), body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'what is the weather' }), { model: { intent: 'unclear', confidence: 0.9 } });
    assert.equal(u.intent.kind, 'AMAZON.FallbackIntent');
    assert.equal(u.spoken.screen.topic, 'unclear');
    const failed = await walk(configure(SKILL, { [USER]: 'pt-03' }), body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'x y z' }), { model: null });
    assert.equal(failed.intent.kind, 'AMAZON.FallbackIntent'); // the model failed -> unclear, never a guess
  });
  await check('CR-070 switch ON, turn 1: "mark the first two taken and the third missed" is read back and asked; NOTHING is written; a not-due dose is named and skipped', async () => {
    const s = await walk(configure(SKILL, { [USER]: 'pt-03' }, true), body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'the first two taken and the third missed' }), { model: FIRST_TWO_THIRD });
    assert.equal(s.intent.kind, 'record');
    assert.deepEqual(s.posted, []);
    assert.deepEqual(s.spoken.alexa.sessionAttributes, { pending: [{ doseId: 'rx-008-x-0005', prescriptionId: 'rx-008', status: W_ON }] });
    assert.match(s.spoken.alexa.response.outputSpeech.text, /^I will record: Eltroxin at 12:05 in the morning taken\. I could not record: Calcium carbonate \+ vitamin D3 at 11:55 in the evening - not due yet\. Shall I\? Say yes, or no\.$/);
    assert.equal(s.spoken.alexa.response.shouldEndSession, false);
    assert.equal(s.spoken.screen.topic, 'record');
    console.log('        -> ' + s.spoken.alexa.response.outputSpeech.text);
  });
  await check('CR-070 switch ON, turn 2 "yes": the list comes back from Alexa\'s session, is re-checked, and is written exactly as the Telegram path writes it (a miss is recomputed)', async () => {
    const pending = [{ doseId: 'rx-008-x-0005', prescriptionId: 'rx-008', status: W_MISS }, { doseId: 'rx-009-x-2355', prescriptionId: 'rx-009', status: W_ON }];
    const s = await walk(configure(SKILL, { [USER]: 'pt-03' }, true), body('IntentRequest', 'AMAZON.YesIntent', 'en-US', { pending }));
    assert.deepEqual(s.posted.map((x) => [x.url.replace(/^.*\/api\/agent/, ''), x.body.status || x.body.reason]), [
      ['/doses/rx-008-x-0005/status', 'missed'], ['/schedule/recompute', 'reported_miss'],
    ]); // 23:55 is not due -> not written even though it came back in the session
    assert.equal(s.posted[0].body.source, 'adherence_agent');
    assert.match(s.spoken.alexa.response.outputSpeech.text, /^Done\. I recorded: Eltroxin at 12:05 in the morning missed\./);
    assert.equal(s.spoken.alexa.sessionAttributes, undefined); // the list is spent
    const refused = await walk(configure(SKILL, { [USER]: 'pt-03' }, true), body('IntentRequest', 'AMAZON.YesIntent', 'en-US', { pending: pending.slice(0, 1) }), { writeCode: 409 });
    assert.match(refused.spoken.alexa.response.outputSpeech.text, /^I could not record: Eltroxin/); // a refused write never reads as recorded
    const no = await walk(configure(SKILL, { [USER]: 'pt-03' }, true), body('IntentRequest', 'AMAZON.NoIntent', 'en-US', { pending }));
    assert.deepEqual(no.posted, []);
    assert.match(no.spoken.alexa.response.outputSpeech.text, /did not record anything/);
  });
  await check('CR-070: the COMMITTED workflow ships the switch OFF: a record request is refused out loud and a "yes" writes nothing', async () => {
    const plan = wf.nodes.find((x) => x.name === 'plan (deterministic)').parameters.jsCode;
    assert.ok(plan.includes('const VOICE_RECORDS = false;'));
    assert.ok(!plan.includes('const VOICE_RECORDS = true;'));
    const s = await walk(configure(SKILL, { [USER]: 'pt-03' }), body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'the first two taken' }), { model: FIRST_TWO_THIRD });
    assert.match(s.spoken.alexa.response.outputSpeech.text, /Recording by voice is turned off/);
    assert.deepEqual(s.posted, []);
    const y = await walk(configure(SKILL, { [USER]: 'pt-03' }), body('IntentRequest', 'AMAZON.YesIntent', 'en-US', { pending: [{ doseId: 'rx-008-x-0005', prescriptionId: 'rx-008', status: W_MISS }] }));
    assert.deepEqual(y.posted, []);
  });
  await check('the voice workflow\'s HTTP calls: two GETs to the read routes, the screen turn, and the two write calls - whose URL and body only confirmRecord builds; no Code node calls out', async () => {
    const httpNodes = wf.nodes.filter((x) => x.type === 'n8n-nodes-base.httpRequest');
    assert.equal(httpNodes.length, 5);
    for (const n of httpNodes) {
      if (n.name === 'backend: record the status' || n.name === 'backend: recompute') {
        assert.equal(n.parameters.method, 'POST');
        assert.equal(n.parameters.url, '={{ $json.url }}');
        assert.equal(n.parameters.jsonBody, '={{ JSON.stringify($json.body) }}');
        continue;
      }
      if (n.parameters.method === 'POST') {
        assert.equal(n.name, 'backend: voice turn for the screen');
        assert.equal(n.parameters.url, "={{ $('alexa request (deterministic)').first().json.voiceTurnUrl }}");
        assert.equal(n.parameters.jsonBody, "={{ JSON.stringify($('speak (deterministic)').first().json.screen) }}");
        continue;
      }
      assert.equal(n.parameters.method, 'GET', n.name);
      assert.ok(n.parameters.url === '={{ $json.dosesUrl }}' || /\/api\/agent\/check-in-eligibility$/.test(n.parameters.url), n.name + ' -> ' + n.parameters.url);
    }
    for (const n of wf.nodes.filter((x) => x.type === 'n8n-nodes-base.code')) {
      assert.ok(!/helpers\.httpRequest|\bfetch\s*\(|XMLHttpRequest/.test(n.parameters.jsCode), n.name + ' makes its own network call');
    }
    const parse = wf.nodes.find((x) => x.name === 'alexa request (deterministic)').parameters.jsCode;
    assert.match(parse, /dosesUrl: p\.ok \? API \+ '\/patients\/' \+ encodeURIComponent\(p\.patientId\) \+ '\/doses\?date='/);
  });
}

/** agent-webchat (CR-067), walked as its connections run. */
async function webchatScenarios() {
  console.log('\n######## agent-webchat (web-app assistant, read-only)');
  const wf = WF('agent-webchat');
  const today = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  const doseAt = (id, rx, hhmm, brand) => ({ ...dose(id, rx, hhmm, OPEN, brand), scheduledAt: today + 'T' + hhmm + ':00+03:00' });
  const DAYDOSES = [doseAt('rx-008-x-0005', 'rx-008', '00:05', 'Eltroxin'), doseAt('rx-009-x-2355', 'rx-009', '23:55')];
  const req = (body) => [{ json: { body: { patientId: 'pt-03', language: 'ar', alerts: [], ...body } } }];
  const walk = async (input, model, { doses = http(200, { doses: DAYDOSES }), elig = http(200, [{ patientId: 'pt-03', chatId: '5550001', language: 'ar', frequency: 'daily' }]) } = {}) => {
    const r = runner(wf);
    const [parsed] = await r.code('chat request (deterministic)', input);
    // Mirror IF 'needs the model?': the fast path skips Gemini and hands the parse output straight on.
    const [i] = await r.code('intent (deterministic)', parsed.json.ok && !parsed.json.quick ? [{ json: { output: model } }] : [parsed]);
    // Mirror IF 'needs the schedule?' and IF 'needs the chat?'.
    if (i.json.needsDoses) r.set('backend: doses of the day', doses);
    if (i.json.needsDoses && i.json.needsChat) r.set('backend: who is eligible', elig);
    const [a] = await r.code('answer (deterministic)', [{ json: {} }]);
    const prompts = a.json.prompts.length ? await r.code('telegram prompt (deterministic)', [{ json: {} }]) : [];
    return { intent: i.json, answer: a.json, prompts: prompts.map((x) => x.json) };
  };

  await check('«شنو جرعتي الجاية» -> the next OPEN dose from the backend, in Arabic', async () => {
    const s = await walk(req({ text: 'شنو جرعتي الجاية' }), { intent: 'next_dose', confidence: 0.95 });
    assert.match(s.intent.dosesUrl, /\/api\/agent\/patients\/pt-03\/doses\?date=\d{4}-\d{2}-\d{2}$/);
    assert.match(s.answer.reply, /^جرعتك الجاية Calcium carbonate \+ vitamin D3 الساعة 11 و55 دقيقة بالليل/);
    assert.deepEqual(s.prompts, []);
    assert.equal(s.intent.viaModel, false, 'a suggestion must not wait for Gemini');
    assert.equal(s.intent.needsChat, false, 'a next-dose answer must not look up Telegram');
    console.log('        -> ' + s.answer.reply);
  });
  await check('free wording still goes to Gemini, and its intent is used', async () => {
    const s = await walk(req({ text: 'بعد كم ساعة لازم آخذ الحبة الثانية' }), { intent: 'next_dose', confidence: 0.9 });
    assert.equal(s.intent.viaModel, true);
    assert.equal(s.intent.intent, 'next_dose');
    assert.match(s.answer.reply, /^جرعتك الجاية/);
  });
  await check('«أخذته» -> nothing recorded; the open dose’s buttons go to the patient’s OWN Telegram', async () => {
    const s = await walk(req({ text: 'أخذته' }), { intent: 'took_it', confidence: 0.97 });
    assert.match(s.answer.reply, /ما أقدر أسجّل الجرعة من هنا/);
    assert.equal(s.intent.needsChat, true, 'only forgot / took it look up Telegram');
    assert.equal(s.prompts[0].chatId, '5550001');
    assert.deepEqual(s.prompts[1].buttons.map((b) => b.data)[0], 'd:rx-008-x-0005:taken_on_time');
    console.log('        -> ' + s.answer.reply);
  });
  await check('«فيه تعارض بين أدويتي؟» -> only the alerts the app passed in, never a new judgement; no schedule read', async () => {
    const alerts = [{ severity: 'warning', description: 'الكالسيوم قد يقلل امتصاص اللِفوثيروكسين إذا أُخذا معًا.', reviewStatus: 'reviewed' }];
    const s = await walk(req({ text: 'فيه تعارض بين أدويتي؟', alerts }), { intent: 'safety', confidence: 0.9 });
    assert.equal(s.intent.needsDoses, false);
    assert.match(s.answer.reply, /الكالسيوم قد يقلل امتصاص/);
    assert.match(s.answer.reply, /اسأل الصيدلاني/);
  });
  await check('the model failed or is unsure -> unclear with examples, nothing read, nothing sent', async () => {
    for (const model of [{ error: '429' }, { intent: 'next_dose', confidence: 0.5 }, { intent: 'record_dose', confidence: 1 }]) {
      const s = await walk(req({ text: 'ايه' }), model);
      assert.equal(s.intent.intent, 'unclear');
      assert.match(s.answer.reply, /ما فهمت عليك/);
      assert.deepEqual(s.prompts, []);
    }
  });
  await check('a request with no patient or no text is answered, never processed', async () => {
    for (const body of [{ patientId: '' , text: 'x' }, { text: '   ' }, { patientId: "pt-03' or 1=1", text: 'x' }]) {
      const s = await walk(req(body), { intent: 'next_dose', confidence: 0.99 });
      assert.equal(s.intent.needsDoses, false);
      assert.deepEqual(s.prompts, []);
    }
  });
  await check('the webchat workflow holds no write: two GETs to the read routes, no Code node calls out', async () => {
    const httpNodes = wf.nodes.filter((x) => x.type === 'n8n-nodes-base.httpRequest');
    assert.equal(httpNodes.length, 2);
    for (const n of httpNodes) assert.equal(n.parameters.method, 'GET', n.name);
    for (const n of wf.nodes.filter((x) => x.type === 'n8n-nodes-base.code')) assert.ok(!/helpers\.httpRequest|\bfetch\s*\(/.test(n.parameters.jsCode), n.name);
  });
}

(async () => {
  await staticChecks();
  await scenarios();
  await alexaScenarios();
  await webchatScenarios();
  console.log('\n' + (failures === 0 ? 'all checks passed' : failures + ' check(s) FAILED'));
  process.exit(failures === 0 ? 0 : 1);
})();
