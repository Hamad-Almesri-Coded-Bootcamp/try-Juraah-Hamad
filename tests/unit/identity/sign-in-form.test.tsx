/**
 * A1 (SignInForm) — renders `@/lib/session`'s `signIn` mocked (never the real `'use server'`
 * wrapper in a unit test, matching the rest of this repo's convention — see
 * tests/unit/data/mock-store.test.ts's own comment). The `no_claims` wording test is the one the
 * brief calls out explicitly: rule 6 / G9 requires the SAME message for a no-role account and a
 * Civil ID with no account at all — this asserts the rendered DOM is byte-identical, not just that
 * the classification is (that half is `resolve.test.ts`'s job).
 */
import { act } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import { HAWIATI_COUNTDOWN_SECONDS } from '@/lib/config';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const signInMock = vi.fn();
vi.mock('@/lib/session', () => ({ signIn: (civilId: string) => signInMock(civilId) }));

// `wait` is real by default (a genuine setTimeout, which fake timers still control) — the lapsed
// test below overrides it, once, to hang forever on its first call, to force the real fallback path
// (the countdown's own onLapse) rather than racing real/virtual time against a fixed short delay.
const waitMock = vi.fn((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
vi.mock('@/features/identity/wait', () => ({ wait: (ms: number) => waitMock(ms) }));

const { SignInForm } = await import('@/features/identity/SignInForm');

beforeEach(() => {
  pushMock.mockClear();
  signInMock.mockReset();
  waitMock.mockReset();
  waitMock.mockImplementation((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  vi.useRealTimers();
});
afterEach(() => cleanup());

function typeCivilId(value: string) {
  const input = screen.getByLabelText(t(copy.identity.civilIdLabel, 'en'));
  fireEvent.change(input, { target: { value } });
  return input;
}

describe('validation on submit — Continue is never disabled-until-valid (audit M14, UX Principles §5/§6)', () => {
  function formOf(element: HTMLElement): HTMLFormElement {
    const form = element.closest('form');
    if (!form) throw new Error('the Civil ID field is not inside a <form>, so Enter cannot submit it');
    return form;
  }

  it('Continue is enabled on an empty field, and is the submit button of a real <form>', () => {
    render(<SignInForm locale="en" />);
    const button = screen.getByRole('button', { name: t(copy.identity.continueLabel, 'en') });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('type', 'submit');
    expect(formOf(screen.getByLabelText(t(copy.identity.civilIdLabel, 'en')))).toBe(button.closest('form'));
  });

  it('submitting an empty field says what to do — and never calls signIn', async () => {
    render(<SignInForm locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.continueLabel, 'en') }));
    expect(await screen.findByText('Enter your Civil ID')).toBeInTheDocument();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('"123" + Enter says a Civil ID has 12 digits, keeps what was typed, and never calls signIn', async () => {
    render(<SignInForm locale="en" />);
    const input = typeCivilId('123');
    fireEvent.submit(formOf(input)); // what pressing Enter in the field does: implicit form submission
    expect(await screen.findByText('A Civil ID has 12 digits')).toBeInTheDocument();
    expect(input).toHaveValue('123');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(signInMock).not.toHaveBeenCalled();
    // "correct one digit and continue" belongs to the not-in-the-demo-list error only.
    expect(screen.queryByText(t(copy.identity.invalidIdHint, 'en'))).not.toBeInTheDocument();
  });

  it('ar: the same two messages in Arabic', async () => {
    render(<SignInForm locale="ar" />);
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.continueLabel, 'ar') }));
    expect(await screen.findByText(t(copy.identity.civilIdRequiredError, 'ar'))).toBeInTheDocument();
    const input = screen.getByLabelText(t(copy.identity.civilIdLabel, 'ar'));
    fireEvent.change(input, { target: { value: '12345' } });
    fireEvent.submit(formOf(input));
    expect(await screen.findByText(t(copy.identity.civilIdLengthError, 'ar'))).toBeInTheDocument();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('Enter on a twelve-digit ID runs the normal sign-in flow', async () => {
    signInMock.mockResolvedValue({ kind: 'not_in_test_list' });
    render(<SignInForm locale="en" />);
    const input = typeCivilId('111111111111');
    fireEvent.submit(formOf(input));
    expect(await screen.findByText(t(copy.identity.invalidIdError, 'en'))).toBeInTheDocument();
    expect(signInMock).toHaveBeenCalledWith('111111111111');
    expect(screen.getByText(t(copy.identity.invalidIdHint, 'en'))).toBeInTheDocument();
  });

  it('Arabic-Indic digits from an Arabic keyboard count as digits: normalised for signIn, the field left exactly as typed', async () => {
    signInMock.mockResolvedValue({ kind: 'not_in_test_list' });
    render(<SignInForm locale="ar" />);
    const input = screen.getByLabelText(t(copy.identity.civilIdLabel, 'ar'));
    fireEvent.change(input, { target: { value: '٢٥٥٠٣١٢٠٠١٨٧' } });
    fireEvent.submit(formOf(input));
    await vi.waitFor(() => expect(signInMock).toHaveBeenCalledWith('255031200187'));
    expect(input).toHaveValue('٢٥٥٠٣١٢٠٠١٨٧');
    expect(screen.queryByText(t(copy.identity.civilIdLengthError, 'ar'))).not.toBeInTheDocument();
  });
});

describe('the countdown is not a card inside a card (audit m1)', () => {
  it('the running countdown draws its own frame only (the navy sky) — no outer Card around it', async () => {
    signInMock.mockResolvedValue({ kind: 'single_role', session: { subjectId: 'pt-01', role: 'patient' } });
    waitMock.mockImplementation(() => new Promise<void>(() => {})); // hold the countdown on screen; no stray navigation later
    render(<SignInForm locale="en" />);
    typeCivilId('255031200187');
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.continueLabel, 'en') }));
    const bar = await screen.findByRole('progressbar');
    // CR-071: the wait is the Daylight sky (ApprovalWait, V2SignInWait), no longer the Countdown card.
    expect(bar.closest('[data-testid="approval-wait"]')).not.toBeNull();
    expect(bar.closest('.wsf-card')).toBeNull();
    // A way out is always there while it counts (navigation.md).
    expect(screen.getByRole('button', { name: t(copy.identity.cancelLabel, 'en') })).toBeInTheDocument();
  });
});

describe('one h1 per state (CR-071: the old app bar added a second)', () => {
  it('the form has exactly one h1, the screen title, and the wordmark is not a heading', () => {
    render(<SignInForm locale="en" />);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([t(screenTitles.A1, 'en')]);
  });

  it('the wait has exactly one h1, the instruction', async () => {
    signInMock.mockResolvedValue({ kind: 'single_role', session: { subjectId: 'pt-01', role: 'patient' } });
    waitMock.mockImplementation(() => new Promise<void>(() => {}));
    render(<SignInForm locale="en" />);
    typeCivilId('255031200187');
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.continueLabel, 'en') }));
    await screen.findByRole('progressbar');
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([t(copy.identity.countdownLabel, 'en')]);
  });
});

describe('invalid Civil ID (not_in_test_list)', () => {
  it('shows the specific error and keeps the typed value', async () => {
    signInMock.mockResolvedValue({ kind: 'not_in_test_list' });
    render(<SignInForm locale="en" />);
    const input = typeCivilId('111111111111');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: t(copy.identity.continueLabel, 'en') }));
      await Promise.resolve();
    });
    expect(await screen.findByText(t(copy.identity.invalidIdError, 'en'))).toBeInTheDocument();
    expect(input).toHaveValue('111111111111');
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe('no_claims — byte-identical wording whether or not the Civil ID has an account (rule 6 / G9)', () => {
  it('a no-role account and a no-account Civil ID render the exact same message', async () => {
    signInMock.mockResolvedValue({ kind: 'no_claims' });

    const first = render(<SignInForm locale="en" />);
    fireEvent.change(within(first.container).getByLabelText(t(copy.identity.civilIdLabel, 'en')), { target: { value: '292043000517' } }); // منى — an account, no role
    fireEvent.click(within(first.container).getByRole('button', { name: t(copy.identity.continueLabel, 'en') }));
    await within(first.container).findByText(t(copy.identity.noClaimsTitle, 'en'), {}, { timeout: 5000 });
    const firstHtml = first.container.innerHTML;
    first.unmount();

    const second = render(<SignInForm locale="en" />);
    fireEvent.change(within(second.container).getByLabelText(t(copy.identity.civilIdLabel, 'en')), { target: { value: '277091900873' } }); // no account at all
    fireEvent.click(within(second.container).getByRole('button', { name: t(copy.identity.continueLabel, 'en') }));
    await within(second.container).findByText(t(copy.identity.noClaimsTitle, 'en'), {}, { timeout: 5000 });
    const secondHtml = second.container.innerHTML;
    second.unmount();

    expect(firstHtml).toBe(secondHtml);
    expect(signInMock).toHaveBeenCalledWith('292043000517');
    expect(signInMock).toHaveBeenCalledWith('277091900873');
  }, 10000);
});

describe('valid IDs — the countdown, then the right destination', () => {
  it('shows the running countdown, then routes a single_role outcome through /gate', async () => {
    signInMock.mockResolvedValue({ kind: 'single_role', session: { subjectId: 'pt-01', role: 'patient' } });
    render(<SignInForm locale="en" />);
    typeCivilId('255031200187');
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.continueLabel, 'en') }));

    await screen.findByRole('progressbar');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', String(HAWIATI_COUNTDOWN_SECONDS));

    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledWith('/en/gate'), { timeout: 5000, interval: 50 });
  }, 10000);

  it('routes a multiple_roles outcome to /signin/choose', async () => {
    signInMock.mockResolvedValue({ kind: 'multiple_roles', options: [{ role: 'patient', subjectId: 'pt-03' }, { role: 'caregiver', subjectId: 'cg-02', linkedPatientId: 'pt-01' }] });
    render(<SignInForm locale="en" />);
    typeCivilId('290022500654');
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.continueLabel, 'en') }));
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledWith('/en/signin/choose'), { timeout: 5000, interval: 50 });
  }, 10000);

  it('routes a pending_invitation_only outcome to /invitation — never any shell', async () => {
    signInMock.mockResolvedValue({ kind: 'pending_invitation_only', invitationId: 'cg-03' });
    render(<SignInForm locale="en" />);
    typeCivilId('288110300229');
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.continueLabel, 'en') }));
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledWith('/en/invitation'), { timeout: 5000, interval: 50 });
    expect(pushMock).not.toHaveBeenCalledWith(expect.stringContaining('/app'));
    expect(pushMock).not.toHaveBeenCalledWith(expect.stringContaining('/care'));
  }, 10000);
});

describe('lapsed — retryable, and never left with no way out', () => {
  it('a hung approval reaches lapsed via the real countdown timeout, and retry re-attempts', async () => {
    vi.useFakeTimers();
    signInMock.mockResolvedValue({ kind: 'single_role', session: { subjectId: 'pt-01', role: 'patient' } });
    // Hang forever on the FIRST wait() call only (the post-approval delay) — the second call, made
    // by retry, behaves normally. This forces the countdown's own real onLapse to be what actually
    // fires, rather than the component's short internal delay winning the race every time.
    let first = true;
    waitMock.mockImplementation((ms: number) => {
      if (first) {
        first = false;
        return new Promise<void>(() => {});
      }
      return new Promise<void>((resolve) => setTimeout(resolve, ms));
    });

    render(<SignInForm locale="en" />);
    typeCivilId('255031200187');
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.continueLabel, 'en') }));

    // Let the classification microtask resolve and the countdown mount.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Advance the full Hawiati window: the countdown's own onLapse fires at HAWIATI_COUNTDOWN_SECONDS,
    // since the hung wait() above never lets the component's own approval logic get there first.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HAWIATI_COUNTDOWN_SECONDS * 1000);
    });
    expect(screen.getByText(t(copy.vocabulary.countdownLapsed, 'en'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t(copy.vocabulary.retry, 'en') })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: t(copy.vocabulary.retry, 'en') }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });
    expect(pushMock).toHaveBeenCalledWith('/en/gate');
    expect(signInMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  }, 20000);
});
