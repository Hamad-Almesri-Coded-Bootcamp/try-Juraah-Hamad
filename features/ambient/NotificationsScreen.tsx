'use client';

/**
 * E5 — notifications & messaging (`docs/wireframes/Messaging.dc.html`, `NotifyStates.dc.html`),
 * Daylight (CR-071): each section a heading, one quiet summary line and its state in a grouped card.
 * After a test is sent the screen says so in its own words (it used to reuse the clipboard's
 * "Copied"). The "this is a demo" line shows only while the bot is simulated. Two independent
 * sections, per SCREENS.md and rule 2: **neither ever renders as an error or a warning**
 * for an off/not-connected/denied state (G10 — `InlineNotice` never `tone="warning"` for these; CR-012
 * fixed exactly this on the board's own not-connected panel).
 *
 * Browser section: `default` / `granted` / `denied` / `unsupported` (with the iOS-Safari-not-installed
 * sub-case reading `getPushCapability().iosNeedsInstall`). A `PushSubscription` row with
 * `permission: 'granted'` but `status: 'revoked'` (this screen's own `disablePush` having been used)
 * renders in the SAME "one enable action" branch as `default` — the browser's permission and this
 * product's subscription are two different things, and only the second is what "on/off" here means;
 * recorded in `docs/backend-notes/wp4g.md` since the contract's four `permission` values don't name
 * this fifth combination on their own.
 *
 * Chat section: `not_connected` / `pending` / `connected` / `expired`, rule 7's one strict line —
 * `MessagingLink.linkToken` is never read by this component, so it can never reach the DOM at any
 * step of the round trip. While `pending`, this component polls (`router.refresh()`) until the bot's
 * webhook confirms, rather than sleeping a fixed guess.
 *
 * F1 — opening Telegram: the tap opens a tab AT ONCE (a tab opened after an await is a blocked
 * pop-up), and once the link is minted that tab goes to /api/messaging/telegram/open, which reads
 * the token on the server and redirects to t.me/<bot>?start=<token>. The page never holds the token;
 * while pending, "Open Telegram" reopens the same route. Polling runs for 5 minutes (the token lives
 * 15), long enough to switch apps, press Start and come back.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { Sheet } from '@/components/ui/Sheet';
import { MenuRow } from '@/components/ui/MenuRow';
import { Icon } from '@/components/ui/Icon';
import {
  disablePush,
  disconnectMessaging,
  requestPushPermission,
  sendTestMessage,
  sendTestNotification,
  startMessagingLink,
} from '@/lib/data';
import { formatDate, formatNumber } from '@/i18n/format';
import { interpolate } from '@/features/shell/interpolate';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { MessagingLink, PushSubscription } from '@/types/contracts';

const POLL_MS = 2000;
const POLL_MAX_TRIES = 150; // 5 minutes: a person has to switch to Telegram, press Start and come back
/** The server route that redirects to the bot with this person's own pending link (the token stays server-side). */
const openTelegramUrl = (locale: string) => '/api/messaging/telegram/open?locale=' + (locale === 'en' ? 'en' : 'ar');

export function NotificationsScreen({
  patientId,
  permission,
  active,
  iosNeedsInstall,
  messaging,
  botHandle,
  simulated = false,
  locale,
}: {
  patientId: string;
  permission: PushSubscription['permission'];
  /** Whether OUR subscription is active — distinct from the browser's own `permission` grant; see
   * this file's own doc comment. */
  active: boolean;
  iosNeedsInstall: boolean;
  messaging: MessagingLink;
  botHandle: string;
  /** The chat is a demo (no bot token configured on the server, `BOT_IS_SIMULATED`). Only then is the
   * "this is a demo" line shown; the page reads the server-only flag and passes it in. */
  simulated?: boolean;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [testSent, setTestSent] = useState(false);
  const [testMessageSent, setTestMessageSent] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollTries = useRef(0);

  const subject = { subjectType: 'patient' as const, subjectId: patientId };
  const showGranted = permission === 'granted' && active;
  const showUnsupported = permission === 'unsupported';
  const showDenied = permission === 'denied' && !showUnsupported;
  const showDefault = !showGranted && !showDenied && !showUnsupported;

  // The mock confirms `pending → connected` after its own short server-side delay (startMessagingLink's
  // setTimeout) — polled for here rather than slept for a guessed duration.
  useEffect(() => {
    if (messaging.status !== 'pending') {
      pollTries.current = 0;
      return;
    }
    if (pollTries.current >= POLL_MAX_TRIES) return;
    const id = setTimeout(() => {
      pollTries.current += 1;
      router.refresh();
    }, POLL_MS);
    return () => clearTimeout(id);
  }, [messaging.status, router]);

  function handleEnablePush() {
    startTransition(() => {
      void (async () => {
        await requestPushPermission(subject);
        router.refresh();
      })();
    });
  }

  function handleDisablePush() {
    startTransition(() => {
      void (async () => {
        await disablePush(subject);
        router.refresh();
      })();
    });
  }

  function handleSendTestNotification() {
    startTransition(() => {
      void (async () => {
        await sendTestNotification(subject);
        setTestSent(true);
      })();
    });
  }

  function handleConnectChat() {
    // Opened during the tap itself, so the browser allows it; pointed at the bot once the link exists.
    const tab = simulated ? null : window.open('', '_blank');
    startTransition(() => {
      void (async () => {
        const link = await startMessagingLink(subject);
        if (tab) {
          if (link.status === 'pending') tab.location.href = openTelegramUrl(locale);
          else tab.close();
        }
        router.refresh();
      })();
    });
  }

  function handleReopenTelegram() {
    window.open(openTelegramUrl(locale), '_blank', 'noopener');
  }

  function handleSendTestMessage() {
    startTransition(() => {
      void (async () => {
        await sendTestMessage(subject);
        setTestMessageSent(true);
      })();
    });
  }

  function confirmDisconnect() {
    startTransition(() => {
      void (async () => {
        await disconnectMessaging(subject);
        setDisconnecting(false);
        router.refresh();
      })();
    });
  }

  return (
    <div className="relative flex flex-col gap-6" data-testid="notifications-screen">
      {/* Browser notifications */}
      <section className="flex flex-col gap-2" data-testid="push-section">
        <h2 className="jr-group-title">{t(copy.ambient.e5BrowserSectionTitle, locale)}</h2>
        <p className="m-0 px-1 type-body-small text-ink-muted">{t(copy.ambient.e5BrowserSummary, locale)}</p>

        {showDefault && (
          <div className="jr-group flex flex-col gap-4 p-4" data-testid="push-default">
            <p className="m-0 type-body">{t(copy.ambient.e5DefaultBody, locale)}</p>
            <Button variant="primary" size="lg" fullWidth lang={locale} icon="bell" loading={pending} onClick={handleEnablePush}>
              {t(copy.ambient.e5EnableAction, locale)}
            </Button>
          </div>
        )}

        {showGranted && (
          <div className="flex flex-col gap-3" data-testid="push-granted">
            <InlineNotice tone="success" title={t(copy.ambient.e5GrantedNoticeTitle, locale)}>
              {t(copy.ambient.e5GrantedNoticeBody, locale)}
            </InlineNotice>
            <h3 className="m-0 px-1 pt-2 type-body-strong text-navy">{t(copy.ambient.e5AlertsListTitle, locale)}</h3>
            <div className="jr-group">
              <MenuRow label={t(copy.ambient.e5AlertDanger, locale)} value={t(copy.vocabulary.on, locale)} />
              <MenuRow label={t(copy.ambient.e5AlertReviewer, locale)} value={t(copy.vocabulary.on, locale)} />
              <MenuRow label={t(copy.ambient.e5AlertRefill, locale)} value={t(copy.vocabulary.on, locale)} />
              <MenuRow label={t(copy.ambient.e5AlertNewRx, locale)} value={t(copy.vocabulary.on, locale)} />
              <MenuRow label={t(copy.ambient.e5AlertInvite, locale)} value={t(copy.vocabulary.on, locale)} />
              <MenuRow
                label={t(copy.ambient.e5AlertReminder, locale)}
                description={t(copy.ambient.e5AlertReminderNote, locale)}
                value={t(copy.vocabulary.on, locale)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button variant="secondary" lang={locale} icon="bell" loading={pending} onClick={handleSendTestNotification}>
                {t(copy.ambient.e5SendTestAction, locale)}
              </Button>
              <Button variant="quiet" lang={locale} loading={pending} onClick={handleDisablePush}>
                {t(copy.ambient.e5DisableAction, locale)}
              </Button>
            </div>
            {testSent && (
              <p role="status" aria-live="polite" className="m-0 flex items-center gap-2 px-1 type-body-small text-success">
                <Icon name="check" small />
                <span>{t(copy.ambient.e5TestNotificationSent, locale)}</span>
              </p>
            )}
          </div>
        )}

        {showDenied && (
          <div className="jr-group flex flex-col gap-4 p-4" data-testid="push-denied">
            <InlineNotice tone="info" title={t(copy.ambient.e5DeniedNoticeTitle, locale)}>
              {t(copy.ambient.e5DeniedNoticeBody, locale)}
            </InlineNotice>
            <div className="flex flex-col gap-1">
              <h3 className="m-0 type-body-strong text-navy">{t(copy.ambient.e5DeniedHowToTitle, locale)}</h3>
              <p className="m-0 type-body">{t(copy.ambient.e5DeniedHowToBody, locale)}</p>
            </div>
            <p className="m-0 type-body-small text-ink-muted">{t(copy.ambient.e5DeniedFooterNote, locale)}</p>
          </div>
        )}

        {showUnsupported && !iosNeedsInstall && (
          <div className="flex flex-col gap-3" data-testid="push-unsupported">
            <InlineNotice tone="info" title={t(copy.ambient.e5UnsupportedNoticeTitle, locale)}>
              {t(copy.ambient.e5UnsupportedNoticeBody, locale)}
            </InlineNotice>
          </div>
        )}

        {showUnsupported && iosNeedsInstall && (
          <div className="flex flex-col gap-3" data-testid="push-ios-install">
            <InlineNotice tone="info" title={t(copy.ambient.e5IosNoticeTitle, locale)}>
              {t(copy.ambient.e5IosNoticeBody, locale)}
            </InlineNotice>
            <h3 className="m-0 px-1 pt-2 type-body-strong text-navy">{t(copy.ambient.e5IosStepsTitle, locale)}</h3>
            <ol className="jr-group m-0 flex list-none flex-col p-0">
              {[copy.ambient.e5IosStep1, copy.ambient.e5IosStep2, copy.ambient.e5IosStep3, copy.ambient.e5IosStep4].map((step, i) => (
                <li key={i} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <span className="jr-num flex size-5 flex-none items-center justify-center rounded-full bg-navy-tint type-body-strong text-navy" aria-hidden="true">
                    {formatNumber(i + 1, locale)}
                  </span>
                  <span className="type-body">{t(step, locale)}</span>
                </li>
              ))}
            </ol>
            <Button variant="secondary" size="lg" fullWidth lang={locale} icon="link" loading={pending} onClick={handleConnectChat}>
              {t(copy.ambient.e5IosChatInsteadAction, locale)}
            </Button>
          </div>
        )}
      </section>

      {/* Chat (optional) */}
      <section className="flex flex-col gap-2" data-testid="chat-section">
        <h2 className="jr-group-title">{t(copy.ambient.e5ChatSectionTitle, locale)}</h2>
        <p className="m-0 px-1 type-body-small text-ink-muted">{t(copy.ambient.e5ChatSummary, locale)}</p>

        {messaging.status === 'not_connected' && (
          <div className="jr-group flex flex-col gap-4 p-4" data-testid="chat-not-connected">
            <p className="m-0 type-body-strong text-navy">{t(copy.ambient.e5ChatNotConnectedBody, locale)}</p>
            <p className="m-0 type-body">{t(copy.ambient.e5ChatStepsBody, locale)}</p>
            {/* One primary per screen (UX §2, audit M19): while the browser section still offers its
                own primary "Enable notifications", the chat's action steps down to secondary; once
                that choice is made (granted/denied/unsupported), this is the screen's one primary. */}
            <Button variant={showDefault ? 'secondary' : 'primary'} size="lg" fullWidth lang={locale} icon="link" loading={pending} onClick={handleConnectChat}>
              {t(copy.ambient.e5OpenChatAction, locale)}
            </Button>
          </div>
        )}

        {messaging.status === 'pending' && (
          <div className="flex flex-col gap-3" data-testid="chat-pending">
            <InlineNotice tone="info" title={t(copy.ambient.e5ChatWaitingTitle, locale)}>
              {t(copy.ambient.e5ChatWaitingBody, locale)}
            </InlineNotice>
            {!simulated && (
              <Button variant="secondary" size="lg" fullWidth lang={locale} icon="link" onClick={handleReopenTelegram}>
                {t(copy.ambient.e5OpenChatAction, locale)}
              </Button>
            )}
          </div>
        )}

        {messaging.status === 'connected' && (
          <div className="flex flex-col gap-3" data-testid="chat-connected">
            <InlineNotice
              tone="success"
              title={interpolate(t(copy.ambient.e5ChatConnectedSinceTemplate, locale), {
                date: messaging.connectedAt ? formatDate(messaging.connectedAt.slice(0, 10), locale) : '',
              })}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" lang={locale} loading={pending} onClick={handleSendTestMessage}>
                {t(copy.ambient.e5SendTestMessageAction, locale)}
              </Button>
              <Button variant="quiet" lang={locale} onClick={() => setDisconnecting(true)}>
                {t(copy.ambient.e5DisconnectAction, locale)}
              </Button>
            </div>
            {testMessageSent && (
              <p role="status" aria-live="polite" className="m-0 flex items-center gap-2 px-1 type-body-small text-success">
                <Icon name="check" small />
                <span>{t(copy.ambient.e5TestMessageSent, locale)}</span>
              </p>
            )}
          </div>
        )}

        {messaging.status === 'expired' && (
          <div className="flex flex-col gap-3" data-testid="chat-expired">
            <InlineNotice tone="info" title={t(copy.ambient.e5ChatExpiredTitle, locale)}>
              {t(copy.ambient.e5ChatExpiredBody, locale)}
            </InlineNotice>
            <Button variant="secondary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleConnectChat}>
              {t(copy.vocabulary.retry, locale)}
            </Button>
          </div>
        )}

        <p className="m-0 px-1 pt-1 type-caption text-ink-muted">
          {interpolate(t(copy.ambient.e5BotHandleTemplate, locale), { handle: '\u2068' + botHandle + '\u2069' })}
          {simulated ? ` · ${t(copy.ambient.e5SimulatedNote, locale)}` : null}
        </p>
      </section>

      <Sheet
        open={disconnecting}
        title={t(copy.ambient.e5DisconnectSheetTitle, locale)}
        onClose={() => setDisconnecting(false)}
        closeLabel={t(copy.ambient.e3SheetCloseLabel, locale)}
        footer={
          <>
            <Button variant="danger" fullWidth lang={locale} loading={pending} onClick={confirmDisconnect}>
              {t(copy.ambient.e5DisconnectConfirm, locale)}
            </Button>
            <Button variant="quiet" fullWidth lang={locale} onClick={() => setDisconnecting(false)} disabled={pending}>
              {t(copy.ambient.e5DisconnectCancel, locale)}
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-2 ps-5 type-body" data-testid="disconnect-consequences">
          <li>{t(copy.ambient.e5DisconnectConsequence1, locale)}</li>
          <li>{t(copy.ambient.e5DisconnectConsequence2, locale)}</li>
          <li>{t(copy.ambient.e5DisconnectConsequence3, locale)}</li>
        </ul>
      </Sheet>
    </div>
  );
}
