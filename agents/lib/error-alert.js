'use strict';

/**
 * AP-18 (docs/AGENTS-POLISH-PLAN.md 7.3, step 1) - the plain-text message the error workflow's Code
 * node builds for the team's Telegram chat, once ANY Jur'ah workflow fails (agents/scripts/build-
 * error-workflow.js wires this in behind an n8n Error Trigger). THE DETERMINISTIC LAYER: nothing here
 * is a model call, and nothing here is patient data.
 *
 * Reads ONLY workflow.name, execution.lastNodeExecuted and execution.url - n8n's own Error Trigger
 * shape - plus the Kuwait-time string the Code node passes in as `nowIso`. That string comes from
 * n8n's own `$now` (every Jur'ah workflow's `settings.timezone` is 'Asia/Kuwait', so `$now.toISO()`
 * is already Kuwait-local - no locale library, one direct read of the clock, the same rule every
 * other agents/lib module follows for time).
 *
 * NEVER reads the execution's own `error` object (its `message`, `description` or `stack`) or any
 * other data the failed run carried. An HTTP error body, a thrown message or a stack trace can hold a
 * patient's name, a Civil ID, a chat id or a Telegram/push link token - exactly the failed run's OWN
 * data, which is why it is never trusted onward (CLAUDE.md rules 6/7, applied here to a Telegram
 * message instead of a screen). A human who needs the real error opens `execution.url` in n8n itself.
 */

const FALLBACK = '(not given)';
const MAX_FIELD_LEN = 200;

/** A field-shaped string: trimmed and length-capped. Anything else (missing, not a string, blank) is
 * the fixed fallback - never blank, never thrown from, never a stray object dumped into a chat. */
function field(value) {
  if (typeof value !== 'string') return FALLBACK;
  const trimmed = value.trim();
  if (!trimmed) return FALLBACK;
  return trimmed.length > MAX_FIELD_LEN ? trimmed.slice(0, MAX_FIELD_LEN) + '...' : trimmed;
}

/**
 * payload: the Error Trigger node's own item json - n8n's shape is
 *   { execution: { id, url, lastNodeExecuted, mode, error: { ... } }, workflow: { id, name }, trigger: { ... } }
 * - of which only workflow.name, execution.lastNodeExecuted and execution.url are ever read; the
 * execution's `error` sub-object is deliberately never named in this file, comments included.
 * nowIso: the Kuwait-local timestamp string the Code node computed (see the file header).
 * Never throws: a malformed, partial or entirely missing payload still returns a usable, honest,
 * ASCII-only message (plain English for the team - CLAUDE.md's Fusha-Arabic copy rule is for the
 * app's own screens, not an internal ops alert).
 */
function errorAlertText(payload, nowIso) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const workflow = p.workflow && typeof p.workflow === 'object' ? p.workflow : {};
  const execution = p.execution && typeof p.execution === 'object' ? p.execution : {};
  const name = field(workflow.name);
  const node = field(execution.lastNodeExecuted);
  const url = field(execution.url);
  const time = field(nowIso);
  return [
    'Jur\'ah workflow failed: ' + name,
    'Node: ' + node,
    'Time (Kuwait): ' + time,
    'Execution: ' + url,
  ].join('\n');
}

module.exports = { errorAlertText, FALLBACK, MAX_FIELD_LEN };
