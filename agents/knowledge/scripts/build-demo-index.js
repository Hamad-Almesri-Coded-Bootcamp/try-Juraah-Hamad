'use strict';

/**
 * Rebuild the demo slice of the DDInter index so it covers every seed ingredient
 * (data/seed-drug-scope.json) on top of the drugs it already had.
 *
 * Input: DDInter 2.0's own download files in data/build/ (git-ignored), as published at
 * https://ddinter.scbdd.com/download/ - ddinter_downloads_code_<ATC>.csv with the columns
 * DDInterID_A, Drug_A, DDInterID_B, Drug_B, Level. Nothing is typed in by hand: every pair and
 * level below is a row of those files, and every drug id is DDInter's.
 *
 * Merge rule: the existing index is kept (its pairs may come from ATC files not present here);
 * each pair found in the present files between two in-scope drugs is (re)written from the file.
 * A pair listed in several files keeps the most severe level and the first file it was seen in.
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
 *
 *   node scripts/build-demo-index.js            write data/interaction-index.json
 *   node scripts/build-demo-index.js --dry-run  print what would change
 */
const fs = require('node:fs');
const path = require('node:path');
const { canonical, pairKey } = require('../src/normalise');
const { seedAtcCategories, crossCheckCategories } = require('../src/atc');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'data', 'interaction-index.json');
const SCOPE = path.join(ROOT, 'data', 'seed-drug-scope.json');
const BUILD = path.join(ROOT, 'data', 'build');
const RANK = { Major: 3, Moderate: 2, Minor: 1, Unknown: 0 };

/**
 * The DDInter 2.0 paper as its publisher's record gives it: Crossref for doi:10.1093/nar/gkae726
 * (https://api.crossref.org/works/10.1093/nar/gkae726) and Europe PMC for PMID 39180399, both read
 * on 2026-09-24. The text the index carried before ("Xiong G, et al. DDInter 2.0: an enhanced drug
 * interaction resource.") named the first author of DDInter 1.0 (2022) and a shortened title.
 */
const PAPER = 'Tian Y, Yi J, Wang N, Wu C, Peng J, Liu S, Yang G, Cao D. DDInter 2.0: an enhanced drug interaction resource with expanded data coverage, new interaction types, and improved user interface. Nucleic Acids Research 2025;53(D1):D1356-D1362. doi:10.1093/nar/gkae726.';

const CATEGORY_RULE = 'A DDInter category file lists the interactions of the drugs in that ATC category. A pair absent from the index is "no interaction recorded" only when at least one of its two drugs has an ATC category (drugs[k].atcCategories, WHO ATC/DDD index, data/seed-drug-scope.json) whose file is in categoryFilesLoaded. Otherwise the pair is "cannot verify". A drug without atcCategories is treated as not loaded.';

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

function main() {
  const dry = process.argv.includes('--dry-run');
  const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  const scope = JSON.parse(fs.readFileSync(SCOPE, 'utf8'));
  const atc = seedAtcCategories(scope);   // throws on malformed ATC data
  const files = fs.existsSync(BUILD) ? fs.readdirSync(BUILD).filter((f) => /^ddinter_downloads_code_[A-Z]\.csv$/.test(f)).sort() : [];
  if (files.length === 0) throw new Error('no DDInter files in data/build/ - download them from https://ddinter.scbdd.com/download/');
  const loaded = files.map((f) => f.match(/_([A-Z])\.csv$/)[1]);

  // The drugs in scope: what the index had, plus every seed ingredient.
  const wanted = new Set(Object.keys(index.drugs));
  for (const s of scope.seedIngredients) wanted.add(canonical(s.name));

  // The drugs whose ATC puts them in a loaded category: their partners are collected per file
  // (every partner, in scope or not) for the cross-check below.
  const claimed = new Map([...atc].map(([k, cats]) => [k, cats.filter((c) => loaded.includes(c))]).filter(([, c]) => c.length > 0));
  const partners = Object.fromEntries(loaded.map((c) => [c, new Map()]));
  const addPartner = (file, drug, other) => {
    if (!claimed.has(drug)) return;
    if (!partners[file].has(drug)) partners[file].set(drug, new Set());
    partners[file].get(drug).add(other);
  };

  const ids = {};
  const labels = {};
  const found = new Map();
  for (const f of files) {
    const file = f.match(/_([A-Z])\.csv$/)[1];
    const lines = fs.readFileSync(path.join(BUILD, f), 'utf8').split(/\r?\n/).filter(Boolean);
    const head = parseCsvLine(lines[0]).map((h) => h.trim());
    const col = (n) => head.indexOf(n);
    const [iA, nA, iB, nB, lv] = ['DDInterID_A', 'Drug_A', 'DDInterID_B', 'Drug_B', 'Level'].map(col);
    if ([iA, nA, iB, nB, lv].some((x) => x < 0)) throw new Error(f + ': unexpected header ' + head.join(','));
    for (const line of lines.slice(1)) {
      const r = parseCsvLine(line);
      const a = canonical(r[nA]);
      const b = canonical(r[nB]);
      if (a && b && a !== b) { addPartner(file, a, b); addPartner(file, b, a); }
      // A drug DDInter knows is recorded even with no in-scope partner: "no pair in the source" is
      // then a grounded answer about a known drug, never "this drug is unknown".
      if (wanted.has(a)) { ids[a] = ids[a] || r[iA]; labels[a] = labels[a] || r[nA]; }
      if (wanted.has(b)) { ids[b] = ids[b] || r[iB]; labels[b] = labels[b] || r[nB]; }
      if (!wanted.has(a) || !wanted.has(b) || a === b) continue;
      const key = pairKey(a, b);
      const level = RANK[r[lv]] !== undefined ? r[lv] : 'Unknown';
      const prev = found.get(key);
      const [first, second] = a <= b ? [r[iA], r[iB]] : [r[iB], r[iA]];
      if (!prev) found.set(key, { level, rowIds: [first, second], atcFile: file });
      else if (RANK[level] > RANK[prev.level]) found.set(key, { ...prev, level });
    }
  }

  // The category cross-check. Any failure stops the build: an unproven category is a false all-clear.
  const entries = new Map(scope.seedIngredients.map((s) => [canonical(s.name), s]));
  const { checks, problems } = crossCheckCategories(claimed, partners, loaded, entries);
  if (problems.length) throw new Error('the ATC category check failed - nothing written:\n  ' + problems.join('\n  '));

  const before = Object.keys(index.pairs).length;
  const added = [];
  const changed = [];
  for (const [key, row] of found) {
    const old = index.pairs[key];
    if (!old) added.push(key + ' (' + row.level + ')');
    else if (old.level !== row.level) changed.push(key + ': ' + old.level + ' -> ' + row.level);
    index.pairs[key] = row;
  }
  for (const k of Object.keys(ids)) if (!index.drugs[k]) index.drugs[k] = { label: labels[k], ddinterId: ids[k] };
  for (const [k, d] of Object.entries(index.drugs)) {
    if (atc.has(k)) d.atcCategories = atc.get(k);
    else delete d.atcCategories;
  }
  const notFound = [...wanted].filter((k) => !index.drugs[k]).sort();
  const today = new Date().toISOString().slice(0, 10);
  index.pairs = Object.fromEntries(Object.entries(index.pairs).sort(([x], [y]) => x.localeCompare(y)));
  index.meta = {
    ...index.meta,
    builtAt: today,
    scope: 'DEMO SLICE - the drugs of the previous slice plus every seed ingredient (data/seed-drug-scope.json). Rebuilt with scripts/build-demo-index.js from DDInter files ' + loaded.join(', ') + '.',
    categoryFilesLoaded: loaded,
    categoryRule: CATEGORY_RULE,
    drugsInScope: Object.keys(index.drugs).length,
    pairsIndexed: Object.keys(index.pairs).length,
    drugsNotFoundInSource: [...new Set([...(index.meta.drugsNotFoundInSource || []), ...notFound.map((k) => labels[k] || k)])].sort(),
    source: { ...index.meta.source, citation: PAPER, retrievedAt: today },
  };
  console.log('files: ' + files.join(', '));
  console.log('pairs: ' + before + ' -> ' + Object.keys(index.pairs).length + ' (' + added.length + ' new, ' + changed.length + ' level changed)');
  for (const a of added) console.log('  + ' + a);
  for (const c of changed) console.log('  ~ ' + c);
  console.log('ATC categories checked against the files:');
  for (const c of checks) console.log('  ' + c);
  const unknown = Object.keys(index.drugs).filter((k) => !atc.has(k)).sort();
  if (unknown.length) console.log('no ATC data (treated as not loaded): ' + unknown.join(', '));
  if (notFound.length) console.log('in scope but not in these files: ' + notFound.join(', '));
  if (!dry) fs.writeFileSync(INDEX, JSON.stringify(index, null, 2) + '\n');
  console.log(dry ? '(dry run - nothing written)' : 'wrote data/interaction-index.json');
}

main();
