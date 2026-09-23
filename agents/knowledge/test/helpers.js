'use strict';

/**
 * Shared fixtures. Two sources only:
 *   - seed-prescriptions.json: the REAL seed (lib/data/mock/seed.ts buildPrescriptions()), dumped
 *     as the backend's GET /api/agent/patients/{id}/prescriptions returns each row. The repo's
 *     vitest contract test (tests/unit/agent/knowledge-contract.test.ts) reads buildPrescriptions()
 *     live, so a drift between this copy and the seed fails there.
 *   - rx(): a synthetic prescription for a drug the seed does not carry but the index does
 *     (Simvastatin, Clarithromycin, ...), so the graded paths - including a real DDInter Major
 *     row - are tested. Synthetic ids start with "t-".
 */

const path = require('node:path');
const { loadIndex } = require('../src/interactions');
const { buildBrandIndex } = require('../src/resolve');

const INDEX_JSON = require(path.join(__dirname, '..', 'data', 'interaction-index.json'));
const BRANDS_JSON = require(path.join(__dirname, '..', 'data', 'brand-map.json'));
const SEED = require('./seed-prescriptions.json');

const index = loadIndex(INDEX_JSON);
const brandIndex = buildBrandIndex(BRANDS_JSON.brands, index);

/** The active prescriptions of a seed patient, as the backend route returns them (status = active). */
const seedActive = (patientId) => SEED.filter((p) => p.patientId === patientId && p.status === 'active');

function rx(id, genericName, extra) {
  return Object.assign({
    id, patientId: 't-patient', source: { facilityName: 'Test facility', sector: 'public' },
    drug: { genericName }, dosePerAdministration: 1, frequencyPerDay: 1, durationDays: 30, dosingPattern: 'daily',
    startDate: '2026-09-01', doseTimes: ['08:00'], needsReview: false, status: 'active'
  }, extra || {});
}

module.exports = { index, brandIndex, INDEX_JSON, BRANDS_JSON, SEED, seedActive, rx };
