/**
 * The Civil ID resolution algorithm (docs/ROLES.md → "How a Civil ID resolves"), as a PURE
 * function so the twelve-ID tests run against it directly, with no `next/headers` (docs/briefs/
 * WP1.md §5). `lib/session/index.ts` wraps this with the cookie and the Hawiati countdown.
 */
import type { StoreState } from '@/lib/data/mock/types';
import { ALL_TEST_CIVIL_IDS } from '@/lib/data/mock/seed';
import { findAccountByCivilId } from '@/lib/data/mock/accounts';
import { activeCaregiversFor, pendingInvitationsFor, patientFirstName } from '@/lib/data/mock/caregivers';
import type { Role, RoleOption, SignInOutcome, Session } from '@/types/views';

export function roleOptionsFor(store: StoreState, civilId: string): RoleOption[] {
  const options: RoleOption[] = [];

  const patient = store.patients.find((p) => p.civilId === civilId);
  if (patient) options.push({ role: 'patient', subjectId: patient.id });

  // Out of scope: a caregiver linked to more than one patient (spec, "Explicitly Out of Scope") —
  // at most one active Caregiver row per Civil ID.
  const activeCaregiver = activeCaregiversFor(store, civilId)[0];
  if (activeCaregiver) {
    options.push({
      role: 'caregiver',
      subjectId: activeCaregiver.id,
      linkedPatientId: activeCaregiver.linkedPatientId,
      patientFirstName: patientFirstName(store, activeCaregiver.linkedPatientId),
      relationship: activeCaregiver.relationship,
    });
  }

  const account = findAccountByCivilId(store, civilId);
  for (const role of (account?.roles ?? []) as Role[]) {
    if (role === 'reviewer' || role === 'admin') options.push({ role, subjectId: account!.id });
  }

  return options;
}

export function sessionForOption(option: RoleOption): Session {
  return { subjectId: option.subjectId, role: option.role, linkedPatientId: option.linkedPatientId };
}

/**
 * Steps 1–4 of ROLES.md, against the mock store. Step 5 (the Hawiati countdown and cookie write)
 * lives in `lib/session/index.ts`, which is the only place a `Session` is actually persisted.
 */
export function resolveCivilId(civilId: string, store: StoreState, nowIso: string): SignInOutcome {
  // Steps 1–2: shape and test-list. A malformed value never matches one of the twelve test IDs,
  // so both checks collapse into one membership test (ROLES.md step 2 is the only rejection A1
  // makes, and it reveals nothing about accounts).
  if (!(ALL_TEST_CIVIL_IDS as readonly string[]).includes(civilId)) return { kind: 'not_in_test_list' };

  // Step 3: collect claims.
  const options = roleOptionsFor(store, civilId);
  const pending = pendingInvitationsFor(store, civilId, nowIso);

  // Step 4: decide.
  if (options.length === 0 && pending.length === 0) return { kind: 'no_claims' };
  if (options.length === 0) return { kind: 'pending_invitation_only', invitationId: pending[0]!.id };
  if (options.length === 1) return { kind: 'single_role', session: sessionForOption(options[0]!) };
  return { kind: 'multiple_roles', options };
}
