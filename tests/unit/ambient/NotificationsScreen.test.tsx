/**
 * NotificationsScreen — E5 (features/ambient/NotificationsScreen.tsx). The four browser-permission
 * states (`default`/`granted`/`denied`/`unsupported`, the iOS sub-case included) and the chat round
 * trip (not_connected → pending → connected → send test → disconnect), against the real data layer.
 * Rule 7's one hard line: `MessagingLink.linkToken` never reaches the DOM at any step.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NotificationsScreen } from '@/features/ambient/NotificationsScreen';
import { getMessagingLink, startMessagingLink } from '@/lib/data';
import { linkForScreen, TELEGRAM_OPEN_PATH } from '@/lib/messaging/link';
import { LINK_POLL_MS, LINK_POLL_TRIES } from '@/features/ambient/TelegramLinkForm';
import { getStore, reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';
import { copy } from '@/i18n';

const A = copy.ambient;

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

function expectNoTokenInDom() {
  const store = getStore();
  for (const link of store.messagingLinks) {
    // innerHTML, not textContent: a hidden input or an attribute would leak it just as well.
    if (link.linkToken) expect(document.body.innerHTML).not.toContain(link.linkToken);
  }
}

/** The form an "Open Telegram" button submits: a plain POST to the link route, locale and screen only. */
function formOf(button: HTMLElement): HTMLFormElement {
  const form = button.closest('form');
  expect(form, 'the button sits in a form').not.toBeNull();
  return form as HTMLFormElement;
}
function expectLinkForm(button: HTMLElement, locale: 'ar' | 'en', from: string) {
  const form = formOf(button);
  expect(button).toHaveAttribute('type', 'submit');
  expect(form.getAttribute('method')).toBe('post');
  expect(form.getAttribute('action')).toBe(TELEGRAM_OPEN_PATH);
  expect(Object.fromEntries(new FormData(form))).toEqual({ locale, from });
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
    vi.useFakeTimers({ shouldAdvanceTime: true });
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

    // AP-09: "Open Telegram" is a form that posts to the route; the component itself mints nothing.
    expectLinkForm(screen.getByRole('button', { name: A.e5OpenChatAction.en }), 'en', 'notifications');
    // What the route does with that post, through the same seam call (tests/unit/api/telegram-open.test.ts
    // covers the route itself); the page then hands the screen the link WITHOUT its token.
    await startMessagingLink({ subjectType: 'patient', subjectId: 'pt-01' });
    const pending = getStore().messagingLinks.find((l) => l.subjectId === 'pt-01' && l.status === 'pending')!;
    expect(pending.linkToken).toBeTruthy(); // the mock does generate one — it must never surface
    expect(linkForScreen(pending)).not.toHaveProperty('linkToken');

    rerender(
      <NotificationsScreen
        patientId="pt-01"
        permission="default"
        active={false}
        iosNeedsInstall={false}
        messaging={linkForScreen(pending)}
        botHandle="@jurah_bot"
        locale="en"
      />,
    );
    expect(screen.getByTestId('chat-pending')).toBeInTheDocument();
    expectNoTokenInDom();

    // The polling effect calls router.refresh() on a real timer while pending, and the mock's own
    // setTimeout confirms the link a little after that — both real delays, waited for rather than
    // guessed at with a fixed sleep.
    vi.advanceTimersByTime(LINK_POLL_MS);
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
        messaging={linkForScreen(connected)}
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

describe('AP-09 — opening Telegram: a form to the route, the token never on the page', () => {
  const pendingView = { id: 'ml-09', subjectType: 'patient' as const, subjectId: 'pt-03', channel: 'telegram' as const, status: 'pending' as const };
  const props = { patientId: 'pt-03', permission: 'granted' as const, active: false, iosNeedsInstall: false, botHandle: '@jurah_real_bot', locale: 'ar' as const };

  it('every way to start a link (not connected, expired, the iOS "chat instead", pending "open again") is the same form, and never names t.me or a token', () => {
    const { rerender } = render(<NotificationsScreen {...props} messaging={{ ...pendingView, status: 'not_connected' }} />);
    expectLinkForm(screen.getByRole('button', { name: A.e5OpenChatAction.ar }), 'ar', 'notifications');
    rerender(<NotificationsScreen {...props} messaging={{ ...pendingView, status: 'expired' }} />);
    expectLinkForm(screen.getByRole('button', { name: copy.vocabulary.retry.ar }), 'ar', 'notifications');
    rerender(<NotificationsScreen {...props} permission="unsupported" iosNeedsInstall messaging={{ ...pendingView, status: 'not_connected' }} />);
    expectLinkForm(screen.getByRole('button', { name: A.e5IosChatInsteadAction.ar }), 'ar', 'notifications');
    rerender(<NotificationsScreen {...props} messaging={pendingView} />);
    expectLinkForm(screen.getByRole('button', { name: A.e5ChatOpenAgainAction.ar }), 'ar', 'notifications');
    expect(document.body.innerHTML).not.toContain('t.me');
    expect(document.body.innerHTML).not.toContain('start=');
  });

  it('a real bot: the form opens Telegram in a new tab, so this page stays and starts waiting; simulated: it posts in place', () => {
    const { rerender } = render(<NotificationsScreen {...props} messaging={{ ...pendingView, status: 'not_connected' }} />);
    expect(formOf(screen.getByRole('button', { name: A.e5OpenChatAction.ar })).getAttribute('target')).toBe('_blank');
    rerender(<NotificationsScreen {...props} simulated messaging={{ ...pendingView, status: 'not_connected' }} />);
    expect(formOf(screen.getByRole('button', { name: A.e5OpenChatAction.ar })).hasAttribute('target')).toBe(false);
  });

  it('a real bot: submitting the form starts the wait at once (this tab re-reads the page for the link the new tab minted)', () => {
    vi.useFakeTimers();
    render(<NotificationsScreen {...props} messaging={{ ...pendingView, status: 'not_connected' }} />);
    fireEvent.submit(formOf(screen.getByRole('button', { name: A.e5OpenChatAction.ar })));
    vi.advanceTimersByTime(LINK_POLL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('pending: "I pressed Start" checks now, and says so, calmly, when the link is still waiting (never an error, rule 2)', () => {
    const { container } = render(<NotificationsScreen {...props} messaging={pendingView} />);
    expect(screen.queryByTestId('chat-still-waiting')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: A.e5ChatCheckAction.ar }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('chat-still-waiting')).toHaveTextContent(A.e5ChatStillWaiting.ar);
    expect(screen.getByTestId('chat-still-waiting')).toHaveAttribute('role', 'status');
    expect(container.querySelector('.wsf-notice--warning, .wsf-notice--danger, [role="alert"]')).toBeNull();
  });

  it('pending: exactly one primary on the screen: "I pressed Start" steps down to secondary while "Enable notifications" is still offered', () => {
    const { container, rerender } = render(<NotificationsScreen {...props} permission="default" messaging={pendingView} />);
    expect(container.querySelectorAll('.wsf-btn--primary')).toHaveLength(1);
    expect(screen.getByRole('button', { name: A.e5ChatCheckAction.ar })).toHaveClass('wsf-btn--secondary');
    rerender(<NotificationsScreen {...props} permission="denied" messaging={pendingView} />);
    expect(container.querySelectorAll('.wsf-btn--primary')).toHaveLength(1);
    expect(screen.getByRole('button', { name: A.e5ChatCheckAction.ar })).toHaveClass('wsf-btn--primary');
  });

  it('pending keeps checking for five minutes, not twelve seconds (a person has to switch apps and press Start), then says it stopped', () => {
    vi.useFakeTimers();
    render(<NotificationsScreen {...props} messaging={pendingView} />);
    for (let i = 0; i < LINK_POLL_TRIES + 5; i++) act(() => void vi.advanceTimersByTime(LINK_POLL_MS));
    expect(LINK_POLL_MS * LINK_POLL_TRIES).toBe(5 * 60_000);
    expect(refresh).toHaveBeenCalledTimes(LINK_POLL_TRIES);
    expect(screen.getByTestId('chat-pending')).toHaveTextContent(A.e5ChatStoppedChecking.ar);
    // "I pressed Start" still checks, and gives the wait a fresh five minutes.
    fireEvent.click(screen.getByRole('button', { name: A.e5ChatCheckAction.ar }));
    act(() => void vi.advanceTimersByTime(LINK_POLL_MS));
    expect(refresh).toHaveBeenCalledTimes(LINK_POLL_TRIES + 2);
    expect(screen.getByTestId('chat-pending')).toHaveTextContent(A.e5ChatWaitingBody.ar);
  });

  it('pending: coming back to the tab from Telegram re-reads the page at once', () => {
    render(<NotificationsScreen {...props} messaging={pendingView} />);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('pending while simulated: the demo line is still there, and both actions are still offered (the preview can restart its link)', () => {
    render(<NotificationsScreen {...props} botHandle="@jurah_bot" simulated messaging={pendingView} />);
    expect(screen.getByRole('button', { name: A.e5ChatCheckAction.ar })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: A.e5ChatOpenAgainAction.ar })).toBeInTheDocument();
    expect(screen.getByTestId('chat-section')).toHaveTextContent(A.e5SimulatedNote.ar);
    expect(screen.getByTestId('chat-section')).toHaveTextContent('@jurah_bot');
  });
});
