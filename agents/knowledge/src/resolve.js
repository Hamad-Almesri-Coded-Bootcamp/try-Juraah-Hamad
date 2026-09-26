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
 * Build a lookup index from the VERIFIED brand-map rows, the SFDA registered-drug list (decision (c),
 * 2026-09-26 - "the whole Saudi SFDA registered-drug list becomes the brand source"), and the
 * interaction index's own ingredient names.
 * Brand row shape: { brand, ingredients: string[], aliases?: string[], sfdaTradeName, verified }
 *
 * ingredients is an ARRAY because a trade name can carry several active
 * ingredients (Panadol Cold & Flu = paracetamol + pseudoephedrine +
 * chlorpheniramine). Resolving only the headline one would silently drop two
 * screenable drugs.
 *
 * sfda is agents/knowledge/data/sfda-brands.json's `names` map (produced by another builder; a
 * missing file is simply `undefined`/`null` here, which contributes nothing - never an error):
 *   { "<BASE TRADE NAME>": [["INGREDIENT A", "INGREDIENT B"], ...] }
 * Each value is every DISTINCT ingredient set SFDA registers under that base name. brand-map.json's
 * own hand-verified rows are added FIRST and always win a conflict (the `if (!byKey.has(key))` guard
 * below never overwrites them) - SFDA is a bulk, unverified-by-a-human source; brand-map.json is
 * where a human (AP-07) has actually looked. A base name with more than one distinct ingredient set
 * is ambiguous (the very shape a bare "PANADOL" already asks about) and is marked with
 * `ambiguousSets` rather than picked for the patient: resolveToIngredient turns that into
 * needs_confirmation, never a guess at which formulation this box is.
 */
/** The row shape for a name known only through the interaction index's own ingredient list - never a
 *  brand or SFDA row. Shared by buildBrandIndex's own index.drugs loop and buildIngredientIndex below,
 *  so the two can never quietly drift apart. */
function indexRow(drug) {
  return { brand: drug.label, ingredients: [drug.label], sfdaTradeName: null, verified: true, viaIndex: true };
}

/**
 * The interaction index's key for one ingredient label (CR-112). SFDA spells ingredients with their
 * salt or ester ("METFORMIN HYDROCHLORIDE", "OLMESARTAN MEDOXOMIL") where the index names the drug
 * ("metformin", "olmesartan"): the index's own meta.sfdaIngredientMap first, then the first candidate
 * key the index covers, then the first candidate. A name the index does not cover stays uncovered,
 * so the check still says "cannot verify" for it (fail closed, never a guessed drug).
 */
function ingredientKey(label, index) {
  const drugs = index && index.drugs instanceof Map ? index.drugs : null;
  const map = index && index.meta && index.meta.sfdaIngredientMap;
  const mapped = map ? map[String(label).trim().toUpperCase()] : undefined;
  if (typeof mapped === 'string' && drugs && drugs.has(mapped)) return mapped;
  const keys = candidateKeys(label);
  const covered = drugs ? keys.find((k) => drugs.has(k)) : undefined;
  return covered || keys[0] || null;
}

function buildBrandIndex(brandRows, index, sfda) {
  const byKey = new Map();
  const keysOf = (labels) => labels.map((label) => ingredientKey(label, index));
  for (const source of brandRows || []) {
    if (!source || source.verified !== true) continue;
    // A copy, never the shared brand-map.json object: its keys depend on THIS index.
    const row = Array.isArray(source.ingredients) ? { ...source, ingredientKeys: keysOf(source.ingredients) } : source;
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
  if (sfda && typeof sfda === 'object') {
    for (const [rawName, sets] of Object.entries(sfda)) {
      if (!Array.isArray(sets) || sets.length === 0) continue;
      const distinct = [];
      for (const set of sets) {
        if (!Array.isArray(set) || set.length === 0) continue;
        const labels = set.map((x) => String(x)).filter(Boolean);
        if (labels.length === 0) continue;
        // Keyed by the index's own names, so "METFORMIN" and "METFORMIN HYDROCHLORIDE" under one base
        // name are one drug, not two formulations to ask about.
        const setKey = keysOf(labels).map((k, i) => k || labels[i].toLowerCase()).sort().join('+');
        if (!distinct.some((s) => s.setKey === setKey)) distinct.push({ setKey, labels });
      }
      if (distinct.length === 0) continue;
      const row = distinct.length === 1
        ? { brand: rawName, ingredients: distinct[0].labels, ingredientKeys: keysOf(distinct[0].labels), sfdaTradeName: rawName, verified: true, viaSfda: true }
        : { brand: rawName, ingredients: null, ambiguousSets: distinct.map((s) => s.labels), sfdaTradeName: rawName, verified: true, viaSfda: true };
      for (const key of candidateKeys(rawName)) {
        if (!byKey.has(key)) byKey.set(key, row);
      }
    }
  }
  if (index && index.drugs) {
    for (const [key, drug] of index.drugs) {
      if (!byKey.has(key)) byKey.set(key, indexRow(drug));
    }
  }
  return byKey;
}

/**
 * A SEPARATE index of ingredient names ONLY, built straight from the interaction index's own
 * `index.drugs` and nothing else - never a brand-map or SFDA row, and never shadowed by one.
 *
 * Why this cannot just be "filter buildBrandIndex's combined map to the viaIndex rows": that combined
 * map is built key-by-key with a `!byKey.has(key)` first-writer-wins guard, and the SFDA loop runs
 * BEFORE the index.drugs loop. When an SFDA base trade name happens to equal a plain ingredient name
 * (SFDA registers plenty of generics under their own INN - "EZETIMIBE" the brand line, not just the
 * molecule), the SFDA row claims that key first and the index-ingredient row for the very same key is
 * never inserted into the combined map at all - there is nothing left to filter for. Building this
 * index independently, straight from index.drugs, is the only way a filter can be correct.
 *
 * resolveFields uses this, never the combined brandIndex, for the ingredientsAsPrinted path (no brand
 * printed - see resolveFields below): that field is a plain ingredient name by the vision schema's own
 * contract, so it must resolve as one, never as a brand or an ambiguous SFDA trade name.
 */
function buildIngredientIndex(index) {
  const byKey = new Map();
  if (index && index.drugs) {
    for (const [key, drug] of index.drugs) byKey.set(key, indexRow(drug));
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
      // The SFDA source (buildBrandIndex) marks a base name that registers more than one distinct
      // ingredient set this way: the same box name, more than one possible formulation. Exactly the
      // situation a bare family name already asks about below - never pick one, ask instead.
      if (row.ambiguousSets) {
        return { outcome: OUTCOME.NEEDS_CONFIRMATION, reason: 'sfda_multiple_ingredient_sets',
                 candidates: row.ambiguousSets.map((set) => set.join(' + ')), input: rawName };
      }
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
      const rowKeys = row.ingredientKeys || (row.ingredients || []).map((label) => candidateKeys(label)[0]);
      for (const k of rowKeys) {
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
 * resolveFields({ brandAsPrinted, ingredientsAsPrinted }, brandIndex, pendingNames, ingredientIndex, opts)
 *
 * The field-by-field policy from the owner's 2026-09-26 decisions (a, d) on the new travel-check
 * vision schema ({ isMedicine, brandAsPrinted, ingredientsAsPrinted, strengthAsPrinted }):
 *
 *   1. brandAsPrinted is tried FIRST and ALONE, through the exact-match / one-edit-near-miss path
 *      above, against the FULL combined brandIndex (brand-map + SFDA + index ingredient names) -
 *      never a fuzzy accept. A brand that IS printed but does not resolve is either a
 *      KNOWN-BUT-UNVERIFIED brand (brand_not_verified, from brand-map.json's own pendingVerification
 *      list) or a name this project has never heard of at all (not_in_mapping_table / an ambiguous
 *      near-miss menu). Either way, ingredientsAsPrinted is NEVER consulted as a fallback: a
 *      printed-but-unverified brand's ingredients are exactly the one reading decision (d) says not
 *      to trust the model with on its own say-so.
 *   2. Only when NO brand is printed does ingredientsAsPrinted get used, each entry EXACT-matched
 *      only (no near-miss - "did you mean...?" only makes sense for a brand name, not for a string
 *      the model already claims is a plain ingredient) - and matched against `ingredientIndex` ALONE
 *      (buildIngredientIndex's output), never the combined brandIndex: a brand name typed into this
 *      field, or an SFDA/brand row whose key happens to collide with a real ingredient name, must
 *      never resolve here (the exact bug this parameter closes - see buildIngredientIndex's own
 *      comment and agents/knowledge/test/travel-check.test.js). A combination resolves only when
 *      EVERY entry resolves; one miss refuses the whole reading rather than screening a partial list.
 *   3. Neither field printed or legible at all -> unresolved, 'no_readable_name' (the photo carried
 *      nothing to look up - the caller's G5 path).
 */
function resolveFields(fields, brandIndex, pendingNames, ingredientIndex, opts) {
  const brand = fields && typeof fields.brandAsPrinted === 'string' ? fields.brandAsPrinted.trim() : '';
  const ingredients = Array.isArray(fields && fields.ingredientsAsPrinted)
    ? fields.ingredientsAsPrinted.filter((x) => typeof x === 'string' && x.trim())
    : [];

  if (brand) {
    const r = resolveToIngredient(brand, brandIndex, opts);
    if (r.outcome === OUTCOME.RESOLVED || r.outcome === OUTCOME.NEEDS_CONFIRMATION) return r;
    if (pendingNames) {
      for (const key of candidateKeys(brand)) {
        const label = pendingNames.get(key);
        if (label) return { outcome: OUTCOME.UNRESOLVED, reason: 'brand_not_verified', brandLabel: label, input: brand };
      }
    }
    return r;
  }

  if (ingredients.length === 0) return { outcome: OUTCOME.UNRESOLVED, reason: 'no_readable_name', input: null };

  // Exact match only, against ingredientIndex alone (never brandIndex - see the parameter comment
  // above): pass a near-miss threshold no printed ingredient name can ever reach. A missing
  // ingredientIndex resolves nothing (fail closed) rather than silently falling back to the unsafe
  // combined map.
  const exactOnly = Object.assign({}, opts, { minLenForNearMiss: Infinity });
  const parts = [];
  for (const name of ingredients) {
    const r = resolveToIngredient(name, ingredientIndex || new Map(), exactOnly);
    if (r.outcome !== OUTCOME.RESOLVED) {
      return { outcome: OUTCOME.UNRESOLVED, reason: 'combination_ingredient_unresolved', missing: name, input: ingredients };
    }
    parts.push(r);
  }
  const ingredientKeys = [];
  const ingredientLabels = [];
  for (const part of parts) {
    for (let i = 0; i < part.ingredients.length; i++) {
      if (ingredientKeys.indexOf(part.ingredients[i]) === -1) {
        ingredientKeys.push(part.ingredients[i]);
        ingredientLabels.push(part.ingredientLabels[i]);
      }
    }
  }
  return {
    outcome: OUTCOME.RESOLVED,
    ingredients: ingredientKeys,
    ingredientLabels,
    isCombination: ingredientKeys.length > 1,
    brandLabel: ingredientLabels.join(' + '),
    via: 'ingredients_as_printed',
    matchedOn: ingredients.join(' + '),
    sfdaTradeName: null
  };
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

module.exports = { OUTCOME, buildBrandIndex, buildIngredientIndex, resolveToIngredient, resolveFields, buildPendingNames };
