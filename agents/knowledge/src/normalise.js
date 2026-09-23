'use strict';

/* ---------------------------------------------------------------------------
 * normalise.js - canonical drug-name normalisation.
 *
 * Pure, deterministic, no I/O, no model involvement. Every drug name entering
 * the knowledge chain - from a prescription, from a brand map, from a vision
 * model reading a box - passes through normaliseDrugName() before it is used
 * as a lookup key. If two names normalise to the same string they are treated
 * as the same ingredient; if they do not, they are not. There is no fuzzy
 * matching in the lookup path (see resolve.js for why).
 *
 * Changed for the Jur'ah backend (2026-09-23):
 *   - ingredientsOf() splits a combination name as the backend stores it
 *     ("Calcium carbonate + vitamin D3", rx-009) into its ingredients. Before,
 *     the whole string was one key, matched nothing, and the Levothyroxine x
 *     Calcium carbonate pair that IS in the index was never found.
 *   - A small, explicit synonym table (INN / USAN spellings of the SAME
 *     molecule). It never maps one drug to a different drug.
 *   - Arabic punctuation (، ؛ ؟) is a separator, like its Latin counterpart.
 * ------------------------------------------------------------------------- */

// Salt / ester / hydrate forms that do not change the active moiety for the
// purposes of an interaction lookup. Order matters: longest first, so that
// "hydrogen tartrate" is stripped before "tartrate".
const SALT_FORMS = [
  'hydrogen tartrate', 'acid maleate', 'hydrobromide', 'hydrochloride',
  'dihydrochloride', 'monohydrate', 'dihydrate', 'trihydrate', 'anhydrous',
  'besylate', 'besilate', 'mesylate', 'mesilate', 'tosylate', 'maleate',
  'tartrate', 'succinate', 'fumarate', 'citrate', 'acetate', 'phosphate',
  'sulphate', 'sulfate', 'nitrate', 'gluconate', 'carbonate', 'bicarbonate',
  'lactate', 'stearate', 'palmitate', 'valerate', 'propionate', 'furoate',
  'dipropionate', 'xinafoate', 'bromide', 'chloride', 'iodide', 'oxalate',
  'pamoate', 'embonate', 'napadisylate', 'sodium', 'potassium', 'calcium',
  'magnesium', 'disodium', 'dipotassium', 'hemihydrate'
];

// Dosage-form and packaging words that carry no identity information.
const FORM_WORDS = [
  'tablets', 'tablet', 'tabs', 'tab', 'capsules', 'capsule', 'caps', 'cap',
  'film coated', 'film-coated', 'coated', 'prolonged release', 'modified release',
  'extended release', 'sustained release', 'slow release', 'delayed release',
  'effervescent', 'dispersible', 'chewable', 'sublingual', 'oral solution',
  'oral suspension', 'suspension', 'solution', 'syrup', 'injection', 'infusion',
  'ampoule', 'ampoules', 'vial', 'vials', 'cream', 'ointment', 'gel', 'drops',
  'inhaler', 'spray', 'patch', 'suppository', 'sachet', 'sachets', 'powder',
  'retard', 'sr', 'xr', 'xl', 'mr', 'cr', 'la', 'od', 'f c'
];
// NOT form words, on purpose: 'plus' and 'forte'. "Nurofen Plus", "Coversyl Plus" and "Micardis Plus"
// are combination products whose base brand is a single ingredient; stripping the word would resolve
// them to the base product and drop an ingredient from screening.

/**
 * Two spellings of ONE molecule -> the spelling the interaction index uses
 * (DDInter uses USAN "Acetaminophen" and "Cholecalciferol"). Every row here is
 * the same substance under another official name - never a related drug, never
 * a class. Keys and values are already normalised.
 */
const SYNONYMS = {
  'paracetamol': 'acetaminophen',
  'chlorphenamine': 'chlorpheniramine',
  'vitamin d3': 'cholecalciferol',
  'colecalciferol': 'cholecalciferol'
};

/**
 * Strip a strength expression such as "500 mg", "12.5mg", "100mcg", "5 ml",
 * "10 iu", "0.5 g", and percentage strengths such as "0.1%".
 */
function stripStrength(s) {
  return s
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|ug|\u00b5g|g|ml|l|iu|units?|%)\b/g, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml)\b/g, ' ');
}

function stripPhrases(s, phrases) {
  let out = s;
  for (const p of phrases) {
    out = out.replace(new RegExp('(^|\\s)' + p.replace(/[-]/g, '[- ]') + '(?=\\s|$)', 'g'), ' ');
  }
  return out;
}

/**
 * normaliseDrugName("Eltroxin® 100mcg Tablets") -> "eltroxin"
 * normaliseDrugName("Levothyroxine Sodium")      -> "levothyroxine sodium"
 *
 * Returns '' for input that contains no usable characters. Callers MUST treat
 * '' as unresolved, never as a match.
 */
function normaliseDrugName(raw) {
  if (raw === null || raw === undefined) return '';
  let s = String(raw).toLowerCase();

  // Unicode tidy-up: strip diacritics, normalise Arabic-Indic digits, drop
  // trademark marks, Arabic punctuation and any character that is not a
  // letter, digit, space, hyphen or full stop.
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  s = s.replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  s = s.replace(/[\u00ae\u2122\u00a9]/g, ' ');
  s = s.replace(/[\u060c\u061b\u061f\u066b\u066c\u06d4]/g, ' ');
  s = s.replace(/[^a-z0-9\u0600-\u06ff\s.\-]/g, ' ');

  s = stripStrength(s);
  s = s.replace(/[.\-]+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  s = stripPhrases(s, FORM_WORDS);
  s = s.replace(/\s+/g, ' ').trim();

  // Anything numeric-only left over is packaging noise, not identity.
  s = s.split(' ').filter((w) => w && !/^\d+$/.test(w)).join(' ');

  return s.trim();
}

/** A normalised name, with an exact synonym applied if one exists. */
function canonical(raw) {
  const n = normaliseDrugName(raw);
  return Object.prototype.hasOwnProperty.call(SYNONYMS, n) ? SYNONYMS[n] : n;
}

/**
 * Salt-stripped variant. NOT used on its own: "ferrous sulfate" and
 * "calcium carbonate" are drugs whose salt word carries the identity, and
 * stripping it leaves nonsense ("ferrous") or nothing at all. So this is only
 * ever offered as a FALLBACK key, tried after the full normalised name.
 */
function stripSaltForms(normalised) {
  let s = stripPhrases(' ' + normalised + ' ', SALT_FORMS);
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Ordered lookup keys for a raw drug name, most specific first. A lookup walks
 * this list and stops at the first hit, so "levothyroxine sodium" still finds
 * "levothyroxine" while "ferrous sulfate" is never reduced to "ferrous"
 * unless nothing matched the full name. Bracketed text ("(Zocor)") is dropped
 * only in a later key.
 */
function candidateKeys(raw) {
  const full = canonical(raw);
  if (!full) return [];
  const keys = [full];
  // "Simvastatin (Zocor)": the name outside the brackets, tried second - still an exact match.
  const noBrackets = raw === null || raw === undefined ? '' : canonical(String(raw).replace(/\([^)]*\)|\[[^\]]*\]/g, ' '));
  if (noBrackets && keys.indexOf(noBrackets) === -1) keys.push(noBrackets);
  for (const k of keys.slice()) {
    const stripped = stripSaltForms(k);
    if (stripped && keys.indexOf(stripped) === -1) keys.push(stripped);
  }
  return keys;
}

/**
 * The ingredients of a stored generic name, each canonical, in order, unique.
 *   ingredientsOf("Calcium carbonate + vitamin D3") -> ["calcium carbonate", "cholecalciferol"]
 *   ingredientsOf("Warfarin")                         -> ["warfarin"]
 *   ingredientsOf("")                                 -> []
 * The split happens on the RAW string, before normalisation removes the "+".
 * ingredientParts() keeps each part's text as written, for labels.
 */
function ingredientParts(genericName) {
  if (genericName === null || genericName === undefined) return [];
  // Strengths first, so "100 units/ml" or "5 mg/5 ml" never splits into an "ingredient" called "ml".
  const cleaned = String(genericName)
    .replace(/\d+(?:[.,]\d+)?\s*(?:mg|mcg|ug|\u00b5g|g|ml|l|iu|units?|%)\s*\/\s*\d*(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|l|dose|tab(?:let)?|cap(?:sule)?)\b/gi, ' ')
    .replace(/\d+(?:[.,]\d+)?\s*(?:mg|mcg|ug|\u00b5g|g|ml|l|iu|units?|%)(?![a-z])/gi, ' ');
  const parts = cleaned.split(/\s*(?:\+|\/|,|\u060c|&|\band\b|\bwith\b)\s*/i);
  const out = [];
  for (const part of parts) {
    // "Simvastatin (Zocor)": the bracket is a clarifier (brand, salt), not a second ingredient; the
    // key is the name outside it. A part that is ONLY a bracket keeps its content.
    const outside = canonical(part.replace(/\([^)]*\)|\[[^\]]*\]/g, ' '));
    const key = outside || canonical(part);
    if (key && !out.some((x) => x.key === key)) out.push({ key, text: part.trim() });
  }
  return out;
}

function ingredientsOf(genericName) {
  return ingredientParts(genericName).map((x) => x.key);
}

/**
 * Stable key for an unordered pair of ingredients. Sorting means
 * pairKey(a,b) === pairKey(b,a), so the index needs one row per pair.
 */
function pairKey(a, b) {
  const x = canonical(a);
  const y = canonical(b);
  if (!x || !y) return null;
  return x < y ? x + '|' + y : y + '|' + x;
}

/** Levenshtein distance, capped for speed. Used ONLY to offer a clarifying
 *  question to the patient - never to silently accept a near match. */
function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

module.exports = {
  normaliseDrugName, canonical, stripSaltForms, candidateKeys, ingredientParts, ingredientsOf, pairKey, editDistance, SYNONYMS
};
