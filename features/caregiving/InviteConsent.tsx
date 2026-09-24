'use client';

/**
 * F0 — the caregiver invitation consent screen's content (docs/wireframes/InviteConsent.dc.html,
 * InviteStates.dc.html; Daylight layout V2Consent, CR-071). No shell, no tab bar (the layout supplies
 * only the bar with the language switch). Before an explicit accept, this component's module graph
 * touches exactly the lib/data-adjacent functions the spec names — `getInvitationForConsent` (the
 * page), `acceptInvitation`, `declineInvitation` (here) — plus the session module's
 * `getSession`/`getRoleOptions` (a different module, not a lib/data function; see
 * tests/unit/caregiving/module-graph.test.ts). Nothing else is imported, so nothing else can be
 * loaded (CLAUDE.md rule 5; F0 non-negotiable invariant). Signing in is never consent: only the
 * Accept button below moves the invitation to `active`.
 */
import { useId, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Monogram } from '@/components/ui/Monogram';
import { acceptInvitation, declineInvitation } from '@/lib/data';
import { getRoleOptions } from '@/lib/session';
import { interpolate } from '@/features/shell/interpolate';
import { copy, t } from '@/i18n';
import { localizeFirstName, localizeRelationship } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';
import type { InvitationSummary } from '@/types/views';

type LocalState = 'pending' | 'accepted' | 'declined' | 'unavailable';

const CAN_SEE = ['f0CanSee1', 'f0CanSee2', 'f0CanSee3', 'f0CanSee4'] as const;
const CANNOT = ['f0Cannot1', 'f0Cannot2', 'f0Cannot3', 'f0Cannot4'] as const;

/** The reading column every state of this screen sits in. */
const COLUMN = 'mx-auto flex w-full max-w-content flex-col px-3 pb-6 pt-3 tablet:px-5 tablet:pt-5';

function initialState(status: InvitationSummary['status']): LocalState {
  if (status === 'pending') return 'pending';
  if (status === 'active') return 'accepted';
  if (status === 'declined') return 'declined';
  return 'unavailable'; // 'expired' | 'revoked': says so, offers no answer (CLAUDE.md rule 5)
}

/** An acknowledgement after the answer (or instead of it): plain, no pressure, nothing revealed. */
function Acknowledgement({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div className={`${COLUMN} items-center gap-4 text-center`}>
      <span className="mt-4 flex rounded-full bg-navy-tint p-3 text-navy">
        <Icon name={icon} />
      </span>
      <h1 className="type-h1">{title}</h1>
      {children}
    </div>
  );
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

  // One language per locale (CR-071): the stored first name and the patient's own word for the
  // relationship are shown in the reader's language.
  const name = localizeFirstName(invitation.patientFirstName, locale);
  const relationship = localizeRelationship(invitation.relationship, locale);
  const canSeeHeadingId = useId();
  const cannotHeadingId = useId();

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

  const backHome = (
    <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={() => router.push(homeHref)}>
      {t(copy.caregiving.f0BackHome, locale)}
    </Button>
  );

  if (error) {
    return (
      <div className={`${COLUMN} gap-4`}>
        <h1 className="type-h1">{t(copy.shell.errorTitle, locale)}</h1>
        <InlineNotice tone="warning">{t(copy.shell.errorBody, locale)}</InlineNotice>
        {backHome}
      </div>
    );
  }

  if (state === 'accepted') {
    return (
      <Acknowledgement icon="check" title={t(copy.caregiving.f0AcceptedTitle, locale)}>
        <p className="type-body text-ink-muted">{interpolate(t(copy.caregiving.f0AcceptedBodyTemplate, locale), { name })}</p>
        <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleOpenPatient}>
          {interpolate(t(copy.caregiving.f0AcceptedOpenTemplate, locale), { name })}
        </Button>
      </Acknowledgement>
    );
  }

  if (state === 'declined') {
    return (
      <Acknowledgement icon="shield" title={t(copy.caregiving.f0DeclinedTitle, locale)}>
        <p className="type-body text-ink-muted">{t(copy.caregiving.f0DeclinedBody, locale)}</p>
        {backHome}
      </Acknowledgement>
    );
  }

  if (state === 'unavailable') {
    return (
      <Acknowledgement icon="clock" title={t(copy.caregiving.f0UnavailableTitle, locale)}>
        <p className="type-body text-ink-muted">
          {t(copy.caregiving.f0UnavailableBody, locale)} {t(copy.caregiving.f0UnavailableRetry, locale)}
        </p>
        {backHome}
      </Acknowledgement>
    );
  }

  // 'pending': the consent question itself. Exactly the fields getInvitationForConsent returns and
  // nothing else (F0 non-negotiable invariant): a first name and the patient's word for the reader.
  return (
    <div className={`${COLUMN} gap-5`}>
      <div className="flex flex-col items-center gap-3 text-center">
        <Monogram name={name} size="lg" />
        <span className="type-label text-ink-muted">{t(copy.caregiving.f0Kicker, locale)}</span>
        <h1 className="type-h1">{interpolate(t(copy.caregiving.f0PendingTitleTemplate, locale), { name })}</h1>
        {/* Audit M4: the relationship is the PATIENT's own word, so it is quoted as theirs. */}
        <p className="type-body text-ink-muted">{interpolate(t(copy.caregiving.f0RelationshipTemplate, locale), { relationship })}</p>
      </div>

      {/* Audit M5: the two lists consent hinges on must not look alike. "You'll see" is a white
          grouped card whose rows carry the check glyph; "you will never" is a flat outlined panel
          whose rows carry the close glyph. Each list is named by its own heading; the glyphs are
          decorative (the words carry the meaning, UX §11). */}
      <section className="flex flex-col gap-2">
        <h2 id={canSeeHeadingId} className="jr-group-title">
          {t(copy.caregiving.f0CanSeeTitle, locale)}
        </h2>
        <ul aria-labelledby={canSeeHeadingId} className="jr-group flex flex-col divide-y divide-border">
          {CAN_SEE.map((key) => (
            <li key={key} className="flex items-center gap-3 px-3 py-3 type-body">
              <span className="flex flex-none rounded-full bg-navy-tint p-2 text-navy">
                <Icon name="check" small />
              </span>
              <span>{t(copy.caregiving[key], locale)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 id={cannotHeadingId} className="jr-group-title">
          {t(copy.caregiving.f0CannotTitle, locale)}
        </h2>
        <ul
          aria-labelledby={cannotHeadingId}
          className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface-app"
        >
          {CANNOT.map((key) => (
            <li key={key} className="flex items-center gap-3 px-3 py-3 type-body">
              <span className="flex flex-none rounded-full border border-border-strong p-2 text-navy">
                <Icon name="close" small />
              </span>
              <span>{t(copy.caregiving[key], locale)}</span>
            </li>
          ))}
        </ul>
      </section>

      <InlineNotice tone="info" title={t(copy.caregiving.f0WillBeToldTitle, locale)}>
        {t(copy.caregiving.f0WillBeToldBody, locale)}
      </InlineNotice>

      <div className="flex flex-col gap-3">
        {/* Equal weight: same variant, size and width, side by side (UX §2/§15, brand book; audit
            M2). Neither is the screen's primary; saying no is as easy as saying yes. */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleAccept} data-testid="f0-accept">
            {t(copy.caregiving.f0Accept, locale)}
          </Button>
          <Button variant="secondary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleDecline} data-testid="f0-decline">
            {t(copy.caregiving.f0Decline, locale)}
          </Button>
        </div>
        <p className="type-body-small text-center text-ink-muted">{t(copy.caregiving.f0EqualNote, locale)}</p>
      </div>
    </div>
  );
}
