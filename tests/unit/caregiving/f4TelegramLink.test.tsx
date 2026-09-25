/**
 * AP-09 (CR-086, CR-087): F4's own chat row. "Connect Telegram" is the shared link form (a POST to
 * the route, which mints the caregiver's own link only while the invitation is active); the pending
 * row polls and offers "I pressed Start" and "Open Telegram again"; the token never reaches the page.
 * The mock's parity with the database trigger link_caregiver_must_be_active is proven here too.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copy, t } from '@/i18n';
import { CaregiverProfile } from '@/features/caregiving/CaregiverProfile';
import { LINK_POLL_MS } from '@/features/ambient/TelegramLinkForm';
import { TELEGRAM_OPEN_PATH } from '@/lib/messaging/link';
import { startMessagingLink } from '@/lib/data';
import { getStore, reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

const base = {
  caregiverId: 'cg-02',
  patientFirstName: 'حمد',
  acceptedAt: '2026-08-21T10:00:00+03:00',
  pushCapabilitySupported: true,
  push: null,
  locale: 'ar' as const,
};
const link = (status: 'not_connected' | 'pending' | 'connected' | 'expired') =>
  ({ id: 'ml-x', subjectType: 'caregiver' as const, subjectId: 'cg-02', channel: 'telegram' as const, status });

beforeEach(() => {
  reset();
  refresh.mockClear();
});
afterEach(() => {
  cleanup();
  setScriptSession(null);
  vi.useRealTimers();
});

describe('F4 chat row: the link form', () => {
  it('not connected and expired: "Connect Telegram" is a POST of locale and screen to the link route, a new tab for a real bot', () => {
    for (const status of ['not_connected', 'expired'] as const) {
      const { unmount } = render(<CaregiverProfile {...base} messaging={link(status)} simulated={false} />);
      const button = screen.getByRole('button', { name: t(copy.caregiving.f4ChatConnectAction, 'ar') });
      const form = button.closest('form')!;
      expect(button).toHaveAttribute('type', 'submit');
      expect(form.getAttribute('method')).toBe('post');
      expect(form.getAttribute('action')).toBe(TELEGRAM_OPEN_PATH);
      expect(form.getAttribute('target')).toBe('_blank');
      expect(Object.fromEntries(new FormData(form))).toEqual({ locale: 'ar', from: 'profile' });
      unmount();
    }
  });

  it('pending: the row polls, "I pressed Start" checks now and says so when still waiting, "Open Telegram again" is the same form', () => {
    vi.useFakeTimers();
    render(<CaregiverProfile {...base} messaging={link('pending')} simulated={false} />);
    act(() => void vi.advanceTimersByTime(LINK_POLL_MS));
    expect(refresh).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: t(copy.ambient.e5ChatCheckAction, 'ar') }));
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('chat-still-waiting')).toHaveTextContent(t(copy.ambient.e5ChatStillWaiting, 'ar'));
    const again = screen.getByRole('button', { name: t(copy.ambient.e5ChatOpenAgainAction, 'ar') }).closest('form')!;
    expect(Object.fromEntries(new FormData(again))).toEqual({ locale: 'ar', from: 'profile' });
  });

  it('connected: nothing polls (the page is only re-read while a link waits)', () => {
    vi.useFakeTimers();
    render(<CaregiverProfile {...base} messaging={{ ...link('connected'), connectedAt: '2026-09-03T18:25:00+03:00' }} simulated={false} />);
    act(() => void vi.advanceTimersByTime(LINK_POLL_MS * 3));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('a push toggle never spins the chat row (one busy state per row)', () => {
    render(<CaregiverProfile {...base} messaging={link('not_connected')} simulated />);
    fireEvent.click(screen.getByRole('button', { name: t(copy.caregiving.f4PushEnableAction, 'ar') }));
    expect(screen.getByRole('button', { name: t(copy.caregiving.f4ChatConnectAction, 'ar') })).not.toHaveAttribute('aria-busy');
  });
});

describe('Messaging link path: a caregiver\'s link only while the invitation is active (mock parity with the database)', () => {
  it('an ACTIVE caregiver (سارة, cg-02) gets a pending link; a REVOKED one (طلال, cg-06) is refused and nothing is stored', async () => {
    setScriptSession({ subjectId: 'cg-02', role: 'caregiver', linkedPatientId: 'pt-01' });
    const active = await startMessagingLink({ subjectType: 'caregiver', subjectId: 'cg-02' });
    expect(active.status).toBe('pending');

    setScriptSession({ subjectId: 'cg-06', role: 'caregiver', linkedPatientId: 'pt-01' });
    const before = getStore().messagingLinks.length;
    const revoked = await startMessagingLink({ subjectType: 'caregiver', subjectId: 'cg-06' });
    expect(revoked).toEqual({ id: 'ml-default', subjectType: 'caregiver', subjectId: 'cg-06', channel: 'telegram', status: 'not_connected' });
    expect(getStore().messagingLinks.length).toBe(before);
  });

  it('a link minted while active is not connected once the invitation stops being active (connectByToken\'s rule), and a connected link spends its token', async () => {
    setScriptSession({ subjectId: 'cg-02', role: 'caregiver', linkedPatientId: 'pt-01' });
    const minted = await startMessagingLink({ subjectType: 'caregiver', subjectId: 'cg-02' });
    getStore().caregivers.find((c) => c.id === 'cg-02')!.status = 'revoked';
    await new Promise((r) => setTimeout(r, 120)); // the mock's own ~50 ms confirm
    expect(getStore().messagingLinks.find((l) => l.id === minted.id)?.status).toBe('pending');

    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const patient = await startMessagingLink({ subjectType: 'patient', subjectId: 'pt-01' });
    await new Promise((r) => setTimeout(r, 120));
    const row = getStore().messagingLinks.find((l) => l.id === patient.id)!;
    expect(row.status).toBe('connected');
    expect(row.linkToken).toBeUndefined();
  });
});
