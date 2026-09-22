'use client';

/**
 * The shared header for G1s (`/clinic/review`) and G3s (`/clinic/review/fields`): one `AppBar` and
 * one segmented `ChoiceGroup` switching "in place" between the two reviewer queues (SCREENS.md).
 * The two screens are separate routes (so each is independently linkable, testable and gated by
 * `requireRole`), but sharing this one header component — and navigating between them with
 * `router.push` rather than a full reload — is what makes the switch read as in-place rather than as
 * leaving the screen. The clinic shell's own chrome (the simulated-role banner, the TabBar) is
 * `ClinicNav`'s (features/shell), rendered by the layout around this component, not duplicated here.
 */
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppBar } from '@/components/ui/AppBar';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { copy, t } from '@/i18n';
import { interpolate } from '@/features/shell/interpolate';
import { formatNumber } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';

export function ReviewerQueueShell({
  active,
  findingsCount,
  fieldsCount,
  locale,
  children,
}: {
  active: 'findings' | 'fields';
  findingsCount: number;
  fieldsCount: number;
  locale: Locale;
  children: ReactNode;
}) {
  const router = useRouter();

  function handleChange(value: string) {
    if (value === active) return;
    router.push(value === 'findings' ? `/${locale}/clinic/review` : `/${locale}/clinic/review/fields`);
  }

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar title={t(copy.clinic.reviewerQueuesTitle, locale)} />
      <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-3 tablet:p-5">
        <ChoiceGroup
          variant="segmented"
          name="reviewer-queue-switch"
          label={t(copy.clinic.queueSwitchLabel, locale)}
          value={active}
          onChange={handleChange}
          options={[
            { value: 'findings', label: interpolate(t(copy.clinic.findingsOptionTemplate, locale), { count: formatNumber(findingsCount, locale) }) },
            { value: 'fields', label: interpolate(t(copy.clinic.fieldsOptionTemplate, locale), { count: formatNumber(fieldsCount, locale) }) },
          ]}
        />
        {children}
      </div>
    </div>
  );
}
