'use client';

/**
 * F4 — caregiver profile & notifications (docs/wireframes/CaregiverProfile.dc.html). Own name in
 * full (a person's own name is never masked) · no Civil ID row (CLAUDE.md rule 6 / CR-001 strict
 * default — CR-026 is still open, but the stricter reading is what CR-001 resolved to) · the linked
 * patient and since when · own browser-notification/chat state, scoped to `subjectType: 'caregiver'`
 * · unlink myself (Sheet-confirmed) · sign out. No `Settings` row exists here (CLAUDE.md rule 8).
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { MenuRow } from '@/components/ui/MenuRow';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { SignOutButton } from '@/features/shell/SignOutButton';
import { disablePush, disconnectMessaging, requestPushPermission, selfUnlink, startMessagingLink } from '@/lib/data';
import { formatDate } from '@/i18n/format';
import { interpolate } from '@/features/shell/interpolate';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { MessagingLink, PushSubscription } from '@/types/contracts';

const PUSH_LABEL_KEY = {
  default: 'f4PushDefault',
  granted: 'f4PushGranted',
  denied: 'f4PushDenied',
  unsupported: 'f4PushUnsupported',
} as const satisfies Record<PushSubscription['permission'], keyof typeof copy.caregiving>;

const CHAT_LABEL_KEY = {
  not_connected: 'f4ChatNotConnected',
  pending: 'f4ChatPending',
  connected: 'f4ChatConnectedAlertsOnly',
  expired: 'f4ChatExpired',
} as const satisfies Record<MessagingLink['status'], keyof typeof copy.caregiving>;

export function CaregiverProfile({
  caregiverId,
  patientFirstName,
  acceptedAt,
  pushCapabilitySupported,
  push,
  messaging,
  locale,
}: {
  caregiverId: string;
  patientFirstName: string;
  acceptedAt: string;
  pushCapabilitySupported: boolean;
  push: PushSubscription | null;
  messaging: MessagingLink;
  locale: Locale;
}) {
  const router = useRouter();
  const [unlinking, setUnlinking] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [pending, startTransition] = useTransition();

  const subject = { subjectType: 'caregiver' as const, subjectId: caregiverId };
  const permission = push?.permission ?? (pushCapabilitySupported ? 'default' : 'unsupported');
  const pushOn = permission === 'granted';

  function togglePush() {
    startTransition(() => {
      void (async () => {
        if (pushOn) await disablePush(subject);
        else await requestPushPermission(subject);
        router.refresh();
      })();
    });
  }

  function connectChat() {
    startTransition(() => {
      void (async () => {
        await startMessagingLink(subject);
        router.refresh();
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

  function confirmUnlink() {
    startTransition(() => {
      void (async () => {
        await selfUnlink(caregiverId);
        setUnlinking(false);
        router.push(`/${locale}`);
      })();
    });
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <Card>
        <span className="type-body-strong">{t(copy.caregiving.f4IdentityVerifiedLine, locale)}</span>
        <span className="type-body-small">
          {interpolate(t(copy.caregiving.f4LinkedSinceTemplate, locale), {
            name: patientFirstName,
            date: acceptedAt ? formatDate(acceptedAt.slice(0, 10), locale) : '',
          })}
        </span>
      </Card>

      <span className="type-h2">{t(copy.caregiving.f4NotificationsTitle, locale)}</span>
      <MenuRow
        label={t(copy.caregiving.f4BrowserNotifRow, locale)}
        value={t(copy.caregiving[PUSH_LABEL_KEY[permission]], locale)}
        tone="relationship"
        trailing={
          permission === 'unsupported' ? undefined : (
            <Button variant={pushOn ? 'quiet' : 'secondary'} loading={pending} onClick={togglePush}>
              {t(copy.caregiving[pushOn ? 'f4PushDisableAction' : 'f4PushEnableAction'], locale)}
            </Button>
          )
        }
      />
      <MenuRow
        label={t(copy.caregiving.f4ChatRow, locale)}
        value={t(copy.caregiving[CHAT_LABEL_KEY[messaging.status]], locale)}
        tone="relationship"
        trailing={
          messaging.status === 'connected' ? (
            <Button variant="quiet" onClick={() => setDisconnecting(true)}>
              {t(copy.caregiving.f4ChatDisconnectAction, locale)}
            </Button>
          ) : messaging.status === 'pending' ? undefined : (
            <Button variant="secondary" loading={pending} onClick={connectChat}>
              {t(copy.caregiving.f4ChatConnectAction, locale)}
            </Button>
          )
        }
      />
      <InlineNotice tone="info" title={t(copy.caregiving.f4AlertsOnlyNote, locale)} />

      <span className="type-h2">{t(copy.caregiving.f4AccessTitle, locale)}</span>
      <MenuRow label={t(copy.caregiving.f4LinkedPatientLabel, locale)} value={patientFirstName} />
      <Button variant="secondary" size="lg" fullWidth lang={locale} icon="trash" onClick={() => setUnlinking(true)}>
        {t(copy.caregiving.f4UnlinkAction, locale)}
      </Button>
      <SignOutButton locale={locale} variant="quiet" fullWidth />

      <p className="type-caption">{t(copy.caregiving.f4NoSettingsNote, locale)}</p>

      <Sheet
        open={unlinking}
        title={t(copy.caregiving.f4UnlinkSheetTitle, locale)}
        onClose={() => setUnlinking(false)}
        closeLabel={t(copy.caregiving.f1CloseSheetLabel, locale)}
        footer={
          <>
            <Button variant="danger" fullWidth lang={locale} loading={pending} onClick={confirmUnlink}>
              {t(copy.caregiving.f4UnlinkConfirm, locale)}
            </Button>
            <Button variant="quiet" fullWidth lang={locale} onClick={() => setUnlinking(false)} disabled={pending}>
              {t(copy.caregiving.f1SheetDismiss, locale)}
            </Button>
          </>
        }
      >
        <p className="type-body">{t(copy.caregiving.f4UnlinkSheetBody, locale)}</p>
      </Sheet>

      <Sheet
        open={disconnecting}
        title={t(copy.caregiving.f4DisconnectSheetTitle, locale)}
        onClose={() => setDisconnecting(false)}
        closeLabel={t(copy.caregiving.f1CloseSheetLabel, locale)}
        footer={
          <>
            <Button variant="danger" fullWidth lang={locale} loading={pending} onClick={confirmDisconnect}>
              {t(copy.caregiving.f4DisconnectSheetTitle, locale)}
            </Button>
            <Button variant="quiet" fullWidth lang={locale} onClick={() => setDisconnecting(false)} disabled={pending}>
              {t(copy.caregiving.f1SheetDismiss, locale)}
            </Button>
          </>
        }
      >
        <p className="type-body">{t(copy.caregiving.f4DisconnectSheetBody, locale)}</p>
      </Sheet>
    </div>
  );
}
