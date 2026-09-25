'use strict';

/* ---------------------------------------------------------------------------
 * resolve.js - a name read off a box -> active ingredient(s).
 *
 * GUARDRAIL G2: a name that cannot be resolved to an ingredient is a REFUSAL,
 * not a guess. There is no fuzzy matching in the accept path. Edit distance is
 * used for exactly one thing: deciding whether we are allowed to ask the
 * patient ONE clarifying question ("did you mean Eltroxin?"). It never
 * auto-accepts.
 *
 * Why no fuzzy accept: trade names are adversarially similar by design.
 * Losartan/Lorazepam, Celebrex/Cerebyx, Zantac/Xanax.
 *
 * Two accept paths, both exact:
 *   1. a VERIFIED row of the SFDA brand map (data/brand-map.json, verified:true
 *      only - the pendingVerification rows are never loaded);
 *   2. the ingredient's own name as the interaction index spells it (a generic
 *      box, e.g. "Amlodipine 5 mg"). The index names are DDInter's, so this
 *      resolves a name to the very molecule the index is keyed on.
 * ------------------------------------------------------------------------- */

const { normaliseDrugName, candidateKeys, editDistance } = require('./normalise');

const OUTCOME = {
  RESOLVED: 'resolved',
  NEEDS_CONFIRMATION: 'needs_confirmation',
  UNRESOLVED: 'unresolved'
};

/**
 * Build a lookup index from the VERIFIED brand-map rows and the interaction
 * index's own ingredient names.
 * Brand row shape: { brand, ingredients: string[], aliases?: string[], sfdaTradeName, verified }
 *
 * ingredients is an ARRAY because a trade name can carry several active
 * ingredients (Panadol Cold & Flu = paracetamol + pseudoephedrine +
 * chlorpheniramine). Resolving only the headline one would silently drop two
 * screenable drugs.
 */
function buildBrandIndex(brandRows, index) {
  const byKey = new Map();
  for (const row of brandRows || []) {
    if (!row || row.verified !== true) continue;
    const names = [row.brand, row.sfdaTradeName, ...(row.aliases || [])].filter(Boolean);
    for (const n of names) {
      for (const key of candidateKeys(n)) {
        if (!byKey.has(key)) byKey.set(key, row);
      }
    }
    // A single-ingredient generic name resolves to itself. Never for a
    // combination product: one component must not resolve to the whole product.
    if ((row.ingredients || []).length === 1) {
      for (const key of candidateKeys(row.ingredients[0])) {
        if (!byKey.has(key)) byKey.set(key, row);
      }
    }
  }
  if (index && index.drugs) {
    for (const [key, drug] of index.drugs) {
      if (!byKey.has(key)) {
        byKey.set(key, { brand: drug.label, ingredients: [drug.label], sfdaTradeName: null, verified: true, viaIndex: true });
      }
    }
  }
  return byKey;
}

/**
 * resolveToIngredient("Eltroxin", brandIndex)
 *   -> { outcome: 'resolved', ingredients: ['levothyroxine'], ingredientLabels: ['Levothyroxine'], ... }
 * Near miss (OCR noise on a photographed box):
 *   -> { outcome: 'needs_confirmation', candidates: ['ELTROXIN'] }
 * Nothing usable:
 *   -> { outcome: 'unresolved', reason }
 */
function resolveToIngredient(rawName, brandIndex, opts) {
  const options = opts || {};
  const minLenForNearMiss = options.minLenForNearMiss || 6;
  const maxDistance = options.maxDistance || 1;

  const keys = candidateKeys(rawName);
  if (keys.length === 0) {
    return { outcome: OUTCOME.UNRESOLVED, reason: 'no_readable_name', input: rawName };
  }

  // 1. Exact match on a normalised key. This is the only accept path.
  for (const key of keys) {
    const row = brandIndex.get(key);
    if (row) {
      // A bare family name ("PANADOL") while the map also holds line extensions of it
      // ("PANADOL COLD & FLU", "PANADOL NIGHT") is ambiguous: the box may be a combination
      // product whose extra ingredients would go unscreened. Never pick the base product. The
      // family is listed so the patient can check the box - every name in it is a verified
      // product, unlike the near-miss case below, where a menu of lookalikes is refused.
      const extensions = [];
      for (const [other, otherRow] of brandIndex) {
        if (otherRow !== row && !otherRow.viaIndex && other.indexOf(key + ' ') === 0 && extensions.indexOf(otherRow.brand) === -1) extensions.push(otherRow.brand);
      }
      if (extensions.length) {
        return { outcome: OUTCOME.NEEDS_CONFIRMATION, reason: 'line_extensions_exist', candidates: [row.brand].concat(extensions), input: rawName };
      }
      const ingredients = [];
      for (const label of row.ingredients || []) {
        const k = candidateKeys(label)[0];
        if (k && ingredients.indexOf(k) === -1) ingredients.push(k);
      }
      const via = row.viaIndex ? 'index_ingredient_name' : (ingredients.length === 1 && key === ingredients[0] ? 'generic' : 'brand');
      return {
        outcome: OUTCOME.RESOLVED,
        ingredients,
        ingredientLabels: row.ingredients || [],
        isCombination: ingredients.length > 1,
        // A generic box is named by its ingredient, never by whichever brand row happens to own the key.
        brandLabel: via === 'brand' ? row.brand : (row.ingredients || [])[0],
        via,
        matchedOn: key,
        sfdaTradeName: row.sfdaTradeName || null
      };
    }
  }

  // 2. No exact match. Is there exactly ONE near neighbour worth asking about?
  const probe = keys[0];
  if (probe.length >= minLenForNearMiss) {
    const near = [];
    for (const key of brandIndex.keys()) {
      if (Math.abs(key.length - probe.length) > maxDistance) continue;
      if (editDistance(probe, key) <= maxDistance) near.push(key);
    }
    const distinct = [...new Set(near.map((k) => brandIndex.get(k).brand))];
    if (distinct.length === 1) {
      return { outcome: OUTCOME.NEEDS_CONFIRMATION, candidates: distinct, input: rawName };
    }
    // Two or more equally close candidates is exactly the situation where a
    // guess is most dangerous. Refuse rather than offer a menu.
    if (distinct.length > 1) {
      return { outcome: OUTCOME.UNRESOLVED, reason: 'ambiguous_near_matches', nearCount: distinct.length, input: rawName };
    }
  }

  return { outcome: OUTCOME.UNRESOLVED, reason: 'not_in_mapping_table', input: rawName, normalised: normaliseDrugName(rawName) };
}

/**
 * A lookup from a normalised candidate key to an UNVERIFIED brand's own label (data/brand-map.json
 * pendingVerification.brands), so a box we refuse to resolve can still be told apart from a name we
 * have never heard of at all (CR-078: cannot_verify, reason brand_not_verified).
 *
 * Built only from brand / sfdaTradeName / aliases - NEVER from ingredients, because a pending row is
 * exactly the one we are not willing to say is Warfarin (or anything else) yet. AP-07 promotes a row
 * by setting verified:true, which moves it out of this list and into buildBrandIndex's.
 */
function buildPendingNames(rows) {
  const byKey = new Map();
  for (const row of rows || []) {
    if (!row || row.verified === true) continue;
    const names = [row.brand, row.sfdaTradeName, ...(row.aliases || [])].filter(Boolean);
    for (const n of names) {
      for (const key of candidateKeys(n)) {
        if (!byKey.has(key)) byKey.set(key, row.brand);
      }
    }
  }
  return byKey;
}

module.exports = { OUTCOME, buildBrandIndex, resolveToIngredient, buildPendingNames };
