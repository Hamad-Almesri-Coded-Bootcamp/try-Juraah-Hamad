/**
 * Named invariant — equal buttons (WP4h ACCEPTANCE; audit M2, 2026-09-23): F0's accept and decline
 * carry EQUAL weight — same size, same width, same prominence (UX Principles §2/§15, brand book).
 * The earlier build drew Accept primary and Decline secondary, following InviteConsent.dc.html; the
 * spec wins over the board, so both are now the same variant and the permitted difference is none.
 * A computed-size assertion in jsdom cannot read real pixel layout (no stylesheet is loaded under
 * vitest), so this asserts the structural contract that decides rendered size and weight: identical
 * tag, type and class set.
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
  it('both are the same variant, size=lg and fullWidth — identical class sets, no primary on either', () => {
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
    expect(acceptClasses.has('type-body-strong')).toBe(true);
    expect(declineClasses.has('type-body-strong')).toBe(true);

    // Same prominence: neither is the screen's lone primary; both are secondary.
    expect(acceptClasses.has('wsf-btn--primary')).toBe(false);
    expect(declineClasses.has('wsf-btn--primary')).toBe(false);
    expect(acceptClasses.has('wsf-btn--secondary')).toBe(true);
    expect(declineClasses.has('wsf-btn--secondary')).toBe(true);

    // No permitted difference at all: the class sets are identical.
    expect([...acceptClasses].sort()).toEqual([...declineClasses].sort());
  });
});
