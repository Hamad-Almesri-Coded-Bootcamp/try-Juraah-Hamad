/**
 * Demo people added at the owner's direction, kept OUTSIDE the seed transcription: `seed.ts` stays
 * a one-to-one copy of docs/Seed Dataset.md (its twelve test IDs, eleven accounts and four patients
 * are counted by seed:diff and guard S), so none of these ever enters the mock store.
 *
 *   D-041 — two patients (pt-05, pt-06), each starting the way بدر does in the seed.
 *   D-042 — three more patients (pt-07, pt-08 not onboarded; pt-09 onboarded) and two doctors
 *           (acc-17, acc-18) who hold the `reviewer` role only.
 *
 * Every demo patient has no prescription, no Settings, MessagingLink or PushSubscription row, no
 * caregiver and no audit event. `onboardingCompleted: false` sends the patient to A2 first-run
 * setup; `true` lands straight on B1's empty day. A demo doctor is an account with
 * `assigned_roles = {reviewer}` and nothing else, so it resolves to `single_role` reviewer and
 * lands on the review queue; `/clinic/audit` stays unreachable (no `admin`).
 *
 * The production database holds the rows (`scripts/db/add-demo-patients.ts`); the only code that
 * reads these lists is the test-list check in lib/session/resolve.ts and guard S's leak check.
 *
 * The Civil IDs are made up: the seed's 12-digit shape, no clash with the twelve, and each fails
 * Kuwait's real check digit, so none can belong to a real person.
 */
export interface DemoPatient {
  readonly patientId: string;
  readonly accountId: string;
  readonly civilId: string;
  readonly name: string;
  readonly onboardingCompleted: boolean;
}

export interface DemoClinician {
  readonly accountId: string;
  readonly civilId: string;
  readonly name: string;
  readonly roles: readonly ('reviewer' | 'admin')[];
}

export const DEMO_PATIENTS: readonly DemoPatient[] = [
  // D-041
  { patientId: 'pt-05', accountId: 'acc-12', civilId: '294061800352', name: 'هيثم حمد العجمي', onboardingCompleted: false },
  { patientId: 'pt-06', accountId: 'acc-13', civilId: '297112300461', name: 'حمد المسري', onboardingCompleted: false },
  // D-042
  { patientId: 'pt-07', accountId: 'acc-14', civilId: '291050300271', name: 'يوسف ناصر الكندري', onboardingCompleted: false },
  { patientId: 'pt-08', accountId: 'acc-15', civilId: '295081400386', name: 'نورة عادل الرشيدي', onboardingCompleted: false },
  { patientId: 'pt-09', accountId: 'acc-16', civilId: '299021700193', name: 'مريم سعد الشمري', onboardingCompleted: true },
];

export const DEMO_CLINICIANS: readonly DemoClinician[] = [
  // D-042
  { accountId: 'acc-17', civilId: '278100600524', name: 'د. ريم عبدالله القطان', roles: ['reviewer'] },
  { accountId: 'acc-18', civilId: '283122100647', name: 'د. فيصل جاسم الهاجري', roles: ['reviewer'] },
];

export const DEMO_TEST_CIVIL_IDS: readonly string[] = [
  ...DEMO_PATIENTS.map((p) => p.civilId),
  ...DEMO_CLINICIANS.map((c) => c.civilId),
];
