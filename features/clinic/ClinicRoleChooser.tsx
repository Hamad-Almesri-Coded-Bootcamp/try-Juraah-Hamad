'use client';

/**
 * X0's role chooser (`/clinic/choose`) — two equally weighted Cards ("medical review" /
 * "system administration"), shown only for the one seeded Civil ID holding both clinic roles
 * (د. خالد, CR-005). Composed fresh rather than reusing `features/identity/RoleChooser` (identity
 * bundle's A1b): that component's labels and layout are patient/caregiver-specific ("my medicines" /
 * "<name>'s medicines") and it does not take a destination callback either — the same reuse gap
 * `ClinicSignInForm` reports for `SignInForm`.
 */
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { chooseRole } from '@/lib/session';
import { homePathFor } from '@/features/shell/tabs';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { RoleOption } from '@/types/views';

export function ClinicRoleChooser({ options, locale }: { options: RoleOption[]; locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const reviewerOption = options.find((o) => o.role === 'reviewer');
  const adminOption = options.find((o) => o.role === 'admin');

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
        <h1 className="type-h1">{t(copy.clinic.x0ChooserTitle, locale)}</h1>
        <p className="type-body">{t(copy.clinic.x0ChooserBody, locale)}</p>
      </div>

      {reviewerOption && (
        <Card className="flex flex-col gap-3">
          <span className="type-body-strong">{t(copy.clinic.x0ChooserReviewerTitle, locale)}</span>
          <span className="type-body-small">{t(copy.clinic.x0ChooserReviewerBody, locale)}</span>
          {/* Two equal options (UX §2; audit M2) — the board's primary is logged in CR-069(b). */}
          <Button variant="secondary" size="lg" fullWidth lang={locale} loading={pending} onClick={() => choose(reviewerOption)}>
            {t(copy.clinic.x0ChooserReviewerButton, locale)}
          </Button>
        </Card>
      )}

      {adminOption && (
        <Card className="flex flex-col gap-3">
          <span className="type-body-strong">{t(copy.clinic.x0ChooserAdminTitle, locale)}</span>
          <span className="type-body-small">{t(copy.clinic.x0ChooserAdminBody, locale)}</span>
          <Button variant="secondary" size="lg" fullWidth lang={locale} loading={pending} onClick={() => choose(adminOption)}>
            {t(copy.clinic.x0ChooserAdminButton, locale)}
          </Button>
        </Card>
      )}
    </div>
  );
}
