'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { chooseRole } from '@/lib/session';
import { homePathFor } from '@/features/shell/tabs';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { copy, t } from '@/i18n';
import { interpolate } from '@/features/shell/interpolate';
import type { Locale } from '@/i18n/locale';
import type { RoleOption } from '@/types/views';

/**
 * A1b — role chooser. Shown only for a Civil ID holding two ACTIVE roles (ROLES.md); a single-role
 * ID never reaches this screen (A0/`signIn` route it straight to its shell), and a pending
 * invitation is never one of `options` (`roleOptionsFor` never includes it — it is the quiet notice
 * on B1/More instead). Two equally weighted Cards (§2 UX Principles); `chooseRole` persists the
 * choice as the session's role and is never a sign-out (ROLES.md: "each shell offers the in-shell
 * switch … and never signs out").
 */
export function RoleChooser({ options, locale }: { options: RoleOption[]; locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const patientOption = options.find((o) => o.role === 'patient');
  const caregiverOption = options.find((o) => o.role === 'caregiver');

  function choose(option: RoleOption) {
    startTransition(() => {
      void (async () => {
        await chooseRole(option);
        router.push(homePathFor(option.role, locale));
      })();
    });
  }

  return (
    <div className="mx-auto flex max-w-content flex-col gap-4 p-3 tablet:p-5">
      <div className="flex flex-col gap-2">
        <h1 className="type-h1">{t(copy.identity.roleChooserTitle, locale)}</h1>
        <p className="type-body">{t(copy.identity.roleChooserBody, locale)}</p>
      </div>

      {patientOption && (
        <Card className="flex flex-col gap-3">
          <span className="type-body-strong">{t(copy.identity.roleChooserOwnTitle, locale)}</span>
          <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={() => choose(patientOption)}>
            {t(copy.identity.roleChooserOwnButton, locale)}
          </Button>
        </Card>
      )}

      {caregiverOption && (
        <Card className="flex flex-col gap-3">
          <span className="type-body-strong">
            {interpolate(t(copy.identity.roleChooserCaregiverTitleTemplate, locale), { name: caregiverOption.patientFirstName ?? '' })}
          </span>
          {caregiverOption.relationship && <span className="type-body-small">{caregiverOption.relationship}</span>}
          <Button variant="secondary" size="lg" fullWidth lang={locale} loading={pending} onClick={() => choose(caregiverOption)}>
            {interpolate(t(copy.identity.roleChooserCaregiverButtonTemplate, locale), { name: caregiverOption.patientFirstName ?? '' })}
          </Button>
        </Card>
      )}

      <span className="type-caption">{t(copy.identity.roleChooserRememberNote, locale)}</span>
    </div>
  );
}
