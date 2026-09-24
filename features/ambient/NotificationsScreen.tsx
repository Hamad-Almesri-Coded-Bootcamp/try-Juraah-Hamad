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
 * Chat section: `not_connected` / `pending` / `connected` / `expired`, rule 7's one strict line:
 * this component never receives a link token at all (the page passes `linkForScreen(link)`, which
 * drops it on the server), so it can never reach the DOM or the page's RSC payload.
 *
 * AP-09 (CR-083, CR-086, CR-087): every "Open Telegram" is a TelegramLinkForm, a form that POSTs to
 * /api/messaging/telegram/open. That route mints the person's own link and answers 303 to
 * t.me/<bot>?start=<token>; the token is only in that Location header. With a real bot the form
 * opens in a new tab and this page starts waiting at once; simulated, the form posts in place and
 * the route sends the person back here. While `pending`, useLinkConfirmation re-reads the page every
 * few seconds for five minutes (the token lives fifteen), at once on returning to the tab, and on
 * "I pressed Start", which also says so when the link is still waiting. "Open Telegram again" mints
 * a fresh link (the old token is superseded, one live token per subject).
 */
import { useState, useTransition } from 'react';
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
} from '@/lib/data';
import { TelegramLinkForm, useLinkConfirmation } from '@/features/ambient/TelegramLinkForm';
import { formatDate, formatNumber } from '@/i18n/format';
import { interpolate } from '@/features/shell/interpolate';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { MessagingLink, PushSubscription } from '@/types/contracts';

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
  // One busy state per section: an action in one never puts a spinner on the other's buttons.
  const [pushBusy, startPush] = useTransition();
  const [chatBusy, startChat] = useTransition();
  const [testSent, setTestSent] = useState(false);
  const [testMessageSent, setTestMessageSent] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  // A real bot: the form opened Telegram in another tab, and the link it minted is on its way here.
  const [opened, setOpened] = useState(false);
  const awaiting = messaging.status === 'pending' || (opened && messaging.status !== 'connected');
  const confirmation = useLinkConfirmation(awaiting);

  const subject = { subjectType: 'patient' as const, subjectId: patientId };
  const showGranted = permission === 'granted' && active;
  const showUnsupported = permission === 'unsupported';
  const showDenied = permission === 'denied' && !showUnsupported;
  const showDefault = !showGranted && !showDenied && !showUnsupported;

  function handleEnablePush() {
    startPush(() => {
      void (async () => {
        await requestPushPermission(subject);
        router.refresh();
      })();
    });
  }

  function handleDisablePush() {
    startPush(() => {
      void (async () => {
        await disablePush(subject);
        router.refresh();
      })();
    });
  }

  function handleSendTestNotification() {
    startPush(() => {
      void (async () => {
        await sendTestNotification(subject);
        setTestSent(true);
      })();
    });
  }

  /** A real bot's form just opened Telegram in a new tab: wait here for the link it minted. */
  function handleTelegramOpened() {
    setOpened(true);
    confirmation.restart();
  }

  function handleSendTestMessage() {
    startChat(() => {
      void (async () => {
        await sendTestMessage(subject);
        setTestMessageSent(true);
      })();
    });
  }

  function confirmDisconnect() {
    setOpened(false); // the link this page waited for is being taken down: stop waiting
    startChat(() => {
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
            <Button variant="primary" size="lg" fullWidth lang={locale} icon="bell" loading={pushBusy} onClick={handleEnablePush}>
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
              <Button variant="secondary" lang={locale} icon="bell" loading={pushBusy} onClick={handleSendTestNotification}>
                {t(copy.ambient.e5SendTestAction, locale)}
              </Button>
              <Button variant="quiet" lang={locale} loading={pushBusy} onClick={handleDisablePush}>
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
            <TelegramLinkForm from="notifications" locale={locale} simulated={simulated} onOpen={handleTelegramOpened} variant="secondary" size="lg" fullWidth icon="link">
              {t(copy.ambient.e5IosChatInsteadAction, locale)}
            </TelegramLinkForm>
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
            <TelegramLinkForm
              from="notifications"
              locale={locale}
              simulated={simulated}
              onOpen={handleTelegramOpened}
              variant={showDefault ? 'secondary' : 'primary'}
              size="lg"
              fullWidth
              icon="link"
            >
              {t(copy.ambient.e5OpenChatAction, locale)}
            </TelegramLinkForm>
          </div>
        )}

        {messaging.status === 'pending' && (
          <div className="flex flex-col gap-3" data-testid="chat-pending">
            <InlineNotice tone="info" title={t(copy.ambient.e5ChatWaitingTitle, locale)}>
              {t(confirmation.stopped ? copy.ambient.e5ChatStoppedChecking : copy.ambient.e5ChatWaitingBody, locale)}
            </InlineNotice>
            {/* The next step is the person's own: they pressed Start, so check. It follows the
                screen's one-primary rule exactly as "Open Telegram" does in the state before. */}
            <Button
              variant={showDefault ? 'secondary' : 'primary'}
              size="lg"
              fullWidth
              lang={locale}
              icon="refresh"
              loading={confirmation.checking}
              onClick={confirmation.checkNow}
            >
              {t(copy.ambient.e5ChatCheckAction, locale)}
            </Button>
            <TelegramLinkForm from="notifications" locale={locale} simulated={simulated} onOpen={handleTelegramOpened} variant="secondary" size="lg" fullWidth icon="link">
              {t(copy.ambient.e5ChatOpenAgainAction, locale)}
            </TelegramLinkForm>
            {confirmation.checked && (
              <p role="status" aria-live="polite" className="m-0 px-1 type-body-small text-ink-muted" data-testid="chat-still-waiting">
                {t(copy.ambient.e5ChatStillWaiting, locale)}
              </p>
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
              <Button variant="secondary" lang={locale} loading={chatBusy} onClick={handleSendTestMessage}>
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
            <TelegramLinkForm from="notifications" locale={locale} simulated={simulated} onOpen={handleTelegramOpened} variant="secondary" size="lg" fullWidth icon="link">
              {t(copy.vocabulary.retry, locale)}
            </TelegramLinkForm>
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
            <Button variant="danger" fullWidth lang={locale} loading={chatBusy} onClick={confirmDisconnect}>
              {t(copy.ambient.e5DisconnectConfirm, locale)}
            </Button>
            <Button variant="quiet" fullWidth lang={locale} onClick={() => setDisconnecting(false)} disabled={chatBusy}>
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
