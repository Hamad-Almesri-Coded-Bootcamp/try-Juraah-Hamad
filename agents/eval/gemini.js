'use strict';

/**
 * The model call, and only the model call. GEMINI_API_KEY comes from the shell (process.env),
 * travels in a request header (never in a URL, so it cannot reach a log line), and is never
 * printed. Tests replace the transport with a fake one; nothing else changes.
 *
 * A transport is `async ({ url, body }) => ({ statusCode, body })`, the same shape an n8n HTTP node
 * hands the next Code node with "full response" on.
 */

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/';

/** The generateContent URL of a chat model node's modelName ("models/gemini-3-flash-preview"). */
function chatUrl(modelName) {
  if (!/^models\/[A-Za-z0-9._-]+$/.test(String(modelName))) throw new Error('not a Gemini model name: ' + modelName);
  return API_ROOT + modelName + ':generateContent';
}

/**
 * A Basic LLM Chain turn as one generateContent request: the node's prompt as the system
 * instruction, the patient's words as the user turn, and the node's schema as the response schema.
 * (n8n's chain sends the same prompt and schema through LangChain, which appends its own format
 * instructions to the user turn instead of using responseSchema: the words are the same, the
 * wrapper differs. agents/eval/README.md says so beside every number.)
 */
function chatRequest({ prompt, schema, text, temperature }) {
  const generationConfig = { responseMimeType: 'application/json', responseSchema: schema };
  if (temperature !== undefined) generationConfig.temperature = temperature;
  return {
    systemInstruction: { parts: [{ text: prompt }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig,
  };
}

/** The model's text, or null when the answer has no text part. */
function responseText(body) {
  try {
    const parts = body.candidates[0].content.parts;
    return Array.isArray(parts) ? parts.map((p) => (p && p.text) || '').join('') : null;
  } catch (e) {
    return null;
  }
}

function geminiTransport(key) {
  if (typeof key !== 'string' || key.length < 10) throw new Error('GEMINI_API_KEY is not set in this shell');
  return async ({ url, body }) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
    let json = null;
    try { json = await res.json(); } catch (e) { json = null; }
    return { statusCode: res.status, body: json };
  };
}

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One request under a node's retry policy (tries, waitMs). A request that throws is statusCode 0.
 * Returns the last response; the caller decides what a non-200 means.
 */
async function send(transport, request, { tries = 1, waitMs = 0 } = {}, sleep = realSleep) {
  let last = null;
  const n = Math.max(1, tries);
  for (let i = 0; i < n; i++) {
    try {
      last = await transport(request);
    } catch (e) {
      last = { statusCode: 0, body: null, error: String((e && e.name) || 'Error') + ': ' + String((e && e.message) || '') };
    }
    if (last && last.statusCode === 200) return last;
    if (i < n - 1 && waitMs > 0) await sleep(waitMs);
  }
  return last;
}

module.exports = { API_ROOT, chatUrl, chatRequest, responseText, geminiTransport, send, realSleep };
