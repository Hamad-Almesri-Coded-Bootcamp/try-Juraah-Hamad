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
 *   cannot_verify       -> { kind:'cannot_verify' }   (CR-078) nothing can be said about the whole
 *                                                     profile. reason is one of: drug_not_in_index,
 *                                                     pair_outside_loaded_categories (AP-06),
 *                                                     ungraded_interaction_in_source,
 *                                                     profile_has_unconfirmed_prescriptions (TC-IX-03/06),
 *                                                     profile_unavailable (the backend's profile could
 *                                                     not even be read - never "no interaction" for
 *                                                     that), or brand_not_verified (the box matches an
 *                                                     unverified SFDA brand row, AP-07 - never resolved
 *                                                     to its ingredient until a human verifies it)
 *   needs_confirmation  -> { kind:'could_not_identify' }   one near match, or an SFDA base name that
 *                                                     registers more than one ingredient set; the
 *                                                     chat can ask
 *   could_not_identify  -> { kind:'could_not_identify' }   G5 - unreadable, a name never seen at all,
 *                                                     or the model's own answer could not be used
 *                                                     (reason model_response_unparseable, fail closed)
 *   not_a_medicine      -> { kind:'not_a_medicine' }   decided before any lookup, straight from the
 *                                                     vision read's isMedicine field (owner decision
 *                                                     (a), 2026-09-26) - no alert, no candidate
 * cannot_verify is its own DrugCheckOutcome, never could_not_identify and never no_interaction: the
 * app shows its own "we recognised the medicine but can't clear it" copy (C3, PR #13) instead of the
 * plain "could not identify" one, because a name we could read is not the same finding as a name we
 * could not.
 *
 * The vision call (BRAND_PROMPT, RESPONSE_SCHEMA, both exported - CR-099(b)) reads four fields, never
 * a lookup: isMedicine, brandAsPrinted (Latin only), ingredientsAsPrinted[], strengthAsPrinted.
 * resolve.js's resolveFields() is the field-by-field policy: a printed brand is tried alone, never
 * falling back to ingredientsAsPrinted (decision (d) - the one reading this project does not trust
 * the model to make unsupervised); ingredientsAsPrinted is only used when no brand was printed, and a
 * combination resolves only when every entry does.
 *
 * A danger finding is escalated: one pending_medical_review alert body is
 * produced for POST /api/agent/alerts (involving the patient's conflicting
 * prescription), so the reviewer sees it and the app can link to it (alertId).
 * ------------------------------------------------------------------------- */

const { normaliseDrugName, ingredientParts, ingredientsOf } = require('./normalise');
const { OUTCOME, resolveFields } = require('./resolve');
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
  COULD_NOT_IDENTIFY: 'could_not_identify',
  // Decided before any lookup, from isMedicine alone (owner decision (a), 2026-09-26): the photo is
  // not a medicine package at all. No alert, no candidate, nothing held against the patient's profile.
  NOT_A_MEDICINE: 'not_a_medicine'
};

/**
 * Read ONLY the medicine product name, active ingredient(s) and strength printed on the package -
 * pure verbatim transcription, never a decision. Owner decisions (a)/(b)/(d), 2026-09-26: one Gemini
 * call decides medicine-or-not AND reads the fields; the app trusts brandAsPrinted for lookup but
 * never trusts a model-read ingredient behind an unverified brand (see resolve.js resolveFields).
 * Exported (closes CR-099(b)): agents/knowledge/scripts/build.js requires this rather than keeping
 * its own copy, so the prompt has exactly one source.
 */
const BRAND_PROMPT = [
  'Look at this photo and return JSON matching the schema. You transcribe; you never decide what the medicine is, and you never look anything up.',
  '',
  'isMedicine is true for a medicine package, blister strip, bottle or pharmacy label - an over-the-counter product or a supplement in pharmaceutical packaging counts too. isMedicine is false for anything else (a receipt, a room, a hand, food, a document that is not a pharmacy label).',
  '',
  'When isMedicine is false: brandAsPrinted is null, ingredientsAsPrinted is [], strengthAsPrinted is null. Stop there - do not try to read a name off something that is not medicine packaging.',
  '',
  'When isMedicine is true:',
  '- brandAsPrinted is the FULL trade (brand) name exactly as printed IN LATIN LETTERS, including any variant word printed with it (for example "Extra", "Night", "Cold & Flu", "Plus", "Forte"). null if no Latin trade name is printed, or if you cannot read it clearly. Never transliterate an Arabic-only name into Latin letters yourself - if only Arabic script is printed, leave this null.',
  '- ingredientsAsPrinted lists each active ingredient name exactly as printed, in printed order. Empty array if none is printed or legible.',
  '- strengthAsPrinted is the strength exactly as printed (for example "400 mg", "500 mg / 125 mg"). null if not printed or not legible.',
  '',
  'Never guess. Never expand an abbreviation. Never supply a brand, ingredient or strength that is not visibly printed - a field you cannot read clearly is null (or [] for ingredientsAsPrinted), never a plausible guess.'
].join('\n');

/** The Gemini responseSchema for BRAND_PROMPT: all four fields required, so the model must commit to
 *  isMedicine either way, and every other field is explicitly null/empty rather than left out. */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    isMedicine: { type: 'boolean' },
    brandAsPrinted: { type: 'string', nullable: true },
    ingredientsAsPrinted: { type: 'array', items: { type: 'string' } },
    strengthAsPrinted: { type: 'string', nullable: true }
  },
  required: ['isMedicine', 'brandAsPrinted', 'ingredientsAsPrinted', 'strengthAsPrinted']
};

/** The app's DrugCheckOutcome for a verdict (types/views.ts). alertId only when an alert was raised. */
function appOutcomeFor(verdict, drugName, alertId) {
  // Shared contract with the app-side builder: not_a_medicine carries nothing else - no alert, no
  // readAs, no drugName. Decided first, since nothing else about this verdict is ever meaningful.
  if (verdict === VERDICT.NOT_A_MEDICINE) return { kind: 'not_a_medicine' };
  if (verdict === VERDICT.INTERACTION_FOUND || verdict === VERDICT.ALREADY_TAKING) {
    const o = { kind: 'identified', drugName, verdict: 'interaction_found' };
    if (alertId) o.alertId = alertId;
    return o;
  }
  if (verdict === VERDICT.NO_INTERACTION_FOUND) return { kind: 'identified', drugName, verdict: 'no_interaction' };
  // CR-078: recognised, but nothing can be said about the whole profile - its own outcome, no
  // drugName, no verdict, no alertId. needs_confirmation, could_not_identify and any unknown verdict
  // (a future value this code does not know yet) all stay could_not_identify: fail closed by default.
  if (verdict === VERDICT.CANNOT_VERIFY) return { kind: 'cannot_verify' };
  return { kind: 'could_not_identify' };
}

/**
 * travelCheck({ patientId, visionText, prescriptions, index, brandIndex, language })
 * visionText is whatever the vision model read off the box: an untrusted string,
 * used only as a key into the verified mapping table, never as an identity.
 */
function travelCheck(args) {
  const { patientId, index, brandIndex } = args;
  const l = lang(args.language);
  const out = (verdict, extra) => {
    const r = Object.assign({ verdict, patientId, candidate: null, findings: [], alreadyTaking: [], notCovered: [], notCheckable: [],
                              ungraded: [], excluded: [], alert: null, reviewRequired: false }, extra);
    r.appOutcome = appOutcomeFor(verdict, r.candidate ? r.candidate.ingredients.join(' + ') : null, null);
    return r;
  };

  // The vision reading. The current shape is `visionRead` ({ isMedicine, brandAsPrinted,
  // ingredientsAsPrinted, strengthAsPrinted } | null for "the model's answer could not be used" -
  // TC_CHECK in build.js sets this to null on a JSON.parse failure or a shape mismatch, fail closed).
  // `visionText` (a bare candidate string) is still accepted for every caller that only has a single
  // name to offer: it is read as a printed brand, unless it carries no readable text at all, which is
  // treated exactly like a medicine box with nothing legible on it (the original G5 case).
  let read = args.visionRead;
  if (read === undefined) {
    const t = args.visionText;
    read = (!t || !normaliseDrugName(t))
      ? { isMedicine: true, brandAsPrinted: null, ingredientsAsPrinted: [], strengthAsPrinted: null }
      : { isMedicine: true, brandAsPrinted: t, ingredientsAsPrinted: [], strengthAsPrinted: null };
  }

  // Malformed or unparseable model output: fail closed exactly like an unreadable photo, but named so
  // a reviewer can tell "the model's answer could not be used" from "nothing was printed at all".
  if (!read || typeof read !== 'object') {
    return out(VERDICT.COULD_NOT_IDENTIFY, { reason: 'model_response_unparseable', message: TRAVEL_TEXT.could_not_identify(l) });
  }

  // Decision (a), 2026-09-26: medicine-or-not is decided BEFORE any lookup, straight from the vision
  // read. No alert, no candidate, no readAs - the shared contract with the app is exactly this:
  // appOutcome { kind: 'not_a_medicine' } and nothing else.
  if (read.isMedicine === false) {
    return out(VERDICT.NOT_A_MEDICINE, { message: TRAVEL_TEXT.not_a_medicine(l) });
  }

  const brandAsPrinted = typeof read.brandAsPrinted === 'string' ? read.brandAsPrinted.trim() : '';
  const ingredientsAsPrinted = Array.isArray(read.ingredientsAsPrinted)
    ? read.ingredientsAsPrinted.filter((x) => typeof x === 'string' && x.trim())
    : [];
  const strengthAsPrinted = typeof read.strengthAsPrinted === 'string' && read.strengthAsPrinted.trim() ? read.strengthAsPrinted.trim() : null;
  const readAs = brandAsPrinted || ingredientsAsPrinted.join(' + ');

  // G5 - a medicine package with nothing legible on it stops here. No guessing from partial text.
  if (!brandAsPrinted && ingredientsAsPrinted.length === 0) {
    return out(VERDICT.COULD_NOT_IDENTIFY, { reason: 'no_readable_text', message: TRAVEL_TEXT.could_not_identify(l) });
  }

  const resolved = resolveFields({ brandAsPrinted, ingredientsAsPrinted }, brandIndex, args.pendingNames);
  if (resolved.outcome === OUTCOME.NEEDS_CONFIRMATION) {
    const lineExt = resolved.reason === 'line_extensions_exist';
    return out(VERDICT.NEEDS_CONFIRMATION, { reason: resolved.reason || 'near_match', candidates: resolved.candidates,
                                             message: lineExt ? TRAVEL_TEXT.line_extensions(l, resolved.candidates) : TRAVEL_TEXT.needs_confirmation(l, resolved.candidates) });
  }
  // G2 - unresolved is a refusal. We do not screen a drug we cannot name. One exception: a brand that
  // IS printed but matches an UNVERIFIED SFDA brand row (AP-07) is not "unknown" - it is "not cleared
  // yet", and the patient should be told that, not "could not identify". Decision (d): never resolved
  // to an ingredient, never screened, and ingredientsAsPrinted is never consulted as a fallback here -
  // brandLabel comes from the data file, never from the raw (untrusted) vision read.
  if (resolved.outcome !== OUTCOME.RESOLVED) {
    if (resolved.reason === 'brand_not_verified') {
      return out(VERDICT.CANNOT_VERIFY, { reason: 'brand_not_verified', brandLabel: resolved.brandLabel, message: null });
    }
    return out(VERDICT.COULD_NOT_IDENTIFY, { reason: resolved.reason, readAs, message: TRAVEL_TEXT.could_not_identify(l) });
  }

  const candidate = {
    readAs,
    strengthAsPrinted,
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

  // Fail closed: a profile the backend could not hand us is never "no interaction" - it is exactly
  // as unverifiable as a drug the index has no row for. An empty array is a real empty profile and
  // keeps today's behaviour; only a non-array (the backend call failed, or was never made) stops here.
  if (!Array.isArray(args.prescriptions)) {
    return out(VERDICT.CANNOT_VERIFY, { candidate, reason: 'profile_unavailable', message: null });
  }

  const all = args.prescriptions;
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

module.exports = { VERDICT, appOutcomeFor, travelCheck, BRAND_PROMPT, RESPONSE_SCHEMA };
