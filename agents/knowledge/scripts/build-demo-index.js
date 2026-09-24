'use strict';

/**
 * F2 - rebuild the demo slice of the DDInter index so it covers every seed ingredient
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
 *   node scripts/build-demo-index.js            write data/interaction-index.json
 *   node scripts/build-demo-index.js --dry-run  print what would change
 */
const fs = require('node:fs');
const path = require('node:path');
const { canonical, pairKey } = require('../src/normalise');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'data', 'interaction-index.json');
const SCOPE = path.join(ROOT, 'data', 'seed-drug-scope.json');
const BUILD = path.join(ROOT, 'data', 'build');
const RANK = { Major: 3, Moderate: 2, Minor: 1, Unknown: 0 };

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
  const files = fs.existsSync(BUILD) ? fs.readdirSync(BUILD).filter((f) => /^ddinter_downloads_code_[A-Z]\.csv$/.test(f)).sort() : [];
  if (files.length === 0) throw new Error('no DDInter files in data/build/ - download them from https://ddinter.scbdd.com/download/');

  // The drugs in scope: what the index had, plus every seed ingredient.
  const wanted = new Set(Object.keys(index.drugs));
  for (const s of scope.seedIngredients) wanted.add(canonical(s.name));

  const ids = {};
  const labels = {};
  const found = new Map();
  for (const f of files) {
    const atc = f.match(/_([A-Z])\.csv$/)[1];
    const lines = fs.readFileSync(path.join(BUILD, f), 'utf8').split(/\r?\n/).filter(Boolean);
    const head = parseCsvLine(lines[0]).map((h) => h.trim());
    const col = (n) => head.indexOf(n);
    const [iA, nA, iB, nB, lv] = ['DDInterID_A', 'Drug_A', 'DDInterID_B', 'Drug_B', 'Level'].map(col);
    if ([iA, nA, iB, nB, lv].some((x) => x < 0)) throw new Error(f + ': unexpected header ' + head.join(','));
    for (const line of lines.slice(1)) {
      const r = parseCsvLine(line);
      const a = canonical(r[nA]);
      const b = canonical(r[nB]);
      // A drug DDInter knows is recorded even with no in-scope partner: "no pair in the source" is
      // then a grounded answer about a known drug, never "this drug is unknown".
      if (wanted.has(a)) { ids[a] = ids[a] || r[iA]; labels[a] = labels[a] || r[nA]; }
      if (wanted.has(b)) { ids[b] = ids[b] || r[iB]; labels[b] = labels[b] || r[nB]; }
      if (!wanted.has(a) || !wanted.has(b) || a === b) continue;
      ids[a] = ids[a] || r[iA]; labels[a] = labels[a] || r[nA];
      ids[b] = ids[b] || r[iB]; labels[b] = labels[b] || r[nB];
      const key = pairKey(a, b);
      const level = RANK[r[lv]] !== undefined ? r[lv] : 'Unknown';
      const prev = found.get(key);
      const [first, second] = a <= b ? [r[iA], r[iB]] : [r[iB], r[iA]];
      if (!prev) found.set(key, { level, rowIds: [first, second], atcFile: atc });
      else if (RANK[level] > RANK[prev.level]) found.set(key, { ...prev, level });
    }
  }

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
  const notFound = [...wanted].filter((k) => !index.drugs[k]).sort();
  const today = new Date().toISOString().slice(0, 10);
  index.pairs = Object.fromEntries(Object.entries(index.pairs).sort(([x], [y]) => x.localeCompare(y)));
  index.meta = {
    ...index.meta,
    builtAt: today,
    scope: 'DEMO SLICE - the drugs of the previous slice plus every seed ingredient (data/seed-drug-scope.json). Rebuilt with scripts/build-demo-index.js from DDInter files ' + files.map((f) => f.match(/_([A-Z])\.csv$/)[1]).join(', ') + '.',
    drugsInScope: Object.keys(index.drugs).length,
    pairsIndexed: Object.keys(index.pairs).length,
    drugsNotFoundInSource: [...new Set([...(index.meta.drugsNotFoundInSource || []), ...notFound.map((k) => labels[k] || k)])].sort(),
    source: { ...index.meta.source, retrievedAt: today },
  };
  console.log('files: ' + files.join(', '));
  console.log('pairs: ' + before + ' -> ' + Object.keys(index.pairs).length + ' (' + added.length + ' new, ' + changed.length + ' level changed)');
  for (const a of added) console.log('  + ' + a);
  for (const c of changed) console.log('  ~ ' + c);
  if (notFound.length) console.log('in scope but not in these files: ' + notFound.join(', '));
  if (!dry) fs.writeFileSync(INDEX, JSON.stringify(index, null, 2) + '\n');
  console.log(dry ? '(dry run - nothing written)' : 'wrote data/interaction-index.json');
}

main();
