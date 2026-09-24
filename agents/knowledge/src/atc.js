'use strict';

/* ---------------------------------------------------------------------------
 * atc.js - the WHO ATC codes of the seed ingredients (data/seed-drug-scope.json),
 * read and checked. Used at build time (scripts/build-demo-index.js), by
 * `npm run coverage` and by the tests; never inlined into a workflow - the
 * workflows read only the categories the build copied into the index.
 *
 * Why the categories matter: a DDInter 2.0 download file (ddinter_downloads_code_<X>.csv)
 * lists the interactions of the drugs in ATC category X. With only some files loaded, a
 * pair whose two drugs both sit outside the loaded categories can never appear in the
 * index, so its absence says nothing. src/interactions.js turns that into "cannot verify".
 * ------------------------------------------------------------------------- */

const { canonical } = require('./normalise');

/** A level-5 ATC code: letter, two digits, two letters, two digits (B01AA03). */
const ATC_CODE = /^[A-Z][0-9]{2}[A-Z]{2}[0-9]{2}$/;
const WHO_INDEX = 'https://atcddd.fhi.no/atc_ddd_index/';

/** The top-level categories of a list of codes, unique and sorted ("B01AA03" -> "B"). */
function categoriesOfCodes(codes) {
  return [...new Set(codes.map((c) => c[0]))].sort();
}

/**
 * Every problem with the seed file's ATC data, as sentences. Empty means usable.
 * An ingredient with no `atc` block is allowed (its categories are unknown, which screening
 * treats as not loaded); a malformed block is not, because a typo would silently change the rule.
 */
function atcProblems(scope) {
  const problems = [];
  const list = scope && Array.isArray(scope.seedIngredients) ? scope.seedIngredients : null;
  if (!list) return ['seedIngredients is missing'];
  for (const s of list) {
    const where = 'seed ingredient ' + JSON.stringify(s && s.name);
    if (!s || typeof s.name !== 'string' || !s.name.trim()) { problems.push(where + ': no name'); continue; }
    if (s.atc === undefined) continue;
    const a = s.atc;
    if (!a || typeof a !== 'object') { problems.push(where + ': atc is not an object'); continue; }
    if (typeof a.whoName !== 'string' || !a.whoName.trim()) problems.push(where + ': atc.whoName is missing');
    if (typeof a.searchUrl !== 'string' || a.searchUrl.indexOf(WHO_INDEX) !== 0) problems.push(where + ': atc.searchUrl is not a WHO ATC/DDD index URL');
    if (!Array.isArray(a.codes) || a.codes.length === 0) { problems.push(where + ': atc.codes is empty'); continue; }
    const seen = new Set();
    for (const c of a.codes) {
      if (!c || typeof c.code !== 'string' || !ATC_CODE.test(c.code)) { problems.push(where + ': not a level-5 ATC code: ' + JSON.stringify(c && c.code)); continue; }
      if (seen.has(c.code)) problems.push(where + ': ' + c.code + ' listed twice');
      seen.add(c.code);
      if (typeof c.url !== 'string' || c.url.indexOf(WHO_INDEX) !== 0) problems.push(where + ': ' + c.code + ' has no WHO ATC/DDD index URL');
    }
  }
  return problems;
}

/**
 * Map: canonical ingredient key -> its ATC top-level categories. Ingredients without an `atc`
 * block are absent from the map (unknown). Throws on malformed data: this feeds a safety rule.
 */
function seedAtcCategories(scope) {
  const problems = atcProblems(scope);
  if (problems.length) throw new Error('data/seed-drug-scope.json ATC data is not usable:\n  ' + problems.join('\n  '));
  const out = new Map();
  for (const s of scope.seedIngredients) if (s.atc) out.set(canonical(s.name), categoriesOfCodes(s.atc.codes.map((c) => c.code)));
  return out;
}

/** The codes of one seed ingredient in the given categories (for the build's code-page check). */
function codesIn(entry, categories) {
  return entry && entry.atc ? entry.atc.codes.filter((c) => categories.indexOf(c.code[0]) !== -1) : [];
}

/**
 * The build's proof that each claimed category really lists all of a drug's interactions.
 *   claimed:  Map drug -> the loaded categories its ATC codes put it in
 *   partners: { <category file>: Map drug -> Set(partner) }, every row of that file
 *   loaded:   the category files loaded, e.g. ['A', 'B', 'H']
 *   entries:  Map drug -> its seed-drug-scope.json entry (for the code-page rule)
 * Returns { checks, problems }. Any problem means the category must not be written:
 *   - the code behind a loaded category was not read on its own WHO code page;
 *   - the drug has no row in that category's file;
 *   - a partner found in another loaded file is missing from that category's file;
 *   - no other loaded file lists the drug, so nothing could be cross-checked.
 */
function crossCheckCategories(claimed, partners, loaded, entries) {
  const checks = [];
  const problems = [];
  for (const [drug, cats] of claimed) {
    for (const c of codesIn(entries.get(drug), cats)) {
      if (c.url.indexOf('?code=' + c.code) === -1) problems.push(drug + ': ' + c.code + ' puts it in loaded category ' + c.code[0] + ', but was not read on its own WHO code page');
    }
    for (const cat of cats) {
      const own = partners[cat] && partners[cat].get(drug);
      if (!own || own.size === 0) { problems.push(drug + ': WHO ATC puts it in ' + cat + ', but DDInter file ' + cat + ' has no row for it'); continue; }
      const others = loaded.filter((x) => x !== cat);
      const cross = new Set();
      for (const x of others) for (const p of (partners[x] && partners[x].get(drug)) || []) cross.add(p);
      if (cross.size === 0) { problems.push(drug + ': category ' + cat + ' cannot be cross-checked - no other loaded file lists it'); continue; }
      const missing = [...cross].filter((p) => !own.has(p));
      if (missing.length) {
        problems.push(drug + ': DDInter file ' + cat + ' lacks ' + missing.length + ' of its ' + cross.size + ' partners from files ' + others.join(', ') +
          ' (e.g. ' + missing.slice(0, 3).join(', ') + ') - the file does not list all its interactions');
        continue;
      }
      checks.push(drug + ' in ' + cat + ': file ' + cat + ' has ' + own.size + ' partners, including all ' + cross.size + ' found in files ' + others.join(', '));
    }
  }
  return { checks, problems };
}

module.exports = { ATC_CODE, WHO_INDEX, categoriesOfCodes, atcProblems, seedAtcCategories, codesIn, crossCheckCategories };
