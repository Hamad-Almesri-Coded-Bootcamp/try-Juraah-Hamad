/**
 * F2 — caregiver home, Today (docs/wireframes/CaregiverHome.dc.html, CaregiverPlan.dc.html). Reuses
 * B1's data AND its renderer: `features/day`'s `DoseDayList` (bundle c's cross-bundle contract,
 * DEPENDENCIES §1 — it landed mid-build, so this composes against it rather than the ui components
 * directly) with `readOnly`, and a `hrefBuilder` into this bundle's own `/care/medicines/[id]`
 * detail route — no interactive row beyond that single link (G1; CLAUDE.md rule 8).
 */
import { DoseDayList } from '@/features/day/DoseDayList';
import { IconButton } from '@/components/ui/IconButton';
import { getCaregiverLink, getDosesForDay, getSettings } from '@/lib/data';
import { addDays, kuwaitToday } from '@/lib/schedule/dates';
import { formatDayLabel } from '@/i18n/format';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { DoseWithPrescription } from '@/types/views';

export async function CaregiverToday({ caregiverId, locale, day }: { caregiverId: string; locale: Locale; day?: string }) {
  const link = await getCaregiverLink(caregiverId);
  const today = kuwaitToday();
  const isoDate = day ?? today;
  const [doses, settings] = await Promise.all([getDosesForDay(link.patientId, isoDate), getSettings(link.patientId)]);
  const prevDay = addDays(isoDate, -1);
  const nextDay = addDays(isoDate, 1);

  return (
    <div className="flex flex-col gap-3 p-3 tablet:p-5">
      <div className="flex items-center gap-2">
        <IconButton label={t(copy.caregiving.f2DayPrevLabel, locale)} icon="chevron" mirrorIcon href={`/${locale}/care?day=${prevDay}`} />
        <span className="type-body-strong" style={{ flexGrow: 1 }}>
          {formatDayLabel(isoDate, locale)}
        </span>
        {isoDate !== today && <IconButton label={t(copy.caregiving.f2DayTodayLabel, locale)} icon="calendar" href={`/${locale}/care`} />}
        <IconButton label={t(copy.caregiving.f2DayNextLabel, locale)} icon="chevron" href={`/${locale}/care?day=${nextDay}`} />
      </div>

      <DoseDayList
        doses={doses as DoseWithPrescription[]}
        tracked={settings.adherenceCheckInEnabled}
        locale={locale}
        hrefBuilder={(dose) => `/${locale}/care/medicines/${dose.prescriptionId}`}
        readOnly
      />

      <p className="type-caption" style={{ textAlign: 'center' }}>
        {t(copy.caregiving.f2NoWriteControlsNote, locale)}
      </p>
    </div>
  );
}
