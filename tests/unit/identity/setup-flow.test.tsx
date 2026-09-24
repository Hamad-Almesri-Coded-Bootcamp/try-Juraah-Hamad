/**
 * A2 (SetupFlow) — four steps, `?step=` in the URL (D-008: useSearchParams under Suspense; the
 * brief's allowed "session-neutral state" for resuming an abandoned flow). `@/lib/data` mocked, per
 * this repo's convention of never calling the `'use server'` wrapper directly from a unit test.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copy, t } from '@/i18n';

const { pushMock, searchRef } = vi.hoisted(() => ({ pushMock: vi.fn(), searchRef: { value: '' } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(searchRef.value),
  usePathname: () => '/en/app/setup',
}));

const updateSettingsMock = vi.fn().mockResolvedValue(undefined);
const completeOnboardingMock = vi.fn().mockResolvedValue(undefined);
const requestPushPermissionMock = vi.fn().mockResolvedValue(undefined);
const startMessagingLinkMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/data', () => ({
  updateSettings: (...args: unknown[]) => updateSettingsMock(...args),
  completeOnboarding: (...args: unknown[]) => completeOnboardingMock(...args),
  requestPushPermission: (...args: unknown[]) => requestPushPermissionMock(...args),
  startMessagingLink: (...args: unknown[]) => startMessagingLinkMock(...args),
}));

const { SetupFlow } = await import('@/features/identity/SetupFlow');

beforeEach(() => {
  pushMock.mockClear();
  updateSettingsMock.mockClear();
  completeOnboardingMock.mockClear();
  requestPushPermissionMock.mockClear();
  startMessagingLinkMock.mockClear();
  searchRef.value = '';
});
afterEach(() => cleanup());

describe('A2 step 1 — language (required)', () => {
  it('persists the choice via updateSettings and advances to ?step=1', async () => {
    render(<SetupFlow locale="en" patientId="pt-04" initialLanguage="ar" />);
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.continueLabel, 'en') }));
    await vi.waitFor(() => expect(updateSettingsMock).toHaveBeenCalledWith('pt-04', { language: 'ar' }));
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledWith('/en/app/setup?step=1'));
  });
});

describe('A2 step 2 — notification offer (three equal options)', () => {
  beforeEach(() => {
    searchRef.value = 'step=1';
  });

  it('shows all three options, and "later" is an ordinary choice — not an error, not a warning', () => {
    render(<SetupFlow locale="en" patientId="pt-04" initialLanguage="ar" />);
    expect(screen.getByRole('button', { name: t(copy.identity.browserOfferButton, 'en') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t(copy.identity.telegramOfferButton, 'en') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t(copy.identity.laterOfferButton, 'en') })).toBeInTheDocument();
  });

  it('the three offers are three EQUAL buttons — same variant, same size, same width, none primary (UX §2/§13, audit M2)', () => {
    render(<SetupFlow locale="en" patientId="pt-04" initialLanguage="ar" />);
    const offers = [copy.identity.browserOfferButton, copy.identity.telegramOfferButton, copy.identity.laterOfferButton].map((entry) =>
      screen.getByRole('button', { name: t(entry, 'en') }),
    );
    const classSets = offers.map((button) => [...new Set(button.className.split(/\s+/))].sort());
    for (const classes of classSets) {
      expect(classes).toContain('wsf-btn--secondary');
      expect(classes).toContain('wsf-btn--lg');
      expect(classes).toContain('wsf-btn--block');
      expect(classes).not.toContain('wsf-btn--primary');
    }
    expect(classSets[1]).toEqual(classSets[0]);
    expect(classSets[2]).toEqual(classSets[0]);
  });

  it('"later" advances without calling any notification function', async () => {
    render(<SetupFlow locale="en" patientId="pt-04" initialLanguage="ar" />);
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.laterOfferButton, 'en') }));
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledWith('/en/app/setup?step=2'));
    expect(requestPushPermissionMock).not.toHaveBeenCalled();
    expect(startMessagingLinkMock).not.toHaveBeenCalled();
  });

  it('the browser offer calls requestPushPermission for this patient, then advances', async () => {
    render(<SetupFlow locale="en" patientId="pt-04" initialLanguage="ar" />);
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.browserOfferButton, 'en') }));
    await vi.waitFor(() => expect(requestPushPermissionMock).toHaveBeenCalledWith({ subjectType: 'patient', subjectId: 'pt-04' }));
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledWith('/en/app/setup?step=2'));
  });
});

describe('A2 step 3 — optional caregiver invite (cross-bundle contract)', () => {
  beforeEach(() => {
    searchRef.value = 'step=2';
  });

  it('offers the shared InviteSheet (wired by the lead at the wave-1 gate) and skipping advances', async () => {
    render(<SetupFlow locale="en" patientId="pt-04" initialLanguage="ar" />);
    expect(screen.getByRole('button', { name: t(copy.identity.inviteOpenLabel, 'en') })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.skipInviteLabel, 'en') }));
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledWith('/en/app/setup?step=3'));
  });

  it('opening the invite step mounts bundle h’s sheet and closing it stays on the step', async () => {
    render(<SetupFlow locale="en" patientId="pt-04" initialLanguage="ar" />);
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.inviteOpenLabel, 'en') }));
    expect(await screen.findByText(t(copy.caregiving.f1CivilIdLabel, 'en'))).toBeInTheDocument();
  });
});

describe('A2 step 4 — closing explainer', () => {
  beforeEach(() => {
    searchRef.value = 'step=3';
  });

  it('finishing calls completeOnboarding then lands on /app', async () => {
    render(<SetupFlow locale="en" patientId="pt-04" initialLanguage="ar" />);
    fireEvent.click(screen.getByRole('button', { name: t(copy.identity.finishSetupLabel, 'en') }));
    await vi.waitFor(() => expect(completeOnboardingMock).toHaveBeenCalledWith('pt-04'));
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledWith('/en/app'));
  });
});

describe('Daylight (CR-071): one h1 per step, and the invite step draws its two answers equal', () => {
  const titles = [copy.identity.languageStepTitle, copy.identity.notificationsStepTitle, copy.identity.inviteStepTitle, copy.identity.closingStepTitle];
  for (const [step, title] of titles.entries()) {
    it(`step ${step} has exactly one h1, its question (no app-bar title beside it)`, () => {
      searchRef.value = `step=${step}`;
      render(<SetupFlow locale="en" patientId="pt-04" initialLanguage="ar" />);
      expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([t(title, 'en')]);
    });
  }

  it('inviting and "not now" are the same button (UX §2: every "later" is an equal choice)', () => {
    searchRef.value = 'step=2';
    render(<SetupFlow locale="en" patientId="pt-04" initialLanguage="ar" />);
    const invite = screen.getByRole('button', { name: t(copy.identity.inviteOpenLabel, 'en') });
    const skip = screen.getByRole('button', { name: t(copy.identity.skipInviteLabel, 'en') });
    expect([...invite.classList].sort()).toEqual([...skip.classList].sort());
    expect(invite).not.toHaveClass('wsf-btn--primary');
  });
});

describe('abandoning returns to the same step', () => {
  it('a ?step=2 URL renders the invite step directly, not step 1', () => {
    searchRef.value = 'step=2';
    render(<SetupFlow locale="en" patientId="pt-04" initialLanguage="ar" />);
    expect(screen.getByText(t(copy.identity.inviteStepTitle, 'en'))).toBeInTheDocument();
    expect(screen.queryByText(t(copy.identity.notificationsStepTitle, 'en'))).not.toBeInTheDocument();
  });

  it('an out-of-range step value is clamped back to step 0, never a crash', () => {
    searchRef.value = 'step=99';
    render(<SetupFlow locale="en" patientId="pt-04" initialLanguage="ar" />);
    expect(screen.getByText(t(copy.identity.languageStepTitle, 'en'))).toBeInTheDocument();
  });
});
