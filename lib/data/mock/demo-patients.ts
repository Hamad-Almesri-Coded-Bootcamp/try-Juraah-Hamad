/**
 * Two demo patients added at the owner's direction (D-041), kept OUTSIDE the seed transcription:
 * `seed.ts` stays a one-to-one copy of docs/Seed Dataset.md (its twelve test IDs, eleven accounts
 * and four patients are counted by seed:diff and guard S), so these two never enter the mock store.
 *
 * Each one starts the way بدر does in the seed: `onboardingCompleted: false` (A2 is reachable), no
 * prescription, no Settings, MessagingLink or PushSubscription row, no caregiver, no audit event.
 * The production database holds the rows (`scripts/db/add-demo-patients.ts`); the only code that
 * reads this list is the test-list check in lib/session/resolve.ts.
 *
 * The Civil IDs are made up: the seed's 12-digit shape, no clash with the twelve, and each fails
 * Kuwait's real check digit, so neither can belong to a real person.
 */
export interface DemoPatient {
  readonly patientId: string;
  readonly accountId: string;
  readonly civilId: string;
  readonly name: string;
}

export const DEMO_PATIENTS: readonly DemoPatient[] = [
  { patientId: 'pt-05', accountId: 'acc-12', civilId: '294061800352', name: 'هيثم حمد العجمي' },
  { patientId: 'pt-06', accountId: 'acc-13', civilId: '297112300461', name: 'حمد المسري' },
];

export const DEMO_TEST_CIVIL_IDS: readonly string[] = DEMO_PATIENTS.map((p) => p.civilId);
