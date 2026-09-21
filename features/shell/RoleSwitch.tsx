'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { chooseRole } from '@/lib/session';
import { MenuRow } from '@/components/ui/MenuRow';
import { copy, t } from '@/i18n';
import { interpolate } from './interpolate';
import { homePathFor } from './tabs';
import type { Locale } from '@/i18n/locale';
import type { RoleOption } from '@/types/views';

function labelFor(option: RoleOption, locale: Locale): string {
  const prefix = t(copy.shell.roleSwitchPrefix, locale);
  const roleLabel =
    option.role === 'patient'
      ? t(copy.shell.roleSwitchPatientLabel, locale)
      : option.role === 'caregiver'
        ? interpolate(t(copy.shell.roleSwitchCaregiverLabelTemplate, locale), { name: option.patientFirstName ?? '' })
        : option.role === 'reviewer'
          ? t(copy.shell.roleSwitchReviewerLabel, locale)
          : t(copy.shell.roleSwitchAdminLabel, locale);
  return `${prefix} ${roleLabel}`;
}

/**
 * The in-shell switch between an ID's two active roles (A1b / ROLES.md): `chooseRole`, then
 * navigate to that role's own shell home. Never `signOut` — switching shells is a cross-fade, not a
 * session change (navigation.md). Motion stays a CSS concern (prefers-reduced-motion respected by
 * the base stylesheet's global rule); this component only performs the navigation.
 */
export function RoleSwitch({ option, locale }: { option: RoleOption; locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => {
      void (async () => {
        await chooseRole(option);
        router.push(homePathFor(option.role, locale));
      })();
    });
  };

  return <MenuRow label={labelFor(option, locale)} icon="link" onClick={pending ? undefined : handleClick} />;
}
