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

/**
 * One fixed clock for the whole run. Every scenario and every Code node (they run in this realm, via
 * AsyncFunction) reads "now" from here, so no run depends on the real time of day. Before this, a run
 * that crossed Kuwait midnight computed "today" before it and walked the scenario after it, and the
 * "next open dose" scenarios failed. CHECK_NOW sits on the fixture day (2026-09-24), in the afternoon.
 * Only a no-argument `new Date()` and `Date.now()` are frozen; any explicit date is unchanged.
 */
const CHECK_NOW = '2026-09-24T15:00:00+03:00';
{
  const RealDate = Date;
  const fixedMs = RealDate.parse(CHECK_NOW);
  class FrozenDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(fixedMs); else super(...args); }
    static now() { return fixedMs; }
  }
  globalThis.Date = FrozenDate;
}

const ROOT = path.join(__dirname, '..');
const WF = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', name + '.json'), 'ascii'));
const NAMES = ['agent-telegram-inbound', 'agent-checkin-daily', 'agent-alexa', 'agent-webchat'];
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
      assert.match(JSON.stringify(wf), /[؀-ۿ]/, 'no Arabic survived un-escaping');
    });
    // Two packages each numbered new nodes from the same free id (AP-05 and AP-11 both from IN(32)):
    // n8n keys a node by its id, and an IF node's condition id is derived from it, so a duplicate
    // is a real collision, never a cosmetic one.
    await check(name + ': unique node ids and IF condition ids', () => {
      const ids = wf.nodes.map((n) => n.id);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      assert.deepEqual(dupes, [], 'duplicate node id');
      const condIds = wf.nodes.flatMap((n) => (((n.parameters || {}).conditions || {}).conditions || []).map((c) => c.id));
      assert.equal(new Set(condIds).size, condIds.length, 'duplicate IF condition id');
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
        try { new AsyncFunction('$input', '$', '$getWorkflowStaticData', n.parameters.jsCode); } catch (e) { throw new Error(n.name + ': ' + e.message); }
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
  // AP-11: one in-memory object per scenario (per runner(wf) call), standing in for n8n's own
  // $getWorkflowStaticData('global') - the Orchestrator's pending-photo store.
  const staticData = {};
  const getStaticData = () => staticData;
  return {
    out, staticData,
    set(name, items) { out[name] = items; return items; },
    async code(name, input, binary) {
      const n = byName[name];
      assert.ok(n && n.type === 'n8n-nodes-base.code', 'no Code node ' + name);
      const $input = { first: () => input[0], all: () => input };
      const ctx = { helpers: { getBinaryDataBuffer: async () => binary } };
      const result = await new AsyncFunction('$input', '$', '$getWorkflowStaticData', n.parameters.jsCode).call(ctx, $input, ref, getStaticData);
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
// pt-03's active prescriptions, exactly as GET /api/agent/patients/{id}/prescriptions answers.
const RX_BODY = { patientId: 'pt-03', prescriptions: [
  { id: 'rx-008', patientId: 'pt-03', drug: { genericName: 'Levothyroxine', brandName: 'Eltroxin' }, status: 'active', needsReview: false },
  { id: 'rx-009', patientId: 'pt-03', drug: { genericName: 'Calcium carbonate + vitamin D3' }, status: 'active', needsReview: false },
] };
// pt-01's ACTIVE caregivers, exactly as GET /api/agent/alert-recipients?patientId= answers (§B).
const RECIPIENTS_BODY = { patientId: 'pt-01', patient: { chatId: '5550009', push: false }, caregivers: [{ caregiverId: 'cg-01', chatId: '5550002', push: false }] };
const relay = (over) => [{ json: { body: {
  kind: 'message', chatId: '5550001', messageId: 1, sentAt: '2026-09-24T07:20:00+03:00', text: 'خذيته',
  photoFileId: null, documentFileId: null, callbackQueryId: null,
  channel: 'telegram', subjectType: 'patient', subjectId: 'pt-03', patientId: 'pt-03', language: 'ar', ...over } } }];

/**
 * Walk agent-telegram-inbound exactly as its connections do, for a text or a tap. A patient's takes
 * the adherence path. A caregiver's - since AP-11 routes EVERY caregiver message off that path
 * (route 'reply', reason 'caregiver') - takes the caregiver lane the AP-05 merge built: AP-05's own
 * re-check against alert-recipients, decide()'s own caregiver branch, then the Orchestrator's fixed
 * reply and AP-05's log. That lane holds no write node, no model and no dose read at all (the static
 * "caregiver lane" check below walks the graph to prove it), so its `calls` is empty by construction.
 */
async function inbound({
  payload, dosesResponse = http(200, DAY), prevDosesResponse, prescriptionsResponse = http(200, RX_BODY),
  recipientsResponse = http(200, RECIPIENTS_BODY), model, write1 = 200, write2 = 200,
}) {
  const wf = WF('agent-telegram-inbound');
  const r = runner(wf);
  const routed = await r.code('route (deterministic)', payload);
  if (routed.length === 0) return { dropped: true };
  if (routed[0].json.subjectType === 'caregiver') {
    // fixed reply? -> a caregiver (fixed reply)? -> backend: alert recipients (caregiver reply)
    //   -> orchestrator: caregiver check (deterministic) -> orchestrator: reply (deterministic)
    //                                                    + log: non-active caregiver (deterministic)
    assert.equal(routed[0].json.route, 'reply');
    assert.equal(routed[0].json.reason, 'caregiver');
    assert.equal(routed[0].json.needsModel, false);
    const fetched = r.set('backend: alert recipients (caregiver reply)', recipientsResponse);
    const [c] = await r.code('orchestrator: caregiver check (deterministic)', fetched);
    assert.deepEqual(c.json.decision.writes, [], 'decide() never writes for a caregiver');
    const replies = await r.code('orchestrator: reply (deterministic)', [c]);
    const caregiverLog = await r.code('log: non-active caregiver (deterministic)', [c]);
    return { routed: routed[0].json, decision: c.json.decision, calls: [], replies: replies.map((x) => x.json), caregiverLog: caregiverLog.map((x) => x.json) };
  }
  assert.equal(routed[0].json.route, 'adherence');
  r.set('backend: doses of the day', dosesResponse);
  r.set('backend: active prescriptions', prescriptionsResponse);
  if (routed[0].json.prevDosesUrl) r.set('backend: doses of the previous day', prevDosesResponse === undefined ? dosesResponse : prevDosesResponse);
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
  // The log reads $input since the merge (two nodes feed it): here, decide's own output, as the connection runs.
  const caregiverLog = await r.code('log: non-active caregiver (deterministic)', [d]);
  return { routed: routed[0].json, decision: d.json.decision, calls, replies: replies.map((x) => x.json), caregiverLog: caregiverLog.map((x) => x.json) };
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
  // TC-AD-14 (a caregiver's text) is re-pointed below, in the Orchestrator section: AP-11 moves a
  // caregiver's message (of any kind) off this adherence path entirely (route === 'reply').
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

  console.log('\n######## agent-telegram-inbound (AP-05 - adherence hardening)');
  await check('TC-RS-03: "الدكتور قال أوقف الدواء" writes nothing; one Stop <drug>? button per active prescription plus none of these; an unparseable callback never reaches the model', async () => {
    const asked = await inbound({ payload: relay({ text: 'الدكتور قال أوقف الدواء' }), model: { intent: 'discontinued_by_doctor', confidence: 0.9, quote: 'الدكتور قال أوقف الدواء' } });
    assert.equal(asked.calls.length, 0);
    assert.equal(asked.decision.outcome, 'confirm_discontinue');
    assert.equal(asked.replies.length, 4); // header + rx-008 + rx-009 + "none of these"
    assert.equal(asked.replies[0].buttons, null);
    assert.deepEqual(asked.replies.slice(1).map((m) => m.buttons.length), [1, 1, 1]);
    assert.equal(asked.replies[1].buttons[0].data, 's:rx-008');
    assert.equal(asked.replies[2].buttons[0].data, 's:rx-009');
    assert.equal(asked.replies[3].buttons[0].data, 'n:none');
    console.log('        -> ' + asked.replies[0].text + ' | ' + asked.replies.slice(1).map((m) => m.text).join(' / '));
    // A callback with unparseable data (neither d: nor s:/n:none) never reaches Gemini.
    const garbled = await inbound({ payload: relay({ kind: 'callback', text: 'garbage', callbackQueryId: 'cbq-g' }) });
    assert.equal(garbled.routed.needsModel, false);
    assert.equal(garbled.calls.length, 0);
  });
  await check('TC-RS-03: a tap s:<rxId> of THIS patient discontinues that one prescription, with a fixed reason (no quote fits in 64 bytes)', async () => {
    const tapped = await inbound({ payload: relay({ kind: 'callback', text: 's:rx-008', callbackQueryId: 'cbq-s1', sentAt: '2026-09-24T08:01:00+03:00' }) });
    assert.equal(tapped.routed.needsModel, false);
    assert.equal(tapped.calls.length, 1);
    assert.match(tapped.calls[0].url, /\/schedule\/recompute$/);
    assert.deepEqual(tapped.calls[0].body, { prescriptionId: 'rx-008', reason: 'discontinued', discontinuedReason: tapped.calls[0].body.discontinuedReason });
    assert.ok(tapped.calls[0].body.discontinuedReason.length > 0);
    assert.match(tapped.replies[0].text, /Eltroxin/);
  });
  await check('TC-RS-03: "none of these" writes nothing; an unknown or foreign prescription id writes nothing; a caregiver’s stop tap is refused', async () => {
    const none = await inbound({ payload: relay({ kind: 'callback', text: 'n:none', callbackQueryId: 'cbq-n' }) });
    assert.equal(none.calls.length, 0);
    assert.equal(none.decision.outcome, 'discontinue_none');
    const unknown = await inbound({ payload: relay({ kind: 'callback', text: 's:rx-999', callbackQueryId: 'cbq-u' }) });
    assert.equal(unknown.calls.length, 0);
    assert.equal(unknown.decision.outcome, 'no_dose');
    const byCaregiver = await inbound({ payload: relay({ kind: 'callback', text: 's:rx-008', callbackQueryId: 'cbq-c', subjectType: 'caregiver', subjectId: 'cg-01', patientId: 'pt-01' }), recipientsResponse: http(200, RECIPIENTS_BODY) });
    assert.equal(byCaregiver.calls.length, 0);
    assert.equal(byCaregiver.decision.outcome, 'caregiver_refused');
  });
  await check('TC-AD-12 (after midnight): 00:40 with only YESTERDAY’s dose open -> the previous day is fetched and that dose is recorded; the fetch is required (missing or refused -> refused, never a silent fall back to today alone)', async () => {
    const yesterday = { patientId: 'pt-03', date: '2026-09-23', doses: [{ ...dose('rx-009-y-2100', 'rx-009', '21:00', OPEN), scheduledAt: '2026-09-23T21:00:00+03:00' }] };
    const emptyToday = { patientId: 'pt-03', date: '2026-09-24', doses: [] };
    const s = await inbound({
      payload: relay({ sentAt: '2026-09-24T00:40:00+03:00', text: 'خذيته' }),
      dosesResponse: http(200, emptyToday), prevDosesResponse: http(200, yesterday),
      model: { intent: 'taken_on_time', confidence: 0.95, quote: 'خذيته' },
    });
    assert.match(s.routed.prevDosesUrl, /doses\?date=2026-09-23$/);
    assert.equal(s.calls.length, 1);
    assert.match(s.calls[0].url, /rx-009-y-2100\/status$/);
    const refused = await inbound({
      payload: relay({ sentAt: '2026-09-24T00:40:00+03:00', text: 'خذيته' }),
      dosesResponse: http(200, emptyToday), prevDosesResponse: http(503, { error: 'unavailable' }),
      model: { intent: 'taken_on_time', confidence: 0.95, quote: 'خذيته' },
    });
    assert.equal(refused.calls.length, 0);
    assert.equal(refused.decision.outcome, 'refused');
  });
  await check('TC-AD-12: two open doses across both days (after midnight) -> ask which, one button message per dose, yesterday’s marked; 03:00 reads today only', async () => {
    const yesterday = { patientId: 'pt-03', date: '2026-09-23', doses: [{ ...dose('rx-009-y-2100', 'rx-009', '21:00', OPEN), scheduledAt: '2026-09-23T21:00:00+03:00' }] };
    // 00:15 today - due (within the 1-hour grace) by the time the reply arrives at 00:40.
    const today = { patientId: 'pt-03', date: '2026-09-24', doses: [dose('rx-008-20260924-0015', 'rx-008', '00:15', OPEN, 'Eltroxin')] };
    const s = await inbound({
      payload: relay({ sentAt: '2026-09-24T00:40:00+03:00', text: 'خذيته' }),
      dosesResponse: http(200, today), prevDosesResponse: http(200, yesterday),
      model: { intent: 'taken_on_time', confidence: 0.95, quote: 'خذيته' },
    });
    assert.equal(s.decision.outcome, 'ask_which');
    assert.equal(s.calls.length, 0);
    assert.match(s.replies[1].text, /^أمس 21:00/);
    assert.doesNotMatch(s.replies[2].text, /^أمس/);
    // From 03:00 on, no previous-day fetch is even requested.
    const late = await inbound({ payload: relay({ sentAt: '2026-09-24T03:00:00+03:00', text: 'خذيته' }), dosesResponse: http(200, today), model: { intent: 'taken_on_time', confidence: 0.95, quote: 'خذيته' } });
    assert.equal(late.routed.prevDosesUrl, null);
  });
  await check('TC-AD-12: a tap on the ASK\'s yesterday button, itself sent after midnight, still fetches the previous day (the tap\'s own sentAt is the tap time, not the check-in message\'s) and records that dose, never no_dose', async () => {
    const yesterday = { patientId: 'pt-03', date: '2026-09-23', doses: [{ ...dose('rx-009-y-2100', 'rx-009', '21:00', OPEN), scheduledAt: '2026-09-23T21:00:00+03:00' }] };
    const today = { patientId: 'pt-03', date: '2026-09-24', doses: [dose('rx-008-20260924-0015', 'rx-008', '00:15', OPEN, 'Eltroxin')] };
    const s = await inbound({
      payload: relay({ kind: 'callback', text: 'd:rx-009-y-2100:taken_on_time', callbackQueryId: 'cbq-y1', sentAt: '2026-09-24T00:41:00+03:00' }),
      dosesResponse: http(200, today), prevDosesResponse: http(200, yesterday),
    });
    assert.equal(s.routed.needsModel, false);
    assert.match(s.routed.prevDosesUrl, /doses\?date=2026-09-23$/);
    assert.equal(s.calls.length, 1);
    assert.match(s.calls[0].url, /rx-009-y-2100\/status$/);
    assert.equal(s.calls[0].body.status, W_ON);
    assert.notEqual(s.decision.outcome, 'no_dose');
  });
  await check('TC-AD-09 (CR-092): trackingOn false and nothing open -> "check-ins are not switched on", no write; trackingOn absent -> the plain no-dose reply', async () => {
    const empty = { patientId: 'pt-03', date: '2026-09-24', doses: [] };
    const off = await inbound({ payload: relay({ trackingOn: false }), dosesResponse: http(200, empty), model: { intent: 'taken_on_time', confidence: 0.95, quote: 'خذيته' } });
    assert.equal(off.decision.outcome, 'tracking_off');
    assert.equal(off.calls.length, 0);
    assert.match(off.replies[0].text, /متابعة الجرعات/);
    const absent = await inbound({ payload: relay({}), dosesResponse: http(200, empty), model: { intent: 'taken_on_time', confidence: 0.95, quote: 'خذيته' } });
    assert.equal(absent.decision.outcome, 'no_dose');
  });
  await check('TC-AD-16: an alleged caregiver NOT confirmed active (alert-recipients) -> nothing sent, nothing written, one log item, never a chat id; an ACTIVE caregiver keeps the plain refusal and logs nothing; the check itself failing is ALSO unverified (fail closed)', async () => {
    const unverified = await inbound({ payload: relay({ subjectType: 'caregiver', subjectId: 'cg-99', patientId: 'pt-01', text: 'أبوي خذ الدوا' }), recipientsResponse: http(200, RECIPIENTS_BODY) });
    assert.equal(unverified.decision.outcome, 'caregiver_unverified');
    assert.equal(unverified.replies.length, 0);
    assert.equal(unverified.calls.length, 0);
    assert.deepEqual(unverified.caregiverLog, [{ patientId: 'pt-01', reason: 'non_active_caregiver' }]);
    assert.ok(!JSON.stringify(unverified.caregiverLog).includes('chatId'));
    const active = await inbound({ payload: relay({ subjectType: 'caregiver', subjectId: 'cg-01', patientId: 'pt-01', text: 'أبوي خذ الدوا' }), recipientsResponse: http(200, RECIPIENTS_BODY) });
    assert.equal(active.decision.outcome, 'caregiver_refused');
    assert.equal(active.replies.length, 1);
    assert.deepEqual(active.caregiverLog, []);
    const down = await inbound({ payload: relay({ subjectType: 'caregiver', subjectId: 'cg-01', patientId: 'pt-01', text: 'أبوي خذ الدوا' }), recipientsResponse: http(503, { error: 'unavailable' }) });
    assert.equal(down.decision.outcome, 'caregiver_unverified');
  });
  await check('G10: a failed Telegram send (onError: continueRegularOutput) -> one log item, never a chat id or the message text', async () => {
    const wf = WF('agent-telegram-inbound');
    const r = runner(wf);
    const failedSend = [{ json: { error: { message: 'Bad Request: chat not found' } } }];
    const log = await r.code('log: failed Telegram send (text)', failedSend);
    assert.deepEqual(log.map((x) => x.json), [{ node: 'Telegram: reply', doseId: null, error: 'Bad Request: chat not found' }]);
    assert.ok(!JSON.stringify(log).includes('chatId') && !JSON.stringify(log).includes('text'));
    const okSend = [{ json: { chatId: '1', text: 'hi' } }];
    assert.deepEqual(await r.code('log: failed Telegram send (buttons)', okSend), []);
  });

  console.log('\n######## agent-telegram-inbound (extraction, via the Orchestrator\'s photo branch - AP-11)');
  const geminiPhoto = (kind, confidence) => http(200, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ kind, confidence }) }] } }] });
  /** route -> the photo branch -> classified as `kind` -> the IF chain re-downloads for the agent
   * that owns it. Returns the runner so the caller continues exactly as the old direct-route test did. */
  async function photoClassifiedAs(kind, confidence, payload, mime = 'image/jpeg', buffer = Buffer.from('fake-jpeg-bytes')) {
    const wf = WF('agent-telegram-inbound');
    const r = runner(wf);
    const [routed] = await r.code('route (deterministic)', payload);
    assert.equal(routed.json.route, 'photo');
    await r.code('orchestrator: ask what the photo is', [{ json: {}, binary: { data: { mimeType: mime } } }], buffer);
    const [decided] = await r.code('orchestrator: decide (deterministic)', geminiPhoto(kind, confidence));
    assert.equal(decided.json.decidedKind, kind);
    return { r, decided: decided.json };
  }
  // AP-04: this workflow no longer calls jurah/screen-prescription itself - the backend already
  // screened (or held) the prescription before its 201 answered (AP-10/CR-090), and hands the
  // outcome back in the SAME body. clearReading() is a photo the core reads with full confidence.
  const clearReading = () => ({ isPrescription: true, facilityName: 'مستشفى العدان', sector: 'public', genericName: 'Amoxicillin', brandName: 'Amoxil',
    strength: 500, strengthUnit: 'mg', dosePerAdministration: 1, frequencyPerDay: 3, doseTimes: ['08:00', '14:00', '20:00'],
    dosingPattern: 'daily', durationDays: 7, startDate: '2026-09-24',
    // the relay carries the caption 'وصفتي' (AP-03/D3/CR-075): an attached caption needs its own
    // captionConflicts answer or every FLAGGABLE field is flagged (fail closed, TC-EX-06) - here it agrees on all five
    captionConflicts: [],
    // every CONFIDENCE_KEYS field the core checks needs its own number - a missing one is not sure (G7)
    confidence: { facilityName: 0.95, sector: 0.95, genericName: 0.95, brandName: 0.95, strength: 0.95, strengthUnit: 0.95,
      dosePerAdministration: 0.95, frequencyPerDay: 0.95, doseTimes: 0.9, dosingPattern: 0.95, durationDays: 0.95, startDate: 0.9 } });

  await check('a prescription photo -> the Orchestrator classifies it (0.92), THEN routed to extraction; the vision reply becomes a body; save 201, backend screening \'screened\' -> notScreened false', async () => {
    const { r } = await photoClassifiedAs('prescription', 0.92, relay({ text: 'وصفتي', photoFileId: 'AgAC-large' }));
    const [req] = await r.code('extraction: build the vision request', [{ json: {}, binary: { data: { mimeType: 'image/jpeg' } } }], Buffer.from('fake-jpeg-bytes'));
    assert.equal(req.json.visionBody.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
    assert.equal(req.json.visionBody.generationConfig.responseMimeType, 'application/json');
    const [v] = await r.code('extraction: validate (deterministic)', http(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(clearReading()) }] }, finishReason: 'STOP' }] }));
    assert.equal(v.json.result.ok, true);
    assert.equal(v.json.body.patientId, 'pt-03');
    r.set('backend: save the prescription', http(201, { prescription: { id: 'rx_new1' }, doseCount: 21, screening: 'screened' }));
    const [reply] = await r.code('extraction: reply (deterministic)', [{ json: {} }]);
    assert.equal(reply.json.notScreened, false);
    assert.equal(reply.json.screening, 'screened');
    assert.equal(reply.json.prescriptionId, 'rx_new1');
    console.log('        -> ' + reply.json.text);
  });
  await check('save 201, unflagged, backend screening \'held\' -> notScreened false (n8n did not accept it, but a specialist already holds it)', async () => {
    const { r } = await photoClassifiedAs('prescription', 0.92, relay({ photoFileId: 'AgAC-large2' }));
    await r.code('extraction: build the vision request', [{ json: {}, binary: { data: { mimeType: 'image/jpeg' } } }], Buffer.from('x'));
    await r.code('extraction: validate (deterministic)', http(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(clearReading()) }] }, finishReason: 'STOP' }] }));
    r.set('backend: save the prescription', http(201, { prescription: { id: 'rx_new1b' }, doseCount: 21, screening: 'held' }));
    const [reply] = await r.code('extraction: reply (deterministic)', [{ json: {} }]);
    assert.equal(reply.json.notScreened, false);
    assert.equal(reply.json.screening, 'held');
  });
  for (const s of [{ label: '\'skipped\'', extra: { screening: 'skipped' } }, { label: 'no screening field at all', extra: {} }]) {
    await check(`save 201, unflagged, backend screening ${s.label} -> notScreened true (TC-IX invariant broke on the backend's own side; Stop and Error follows)`, async () => {
      const { r } = await photoClassifiedAs('prescription', 0.92, relay({ photoFileId: 'AgAC-large3' }));
      await r.code('extraction: build the vision request', [{ json: {}, binary: { data: { mimeType: 'image/jpeg' } } }], Buffer.from('x'));
      await r.code('extraction: validate (deterministic)', http(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(clearReading()) }] }, finishReason: 'STOP' }] }));
      r.set('backend: save the prescription', http(201, Object.assign({ prescription: { id: 'rx_new1c' }, doseCount: 21 }, s.extra)));
      const [reply] = await r.code('extraction: reply (deterministic)', [{ json: {} }]);
      assert.equal(reply.json.notScreened, true);
      assert.equal(reply.json.prescriptionId, 'rx_new1c');
    });
  }
  await check('TC-EX-04: the orchestrator says prescription (0.95); extraction itself says isPrescription false -> nothing saved, notScreened false (nothing was created to screen)', async () => {
    const { r } = await photoClassifiedAs('prescription', 0.95, relay({ photoFileId: 'AgAC-box' }), 'image/png');
    await r.code('extraction: build the vision request', [{ json: {}, binary: { data: { mimeType: 'image/png' } } }], Buffer.from('x'));
    const [v] = await r.code('extraction: validate (deterministic)', http(200, { candidates: [{ content: { parts: [{ text: '{"isPrescription":false}' }] }, finishReason: 'STOP' }] }));
    assert.equal(v.json.body, null);
    const [reply] = await r.code('extraction: reply (deterministic)', [{ json: {} }]);
    assert.equal(reply.json.notScreened, false);
    assert.match(reply.json.text, /ما تبين إنها وصفة/);
  });
  await check('a flagged extraction is saved for the reviewer; backend screening \'skipped\' as expected (TC-IX-06) -> notScreened false', async () => {
    const { r } = await photoClassifiedAs('prescription', 0.9, relay({ photoFileId: 'AgAC-blurry' }));
    await r.code('extraction: build the vision request', [{ json: {}, binary: { data: { mimeType: 'image/jpeg' } } }], Buffer.from('x'));
    const reading = { isPrescription: true, facilityName: 'عيادة الياسمين', sector: 'private', genericName: 'Ciprofloxacin', dosePerAdministration: 1,
      frequencyPerDay: 2, dosingPattern: 'daily', durationDays: 5,
      // REQUIRED fields sure; brandName/strength/doseTimes/startDate left without confidence on purpose - flagged, not fixed (G7)
      confidence: { facilityName: 0.95, sector: 0.95, genericName: 0.95, dosePerAdministration: 0.95, dosingPattern: 0.95, durationDays: 0.95 } };
    const [v] = await r.code('extraction: validate (deterministic)', http(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(reading) }] }, finishReason: 'STOP' }] }));
    assert.equal(v.json.body.needsReview, true);
    r.set('backend: save the prescription', http(201, { prescription: { id: 'rx_new2' }, doseCount: 0, screening: 'skipped' }));
    const [reply] = await r.code('extraction: reply (deterministic)', [{ json: {} }]);
    assert.equal(reply.json.notScreened, false);
    assert.match(reply.json.text, /بيراجعها مختص طبي/);
  });

  console.log('\n######## agent-telegram-inbound (the Orchestrator itself - AP-11)');
  await check('a medicine box photo (0.9) builds the travel body {patientId, imageBase64, mimeType, language} and turns Travel Check\'s own answer into ONE fixed line, chosen by verdict alone', async () => {
    const { r } = await photoClassifiedAs('medicine_package', 0.9, relay({ patientId: 'pt-03', photoFileId: 'AgAC-box2' }));
    const [req] = await r.code('orchestrator: build the travel request', [{ json: {}, binary: { data: { mimeType: 'image/jpeg' } } }], Buffer.from('box-bytes'));
    assert.match(req.json.travelUrl, /\/webhook\/jurah\/travel-check$/);
    assert.deepEqual(req.json.travelBody, { patientId: 'pt-03', imageBase64: Buffer.from('box-bytes').toString('base64'), mimeType: 'image/jpeg', language: 'ar' });

    const answer = (over) => http(200, { ok: true, error: null, mustEscalate: false, appOutcome: { kind: 'could_not_identify' }, verdict: null, message: null, alertId: null, result: {}, ...over });
    let [reply] = await r.code('orchestrator: travel reply (deterministic)', answer({ verdict: 'interaction_found', alertId: 'al-1' }));
    assert.match(reply.json.text, /مراجعة طبية/);
    [reply] = await r.code('orchestrator: travel reply (deterministic)', answer({ verdict: 'cannot_verify' }));
    assert.match(reply.json.text, /ما قدرنا نتأكد من هذا الدواء/);
    [reply] = await r.code('orchestrator: travel reply (deterministic)', http(500, { error: 'internal' }));
    assert.match(reply.json.text, /صار خلل/);
    // a danger the backend refused to accept: ok:false, mustEscalate - never a false all-clear
    [reply] = await r.code('orchestrator: travel reply (deterministic)', answer({ ok: false, mustEscalate: true, error: 'backend_refused_alert_422', verdict: 'interaction_found' }));
    assert.match(reply.json.text, /صار خلل/);
    console.log('        -> danger: ' + (await r.code('orchestrator: travel reply (deterministic)', answer({ verdict: 'interaction_found', alertId: 'al-2' })))[0].json.text);
  });
  await check('a photo classified other -> the fixed explanation, with no further download or model call', async () => {
    const { decided } = await photoClassifiedAs('other', 0.95, relay({ photoFileId: 'AgAC-other' }));
    assert.equal(decided.reason, 'other');
    const wf = WF('agent-telegram-inbound');
    const r2 = runner(wf);
    const [reply] = await r2.code('orchestrator: reply (deterministic)', [{ json: decided }]);
    assert.match(reply.json.text, /ما تبين إنها وصفة طبية ولا علبة دواء/);
    assert.equal(reply.json.buttons, null);
  });
  await check('AP-11: an unsure photo (0.55) asks with two buttons, each callback under 64 bytes, keyed by the message id; or:box resumes it for Travel Check with the SAME file id; a second tap has expired', async () => {
    const payload = relay({ patientId: 'pt-05', messageId: 777, photoFileId: 'AgAC-unsure' });
    const { r, decided } = await photoClassifiedAs('unsure', 0.55, payload);
    assert.equal(decided.reason, 'unsure');
    const [ask] = await r.code('orchestrator: reply (deterministic)', [{ json: decided }]);
    assert.equal(ask.json.buttons.length, 2);
    for (const b of ask.json.buttons) assert.ok(b.data.length <= 64, b.data);
    assert.deepEqual(ask.json.buttons.map((b) => b.data), ['or:rx:777', 'or:box:777']);
    assert.ok(r.staticData.orchestratorPending['pt-05:777'], 'the photo was remembered, keyed by patient id + message id');
    assert.equal(r.staticData.orchestratorPending['pt-05:777'].fileId, 'AgAC-unsure');

    const [routed2] = await r.code('route (deterministic)', relay({ patientId: 'pt-05', kind: 'callback', text: 'or:box:777', callbackQueryId: 'cbq-or-1' }));
    assert.equal(routed2.json.route, 'travel');
    assert.equal(routed2.json.photoFileId, 'AgAC-unsure');
    assert.equal(routed2.json.documentFileId, null);

    const [routed3] = await r.code('route (deterministic)', relay({ patientId: 'pt-05', kind: 'callback', text: 'or:box:777', callbackQueryId: 'cbq-or-2' }));
    assert.equal(routed3.json.route, 'reply');
    assert.equal(routed3.json.reason, 'photo_expired');
  });
  await check('AP-11: a PDF sent as a document is decided prescription from its mime type alone, never asked to the model', async () => {
    const { r } = await photoClassifiedAs('prescription', 1, relay({ patientId: 'pt-03', documentFileId: 'BQAC-pdf' }), 'application/pdf', Buffer.from('%PDF-1.4 fake'));
    assert.equal(r.out['orchestrator: ask what the photo is'][0].json.mimeShortcut, 'prescription');
  });
  await check('AP-11 TC-AD-14 (re-pointed): an ACTIVE caregiver\'s text, tap, photo and document all get a fixed reply via the Orchestrator - no doses GET, no model call, no write, no download, nothing remembered', async () => {
    for (const over of [
      { text: 'أبوي خذ الدوا' },
      { kind: 'callback', text: 'd:rx-1:taken_on_time', callbackQueryId: 'cbq-cg-1' },
      { photoFileId: 'AgAC-cg' },
      { documentFileId: 'BQAC-cg' },
    ]) {
      const r = runner(WF('agent-telegram-inbound'));
      const [routed] = await r.code('route (deterministic)', relay({ subjectType: 'caregiver', subjectId: 'cg-01', patientId: 'pt-01', ...over }));
      assert.equal(routed.json.route, 'reply');
      assert.equal(routed.json.reason, 'caregiver');
      // Since the AP-05 merge the lane runs AP-05's re-check first (cg-01 IS pt-01's active caregiver
      // in RECIPIENTS_BODY); its one read is alert-recipients - never the doses, never a model.
      const [checked] = await r.code('orchestrator: caregiver check (deterministic)', r.set('backend: alert recipients (caregiver reply)', http(200, RECIPIENTS_BODY)));
      assert.equal(checked.json.decision.outcome, 'caregiver_refused');
      const [reply] = await r.code('orchestrator: reply (deterministic)', [checked]);
      assert.match(reply.json.text, /المريض بنفسه/);
      assert.equal(reply.json.buttons, null);
      assert.deepEqual(r.staticData, {}, 'a caregiver message is never remembered, whatever it sends');
    }
  });
  await check('AP-11 (static, by graph walk): from "route (deterministic)", the caregiver/reply path calls no backend and downloads no file; no photo-branch node names /doses/ or /schedule/', () => {
    const wf = WF('agent-telegram-inbound');
    const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
    const reachableFrom = (start, stopAt) => {
      const seen = new Set();
      const stack = [start];
      while (stack.length) {
        const name = stack.pop();
        if (seen.has(name) || stopAt.has(name)) continue;
        seen.add(name);
        for (const kind of Object.values(wf.connections[name] || {})) for (const branch of kind) for (const c of branch) stack.push(c.node);
      }
      return seen;
    };
    const replyPath = reachableFrom('orchestrator: reply (deterministic)', new Set());
    assert.ok(replyPath.has('Telegram: close the photo tap'), 'sanity: the reply path was actually walked');
    for (const name of replyPath) {
      const n = byName[name];
      assert.notEqual(n.type, 'n8n-nodes-base.httpRequest', name + ' calls the backend from the caregiver/reply path');
      if (n.type === 'n8n-nodes-base.telegram') assert.notEqual(n.parameters.resource, 'file', name + ' downloads a file from the caregiver/reply path');
    }
    const photoLane = reachableFrom('photo?', new Set(['Telegram: download the file', 'backend: doses of the day']));
    assert.ok(photoLane.has('n8n: travel check'), 'sanity: the photo lane was actually walked');
    // A quote immediately before the path, exactly like the Alexa call-assertion above: catches an
    // actual string-literal URL, never a prose mention of the adherence API surface in a doc comment
    // (agents/lib/adherence.js's own header, inlined here too since orchestratorReply needs REPLIES).
    for (const name of photoLane) {
      const n = byName[name];
      const text = n.type === 'n8n-nodes-base.code' ? n.parameters.jsCode : JSON.stringify(n.parameters || {});
      assert.ok(!/['"`]\/(doses|schedule)\//.test(text), name + ' names a /doses/ or /schedule/ URL');
    }
  });

  console.log('\n######## agent-telegram-inbound (the AP-05 x AP-11 merge)');
  await check('the caregiver lane (static, by graph walk): fixed reply? -> a caregiver (fixed reply)? -> backend: alert recipients (caregiver reply), a GET and the ONLY call on the lane -> orchestrator: caregiver check (deterministic) -> the fixed reply + AP-05\'s log; nothing on it reaches a dose read, a model, a write, a download, extraction or Travel Check', () => {
    const wf = WF('agent-telegram-inbound');
    const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
    const out = (name, branch) => ((((wf.connections[name] || {}).main || [])[branch]) || []).map((c) => c.node).sort();
    assert.deepEqual(out('fixed reply?', 0), ['a caregiver (fixed reply)?']);
    assert.deepEqual(out('a caregiver (fixed reply)?', 0), ['backend: alert recipients (caregiver reply)']);
    assert.deepEqual(out('a caregiver (fixed reply)?', 1), ['orchestrator: reply (deterministic)'], 'a patient\'s expired tap goes straight to the fixed reply');
    assert.deepEqual(out('backend: alert recipients (caregiver reply)', 0), ['orchestrator: caregiver check (deterministic)']);
    assert.deepEqual(out('orchestrator: caregiver check (deterministic)', 0), ['log: non-active caregiver (deterministic)', 'orchestrator: reply (deterministic)']);
    assert.equal(byName['a caregiver (fixed reply)?'].parameters.conditions.conditions[0].leftValue, "={{ $json.reason === 'caregiver' }}");
    const get = byName['backend: alert recipients (caregiver reply)'];
    assert.equal(get.parameters.method, 'GET');
    assert.equal(get.parameters.url, "={{ $('route (deterministic)').first().json.alertRecipientsUrl }}");
    const lane = new Set();
    const stack = ['backend: alert recipients (caregiver reply)'];
    while (stack.length) {
      const name = stack.pop();
      if (lane.has(name)) continue;
      lane.add(name);
      for (const kind of Object.values(wf.connections[name] || {})) for (const branch of kind) for (const c of branch) stack.push(c.node);
    }
    assert.ok(lane.has('Telegram: orchestrator text') && lane.has('log: non-active caregiver (deterministic)'), 'sanity: the lane was actually walked');
    const never = ['backend: doses of the day', 'backend: active prescriptions', 'needs the model?', 'Gemini: classify the reply', 'decide (deterministic)',
      'backend: write 1', 'backend: write 2 (recompute)', 'Telegram: download the file', 'extraction: build the vision request',
      'orchestrator: download the photo', 'Gemini: what is this photo?', 'Telegram: download for travel check', 'n8n: travel check'];
    for (const name of lane) {
      const n = byName[name];
      assert.ok(!never.includes(name), name + ' is reachable from the caregiver lane');
      if (n.type === 'n8n-nodes-base.httpRequest') assert.equal(name, 'backend: alert recipients (caregiver reply)', name + ' is a second call on the caregiver lane');
      assert.ok(!/langchain/.test(n.type), name + ' is a model node on the caregiver lane');
      if (n.type === 'n8n-nodes-base.telegram') assert.notEqual(n.parameters.resource, 'file', name + ' downloads a file on the caregiver lane');
    }
  });
  await check('the caregiver lane, run: a caregiver PHOTO or DOCUMENT from a chat the re-check cannot confirm gets nothing and one non_active_caregiver log item; from an active caregiver, AP-11\'s own photo line - never downloaded, never classified, never remembered', async () => {
    for (const over of [{ photoFileId: 'AgAC-cg' }, { documentFileId: 'BQAC-cg' }]) {
      const cut = await inbound({ payload: relay({ subjectType: 'caregiver', subjectId: 'cg-99', patientId: 'pt-01', ...over }), recipientsResponse: http(200, RECIPIENTS_BODY) });
      assert.equal(cut.routed.caregiverKind, over.photoFileId ? 'photo' : 'document');
      assert.equal(cut.decision.outcome, 'caregiver_unverified');
      assert.deepEqual(cut.replies, []);
      assert.deepEqual(cut.caregiverLog, [{ patientId: 'pt-01', reason: 'non_active_caregiver' }]);
      const ok = await inbound({ payload: relay({ subjectType: 'caregiver', subjectId: 'cg-01', patientId: 'pt-01', ...over }), recipientsResponse: http(200, RECIPIENTS_BODY) });
      assert.equal(ok.decision.outcome, 'caregiver_refused');
      assert.equal(ok.replies.length, 1);
      assert.match(ok.replies[0].text, /الصور الطبية يرسلها المريض بنفسه/);
      assert.deepEqual(ok.caregiverLog, []);
    }
    // A caregiver item that somehow reached the fixed reply WITHOUT the re-check carries no decision: nothing is sent.
    const r = runner(WF('agent-telegram-inbound'));
    const [routed] = await r.code('route (deterministic)', relay({ subjectType: 'caregiver', subjectId: 'cg-01', patientId: 'pt-01', text: 'أبوي خذ الدوا' }));
    assert.deepEqual(await r.code('orchestrator: reply (deterministic)', [routed]), []);
  });
  await check('AP-05 step 3c across the merge: EVERY Telegram send in agent-telegram-inbound (AP-05\'s three and AP-11\'s three) fans out to its own "log: failed Telegram send (...)", which names it; a failed orchestrator send logs one item, never a chat id or the text', async () => {
    const wf = WF('agent-telegram-inbound');
    const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
    const sends = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.telegram' && !n.parameters.resource).map((n) => n.name).sort();
    assert.deepEqual(sends, ['Telegram: extraction reply', 'Telegram: orchestrator choice', 'Telegram: orchestrator text', 'Telegram: reply', 'Telegram: reply with buttons', 'Telegram: travel reply']);
    for (const send of sends) {
      const logs = ((wf.connections[send] || {}).main || [[]])[0].map((c) => byName[c.node]).filter((n) => n && /^log: failed Telegram send \(/.test(n.name));
      assert.equal(logs.length, 1, send + ' has no failed-send log');
      assert.ok(logs[0].parameters.jsCode.includes('node: ' + JSON.stringify(send)), logs[0].name + ' does not name ' + send);
    }
    const r = runner(wf);
    const log = await r.code('log: failed Telegram send (orchestrator text)', [{ json: { error: { message: 'Forbidden: bot was blocked by the user' } } }]);
    assert.deepEqual(log.map((x) => x.json), [{ node: 'Telegram: orchestrator text', doseId: null, error: 'Forbidden: bot was blocked by the user' }]);
    assert.deepEqual(await r.code('log: failed Telegram send (travel reply)', [{ json: { chatId: '1', text: 'hi' } }]), []);
  });

  console.log('\n######## agent-telegram-inbound x agent-travel-check (the AP-11b merge)');
  await check('both packages\' generated nodes, end to end: a medicine box from Telegram reaches agent-travel-check; an UNVERIFIED SFDA brand (MAREVAN) answers cannot_verify/brand_not_verified and the patient reads the "cannot verify" line; a profile outage answers cannot_verify/profile_unavailable with ok:false and the patient reads the failure line - never an all-clear', async () => {
    const travel = JSON.parse(fs.readFileSync(path.join(ROOT, 'knowledge', 'workflows', 'agent-travel-check.json'), 'ascii'));
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    const boxName = (text) => http(200, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
    const cases = [
      { box: 'MAREVAN', profile: http(200, { prescriptions: [] }), reason: 'brand_not_verified', ok: true, reads: /ما قدرنا نتأكد من هذا الدواء مقابل أدويتك/ },
      { box: 'Ezetimibe', profile: http(503, { error: 'unavailable' }), reason: 'profile_unavailable', ok: false, reads: /صار خلل عندنا/ },
    ];
    for (const c of cases) {
      const { r } = await photoClassifiedAs('medicine_package', 0.9, relay({ patientId: 'pt-03', photoFileId: 'AgAC-' + c.box }), 'image/png', png);
      const [req] = await r.code('orchestrator: build the travel request', [{ json: {}, binary: { data: { mimeType: 'image/png' } } }], png);
      const t = runner(travel);
      const [input] = await t.code('input (deterministic)', [{ json: { body: req.json.travelBody } }]);
      assert.equal(input.json.valid, true, JSON.stringify(input.json));
      t.set('backend: active prescriptions', c.profile);
      const [checked] = await t.code('check (deterministic)', t.set('Gemini: read the name on the box', boxName(c.box)));
      assert.equal(checked.json.post, false);
      assert.equal(checked.json.result.verdict, 'cannot_verify');
      assert.equal(checked.json.result.reason, c.reason);
      const [answer] = await t.code('answer (deterministic)', [checked]);
      assert.equal(answer.json.ok, c.ok);
      assert.deepEqual(answer.json.appOutcome, { kind: 'cannot_verify' });
      const [reply] = await r.code('orchestrator: travel reply (deterministic)', http(200, answer.json));
      assert.match(reply.json.text, c.reads);
      assert.equal(reply.json.log.verdict, 'cannot_verify');
      console.log('        -> ' + c.box + ' (' + c.reason + '): ' + reply.json.text);
    }
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
  await check('TC-AD-08: an eligible patient without a chat id, or with nothing open, or a refused doses fetch -> no message and exactly one log item each; a real day is never logged; the log still runs when the plan is empty', async () => {
    const eligibility = [
      { patientId: 'pt-01', chatId: null, language: 'ar', frequency: 'daily' }, // no chat id (plan-time skip)
      { patientId: 'pt-02', chatId: '5550002', language: 'ar', frequency: 'daily' }, // nothing open
      { patientId: 'pt-04', chatId: '5550004', language: 'ar', frequency: 'daily' }, // refused fetch
      { patientId: 'pt-03', chatId: '5550001', language: 'ar', frequency: 'daily' }, // a real day - never logged
    ];
    const r = runner(WF('agent-checkin-daily'));
    r.set('backend: who is eligible', http(200, eligibility));
    r.set('backend: doses of the day', [
      { json: { statusCode: 200, body: { doses: [] } } },
      { json: { statusCode: 503, body: {} } },
      { json: { statusCode: 200, body: DAY } },
    ]);
    const log = await r.code('log: skipped patients (deterministic)', [{ json: {} }]);
    assert.deepEqual(log.map((x) => x.json), [
      { patientId: 'pt-01', reason: 'no_chat_id' },
      { patientId: 'pt-02', reason: 'no_open_doses' },
      { patientId: 'pt-04', reason: 'doses_fetch_refused' },
    ]);
    assert.ok(!JSON.stringify(log).includes('chatId'));
    // The plan is empty (nobody survives) -> 'backend: doses of the day' never runs, and the log still does.
    const r2 = runner(WF('agent-checkin-daily'));
    r2.set('backend: who is eligible', http(200, [{ patientId: 'pt-05', chatId: null, language: 'ar', frequency: 'daily' }]));
    const log2 = await r2.code('log: skipped patients (deterministic)', [{ json: {} }]);
    assert.deepEqual(log2.map((x) => x.json), [{ patientId: 'pt-05', reason: 'no_chat_id' }]);
  });
  await check('AP-05: the named log nodes exist in both workflows and are wired from a node that always runs; agent-checkin-daily makes no POST and no call whose URL contains /doses/ or /schedule/', () => {
    const in_ = WF('agent-telegram-inbound');
    const inNames = in_.nodes.map((n) => n.name);
    for (const name of ['log: non-active caregiver (deterministic)', 'log: failed Telegram send (buttons)', 'log: failed Telegram send (text)', 'log: failed Telegram send (extraction reply)']) {
      assert.ok(inNames.includes(name), name + ' is missing from agent-telegram-inbound');
    }
    const wired = (conns, from, to) => (conns[from].main[0] || []).some((c) => c.node === to);
    assert.ok(wired(in_.connections, 'decide (deterministic)', 'log: non-active caregiver (deterministic)'));
    assert.ok(wired(in_.connections, 'Telegram: reply with buttons', 'log: failed Telegram send (buttons)'));
    assert.ok(wired(in_.connections, 'Telegram: reply', 'log: failed Telegram send (text)'));
    assert.ok(wired(in_.connections, 'Telegram: extraction reply', 'log: failed Telegram send (extraction reply)'));

    const ck = WF('agent-checkin-daily');
    const ckNames = ck.nodes.map((n) => n.name);
    for (const name of ['log: skipped patients (deterministic)', 'log: failed Telegram send (buttons)', 'log: failed Telegram send (header)']) {
      assert.ok(ckNames.includes(name), name + ' is missing from agent-checkin-daily');
    }
    assert.ok(wired(ck.connections, 'backend: who is eligible', 'log: skipped patients (deterministic)'));
    assert.ok(wired(ck.connections, 'Telegram: dose with buttons', 'log: failed Telegram send (buttons)'));
    assert.ok(wired(ck.connections, 'Telegram: header', 'log: failed Telegram send (header)'));
    const httpNodes = ck.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest');
    assert.ok(httpNodes.length > 0);
    for (const n of httpNodes) {
      assert.equal(n.parameters.method, 'GET', n.name + ' is not a GET - agent-checkin-daily only ever reads and sends Telegram messages');
      assert.ok(!/\/(doses|schedule)\//.test(JSON.stringify(n.parameters)), n.name + ' names a /doses/ or /schedule/ URL');
    }
  });

}

/** The node types agent-alexa may hold. Any other (an Execute Workflow node, an HTTP tool, ...) could call out. */
const ALEXA_NODE_TYPES = [
  'n8n-nodes-base.webhook', 'n8n-nodes-base.code', 'n8n-nodes-base.if', 'n8n-nodes-base.httpRequest',
  'n8n-nodes-base.respondToWebhook', 'n8n-nodes-base.telegram',
  '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', '@n8n/n8n-nodes-langchain.outputParserStructured', '@n8n/n8n-nodes-langchain.chainLlm',
];
/** Exactly these three calls, and no other: two reads and the CR-069 screen turn. */
const ALEXA_CALLS = [
  { name: 'backend: doses of the day', method: 'GET', url: (u) => u === '={{ $json.dosesUrl }}' },
  { name: 'backend: who is eligible', method: 'GET', url: (u) => /^https:\/\/[^\s{}$]+\/api\/agent\/check-in-eligibility$/.test(u) },
  { name: 'backend: voice turn for the screen', method: 'POST', url: (u) => u === "={{ $('alexa request (deterministic)').first().json.voiceTurnUrl }}",
    body: "={{ JSON.stringify($('speak (deterministic)').first().json.screen) }}" },
];
/** The two dose-writing route families: POST /doses/{id}/status and POST /schedule/recompute. */
const WRITE_PATH = /\/(doses|schedule)\//;
const ALEXA_CONFIG_LINE = "const ALEXA_SKILL_ID = '';\nconst ALEXA_LINKS = {};";

/** The committed workflow as the live node holds it: the skill id and the device link set. */
function configureAlexa(wf, skill, links) {
  const copy = JSON.parse(JSON.stringify(wf));
  const n = copy.nodes.find((x) => x.name === 'alexa request (deterministic)');
  assert.ok(n && n.parameters.jsCode.includes(ALEXA_CONFIG_LINE), 'the parse node no longer ships the empty skill id and link table');
  n.parameters.jsCode = n.parameters.jsCode.replace(ALEXA_CONFIG_LINE,
    'const ALEXA_SKILL_ID = ' + JSON.stringify(skill) + ';\nconst ALEXA_LINKS = ' + JSON.stringify(links) + ';');
  return copy;
}

/**
 * AP-02 (CR-073) - what agent-alexa may call: exactly two GETs (the doses of the day, who is eligible)
 * and the one CR-069 voice-turn POST, and no call whose URL contains /doses/ or /schedule/ - neither
 * written in an HTTP node nor built by the Code node that feeds one. Throws on the first breach.
 * alexaScenarios runs it on the committed workflow, and on copies edited to break it (each must throw).
 * Runtime proof: J12 (AP-14): Mohammad says "mark it taken" to the Echo and no dose_status_recorded audit row follows (docs/backend-notes/ap-16.md).
 */
async function assertVoiceCallsReadOnly(wf) {
  for (const n of wf.nodes) assert.ok(ALEXA_NODE_TYPES.includes(n.type), 'a node type that could call out: ' + n.name + ' (' + n.type + ')');
  const httpNodes = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest');
  assert.deepEqual(httpNodes.map((n) => n.name).sort(), ALEXA_CALLS.map((c) => c.name).sort(), 'agent-alexa must make exactly the two GETs and the voice-turn POST');
  for (const c of ALEXA_CALLS) {
    const n = httpNodes.find((x) => x.name === c.name);
    assert.equal(n.parameters.method, c.method, c.name + ': method');
    assert.ok(c.url(n.parameters.url), c.name + ' calls ' + n.parameters.url);
    assert.equal(n.parameters.jsonBody, c.body, c.name + ': body');
    assert.ok(!WRITE_PATH.test(JSON.stringify(n.parameters)), c.name + ' names a /doses/ or /schedule/ URL');
  }
  for (const n of wf.nodes.filter((x) => x.type === 'n8n-nodes-base.code')) {
    const src = n.parameters.jsCode;
    assert.ok(!/helpers\.httpRequest|\bfetch\s*\(|XMLHttpRequest/.test(src), n.name + ' makes its own network call');
    assert.ok(!/['"`]\/(doses|schedule)\//.test(src), n.name + ' builds a /doses/ or /schedule/ URL');
    assert.ok(!/VOICE_RECORDS/.test(src), n.name + ' carries the CR-070 recording switch');
  }
  // The URLs the parse node hands the two expression-driven calls, as they resolve on a linked request.
  const r = runner(configureAlexa(wf, 'amzn1.ask.skill.calls', { 'amzn1.ask.account.CALLS': 'pt-03' }));
  const [p] = await r.code('alexa request (deterministic)', [{ json: { body: {
    version: '1.0', session: { application: { applicationId: 'amzn1.ask.skill.calls' }, user: { userId: 'amzn1.ask.account.CALLS' } },
    request: { type: 'IntentRequest', locale: 'en-US', timestamp: new Date().toISOString(), intent: { name: 'TodayDosesIntent' } } } } }]);
  assert.match(String(p.json.dosesUrl), /\/api\/agent\/patients\/pt-03\/doses\?date=\d{4}-\d{2}-\d{2}$/, 'the doses GET resolves to ' + p.json.dosesUrl);
  assert.match(String(p.json.voiceTurnUrl), /\/api\/agent\/patients\/pt-03\/voice-turns$/, 'the voice-turn POST resolves to ' + p.json.voiceTurnUrl);
}

/** agent-alexa, walked as its connections run. `configure` stands in for setting the skill id and
 * the device link inside the live n8n node - the committed workflow ships both EMPTY. */
async function alexaScenarios() {
  console.log('\n######## agent-alexa (voice, read-only)');
  const SKILL = 'amzn1.ask.skill.check';
  const USER = 'amzn1.ask.account.CHECKUSER';
  const wf = WF('agent-alexa');
  const configure = (skill, links) => configureAlexa(wf, skill, links);
  const linked = configure(SKILL, { [USER]: 'pt-03' });
  const body = (type, intent, locale = 'ar-SA', { utterance, attributes } = {}) => [{ json: { body: {
    version: '1.0', session: { application: { applicationId: SKILL }, user: { userId: USER }, ...(attributes ? { attributes } : {}) },
    request: { type, locale, timestamp: new Date().toISOString(),
      ...(intent ? { intent: { name: intent, ...(utterance ? { slots: { utterance: { name: 'utterance', value: utterance } } } : {}) } } : {}) } } } }];
  const today = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  const doseAt = (id, rx, hhmm, brand) => ({ ...dose(id, rx, hhmm, OPEN, brand), scheduledAt: today + 'T' + hhmm + ':00+03:00' });
  // One dose already passed (00:05) and one still ahead (23:55), whatever the clock says.
  const DAYDOSES = [doseAt('rx-008-x-0005', 'rx-008', '00:05', 'Eltroxin'), doseAt('rx-009-x-2355', 'rx-009', '23:55')];
  // For a record request, relative to now: Eltroxin two hours ago (due), calcium in three hours (not due).
  const nowMs = Date.now();
  const relDose = (id, rx, hours, brand, word = OPEN) => ({ ...dose(id, rx, '00:00', word, brand), scheduledAt: new Date(nowMs + hours * 3600 * 1000).toISOString() });
  const RECDAY = (word = OPEN) => [relDose('rx-008-rec-a', 'rx-008', -2, 'Eltroxin', word), relDose('rx-009-rec-b', 'rx-009', 3, null, word)];
  const ELIG = http(200, [{ patientId: 'pt-03', chatId: '5550001', language: 'ar', frequency: 'daily' }]);
  // Walked as the connections run: parse -> (Gemini, for free talk) -> intent -> (the two reads) -> speak -> Telegram / screen.
  // `calls` is every HTTP call the walk makes, with its resolved URL: the runtime side of assertVoiceCallsReadOnly.
  const walk = async (w, input, { doses = http(200, { doses: DAYDOSES }), elig = ELIG, model = null } = {}) => {
    const r = runner(w);
    const eligUrl = w.nodes.find((n) => n.name === 'backend: who is eligible').parameters.url;
    const calls = [];
    const [p] = await r.code('alexa request (deterministic)', input);
    let toIntent = [p];
    if (p.json.ok && p.json.kind === 'FreeTalkIntent' && p.json.utterance && !p.json.quick) toIntent = r.set('Gemini: understand the sentence', [{ json: { output: model } }]);
    const [q] = await r.code('voice intent (deterministic)', toIntent);
    if (q.json.ok && q.json.needsDoses) {
      calls.push({ method: 'GET', url: q.json.dosesUrl });
      r.set('backend: doses of the day', doses);
      calls.push({ method: 'GET', url: eligUrl });
      r.set('backend: who is eligible', elig);
    }
    const [s] = await r.code('speak (deterministic)', [{ json: {} }]);
    if (s.json.screen !== null) calls.push({ method: 'POST', url: p.json.voiceTurnUrl });
    const prompts = s.json.prompts.length ? await r.code('telegram prompt (deterministic)', [{ json: {} }]) : [];
    return { parsed: p.json, intent: q.json, spoken: s.json, prompts: prompts.map((x) => x.json), calls };
  };
  /** Every call a walk made is one of the three allowed, and none is a dose write. */
  const readOnly = (s) => {
    for (const c of s.calls) {
      assert.ok(!WRITE_PATH.test(c.url), 'a dose write: ' + c.method + ' ' + c.url);
      assert.ok((c.method === 'GET' && (/\/patients\/pt-03\/doses\?date=\d{4}-\d{2}-\d{2}$/.test(c.url) || /\/check-in-eligibility$/.test(c.url)))
        || (c.method === 'POST' && /\/patients\/pt-03\/voice-turns$/.test(c.url)), 'not an allowed call: ' + c.method + ' ' + c.url);
    }
  };
  const text = (s) => s.spoken.alexa.response.outputSpeech.text;
  const buttonData = (s) => s.prompts.slice(1).map((m) => m.buttons.map((b) => b.data));
  const EN_SENT = 'I can\'t record by voice; I\'ve sent the buttons to your Telegram. Please confirm there yourself.';
  const AR_SENT = 'ما أقدر أسجّل بالصوت، أرسلت لك الأزرار في تيليقرام. أكّد منها بنفسك.';

  await check('the COMMITTED workflow ships no skill id and no link -> every request refused, nothing read', async () => {
    const parse = wf.nodes.find((x) => x.name === 'alexa request (deterministic)').parameters.jsCode;
    assert.ok(parse.includes(ALEXA_CONFIG_LINE), 'ALEXA_SKILL_ID = \'\' and ALEXA_LINKS = {} (the lead re-enters the live values at publish)');
    const s = await walk(wf, body('IntentRequest', 'NextDoseIntent'));
    assert.equal(s.parsed.ok, false);
    assert.equal(s.parsed.dosesUrl, null);
    assert.equal(s.spoken.refused, true);
    assert.deepEqual(s.calls, []);
  });
  await check('an unlinked device is told so, and its userId is in the execution log for linking', async () => {
    const s = await walk(configure(SKILL, {}), body('LaunchRequest'));
    assert.match(text(s), /مو مربوط/);
    assert.equal(s.spoken.log.userId, USER);
  });
  await check('CR-106: "Alexa, ask medicine helper" -> the greeting alone, in each language; the session stays open with the same reprompt; nothing read', async () => {
    for (const [locale, language, greeting, reprompt] of [
      ['ar-SA', 'ar', 'هلا، معك جرعة AI. شلون أقدر أساعدك؟', 'شنو تبي تعرف عن أدويتك؟'],
      ['en-US', 'en', 'Hi, Jur\'ah AI. How can I help?', 'What would you like to know about your medicines?'],
    ]) {
      const s = await walk(linked, body('LaunchRequest', null, locale));
      assert.equal(text(s), greeting);
      assert.equal(s.spoken.alexa.response.shouldEndSession, false);
      assert.equal(s.spoken.alexa.response.reprompt.outputSpeech.text, reprompt);
      assert.equal(s.intent.needsDoses, false);
      assert.deepEqual(s.calls.map((c) => c.method), ['POST']); // only the screen turn
      assert.deepEqual([s.spoken.screen.topic, s.spoken.screen.language, s.spoken.screen.reply], ['launch', language, greeting]);
      assert.deepEqual(s.prompts, []);
      readOnly(s);
      console.log('        -> ' + text(s));
    }
  });
  await check('«شنو جرعتي الجاية» -> the next OPEN dose, spoken in Arabic, session stays open', async () => {
    const s = await walk(linked, body('IntentRequest', 'NextDoseIntent'));
    assert.match(s.parsed.dosesUrl, /\/api\/agent\/patients\/pt-03\/doses\?date=\d{4}-\d{2}-\d{2}$/);
    assert.match(text(s), /^جرعتك الجاية Calcium carbonate \+ vitamin D3 الساعة 11 و55 دقيقة بالليل/);
    assert.equal(s.spoken.alexa.response.shouldEndSession, false);
    assert.deepEqual(s.prompts, []);
    readOnly(s);
    console.log('        -> ' + text(s));
  });
  await check('«نسيت دواي» -> names the passed dose, records nothing, sends ITS buttons to the patient’s own chat', async () => {
    const s = await walk(linked, body('IntentRequest', 'ForgotDoseIntent'));
    assert.match(text(s), /Eltroxin الساعة 12 و5 دقيقة بالليل/);
    assert.match(text(s), /ما سجّلت شي بالصوت/);
    assert.equal(s.prompts.length, 2);
    assert.equal(s.prompts[0].chatId, '5550001');
    assert.deepEqual(buttonData(s), [['d:rx-008-x-0005:taken_on_time', 'd:rx-008-x-0005:taken_late', 'd:rx-008-x-0005:missed']]);
    readOnly(s);
    console.log('        -> ' + text(s));
  });
  await check('"what is my next dose" in en-US -> English', async () => {
    const s = await walk(linked, body('IntentRequest', 'NextDoseIntent', 'en-US'));
    assert.match(text(s), /^Your next dose is Calcium carbonate \+ vitamin D3 at 11:55 in the evening/);
  });
  await check('the backend refused (401) -> an honest failure, no schedule invented, no prompt', async () => {
    const s = await walk(linked, body('IntentRequest', 'ForgotDoseIntent'), { doses: http(401, { error: 'unauthorized' }) });
    assert.match(text(s), /ما قدرت أوصل لجدولك/);
    assert.deepEqual(s.prompts, []);
  });
  await check('CR-069: a linked turn tells the patient\'s screen its topic and the words just spoken; refused / unlinked / a closed session tell it nothing', async () => {
    let s = await walk(linked, body('IntentRequest', 'TodayDosesIntent'));
    assert.match(s.parsed.voiceTurnUrl, /\/api\/agent\/patients\/pt-03\/voice-turns$/);
    assert.deepEqual(Object.keys(s.spoken.screen).sort(), ['language', 'reply', 'topic']);
    assert.equal(s.spoken.screen.topic, 'today');
    assert.equal(s.spoken.screen.reply, text(s));
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
  await check('"Alexa, ask medicine helper what are my medicines today" -> today\'s schedule with each status, in code (no model), the screen to «اليوم»; never the record path; only the two GETs and the screen POST', async () => {
    const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'alexa', 'interaction-model.en-US.json'), 'utf8')).interactionModel.languageModel.intents;
    const ar = JSON.parse(fs.readFileSync(path.join(ROOT, 'alexa', 'interaction-model.ar-SA.json'), 'utf8')).interactionModel.languageModel.intents;
    const enToday = en.find((i) => i.name === 'TodayDosesIntent').samples;
    const arToday = ar.find((i) => i.name === 'TodayDosesIntent').samples;
    const arNext = ar.find((i) => i.name === 'NextDoseIntent').samples;
    for (const s of ['what are my medicines today', 'what medicines do I take today', 'what are my meds today', 'which medicines today']) assert.ok(enToday.includes(s), 'en-US TodayDosesIntent sample: ' + s);
    for (const s of ['شنو أدويتي اليوم', 'وش أدويتي اليوم']) assert.ok(arToday.includes(s), 'ar-SA TodayDosesIntent sample: ' + s);
    // CR-071 (viii): the two Fusha samples, alongside the dialect ones above - no «؟» in a slot sample.
    assert.ok(arToday.includes('ماذا في جدول أدويتي اليوم'), 'ar-SA TodayDosesIntent Fusha sample (CR-071 viii)');
    assert.ok(arNext.includes('متى الجرعة القادمة'), 'ar-SA NextDoseIntent Fusha sample (CR-071 viii)');
    for (const s of ['ماذا في جدول أدويتي اليوم', 'متى الجرعة القادمة']) assert.ok(!s.includes('؟'), 'no «؟» in an Alexa slot sample: ' + s);
    // Spoken as a sample (TodayDosesIntent), or caught by free talk's "what {utterance}" carrier - both the same answer.
    const bySample = await walk(linked, body('IntentRequest', 'TodayDosesIntent', 'en-US'));
    const byFree = await walk(linked, body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'are my medicines today' }), { model: { intent: 'record', confidence: 0.99, items: [] } });
    for (const s of [bySample, byFree]) {
      assert.equal(s.intent.kind, 'TodayDosesIntent');
      assert.match(text(s), /^Today you have 2 doses: 12:05 in the morning Eltroxin, still open\./);
      assert.equal(s.spoken.screen.topic, 'today');
      assert.deepEqual(s.prompts, [], 'no Telegram buttons: nothing to record');
      assert.deepEqual(s.calls.map((c) => c.method), ['GET', 'GET', 'POST']);
      readOnly(s);
    }
    assert.equal(byFree.parsed.quick, 'TodayDosesIntent', 'answered in code: the model node does not run');
    const arS = await walk(linked, body('IntentRequest', 'TodayDosesIntent', 'ar-SA'));
    assert.match(text(arS), /^عندك اليوم 2 جرعات: /);
    assert.equal(arS.spoken.screen.topic, 'today');
    readOnly(arS);
    console.log('        -> ' + text(bySample));
  });
  await check('CR-070 free talk: the sentence goes to Gemini, and its intent is answered from the data ("check my medicines" -> today)', async () => {
    const s = await walk(linked, body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'my medicines for today' }), { model: { intent: 'today', confidence: 0.9 } });
    assert.equal(s.intent.kind, 'TodayDosesIntent');
    assert.match(text(s), /^Today you have 2 doses: 12:05 in the morning Eltroxin, still open\./);
    assert.equal(s.spoken.screen.topic, 'today');
    const u = await walk(linked, body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'what is the weather' }), { model: { intent: 'unclear', confidence: 0.9 } });
    assert.equal(u.intent.kind, 'AMAZON.FallbackIntent');
    assert.equal(u.spoken.screen.topic, 'unclear');
    const failed = await walk(linked, body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'x y z' }), { model: null });
    assert.equal(failed.intent.kind, 'AMAZON.FallbackIntent'); // the model failed -> unclear, never a guess
  });

  // ---- AP-02 (CR-073): voice records nothing. A record request gets the fixed line, and the buttons.
  await check('AP-02 TC-AD-15: "mark it taken" (en-US) -> "I can\'t record by voice; I\'ve sent the buttons to your Telegram"; nothing written; the due dose\'s buttons go to the patient\'s own chat', async () => {
    const s = await walk(linked, body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'it taken' }), { doses: http(200, { doses: RECDAY() }), model: { intent: 'record', confidence: 0.95, items: [] } });
    assert.equal(s.intent.kind, 'record');
    assert.equal(text(s), EN_SENT);
    assert.equal(s.spoken.alexa.response.shouldEndSession, true);
    assert.ok(!('sessionAttributes' in s.spoken.alexa), 'no list is carried to a "yes"');
    assert.deepEqual([s.prompts[0].chatId, s.prompts[0].buttons], ['5550001', null]);
    assert.deepEqual(buttonData(s), [['d:rx-008-rec-a:taken_on_time', 'd:rx-008-rec-a:taken_late', 'd:rx-008-rec-a:missed']]); // calcium is 3 h ahead: not due
    assert.deepEqual(s.calls.map((c) => c.method), ['GET', 'GET', 'POST']);
    readOnly(s);
    assert.deepEqual([s.spoken.screen.topic, s.spoken.screen.reply], ['record', EN_SENT]);
    console.log('        -> ' + text(s) + ' | Telegram: ' + s.prompts[0].text + ' / ' + s.prompts[1].text);
  });
  await check('AP-02 TC-AD-15: "I took the first two and missed the third" (en-US) -> the fixed line; buttons only for the named dose that is due; nothing written', async () => {
    const items = [{ position: 1, status: W_ON }, { position: 2, status: W_ON }, { position: 3, status: W_MISS }];
    const s = await walk(linked, body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'took the first two and missed the third' }), { doses: http(200, { doses: RECDAY() }), model: { intent: 'record', confidence: 0.95, items } });
    assert.equal(text(s), EN_SENT);
    assert.deepEqual(buttonData(s).map((b) => b[0]), ['d:rx-008-rec-a:taken_on_time']);
    readOnly(s);
  });
  await check('AP-02: the voice-actions code path in Arabic (a FreeTalkIntent with locale ar-SA; the ar-SA skill cannot send one - its spoken path is RecordDoseIntent, next) -> «ما أقدر أسجّل بالصوت، أرسلت لك الأزرار في تيليقرام»; the header and buttons in Arabic; nothing written', async () => {
    const items = [{ position: 1, status: W_ON }, { position: 2, status: W_ON }, { position: 3, status: W_MISS }];
    const s = await walk(linked, body('IntentRequest', 'FreeTalkIntent', 'ar-SA', { utterance: 'خذيت الأولى والثانية وفاتتني الثالثة' }), { doses: http(200, { doses: RECDAY() }), model: { intent: 'record', confidence: 0.93, items } });
    assert.equal(text(s), AR_SENT);
    assert.match(s.prompts[0].text, /^من أليكسا/);
    assert.deepEqual(s.prompts[1].buttons.map((b) => b.text), ['أخذته ✅', 'أخذته متأخر ⏰', 'نسيت ✖']);
    readOnly(s);
    console.log('        -> ' + text(s));
  });
  await check('AP-02 TC-AD-15 (ar-SA, spoken): «سجل الجرعة» and «خذيت الأولى والثانية وفاتتني الثالثة» are samples of the ar-SA RecordDoseIntent; that intent -> «ما أقدر أسجّل بالصوت، أرسلت لك الأزرار في تيليقرام»; no model call; the due dose\x27s buttons in Arabic; nothing written', async () => {
    const ar = JSON.parse(fs.readFileSync(path.join(ROOT, 'alexa', 'interaction-model.ar-SA.json'), 'utf8')).interactionModel.languageModel.intents;
    const rec = ar.find((i) => i.name === 'RecordDoseIntent');
    assert.ok(rec, 'the ar-SA interaction model has a RecordDoseIntent');
    assert.deepEqual(rec.slots, [], 'slotless: no dose is named, so no model is needed');
    for (const sample of ['سجل الجرعة', 'خذيت دواي', 'خذيت الأولى والثانية وفاتتني الثالثة']) assert.ok(rec.samples.includes(sample), sample + ' is a RecordDoseIntent sample');
    assert.ok(!ar.some((i) => i.name === 'FreeTalkIntent'), 'the ar-SA skill has no free talk');
    const s = await walk(linked, body('IntentRequest', 'RecordDoseIntent', 'ar-SA'), { doses: http(200, { doses: RECDAY() }), model: { intent: 'unclear', confidence: 1 } });
    assert.equal(s.intent.kind, 'record');
    assert.equal(text(s), AR_SENT);
    assert.equal(s.spoken.alexa.response.shouldEndSession, true);
    assert.match(s.prompts[0].text, /^من أليكسا/);
    assert.deepEqual(s.prompts[1].buttons.map((b) => b.text), ['أخذته ✅', 'أخذته متأخر ⏰', 'نسيت ✖']);
    assert.deepEqual(buttonData(s), [['d:rx-008-rec-a:taken_on_time', 'd:rx-008-rec-a:taken_late', 'd:rx-008-rec-a:missed']]);
    assert.deepEqual(s.calls.map((c) => c.method), ['GET', 'GET', 'POST']);
    readOnly(s);
    assert.deepEqual([s.spoken.screen.topic, s.spoken.screen.reply], ['record', AR_SENT]);
    console.log('        -> ' + text(s) + ' | Telegram: ' + s.prompts[0].text);
  });
  await check('AP-02: every intent in both committed interaction models, walked, makes only the allowed calls and writes nothing', async () => {
    const seen = [];
    for (const locale of ['ar-SA', 'en-US']) {
      const intents = JSON.parse(fs.readFileSync(path.join(ROOT, 'alexa', 'interaction-model.' + locale + '.json'), 'utf8')).interactionModel.languageModel.intents;
      assert.ok(intents.length >= 5, locale + ' model read');
      for (const i of intents) {
        const s = await walk(linked, body('IntentRequest', i.name, locale, i.name === 'FreeTalkIntent' ? { utterance: 'mark it taken' } : {}), { doses: http(200, { doses: RECDAY() }), model: { intent: 'record', confidence: 0.95, items: [] } });
        readOnly(s);
        seen.push(locale + ':' + i.name);
      }
    }
    assert.ok(seen.includes('ar-SA:RecordDoseIntent') && seen.includes('en-US:FreeTalkIntent'), seen.join(', '));
  });
  await check('AP-02: the model gave no answer (outage) to "mark it taken" -> still the fixed line and the buttons, never a guess and never a write', async () => {
    const s = await walk(linked, body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'it taken' }), { doses: http(200, { doses: RECDAY() }), model: null });
    assert.equal(s.intent.kind, 'record');
    assert.equal(text(s), EN_SENT);
    assert.equal(buttonData(s).length, 1);
    readOnly(s);
  });
  await check('AP-02: a record request with no Telegram linked, with nothing open, or with the schedule unreachable -> it says so, sends nothing, writes nothing', async () => {
    const say = { model: { intent: 'record', confidence: 0.95, items: [] } };
    const noChat = await walk(linked, body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'it taken' }), { ...say, doses: http(200, { doses: RECDAY() }), elig: http(200, []) });
    assert.match(text(noChat), /^I can't record by voice, and your Telegram is not linked/);
    assert.deepEqual(noChat.prompts, []);
    const allDone = await walk(linked, body('IntentRequest', 'FreeTalkIntent', 'en-US', { utterance: 'it taken' }), { ...say, doses: http(200, { doses: RECDAY(W_ON) }) });
    assert.match(text(allDone), /^I can't record by voice, and there is no open dose due now/);
    assert.equal(allDone.spoken.alexa.response.shouldEndSession, false);
    assert.deepEqual(allDone.prompts, []);
    const down = await walk(linked, body('IntentRequest', 'FreeTalkIntent', 'ar-SA', { utterance: 'it taken' }), { ...say, doses: http(503, { error: 'unavailable' }) });
    assert.match(text(down), /^ما أقدر أسجّل بالصوت، وما قدرت أوصل لجدولك/);
    assert.deepEqual(down.prompts, []);
    for (const s of [noChat, allDone, down]) readOnly(s);
  });
  await check('AP-02: a CR-070 "yes" replayed with a pending list in the session -> nothing read, nothing written, no list carried on; "no" just says goodbye', async () => {
    const pending = [{ doseId: 'rx-008-x-0005', prescriptionId: 'rx-008', status: W_MISS }];
    const y = await walk(linked, body('IntentRequest', 'AMAZON.YesIntent', 'en-US', { attributes: { pending } }));
    assert.equal(y.intent.needsDoses, false);
    assert.deepEqual(y.calls.map((c) => c.method), ['POST']); // only the screen turn
    assert.match(text(y), /^Ask me: what is my next dose/);
    assert.ok(!('sessionAttributes' in y.spoken.alexa));
    assert.equal(y.spoken.screen.topic, 'unclear');
    assert.deepEqual(y.prompts, []);
    readOnly(y);
    const n = await walk(linked, body('IntentRequest', 'AMAZON.NoIntent', 'en-US', { attributes: { pending } }));
    assert.equal(n.spoken.alexa.response.shouldEndSession, true);
    assert.deepEqual(n.calls.map((c) => c.method), ['POST']);
  });

  // ---- AP-02: the call assertion, on the committed workflow and on copies edited to break it.
  await check('AP-02 (CR-073): agent-alexa makes exactly two GETs (doses of the day, who is eligible) and the one voice-turn POST; no call names /doses/ or /schedule/; the CR-070 write nodes are gone', async () => {
    await assertVoiceCallsReadOnly(wf);
    const names = wf.nodes.map((n) => n.name);
    for (const gone of ['plan (deterministic)', 'record now?', 'one item per write (deterministic)', 'backend: record the status',
      'recomputes (deterministic)', 'any recompute?', 'one item per recompute (deterministic)', 'backend: recompute']) assert.ok(!names.includes(gone), gone + ' is still in the workflow');
  });
  const CR070_WRITE = (name) => ({ parameters: { method: 'POST', url: '={{ $json.url }}', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}', options: {} }, id: 'b4000000-0000-4000-8000-0000000000ff', name,
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [0, 0] });
  const node = (copy, name) => copy.nodes.find((x) => x.name === name);
  const PARSE = 'alexa request (deterministic)';
  /** Edit one Code node's source; the edit must land, or the proof proves nothing. */
  const replaceIn = (c, name, from, to) => { const n = node(c, name); assert.ok(n.parameters.jsCode.includes(from), name + ' no longer holds ' + from); n.parameters.jsCode = n.parameters.jsCode.replace(from, to); };
  const DOSES_URL = "API + '/patients/' + encodeURIComponent(p.patientId) + '/doses?date=' + date";
  const EDITS = [
    ['re-add CR-070\'s "backend: record the status" POST', (c) => c.nodes.push(CR070_WRITE('backend: record the status')), /exactly the two GETs and the voice-turn POST/],
    ['re-add CR-070\'s "backend: recompute" POST', (c) => c.nodes.push(CR070_WRITE('backend: recompute')), /exactly the two GETs and the voice-turn POST/],
    ['turn the doses GET into a POST', (c) => { node(c, 'backend: doses of the day').parameters.method = 'POST'; }, /backend: doses of the day: method/],
    ['point the eligibility GET at /schedule/recompute', (c) => { const n = node(c, 'backend: who is eligible'); n.parameters.url = n.parameters.url.replace('/check-in-eligibility', '/schedule/recompute'); }, /backend: who is eligible calls/],
    ['build a /doses/{id}/status URL in the parse node, behind the allowed expression', (c) => replaceIn(c, PARSE, DOSES_URL, "API + '/doses/' + encodeURIComponent(p.patientId) + '/status'"), /builds a \/doses\/ or \/schedule\/ URL/],
    ['build that URL in pieces, so only the resolved URL shows it', (c) => replaceIn(c, PARSE, DOSES_URL, "API + '/do' + 'ses/' + encodeURIComponent(p.patientId) + '/status'"), /the doses GET resolves to/],
    ['give a Code node its own fetch', (c) => { const n = node(c, 'speak (deterministic)'); n.parameters.jsCode = "await fetch(API + '/x');\n" + n.parameters.jsCode; }, /makes its own network call/],
    ['add an Execute Workflow node', (c) => c.nodes.push({ parameters: {}, id: 'x', name: 'record elsewhere', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1, position: [0, 0] }), /a node type that could call out/],
    ['put the CR-070 switch back', (c) => { const n = node(c, 'speak (deterministic)'); n.parameters.jsCode = 'const VOICE_RECORDS = true;\n' + n.parameters.jsCode; }, /recording switch/],
  ];
  for (const [label, edit, why] of EDITS) {
    await check('AP-02: the call assertion goes RED on a copy edited to ' + label, async () => {
      const copy = JSON.parse(JSON.stringify(wf));
      edit(copy);
      await assert.rejects(assertVoiceCallsReadOnly(copy), why);
    });
  }
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
    assert.match(s.answer.reply, /^جرعتك القادمة Calcium carbonate \+ vitamin D3 الساعة 11:55 ليلًا/);
    assert.deepEqual(s.prompts, []);
    assert.equal(s.intent.viaModel, false, 'a suggestion must not wait for Gemini');
    assert.equal(s.intent.needsChat, false, 'a next-dose answer must not look up Telegram');
    console.log('        -> ' + s.answer.reply);
  });
  await check('free wording still goes to Gemini, and its intent is used', async () => {
    const s = await walk(req({ text: 'بعد كم ساعة لازم آخذ الحبة الثانية' }), { intent: 'next_dose', confidence: 0.9 });
    assert.equal(s.intent.viaModel, true);
    assert.equal(s.intent.intent, 'next_dose');
    assert.match(s.answer.reply, /^جرعتك القادمة/);
  });
  await check('«أخذته» -> nothing recorded; the open dose’s buttons go to the patient’s OWN Telegram', async () => {
    const s = await walk(req({ text: 'أخذته' }), { intent: 'took_it', confidence: 0.97 });
    assert.match(s.answer.reply, /لا يمكنني تسجيل الجرعة من هنا/);
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
    assert.match(s.answer.reply, /اسأل الصيدلي/);
  });
  await check('the model failed or is unsure -> unclear with examples, nothing read, nothing sent', async () => {
    for (const model of [{ error: '429' }, { intent: 'next_dose', confidence: 0.5 }, { intent: 'record_dose', confidence: 1 }]) {
      const s = await walk(req({ text: 'ايه' }), model);
      assert.equal(s.intent.intent, 'unclear');
      assert.match(s.answer.reply, /لم أفهم قصدك/);
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

// --------------------------------------------------------------- AP-04: one screening on the path
/** AP-04/CR-074: only the DDInter workflow (agents/knowledge) may sit on jurah/screen-prescription,
 * and no OTHER node anywhere may even name that path - a hand-off n8n has forgotten to remove reads
 * exactly like this (an HTTP node whose URL is built from the literal path string). Both workflow
 * directories are read; either one yielding no committed file is a failure, never a silent pass. */
async function oneScreeningCheck() {
  console.log('\n######## AP-04: exactly one workflow on jurah/screen-prescription');
  await check('exactly one webhook on the path (agent-interaction-screening-ddinter); no other node calls or names it; agents/workflows holds exactly the generated set', () => {
    const dirs = [
      { dir: path.join(ROOT, 'workflows'), label: 'agents/workflows' },
      { dir: path.join(ROOT, 'knowledge', 'workflows'), label: 'agents/knowledge/workflows' },
    ];
    const files = [];
    for (const { dir, label } of dirs) {
      assert.ok(fs.existsSync(dir), label + ' does not exist');
      const names = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
      assert.ok(names.length > 0, label + ' has no committed workflow file - a missing input is a failure, never a pass');
      for (const f of names) files.push({ label, name: f.replace(/\.json$/, ''), wf: JSON.parse(fs.readFileSync(path.join(dir, f), 'ascii')) });
    }
    const topLevelNames = files.filter((f) => f.label === 'agents/workflows').map((f) => f.name).sort();
    assert.deepEqual(topLevelNames, [...NAMES, 'agent-error'].sort(), 'agents/workflows holds exactly the generated workflows plus agent-error');

    const onPath = [];
    const stillCalling = [];  // an HTTP node still built to POST the webhook itself (a hand-off nobody removed)
    const otherMentions = []; // any OTHER node whose own text still names the literal path at all
    for (const f of files) {
      for (const n of f.wf.nodes) {
        if (n.type === 'n8n-nodes-base.webhook' && n.parameters && n.parameters.path === 'jurah/screen-prescription') { onPath.push(f.name + ': ' + n.name); continue; }
        if (n.type === 'n8n-nodes-base.httpRequest' && n.parameters && n.parameters.url === '={{ $json.screeningUrl }}') stillCalling.push(f.name + ': ' + n.name);
        if (JSON.stringify(n.parameters || {}).indexOf('screen-prescription') !== -1) otherMentions.push(f.name + ': ' + n.name);
      }
    }
    assert.deepEqual(onPath, ['agent-interaction-screening-ddinter: Screen a new prescription'], 'exactly one webhook is on the path, and it is the DDInter one');
    assert.deepEqual(stillCalling, [], 'a workflow still POSTs to jurah/screen-prescription itself, bypassing the backend (AP-04): ' + stillCalling.join(', '));
    assert.deepEqual(otherMentions, [], 'no other node may even name jurah/screen-prescription: ' + otherMentions.join(', '));
  });
}

(async () => {
  await staticChecks();
  await oneScreeningCheck();
  await scenarios();
  await alexaScenarios();
  await webchatScenarios();
  console.log('\n' + (failures === 0 ? 'all checks passed' : failures + ' check(s) FAILED'));
  process.exit(failures === 0 ? 0 : 1);
})();
