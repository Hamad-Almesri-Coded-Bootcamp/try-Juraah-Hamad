'use strict';

/* ---------------------------------------------------------------------------
 * build-sfda-brands.js - group raw SFDA register rows into base trade names,
 * each carrying the DISTINCT ingredient sets seen under that base name.
 *
 * Output: agents/knowledge/data/sfda-brands.json, consumed by another
 * builder's resolver as a broader, machine-derived companion to the 18
 * hand-verified rows of data/brand-map.json (which THIS script never reads
 * or writes - brand-map.json keeps priority in src/resolve.js, unconditionally).
 *
 * Input: agents/knowledge/data/build/sfda-rows.json - a git-ignored, local-only
 * copy of the SFDA public register rows ({scientificName, tradeName, strength,
 * dosageForm, regNo, page}), fetched by an earlier session, never by this
 * script (this script makes no network call and reads only local disk).
 *
 * Every name and ingredient in the output is copied, uppercased and grouped
 * from a real row of that input file - nothing here is invented. A trade
 * name that strips down to nothing keeps its plain uppercased form (never
 * blanked, never dropped).
 *
 * Source licence: the SFDA register is the Saudi Food and Drug Authority's
 * own public registered-drug list (https://www.sfda.gov.sa/en/drugs-list).
 * This file carries no DDInter content and so carries no DDInter attribution;
 * DDInter's CC BY-NC-SA 4.0 notice belongs on whatever file later JOINS this
 * one against DDInter's interaction data, not on this SFDA-only file.
 *
 * Pure functions below have no I/O and are exported for tests. main() is the
 * CLI entry point (reads the input file, writes the output file, logs one
 * summary line) and only runs when this file is executed directly.
 * ------------------------------------------------------------------------- */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const INPUT_PATH = path.join(ROOT, 'data', 'build', 'sfda-rows.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'sfda-brands.json');

const SOURCE = 'Saudi Food and Drug Authority public registered-drug list';
const SOURCE_URL = 'https://www.sfda.gov.sa/en/drugs-list';
const RETRIEVED_AT = '2026-09-26';

const METHOD =
  'Group raw SFDA rows by trade name with the row\'s own strength value(s), ' +
  'strength/unit tokens, bracketed pack counts, route/dosage-form words and ' +
  'phrases stripped (uppercased first, then punctuation normalised, a lone ' +
  'FOR/PER/WITH/OR left at an edge removed, spaces collapsed); scientific-name ' +
  'commas split at parenthesis depth zero (a short documented list of known ' +
  'comma-names is protected first) into a sorted, deduplicated, uppercased ' +
  'ingredient set per row, rows with no ingredient dropped; a trade name that ' +
  'strips to empty keeps the plain uppercased trade name; line-extension words ' +
  '(EXTRA, PLUS, FORTE, NIGHT, COLD & FLU, ADVANCE, XR, SR, ...) are not stripped.';

// ---------------------------------------------------------------------------
// Word lists. These are the SFDA TRADE-NAME vocabulary (abbreviations and all)
// - a different list from src/normalise.js's FORM_WORDS, which normalises
// PRESCRIPTION generic names for the runtime lookup key and is not touched or
// reused here on purpose (this file does not import from src/, and src/ does
// not yet import this file - the wiring is another builder's task).

/** "(50 SACHET)" style pack counts: a bracket whose whole content is a number
 *  plus one of these container words. Only THIS shape is treated as a pack
 *  count; every other bracketed remark in the real data ("(F-A)", "(EQU.
 *  1.00MG)", "(9)") is left as part of the identity, because guessing it is
 *  noise would silently merge products that may be genuinely different. */
const PACK_WORDS =
  'SACHETS?|TABLETS?|TABS?|CAPSULES?|CAPS?|VIALS?|AMPOULES?|AMPS?|BLISTERS?|' +
  'BOTTLES?|SYRINGES?|PIECES?|PCS?|DOSES?';

/** Dosage-form words/phrases removed from the trade-name text, per the task
 *  spec. DROPS? (not just DROPS) because the real data has both "EYE DROPS"
 *  and "EAR DROP" (singular) - grounded in the actual rows, not guessed.
 *
 *  The first entry is route/connector PHRASES built from the word "FOR"
 *  (real data: "POWDER FOR ORAL SUSPENSION", "SOLUTION FOR INJECTION",
 *  "POWDER FOR SOLUTION FOR INFUSION") - stripped as one unit, before any
 *  lone form word, so "FOR" is never left stranded once the word after it
 *  is gone (reviewer findings: "MEGAMOX ES FOR", "ORENCIA FOR FOR").
 *
 *  F[.\-\s]?C\.? (was F\.C\.? - a literal dot only) now also matches the
 *  real "F-C" and "F C" spellings ("SEROQUEL 300MG F-C TABS"), so it never
 *  leaves a stray "F C" behind for the punctuation-normalise step to expose
 *  as its own two-letter "name".
 *
 *  VIALS?, AMP(OULES?)?, SUPP..., CONC..., I.V./I.M., INHALATION, EYE, EAR,
 *  NASAL, SPRAY, TOPICAL, RECONSTIT(UTED)? are added on the reviewer's real-
 *  data counts (VIAL 221, AMP 70, EYE 72 rows, etc. - see the real-data
 *  tests below). RECONSTIT(?:UTED)? (not just RECONSTITUTED) because the
 *  real row ("ZITHROMAX ... SUSP.AFTER RECONSTIT") is truncated to exactly
 *  "RECONSTIT" in the source - matching only the full word would miss the
 *  one real case this fixes, so the ending is optional. */
const FORM_WORD_PATTERNS = [
  'FOR\\s+(?:I\\.?V\\.?|I\\.?M\\.?|INJ(?:ECTION)?|INFUSION|ORAL|USE|SOLUTION|SUSP(?:ENSION)?)',
  'TABLETS?', 'TABS?',
  'F[.\\-\\s]?C\\.?', 'FILM[- ]COATED',
  'CAPSULES?', 'CAPS?',
  'SYRUP',
  'SUSP(?:ENSION)?',
  'ORAL',
  'SOLUTION', 'SOLU',
  'DROPS?',
  'INJ(?:ECTION)?',
  'INFUSION',
  'CREAM',
  'GEL',
  'OINT(?:MENT)?',
  'SACHETS?',
  'EFFERVESCENT',
  'CHEWABLE',
  'POWDER',
  'PRE[- ]FILLED SYRINGE',
  'VIALS?',
  'AMP(?:OULES?)?',
  'SUPP(?:OSITOR(?:Y|IES))?',
  'CONC(?:ENTRATE)?',
  'I\\.?V\\.?',
  'I\\.?M\\.?',
  'INHALATION',
  'EYE',
  'EAR',
  'NASAL',
  'SPRAY',
  'TOPICAL',
  'RECONSTIT(?:UTED)?'
];

/** Lone connector words that are only ever load-bearing BETWEEN two other
 *  words (a dosage-form phrase such as "solution for injection", or "mg per
 *  ml") - once everything around them is stripped, a leftover copy at the
 *  very start or end of the name is noise, never an identity ("MEGAMOX ES
 *  FOR", "TYENNE PER" in the reviewer findings). Removed only at an edge,
 *  repeatedly, so "FOR FOR" (both occurrences trailing) also clears; never
 *  removed from the middle of a name that still has real words on both
 *  sides of it. */
const EDGE_CONNECTOR_WORDS = 'FOR|PER|WITH|OR';
const RE_EDGE_CONNECTOR_LEAD = new RegExp('^(?:' + EDGE_CONNECTOR_WORDS + ')(?:\\s+|$)');
const RE_EDGE_CONNECTOR_TAIL = new RegExp('(?:^|\\s+)(?:' + EDGE_CONNECTOR_WORDS + ')$');

const NUM = '\\d+(?:\\.\\d+)?';

/** The SFDA trade-name UNIT vocabulary, shared by every numeric-token
 *  pattern below (a plain "NUMBER UNIT", a per-ML concentration, a
 *  slash-combination strength, and the row's-own-strength stripper).
 *  Longer/more-specific alternatives are listed before shorter ones that
 *  could otherwise match just a prefix of them, purely for readability -
 *  every alternative here is wrapped (directly or via a trailing \b) so a
 *  short alternative that would leave a letter dangling ("G" inside "GM")
 *  is rejected and the engine backtracks to a longer one, regardless of
 *  list order. I\\.?\\s*U\\.? covers "IU", "I U", "I.U" and "I.U." in one
 *  pattern (real data has all four spellings). */
const UNIT_WORDS =
  'MICROGRAMS?|MICROGM|MCG|MMOL|MEQ|GRAMS?|GM|MG|G|ML|L|UNITS?|U|I\\.?\\s*U\\.?';

/** The separator between a unit and the "ML" of a per-ML concentration:
 *  optional space, then an optional "/", "-" or a literal backslash (the
 *  real row "NOVORAPID FLEXPEN 100U\\ML" has a bare backslash), then
 *  optional space again - or no separator character at all ("100 I U ML"). */
const RE_UNIT_ML_SEP = '\\s*(?:[/\\\\-]\\s*)?';

const RE_PACK_COUNT = new RegExp('\\(\\s*\\d+\\s*(?:' + PACK_WORDS + ')\\s*\\)', 'g');
// Compound concentration expressions: "5MG/ML", "15MG-ML", "120MG-5ML",
// "100 I.U - ML", "100U\ML", "2MICROGRAM-ML". The second number is wrapped
// in its OWN group before the "?": NUM already ends in an optional group, so
// "NUM + '?'" would only make that inner group lazy, not make the whole
// number optional - "(?:' + NUM + ')?" is the fix.
const RE_UNIT_PER_ML = new RegExp(
  NUM + '\\s*(?:' + UNIT_WORDS + ')' + RE_UNIT_ML_SEP + '(?:' + NUM + RE_UNIT_ML_SEP + ')?ML\\b',
  'g'
);
// Slash-combination strengths: "150/75 IU", "500/125 MG".
const RE_SLASH_COMBO_UNIT = new RegExp(NUM + '(?:\\s*/\\s*' + NUM + ')+\\s*(?:' + UNIT_WORDS + '|%)\\b', 'g');
// Percentages, with or without a preceding space: "0.1%", "40% w/v".
const RE_PERCENT = new RegExp(NUM + '\\s*%', 'g');
// A bare number immediately followed by a unit word: "500 MG", "600MG",
// "1 G", "1000 IU", "1GM", "40MEQ".
const RE_SIMPLE_UNIT = new RegExp(NUM + '\\s*(?:' + UNIT_WORDS + ')\\b', 'g');
const RE_WV = /\bW\/V\b/g;

/** Escape a literal string for safe embedding inside a `new RegExp(...)`
 *  source - needed wherever a value from the DATA (never a fixed word list)
 *  is turned into part of a pattern, so a stray "." or "(" in that value is
 *  matched literally instead of acting as a regex metacharacter. */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove THIS row's own strength value(s) from the (already uppercased)
 * trade-name text, as a whole numeric token - a bare number ("LYRICA 75"
 * with strength "75"), or the number immediately followed by a unit word
 * ("LYRICA 75MG" with strength "75"). `strength` is the row's raw strength
 * field, which can list more than one value for a combination product
 * ("75,20"): each value is tried on its own, split on the same comma the
 * task spec uses for scientificName.
 *
 * Only a token that is PURELY numeric (an integer or a decimal) is ever
 * removed, and only as a whole token - bounded so "75" never matches inside
 * "1750" or "17.5". This removes a number this exact row's own data
 * confirms is a dosage strength; it never guesses at some OTHER number that
 * merely looks like one (the bracketed "(9)" and "(F-A)" cases stay dosage-
 * strength-less rows unaffected, because nothing in THOSE rows says "9" is
 * a strength).
 *
 * Pure: same input always gives the same output, no I/O.
 */
function stripOwnStrengthTokens(s, strength) {
  if (strength === null || strength === undefined) return s;
  const raw = String(strength);
  if (!raw.trim()) return s;
  let out = s;
  for (const token of raw.split(',')) {
    const value = token.trim();
    if (!value || !/^\d+(?:\.\d+)?$/.test(value)) continue;
    const re = new RegExp(
      '(?<![A-Z0-9.])' + escapeRegExp(value) + '(?:\\s*(?:' + UNIT_WORDS + '))?(?![A-Z0-9.])',
      'g'
    );
    out = out.replace(re, ' ');
  }
  return out;
}

/** Remove a lone FOR/PER/WITH/OR sitting at the very start or end of an
 *  already-collapsed, already-trimmed name, repeatedly (so "FOR FOR" at the
 *  end clears in two passes, not one). Never touches one of these words
 *  sitting between two other real words - that is left exactly as stripped,
 *  since the spec calls out only the edge case. Pure. */
function stripEdgeConnectors(s) {
  let out = s;
  for (let i = 0; i < 6; i++) {
    const next = out
      .replace(RE_EDGE_CONNECTOR_LEAD, '')
      .replace(RE_EDGE_CONNECTOR_TAIL, '')
      .trim()
      .replace(/\s+/g, ' ');
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Remove each pattern in `patterns` from `s` wherever it occurs as a whole
 *  word - bounded by "not another letter/digit" on both sides, rather than
 *  strictly whitespace, so a word still counts as whole right up against
 *  stray punctuation this stage runs before ("Injection*", "SOLU.", "(TAB)")
 *  and is not itself consumed as part of a longer alphanumeric run
 *  ("TABLET" inside the typo "TABLETE" is correctly left alone: the letter
 *  after where "TABLET" would end is "E", which fails the lookahead). */
function stripWordPatterns(s, patterns) {
  let out = s;
  for (const p of patterns) {
    out = out.replace(new RegExp('(?<![A-Z0-9])(?:' + p + ')(?![A-Z0-9])', 'g'), ' ');
  }
  return out;
}

/**
 * computeBaseTradeName("BRUFEN TAB 600MG")            -> "BRUFEN"
 * computeBaseTradeName("PANADOL EXTRA TAB")           -> "PANADOL EXTRA"
 * computeBaseTradeName("GLUCOPHAGE XR 750MG TABLET")  -> "GLUCOPHAGE XR"
 * computeBaseTradeName("LYRICA 75", "75")             -> "LYRICA"
 *
 * `strength` is the row's own strength field (optional - omitted, it behaves
 * exactly as before: strength/unit tokens are still stripped wherever a unit
 * word is attached, just not a bare number with none).
 *
 * Pure: same input always gives the same output, no I/O.
 */
function computeBaseTradeName(tradeName, strength) {
  const original = String(tradeName === null || tradeName === undefined ? '' : tradeName);
  let s = original.toUpperCase();

  // The general unit patterns run FIRST, so a compound expression such as
  // "2MCG-ML" is recognised and removed as ONE whole per-ML concentration
  // before the row's-own-strength pass below ever sees it. If that pass ran
  // first it would strip only the "2MCG" part (its own optional-unit suffix
  // has no idea "-ML" follows), stranding "-ML" as a leftover word once the
  // now-unattached leading number is gone - this order avoids that.
  s = s.replace(RE_PACK_COUNT, ' ');
  s = s.replace(RE_UNIT_PER_ML, ' ');
  s = s.replace(RE_SLASH_COMBO_UNIT, ' ');
  s = s.replace(RE_PERCENT, ' ');
  s = s.replace(RE_SIMPLE_UNIT, ' ');
  s = s.replace(RE_WV, ' ');

  // Whatever is left of the row's own strength value(s) at this point is a
  // BARE number with no unit at all ("LYRICA 75") - anything with a unit
  // attached was already removed above.
  s = stripOwnStrengthTokens(s, strength);

  s = stripWordPatterns(s, FORM_WORD_PATTERNS);

  // Punctuation normalised: keep letters, digits, space and "&" (load-bearing
  // for line extensions like "COLD & FLU"); everything else becomes a space.
  s = s.replace(/[^A-Z0-9 &]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  // A lone connector word left at an edge by the stripping above ("MEGAMOX
  // ES FOR", "TYENNE PER") is noise, not identity - see stripEdgeConnectors.
  s = stripEdgeConnectors(s);

  // A name that becomes empty keeps the uppercased trade name.
  if (!s) {
    s = original.toUpperCase().replace(/\s+/g, ' ').trim();
  }
  return s;
}

/** A small, DOCUMENTED list of comma phrases that are part of ONE ingredient
 *  name in the real SFDA data, not a separator between two ingredients -
 *  found by inspection of the actual rows (KOATE DVI, ROTARIX, AMINOVEN),
 *  not guessed, and deliberately not exhaustive: a scientificName with some
 *  OTHER internal comma not in this list (or not inside parentheses) still
 *  splits there, same as before. Checked case-insensitively, before the
 *  depth-aware split below, on the raw (not yet split) text. */
const KNOWN_COMMA_INGREDIENT_SUFFIXES = [
  ', HUMAN RECOMBINANT',
  ', LIVE ATTENUATED VACCINE',
  ', SOURCE UNSPECIFIED'
];
const RE_KNOWN_COMMA_SUFFIX = new RegExp(
  KNOWN_COMMA_INGREDIENT_SUFFIXES.map(escapeRegExp).join('|'),
  'gi'
);
// A placeholder that never appears in real ingredient text, used to hide a
// protected comma from the split below and restore it immediately after.
const COMMA_PLACEHOLDER = '\u0000';

/** Split `s` on "," but only where parenthesis depth is zero, so a comma
 *  that is itself inside a parenthetical remark ("MUMPS VIRUS (JERYL LYNN,
 *  STRAIN RIT 4385) LIVE ATTENUATED") never splits that one ingredient into
 *  two. Depth never goes negative on a stray ")". Pure. */
function splitTopLevelCommas(s) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of s) {
    if (ch === '(') {
      depth += 1;
      current += ch;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
      current += ch;
    } else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/**
 * ingredientSet("SODIUM CHLORIDE,POTASSIUM CHLORIDE") -> ["POTASSIUM CHLORIDE","SODIUM CHLORIDE"]
 * ingredientSet("MUMPS VIRUS (JERYL LYNN, STRAIN RIT 4385) LIVE ATTENUATED,MEASLES VIRUS (SCHWARZ) LIVE ATTENUATED")
 *   -> ["MEASLES VIRUS (SCHWARZ) LIVE ATTENUATED", "MUMPS VIRUS (JERYL LYNN, STRAIN RIT 4385) LIVE ATTENUATED"]
 * Uppercased, trimmed, deduplicated, sorted; a comma inside parentheses, or
 * one of the KNOWN_COMMA_INGREDIENT_SUFFIXES above, never splits. Pure.
 */
function ingredientSet(scientificName) {
  const raw = scientificName === null || scientificName === undefined ? '' : String(scientificName);
  const protectedRaw = raw.replace(RE_KNOWN_COMMA_SUFFIX, (m) => m.replace(/,/g, COMMA_PLACEHOLDER));
  const parts = splitTopLevelCommas(protectedRaw)
    .map((s) => s.replace(/\u0000/g, ',').trim().toUpperCase())
    .filter(Boolean);
  return [...new Set(parts)].sort();
}

/**
 * buildNamesIndex(rows) -> { "<BASE TRADE NAME>": [ ["ING A","ING B"], ... ] }
 * Each base name lists its DISTINCT ingredient sets, first-seen order. A row
 * whose scientificName yields no ingredient at all (real data: one row of
 * "Entocort CR" has an empty scientificName) contributes no set and no key -
 * an empty array is never stored as one of a name's ingredient sets, since a
 * resolver checking "every ingredient in this set is on the box" against an
 * empty set would trivially match any box - the same fail-closed principle
 * as the rest of this project: unknown ingredients means "cannot verify",
 * never "matches everything". Pure.
 */
function buildNamesIndex(rows) {
  const names = {};
  for (const row of rows || []) {
    if (!row) continue;
    const base = computeBaseTradeName(row.tradeName, row.strength);
    const ingredients = ingredientSet(row.scientificName);
    if (ingredients.length === 0) continue;
    if (!names[base]) names[base] = [];
    const key = JSON.stringify(ingredients);
    if (!names[base].some((set) => JSON.stringify(set) === key)) {
      names[base].push(ingredients);
    }
  }
  return names;
}

/** How many rows contributed no ingredient at all (see buildNamesIndex) -
 *  computed separately, rather than returned out of buildNamesIndex itself,
 *  so that function keeps returning the plain `{name: [set, ...]}` map its
 *  existing callers and tests already depend on. Only used for main()'s log
 *  line ("skip a row... or log it"); never written into the output file, so
 *  it never touches the fixed meta shape another builder's resolver reads. */
function countRowsWithoutIngredients(rows) {
  let n = 0;
  for (const row of rows || []) {
    if (!row) continue;
    if (ingredientSet(row.scientificName).length === 0) n++;
  }
  return n;
}

/** Build the whole output object (meta + names) from already-parsed rows.
 *  `extra.sha256` is passed in by main() (the hash of the exact bytes read);
 *  this function itself does no hashing and no file I/O, so it stays pure
 *  and cheap to call from tests on tiny fixture arrays. */
function buildBrandsFile(rows, extra) {
  const options = extra || {};
  const names = buildNamesIndex(rows);
  return {
    meta: {
      source: SOURCE,
      url: SOURCE_URL,
      retrievedAt: options.retrievedAt || RETRIEVED_AT,
      sha256: options.sha256 || null,
      rows: (rows || []).length,
      names: Object.keys(names).length,
      method: METHOD
    },
    names
  };
}

function sha256Of(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** JSON.stringify, then escape every non-ASCII code unit as \uXXXX so the
 *  file on disk is byte-for-byte ASCII (the SFDA data has none, in practice,
 *  but registered-drug text is free-form and this makes the guarantee
 *  absolute rather than incidental). */
function asciiSafeStringify(value, indent) {
  const json = JSON.stringify(value, null, indent);
  return json.replace(/[\u0080-￿]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
}

function readRows(inputPath) {
  const buffer = fs.readFileSync(inputPath);
  const rows = JSON.parse(buffer.toString('utf8'));
  if (!Array.isArray(rows)) throw new Error('expected an array of rows in ' + inputPath);
  return { rows, buffer };
}

function main() {
  const { rows, buffer } = readRows(INPUT_PATH);
  const sha256 = sha256Of(buffer);
  const out = buildBrandsFile(rows, { sha256 });
  const json = asciiSafeStringify(out, 2) + '\n';
  fs.writeFileSync(OUTPUT_PATH, json);
  console.log(
    'wrote ' + path.relative(ROOT, OUTPUT_PATH) +
    ' - ' + out.meta.rows + ' rows, ' + out.meta.names + ' names, ' +
    Buffer.byteLength(json) + ' bytes, sha256 ' + sha256
  );
  const skipped = countRowsWithoutIngredients(rows);
  if (skipped > 0) {
    console.log(
      'note: ' + skipped + ' row(s) had no ingredient at all (empty ' +
      'scientificName) and contributed no set to any name'
    );
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  INPUT_PATH,
  OUTPUT_PATH,
  PACK_WORDS,
  FORM_WORD_PATTERNS,
  UNIT_WORDS,
  KNOWN_COMMA_INGREDIENT_SUFFIXES,
  stripWordPatterns,
  stripOwnStrengthTokens,
  stripEdgeConnectors,
  splitTopLevelCommas,
  escapeRegExp,
  computeBaseTradeName,
  ingredientSet,
  buildNamesIndex,
  countRowsWithoutIngredients,
  buildBrandsFile,
  sha256Of,
  asciiSafeStringify,
  readRows,
  main
};
