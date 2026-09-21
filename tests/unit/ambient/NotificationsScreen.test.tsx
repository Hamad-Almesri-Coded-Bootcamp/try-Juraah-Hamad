/**
 * NotificationsScreen — E5 (features/ambient/NotificationsScreen.tsx). The four browser-permission
 * states (`default`/`granted`/`denied`/`unsupported`, the iOS sub-case included) and the chat round
 * trip (not_connected → pending → connected → send test → disconnect), against the real data layer.
 * Rule 7's one hard line: `MessagingLink.linkToken` never reaches the DOM at any step.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NotificationsScreen } from '@/features/ambient/NotificationsScreen';
import { getMessagingLink } from '@/lib/data';
import { getStore, reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

function expectNoTokenInDom() {
  const store = getStore();
  for (const link of store.messagingLinks) {
    if (link.linkToken) expect(document.body.textContent).not.toContain(link.linkToken);
  }
}

beforeEach(() => {
  reset();
  refresh.mockClear();
});

afterEach(() => {
  cleanup();
  setScriptSession(null);
  vi.useRealTimers();
});

describe('Browser section — four permission states', () => {
  it('default — one enable action, explained before asked', () => {
    render(
      <NotificationsScreen
        patientId="pt-01"
        permission="default"
        active={false}
        iosNeedsInstall={false}
        messaging={{ id: 'ml-01', subjectType: 'patient', subjectId: 'pt-01', channel: 'telegram', status: 'not_connected' }}
        botHandle="@jurah_bot"
        locale="en"
      />,
    );
    expect(screen.getByTestId('push-default')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable notifications' })).toBeInTheDocument();
  });

  it('granted — on, alert types listed, send-test and disable both present', () => {
    render(
      <NotificationsScreen
        patientId="pt-03"
        permission="granted"
        active
        iosNeedsInstall={false}
        messaging={{ id: 'ml-03', subjectType: 'patient', subjectId: 'pt-03', channel: 'telegram', status: 'connected', connectedAt: '2026-08-11T00:00:00+03:00' }}
        botHandle="@jurah_bot"
        locale="en"
      />,
    );
    expect(screen.getByTestId('push-granted')).toBeInTheDocument();
    expect(screen.getByText('Notifications are on')).toBeInTheDocument();
    expect(screen.getByText('Serious interaction')).toBeInTheDocument();
    expect(screen.getByText('Dose reminder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send a test notification' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn off notifications' })).toBeInTheDocument();
  });

  it('denied — neutral tone: no warning/danger class on its notice, plain re-enable steps, never a nag', () => {
    const { container } = render(
      <NotificationsScreen
        patientId="pt-02"
        permission="denied"
        active={false}
        iosNeedsInstall={false}
        messaging={{ id: 'ml-02', subjectType: 'patient', subjectId: 'pt-02', channel: 'telegram', status: 'expired' }}
        botHandle="@jurah_bot"
        locale="en"
      />,
    );
    const panel = screen.getByTestId('push-denied');
    expect(panel).toBeInTheDocument();
    expect(container.querySelector('.wsf-notice--warning, .wsf-notice--danger')).not.toBeInTheDocument();
    expect(screen.getByText('How to turn it back on')).toBeInTheDocument();
  });

  it('chat expired — says so and offers retry; no seeded patient’s CURRENT chat state ever resolves to `expired` (فاطمة’s own retry link, ml-05, supersedes ml-02 — docs/backend-notes/wp4g.md), so this branch is exercised here with constructed props, matching CR-014’s own precedent for an unreachable-from-one-patient combination', () => {
    render(
      <NotificationsScreen
        patientId="pt-02"
        permission="denied"
        active={false}
        iosNeedsInstall={false}
        messaging={{ id: 'ml-02', subjectType: 'patient', subjectId: 'pt-02', channel: 'telegram', status: 'expired' }}
        botHandle="@jurah_bot"
        locale="en"
      />,
    );
    expect(screen.getByTestId('chat-expired')).toBeInTheDocument();
    expect(screen.getByText('This link expired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('unsupported, generic — says so, no install steps', () => {
    render(
      <NotificationsScreen
        patientId="pt-01"
        permission="unsupported"
        active={false}
        iosNeedsInstall={false}
        messaging={{ id: 'ml-01', subjectType: 'patient', subjectId: 'pt-01', channel: 'telegram', status: 'not_connected' }}
        botHandle="@jurah_bot"
        locale="en"
      />,
    );
    expect(screen.getByTestId('push-unsupported')).toBeInTheDocument();
    expect(screen.queryByTestId('push-ios-install')).not.toBeInTheDocument();
  });

  it('unsupported, iOS Safari not installed — gives Home Screen install steps, never a bare promise', () => {
    render(
      <NotificationsScreen
        patientId="pt-01"
        permission="unsupported"
        active={false}
        iosNeedsInstall
        messaging={{ id: 'ml-01', subjectType: 'patient', subjectId: 'pt-01', channel: 'telegram', status: 'not_connected' }}
        botHandle="@jurah_bot"
        locale="en"
      />,
    );
    expect(screen.getByTestId('push-ios-install')).toBeInTheDocument();
    expect(screen.getByText('Add Jur’ah to the Home Screen')).toBeInTheDocument();
    expect(screen.getByText('Tap the Share button in Safari')).toBeInTheDocument();
  });

  it('a granted permission whose subscription this screen disabled folds into the same one-enable-action branch as default (not a fifth, undesigned state)', () => {
    render(
      <NotificationsScreen
        patientId="pt-03"
        permission="granted"
        active={false}
        iosNeedsInstall={false}
        messaging={{ id: 'ml-03', subjectType: 'patient', subjectId: 'pt-03', channel: 'telegram', status: 'not_connected' }}
        botHandle="@jurah_bot"
        locale="en"
      />,
    );
    expect(screen.getByTestId('push-default')).toBeInTheDocument();
  });
});

describe('Chat section — round trip: not_connected → pending → connected → send test → disconnect', () => {
  it('never renders the link token in the DOM at any step, and the mock’s own delayed confirm is polled for rather than slept for', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });

    const notConnected = await getMessagingLink({ subjectType: 'patient', subjectId: 'pt-01' });
    const { rerender } = render(
      <NotificationsScreen
        patientId="pt-01"
        permission="default"
        active={false}
        iosNeedsInstall={false}
        messaging={notConnected}
        botHandle="@jurah_bot"
        locale="en"
      />,
    );
    expect(screen.getByTestId('chat-not-connected')).toBeInTheDocument();
    expectNoTokenInDom();

    fireEvent.click(screen.getByRole('button', { name: 'Open Telegram' }));
    await vi.waitFor(() => expect(getStore().messagingLinks.some((l) => l.subjectId === 'pt-01' && l.status === 'pending')).toBe(true));
    const pending = getStore().messagingLinks.find((l) => l.subjectId === 'pt-01' && l.status === 'pending')!;
    expect(pending.linkToken).toBeTruthy(); // the mock does generate one — it must never surface

    rerender(
      <NotificationsScreen
        patientId="pt-01"
        permission="default"
        active={false}
        iosNeedsInstall={false}
        messaging={pending}
        botHandle="@jurah_bot"
        locale="en"
      />,
    );
    expect(screen.getByTestId('chat-pending')).toBeInTheDocument();
    expectNoTokenInDom();

    // The polling effect calls router.refresh() on a real timer while pending, and the mock's own
    // setTimeout confirms the link a little after that — both real delays, waited for rather than
    // guessed at with a fixed sleep.
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled(), { timeout: 2000 });
    await vi.waitFor(
      () => expect(getStore().messagingLinks.find((l) => l.subjectId === 'pt-01' && l.id === pending.id)?.status).toBe('connected'),
      { timeout: 2000 },
    );
    const connected = getStore().messagingLinks.find((l) => l.subjectId === 'pt-01' && l.id === pending.id)!;

    rerender(
      <NotificationsScreen
        patientId="pt-01"
        permission="default"
        active={false}
        iosNeedsInstall={false}
        messaging={connected}
        botHandle="@jurah_bot"
        locale="en"
      />,
    );
    expect(screen.getByTestId('chat-connected')).toBeInTheDocument();
    expectNoTokenInDom();

    fireEvent.click(screen.getByRole('button', { name: 'Send a test message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    const consequences = screen.getByTestId('disconnect-consequences');
    expect(consequences).toHaveTextContent('Daily check-in messages stop.');
    expect(consequences).toHaveTextContent('Your recorded dose history is kept.');

    fireEvent.click(screen.getAllByRole('button', { name: 'Disconnect' })[1]!); // the Sheet's confirming button
    await vi.waitFor(() => expect(getStore().messagingLinks.find((l) => l.id === connected.id)?.status).toBe('not_connected'));
    expectNoTokenInDom();
  });
});
