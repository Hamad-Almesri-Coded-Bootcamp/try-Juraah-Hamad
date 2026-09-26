'use strict';

/**
 * Rebuild the demo slice of the DDInter index so it covers every seed ingredient
 * (data/seed-drug-scope.json), every ingredient already in scope, and the SFDA's own top
 * oral-medicine ingredients for Saudi Arabia (data/build/top-ingredients.json) that exist in
 * DDInter's files.
 *
 * Input: DDInter 2.0's own download files in data/build/ (git-ignored), as published at
 * https://ddinter.scbdd.com/download/ - ddinter_downloads_code_<ATC>.csv with the columns
 * DDInterID_A, Drug_A, DDInterID_B, Drug_B, Level. Nothing is typed in by hand: every pair and
 * level below is a row of those files, and every drug id is DDInter's. The SFDA ranking is
 * data/build/top-ingredients.json (also git-ignored), likewise not hand-typed.
 *
 * Merge rule: the existing index is kept (its pairs may come from ATC files not present here);
 * each pair found in the present files between two in-scope drugs is (re)written from the file.
 * A pair listed in several files keeps the most severe level and the first file it was seen in.
 *
 * SFDA -> DDInter mapping (added for the ~100-drug extension). Every SFDA ingredient spelling is
 * resolved to a DDInter drug name using src/normalise.js's own candidateKeys() (exact canonical
 * name, then salt/hydrate-stripped fallback), then a small LOCAL supplementary strip list below for
 * ester/prodrug/counter-ion suffixes candidateKeys does not already cover - e.g. "medoxomil",
 * "cilexetil" - then a small LOCAL synonym table (EXTRA_SYNONYMS below) for an INN/USAN spelling
 * DDInter's own catalog does not use - e.g. "cefalexin" resolves to DDInter's "Cephalexin". This
 * logic lives here, not in src/normalise.js: that file is shared by the screening and travel-check
 * lookup path and is owned by another builder; a mapping decision made only for choosing the
 * build's scope has no business changing what a live lookup key resolves to. The first 100
 * SFDA-ranked ingredients that resolve to a real DDInter drug are added to scope (every current
 * index drug is added regardless of its SFDA rank); every SFDA spelling that resolves to one of
 * those covered drugs - a drug already in the index, a seed ingredient, OR one of the chosen 100,
 * not only the spelling that won a drug its slot - is kept in meta.sfdaIngredientMap, so a runtime
 * SFDA ingredient string keys onto the index under any of its registered spellings. An SFDA
 * ingredient with no DDInter match at all (checked with candidateKeys/EXTRA_SUFFIXES/EXTRA_SYNONYMS,
 * not a fuzzy match - see EXTRA_SYNONYMS' own comment for why edit-distance alone is not enough) is
 * logged in meta.sfda.droppedNotInLoadedFiles, never guessed.
 *
 * The category scope (AP-06). A category file lists the interactions of the drugs IN that ATC
 * category, so a pair whose two drugs both sit outside the loaded categories can never be found
 * here, and its absence proves nothing. The index therefore records which category files were
 * loaded (meta.categoryFilesLoaded) and each seed drug's WHO ATC top-level categories
 * (drugs[k].atcCategories, from data/seed-drug-scope.json); src/interactions.js concludes "no
 * interaction" for an absent pair only when one of its drugs is in a loaded category. Before a
 * category is written, it is checked against the files themselves, and the build stops if:
 *   - the code that puts the drug in a loaded category was not read on its own WHO code page;
 *   - the drug has no row at all in that category's file;
 *   - a partner of the drug found in another loaded file is missing from that category's file
 *     (then the file does not list all of the drug's interactions, and the rule would lie);
 *   - there is no other loaded file to cross-check against (a check with no input is no check).
 * A category that fails only the first of these (a code never individually confirmed on its own
 * WHO page) is not written for that one drug - fail closed, the same rule a brand-new drug with no
 * confirmed code at all already gets - rather than aborting the whole build; every such skip is
 * named in meta.categoryClaimsSkipped so it is never a silent gap. A brand-new drug (added only via
 * the SFDA list) has no seed-drug-scope.json entry at all, so it never claims any category - it is
 * always "category not loaded", listed in meta.noConfirmedAtcCategory, and there is no network here
 * to go read a WHO code page and change that.
 *
 *   node scripts/build-demo-index.js            write data/interaction-index.json
 *   node scripts/build-demo-index.js --dry-run  print what would change
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canonical, candidateKeys, pairKey } = require('../src/normalise');
const { seedAtcCategories, crossCheckCategories, codesIn } = require('../src/atc');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'data', 'interaction-index.json');
const SCOPE = path.join(ROOT, 'data', 'seed-drug-scope.json');
const BUILD = path.join(ROOT, 'data', 'build');
const SFDA_TOP = path.join(BUILD, 'top-ingredients.json');
const RANK = { Major: 3, Moderate: 2, Minor: 1, Unknown: 0 };
const SFDA_TARGET = 100;

/**
 * The DDInter 2.0 paper as its publisher's record gives it: Crossref for doi:10.1093/nar/gkae726
 * (https://api.crossref.org/works/10.1093/nar/gkae726) and Europe PMC for PMID 39180399, both read
 * on 2026-09-24. The text the index carried before ("Xiong G, et al. DDInter 2.0: an enhanced drug
 * interaction resource.") named the first author of DDInter 1.0 (2022) and a shortened title.
 */
const PAPER = 'Tian Y, Yi J, Wang N, Wu C, Peng J, Liu S, Yang G, Cao D. DDInter 2.0: an enhanced drug interaction resource with expanded data coverage, new interaction types, and improved user interface. Nucleic Acids Research 2025;53(D1):D1356-D1362. doi:10.1093/nar/gkae726.';
/** DDInter 2.0's own licence (https://ddinter.scbdd.com/). This file is derived from it, so every
 *  build stamps the licence onto meta.source - never left to whoever reads licenceNote's prose. */
const LICENCE = 'CC BY-NC-SA 4.0';

const CATEGORY_RULE = 'A DDInter category file lists the interactions of the drugs in that ATC category. A pair absent from the index is "no interaction recorded" only when at least one of its two drugs has an ATC category (drugs[k].atcCategories, WHO ATC/DDD index, data/seed-drug-scope.json) whose file is in categoryFilesLoaded. Otherwise the pair is "cannot verify". A drug without atcCategories is treated as not loaded.';

/**
 * Ester / prodrug / counter-ion suffixes seen in the SFDA registration list that src/normalise.js's
 * shared SALT_FORMS does not strip (that list is for the live lookup path; these are for choosing
 * this build's scope only - see the file header). Order matters: longest first. Each entry here is
 * the SAME active moiety under a formulation suffix, never a different drug or a different class.
 */
const EXTRA_SUFFIXES = [
  'sodium hydrogen', 'hydrogen', 'medoxomil', 'cilexetil', 'etexilate', 'etexilate mesylate',
  'arginine', 'mofetil', 'axetil', 'proxetil', 'dipivoxil', 'clavulanate', 'besilate', 'besylate',
  'orotate', 'aspartate', 'ascorbate', 'camsylate', 'edisylate', 'estolate', 'gluceptate'
];

/**
 * INN/USAN spelling pairs seen in the SFDA list that name the exact same active moiety as a
 * DDInter catalog entry under a different official spelling (the same kind of thing paracetamol /
 * acetaminophen already is in src/normalise.js's shared SYNONYMS - never a different drug or a
 * different class). Declared here, not in src/normalise.js, for the same reason EXTRA_SUFFIXES is
 * local: this is a build-scope decision (which SFDA ingredient wins a slot), not a change to what a
 * live lookup key resolves to; that file is shared with the screening/travel-check path and owned
 * by another builder.
 *   cefalexin -> cephalexin: DDInter's own catalog spells it "Cephalexin" (196 rows across the
 *   loaded files); "Cefalexin" is the WHO/BAN spelling SFDA uses. Confirmed 2026-09-26 against
 *   data/build/ddinter_downloads_code_*.csv - not a near-miss guess (compare dapoxetine/duloxetine
 *   or etoricoxib/rofecoxib, which are close in edit distance but genuinely different drugs and are
 *   correctly left unmapped).
 */
const EXTRA_SYNONYMS = {
  cefalexin: 'cephalexin'
};

function stripExtraSuffixes(normalised) {
  let s = ' ' + normalised + ' ';
  for (const w of EXTRA_SUFFIXES) s = s.replace(new RegExp('(^|\\s)' + w + '(?=\\s|$)', 'g'), ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

function readRows(file) {
  const letter = file.match(/_([A-Z])\.csv$/)[1];
  const lines = fs.readFileSync(path.join(BUILD, file), 'utf8').split(/\r?\n/).filter(Boolean);
  const head = parseCsvLine(lines[0]).map((h) => h.trim());
  const col = (n) => head.indexOf(n);
  const [iA, nA, iB, nB, lv] = ['DDInterID_A', 'Drug_A', 'DDInterID_B', 'Drug_B', 'Level'].map(col);
  if ([iA, nA, iB, nB, lv].some((x) => x < 0)) throw new Error(file + ': unexpected header ' + head.join(','));
  return lines.slice(1).map((line) => {
    const r = parseCsvLine(line);
    return { idA: r[iA], nameA: r[nA], idB: r[iB], nameB: r[nB], level: r[lv], file: letter };
  });
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

/** Every candidate lookup key for an SFDA ingredient spelling: normalise.js's own keys first (exact
 *  name, then its salt/hydrate-stripped fallback), then the same, stripped of the extra suffixes
 *  above (declared local to this build - see the file header). */
function sfdaCandidateKeys(raw) {
  const keys = candidateKeys(raw);
  for (const k of keys.slice()) {
    const stripped = stripExtraSuffixes(k);
    if (stripped && keys.indexOf(stripped) === -1) keys.push(stripped);
  }
  for (const k of keys.slice()) {
    if (Object.prototype.hasOwnProperty.call(EXTRA_SYNONYMS, k) && keys.indexOf(EXTRA_SYNONYMS[k]) === -1) {
      keys.push(EXTRA_SYNONYMS[k]);
    }
  }
  return keys;
}

function main() {
  const dry = process.argv.includes('--dry-run');
  const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  const scope = JSON.parse(fs.readFileSync(SCOPE, 'utf8'));
  const atc = seedAtcCategories(scope);   // throws on malformed ATC data
  const entries = new Map(scope.seedIngredients.map((s) => [canonical(s.name), s]));
  const files = fs.existsSync(BUILD) ? fs.readdirSync(BUILD).filter((f) => /^ddinter_downloads_code_[A-Z]\.csv$/.test(f)).sort() : [];
  if (files.length === 0) throw new Error('no DDInter files in data/build/ - download them from https://ddinter.scbdd.com/download/');
  const loaded = files.map((f) => f.match(/_([A-Z])\.csv$/)[1]);
  const parsed = files.map((f) => ({ file: f, rows: readRows(f) }));

  // A category is claimed for cross-checking only when EVERY one of the drug's own codes under
  // that top-level letter was individually read on its own WHO code page (?code=...). One code
  // found only via a general name search cannot be trusted to be the right one - and there is no
  // network here to go open its own page and confirm it - so that letter is not claimed for this
  // drug at all (fail closed), even though the file itself is loaded and used to find pairs.
  const categoryClaimsSkipped = [];
  const claimed = new Map();
  for (const [k, cats] of atc) {
    const inLoaded = cats.filter((c) => loaded.includes(c));
    const confirmed = inLoaded.filter((c) => {
      const codes = codesIn(entries.get(k), [c]);
      return codes.length > 0 && codes.every((code) => code.url.indexOf('?code=' + code.code) !== -1);
    });
    if (confirmed.length) claimed.set(k, confirmed);
    for (const c of inLoaded) if (confirmed.indexOf(c) === -1) categoryClaimsSkipped.push(k + ':' + c);
  }

  // ---- A complete catalog of every drug DDInter names in these files, regardless of scope - the
  // SFDA mapping below has to test candidate names against what DDInter actually has before the
  // final wanted set (and so the drugs to record from each row) is known.
  const catalogIds = {};
  const catalogLabels = {};
  for (const { rows } of parsed) {
    for (const r of rows) {
      const a = canonical(r.nameA);
      const b = canonical(r.nameB);
      if (a) { catalogIds[a] = catalogIds[a] || r.idA; catalogLabels[a] = catalogLabels[a] || r.nameA; }
      if (b) { catalogIds[b] = catalogIds[b] || r.idB; catalogLabels[b] = catalogLabels[b] || r.nameB; }
    }
  }

  // Covered independently of the SFDA quota: every drug the index already had before this build,
  // plus every seed ingredient. The spec's "covered drug" is this set UNION the chosen 100 - a
  // spelling resolving to one of THESE must still be mapped even once the quota below is full,
  // otherwise a registered SFDA spelling of an existing index drug (warfarin, say) goes missing
  // from sfdaIngredientMap purely because 100 OTHER, unrelated ingredients happened to be chosen
  // first (see test/sfda-extension.test.js and the finding this fixes).
  const preExisting = new Set(Object.keys(index.drugs));
  for (const s of scope.seedIngredients) preExisting.add(canonical(s.name));

  // ---- SFDA top ingredients -> DDInter names. The first 100 that resolve to a real DDInter drug
  // are added to scope; every resolving spelling (not only the one that won a slot) is recorded.
  let sfda = null;
  const sfdaChosen = [];
  const sfdaDropped = [];
  const sfdaIngredientMap = {};
  if (fs.existsSync(SFDA_TOP)) {
    sfda = JSON.parse(fs.readFileSync(SFDA_TOP, 'utf8'));
    const chosenKeys = new Set();
    for (const item of sfda.top) {
      let key = null;
      for (const k of sfdaCandidateKeys(item.ingredient)) if (Object.prototype.hasOwnProperty.call(catalogIds, k)) { key = k; break; }
      if (!key) { sfdaDropped.push({ ingredient: item.ingredient, products: item.products }); continue; }
      if (!chosenKeys.has(key)) {
        if (chosenKeys.size >= SFDA_TARGET) {
          // The quota for NEW scope additions is full. This spelling still gets mapped below when
          // it resolves to a drug that is covered for a DIFFERENT reason (already in the index, or
          // a seed ingredient) - only a spelling that would need a fresh slot it can't have is
          // truly unmapped.
          if (preExisting.has(key)) sfdaIngredientMap[item.ingredient.toUpperCase()] = key;
          continue;
        }
        chosenKeys.add(key);
        sfdaChosen.push({ ingredient: item.ingredient, products: item.products, indexKey: key });
      }
      sfdaIngredientMap[item.ingredient.toUpperCase()] = key;
    }
  } else if (!dry) {
    throw new Error('data/build/top-ingredients.json is missing - the SFDA ranking is required to extend the index scope');
  }

  // The drugs in scope: what the index had, every seed ingredient, and every chosen SFDA drug.
  const wanted = new Set(Object.keys(index.drugs));
  for (const s of scope.seedIngredients) wanted.add(canonical(s.name));
  for (const item of sfdaChosen) wanted.add(item.indexKey);

  // The drugs whose ATC puts them in a loaded, confirmed category: their partners are collected
  // per file (every partner, in scope or not) for the cross-check below.
  const partners = Object.fromEntries(loaded.map((c) => [c, new Map()]));
  const addPartner = (file, drug, other) => {
    if (!claimed.has(drug)) return;
    if (!partners[file].has(drug)) partners[file].set(drug, new Set());
    partners[file].get(drug).add(other);
  };

  const ids = {};
  const labels = {};
  const found = new Map();
  for (const { rows } of parsed) {
    for (const r of rows) {
      const a = canonical(r.nameA);
      const b = canonical(r.nameB);
      if (a && b && a !== b) { addPartner(r.file, a, b); addPartner(r.file, b, a); }
      // A drug DDInter knows is recorded even with no in-scope partner: "no pair in the source" is
      // then a grounded answer about a known drug, never "this drug is unknown".
      if (wanted.has(a)) { ids[a] = ids[a] || r.idA; labels[a] = labels[a] || r.nameA; }
      if (wanted.has(b)) { ids[b] = ids[b] || r.idB; labels[b] = labels[b] || r.nameB; }
      if (!wanted.has(a) || !wanted.has(b) || a === b) continue;
      const key = pairKey(a, b);
      const level = RANK[r.level] !== undefined ? r.level : 'Unknown';
      const prev = found.get(key);
      const [first, second] = a <= b ? [r.idA, r.idB] : [r.idB, r.idA];
      if (!prev) found.set(key, { level, rowIds: [first, second], atcFile: r.file });
      else if (RANK[level] > RANK[prev.level]) found.set(key, { ...prev, level });
    }
  }

  // The category cross-check. Any failure stops the build: an unproven category is a false all-clear.
  const { checks, problems } = crossCheckCategories(claimed, partners, loaded, entries);
  if (problems.length) throw new Error('the ATC category check failed - nothing written:\n  ' + problems.join('\n  '));

  const before = Object.keys(index.pairs).length;
  const added = [];
  const changed = [];
  for (const [key, row] of found) {
    const old = index.pairs[key];
    if (!old) added.push(key + ' (' + row.level + ')');
    else if (old.level !== row.level) {
      // SAFETY: a pair the previous index already carried never gets a LOWER level out of a
      // rebuild - that would mean the input files changed under us, not that the pair got safer.
      // An upgrade (more severe) is accepted and logged the same as always; a downgrade stops the
      // build with nothing written, exactly like every other "this cannot be trusted" case above.
      if (RANK[row.level] < RANK[old.level]) {
        throw new Error('safety: ' + key + ' would drop from ' + old.level + ' to ' + row.level + ' - refusing to write a downgrade of an existing pair; nothing written');
      }
      changed.push(key + ': ' + old.level + ' -> ' + row.level);
    }
    index.pairs[key] = row;
  }
  for (const k of Object.keys(ids)) if (!index.drugs[k]) index.drugs[k] = { label: labels[k], ddinterId: ids[k] };

  const skippedByDrug = new Map();
  for (const item of categoryClaimsSkipped) {
    const [k, c] = item.split(':');
    if (!skippedByDrug.has(k)) skippedByDrug.set(k, new Set());
    skippedByDrug.get(k).add(c);
  }
  for (const [k, d] of Object.entries(index.drugs)) {
    if (atc.has(k)) {
      const skip = skippedByDrug.get(k);
      d.atcCategories = skip ? atc.get(k).filter((c) => !skip.has(c)) : atc.get(k);
      if (d.atcCategories.length === 0) delete d.atcCategories;
    } else delete d.atcCategories;
  }

  const notFound = [...wanted].filter((k) => !index.drugs[k]).sort();
  const noConfirmedAtc = Object.keys(index.drugs).filter((k) => !atc.has(k)).sort();
  const today = new Date().toISOString().slice(0, 10);
  index.pairs = Object.fromEntries(Object.entries(index.pairs).sort(([x], [y]) => x.localeCompare(y)));
  index.meta = {
    ...index.meta,
    builtAt: today,
    scope: 'DEMO SLICE - the drugs of the previous slice, every seed ingredient (data/seed-drug-scope.json), ' +
      'and the top ' + SFDA_TARGET + ' SFDA-ranked oral ingredients (data/build/top-ingredients.json) that exist ' +
      'in DDInter. Rebuilt with scripts/build-demo-index.js from DDInter files ' + loaded.join(', ') + '.',
    categoryFilesLoaded: loaded,
    categoryRule: CATEGORY_RULE,
    categoryClaimsSkipped: categoryClaimsSkipped.sort(),
    noConfirmedAtcCategory: noConfirmedAtc,
    drugsInScope: Object.keys(index.drugs).length,
    pairsIndexed: Object.keys(index.pairs).length,
    drugsNotFoundInSource: [...new Set([...(index.meta.drugsNotFoundInSource || []), ...notFound.map((k) => labels[k] || k)])].sort(),
    source: { ...index.meta.source, citation: PAPER, retrievedAt: today, licence: LICENCE, filesSha256: Object.fromEntries(files.map((f) => [f, sha256File(path.join(BUILD, f))])) },
    sfda: sfda ? {
      rankingSource: sfda.source + '; ' + sfda.method + ' (data/build/top-ingredients.json, retrieved ' + sfda.retrievedAt + ')',
      target: SFDA_TARGET,
      chosen: sfdaChosen,
      // Not "not in DDInter": DDInter's own catalog is larger than the 8 category files this build
      // loaded (candesartan and dabigatran, for two, are genuinely absent from these 8 files - that
      // says nothing about whether DDInter's full download has them under a category not loaded
      // here). This field only ever claims silence about the files actually read.
      droppedNotInLoadedFiles: sfdaDropped
    } : index.meta.sfda,
    sfdaIngredientMap: Object.keys(sfdaIngredientMap).length ? sfdaIngredientMap : (index.meta.sfdaIngredientMap || {})
  };
  console.log('files: ' + files.join(', '));
  console.log('drugs: ' + Object.keys(index.drugs).length + ', pairs: ' + before + ' -> ' + Object.keys(index.pairs).length + ' (' + added.length + ' new, ' + changed.length + ' level changed)');
  for (const c of changed) console.log('  ~ ' + c);
  console.log('ATC categories checked against the files:');
  for (const c of checks) console.log('  ' + c);
  if (categoryClaimsSkipped.length) console.log('category claims skipped (code not read on its own WHO page - fail closed): ' + categoryClaimsSkipped.join(', '));
  const unknown = Object.keys(index.drugs).filter((k) => !atc.has(k)).sort();
  if (unknown.length) console.log('no ATC data (treated as not loaded): ' + unknown.length + ' drugs');
  if (notFound.length) console.log('in scope but not in these files: ' + notFound.join(', '));
  if (sfda) {
    console.log('SFDA top ' + sfda.top.length + ': ' + sfdaChosen.length + ' chosen, ' + sfdaDropped.length + ' not in these loaded files');
    if (sfdaDropped.length) console.log('  dropped: ' + sfdaDropped.map((d) => d.ingredient).join(', '));
  }
  if (!dry) fs.writeFileSync(INDEX, JSON.stringify(index, null, 2) + '\n');
  console.log(dry ? '(dry run - nothing written)' : 'wrote data/interaction-index.json');
}

if (require.main === module) main();

// Exported for test/sfda-extension.test.js only, so it can check the real SFDA -> DDInter
// resolution (not a re-implementation of it, which could drift from this file) against
// data/build/top-ingredients.json. Requiring this file never runs main() by itself - only this
// process's own `node scripts/build-demo-index.js` invocation does.
module.exports = { sfdaCandidateKeys, EXTRA_SUFFIXES, EXTRA_SYNONYMS };
