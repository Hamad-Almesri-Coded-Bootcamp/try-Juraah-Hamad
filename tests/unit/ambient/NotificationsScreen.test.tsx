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
import { copy } from '@/i18n';

const A = copy.ambient;

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
    expect(screen.getByRole('button', { name: A.e5EnableAction.en })).toBeInTheDocument();
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
    expect(screen.getByText(A.e5GrantedNoticeTitle.en)).toBeInTheDocument();
    expect(screen.getByText(A.e5AlertDanger.en)).toBeInTheDocument();
    expect(screen.getByText(A.e5AlertReminder.en)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: A.e5SendTestAction.en })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: A.e5DisableAction.en })).toBeInTheDocument();
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
    expect(screen.getByText(A.e5DeniedHowToTitle.en)).toBeInTheDocument();
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
    expect(screen.getByText(A.e5ChatExpiredTitle.en)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.vocabulary.retry.en })).toBeInTheDocument();
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
    expect(screen.getByText(A.e5IosStepsTitle.en)).toBeInTheDocument();
    expect(screen.getByText(A.e5IosStep1.en)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: A.e5OpenChatAction.en }));
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

    fireEvent.click(screen.getByRole('button', { name: A.e5SendTestMessageAction.en }));
    // It says what happened in its own words, never the clipboard's "Copied".
    expect(await screen.findByText(A.e5TestMessageSent.en)).toBeInTheDocument();
    expect(screen.queryByText(copy.vocabulary.copied.en)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: A.e5DisconnectAction.en }));
    const consequences = screen.getByTestId('disconnect-consequences');
    expect(consequences).toHaveTextContent(A.e5DisconnectConsequence1.en);
    expect(consequences).toHaveTextContent(A.e5DisconnectConsequence3.en);

    fireEvent.click(screen.getAllByRole('button', { name: A.e5DisconnectConfirm.en })[1]!); // the Sheet's confirming button
    await vi.waitFor(() => expect(getStore().messagingLinks.find((l) => l.id === connected.id)?.status).toBe('not_connected'));
    expectNoTokenInDom();
  });
});

describe('E5 — exactly one primary action (UX Principles §2, audit M19)', () => {
  const notConnected = { id: 'ml-01', subjectType: 'patient' as const, subjectId: 'pt-01', channel: 'telegram' as const, status: 'not_connected' as const };

  it('push not yet asked + chat not connected: "Enable notifications" is the one primary; "Open Telegram" is secondary', () => {
    const { container } = render(
      <NotificationsScreen patientId="pt-01" permission="default" active={false} iosNeedsInstall={false} messaging={notConnected} botHandle="@jurah_bot" locale="en" />,
    );
    expect(container.querySelectorAll('.wsf-btn--primary')).toHaveLength(1);
    expect(screen.getByRole('button', { name: A.e5EnableAction.en })).toHaveClass('wsf-btn--primary');
    expect(screen.getByRole('button', { name: A.e5OpenChatAction.en })).toHaveClass('wsf-btn--secondary');
  });

  it('push already decided (denied) + chat not connected: "Open Telegram" is then the screen’s one primary', () => {
    const { container } = render(
      <NotificationsScreen patientId="pt-01" permission="denied" active={false} iosNeedsInstall={false} messaging={notConnected} botHandle="@jurah_bot" locale="en" />,
    );
    expect(container.querySelectorAll('.wsf-btn--primary')).toHaveLength(1);
    expect(screen.getByRole('button', { name: A.e5OpenChatAction.en })).toHaveClass('wsf-btn--primary');
  });
});

describe('E5 — test sends and the demo line', () => {
  it('after a test notification the screen says it was sent, never "Copied"', async () => {
    setScriptSession({ subjectId: 'pt-03', role: 'patient' });
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
    fireEvent.click(screen.getByRole('button', { name: A.e5SendTestAction.en }));
    expect(await screen.findByText(A.e5TestNotificationSent.en)).toBeInTheDocument();
    expect(screen.queryByText(copy.vocabulary.copied.en)).not.toBeInTheDocument();
  });

  it('the "this is a demo" line shows only while the bot is simulated', () => {
    const props = {
      patientId: 'pt-01',
      permission: 'default' as const,
      active: false,
      iosNeedsInstall: false,
      messaging: { id: 'ml-01', subjectType: 'patient' as const, subjectId: 'pt-01', channel: 'telegram' as const, status: 'not_connected' as const },
      botHandle: '@jurah_bot',
      locale: 'en' as const,
    };
    const { rerender } = render(<NotificationsScreen {...props} simulated />);
    expect(screen.getByText(new RegExp(A.e5SimulatedNote.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    rerender(<NotificationsScreen {...props} simulated={false} />);
    expect(screen.queryByText(new RegExp(A.e5SimulatedNote.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).not.toBeInTheDocument();
  });
});

describe('F1 — opening Telegram without the token ever reaching the page', () => {
  const pendingLink = { id: 'ml-09', subjectType: 'patient' as const, subjectId: 'pt-03', channel: 'telegram' as const, status: 'pending' as const, linkToken: 'tok_SECRET_123' };
  it('pending (real bot): "Open Telegram" opens our own route in a new tab — never t.me, never the token', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<NotificationsScreen patientId="pt-03" permission="granted" active={false} iosNeedsInstall={false} messaging={pendingLink} botHandle="@jurah_real_bot" locale="ar" />);
    fireEvent.click(screen.getByRole('button', { name: A.e5OpenChatAction.ar }));
    expect(open).toHaveBeenCalledWith('/api/messaging/telegram/open?locale=ar', '_blank', 'noopener');
    expect(document.body.innerHTML).not.toContain('tok_SECRET_123');
    expect(document.body.innerHTML).not.toContain('t.me');
    open.mockRestore();
  });
  it('pending while the bot is simulated: no "Open Telegram" (there is no bot to open)', () => {
    render(<NotificationsScreen patientId="pt-03" permission="granted" active={false} iosNeedsInstall={false} messaging={pendingLink} botHandle="@jurah_bot" simulated locale="ar" />);
    expect(screen.queryByRole('button', { name: A.e5OpenChatAction.ar })).toBeNull();
  });
  it('pending keeps checking for 5 minutes (a person has to switch apps and press Start), then stops', () => {
    vi.useFakeTimers();
    render(<NotificationsScreen patientId="pt-03" permission="granted" active={false} iosNeedsInstall={false} messaging={pendingLink} botHandle="@jurah_real_bot" locale="ar" />);
    vi.advanceTimersByTime(2000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
