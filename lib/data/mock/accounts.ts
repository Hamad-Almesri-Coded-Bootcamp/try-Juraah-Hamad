/**
 * Account / role-derivation helpers (docs/Seed Dataset.md, seed rule 2; ROLES.md → "How a Civil ID
 * resolves", step 3). `Account.roles` is written out in the seed for readability but is DERIVED —
 * `deriveRoles` recomputes it, and `scripts/guards/seed-invariants.ts` asserts the recomputation
 * matches the transcribed table.
 */
import { maskName } from '@/lib/format/maskedName';
import type { Role, Session } from '@/types/views';
import type { StoreState } from './types';

export function findAccountByCivilId(store: StoreState, civilId: string) {
  return store.accounts.find((a) => a.civilId === civilId) ?? null;
}

export function findAccountById(store: StoreState, id: string) {
  return store.accounts.find((a) => a.id === id) ?? null;
}

/** patient iff a Patient row exists · caregiver iff ≥1 active Caregiver row · reviewer/admin assigned. */
export function deriveRoles(store: StoreState, civilId: string): Role[] {
  const roles: Role[] = [];
  if (store.patients.some((p) => p.civilId === civilId)) roles.push('patient');
  if (store.caregivers.some((c) => c.civilId === civilId && c.status === 'active')) roles.push('caregiver');
  const account = findAccountByCivilId(store, civilId);
  for (const r of account?.roles ?? []) {
    if ((r === 'reviewer' || r === 'admin') && !roles.includes(r)) roles.push(r);
  }
  return roles;
}

/**
 * `lookupMaskedName` (F1, G9): same shape, same code path length, same simulated delay whether or
 * not the Civil ID has an account (G9 — the app never confirms or denies whether one exists).
 */
export function maskedNameFor(store: StoreState, civilId: string): { maskedName: string | null } {
  const account = findAccountByCivilId(store, civilId);
  return { maskedName: account ? maskName(account.name) : null };
}

/**
 * The Civil ID behind a granted role's `subjectId` — server-side only, never returned to a caller.
 * Shared by `lib/session` (role options) and `lib/data` (finding a patient's own pending
 * invitations, F0 "sees the notice without signing out").
 */
export function civilIdForSession(store: StoreState, session: Session | null): string | null {
  if (!session || !session.role) return null;
  if (session.role === 'patient') return store.patients.find((p) => p.id === session.subjectId)?.civilId ?? null;
  if (session.role === 'caregiver') return store.caregivers.find((c) => c.id === session.subjectId)?.civilId ?? null;
  return findAccountById(store, session.subjectId)?.civilId ?? null;
}
