'use strict';

/**
 * Tests for scripts/build-sfda-brands.js: the pure transform functions on
 * small fixture rows, then sanity checks on the real built file,
 * data/sfda-brands.json - which must already be built (npm run build:sfda-brands
 * or `node scripts/build-sfda-brands.js`) before this suite runs, the same way
 * data/sfda-brands.json is expected to be committed alongside this test.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  computeBaseTradeName,
  ingredientSet,
  buildNamesIndex,
  buildBrandsFile,
  stripEdgeConnectors,
  stripOwnStrengthTokens,
  INPUT_PATH,
  OUTPUT_PATH
} = require('../scripts/build-sfda-brands.js');

// --------------------------------------------------------------- fixtures

test('strength removal: a plain "NUMBER UNIT" strength token is stripped', () => {
  assert.equal(computeBaseTradeName('WIDGET 500 MG TAB'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 600MG'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 1 G TABLET'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 1000 IU'), 'WIDGET');
  assert.equal(computeBaseTradeName('0.1% W/V WIDGET'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 5MG/ML SOLUTION'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 15MG-ML SOLU'), 'WIDGET');
});

test('strength removal: newly-recognised units (GM, MICROGM/MICROGRAM, MMOL, MEQ, dotted I.U) are stripped, including in the per-ML shape', () => {
  assert.equal(computeBaseTradeName('WIDGET 1GM TAB'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 1.0 MICROGM'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 2MICROGRAM-ML'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 40MEQ'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 0.25MMOL-ML'), 'WIDGET');
  // Real spellings of the same per-ML concentration: a dot, a space, both, or
  // neither, and a bare backslash as the separator (real row: "NOVORAPID
  // FLEXPEN 100U\ML"):
  assert.equal(computeBaseTradeName('WIDGET 100 I.U - ML VIAL'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 100 I U ML VIAL'), 'WIDGET');
  // "DISPOSABLE PEN" is a device descriptor, not a dosage-form word this
  // build strips (out of scope) - only the per-ML token itself is removed:
  assert.equal(computeBaseTradeName('WIDGET 100I.U-ML DISPOSABLE PEN'), 'WIDGET DISPOSABLE PEN');
  assert.equal(computeBaseTradeName('WIDGET 100U\\ML'), 'WIDGET');
});

test('strength removal: the row\'s own strength value(s) are removed as a whole bare number, never a substring of a longer number (real rows: LYRICA, OLFEN, MESPORIN)', () => {
  assert.equal(computeBaseTradeName('LYRICA 75', '75'), 'LYRICA');
  assert.equal(computeBaseTradeName('LYRICA 75 MG CAPSULES', '75'), 'LYRICA');
  assert.equal(computeBaseTradeName('OLFEN-75', '75,20'), 'OLFEN', 'a combination strength ("75,20") is split on the comma and each value tried');
  assert.equal(computeBaseTradeName('MESPORIN 500 I.M.', '500'), 'MESPORIN');
  // The bare number must be a WHOLE token: strength "75" must never eat part
  // of an unrelated "1750" that merely contains "75":
  assert.equal(computeBaseTradeName('WIDGET 1750', '75'), 'WIDGET 1750');
  // No strength passed at all (as every other fixture in this file does):
  // behaviour is unchanged from before this fix.
  assert.equal(computeBaseTradeName('WIDGET 75'), 'WIDGET 75');
});

test('stripOwnStrengthTokens: a whole-token bare number is removed, but never a substring of a longer number or of a decimal (isolated from the later punctuation-normalise step, which turns EVERY dot into a space regardless)', () => {
  assert.equal(stripOwnStrengthTokens('WIDGET 75', '75'), 'WIDGET  ');
  assert.equal(stripOwnStrengthTokens('WIDGET 1750', '75'), 'WIDGET 1750', 'strength "75" is not a substring match inside "1750"');
  assert.equal(stripOwnStrengthTokens('WIDGET 17.5', '5'), 'WIDGET 17.5', 'strength "5" does not eat the "5" inside the decimal "17.5"');
  assert.equal(stripOwnStrengthTokens('WIDGET 17.5', '17.5'), 'WIDGET  ', 'the whole decimal value IS removed when it matches exactly');
  assert.equal(stripOwnStrengthTokens('WIDGET', null), 'WIDGET');
  assert.equal(stripOwnStrengthTokens('WIDGET', undefined), 'WIDGET');
  assert.equal(stripOwnStrengthTokens('WIDGET', ''), 'WIDGET');
});

test('form removal: dosage-form words are stripped, wherever they sit and whatever punctuation touches them', () => {
  assert.equal(computeBaseTradeName('WIDGET SYRUP'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET TABLETS'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET CAPSULE'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET F.C. TABLETS'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET FILM COATED TABLET'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET film-coated tablet'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET SUSPENSION*'), 'WIDGET', 'a form word followed by stray punctuation (not whitespace) is still a whole word');
  assert.equal(computeBaseTradeName('WIDGET PRE-FILLED SYRINGE'), 'WIDGET');
  // A near-miss spelling of a form word that is NOT on the documented misspelling list below is left
  // alone (this build corrects no typo it has not actually observed in the source data):
  assert.equal(computeBaseTradeName('WIDGET TABLZT'), 'WIDGET TABLZT');
});

test('form removal (reviewer findings, 2026-09-26): CAPLET(S), GRANULES, LOZENGES, SOFTGELS/SOFT GELATIN, ELIXIR, LOTION, SHAMPOO, TRANSDERMAL PATCH(ES), EXTENDED/PROLONGED/MODIFIED RELEASE, GASTRO RESISTANT, RECTAL and bare/ENTERIC COATED are stripped, and never leave a stranded prefix word', () => {
  assert.equal(computeBaseTradeName('WIDGET CAPLET'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET CAPLETS'), 'WIDGET');
  assert.equal(computeBaseTradeName('OFLAM GRANULES'), 'OFLAM', 'real row');
  assert.equal(computeBaseTradeName('WIDGET LOZENGES'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET SOFTGEL'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET SOFT GELATIN'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET ELIXIR'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET LOTION'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET SHAMPOO'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET TRANSDERMAL PATCH'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET TRANSDERMAL PATCHES'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET EXTENDED RELEASE'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET PROLONGED RELEASE'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET MODIFIED RELEASE'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET GASTRO RESISTANT'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET GASTRO-RESISTANT'), 'WIDGET');
  // RECTAL is a route word, not identity (real rows: "ADOL RECTAL", "ADOL RECTAL SUUPPOSITORIES"):
  assert.equal(computeBaseTradeName('ADOL RECTAL'), 'ADOL');
  assert.equal(computeBaseTradeName('ADOL RECTAL SUUPPOSITORIES'), 'ADOL', 'RECTAL and the SUUPPOSITORIES typo both strip, never stranding RECTAL alone');
  // Bare COATED (no FILM/ENTERIC prefix) and ENTERIC COATED, alongside the existing FILM COATED case:
  assert.equal(computeBaseTradeName('KLACID COATED'), 'KLACID', 'real row - bare COATED with no FILM/ENTERIC prefix');
  assert.equal(computeBaseTradeName('WIDGET ENTERIC COATED'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET FILM COATED TABLET'), 'WIDGET', 'still stripped after the COATED pattern was generalised');
  assert.equal(computeBaseTradeName('WIDGET COATED'), 'WIDGET', 'a bare FILM/ENTERIC prefix is optional, so it is never left stranded when absent');
});

test('form removal (reviewer findings, 2026-09-26): the observed misspellings TABLETE, SUUPPOSITORIES, COTED and SYRING are stripped, without eating a correctly spelled neighbour', () => {
  assert.equal(computeBaseTradeName('PANADOL ACTIFAST TABLETE'), 'PANADOL ACTIFAST', 'real row');
  assert.equal(computeBaseTradeName('WIDGET SUUPPOSITORIES'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET SUUPPOSITORY'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET COTED'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET FILM COTED'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET SYRING'), 'WIDGET');
  // The typo pattern is still a WHOLE word: it must never eat part of a correctly spelled neighbour.
  assert.equal(computeBaseTradeName('WIDGET SYRINGE'), 'WIDGET SYRINGE', 'SYRING is bounded so it never matches as a prefix of the correctly spelled SYRINGE');
});

test('form removal (reviewer findings, 2026-09-26): the exact names the finding named now resolve to one base', () => {
  assert.equal(computeBaseTradeName('ADOL EXTRA CAPLETS'), computeBaseTradeName('ADOL EXTRA'));
  assert.equal(computeBaseTradeName('ADOL EXTRA CAPLETS'), 'ADOL EXTRA');
  assert.equal(computeBaseTradeName('KLACID COATED'), computeBaseTradeName('KLACID'));
  assert.equal(computeBaseTradeName('PANADOL SINUS CAPLET'), 'PANADOL SINUS');
  assert.equal(computeBaseTradeName('PANADOL EXTRA CAPLETS'), computeBaseTradeName('PANADOL EXTRA'));
});

test('form removal: F.C. is recognised with a dot, a hyphen or a space (real row: "SEROQUEL 300MG F-C TABS")', () => {
  assert.equal(computeBaseTradeName('WIDGET 300MG F-C TABS'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 300MG F C TABS'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 300MG FC TABS'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 300MG F.C. TABS'), 'WIDGET');
});

test('form removal: added route/administration and container words (VIAL, AMP, I.V/I.M, EYE, SPRAY, SUPP, CONC, INHALATION, RECONSTIT)', () => {
  assert.equal(computeBaseTradeName('WIDGET VIAL'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET AMP'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET AMPOULE'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET I.V'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET I.M.'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET EYE DROPS'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET NASAL SPRAY'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET SUPPOSITORY'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET CONCENTRATE'), 'WIDGET');
  // The real row is truncated to exactly "RECONSTIT" in the source (no
  // "-UTED"), so that exact truncated spelling must be recognised too:
  assert.equal(computeBaseTradeName('WIDGET RECONSTIT'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET RECONSTITUTED'), 'WIDGET');
  // A real combined case, strength AND an added form word together (mirrors
  // "MAXIL 750 VIAL", strength "750"):
  assert.equal(computeBaseTradeName('WIDGET 750 VIAL', '750'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET 2MCG-ML AMP.'), 'WIDGET', 'MCG-ML has a unit attached, so no strength argument is needed to strip it');
});

test('form removal: a "FOR <route>" phrase is stripped as one unit, so "FOR" is never left stranded (real rows: "MEGAMOX ES ... POWDER FOR ORAL SUSPENSION", "ORENCIA ... POWDER FOR SOLUTION FOR INFUSION")', () => {
  assert.equal(computeBaseTradeName('MEGAMOX ES 600 MG POWDER FOR ORAL SUSPENSION'), 'MEGAMOX ES');
  assert.equal(computeBaseTradeName('ORENCIA 250MG POWDER FOR SOLUTION FOR INFUSION'), 'ORENCIA');
  assert.equal(computeBaseTradeName('AMOXIL POWDER FOR ORAL SUSPENSION FORTE 250MG-5ML'), 'AMOXIL FORTE', 'FORTE is a line-extension word and stays');
});

test('edge-connector cleanup: a lone FOR/PER/WITH/OR left at the start or end by stripping is removed, but the same word between two real words is not (real row: "Tyenne 200 mg per 10 ml")', () => {
  assert.equal(stripEdgeConnectors('TYENNE PER'), 'TYENNE');
  assert.equal(stripEdgeConnectors('FOR TYENNE'), 'TYENNE');
  assert.equal(stripEdgeConnectors('FOR FOR'), '', 'both trailing connector words clear, one pass at a time');
  assert.equal(stripEdgeConnectors('TYENNE WITH CAFFEINE'), 'TYENNE WITH CAFFEINE', 'a connector word with real words on both sides is left alone');
  assert.equal(computeBaseTradeName('TYENNE 200 MG PER 10 ML'), 'TYENNE');
});

test('pack-count removal: "(NUMBER PACK-WORD)" is stripped; an unrelated bracket is not', () => {
  assert.equal(computeBaseTradeName('WIDGET (30 SACHET)'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET (50 SACHETS)'), 'WIDGET');
  assert.equal(computeBaseTradeName('WIDGET (10 TABLETS)'), 'WIDGET');
  // A parenthetical that is not "number + pack word" is real distinguishing
  // text in the SFDA data (e.g. peritoneal-dialysis formula letters) and is
  // kept, not guessed away:
  assert.equal(computeBaseTradeName('WIDGET (F-A)'), 'WIDGET F A');
  assert.equal(computeBaseTradeName('WIDGET (9)'), 'WIDGET 9');
});

test('multi-ingredient split: scientificName commas become a sorted, deduplicated, uppercased set', () => {
  assert.deepEqual(
    ingredientSet('SODIUM CHLORIDE,POTASSIUM CHLORIDE,TRI SODIUM CITRATE,DEXTROSE'),
    ['DEXTROSE', 'POTASSIUM CHLORIDE', 'SODIUM CHLORIDE', 'TRI SODIUM CITRATE']
  );
  assert.deepEqual(ingredientSet('Aspirin, paracetamol, Caffeine'), ['ASPIRIN', 'CAFFEINE', 'PARACETAMOL']);
  assert.deepEqual(ingredientSet('Warfarin,warfarin'), ['WARFARIN'], 'a repeated ingredient in one row is deduplicated');
  assert.deepEqual(ingredientSet(''), []);
  assert.deepEqual(ingredientSet(null), []);
});

test('multi-ingredient split: a comma INSIDE parentheses does not split (real row: PRIORIX / M.M.R II)', () => {
  assert.deepEqual(
    ingredientSet(
      'MUMPS VIRUS (JERYL LYNN, STRAIN RIT 4385) LIVE ATTENUATED,MEASLES VIRUS (SCHWARZ) LIVE ATTENUATED'
    ),
    [
      'MEASLES VIRUS (SCHWARZ) LIVE ATTENUATED',
      'MUMPS VIRUS (JERYL LYNN, STRAIN RIT 4385) LIVE ATTENUATED'
    ],
    'two ingredients, not three - the comma inside "(JERYL LYNN, STRAIN RIT 4385)" is not a separator'
  );
});

test('multi-ingredient split: a short documented list of comma-names is re-joined even with no parentheses (real rows: KOATE DVI, ROTARIX, AMINOVEN)', () => {
  assert.deepEqual(
    ingredientSet('ANTIHEMOPHILIC FACTOR, HUMAN RECOMBINANT'),
    ['ANTIHEMOPHILIC FACTOR, HUMAN RECOMBINANT'],
    'one ingredient, comma kept: this is a name, not a separator'
  );
  assert.deepEqual(
    ingredientSet('HUMAN ROTAVIRUS, LIVE ATTENUATED VACCINE'),
    ['HUMAN ROTAVIRUS, LIVE ATTENUATED VACCINE']
  );
  assert.deepEqual(
    ingredientSet('AMINO ACIDS, SOURCE UNSPECIFIED'),
    ['AMINO ACIDS, SOURCE UNSPECIFIED']
  );
  // An ingredient list that happens to also contain one of the protected
  // phrases still splits normally at every OTHER top-level comma:
  assert.deepEqual(
    ingredientSet('CAFFEINE,ANTIHEMOPHILIC FACTOR, HUMAN RECOMBINANT'),
    ['ANTIHEMOPHILIC FACTOR, HUMAN RECOMBINANT', 'CAFFEINE']
  );
});

test('a row whose scientificName yields no ingredient at all contributes no set (real row: "Entocort CR" with an empty scientificName)', () => {
  const rows = [
    { tradeName: 'ENTOCORT CR', scientificName: 'BUDESONIDE', strength: '3', dosageForm: 'Capsule', regNo: 'r1', page: 1 },
    { tradeName: 'ENTOCORT CR', scientificName: '', strength: '', dosageForm: 'Capsule', regNo: 'r2', page: 1 }
  ];
  const names = buildNamesIndex(rows);
  assert.deepEqual(names['ENTOCORT CR'], [['BUDESONIDE']], 'the empty-scientificName row added no second (empty) set');
  const allRows = [{ tradeName: 'ONLY EMPTY', scientificName: '', strength: '', dosageForm: 'Tablet', regNo: 'r3', page: 1 }];
  assert.deepEqual(buildNamesIndex(allRows), {}, 'a name with ONLY empty-ingredient rows gets no key at all, never a key with an empty list');
});

test('line extensions stay distinct: EXTRA, XR, PLUS, FORTE, NIGHT, ADVANCE, COLD & FLU, SR are kept, not stripped', () => {
  const base = computeBaseTradeName('WIDGET 500 MG TAB');
  const extensions = [
    'WIDGET EXTRA 500 MG TAB', 'WIDGET XR 500 MG TAB', 'WIDGET PLUS 500 MG TAB',
    'WIDGET FORTE 500 MG TAB', 'WIDGET NIGHT 500 MG TAB', 'WIDGET ADVANCE 500 MG TAB',
    'WIDGET COLD & FLU TAB', 'WIDGET SR 500 MG TAB'
  ];
  const got = extensions.map(computeBaseTradeName);
  assert.deepEqual(got, [
    'WIDGET EXTRA', 'WIDGET XR', 'WIDGET PLUS', 'WIDGET FORTE',
    'WIDGET NIGHT', 'WIDGET ADVANCE', 'WIDGET COLD & FLU', 'WIDGET SR'
  ]);
  // Every one of them is a different key from the bare brand and from each other.
  const allNames = new Set([base, ...got]);
  assert.equal(allNames.size, 1 + got.length, 'every extension, and the bare brand, is its own distinct name');
});

test('one base name can hold two distinct ingredient sets', () => {
  const rows = [
    { tradeName: 'COMBIWIDGET TAB', scientificName: 'PARACETAMOL', strength: '500', dosageForm: 'Tablet', regNo: 'r1', page: 1 },
    { tradeName: 'COMBIWIDGET TAB', scientificName: 'PARACETAMOL,CAFFEINE', strength: '500,30', dosageForm: 'Tablet', regNo: 'r2', page: 1 },
    { tradeName: 'COMBIWIDGET TAB', scientificName: 'CAFFEINE,PARACETAMOL', strength: '500,30', dosageForm: 'Tablet', regNo: 'r3', page: 1 }
  ];
  const names = buildNamesIndex(rows);
  assert.deepEqual(Object.keys(names), ['COMBIWIDGET']);
  assert.deepEqual(names['COMBIWIDGET'], [['PARACETAMOL'], ['CAFFEINE', 'PARACETAMOL']], 'two distinct sets, the third row a duplicate of the second (order-independent) and not repeated');
});

test('a trade name that strips to nothing keeps the plain uppercased trade name', () => {
  assert.equal(computeBaseTradeName('500 MG TAB'), '500 MG TAB');
  assert.equal(computeBaseTradeName(''), '');
  assert.equal(computeBaseTradeName(null), '');
});

test('buildBrandsFile: meta counts match the rows and names actually produced', () => {
  const rows = [
    { tradeName: 'A TAB', scientificName: 'X', strength: '1', dosageForm: 'Tablet', regNo: 'r1', page: 1 },
    { tradeName: 'B TAB', scientificName: 'Y', strength: '1', dosageForm: 'Tablet', regNo: 'r2', page: 1 }
  ];
  const out = buildBrandsFile(rows, { sha256: 'deadbeef' });
  assert.equal(out.meta.rows, 2);
  assert.equal(out.meta.names, 2);
  assert.equal(out.meta.sha256, 'deadbeef');
  assert.equal(out.meta.source, 'Saudi Food and Drug Authority public registered-drug list');
  assert.equal(out.meta.url, 'https://www.sfda.gov.sa/en/drugs-list');
  assert.equal(typeof out.meta.method, 'string');
  assert.ok(out.meta.method.length > 0 && !out.meta.method.includes('\n'), 'method is a one-line string');
});

// --------------------------------------------------------- the built file

test('sanity: data/sfda-brands.json exists and parses', () => {
  assert.ok(fs.existsSync(OUTPUT_PATH), 'run `node scripts/build-sfda-brands.js` before this suite');
});

test('sanity: meta.names equals the number of keys actually in names', () => {
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  assert.equal(built.meta.names, Object.keys(built.names).length);
});

test('sanity: meta.rows equals the rows read from the local (git-ignored) input file', (t) => {
  if (!fs.existsSync(INPUT_PATH)) {
    t.skip('data/build/sfda-rows.json is git-ignored and not present in this checkout - cannot cross-check meta.rows here');
    return;
  }
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  const rows = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  assert.equal(built.meta.rows, rows.length);
});

test('sanity: BRUFEN maps to an ibuprofen set', () => {
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  assert.ok(Object.prototype.hasOwnProperty.call(built.names, 'BRUFEN'), 'BRUFEN is absent from the built file - cannot assert what it maps to');
  assert.deepEqual(built.names.BRUFEN, [['IBUPROFEN']]);
});

test('sanity: GLUCOPHAGE maps to a metformin set', () => {
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  assert.ok(Object.prototype.hasOwnProperty.call(built.names, 'GLUCOPHAGE'), 'GLUCOPHAGE is absent from the built file - cannot assert what it maps to');
  // The SFDA register's own scientific name is "METFORMIN HYDROCHLORIDE" (the
  // salt), not the bare INN "METFORMIN" - this build does not strip salt
  // forms from ingredient names, so the real value is asserted as-is.
  assert.deepEqual(built.names.GLUCOPHAGE, [['METFORMIN HYDROCHLORIDE']]);
});

test('sanity: PANADOL EXTRA differs from PANADOL, both present with their real ingredient sets', () => {
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  assert.ok(Object.prototype.hasOwnProperty.call(built.names, 'PANADOL'), 'PANADOL is absent from the built file');
  assert.ok(Object.prototype.hasOwnProperty.call(built.names, 'PANADOL EXTRA'), 'PANADOL EXTRA is absent from the built file');
  assert.deepEqual(built.names.PANADOL, [['PARACETAMOL']]);
  assert.deepEqual(built.names['PANADOL EXTRA'], [['CAFFEINE CITRATE', 'PARACETAMOL']]);
  assert.notDeepEqual(built.names.PANADOL, built.names['PANADOL EXTRA']);
});

test('sanity: LYRICA is the only key that starts with "LYRICA" (the row\'s own strength is stripped, so all six pregabalin rows collapse into one)', () => {
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  const lyricaKeys = Object.keys(built.names).filter((k) => k.startsWith('LYRICA'));
  assert.deepEqual(lyricaKeys, ['LYRICA']);
});

test('sanity: no key contains a leftover digit+unit token or a bare "I U" (GM, MICROGM, MMOL, MEQ, dotted/undotted I.U are all recognised units now)', () => {
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  const bad = Object.keys(built.names).filter((k) => /\d+(GM|MG|ML|IU|MEQ|MMOL)\b|\bI U\b/.test(k));
  assert.deepEqual(bad, [], 'these keys still carry a strength/unit token: ' + bad.slice(0, 10).join(', '));
});

test('sanity: no key ends with a stray " FOR", and SEROQUEL has no "F C" sibling', () => {
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  const badFor = Object.keys(built.names).filter((k) => k.endsWith(' FOR'));
  assert.deepEqual(badFor, [], 'these keys still end with a stranded FOR: ' + badFor.slice(0, 10).join(', '));
  assert.equal(Object.prototype.hasOwnProperty.call(built.names, 'SEROQUEL F C'), false);
});

test('sanity: no ingredient set in the built file is empty', () => {
  const built = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  const namesWithEmptySet = Object.keys(built.names).filter((name) =>
    built.names[name].some((set) => set.length === 0)
  );
  assert.deepEqual(namesWithEmptySet, [], 'these names hold an empty ingredient set: ' + namesWithEmptySet.slice(0, 10).join(', '));
});

test('sanity: the built file is under 1.5 MB', () => {
  const bytes = fs.statSync(OUTPUT_PATH).size;
  assert.ok(bytes < 1.5 * 1024 * 1024, 'sfda-brands.json is ' + bytes + ' bytes, at or over the 1.5 MB limit');
});

test('sanity: the built file is ASCII-safe (every byte < 128)', () => {
  const buf = fs.readFileSync(OUTPUT_PATH);
  let firstBad = -1;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] >= 128) { firstBad = i; break; }
  }
  assert.equal(firstBad, -1, firstBad === -1 ? '' : ('non-ASCII byte at offset ' + firstBad));
});
