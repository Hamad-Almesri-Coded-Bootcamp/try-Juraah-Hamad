import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SkyHeader } from '@/components/ui/SkyHeader';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

/**
 * X0's frame (Daylight, CR-071): the clinic entry and the role chooser share it. On a phone the navy
 * sky carries the screen's one h1, the language switch and the plain statement that the role is
 * simulated in this academic build; the sheet under it holds the form or the two choices. From 834px
 * the sky becomes a panel beside the form, so a reviewer at a desk sees both at once.
 *
 * Outside the clinic shell (the layout renders no chrome until a role resolves), with no assistant
 * (CR-069(k)). Server-compatible: no hooks.
 */
export function ClinicEntryFrame({
  locale,
  title,
  subtitle,
  showRoles = false,
  children,
}: {
  locale: Locale;
  title: ReactNode;
  subtitle?: ReactNode;
  /** The entry names what is behind it (the two clinic roles), in the panel from 834px only: on a
   * phone the form comes first and the chooser says it again after sign-in. */
  showRoles?: boolean;
  children: ReactNode;
}) {
  const role = (icon: IconName, name: string, body: string) => (
    <li className="flex items-start gap-3">
      <Icon name={icon} className="jr-fact__icon shrink-0 bg-[var(--glass)] text-on-fill" />
      <span className="flex flex-col">
        <span className="type-body-strong text-on-fill">{name}</span>
        <span className="type-body-small text-[var(--on-sky-muted)]">{body}</span>
      </span>
    </li>
  );

  return (
    <main className="flex min-h-dvh flex-col tablet:grid tablet:grid-cols-2">
      <SkyHeader
        eyebrow={t(copy.shell.clinicWordmark, locale)}
        title={title}
        subtitle={subtitle}
        actions={<LanguageSwitch locale={locale} assistant={false} />}
        className="tablet:m-4 tablet:justify-between tablet:p-6"
      >
        {showRoles ? (
          <ul className="hidden flex-col gap-4 tablet:flex">
            {role('review', t(copy.clinic.x0ChooserReviewerTitle, locale), t(copy.clinic.x0ChooserReviewerBody, locale))}
            {role('settings', t(copy.clinic.x0ChooserAdminTitle, locale), t(copy.clinic.x0ChooserAdminBody, locale))}
          </ul>
        ) : null}
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-[var(--glass-line)] bg-[var(--glass)] px-3 py-1 text-on-fill">
          <Icon name="shield" small />
          <span className="type-body-small">{t(copy.clinic.x0Kicker, locale)}</span>
        </span>
      </SkyHeader>
      <div className="jr-sheet flex flex-1 flex-col px-3 pb-6 pt-5 tablet:justify-center tablet:px-6">
        <div className="mx-auto flex w-full max-w-[calc(var(--content-max)/2)] flex-col gap-5">{children}</div>
      </div>
    </main>
  );
}
