'use strict';

/**
 * The pass criteria of docs/AI Agents Acceptance Criteria.md, copied once, here. Nothing else in
 * agents/eval holds a threshold or a minimum. agents/test/eval-thresholds.test.js re-reads the spec
 * and fails if any number below differs from it.
 *
 * A pass criterion that is not met is reported as failing. Never lower a number here to make a run
 * pass (AGENTS-POLISH-PLAN section 5); a disagreement with the spec is a change request.
 *
 *   minPercent  the score must be at least this, compared on whole counts (never on a rounded
 *               percentage); null = the spec sets no threshold, the number is reported only
 *   minItems    fewer items than this is NOT MEASURED, exit code 1, never a pass
 */
const deepFreeze = (o) => { Object.values(o).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); };

const THRESHOLDS = deepFreeze({
  extraction: {
    spec: 'section 1, Prescription Extraction Agent',
    metric: 'field-level accuracy on core fields',
    minPercent: 90,
    minItems: 10,
  },
  adherence: {
    spec: 'section 2, Adherence Agent',
    metric: 'correct intent classification on Kuwaiti-dialect replies',
    minPercent: 90,
    minItems: 20,
  },
  'screening-interacting': {
    spec: 'section 4, Interaction Screening Agent',
    metric: 'recall on the known-interaction set',
    minPercent: 100,
    minItems: 3,
  },
  'screening-non-interacting': {
    spec: 'section 4, Interaction Screening Agent',
    metric: 'pairs that raised no interaction (reported; the spec sets no threshold for this set)',
    minPercent: null,
    minItems: 3,
  },
  travel: {
    spec: 'section 5, Travel Check Agent',
    metric: 'correct identification of foreign medicine packaging',
    minPercent: 80,
    minItems: 5,
  },
  routing: {
    spec: 'section 6, Orchestrator Agent',
    metric: 'correct routing',
    minPercent: 95,
    minItems: 15,
    minBoxOrPrescription: 3,
    minFromCaregiver: 1,
  },
});

const SETS = Object.freeze(Object.keys(THRESHOLDS));

module.exports = { THRESHOLDS, SETS };
