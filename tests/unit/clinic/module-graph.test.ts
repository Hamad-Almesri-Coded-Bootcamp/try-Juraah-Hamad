/**
 * Named invariant (WP4i ACCEPTANCE) — "no patient reachable without a queue item": the reviewer's
 * G1s/G2s/G3s module graph calls only the clinic reviewer functions the brief names (`getReviewQueue`,
 * `getFieldConfirmationQueue`, `getAlertForReview`, `submitReviewDecision`, `getFlaggedPrescription`,
 * `confirmPrescriptionFields`, `returnPrescriptionToClinic`) plus the session module — never
 * `getPatient`, `getPrescriptions` or any other function that could look a patient up outside a
 * queue item. A static source scan, run against the real files, so it catches an accidental import
 * as reliably as a runtime call (same technique as `tests/unit/caregiving/module-graph.test.ts`).
 *
 * The brief's own wording says "the five clinic functions plus session"; the actual published set
 * for the reviewer is seven (the two field-confirmation mutations plus the five read/decision
 * functions) — recorded as an assumption in the WP4i report rather than silently trimmed to five.
 *
 * X1 (the admin audit log) is checked separately: its module graph may call only `getAuditLog` — no
 * reviewer function, and no `getPatient` either (the admin-session masked-name gap this bundle
 * reports rather than routes around).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');

function read(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8');
}

const REVIEWER_FILES = [
  "app/[locale]/clinic/review/page.tsx",
  "app/[locale]/clinic/review/[alertId]/page.tsx",
  "app/[locale]/clinic/review/fields/page.tsx",
  "app/[locale]/clinic/review/fields/[prescriptionId]/page.tsx",
  'features/clinic/ReviewerQueueShell.tsx',
  'features/clinic/ReviewQueueList.tsx',
  'features/clinic/FieldQueueList.tsx',
  'features/clinic/ReviewerDecision.tsx',
  'features/clinic/FlaggedPrescriptionDetail.tsx',
  'features/clinic/PrescriptionBridge.tsx',
  'features/clinic/WhyTheyInteract.tsx',
  'features/clinic/format.ts',
];

const AUDIT_FILES = ['app/[locale]/clinic/audit/page.tsx', 'features/clinic/AuditLogView.tsx'];

const REVIEWER_SOURCE = REVIEWER_FILES.map(read).join('\n');
const AUDIT_SOURCE = AUDIT_FILES.map(read).join('\n');

const ALLOWED_REVIEWER_DATA_FUNCTIONS = [
  'getReviewQueue',
  'getFieldConfirmationQueue',
  'getAlertForReview',
  'submitReviewDecision',
  'getFlaggedPrescription',
  'confirmPrescriptionFields',
  'returnPrescriptionToClinic',
];
const ALLOWED_AUDIT_DATA_FUNCTIONS = ['getAuditLog'];
const ALLOWED_SESSION_FUNCTIONS = ['getSession', 'getRoleOptions'];

// Every other named export lib/data actually publishes (docs/SCREENS.md appendix) — none of these
// may appear in either module graph.
const FORBIDDEN_DATA_FUNCTIONS = [
  'getPatient', 'updatePatientPhone', 'completeOnboarding', 'getSettings', 'updateSettings',
  'getPrescriptions', 'getPrescription', 'getDosesForDay', 'getDoseHistory', 'getRecentDoses',
  'submitPrescriptionImage', 'savePrescriptionDraft', 'getAlerts', 'getAlert', 'checkDrugPhoto',
  'getRefillOverview', 'requestRefill', 'getRefillRequests', 'getCalendarSubscription', 'enableCalendarSync',
  'getActivity', 'getPushCapability', 'getPushState', 'requestPushPermission', 'disablePush',
  'sendTestNotification', 'getMessagingLink', 'startMessagingLink', 'disconnectMessaging', 'sendTestMessage',
  'getCaregivers', 'lookupMaskedName', 'inviteCaregiver', 'cancelInvitation', 'revokeCaregiver',
  'getPendingInvitationsForSubject', 'getInvitationForConsent', 'acceptInvitation', 'declineInvitation',
  'getCaregiverLink', 'selfUnlink', 'readLastKnownSnapshot',
];

/** Strips comment lines before a "does this name appear at all" scan — this bundle's own doc
 * comments name several forbidden functions on purpose, to explain the gaps they cannot fill
 * (`docs/DECISIONS.md`; `docs/backend-notes/wp4i.md` §4/§7), same as a guard's own `isProse` filter. */
function stripComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

function importedNamesFrom(source: string, moduleSpecifierPattern: RegExp): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/import\s*{([^}]+)}\s*from\s*['"]([^'"]+)['"]/g)) {
    const [, clause, specifier] = match;
    if (!clause || !specifier || !moduleSpecifierPattern.test(specifier)) continue;
    names.push(...clause.split(',').map((n) => n.trim().split(/\s+as\s+/)[0]!.trim()).filter(Boolean));
  }
  return names;
}

describe('reviewer (G1s/G2s/G3s) module graph — clinic reviewer functions plus session only', () => {
  it('every name imported from @/lib/data is in the allowed reviewer set', () => {
    const imported = importedNamesFrom(REVIEWER_SOURCE, /^@\/lib\/data$/);
    expect(imported.length).toBeGreaterThan(0);
    for (const name of imported) expect(ALLOWED_REVIEWER_DATA_FUNCTIONS).toContain(name);
  });

  it('every name imported from @/lib/session is in the allowed set', () => {
    const imported = importedNamesFrom(REVIEWER_SOURCE, /^@\/lib\/session$/);
    for (const name of imported) expect(ALLOWED_SESSION_FUNCTIONS).toContain(name);
  });

  it('no forbidden lib/data function name appears in the reviewer source (comments explaining a gap excepted)', () => {
    const code = stripComments(REVIEWER_SOURCE);
    for (const name of FORBIDDEN_DATA_FUNCTIONS) {
      expect(new RegExp(`\\b${name}\\b`).test(code), name).toBe(false);
    }
    expect(/\bgetAuditLog\b/.test(code)).toBe(false); // admin-only, not the reviewer's
  });

  it('no reviewer file imports from lib/data/mock or contains a fetch (guard 3, restated)', () => {
    expect(/from\s+['"](@\/)?lib\/data\/mock/.test(REVIEWER_SOURCE)).toBe(false);
    expect(/\bfetch\s*\(/.test(REVIEWER_SOURCE)).toBe(false);
  });
});

describe('X1 (admin audit log) module graph — getAuditLog only, no reviewer function, no getPatient', () => {
  it('every name imported from @/lib/data is exactly getAuditLog', () => {
    const imported = importedNamesFrom(AUDIT_SOURCE, /^@\/lib\/data$/);
    expect(imported.length).toBeGreaterThan(0);
    for (const name of imported) expect(ALLOWED_AUDIT_DATA_FUNCTIONS).toContain(name);
  });

  it('no reviewer clinic function or forbidden function appears in X1’s source (comments explaining the masked-name gap excepted)', () => {
    const code = stripComments(AUDIT_SOURCE);
    for (const name of [...ALLOWED_REVIEWER_DATA_FUNCTIONS, ...FORBIDDEN_DATA_FUNCTIONS]) {
      expect(new RegExp(`\\b${name}\\b`).test(code), name).toBe(false);
    }
  });

  it('X1 does not import from lib/data/mock and contains no fetch', () => {
    expect(/from\s+['"](@\/)?lib\/data\/mock/.test(AUDIT_SOURCE)).toBe(false);
    expect(/\bfetch\s*\(/.test(AUDIT_SOURCE)).toBe(false);
  });
});
