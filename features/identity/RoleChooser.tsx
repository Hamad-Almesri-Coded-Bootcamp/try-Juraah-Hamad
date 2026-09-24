'use client';

import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { chooseRole } from '@/lib/session';
import { homePathFor } from '@/features/shell/tabs';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { copy, t } from '@/i18n';
import { interpolate } from '@/features/shell/interpolate';
import { localizeFirstName, localizeRelationship } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';
import type { RoleOption } from '@/types/views';

/**
 * A1b — role chooser. Shown only for a Civil ID holding two ACTIVE roles (ROLES.md); a single-role
 * ID never reaches this screen (A0/`signIn` route it straight to its shell), and a pending
 * invitation is never one of `options` (`roleOptionsFor` never includes it — it is the quiet notice
 * on B1/More instead). `chooseRole` persists the choice as the session's role and is never a
 * sign-out (ROLES.md: "each shell offers the in-shell switch … and never signs out").
 *
 * Daylight (CR-071): a light bar with the wordmark (not a heading: the question is the one h1), then
 * two equal cards, the same shape, the same secondary button, side by side from 834px (UX §2, audit
 * M2). The patient's first name and the relationship they typed are shown in the reader's language.
 */
export function RoleChooser({ options, locale, actions }: { options: RoleOption[]; locale: Locale; actions?: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const patientOption = options.find((o) => o.role === 'patient');
  const caregiverOption = options.find((o) => o.role === 'caregiver');
  const patientName = localizeFirstName(caregiverOption?.patientFirstName ?? '', locale);

  function choose(option: RoleOption) {
    startTransition(() => {
      void (async () => {
        await chooseRole(option);
        router.push(homePathFor(option.role, locale));
      })();
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex min-h-hit-lg items-center gap-2 px-3 pt-2 tablet:px-5 tablet:pt-4">
        <span className="jr-wordmark flex-1">{t(copy.shell.appName, locale)}</span>
        {actions}
      </header>

      <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-3 pb-5 pt-5 tablet:px-5 tablet:pt-6">
        <div className="flex flex-col gap-2">
          <h1 className="type-h1 m-0 text-navy">{t(copy.identity.roleChooserTitle, locale)}</h1>
          <p className="type-body m-0 text-ink-muted">{t(copy.identity.roleChooserBody, locale)}</p>
        </div>

        <div className="grid gap-4 tablet:grid-cols-2">
          {patientOption && (
            <Card className="flex flex-col items-start gap-3 p-5">
              <span className="jr-fact__icon inline-flex items-center justify-center" aria-hidden="true">
                <Icon name="person" />
              </span>
              <h2 className="type-h2 m-0 text-navy">{t(copy.identity.roleChooserOwnTitle, locale)}</h2>
              <p className="type-body-small m-0 flex-1 text-ink-muted">{t(copy.identity.roleChooserOwnBody, locale)}</p>
              <Button variant="secondary" size="lg" fullWidth lang={locale} loading={pending} onClick={() => choose(patientOption)}>
                {t(copy.identity.roleChooserOwnButton, locale)}
              </Button>
            </Card>
          )}

          {caregiverOption && (
            <Card className="flex flex-col items-start gap-3 p-5">
              <span className="jr-fact__icon inline-flex items-center justify-center" aria-hidden="true">
                <Icon name="users" />
              </span>
              <h2 className="type-h2 m-0 text-navy">
                {interpolate(t(copy.identity.roleChooserCaregiverTitleTemplate, locale), { name: patientName })}
              </h2>
              {/* The relationship is the patient's own first-person word (the seed stores "my son"),
                  so it is quoted as theirs, never shown bare as if it described the reader (audit M4). */}
              <p className="type-body-small m-0 flex-1 text-ink-muted">
                {caregiverOption.relationship
                  ? interpolate(t(copy.identity.roleChooserRelationshipTemplate, locale), {
                      relationship: localizeRelationship(caregiverOption.relationship, locale),
                    })
                  : null}
              </p>
              <Button variant="secondary" size="lg" fullWidth lang={locale} loading={pending} onClick={() => choose(caregiverOption)}>
                {interpolate(t(copy.identity.roleChooserCaregiverButtonTemplate, locale), { name: patientName })}
              </Button>
            </Card>
          )}
        </div>

        <p className="type-body-small m-0 text-ink-muted">{t(copy.identity.roleChooserRememberNote, locale)}</p>
      </div>
    </div>
  );
}
