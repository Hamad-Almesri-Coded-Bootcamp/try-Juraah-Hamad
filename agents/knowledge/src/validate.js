'use strict';

/* ---------------------------------------------------------------------------
 * validate.js - the deterministic validation layer.
 *
 * Every clinically meaningful output passes a deterministic validation layer
 * before a patient sees it. Nothing leaves the knowledge chain without going
 * through validateAlerts(). The checks below are a superset of the backend's
 * own (lib/agent/validate.ts parseAlertBody): the backend refuses a bad body
 * with 422, this refuses it before it is sent - and ALSO refuses what the
 * backend cannot know is wrong (a citation that is not in the index, a
 * description that names a drug outside the finding).
 * ------------------------------------------------------------------------- */

const { normaliseDrugName, candidateKeys } = require('./normalise');
const { CONTRACT_SEVERITIES, AGENT_REVIEW_STATES } = require('./severity');

const MAX_DESCRIPTION = 400;
/** The exact keys POST /api/agent/alerts accepts from an agent. Anything else is 422 there. */
const ALERT_KEYS = ['patientId', 'involvedPrescriptionIds', 'severity', 'description', 'sourceCitation', 'createdAt', 'reviewStatus'];

/**
 * alert:    the POST /api/agent/alerts body.
 * evidence: this agent's private record of why the alert exists (never sent).
 *   { findingType: 'interaction'|'duplicate_therapy'|'ungraded'|'not_covered'|'pair_not_checkable'|'nothing_found'|'travel_interaction',
 *     pairKey?, allowedNames: string[] }   allowedNames = the involved records' own names and ingredient keys
 * ctx: { patientId, knownPrescriptionIds: string[], index }
 */
function validateAlert(alert, evidence, ctx) {
  const v = [];
  const ev = evidence || {};

  // V0 - shape and identity. The backend assigns id and never takes a reviewer field.
  if (!alert || typeof alert !== 'object') return { ok: false, violations: ['V0 not an object'] };
  for (const k of Object.keys(alert)) if (ALERT_KEYS.indexOf(k) === -1) v.push('V0 key the backend refuses: ' + k);
  if (typeof alert.patientId !== 'string' || alert.patientId !== ctx.patientId) {
    v.push('V0 patientId mismatch: alert=' + alert.patientId + ' request=' + ctx.patientId);
  }

  // V1 - every referenced prescription must be one of this patient's screened
  // prescriptions. An id that is not in the data is unrenderable and unverifiable.
  const ids = alert.involvedPrescriptionIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    v.push('V1 involvedPrescriptionIds is empty');
  } else {
    if (new Set(ids).size !== ids.length) v.push('V1 duplicate prescription id');
    for (const id of ids) {
      if (ctx.knownPrescriptionIds.indexOf(id) === -1) v.push('V1 unknown prescription id: ' + id);
    }
    if ((ev.findingType === 'interaction' || ev.findingType === 'duplicate_therapy') && ids.length < 2) {
      v.push('V1 an interaction must involve at least two prescriptions');
    }
  }

  // V2 - severity must be one of the three contract values.
  if (CONTRACT_SEVERITIES.indexOf(alert.severity) === -1) v.push('V2 severity not in contract: ' + alert.severity);

  // V3 - GUARDRAIL G3. A danger finding is never final, and an agent never reviews.
  if (AGENT_REVIEW_STATES.indexOf(alert.reviewStatus) === -1) v.push('V3 reviewStatus an agent may not write: ' + alert.reviewStatus);
  if (alert.severity !== 'info' && alert.reviewStatus !== 'pending_medical_review') {
    v.push('V3 a ' + alert.severity + ' alert must be pending_medical_review, got ' + alert.reviewStatus);
  }
  if ((ev.findingType === 'not_covered' || ev.findingType === 'ungraded' || ev.findingType === 'pair_not_checkable') && alert.reviewStatus !== 'pending_medical_review') {
    v.push('V3 an unverifiable finding goes to the reviewer, never auto_cleared');
  }

  // V4 - GUARDRAIL G1. A graded interaction must cite a row that is actually in the index.
  if (ev.findingType === 'interaction' || ev.findingType === 'travel_interaction') {
    if (!ev.pairKey || !ctx.index.pairs.has(ev.pairKey)) v.push('V4 cited pair is not in the index: ' + ev.pairKey);
  }
  // A "not checkable" finding names pairs, and none of them may be a row the index holds (that
  // pair would have a real answer, and the alert would hide it).
  if (ev.findingType === 'pair_not_checkable') {
    if (!Array.isArray(ev.pairKeys) || ev.pairKeys.length === 0) v.push('V4 a not-checkable finding names no pair');
    else for (const k of ev.pairKeys) if (ctx.index.pairs.has(k)) v.push('V4 a not-checkable pair is in the index: ' + k);
  }
  if (typeof alert.sourceCitation !== 'string' || alert.sourceCitation.trim().length === 0) {
    v.push('V4 sourceCitation is empty');
  }

  // V5 - the description must not name an indexed drug outside the finding.
  const d = alert.description;
  if (typeof d !== 'string' || d.trim().length === 0) {
    v.push('V5 description is empty');
  } else {
    if (d.length > MAX_DESCRIPTION) v.push('V5 description too long: ' + d.length);
    // Allowed: every key of every name the finding involves, AND every indexed term that
    // appears inside one of those names ("Simvastatin (Zocor)" allows "simvastatin").
    const allowed = new Set();
    const vocabulary = [...ctx.index.drugs.keys()];
    for (const a of ev.allowedNames || []) {
      for (const k of candidateKeys(a)) allowed.add(k);
      const inside = ' ' + normaliseDrugName(a) + ' ';
      for (const term of vocabulary) if (inside.indexOf(' ' + term + ' ') !== -1) allowed.add(term);
    }
    const text = ' ' + normaliseDrugName(d) + ' ';
    for (const term of ctx.index.drugs.keys()) {
      if (term.length < 5) continue;              // avoid matching "iron" inside words
      if (allowed.has(term)) continue;
      if (text.indexOf(' ' + term + ' ') !== -1) v.push('V5 description names a drug outside the finding: ' + term);
    }
  }

  return { ok: v.length === 0, violations: v };
}

/**
 * FAIL CLOSED: an alert that fails validation is NOT sent - and it is never
 * silently dropped either. ANY failure sets mustEscalate, which fails the n8n
 * execution after the answer is sent, so it shows in the execution list and
 * n8n's error workflow (a withheld "cannot verify" matters as much as a
 * withheld danger alert: without it the patient's record reads clean).
 */
function validateAlerts(candidates, ctx) {
  const passed = [];
  const failed = [];
  for (const c of candidates) {
    const r = validateAlert(c.alert, c.evidence, ctx);
    if (r.ok) passed.push(c);
    else failed.push({ alert: c.alert, evidence: c.evidence, violations: r.violations });
  }
  return {
    passed,
    failed,
    mustEscalate: failed.length > 0
  };
}

module.exports = { MAX_DESCRIPTION, ALERT_KEYS, validateAlert, validateAlerts };
