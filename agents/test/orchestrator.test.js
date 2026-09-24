'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../lib/orchestrator.js');

const NOW = Date.parse('2026-09-24T08:00:00Z');
const HOUR = 3600 * 1000;
const store = () => ({});
const relay = (over) => ({ channel: 'telegram', subjectType: 'patient', patientId: 'pt-03', chatId: '5550001',
  kind: 'message', messageId: 900, sentAt: '2026-09-24T08:00:00+03:00', text: null,
  photoFileId: null, documentFileId: null, callbackQueryId: null, language: 'ar', ...over });

// ------------------------------------------------------------------------------ routeInbound: one test per route
test('a patient\'s typed text -> adherence', () => {
  assert.equal(O.routeInbound(relay({ text: 'خذيته' }), { store: store(), now: NOW }), 'adherence');
});

test('a patient\'s dose tap (d:<doseId>:<intent>) -> adherence, the unchanged path', () => {
  assert.equal(O.routeInbound(relay({ kind: 'callback', text: 'd:rx-008-20260924-0700:taken_on_time' }), { store: store(), now: NOW }), 'adherence');
});

test('a patient\'s photo -> photo', () => {
  assert.equal(O.routeInbound(relay({ photoFileId: 'AgAC-photo' }), { store: store(), now: NOW }), 'photo');
});

test('an image sent as a document -> photo (the mime is decided after download, by photoQuestion)', () => {
  assert.equal(O.routeInbound(relay({ documentFileId: 'BQAC-image-doc' }), { store: store(), now: NOW }), 'photo');
});

test('a PDF sent as a document -> also photo at this stage; photoQuestion later decides it is a prescription without asking', () => {
  assert.equal(O.routeInbound(relay({ documentFileId: 'BQAC-pdf-doc' }), { store: store(), now: NOW }), 'photo');
  assert.deepEqual(O.photoQuestion('application/pdf', Buffer.from('%PDF-1.4 fake')), { ok: true, mimeShortcut: 'prescription', visionBody: null });
});

test('or:rx and or:box resume the pending photo they were asked about', () => {
  const s = store();
  O.rememberPhoto(s, 'pt-03', '555', 'AgAC-rx', 'photo', NOW);
  assert.equal(O.routeInbound(relay({ kind: 'callback', text: 'or:rx:555' }), { store: s, now: NOW + 1000 }), 'extraction');
  O.rememberPhoto(s, 'pt-03', '556', 'BQAC-box', 'document', NOW);
  assert.equal(O.routeInbound(relay({ kind: 'callback', text: 'or:box:556' }), { store: s, now: NOW + 1000 }), 'travel');
});

test('or:rx / or:box with no pending entry at all -> reply (photo_expired)', () => {
  assert.equal(O.routeInbound(relay({ kind: 'callback', text: 'or:rx:999999' }), { store: store(), now: NOW }), 'reply');
});

test('a second tap on the same message id -> reply: the choice is one-shot', () => {
  const s = store();
  O.rememberPhoto(s, 'pt-03', '555', 'AgAC-rx', 'photo', NOW);
  assert.equal(O.routeInbound(relay({ kind: 'callback', text: 'or:rx:555' }), { store: s, now: NOW + 1000 }), 'extraction');
  assert.equal(O.routeInbound(relay({ kind: 'callback', text: 'or:rx:555' }), { store: s, now: NOW + 2000 }), 'reply');
});

test('a choice older than 24 hours -> reply: it has expired, never resumed stale', () => {
  const s = store();
  O.rememberPhoto(s, 'pt-03', '555', 'AgAC-rx', 'photo', NOW);
  assert.equal(O.routeInbound(relay({ kind: 'callback', text: 'or:rx:555' }), { store: s, now: NOW + 24 * HOUR + 1 }), 'reply');
});

test('a tap naming another patient\'s message id -> reply: the pending key is namespaced by patient id', () => {
  const s = store();
  O.rememberPhoto(s, 'pt-01', '555', 'AgAC-someone-elses', 'photo', NOW);
  assert.equal(O.routeInbound(relay({ patientId: 'pt-03', kind: 'callback', text: 'or:rx:555' }), { store: s, now: NOW + 1000 }), 'reply');
});

test('an ACTIVE caregiver: text, tap, photo and document all -> reply; nothing is read or remembered', () => {
  const s = store();
  const froms = [
    relay({ subjectType: 'caregiver', text: 'أبوي خذ الدوا' }),
    relay({ subjectType: 'caregiver', kind: 'callback', text: 'd:rx-1:taken_on_time' }),
    relay({ subjectType: 'caregiver', photoFileId: 'AgAC-cg' }),
    relay({ subjectType: 'caregiver', documentFileId: 'BQAC-cg' }),
  ];
  for (const payload of froms) assert.equal(O.routeInbound(payload, { store: s, now: NOW }), 'reply');
  assert.deepEqual(s, {}, 'a caregiver message never remembers a photo, whatever it sends');
});

test('/start (with or without the bot username, or a token) is dropped - the relay already refuses it; refused again here', () => {
  for (const text of ['/start', '/start 9f8a7b', '/start@jurah_bot 9f8a7b']) {
    assert.equal(O.routeInbound(relay({ text }), { store: store(), now: NOW }), null);
  }
});

test('a malformed body (no subjectType at all) fails closed to reply, never guessed as a patient', () => {
  assert.equal(O.routeInbound({}, { store: store(), now: NOW }), 'reply');
});

test('a patient message with nothing recognisable (no text, no photo, no document) stays on adherence: a blank reply is adherence\'s own guardrail (G10), not the Orchestrator\'s', () => {
  assert.equal(O.routeInbound(relay({}), { store: store(), now: NOW }), 'adherence');
});

// ------------------------------------------------------------------------------ decidePhoto
const gemini = (kind, confidence, finishReason = 'STOP') =>
  ({ statusCode: 200, body: { candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify({ kind, confidence }) }] } }] } });

test('decidePhoto: 0.70 is trusted, 0.69 is not - the floor is exact, never rounded', () => {
  assert.deepEqual(O.decidePhoto(gemini('prescription', 0.70)), { kind: 'prescription', confidence: 0.70, claimed: 'prescription', guardrail: null });
  const below = O.decidePhoto(gemini('prescription', 0.69));
  assert.equal(below.kind, 'unsure');
  assert.equal(below.guardrail, 'below_floor');
});

test('decidePhoto: every failure shape is unsure, never a guess', () => {
  assert.equal(O.decidePhoto(null).kind, 'unsure');
  assert.equal(O.decidePhoto({ statusCode: 429, body: null }).kind, 'unsure');
  assert.equal(O.decidePhoto({ statusCode: 200, body: { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] } }).kind, 'unsure');
  assert.equal(O.decidePhoto({ statusCode: 200, body: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] } }).kind, 'unsure');
  assert.equal(O.decidePhoto(gemini('a_medicine_box', 0.99)).kind, 'unsure'); // unknown kind
  assert.equal(O.decidePhoto(gemini('prescription', 'high')).kind, 'unsure'); // not a number
  assert.equal(O.decidePhoto(gemini('prescription', 1.4)).kind, 'unsure'); // out of range
  assert.equal(O.decidePhoto(gemini('prescription', -0.1)).kind, 'unsure'); // out of range
  assert.equal(O.decidePhoto({ statusCode: 200, body: {} }).kind, 'unsure'); // no candidates at all
});

test('decidePhoto: the model\'s own "unsure" is trusted at any confidence (it is already asking, not claiming)', () => {
  assert.equal(O.decidePhoto(gemini('unsure', 0.1)).kind, 'unsure');
});

// ------------------------------------------------------------------------------ photoQuestion
test('photoQuestion: an image builds the vision request with PHOTO_PROMPT and PHOTO_SCHEMA', () => {
  const buf = Buffer.from('fake-jpeg-bytes');
  const q = O.photoQuestion('image/jpeg', buf);
  assert.equal(q.ok, true);
  assert.equal(q.mimeShortcut, null);
  assert.equal(q.visionBody.contents[0].parts[0].text, O.PHOTO_PROMPT);
  assert.equal(q.visionBody.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
  assert.equal(q.visionBody.contents[0].parts[1].inlineData.data, buf.toString('base64'));
  assert.deepEqual(q.visionBody.generationConfig, { temperature: 0, responseMimeType: 'application/json', responseSchema: O.PHOTO_SCHEMA });
});

test('photoQuestion: no buffer, an unsupported type, or too large - each named, never silently accepted', () => {
  assert.deepEqual(O.photoQuestion('image/jpeg', Buffer.alloc(0)), { ok: false, reason: 'file_not_downloaded' });
  assert.deepEqual(O.photoQuestion('image/jpeg', null), { ok: false, reason: 'file_not_downloaded' });
  assert.equal(O.photoQuestion('application/zip', Buffer.from('x')).reason, 'unsupported_file');
  assert.equal(O.photoQuestion('image/jpeg', Buffer.alloc(15 * 1024 * 1024 + 1)).reason, 'file_too_large');
});

// ------------------------------------------------------------------------------ the choice buttons
test('choiceButtons: callback data stays at most 64 bytes even for the largest safe message id', () => {
  const id = 9007199254740991; // Number.MAX_SAFE_INTEGER
  const [rx, box] = O.choiceButtons(id, 'ar');
  assert.ok(rx.data.length <= 64, rx.data);
  assert.ok(box.data.length <= 64, box.data);
  assert.equal(rx.data, 'or:rx:9007199254740991');
  assert.equal(box.data, 'or:box:9007199254740991');
});

// ------------------------------------------------------------------------------ orchestratorReply / caregiverReply
test('orchestratorReply: caregiver, expired, other and a file problem are plain text; unsure carries the two buttons', () => {
  assert.deepEqual(O.orchestratorReply({ reason: 'caregiver', kind: 'message', language: 'ar' }).buttons, null);
  assert.deepEqual(O.orchestratorReply({ reason: 'photo_expired', language: 'en' }).buttons, null);
  assert.deepEqual(O.orchestratorReply({ reason: 'other', language: 'en' }).buttons, null);
  assert.deepEqual(O.orchestratorReply({ reason: 'file_problem', language: 'en' }).buttons, null);
  const u = O.orchestratorReply({ reason: 'unsure', language: 'en', messageId: 42 });
  assert.equal(u.buttons.length, 2);
  assert.deepEqual(u.buttons.map((b) => b.data), ['or:rx:42', 'or:box:42']);
});

test('caregiverReply: text/tap reuse adherence.js\'s own caregiver words; a photo or document gets its own line', () => {
  const A = require('../lib/adherence.js');
  assert.equal(O.caregiverReply(undefined, 'ar'), A.REPLIES.ar.caregiver);
  assert.equal(O.caregiverReply(undefined, 'en'), A.REPLIES.en.caregiver);
  assert.notEqual(O.caregiverReply('photo', 'en'), A.REPLIES.en.caregiver);
  assert.notEqual(O.caregiverReply('document', 'ar'), A.REPLIES.ar.caregiver);
});

// ------------------------------------------------------------------------------ travelBody / travelReply
test('travelBody: exactly the four fields the travel-check webhook documents', () => {
  assert.deepEqual(O.travelBody({ patientId: 'pt-03', imageBase64: 'AAA', mimeType: 'image/png', language: 'en' }),
    { patientId: 'pt-03', imageBase64: 'AAA', mimeType: 'image/png', language: 'en' });
});

test('travelReply: every verdict gets its own fixed line; a danger line never instructs, only points at the app', () => {
  const okBody = (over) => ({ ok: true, error: null, mustEscalate: false, alertId: null, verdict: null, ...over });
  assert.match(O.travelReply({ statusCode: 200, body: okBody({ alertId: 'al-1', verdict: 'interaction_found' }), language: 'en' }), /review/i);
  assert.doesNotMatch(O.travelReply({ statusCode: 200, body: okBody({ alertId: 'al-1', verdict: 'interaction_found' }), language: 'en' }), /do not take|don't take|stop taking/i);
  assert.match(O.travelReply({ statusCode: 200, body: okBody({ verdict: 'interaction_found' }), language: 'en' }), /interaction/i);
  assert.match(O.travelReply({ statusCode: 200, body: okBody({ verdict: 'cannot_verify' }), language: 'en' }), /cannot verify this medicine/i);
  assert.match(O.travelReply({ statusCode: 200, body: okBody({ verdict: 'could_not_identify' }), language: 'en' }), /could not identify/i);
  assert.match(O.travelReply({ statusCode: 200, body: okBody({ verdict: 'needs_confirmation' }), language: 'en' }), /could not identify/i);
  assert.match(O.travelReply({ statusCode: 200, body: okBody({ verdict: 'no_interaction_found' }), language: 'en' }), /not a clearance|not.*safe/i);
  assert.match(O.travelReply({ statusCode: 200, body: okBody({ verdict: 'already_taking' }), language: 'en' }), /already take/i);
  // never an all-clear when the workflow itself could not finish cleanly
  for (const bad of [{ statusCode: 500, body: okBody({ verdict: 'no_interaction_found' }) },
                     { statusCode: 200, body: okBody({ ok: false, error: 'vision_http_429' }) },
                     { statusCode: 200, body: okBody({ mustEscalate: true, verdict: 'interaction_found' }) },
                     { statusCode: 200, body: okBody({ verdict: 'something_new_this_file_does_not_know' }) },
                     { statusCode: 200, body: null }]) {
    const r = O.travelReply({ ...bad, language: 'en' });
    assert.equal(r, O.ORCH_TEXT.en.travel_failed, JSON.stringify(bad));
  }
});

// ------------------------------------------------------------------------------ copy rules
test('ORCH_TEXT carries no em dash (U+2014) anywhere, in either language', () => {
  const EM_DASH = String.fromCharCode(0x2014); // never the literal character in this source file
  for (const l of ['ar', 'en']) for (const [k, v] of Object.entries(O.ORCH_TEXT[l])) assert.ok(!v.includes(EM_DASH), l + '.' + k);
  assert.ok(!O.PHOTO_PROMPT.includes(EM_DASH));
});
