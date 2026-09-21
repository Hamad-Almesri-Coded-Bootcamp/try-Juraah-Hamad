/**
 * Named invariant — decline grants nothing (WP4h ACCEPTANCE): a `declined` (and, for completeness,
 * `pending`/`expired`/`revoked`) `Caregiver` record grants zero read access, enforced at the access
 * layer itself — the ONE place access is decided (`lib/data/mock/access.ts`, not touched by this
 * bundle) — so that even a forged session claiming the caregiver role for that id is refused. The
 * e2e companion (`tests/e2e/caregiving.spec.ts`) proves the same thing at the HTTP/route level.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { REFERENCE_NOW } from '@/lib/config';
import { getStore, reset } from '@/lib/data/mock/store';
import { canReadPatient } from '@/lib/data/mock/access';
import { acceptInvitation, caregiverById, declineInvitation } from '@/lib/data/mock/caregivers';
import type { Session } from '@/types/views';

beforeEach(() => reset());

function forgedCaregiverSession(caregiverId: string): Session {
  return { subjectId: caregiverId, role: 'caregiver', linkedPatientId: 'pt-01' };
}

describe('a declined invitation grants zero read access, ever', () => {
  it('declining ناصر (cg-03, pending → declined) refuses read access even to a forged caregiver session', () => {
    const store = getStore();
    const declined = declineInvitation(store, 'cg-03', REFERENCE_NOW);
    expect(declined?.status).toBe('declined');

    expect(canReadPatient(store, forgedCaregiverSession('cg-03'), 'pt-01')).toBe(false);
  });

  it('cannot be re-accepted afterwards — a later acceptInvitation call is refused', () => {
    const store = getStore();
    declineInvitation(store, 'cg-03', REFERENCE_NOW);
    expect(acceptInvitation(store, 'cg-03', REFERENCE_NOW)).toBeNull();
    expect(caregiverById(store, 'cg-03')!.status).toBe('declined');
  });
});

describe('every non-active Caregiver status grants zero read access (CLAUDE.md rule 5)', () => {
  it.each([
    ['pending (never answered)', 'cg-03'],
    ['declined (منى)', 'cg-04'],
    ['expired (no-account Civil ID)', 'cg-05'],
    ['revoked after acceptance (طلال)', 'cg-06'],
    ['revoked before any answer (دلال)', 'cg-07'],
  ])('%s — canReadPatient is false even for a forged caregiver session', (_label, caregiverId) => {
    const store = getStore();
    expect(canReadPatient(store, forgedCaregiverSession(caregiverId), 'pt-01')).toBe(false);
  });

  it('only cg-01/cg-02 (active) grant access on حمد — the control case', () => {
    const store = getStore();
    expect(canReadPatient(store, forgedCaregiverSession('cg-01'), 'pt-01')).toBe(true);
  });
});
