/**
 * A3 (ProfileScreen) — a real integration test against the mock store (via `setScriptSession`,
 * the same fallback `gate.test.ts` uses; `readSessionCookie` falls back to it once `cookies()`
 * throws outside a Next request context). Rule 6 / CLAUDE.md: no Civil ID printed back, masked or
 * whole — asserted here by scanning the rendered DOM for a twelve-digit run, not by trusting the
 * component not to add one back later.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setScriptSession } from '@/lib/session/cookie';
import { reset } from '@/lib/data/mock/store';
import { copy, t } from '@/i18n';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/app/more/profile',
  useSearchParams: () => new URLSearchParams(),
}));

const { ProfileScreen } = await import('@/features/identity/ProfileScreen');

beforeEach(() => reset());
afterEach(() => cleanup());

describe('A3 — profile / account (حمد, pt-01)', () => {
  it('never prints a Civil ID, masked or whole (rule 6 / CLAUDE.md)', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    render(await ProfileScreen({ locale: 'en' }));
    expect(document.body.innerHTML).not.toMatch(/\d{9,}/);
  });

  it('shows the name in full and the simulated-Hawiati identity line — never a Civil ID row', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    render(await ProfileScreen({ locale: 'en' }));
    expect(screen.getByText('حمد سالم المطيري')).toBeInTheDocument();
    expect(screen.getByText(t(copy.identity.identityLineValue, 'en'))).toBeInTheDocument();
  });

  it('counts only ACTIVE caregivers (عبدالله + سارة = 2), and links to the caregiver list', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    render(await ProfileScreen({ locale: 'en' }));
    const link = screen.getByRole('link', { name: /Caregivers/ });
    expect(link).toHaveAttribute('href', '/en/app/more/caregivers');
    expect(link).toHaveTextContent('2');
  });

  it('in Arabic the caregiver count uses Arabic-Indic digits — ٢ مربوط, never 2 مربوط (audit M7)', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    render(await ProfileScreen({ locale: 'ar' }));
    const link = screen.getByRole('link', { name: new RegExp(t(copy.identity.caregiverCountLabel, 'ar')) });
    expect(link).toHaveTextContent('٢ مربوط');
    expect(link.textContent).not.toMatch(/[0-9]/);
  });

  it('browser notifications and chat both read neutrally off for حمد (default/not_connected), each linking to E5', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    render(await ProfileScreen({ locale: 'en' }));
    const notifLink = screen.getByRole('link', { name: new RegExp(t(copy.identity.browserNotifLabel, 'en')) });
    expect(notifLink).toHaveAttribute('href', '/en/app/more/notifications');
    expect(notifLink).toHaveTextContent(t(copy.identity.pushOff, 'en'));
    const chatLink = screen.getByRole('link', { name: new RegExp(t(copy.identity.chatLabel, 'en')) });
    expect(chatLink).toHaveAttribute('href', '/en/app/more/notifications');
    expect(chatLink).toHaveTextContent(t(copy.identity.chatNotConnected, 'en'));
  });

  it('shows the language read-only (no control here — G2 keeps the switch in the app bar)', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    render(await ProfileScreen({ locale: 'en' }));
    const languageLabel = screen.getByText(t(copy.identity.languageLabel, 'en'));
    expect(languageLabel.parentElement).toHaveTextContent(t(copy.identity.languageAr, 'en'));
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('renders sign out, which exists nowhere else in this shell', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    render(await ProfileScreen({ locale: 'en' }));
    expect(screen.getByRole('button', { name: t(copy.shell.signOut, 'en') })).toBeInTheDocument();
  });
});

describe('A3 — no session / wrong role', () => {
  it('renders nothing for a caregiver session (the shell layout already enforces this; this is the defensive fallback)', async () => {
    setScriptSession({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
    const element = await ProfileScreen({ locale: 'en' });
    expect(element).toBeNull();
  });

  it('renders nothing for no session at all', async () => {
    setScriptSession(null);
    const element = await ProfileScreen({ locale: 'en' });
    expect(element).toBeNull();
  });
});
