/**
 * B1's two empty states (audit M12; UX Principles §1 "no dead ends", §7 "empty states teach … and
 * offer the one action that applies"; SCREENS.md: B4 is "push from B2 / B1 empty state").
 *
 *  - بدر (pt-04), no prescription at all: the empty state offers the one action that fills it — add a
 *    prescription by photo (B4), the same wording B2's own empty state uses.
 *  - فاطمة (pt-02), an alternate-day medicine that skips 21 Sept: informational only — the day
 *    navigation is the action, so no add button appears.
 *
 * Either way the `dose-list` root still carries no control at all (G1's runtime proof reads it).
 * The page file is rendered for real against the script session, as tests/unit/caregiving's
 * careAppBars test does for the caregiver pages.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

const pushMock = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  usePathname: () => '/en/app',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), replace: vi.fn() }),
  notFound: () => {
    throw new Error('notFound()');
  },
  redirect: (to: string) => {
    throw new Error(`redirect(${to})`);
  },
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { default: TodayPage } = await import('@/app/[locale]/app/page');

beforeEach(() => {
  reset();
  pushMock.mockClear();
});
afterEach(() => {
  cleanup();
  setScriptSession(null);
});

async function renderToday(patientId: string) {
  setScriptSession({ subjectId: patientId, role: 'patient' });
  return render(await TodayPage({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({}) }));
}

describe('B1 — no active prescription yet (بدر)', () => {
  it('offers the one action that fills the screen: add a prescription by photo → B4', async () => {
    await renderToday('pt-04');
    expect(screen.getByText('No active prescriptions yet')).toBeInTheDocument();
    const add = screen.getByRole('button', { name: 'Add a prescription by photo' });
    fireEvent.click(add);
    expect(pushMock).toHaveBeenCalledWith('/en/app/medicines/add');
  });

  it('the dose-list root still carries no control (G1)', async () => {
    await renderToday('pt-04');
    const list = screen.getByTestId('dose-list');
    expect(list.querySelectorAll('button, input, a, [role="button"]').length).toBe(0);
  });
});

describe('B1 — a day with no dose (فاطمة, alternate-day)', () => {
  it('stays informational: no add action — the day navigation is the way on', async () => {
    await renderToday('pt-02');
    expect(screen.getByText('No doses scheduled for this day')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a prescription by photo' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next day' })).toBeInTheDocument();
  });
});
