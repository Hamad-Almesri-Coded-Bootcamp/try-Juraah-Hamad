'use client';

/**
 * E5 — notifications & messaging (`docs/wireframes/Messaging.dc.html`, `NotifyStates.dc.html`). Two
 * independent sections, per SCREENS.md and rule 2: **neither ever renders as an error or a warning**
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
 * step of the round trip. While `pending`, this component polls (`router.refresh()`) for the mock's
 * own delayed auto-confirm rather than sleeping a fixed guess.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { Sheet } from '@/components/ui/Sheet';
import { MenuRow } from '@/components/ui/MenuRow';
import {
  disablePush,
  disconnectMessaging,
  requestPushPermission,
  sendTestMessage,
  sendTestNotification,
  startMessagingLink,
} from '@/lib/data';
import { formatDate } from '@/i18n/format';
import { interpolate } from '@/features/shell/interpolate';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { MessagingLink, PushSubscription } from '@/types/contracts';

const POLL_MS = 400;
const POLL_MAX_TRIES = 30; // ~12s — well past the mock's own ~50ms confirm delay

export function NotificationsScreen({
  patientId,
  permission,
  active,
  iosNeedsInstall,
  messaging,
  botHandle,
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
    startTransition(() => {
      void (async () => {
        await startMessagingLink(subject);
        router.refresh();
      })();
    });
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
      <section className="flex flex-col gap-3" data-testid="push-section">
        <span className="type-h2">{t(copy.ambient.e5BrowserSectionTitle, locale)}</span>
        <p className="type-body-small">{t(copy.ambient.e5BrowserSummary, locale)}</p>

        {showDefault && (
          <div className="flex flex-col gap-3" data-testid="push-default">
            <p className="type-body">{t(copy.ambient.e5DefaultBody, locale)}</p>
            <Button variant="primary" size="lg" fullWidth lang={locale} icon="subscribe" loading={pending} onClick={handleEnablePush}>
              {t(copy.ambient.e5EnableAction, locale)}
            </Button>
          </div>
        )}

        {showGranted && (
          <div className="flex flex-col gap-3" data-testid="push-granted">
            <InlineNotice tone="success" title={t(copy.ambient.e5GrantedNoticeTitle, locale)}>
              {t(copy.ambient.e5GrantedNoticeBody, locale)}
            </InlineNotice>
            <div className="flex flex-col">
              <MenuRow label={t(copy.ambient.e5AlertDanger, locale)} value={t(copy.vocabulary.on, locale)} />
              <MenuRow label={t(copy.ambient.e5AlertReviewer, locale)} value={t(copy.vocabulary.on, locale)} />
              <MenuRow label={t(copy.ambient.e5AlertRefill, locale)} value={t(copy.vocabulary.on, locale)} />
              <MenuRow label={t(copy.ambient.e5AlertNewRx, locale)} value={t(copy.vocabulary.on, locale)} />
              <MenuRow label={t(copy.ambient.e5AlertInvite, locale)} value={t(copy.vocabulary.on, locale)} />
              <MenuRow label={t(copy.ambient.e5AlertReminder, locale)} value={`${t(copy.vocabulary.on, locale)} · ${t(copy.ambient.e5AlertReminderNote, locale)}`} />
            </div>
            <Button variant="secondary" size="lg" fullWidth lang={locale} icon="subscribe" loading={pending} onClick={handleSendTestNotification}>
              {t(copy.ambient.e5SendTestAction, locale)}
            </Button>
            {testSent && (
              <p role="status" aria-live="polite" className="type-caption">
                {t(copy.vocabulary.copied, locale)}
              </p>
            )}
            <Button variant="quiet" lang={locale} loading={pending} onClick={handleDisablePush}>
              {t(copy.ambient.e5DisableAction, locale)}
            </Button>
          </div>
        )}

        {showDenied && (
          <div className="flex flex-col gap-3" data-testid="push-denied">
            <InlineNotice tone="info" title={t(copy.ambient.e5DeniedNoticeTitle, locale)}>
              {t(copy.ambient.e5DeniedNoticeBody, locale)}
            </InlineNotice>
            <div className="flex flex-col gap-1">
              <span className="type-body-strong">{t(copy.ambient.e5DeniedHowToTitle, locale)}</span>
              <span className="type-body-small">{t(copy.ambient.e5DeniedHowToBody, locale)}</span>
            </div>
            <p className="type-caption">{t(copy.ambient.e5DeniedFooterNote, locale)}</p>
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
            <div className="flex flex-col gap-1">
              <span className="type-body-strong">{t(copy.ambient.e5IosStepsTitle, locale)}</span>
              <ol className="flex flex-col gap-1 ps-5 type-body-small">
                <li>{t(copy.ambient.e5IosStep1, locale)}</li>
                <li>{t(copy.ambient.e5IosStep2, locale)}</li>
                <li>{t(copy.ambient.e5IosStep3, locale)}</li>
                <li>{t(copy.ambient.e5IosStep4, locale)}</li>
              </ol>
            </div>
            <Button variant="secondary" size="lg" fullWidth lang={locale} icon="link" loading={pending} onClick={handleConnectChat}>
              {t(copy.ambient.e5IosChatInsteadAction, locale)}
            </Button>
          </div>
        )}
      </section>

      {/* Chat (optional) */}
      <section className="flex flex-col gap-3" data-testid="chat-section">
        <span className="type-h2">{t(copy.ambient.e5ChatSectionTitle, locale)}</span>
        <p className="type-body-small">{t(copy.ambient.e5ChatSummary, locale)}</p>

        {messaging.status === 'not_connected' && (
          <div className="flex flex-col gap-3" data-testid="chat-not-connected">
            <InlineNotice tone="info" title={t(copy.ambient.e5ChatNotConnectedBody, locale)} />
            <p className="type-body-small">{t(copy.ambient.e5ChatStepsBody, locale)}</p>
            <Button variant="primary" size="lg" fullWidth lang={locale} icon="link" loading={pending} onClick={handleConnectChat}>
              {t(copy.ambient.e5OpenChatAction, locale)}
            </Button>
          </div>
        )}

        {messaging.status === 'pending' && (
          <div className="flex flex-col gap-3" data-testid="chat-pending">
            <InlineNotice tone="info" title={t(copy.ambient.e5ChatWaitingTitle, locale)}>
              {t(copy.ambient.e5ChatWaitingBody, locale)}
            </InlineNotice>
          </div>
        )}

        {messaging.status === 'connected' && (
          <div className="flex flex-col gap-3" data-testid="chat-connected">
            <InlineNotice tone="success" title={interpolate(t(copy.ambient.e5ChatConnectedSinceTemplate, locale), { date: messaging.connectedAt ? formatDate(messaging.connectedAt.slice(0, 10), locale) : '' })} />
            <div className="flex gap-2">
              <Button variant="secondary" lang={locale} loading={pending} onClick={handleSendTestMessage}>
                {t(copy.ambient.e5SendTestMessageAction, locale)}
              </Button>
              <Button variant="quiet" lang={locale} onClick={() => setDisconnecting(true)}>
                {t(copy.ambient.e5DisconnectAction, locale)}
              </Button>
            </div>
            {testMessageSent && (
              <p role="status" aria-live="polite" className="type-caption">
                {t(copy.vocabulary.copied, locale)}
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

        <p className="type-caption">
          {interpolate(t(copy.ambient.e5BotHandleTemplate, locale), { handle: botHandle })} · {t(copy.ambient.e5SimulatedNote, locale)}
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
