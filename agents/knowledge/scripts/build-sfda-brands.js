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
  'Group raw SFDA rows by trade name with strength/unit tokens, bracketed pack ' +
  'counts and named dosage-form words stripped (uppercased first, then ' +
  'punctuation normalised, spaces collapsed); scientific-name commas split into ' +
  'a sorted, deduplicated, uppercased ingredient set per row; a trade name that ' +
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
 *  and "EAR DROP" (singular) - grounded in the actual rows, not guessed. */
const FORM_WORD_PATTERNS = [
  'TABLETS?', 'TABS?',
  'F\\.C\\.?', 'FILM[- ]COATED',
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
  'PRE[- ]FILLED SYRINGE'
];

const NUM = '\\d+(?:\\.\\d+)?';

const RE_PACK_COUNT = new RegExp('\\(\\s*\\d+\\s*(?:' + PACK_WORDS + ')\\s*\\)', 'g');
// Compound concentration expressions: "5MG/ML", "15MG-ML", "120MG-5ML", "50 IU-ML".
// The second number is wrapped in its OWN group before the "?": NUM already
// ends in an optional group, so "NUM + '?'" would only make that inner group
// lazy, not make the whole number optional - "(?:' + NUM + ')?" is the fix.
const RE_MG_IU_PER_ML = new RegExp(NUM + '\\s*(?:MG|IU)\\s*[/-]\\s*(?:' + NUM + ')?\\s*ML\\b', 'g');
// Slash-combination strengths: "150/75 IU", "500/125 MG".
const RE_SLASH_COMBO_UNIT = new RegExp(NUM + '(?:\\s*/\\s*' + NUM + ')+\\s*(?:MG|MCG|G|ML|L|IU|%)\\b', 'g');
// Percentages, with or without a preceding space: "0.1%", "40% w/v".
const RE_PERCENT = new RegExp(NUM + '\\s*%', 'g');
// A bare number immediately followed by a unit word: "500 MG", "600MG", "1 G", "1000 IU".
const RE_SIMPLE_UNIT = new RegExp(NUM + '\\s*(?:MG|MCG|G|ML|L|IU)\\b', 'g');
const RE_WV = /\bW\/V\b/g;

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
 *
 * Pure: same input always gives the same output, no I/O.
 */
function computeBaseTradeName(tradeName) {
  const original = String(tradeName === null || tradeName === undefined ? '' : tradeName);
  let s = original.toUpperCase();

  s = s.replace(RE_PACK_COUNT, ' ');
  s = s.replace(RE_MG_IU_PER_ML, ' ');
  s = s.replace(RE_SLASH_COMBO_UNIT, ' ');
  s = s.replace(RE_PERCENT, ' ');
  s = s.replace(RE_SIMPLE_UNIT, ' ');
  s = s.replace(RE_WV, ' ');

  s = stripWordPatterns(s, FORM_WORD_PATTERNS);

  // Punctuation normalised: keep letters, digits, space and "&" (load-bearing
  // for line extensions like "COLD & FLU"); everything else becomes a space.
  s = s.replace(/[^A-Z0-9 &]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  // A name that becomes empty keeps the uppercased trade name.
  if (!s) {
    s = original.toUpperCase().replace(/\s+/g, ' ').trim();
  }
  return s;
}

/**
 * ingredientSet("SODIUM CHLORIDE,POTASSIUM CHLORIDE") -> ["POTASSIUM CHLORIDE","SODIUM CHLORIDE"]
 * Uppercased, trimmed, deduplicated, sorted. Pure.
 */
function ingredientSet(scientificName) {
  const raw = scientificName === null || scientificName === undefined ? '' : String(scientificName);
  const parts = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  return [...new Set(parts)].sort();
}

/**
 * buildNamesIndex(rows) -> { "<BASE TRADE NAME>": [ ["ING A","ING B"], ... ] }
 * Each base name lists its DISTINCT ingredient sets, first-seen order. Pure.
 */
function buildNamesIndex(rows) {
  const names = {};
  for (const row of rows || []) {
    if (!row) continue;
    const base = computeBaseTradeName(row.tradeName);
    const ingredients = ingredientSet(row.scientificName);
    if (!names[base]) names[base] = [];
    const key = JSON.stringify(ingredients);
    if (!names[base].some((set) => JSON.stringify(set) === key)) {
      names[base].push(ingredients);
    }
  }
  return names;
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
}

if (require.main === module) {
  main();
}

module.exports = {
  INPUT_PATH,
  OUTPUT_PATH,
  PACK_WORDS,
  FORM_WORD_PATTERNS,
  stripWordPatterns,
  computeBaseTradeName,
  ingredientSet,
  buildNamesIndex,
  buildBrandsFile,
  sha256Of,
  asciiSafeStringify,
  readRows,
  main
};
