'use strict';

/**
 * Build-time guards in scripts/build.js that are not about any one workflow's Code-node LOGIC (that
 * is what check.js's static checks are for) - just the build script's own defensive limits.
 */

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

// A dummy base so requiring scripts/build.js does not throw on its top-of-file env check. Its write
// loop for the three REAL workflows is guarded behind `require.main === module` (scripts/build.js),
// so requiring it here as a module never touches the committed workflows/*.json files.
process.env.JURAH_API_BASE = process.env.JURAH_API_BASE || 'https://example.test/api/agent';
const { write, CODE_NODE_LIMIT_BYTES } = require('../scripts/build.js');

const WORKFLOWS_DIR = path.join(__dirname, '..', 'workflows');

test('write() refuses a Code node over the 2 MB limit - the guard against data/sfda-brands.json inlining too large', () => {
  const huge = 'x'.repeat(CODE_NODE_LIMIT_BYTES + 1);
  const workflow = {
    name: 'test-build-guard-oversized',
    nodes: [{ parameters: { jsCode: huge }, id: '1', name: 'huge node', type: 'n8n-nodes-base.code', position: [0, 0] }],
    connections: {}, settings: {}
  };
  const p = path.join(WORKFLOWS_DIR, workflow.name + '.json');
  assert.throws(() => write(workflow), /over the 2097152-byte limit/);
  assert.equal(fs.existsSync(p), false, 'refused before anything was written to disk');
});

test('write() accepts a Code node comfortably under the limit', () => {
  const workflow = {
    name: 'test-build-guard-small-' + Date.now(),
    nodes: [{ parameters: { jsCode: 'const x = 1;' }, id: '1', name: 'small node', type: 'n8n-nodes-base.code', position: [0, 0] }],
    connections: {}, settings: {}
  };
  const p = path.join(WORKFLOWS_DIR, workflow.name + '.json');
  try {
    assert.doesNotThrow(() => write(workflow));
    assert.ok(fs.existsSync(p));
  } finally {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

test('a non-Code node (no jsCode) is never subject to the size guard', () => {
  const workflow = {
    name: 'test-build-guard-nocod-' + Date.now(),
    nodes: [{ parameters: { method: 'GET', url: 'https://example.test' }, id: '1', name: 'http node', type: 'n8n-nodes-base.httpRequest', position: [0, 0] }],
    connections: {}, settings: {}
  };
  const p = path.join(WORKFLOWS_DIR, workflow.name + '.json');
  try {
    assert.doesNotThrow(() => write(workflow));
  } finally {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});
