'use strict';

/* ---------------------------------------------------------------------------
 * travel-check.js - photo of an unfamiliar box -> a verdict against the
 * patient's REAL active profile (read from the backend, never from the caller).
 *
 * Verdicts (richer than the app needs; appOutcome maps them to the app's own
 * DrugCheckOutcome, types/views.ts):
 *   interaction_found   -> { kind:'identified', verdict:'interaction_found', alertId? }
 *   already_taking      -> { kind:'identified', verdict:'interaction_found' }   (duplicate dose)
 *   no_interaction_found-> { kind:'identified', verdict:'no_interaction' }     (never "safe")
 *   cannot_verify       -> { kind:'could_not_identify' }   identified, but a drug is not in the
 *                                                          index, a pair lies outside the loaded DDInter
 *                                                          category files (AP-06), a pair is ungraded, or a prescription
 *                                                          is still awaiting review - so nothing can be
 *                                                          said about the whole profile (TC-IX-03/06)
 *   needs_confirmation  -> { kind:'could_not_identify' }   one near match; the chat can ask
 *   could_not_identify  -> { kind:'could_not_identify' }   G5 - unreadable or unknown name
 * The app's DrugCheckOutcome has no cannot-verify verdict. Mapping it to
 * could_not_identify is the conservative choice (the app then says "ask a
 * pharmacist"); mapping it to no_interaction would be a false all-clear.
 *
 * A danger finding is escalated: one pending_medical_review alert body is
 * produced for POST /api/agent/alerts (involving the patient's conflicting
 * prescription), so the reviewer sees it and the app can link to it (alertId).
 * ------------------------------------------------------------------------- */

const { normaliseDrugName, ingredientParts, ingredientsOf } = require('./normalise');
const { OUTCOME, resolveToIngredient } = require('./resolve');
const { isCovered, lookupPair } = require('./interactions');
const { lang, unnamed, TRAVEL_TEXT, ALERT_TEXT, pairCitation } = require('./text');
const { exclusionReason } = require('./screening');
const { validateAlerts } = require('./validate');

const VERDICT = {
  INTERACTION_FOUND: 'interaction_found',
  ALREADY_TAKING: 'already_taking',
  NO_INTERACTION_FOUND: 'no_interaction_found',
  CANNOT_VERIFY: 'cannot_verify',
  NEEDS_CONFIRMATION: 'needs_confirmation',
  COULD_NOT_IDENTIFY: 'could_not_identify'
};

/** The app's DrugCheckOutcome for a verdict (types/views.ts). alertId only when an alert was raised. */
function appOutcomeFor(verdict, drugName, alertId) {
  if (verdict === VERDICT.INTERACTION_FOUND || verdict === VERDICT.ALREADY_TAKING) {
    const o = { kind: 'identified', drugName, verdict: 'interaction_found' };
    if (alertId) o.alertId = alertId;
    return o;
  }
  if (verdict === VERDICT.NO_INTERACTION_FOUND) return { kind: 'identified', drugName, verdict: 'no_interaction' };
  return { kind: 'could_not_identify' };
}

/**
 * travelCheck({ patientId, visionText, prescriptions, index, brandIndex, language })
 * visionText is whatever the vision model read off the box: an untrusted string,
 * used only as a key into the verified mapping table, never as an identity.
 */
function travelCheck(args) {
  const { patientId, visionText, index, brandIndex } = args;
  const l = lang(args.language);
  const out = (verdict, extra) => {
    const r = Object.assign({ verdict, patientId, candidate: null, findings: [], alreadyTaking: [], notCovered: [], notCheckable: [],
                              ungraded: [], excluded: [], alert: null, reviewRequired: false }, extra);
    r.appOutcome = appOutcomeFor(verdict, r.candidate ? r.candidate.ingredients.join(' + ') : null, null);
    return r;
  };

  // G5 - an unreadable photo stops here. No guessing from partial text.
  if (!visionText || !normaliseDrugName(visionText)) {
    return out(VERDICT.COULD_NOT_IDENTIFY, { reason: 'no_readable_text', message: TRAVEL_TEXT.could_not_identify(l) });
  }

  const resolved = resolveToIngredient(visionText, brandIndex);
  if (resolved.outcome === OUTCOME.NEEDS_CONFIRMATION) {
    const lineExt = resolved.reason === 'line_extensions_exist';
    return out(VERDICT.NEEDS_CONFIRMATION, { reason: resolved.reason || 'near_match', candidates: resolved.candidates,
                                             message: lineExt ? TRAVEL_TEXT.line_extensions(l, resolved.candidates) : TRAVEL_TEXT.needs_confirmation(l, resolved.candidates) });
  }
  // G2 - unresolved is a refusal. We do not screen a drug we cannot name.
  if (resolved.outcome !== OUTCOME.RESOLVED) {
    return out(VERDICT.COULD_NOT_IDENTIFY, { reason: resolved.reason, readAs: visionText, message: TRAVEL_TEXT.could_not_identify(l) });
  }

  const candidate = {
    readAs: visionText,
    brandLabel: resolved.brandLabel,
    sfdaTradeName: resolved.sfdaTradeName,
    ingredients: resolved.ingredientLabels,
    ingredientKeys: resolved.ingredients,
    isCombination: resolved.isCombination,
    via: resolved.via
  };
  const candidateName = candidate.brandLabel + (candidate.via === 'brand' ? ' (' + candidate.ingredients.join(' + ') + ')' : '');
  const candidateLabel = (key) => {
    const i = candidate.ingredientKeys.indexOf(key);
    return i !== -1 && candidate.ingredients[i] ? candidate.ingredients[i] : key;
  };

  const all = Array.isArray(args.prescriptions) ? args.prescriptions : [];
  const excluded = [];
  const active = [];
  for (const p of all) {
    const why = exclusionReason(p);
    if (why) excluded.push({ id: p && p.id, reason: why });
    else active.push(p);
  }
  const unconfirmed = excluded.filter((e) => e.reason === 'needs_review' || e.reason.indexOf('field_review_') === 0).length;

  const findings = [];
  const alreadyTaking = [];
  const notCovered = [];                       // labels as the patient knows them, never raw keys
  const addNotCovered = (label) => { if (label && notCovered.indexOf(label) === -1) notCovered.push(label); };
  const ungraded = [];
  const notCheckable = [];                     // both known to DDInter, but the file that would list the pair was not loaded
  const generic = (p) => (p.drug && typeof p.drug.genericName === 'string' ? p.drug.genericName : '');
  const taking = (key, p) => alreadyTaking.push({ ingredient: key, ingredientLabel: candidateLabel(key), prescriptionId: p.id,
    brandName: (p.drug && p.drug.brandName) || null, facility: (p.source && p.source.facilityName) || null });

  for (const c of candidate.ingredientKeys) {
    if (!isCovered(c, index)) addNotCovered(candidateLabel(c));
    for (const p of active) {
      const parts = ingredientParts(generic(p));
      if (parts.length === 0) { addNotCovered(generic(p).trim() || unnamed(l)); continue; }
      for (const part of parts) {
        const b = part.key;
        if (b === c) { taking(c, p); continue; }
        const res = lookupPair(c, b, index);
        if (!res.found) {
          if (res.reason === 'same_ingredient') taking(c, p);
          else if (res.reason === 'drug_not_in_index' && !isCovered(b, index)) addNotCovered(parts.length === 1 ? generic(p) : part.text);
          else if (res.reason === 'pair_not_checkable') {
            notCheckable.push({ candidateIngredient: c, prescriptionId: p.id, pairKey: res.pairKey, with: parts.length === 1 ? generic(p) : part.text });
          }
          continue;
        }
        if (res.unclassified || !res.severity) { ungraded.push({ candidateIngredient: c, prescriptionId: p.id, level: res.level, pairKey: res.pairKey }); continue; }
        findings.push({
          candidateIngredient: c,
          conflictsWith: { prescriptionId: p.id, ingredient: b, genericName: generic(p), brandName: (p.drug && p.drug.brandName) || null },
          severity: res.severity, sourceLevel: res.level, rowIds: res.rowIds, pairKey: res.pairKey,
          drugA: res.drugA, drugB: res.drugB
        });
      }
    }
  }

  const rank = { danger: 0, warning: 1, info: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
  const worst = findings.length ? findings[0].severity : null;
  const common = { candidate, findings, alreadyTaking, notCovered, notCheckable, ungraded, excluded, unconfirmedExcluded: unconfirmed };

  // A danger finding outranks everything and goes to the reviewer.
  if (worst === 'danger') {
    const danger = findings.filter((f) => f.severity === 'danger');
    const ids = [...new Set(danger.map((f) => f.conflictsWith.prescriptionId))];
    const others = [...new Set(danger.map((f) => f.conflictsWith.genericName))];
    const alert = {
      patientId,
      involvedPrescriptionIds: ids,
      severity: 'danger',
      description: ALERT_TEXT.travelDanger(l, candidate.brandLabel, candidate.ingredients.join(' + '), others.join(l === 'en' ? ' and ' : ' و ')),
      sourceCitation: [...new Set(danger.map((f) => pairCitation(index.meta, f.drugA, f.drugB, f.sourceLevel)))].join(' | '),
      reviewStatus: 'pending_medical_review'
    };
    const involved = ids.map((id) => active.find((p) => p.id === id));
    const allowedNames = candidate.ingredients.concat(candidate.ingredientKeys, [candidate.brandLabel],
      involved.flatMap((p) => [generic(p)].concat(ingredientsOf(generic(p)))));
    // One alert, validated once per cited pair: every pair it rests on must be a row of the index.
    const v = validateAlerts(danger.map((f) => ({ alert, evidence: { findingType: 'travel_interaction', pairKey: f.pairKey, allowedNames } })),
      { patientId, knownPrescriptionIds: active.map((p) => p.id), index });
    const accepted = v.failed.length === 0;
    return out(VERDICT.INTERACTION_FOUND, Object.assign({}, common, {
      alert: accepted ? alert : null,
      alertValidationFailures: v.failed,
      mustEscalate: !accepted,
      reviewRequired: true,
      message: TRAVEL_TEXT.interaction_found(l, candidateName, others, true)
    }));
  }

  if (alreadyTaking.length) {
    const a = alreadyTaking[0];
    return out(VERDICT.ALREADY_TAKING, Object.assign({}, common, {
      reviewRequired: true,
      message: TRAVEL_TEXT.already_taking(l, a.ingredientLabel, a.facility)
    }));
  }

  if (findings.length) {
    return out(VERDICT.INTERACTION_FOUND, Object.assign({}, common, {
      reviewRequired: false,
      message: TRAVEL_TEXT.interaction_found(l, candidateName, [...new Set(findings.map((f) => f.conflictsWith.genericName))], false)
    }));
  }

  // Nothing graded found. That is only "no interaction" if EVERY pair was checkable (both drugs
  // in the index, and one of them in a loaded category file) and every prescription was part of the check.
  if (notCovered.length) {
    return out(VERDICT.CANNOT_VERIFY, Object.assign({}, common, {
      reason: 'drug_not_in_index', message: TRAVEL_TEXT.cannot_verify(l, candidateName, notCovered)
    }));
  }
  if (notCheckable.length) {
    return out(VERDICT.CANNOT_VERIFY, Object.assign({}, common, {
      reason: 'pair_outside_loaded_categories',
      message: TRAVEL_TEXT.pair_not_checkable(l, candidateName, [...new Set(notCheckable.map((n) => n.with))])
    }));
  }
  if (ungraded.length) {
    return out(VERDICT.CANNOT_VERIFY, Object.assign({}, common, {
      reason: 'ungraded_interaction_in_source', message: TRAVEL_TEXT.ungraded(l, candidateName)
    }));
  }
  if (unconfirmed > 0) {
    return out(VERDICT.CANNOT_VERIFY, Object.assign({}, common, {
      reason: 'profile_has_unconfirmed_prescriptions', message: TRAVEL_TEXT.unconfirmed_profile(l, candidateName, unconfirmed)
    }));
  }

  return out(VERDICT.NO_INTERACTION_FOUND, Object.assign({}, common, {
    message: TRAVEL_TEXT.no_interaction_found(l, candidateName)
  }));
}

module.exports = { VERDICT, appOutcomeFor, travelCheck };
