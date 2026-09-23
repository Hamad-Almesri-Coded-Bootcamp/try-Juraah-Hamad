'use strict';

/* ---------------------------------------------------------------------------
 * severity.js - source severity level -> contract severity and review state.
 *
 * A fixed table, not a judgement. The model is never asked how serious an
 * interaction is.
 *
 * DDInter classifies each interaction as Major / Moderate / Minor / Unknown.
 * The contract has info | warning | danger.
 *
 * DECISION (docs/guardrails.md G8, 2026-09-20): "Unknown" is NOT surfaced to
 * the patient as a graded finding - 18.6% of DDInter pairs are Unknown, and
 * grading them would bury the one danger alert. It is NOT dropped either:
 * the screening layer sends it to the medical reviewer as an ungraded `info`
 * finding (pending_medical_review), so "nothing found" is never claimed for a
 * pair the source does list.
 * ------------------------------------------------------------------------- */

const SEVERITY_TABLE = {
  major: 'danger',
  moderate: 'warning',
  minor: 'info'
  // 'unknown' is deliberately absent - see the decision note above.
};

const UNCLASSIFIED_LEVELS = ['unknown'];

const CONTRACT_SEVERITIES = ['info', 'warning', 'danger'];

/** What an agent may write as reviewStatus (lib/agent/validate.ts). Never 'reviewed'. */
const AGENT_REVIEW_STATES = ['pending_medical_review', 'auto_cleared'];

/**
 * Returns a contract severity, or null when the level is one we do not surface
 * (Unknown) or one the table has never seen. Callers MUST treat null as
 * "ungraded" and route it to the reviewer - never default it to info silently.
 */
function mapSeverity(sourceLevel) {
  if (sourceLevel === null || sourceLevel === undefined) return null;
  const key = String(sourceLevel).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(SEVERITY_TABLE, key)
    ? SEVERITY_TABLE[key]
    : null;
}

/** True when the source level is known to us but deliberately not graded. */
function isUnclassified(sourceLevel) {
  if (sourceLevel === null || sourceLevel === undefined) return true;
  return UNCLASSIFIED_LEVELS.indexOf(String(sourceLevel).trim().toLowerCase()) !== -1;
}

/**
 * GUARDRAIL G3, enforced in code rather than trusted to a prompt.
 *   danger  -> pending_medical_review  (AI Agents Acceptance Criteria: never final)
 *   warning -> pending_medical_review  (the seed's warning ia-002 went through the reviewer)
 *   info    -> auto_cleared            (a minor graded interaction; the seed's ia-003 precedent)
 * The model never chooses this value, and 'reviewed' is never written by an agent.
 */
function reviewStatusFor(severity) {
  return severity === 'info' ? 'auto_cleared' : 'pending_medical_review';
}

module.exports = {
  SEVERITY_TABLE, CONTRACT_SEVERITIES, AGENT_REVIEW_STATES, mapSeverity, isUnclassified, reviewStatusFor
};
