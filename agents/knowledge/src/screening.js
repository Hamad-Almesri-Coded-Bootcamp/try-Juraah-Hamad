'use strict';

/* ---------------------------------------------------------------------------
 * screening.js - the Interaction Screening Agent, deterministic end to end.
 *
 * Input: the patient's ACTIVE prescriptions exactly as the backend returns them
 * (GET /api/agent/patients/{id}/prescriptions -> .prescriptions, each carrying
 * needsReview), plus the id of the NEW prescription that triggered the run.
 * Output: POST /api/agent/alerts bodies, already validated, plus the evidence.
 *
 * The rules, each one a test case in AI Agents Acceptance Criteria.md section 4:
 *   - a graded pair in the index          -> an alert with that pair's severity and
 *                                            its DDInter record as sourceCitation (TC-IX-01)
 *   - both drugs covered, no pair         -> no interaction alert (TC-IX-02); when NOTHING
 *                                            at all is found, one `info` "screened, nothing
 *                                            recorded" alert, auto_cleared (the seed's ia-003) -
 *                                            or pending the reviewer while any prescription is
 *                                            still awaiting field review (it was not screened)
 *   - a drug the index does not cover     -> ONE `info` "cannot verify" alert, pending the
 *                                            reviewer - never a silent "no interaction"
 *                                            (TC-IX-03, TC-IX-04)
 *   - a pair the source lists, ungraded   -> ONE `info` alert to the reviewer (G8)
 *   - the same ingredient twice           -> a duplicate-therapy `warning`, pending
 *   - a prescription flagged needsReview  -> excluded, and the exclusion is returned (TC-IX-06);
 *     (or fieldReviewStatus pending/returned)  a flagged NEW prescription is not screened yet
 *   - no channel is consulted at all      -> TC-IX-05
 *
 * Scope: only pairs that include the NEW prescription, so a re-run never
 * re-raises an alert the backend already holds (the seed's ia-001 is already
 * there). A whole-profile screen is available only as a dry run (nothing sent).
 * ------------------------------------------------------------------------- */

const { canonical, ingredientParts, ingredientsOf } = require('./normalise');
const { reviewStatusFor } = require('./severity');
const { isCovered, lookupPair } = require('./interactions');
const {
  lang, unnamed, ALERT_TEXT, pairCitation, ungradedCitation, notCoveredCitation, nothingFoundCitation, duplicateCitation
} = require('./text');
const { validateAlerts } = require('./validate');

/** Why a prescription is left out of screening, or null when it is screened. */
function exclusionReason(p) {
  if (!p || typeof p !== 'object' || typeof p.id !== 'string') return 'malformed';
  if (p.status !== 'active') return 'not_active';
  if (p.needsReview !== false) return 'needs_review';
  if (p.fieldReviewStatus === 'pending' || p.fieldReviewStatus === 'returned') return 'field_review_' + p.fieldReviewStatus;
  return null;
}

const genericOf = (p) => (p && p.drug && typeof p.drug.genericName === 'string' ? p.drug.genericName : '');

/**
 * The label a patient knows: the record's own generic name; for one ingredient
 * of a combination, the index's name for it, or the part as the record wrote it
 * ("vitamin D3", not "cholecalciferol").
 */
function labelFor(p, ingredientKey, index, l) {
  const parts = ingredientParts(genericOf(p));
  if (parts.length === 0) return genericOf(p).trim() || unnamed(l);
  if (parts.length === 1) return genericOf(p);
  const k = isCovered(ingredientKey, index);
  const d = k ? index.drugs.get(k) : null;
  if (d) return d.label;
  const part = parts.find((x) => x.key === canonical(ingredientKey));
  return part ? part.text : ingredientKey;
}

/**
 * screenNewPrescription({ patientId, newPrescriptionId, prescriptions, language, index, createdAt? })
 * screenNewPrescription({ patientId, prescriptions, language, index, dryRun: true })   // whole profile
 *
 * Returns { screened, reason, excluded, alerts, dryRun, report, evidence }.
 * `alerts` are exact POST /api/agent/alerts bodies. Empty array when there is
 * nothing to send - never null.
 */
function screenNewPrescription(args) {
  const { patientId, newPrescriptionId, index } = args;
  const l = lang(args.language);
  const all = Array.isArray(args.prescriptions) ? args.prescriptions : [];
  const wholeProfile = !newPrescriptionId;
  const dryRun = wholeProfile || args.dryRun === true;

  const excluded = [];
  const screenable = [];
  for (const p of all) {
    const why = exclusionReason(p);
    if (why) excluded.push({ id: p && p.id, reason: why });
    else screenable.push(p);
  }
  const base = { dryRun, excluded, alerts: [], report: null, evidence: null };

  let target = null;
  if (!wholeProfile) {
    target = all.find((p) => p && p.id === newPrescriptionId) || null;
    if (!target) return { ...base, screened: false, reason: 'not_an_active_prescription_of_this_patient' };
    const why = exclusionReason(target);
    if (why) return { ...base, screened: false, reason: 'new_prescription_excluded:' + why };
  }

  // The prescription pairs to look at.
  const pairs = [];
  if (target) {
    for (const q of screenable) if (q.id !== target.id) pairs.push([target, q]);
  } else {
    for (let i = 0; i < screenable.length; i++) for (let j = i + 1; j < screenable.length; j++) pairs.push([screenable[i], screenable[j]]);
  }

  const findings = [];     // graded DDInter rows
  const ungraded = [];     // DDInter rows with level Unknown
  const duplicates = [];   // same ingredient in two prescriptions
  const noPair = [];       // both covered, no row
  const uncovered = new Map(); // prescriptionId -> Set(ingredient label) not in the index

  const markUncovered = (p, ing) => {
    if (!uncovered.has(p.id)) uncovered.set(p.id, new Set());
    uncovered.get(p.id).add(labelFor(p, ing, index, l));
  };
  // A prescription whose generic name yields no ingredient at all cannot be screened either.
  const subjects = target ? [target].concat(pairs.map((x) => x[1])) : screenable;
  for (const p of subjects) if (ingredientsOf(genericOf(p)).length === 0) markUncovered(p, genericOf(p));

  for (const [p, q] of pairs) {
    for (const a of ingredientsOf(genericOf(p))) {
      for (const b of ingredientsOf(genericOf(q))) {
        if (canonical(a) === canonical(b)) { duplicates.push({ p, q, ingredient: a }); continue; }
        const res = lookupPair(a, b, index);
        if (!res.found) {
          if (res.reason === 'same_ingredient') duplicates.push({ p, q, ingredient: res.key });
          else if (res.reason === 'drug_not_in_index') {
            if (!isCovered(a, index)) markUncovered(p, a);
            if (!isCovered(b, index)) markUncovered(q, b);
          } else noPair.push({ p, q, a: res.keyA, b: res.keyB });
          continue;
        }
        if (res.unclassified || !res.severity) ungraded.push({ p, q, res });
        else findings.push({ p, q, a, b, res });
      }
    }
  }

  const candidates = [];
  const createdAt = args.createdAt;
  const body = (ids, severity, description, sourceCitation, reviewStatus) => {
    const b = { patientId, involvedPrescriptionIds: [...new Set(ids)], severity, description, sourceCitation, reviewStatus };
    if (createdAt) b.createdAt = createdAt;
    return b;
  };
  const namesOf = (...ps) => ps.flatMap((p) => [genericOf(p)].concat(ingredientsOf(genericOf(p)))).filter(Boolean);
  const unconfirmed = excluded.filter((e) => e.reason === 'needs_review' || e.reason.indexOf('field_review_') === 0).length;

  // Most severe first - the dashboard shows the top one most prominently.
  const rank = { danger: 0, warning: 1, info: 2 };
  findings.sort((x, y) => rank[x.res.severity] - rank[y.res.severity]);
  for (const f of findings) {
    const sev = f.res.severity;
    candidates.push({
      alert: body([f.p.id, f.q.id], sev,
        ALERT_TEXT.interaction(l, sev, labelFor(f.p, f.a, index, l), labelFor(f.q, f.b, index, l)),
        pairCitation(index.meta, f.res.drugA, f.res.drugB, f.res.level), reviewStatusFor(sev)),
      evidence: { findingType: 'interaction', pairKey: f.res.pairKey, level: f.res.level, rowIds: f.res.rowIds, allowedNames: namesOf(f.p, f.q) }
    });
  }

  const seenDup = new Set();
  for (const d of duplicates) {
    const key = [d.p.id, d.q.id].sort().join('|') + '|' + canonical(d.ingredient);
    if (seenDup.has(key)) continue;
    seenDup.add(key);
    const label = labelFor(d.p, d.ingredient, index, l);
    const facility = (p) => (p.source && p.source.facilityName) || null;
    candidates.push({
      alert: body([d.p.id, d.q.id], 'warning', ALERT_TEXT.duplicate(l, label), duplicateCitation(label, [facility(d.p), facility(d.q)]), 'pending_medical_review'),
      evidence: { findingType: 'duplicate_therapy', allowedNames: namesOf(d.p, d.q) }
    });
  }

  if (ungraded.length) {
    const ids = [];
    const involved = [];
    const labels = [];
    for (const u of ungraded) {
      ids.push(u.p.id, u.q.id);
      involved.push(u.p, u.q);
      labels.push(u.res.drugA.label + (l === 'en' ? ' and ' : ' و ') + u.res.drugB.label);
    }
    candidates.push({
      alert: body(ids, 'info', ALERT_TEXT.ungraded(l, [...new Set(labels)]),
        ungradedCitation(index.meta, ungraded.map((u) => u.res)), 'pending_medical_review'),
      evidence: { findingType: 'ungraded', allowedNames: namesOf(...involved) }
    });
  }

  if (uncovered.size) {
    const ids = target ? [target.id] : [];
    const labels = [];
    for (const [id, set] of uncovered) {
      ids.push(id);
      for (const s of set) if (labels.indexOf(s) === -1) labels.push(s);
    }
    const involved = ids.map((id) => screenable.find((x) => x.id === id)).filter(Boolean);
    candidates.push({
      alert: body(ids, 'info', ALERT_TEXT.cannotVerify(l, labels), notCoveredCitation(index.meta, labels), 'pending_medical_review'),
      evidence: { findingType: 'not_covered', uncovered: labels, allowedNames: namesOf(...involved).concat(labels) }
    });
  }

  // Nothing at all was found. Only "nothing recorded" (auto_cleared, the seed's ia-003 shape) when
  // every prescription was part of the run; with prescriptions still awaiting review it goes to the
  // reviewer instead, and says so (TC-IX-06: the exclusion is visible, not silent).
  if (candidates.length === 0 && (pairs.length > 0 || unconfirmed > 0)) {
    const subjectsOfRun = target ? [target] : screenable;
    if (subjectsOfRun.length > 0) {
      const label = target ? genericOf(target) || labelFor(target, target.id, index, l) : subjectsOfRun.map(genericOf).join(l === 'en' ? ', ' : '، ');
      const pairLabels = [...new Set(noPair.map((x) => x.a + ' x ' + x.b))];
      const citation = pairs.length > 0 ? nothingFoundCitation(index.meta, pairLabels) : 'No confirmed prescription to screen against.';
      candidates.push(unconfirmed > 0
        ? {
            alert: body(subjectsOfRun.map((p) => p.id), 'info',
              pairs.length > 0 ? ALERT_TEXT.nothingFoundButUnconfirmed(l, label, unconfirmed) : ALERT_TEXT.notScreenedAwaitingReview(l, label, unconfirmed),
              citation + ' ' + unconfirmed + ' prescription(s) awaiting field review were not screened.', 'pending_medical_review'),
            evidence: { findingType: 'nothing_found_unconfirmed_excluded', allowedNames: namesOf(...subjectsOfRun) }
          }
        : {
            alert: body(subjectsOfRun.map((p) => p.id), 'info', ALERT_TEXT.nothingFound(l, label), citation, 'auto_cleared'),
            evidence: { findingType: 'nothing_found', allowedNames: namesOf(...subjectsOfRun) }
          });
    }
  }

  const validation = validateAlerts(candidates, {
    patientId, knownPrescriptionIds: screenable.map((p) => p.id), index
  });

  return {
    screened: true,
    reason: pairs.length === 0 ? 'no_other_screenable_prescription' : null,
    unconfirmedExcluded: unconfirmed,
    dryRun,
    excluded,
    alerts: validation.passed.map((c) => c.alert),
    report: {
      prescriptionsScreened: target ? 1 + pairs.length : screenable.length,
      pairsConsidered: pairs.length,
      graded: findings.length,
      ungraded: ungraded.length,
      duplicates: seenDup.size,
      notCovered: [...uncovered.values()].flatMap((s) => [...s]),
      toSend: dryRun ? 0 : validation.passed.length,
      validationFailed: validation.failed.length,
      mustEscalate: validation.mustEscalate
    },
    evidence: {
      source: index.meta ? index.meta.source : null,
      indexBuiltAt: index.meta ? index.meta.builtAt : null,
      findings: validation.passed.map((c) => ({ severity: c.alert.severity, reviewStatus: c.alert.reviewStatus, ...c.evidence })),
      validationFailures: validation.failed
    }
  };
}

module.exports = { exclusionReason, screenNewPrescription };
