'use client';

/**
 * F0 — the caregiver invitation consent screen's content (docs/wireframes/InviteConsent.dc.html,
 * InviteStates.dc.html). No shell, no tab bar (the layout supplies only the app bar + language
 * switch). Before an explicit accept, this component's module graph touches exactly four
 * lib/data-adjacent functions — `getInvitationForConsent` (the page), `acceptInvitation`,
 * `declineInvitation` (here) — plus the session module's `getSession`/`getRoleOptions` (a different
 * module, not a lib/data function; see tests/unit/caregiving/module-graph.test.ts). Nothing else is
 * imported, so nothing else can be loaded (CLAUDE.md rule 5; F0 non-negotiable invariant).
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { Icon } from '@/components/ui/Icon';
import { acceptInvitation, declineInvitation } from '@/lib/data';
import { getRoleOptions } from '@/lib/session';
import { interpolate } from '@/features/shell/interpolate';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { InvitationSummary } from '@/types/views';

type LocalState = 'pending' | 'accepted' | 'declined' | 'unavailable';

function initialState(status: InvitationSummary['status']): LocalState {
  if (status === 'pending') return 'pending';
  if (status === 'active') return 'accepted';
  if (status === 'declined') return 'declined';
  return 'unavailable'; // 'expired' | 'revoked' — says so, offers no action (CLAUDE.md rule 5)
}

export function InviteConsent({
  invitation,
  locale,
  homeHref,
}: {
  invitation: InvitationSummary;
  locale: Locale;
  /** Where "back to the home page" goes for THIS session: the public landing page for a
   * pending-invitation-only session, or the patient's own Today when an existing patient answered
   * the in-shell notice without signing out (F0 pass criterion: "returns to exactly where they were"). */
  homeHref: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<LocalState>(initialState(invitation.status));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const name = invitation.patientFirstName;

  function handleAccept() {
    setError(false);
    startTransition(() => {
      void (async () => {
        try {
          const session = await acceptInvitation(invitation.id);
          if (!session.role) {
            setError(true);
            return;
          }
          setState('accepted');
        } catch {
          setError(true);
        }
      })();
    });
  }

  function handleDecline() {
    setError(false);
    startTransition(() => {
      void (async () => {
        try {
          await declineInvitation(invitation.id);
          setState('declined');
        } catch {
          setError(true);
        }
      })();
    });
  }

  function handleOpenPatient() {
    startTransition(() => {
      void (async () => {
        const options = await getRoleOptions();
        const activeRoles = new Set(options.map((o) => o.role));
        router.push(activeRoles.size > 1 ? `/${locale}/signin/choose` : `/${locale}/care`);
      })();
    });
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <InlineNotice tone="warning" title={t(copy.shell.errorTitle, locale)}>
          {t(copy.shell.errorBody, locale)}
        </InlineNotice>
        <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={() => router.push(homeHref)}>
          {t(copy.caregiving.f0BackHome, locale)}
        </Button>
      </div>
    );
  }

  if (state === 'accepted') {
    return (
      <div className="flex flex-col items-center gap-3 p-3 text-center">
        <Icon name="check" className="type-h1" />
        <p className="type-body-strong">{t(copy.caregiving.f0AcceptedTitle, locale)}</p>
        <p className="type-body-small">{interpolate(t(copy.caregiving.f0AcceptedBodyTemplate, locale), { name })}</p>
        <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleOpenPatient}>
          {interpolate(t(copy.caregiving.f0AcceptedOpenTemplate, locale), { name })}
        </Button>
        <p className="type-caption">{t(copy.caregiving.f0AcceptedFootnote, locale)}</p>
      </div>
    );
  }

  if (state === 'declined') {
    return (
      <div className="flex flex-col gap-3 p-3">
        <p className="type-body-strong">{t(copy.caregiving.f0DeclinedTitle, locale)}</p>
        <p className="type-body">{t(copy.caregiving.f0DeclinedBody, locale)}</p>
        <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={() => router.push(homeHref)}>
          {t(copy.caregiving.f0BackHome, locale)}
        </Button>
        <p className="type-caption">{t(copy.caregiving.f0DeclinedFootnote, locale)}</p>
      </div>
    );
  }

  if (state === 'unavailable') {
    return (
      <div className="flex flex-col gap-3 p-3">
        <InlineNotice tone="info" title={t(copy.caregiving.f0UnavailableTitle, locale)}>
          {t(copy.caregiving.f0UnavailableBody, locale)}
        </InlineNotice>
        <p className="type-body-small">{t(copy.caregiving.f0UnavailableRetry, locale)}</p>
        <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={() => router.push(homeHref)}>
          {t(copy.caregiving.f0BackHome, locale)}
        </Button>
        <p className="type-caption">{t(copy.caregiving.f0UnavailableFootnote, locale)}</p>
      </div>
    );
  }

  // 'pending' — the consent question itself. Exactly the five fields getInvitationForConsent
  // returns and nothing else (F0 non-negotiable invariant).
  return (
    <div className="flex flex-col gap-3 p-3">
      <span className="type-caption">{t(copy.caregiving.f0Kicker, locale)}</span>
      <h1 className="type-h1">{interpolate(t(copy.caregiving.f0PendingTitleTemplate, locale), { name })}</h1>
      <p className="type-body">{interpolate(t(copy.caregiving.f0RelationshipTemplate, locale), { relationship: invitation.relationship })}</p>

      <Card>
        <p className="type-body-strong">{t(copy.caregiving.f0CanSeeTitle, locale)}</p>
        <p className="type-body">{t(copy.caregiving.f0CanSee1, locale)}</p>
        <p className="type-body">{t(copy.caregiving.f0CanSee2, locale)}</p>
        <p className="type-body">{t(copy.caregiving.f0CanSee3, locale)}</p>
        <p className="type-body">{t(copy.caregiving.f0CanSee4, locale)}</p>
      </Card>

      <Card>
        <p className="type-body-strong">{t(copy.caregiving.f0CannotTitle, locale)}</p>
        <p className="type-body">{t(copy.caregiving.f0Cannot1, locale)}</p>
        <p className="type-body">{t(copy.caregiving.f0Cannot2, locale)}</p>
        <p className="type-body">{t(copy.caregiving.f0Cannot3, locale)}</p>
        <p className="type-body">{t(copy.caregiving.f0Cannot4, locale)}</p>
      </Card>

      <InlineNotice tone="info" title={t(copy.caregiving.f0WillBeToldTitle, locale)}>
        {t(copy.caregiving.f0WillBeToldBody, locale)}
      </InlineNotice>

      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleAccept} data-testid="f0-accept">
          {t(copy.caregiving.f0Accept, locale)}
        </Button>
        <Button variant="secondary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleDecline} data-testid="f0-decline">
          {t(copy.caregiving.f0Decline, locale)}
        </Button>
      </div>
      <p className="type-caption" style={{ textAlign: 'center' }}>
        {t(copy.caregiving.f0EqualNote, locale)}
      </p>
    </div>
  );
}
