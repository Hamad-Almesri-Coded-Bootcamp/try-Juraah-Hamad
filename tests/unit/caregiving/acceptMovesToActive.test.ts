/**
 * F0's accept action, end to end against the PUBLIC seam (`@/lib/data`'s exported `acceptInvitation`,
 * not just the internal mock helper WP1's own test already covers): a `pendingInvitationOnly`
 * session accepting ناصر's invitation (cg-03) moves it to `active`, writes the new caregiver
 * session (cookie), and — from that point on — `canReadPatient` grants access. Isolated against a
 * freshly `reset()` store, so it proves the transition without touching the shared dev-server
 * fixture the e2e suite's read-only tests depend on (tests/e2e/caregiving.spec.ts's own comment on
 * why it does not click-test this against cg-03).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acceptInvitation, getPrescriptions } from '@/lib/data';
import { getStore, reset } from '@/lib/data/mock/store';
import { canReadPatient } from '@/lib/data/mock/access';
import { setScriptSession } from '@/lib/session/cookie';

beforeEach(() => reset());
afterEach(() => setScriptSession(null));

describe('acceptInvitation (public seam) — ناصر, pending → active', () => {
  it('a pending-invitation-only session accepting cg-03 returns a caregiver session and flips the row to active', async () => {
    setScriptSession({ subjectId: 'cg-03', pendingInvitationOnly: true });
    const session = await acceptInvitation('cg-03');

    expect(session.role).toBe('caregiver');
    expect(session.subjectId).toBe('cg-03');
    expect(session.linkedPatientId).toBe('pt-01');

    const store = getStore();
    expect(store.caregivers.find((c) => c.id === 'cg-03')?.status).toBe('active');
    expect(canReadPatient(store, session, 'pt-01')).toBe(true);
  });

  it('after accepting, the new session can read حمد’s prescriptions through the public data function', async () => {
    setScriptSession({ subjectId: 'cg-03', pendingInvitationOnly: true });
    await acceptInvitation('cg-03');
    // acceptInvitation writes the new session itself (readSessionCookie now returns it).
    const prescriptions = await getPrescriptions('pt-01');
    expect(prescriptions.length).toBeGreaterThan(0);
  });

  it('a session for a DIFFERENT Civil ID cannot accept ناصر’s invitation on his behalf', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' }); // حمد himself — not ناصر
    const session = await acceptInvitation('cg-03');
    expect(session.role).not.toBe('caregiver');
    expect(getStore().caregivers.find((c) => c.id === 'cg-03')?.status).toBe('pending');
  });
});
