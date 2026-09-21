/**
 * Named invariant — equal buttons (WP4h ACCEPTANCE): F0's accept/decline are the same size and
 * weight, the only permitted difference being primary vs secondary tone (CLAUDE.md rule 5; UX
 * Principles §2/§15). A computed-size assertion in jsdom cannot read real pixel layout (no
 * stylesheet is loaded under vitest), so this asserts the structural contract that actually decides
 * rendered size: identical `size`/`fullWidth` classes, identical tag and type, and the ONE permitted
 * class difference (variant).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InviteConsent } from '@/features/caregiving/InviteConsent';
import type { InvitationSummary } from '@/types/views';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

const pendingInvitation: InvitationSummary = {
  id: 'cg-03',
  patientFirstName: 'حمد',
  relationship: 'ابني',
  status: 'pending',
  expiresAt: '2026-10-02T00:00:00+03:00',
};

describe('F0 — accept and decline are the same size and weight', () => {
  it('both are size=lg fullWidth buttons, differing only in primary/secondary variant', () => {
    render(<InviteConsent invitation={pendingInvitation} locale="ar" homeHref="/ar" />);
    const accept = screen.getByTestId('f0-accept');
    const decline = screen.getByTestId('f0-decline');

    expect(accept.tagName).toBe(decline.tagName);
    expect(accept.getAttribute('type')).toBe(decline.getAttribute('type'));

    const acceptClasses = new Set(accept.className.split(/\s+/));
    const declineClasses = new Set(decline.className.split(/\s+/));

    // Same size (lg) and full-width classes on both.
    expect(acceptClasses.has('wsf-btn--lg')).toBe(true);
    expect(declineClasses.has('wsf-btn--lg')).toBe(true);
    expect(acceptClasses.has('wsf-btn--block')).toBe(true);
    expect(declineClasses.has('wsf-btn--block')).toBe(true);
    // Same type-scale class (Button.tsx sets type-body-strong at size=lg for both).
    expect(acceptClasses.has('type-body-strong')).toBe(true);
    expect(declineClasses.has('type-body-strong')).toBe(true);

    // The only permitted difference: primary vs secondary tone.
    expect(acceptClasses.has('wsf-btn--primary')).toBe(true);
    expect(declineClasses.has('wsf-btn--secondary')).toBe(true);
    expect(acceptClasses.has('wsf-btn--secondary')).toBe(false);
    expect(declineClasses.has('wsf-btn--primary')).toBe(false);

    // Removing the one permitted difference leaves the class sets identical.
    const acceptWithoutVariant = [...acceptClasses].filter((c) => c !== 'wsf-btn--primary').sort();
    const declineWithoutVariant = [...declineClasses].filter((c) => c !== 'wsf-btn--secondary').sort();
    expect(acceptWithoutVariant).toEqual(declineWithoutVariant);
  });
});
