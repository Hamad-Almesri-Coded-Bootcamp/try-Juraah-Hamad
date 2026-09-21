/**
 * `resolveLandingCta` (WHAT TO BUILD: "Signed-in state" — the primary action reads its
 * continue-variant copy and links into the right shell home; no session → the sign-in route).
 * A pure function of `Session | null`, so no cookie, no request context and no data-access import
 * is needed to exercise every branch.
 */
import { describe, expect, it } from 'vitest';
import { resolveLandingCta } from '@/features/landing/cta';

describe('resolveLandingCta', () => {
  it('no session → the sign-in route, not signed in', () => {
    expect(resolveLandingCta(null, 'ar')).toEqual({ href: '/ar/signin', signedIn: false });
  });

  it('a pending-invitation-only session → /invitation, signed in (F0, never a shell home)', () => {
    expect(resolveLandingCta({ subjectId: 'cg-03', pendingInvitationOnly: true }, 'ar')).toEqual({
      href: '/ar/invitation',
      signedIn: true,
    });
  });

  it('a patient session → /app', () => {
    expect(resolveLandingCta({ subjectId: 'pt-01', role: 'patient' }, 'en')).toEqual({
      href: '/en/app',
      signedIn: true,
    });
  });

  it('a caregiver session → /care', () => {
    expect(resolveLandingCta({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' }, 'ar')).toEqual({
      href: '/ar/care',
      signedIn: true,
    });
  });

  it('a reviewer session → /clinic/review', () => {
    expect(resolveLandingCta({ subjectId: 'acc-10', role: 'reviewer' }, 'en')).toEqual({
      href: '/en/clinic/review',
      signedIn: true,
    });
  });

  it('an admin session → /clinic/audit', () => {
    expect(resolveLandingCta({ subjectId: 'acc-11', role: 'admin' }, 'ar')).toEqual({
      href: '/ar/clinic/audit',
      signedIn: true,
    });
  });
});
