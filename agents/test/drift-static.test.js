'use strict';

/**
 * AP-16 row 3 - the static half of "no drift" (agents/scripts/drift.js: staticDrift, regenerate).
 *
 * Builds its OWN "committed" fixture first (a fresh copy of agents/, itself regenerated), so this
 * test never depends on the real tree being freshly built and never touches the real agents/ tree -
 * every scenario below runs against its own disposable copy of that fixture. Green on the fixture
 * itself and on one committed file converted to CRLF; red, each with the broken file named, on: a
 * hand edit inside a committed workflow, a source edit with no rebuild, a stray committed file, a
 * deleted committed file, the committed base swapped to the disconnected placeholder, and a
 * generator that throws. staticDrift must leave the tree it is given unchanged byte for byte.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { staticDrift, regenerate, PROD_API_BASE } = require('../scripts/drift.js');

const REAL_AGENTS = path.join(__dirname, '..');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const freshTmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

/** Every file's path and content under `dir`, so a tree can be proven unchanged byte for byte. */
function fingerprint(dir, base = dir, out = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) fingerprint(p, base, out);
    else out[path.relative(base, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8');
  }
  return out;
}

// One base fixture, built once: a copy of the real agents/ tree, then freshly regenerated in place,
// so its committed workflows are guaranteed in sync with its own generator source before any
// scenario runs — nobody has to trust that the real working tree is currently built.
const BASE = freshTmp('jurah-drift-static-fixture-');
copyDir(REAL_AGENTS, BASE);
const setupProblems = [...regenerate(BASE), ...regenerate(path.join(BASE, 'knowledge'))];
test.after(() => fs.rmSync(BASE, { recursive: true, force: true }));

test('setup: the fixture regenerates cleanly (proof the scenarios below start from a known-good tree)', () => {
  assert.deepEqual(setupProblems, []);
});

test('green: the fixture regenerates byte-identically', () => {
  const r = staticDrift(BASE);
  assert.deepEqual(r.problems, []);
  // AP-04 (PR #22, merged to main at 9a6f449) retired the legacy screening workflow
  // (agents/workflows/agent-interaction-screening.json), dropping the committed total
  // from 9 to 8. See docs/backend-notes/ap-16.md, "Owed", step 9.
  // CR-109 adds agents/workflows/agent-demo-reset.json: 6 in agents/workflows (5 from build.js
  // incl. the demo page, + agent-error) and 3 in agents/knowledge/workflows.
  assert.ok(r.report.length >= 9, r.report.join('\n'));
});

test('staticDrift leaves the tree it is given unchanged byte for byte', () => {
  const copy = freshTmp('jurah-drift-static-untouched-');
  copyDir(BASE, copy);
  const before = fingerprint(copy);
  staticDrift(copy);
  assert.deepEqual(fingerprint(copy), before);
  fs.rmSync(copy, { recursive: true, force: true });
});

test('green: stays green with one committed file converted to CRLF', () => {
  const copy = freshTmp('jurah-drift-static-crlf-');
  copyDir(BASE, copy);
  const target = path.join(copy, 'workflows', 'agent-alexa.json');
  const before = fs.readFileSync(target, 'utf8');
  const crlf = before.replace(/\n/g, '\r\n');
  assert.notEqual(crlf, before, 'the edit did not apply');
  fs.writeFileSync(target, crlf);
  const r = staticDrift(copy);
  assert.deepEqual(r.problems, []);
  fs.rmSync(copy, { recursive: true, force: true });
});

test('red: a hand edit inside a committed workflow (workflows/agent-alexa.json)', () => {
  const copy = freshTmp('jurah-drift-static-handedit-');
  copyDir(BASE, copy);
  const target = path.join(copy, 'workflows', 'agent-alexa.json');
  const before = fs.readFileSync(target, 'utf8');
  fs.writeFileSync(target, `${before} `);
  assert.notEqual(fs.readFileSync(target, 'utf8'), before, 'the edit did not apply');
  const r = staticDrift(copy);
  assert.ok(r.problems.includes('workflows/agent-alexa.json: differs from the committed file'), r.problems.join('\n'));
  fs.rmSync(copy, { recursive: true, force: true });
});

test('red: a lib/voice.js edit with no rebuild (names agent-alexa.json)', () => {
  const copy = freshTmp('jurah-drift-static-libedit-');
  copyDir(BASE, copy);
  const target = path.join(copy, 'lib', 'voice.js');
  const before = fs.readFileSync(target, 'utf8');
  fs.writeFileSync(target, `${before}\n// edited, not rebuilt\n`);
  assert.notEqual(fs.readFileSync(target, 'utf8'), before, 'the edit did not apply');
  const r = staticDrift(copy);
  assert.ok(r.problems.includes('workflows/agent-alexa.json: differs from the committed file'), r.problems.join('\n'));
  fs.rmSync(copy, { recursive: true, force: true });
});

test('red: a stray committed file (workflows/agent-stray.json)', () => {
  const copy = freshTmp('jurah-drift-static-stray-');
  copyDir(BASE, copy);
  const target = path.join(copy, 'workflows', 'agent-stray.json');
  assert.equal(fs.existsSync(target), false);
  fs.writeFileSync(target, '{"name":"agent-stray","nodes":[],"connections":{}}\n');
  assert.equal(fs.existsSync(target), true, 'the edit did not apply');
  const r = staticDrift(copy);
  assert.ok(r.problems.includes('workflows/agent-stray.json: committed, but no generator wrote it'), r.problems.join('\n'));
  fs.rmSync(copy, { recursive: true, force: true });
});

test('red: a deleted committed file (workflows/agent-webchat.json)', () => {
  const copy = freshTmp('jurah-drift-static-deleted-');
  copyDir(BASE, copy);
  const target = path.join(copy, 'workflows', 'agent-webchat.json');
  assert.equal(fs.existsSync(target), true);
  fs.unlinkSync(target);
  assert.equal(fs.existsSync(target), false, 'the edit did not apply');
  const r = staticDrift(copy);
  assert.ok(r.problems.includes('workflows/agent-webchat.json: generated, but not committed'), r.problems.join('\n'));
  fs.rmSync(copy, { recursive: true, force: true });
});

test('red: the committed base swapped to the disconnected placeholder (no JURAH_API_BASE at build time)', () => {
  const copy = freshTmp('jurah-drift-static-invalidbase-');
  copyDir(BASE, copy);
  const placeholder = 'https://backend-not-deployed-yet.invalid/api/agent';
  let changedAny = false;
  for (const dir of [path.join(copy, 'workflows'), path.join(copy, 'knowledge', 'workflows')]) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const p = path.join(dir, f);
      const before = fs.readFileSync(p, 'utf8');
      if (!before.includes(PROD_API_BASE)) continue;
      const after = before.split(PROD_API_BASE).join(placeholder);
      assert.notEqual(after, before, `the edit did not apply to ${f}`);
      fs.writeFileSync(p, after);
      changedAny = true;
    }
  }
  assert.ok(changedAny, 'no committed file carried PROD_API_BASE to swap — the fixture or PROD_API_BASE drifted');
  const r = staticDrift(copy);
  assert.ok(r.problems.length > 0, 'the swap produced no diff at all');
  assert.ok(r.problems.every((p) => p.endsWith('differs from the committed file')), r.problems.join('\n'));
  fs.rmSync(copy, { recursive: true, force: true });
});

test('red: a generator that throws (named, and the other package is still checked)', () => {
  const copy = freshTmp('jurah-drift-static-throws-');
  copyDir(BASE, copy);
  const target = path.join(copy, 'scripts', 'build.js');
  const before = fs.readFileSync(target, 'utf8');
  fs.writeFileSync(target, "throw new Error('boom: deliberately broken for the test');\n");
  assert.notEqual(fs.readFileSync(target, 'utf8'), before, 'the edit did not apply');
  const r = staticDrift(copy);
  assert.ok(r.problems.some((p) => p.startsWith('jurah-agents:') && p.includes('failed')), r.problems.join('\n'));
  // knowledge's own generator never touched build.js, so it still ran and its workflows still compare.
  assert.ok(r.report.some((line) => line.startsWith('same   knowledge/workflows/')), r.report.join('\n'));
  fs.rmSync(copy, { recursive: true, force: true });
});

test('the real tree: no static drift', () => {
  const r = staticDrift(REAL_AGENTS);
  assert.deepEqual(r.problems, []);
});
