/**
 * Named invariant — nothing before consent (WP4h ACCEPTANCE): before an explicit accept, F0's
 * module graph touches no `lib/data` function beyond `getInvitationForConsent`, `acceptInvitation`,
 * `declineInvitation` — no prescription, dose, alert or activity function may appear anywhere in
 * `app/[locale]/invitation/page.tsx` or `features/caregiving/InviteConsent.tsx`, the only two
 * modules F0's route renders. A static source scan, run against the real files (not a mock), so it
 * catches an accidental import as reliably as a runtime call.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const PAGE = readFileSync(path.join(ROOT, 'app/[locale]/invitation/page.tsx'), 'utf8');
const COMPONENT = readFileSync(path.join(ROOT, 'features/caregiving/InviteConsent.tsx'), 'utf8');
const SOURCE = `${PAGE}\n${COMPONENT}`;

const ALLOWED_DATA_FUNCTIONS = ['getInvitationForConsent', 'acceptInvitation', 'declineInvitation'];
const ALLOWED_SESSION_FUNCTIONS = ['getSession', 'getRoleOptions'];

// Every other named export lib/data actually publishes (docs/SCREENS.md appendix) — none of these
// may appear anywhere in F0's two modules before acceptance.
const FORBIDDEN_DATA_FUNCTIONS = [
  'getPatient', 'updatePatientPhone', 'completeOnboarding', 'getSettings', 'updateSettings',
  'getPrescriptions', 'getPrescription', 'getDosesForDay', 'getDoseHistory', 'getRecentDoses',
  'submitPrescriptionImage', 'savePrescriptionDraft', 'getAlerts', 'getAlert', 'checkDrugPhoto',
  'getRefillOverview', 'requestRefill', 'getRefillRequests', 'getCalendarSubscription', 'enableCalendarSync',
  'getActivity', 'getPushCapability', 'getPushState', 'requestPushPermission', 'disablePush',
  'sendTestNotification', 'getMessagingLink', 'startMessagingLink', 'disconnectMessaging', 'sendTestMessage',
  'getCaregivers', 'lookupMaskedName', 'inviteCaregiver', 'cancelInvitation', 'revokeCaregiver',
  'getPendingInvitationsForSubject', 'getCaregiverLink', 'selfUnlink', 'getReviewQueue',
  'getFieldConfirmationQueue', 'getAlertForReview', 'submitReviewDecision', 'getFlaggedPrescription',
  'confirmPrescriptionFields', 'returnPrescriptionToClinic', 'getAuditLog', 'getClinicianProfile', 'readLastKnownSnapshot',
];

function importedNamesFrom(source: string, moduleSpecifierPattern: RegExp): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/import\s*{([^}]+)}\s*from\s*['"]([^'"]+)['"]/g)) {
    const [, clause, specifier] = match;
    if (!clause || !specifier || !moduleSpecifierPattern.test(specifier)) continue;
    names.push(...clause.split(',').map((n) => n.trim().split(/\s+as\s+/)[0]!.trim()).filter(Boolean));
  }
  return names;
}

describe('F0 module graph — no lib/data function beyond the four the spec names for this screen', () => {
  it('every name imported from @/lib/data is in the allowed set', () => {
    const imported = importedNamesFrom(SOURCE, /^@\/lib\/data$/);
    expect(imported.length).toBeGreaterThan(0); // sanity: the files do import from lib/data
    for (const name of imported) expect(ALLOWED_DATA_FUNCTIONS).toContain(name);
  });

  it('every name imported from @/lib/session is in the allowed set (a different module, not a lib/data function)', () => {
    const imported = importedNamesFrom(SOURCE, /^@\/lib\/session$/);
    for (const name of imported) expect(ALLOWED_SESSION_FUNCTIONS).toContain(name);
  });

  it('no forbidden lib/data function name appears anywhere in F0’s source at all (belt and braces)', () => {
    for (const name of FORBIDDEN_DATA_FUNCTIONS) {
      const pattern = new RegExp(`\\b${name}\\b`);
      expect(pattern.test(SOURCE), name).toBe(false);
    }
  });

  it('neither file imports from lib/data/mock or contains a fetch (guard 3, restated for this screen)', () => {
    expect(/from\s+['"](@\/)?lib\/data\/mock/.test(SOURCE)).toBe(false);
    expect(/\bfetch\s*\(/.test(SOURCE)).toBe(false);
  });
});
