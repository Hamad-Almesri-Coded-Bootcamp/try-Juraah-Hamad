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
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { ClinicianCard } from './ClinicianCard';
import { copy, t } from '@/i18n';
import { interpolate } from '@/features/shell/interpolate';
import { formatNumber } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import type { ClinicianProfile, ReviewQueueItem } from '@/types/views';

export function ReviewerQueueShell({
  active,
  findingsCount,
  fieldsCount,
  locale,
  children,
  dashboard,
}: {
  active: 'findings' | 'fields';
  findingsCount: number;
  fieldsCount: number;
  locale: Locale;
  children: ReactNode;
  /** CR-115: the dashboard card. The findings queue and the profile, as the page already read them; the
   * counts are taken from these, never re-derived from a clock. Absent → no card (the G7 states). */
  dashboard?: { profile: ClinicianProfile | null; findings: ReviewQueueItem[] };
}) {
  const router = useRouter();

  function handleChange(value: string) {
    if (value === active) return;
    router.push(value === 'findings' ? `/${locale}/clinic/review` : `/${locale}/clinic/review/fields`);
  }

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar title={t(copy.clinic.reviewerQueuesTitle, locale)} action={<LanguageSwitch locale={locale} assistant={false} />} />
      {/* Aligned with the title at the reading edge, capped at the reading width (D-011). */}
      <div className="flex w-full max-w-content flex-col gap-5 px-3 pb-5 pt-2 tablet:px-5">
        {dashboard ? <ClinicianCard profile={dashboard.profile} activeRole="reviewer" stats={reviewerStats(dashboard, locale)} locale={locale} /> : null}
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

/** CR-115: the reviewer's counts. Waiting findings and the serious ones among them (the queue is
 * only `pending_medical_review` rows), and every decision this account has recorded (findings and
 * prescription details), which is the figure X1's "Doctor decisions" counts across all doctors. The
 * field queue's own count stays on the switch below, so the card never shows a second, different one. */
function reviewerStats(dashboard: NonNullable<Parameters<typeof ReviewerQueueShell>[0]['dashboard']>, locale: Locale) {
  const { profile, findings } = dashboard;
  const stats = [
    { id: 'findings-waiting', label: t(copy.clinic.dashStatFindingsWaiting, locale), value: findings.length },
    { id: 'serious', label: t(copy.clinic.dashStatSerious, locale), value: findings.filter((f) => f.severity === 'danger').length },
  ];
  if (profile) {
    const d = profile.decisions;
    stats.push({ id: 'recorded', label: t(copy.clinic.dashStatMyDecisions, locale), value: d.confirmed + d.cleared + d.fieldsConfirmed + d.fieldsReturned });
  }
  return stats;
}
