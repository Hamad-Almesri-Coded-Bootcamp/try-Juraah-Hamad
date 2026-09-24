'use strict';

/**
 * Loading and checking an evaluation set. A set is measured only when its data file exists, is
 * valid against its schema in agents/eval/datasets, holds no owed-value marker in any item, and has
 * at least the spec's minimum (thresholds.js). Anything short of that is NOT MEASURED - a missing
 * input is a failure, never a pass.
 */

const fs = require('node:fs');
const path = require('node:path');
const { validate } = require('./schema');
const { THRESHOLDS, SETS } = require('./thresholds');

const DATASETS = path.join(__dirname, 'datasets');
const REPO_ROOT = path.join(__dirname, '..', '..');
/** The owed-value marker, built so that this file is not counted as holding one (Guard P). */
const OWED_MARKER = new RegExp(['TO', 'BE', 'SUPPLIED'].join('[ _]'));

const schemaFor = (set) => JSON.parse(fs.readFileSync(path.join(DATASETS, set + '.schema.json'), 'utf8'));

function hasMarker(value) {
  if (typeof value === 'string') return OWED_MARKER.test(value);
  if (Array.isArray(value)) return value.some(hasMarker);
  if (value && typeof value === 'object') return Object.values(value).some(hasMarker);
  return false;
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif', '.pdf': 'application/pdf' };
const mimeOf = (file) => MIME[path.extname(file).toLowerCase()] || null;

/** What a schema cannot say: the rules that tie one field of an item to another. */
function itemRules(set, it) {
  const p = [];
  if (set === 'extraction' && it.expected.isPrescription === false) {
    const filled = Object.keys(it.expected).filter((k) => k !== 'isPrescription' && it.expected[k] !== null);
    if (filled.length) p.push('isPrescription is false, so every other expected field must be null (' + filled.join(', ') + ' is not)');
  }
  if (set === 'extraction' && it.expected.doseTimes && it.expected.frequencyPerDay === null) {
    p.push('expected.doseTimes is given without frequencyPerDay: a record never keeps times without the frequency they belong to');
  }
  if (set === 'extraction' && it.expected.doseTimes && it.expected.frequencyPerDay !== null && it.expected.doseTimes.length !== it.expected.frequencyPerDay) {
    p.push('expected.doseTimes has ' + it.expected.doseTimes.length + ' times for a frequencyPerDay of ' + it.expected.frequencyPerDay);
  }
  if (set === 'extraction' && (it.expected.strength === null) !== (it.expected.strengthUnit === null)) {
    p.push('expected.strength and expected.strengthUnit go together: both as written, or both null when either is not written');
  }
  if (set === 'screening-interacting' || set === 'screening-non-interacting') {
    if (it.drugA.trim().toLowerCase() === it.drugB.trim().toLowerCase()) p.push('drugA and drugB are the same drug');
  }
  if (set === 'routing') {
    if ((it.kind === 'photo' || it.kind === 'document') && !it.file) p.push('a ' + it.kind + ' needs its file');
    if ((it.kind === 'text' || it.kind === 'tap' || it.kind === 'start') && !(typeof it.text === 'string' && it.text.trim())) p.push('a ' + it.kind + ' needs its text');
    if (it.boxOrPrescription === true && it.kind !== 'photo' && it.kind !== 'document') p.push('boxOrPrescription is only for a photo or a document');
  }
  return p;
}

/**
 * Read one data file. `problems` lists everything that stops it from being measured; the items
 * are returned only when there is no problem.
 *   -> { set, file, dir, owed, items, problems }
 */
function loadSet(set, file) {
  if (!SETS.includes(set)) throw new Error('unknown set ' + set + ' (known: ' + SETS.join(', ') + ')');
  const out = { set, file, dir: path.dirname(file), owed: null, items: [], problems: [] };
  if (!fs.existsSync(file)) { out.problems.push('the data file ' + file + ' does not exist'); return out; }
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { out.problems.push('the data file is not valid JSON: ' + e.message); return out; }
  const errors = validate(schemaFor(set), data);
  if (errors.length) {
    out.problems.push('the data file does not match ' + set + '.schema.json: ' + errors.slice(0, 8).join('; ') + (errors.length > 8 ? ' (and ' + (errors.length - 8) + ' more)' : ''));
    return out;
  }
  out.owed = data.owed || null;
  const items = data.items;
  const ids = new Set();
  for (const it of items) {
    if (ids.has(it.id)) out.problems.push('item id "' + it.id + '" appears twice');
    ids.add(it.id);
    if (hasMarker(it)) out.problems.push('item "' + it.id + '" still holds an owed-value marker');
    for (const p of itemRules(set, it)) out.problems.push('item "' + it.id + '": ' + p);
    if (it.file !== undefined) {
      const abs = path.resolve(out.dir, it.file);
      if (!fs.existsSync(abs)) out.problems.push('item "' + it.id + '": the file ' + it.file + ' does not exist next to the data file');
      else if (!mimeOf(abs)) out.problems.push('item "' + it.id + '": ' + it.file + ' is not an image or a PDF');
    }
  }
  if (!out.problems.length) out.items = items;
  return out;
}

/**
 * Why a VALID set cannot be measured yet, or null. The first reason is the plan's exact wording:
 * "<set> has <n> of <min> items".
 */
function shortfall(set, items, owed) {
  const t = THRESHOLDS[set];
  if (items.length < t.minItems) return set + ' has ' + items.length + ' of ' + t.minItems + ' items';
  if (set === 'extraction') {
    // "representative synthetic prescriptions (typed/handwritten, English/Arabic)": at least one of each.
    for (const [key, value, label] of [['layout', 'typed', 'typed'], ['layout', 'handwritten', 'handwritten'], ['language', 'ar', 'Arabic'], ['language', 'en', 'English']]) {
      if (!items.some((x) => x[key] === value)) return 'extraction has no ' + label + ' prescription (the spec asks for typed and handwritten, Arabic and English)';
    }
  }
  if (set === 'routing') {
    const box = items.filter((x) => x.boxOrPrescription === true).length;
    if (box < t.minBoxOrPrescription) return 'routing has ' + box + ' of ' + t.minBoxOrPrescription + ' box-or-prescription confusions';
    const carer = items.filter((x) => x.from === 'active_caregiver' || x.from === 'inactive_caregiver').length;
    if (carer < t.minFromCaregiver) return 'routing has ' + carer + ' of ' + t.minFromCaregiver + ' caregiver messages';
  }
  if (owed) return set + ' still carries its owed-value marker: delete "owed" from the data file once the set is supplied';
  return null;
}

/** An item's file as { mimeType, base64 }. */
function fileOf(dir, item) {
  const abs = path.resolve(dir, item.file);
  return { mimeType: mimeOf(abs), base64: fs.readFileSync(abs).toString('base64') };
}

/** True when `file` lies inside the repository (a smoke file must not: it is never committed). */
function insideRepository(file) {
  const rel = path.relative(REPO_ROOT, path.resolve(file));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

module.exports = { DATASETS, REPO_ROOT, loadSet, shortfall, fileOf, mimeOf, insideRepository, hasMarker };
