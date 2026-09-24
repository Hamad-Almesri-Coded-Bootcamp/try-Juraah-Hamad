'use client';

/**
 * X0's role chooser (`/clinic/choose`) — two equally weighted choices ("medical review" /
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
import { Icon, type IconName } from '@/components/ui/Icon';
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

  // The frame's sky carries the h1 ("Choose your role") and why there are two; these are the choices.
  // Two equal options (UX §2; audit M2), drawn the same: same card, same icon disc, same secondary
  // button. The board's primary is logged in CR-069(b).
  const choice = (option: RoleOption, icon: IconName, title: string, body: string, button: string) => (
    <section className="jr-group flex flex-col gap-3 p-4" aria-label={title}>
      <Icon name={icon} className="jr-fact__icon" />
      <div className="flex flex-col gap-1">
        <h2 className="type-h2">{title}</h2>
        <p className="type-body text-ink-muted">{body}</p>
      </div>
      <Button variant="secondary" size="lg" fullWidth lang={locale} loading={pending} onClick={() => choose(option)}>
        {button}
      </Button>
    </section>
  );

  return (
    <div className="flex flex-col gap-4">
      {reviewerOption &&
        choice(
          reviewerOption,
          'review',
          t(copy.clinic.x0ChooserReviewerTitle, locale),
          t(copy.clinic.x0ChooserReviewerBody, locale),
          t(copy.clinic.x0ChooserReviewerButton, locale),
        )}
      {adminOption &&
        choice(
          adminOption,
          'settings',
          t(copy.clinic.x0ChooserAdminTitle, locale),
          t(copy.clinic.x0ChooserAdminBody, locale),
          t(copy.clinic.x0ChooserAdminButton, locale),
        )}
    </div>
  );
}
