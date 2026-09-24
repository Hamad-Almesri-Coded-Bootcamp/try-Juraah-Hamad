'use strict';

/**
 * AP-08 - the evaluation harness. Measures each data-based pass criterion of
 * docs/AI Agents Acceptance Criteria.md on its human-supplied set (agents/eval/datasets).
 *
 *   node eval/run.js                          every set, from agents/eval/datasets
 *   node eval/run.js --set adherence          one set (repeat --set, or give a comma list)
 *   node eval/run.js --datasets <dir>         the same sets from another folder (<set>.json in it)
 *   node eval/run.js --smoke <file>           a plumbing check on a file OUTSIDE the repository;
 *                                             never a measurement, whatever it scores
 *   node eval/run.js --smoke-example          the same, on the spec's first example reply, written
 *                                             to a temporary folder (the real-model smoke check)
 *   node eval/run.js --out <file.json>        also write the results as JSON (for docs/VERIFICATION.md)
 *
 * GEMINI_API_KEY is read from the shell, for the sets that call the model, and never printed.
 *
 * Exit code 0 only when every set asked for was MEASURED and PASSED. A missing data file, an invalid
 * one, fewer items than the spec's minimum, a missing key or any failed model call is
 * "NOT MEASURED: ..." and exit code 1 - never a pass.
 */

const fs = require('node:fs');
const path = require('node:path');
const { THRESHOLDS, SETS } = require('./thresholds');
const { DATASETS, loadSet, shortfall, insideRepository } = require('./datasets');
const { ADAPTERS, NotMeasurable } = require('./sets');
const { geminiTransport, realSleep } = require('./gemini');

/** Whole counts decide; the percentage shown is cut (never rounded) to one decimal. */
const passes = (correct, total, minPercent) => correct * 100 >= minPercent * total;
const shownPercent = (correct, total) => (total === 0 ? '0.0' : (Math.floor((correct * 1000) / total) / 10).toFixed(1));

function describeMiss(r) {
  const show = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
  return 'miss ' + r.id + ': expected ' + show(r.expected) + ', got ' + show(r.got) + (r.detail ? ' ' + JSON.stringify(r.detail) : '');
}

/**
 * Evaluate. Everything a test needs to replace is a parameter: the transport (the model call),
 * the environment (the key), the sleep between retries and the printer.
 *   -> { exitCode, sets: [{ set, status: 'NOT MEASURED'|'PASS'|'FAIL'|'REPORTED'|'SMOKE OK'|'SMOKE FAILED', ... }] }
 */
async function evaluate(opts = {}) {
  const env = opts.env || process.env;
  const key = typeof env.GEMINI_API_KEY === 'string' ? env.GEMINI_API_KEY : '';
  const redact = (s) => (key.length >= 6 ? String(s).split(key).join('[redacted]') : String(s));
  const print = (line) => (opts.print || console.log)(redact(line));
  const ctx = { transport: opts.transport || null, sleep: opts.sleep || realSleep };
  const smoke = opts.smoke ? path.resolve(opts.smoke) : null;
  const out = [];

  let sets = opts.sets && opts.sets.length ? opts.sets : null;
  if (smoke) {
    if (insideRepository(smoke)) {
      print('NOT MEASURED: a smoke file must live in a temporary folder outside the repository, never committed (' + smoke + ')');
      return { exitCode: 1, sets: [{ set: null, status: 'NOT MEASURED', reason: 'smoke file inside the repository' }] };
    }
    let declared = null;
    try { declared = JSON.parse(fs.readFileSync(smoke, 'utf8')).set; } catch (e) { declared = null; }
    if (!SETS.includes(declared)) {
      print('NOT MEASURED: the smoke file ' + smoke + ' does not name a known set in its "set" field');
      return { exitCode: 1, sets: [{ set: null, status: 'NOT MEASURED', reason: 'smoke file names no set' }] };
    }
    if (sets && (sets.length !== 1 || sets[0] !== declared)) {
      print('NOT MEASURED: --set ' + sets.join(',') + ' does not match the smoke file, which is a ' + declared + ' set');
      return { exitCode: 1, sets: [{ set: declared, status: 'NOT MEASURED', reason: 'smoke set mismatch' }] };
    }
    sets = [declared];
  }
  sets = [...new Set(sets || SETS)];
  const unknown = sets.filter((s) => !SETS.includes(s));
  if (unknown.length) throw new Error('unknown set(s): ' + unknown.join(', ') + ' (known: ' + SETS.join(', ') + ')');

  for (const set of sets) {
    const t = THRESHOLDS[set];
    const adapter = ADAPTERS[set];
    const file = smoke || path.join(opts.datasetsDir || DATASETS, set + '.json');
    const notMeasured = (reason, extra = {}) => { print('NOT MEASURED: ' + reason); out.push({ set, status: 'NOT MEASURED', reason, ...extra }); };

    const loaded = loadSet(set, file);
    if (loaded.problems.length) { notMeasured(set + ' - ' + loaded.problems.join('; ')); continue; }
    if (!smoke) {
      const why = shortfall(set, loaded.items, loaded.owed);
      if (why) { notMeasured(why, { items: loaded.items.length, minItems: t.minItems }); continue; }
    } else if (loaded.items.length === 0) { notMeasured(set + ' - the smoke file has no item'); continue; }

    let transport = ctx.transport;
    if (adapter.model && !transport) {
      if (!key) { notMeasured(set + ' needs GEMINI_API_KEY in this shell (it is read from the environment only, never from a file)'); continue; }
      transport = geminiTransport(key);
    }

    let results;
    try {
      results = await adapter.run(loaded.items, { ...ctx, transport }, loaded.dir);
    } catch (e) {
      if (e instanceof NotMeasurable) { notMeasured(e.message); continue; }
      notMeasured(set + ' - the harness failed: ' + (e && e.message));
      continue;
    }
    const errors = results.filter((r) => r.error);
    if (errors.length) {
      notMeasured(set + ' - ' + errors.length + ' of ' + results.length + ' items could not be run, so this is not a measurement: ' +
        errors.slice(0, 3).map((r) => r.id + ' (' + r.error + ')').join('; '));
      continue;
    }
    const correct = results.reduce((s, r) => s + r.unitsCorrect, 0);
    const total = results.reduce((s, r) => s + r.units, 0);
    const across = set === 'extraction' ? ' across ' + results.length + ' prescriptions' : '';
    const score = correct + ' of ' + total + ' ' + adapter.unit + ' correct' + across + ' (' + shownPercent(correct, total) + '%)';
    const misses = results.filter((r) => !r.correct);
    let status;
    if (smoke) {
      status = misses.length === 0 ? 'SMOKE OK' : 'SMOKE FAILED';
      print(status + ' ' + set + ': ' + score + ' - a plumbing check on ' + results.length + ' item(s), NOT a measurement (the spec needs at least ' + t.minItems + ' items)');
    } else if (t.minPercent === null) {
      status = 'REPORTED';
      print('REPORTED ' + set + ': ' + score + ' - ' + t.metric + ' (' + t.spec + ')');
    } else {
      status = passes(correct, total, t.minPercent) ? 'PASS' : 'FAIL';
      print(status + ' ' + set + ': ' + score + ' - the spec needs at least ' + t.minPercent + '% ' + t.metric + ' on at least ' + t.minItems + ' items (' + t.spec + ')');
    }
    for (const r of misses) print('        ' + describeMiss(r));
    if (set === 'screening-non-interacting') {
      const nc = results.filter((r) => r.detail && r.detail.notCovered).length;
      if (nc) print('        ' + nc + ' of ' + results.length + ' pairs are not covered by the index ("cannot verify"): no interaction raised, and no clearance either');
    }
    out.push({ set, status, correct, total, unit: adapter.unit, items: results.length, minPercent: t.minPercent, minItems: t.minItems, results });
  }

  const good = (s) => s.status === 'PASS' || s.status === 'REPORTED' || s.status === 'SMOKE OK';
  const exitCode = out.length > 0 && out.every(good) ? 0 : 1;
  const measured = out.filter((s) => s.status === 'PASS' || s.status === 'FAIL' || s.status === 'REPORTED').length;
  print('');
  print(smoke
    ? (exitCode === 0 ? 'smoke check passed - this is not a measurement of any threshold' : 'smoke check FAILED')
    : measured + ' of ' + out.length + ' sets measured; ' + out.filter((s) => s.status === 'PASS').length + ' passed' +
      (exitCode === 0 ? '' : ' - exit code 1: every set must be measured and pass'));
  if (opts.outFile) {
    fs.writeFileSync(opts.outFile, JSON.stringify({ ranAt: new Date().toISOString(), smoke: !!smoke, exitCode, sets: out }, null, 2) + '\n');
  }
  return { exitCode, sets: out };
}

/**
 * The one-item smoke file for a real-model check, written to a new temporary folder outside the
 * repository: the first row of the spec's own language table (section 2), «خذيته» -> taken_on_time.
 * A plumbing check of the real transport, not an evaluation item.
 */
function writeSmokeExample() {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'jurah-eval-smoke-'));
  const file = path.join(dir, 'adherence-smoke.json');
  fs.writeFileSync(file, JSON.stringify({ set: 'adherence', items: [{ id: 'spec-table-1', text: 'خذيته', expected: 'taken_on_time',
    verifiedBy: 'the language table of docs/AI Agents Acceptance Criteria.md section 2 (a smoke check, not a dataset item)' }] }, null, 2) + '\n');
  return { dir, file };
}

function parseArgs(argv) {
  const o = { sets: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { if (i + 1 >= argv.length) throw new Error(a + ' needs a value'); return argv[++i]; };
    if (a === '--set') o.sets.push(...next().split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--datasets') o.datasetsDir = path.resolve(next());
    else if (a === '--smoke') o.smoke = next();
    else if (a === '--smoke-example') o.smokeExample = true;
    else if (a === '--out') o.outFile = path.resolve(next());
    else if (a === '--help' || a === '-h') o.help = true;
    else throw new Error('unknown argument ' + a);
  }
  return o;
}

if (require.main === module) {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (args.help) {
    const head = fs.readFileSync(__filename, 'utf8').split('*/')[0];
    console.log(head.replace(/^\/\*\*|^ \* ?/gm, '').replace(/^'use strict';\s*/, '').trim());
    process.exit(0);
  }
  let example = null;
  if (args.smokeExample) {
    if (args.smoke) { console.error('--smoke-example and --smoke are two ways to name the smoke file: give one'); process.exit(2); }
    example = writeSmokeExample();
    args.smoke = example.file;
    console.log('smoke file (temporary, removed afterwards): ' + example.file);
  }
  const cleanUp = () => { if (example) fs.rmSync(example.dir, { recursive: true, force: true }); };
  evaluate(args).then((r) => { cleanUp(); process.exitCode = r.exitCode; }, (e) => { cleanUp(); console.error(e.message); process.exitCode = 1; });
}

module.exports = { evaluate, parseArgs, passes, shownPercent, writeSmokeExample };
