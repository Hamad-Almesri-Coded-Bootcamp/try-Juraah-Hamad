/**
 * F2 — caregiver home, Medicines (docs/wireframes/CaregiverHome.dc.html; Daylight, CR-071): B2's own
 * composition, `features/day`'s `MedicinesList`, over the same data B2 loads for the linked patient
 * (`getPrescriptions`, `getAlerts`, `getSettings`, today's `getDosesForDay`), with the next dose
 * resolved exactly as B2 resolves it (against `kuwaitNow()`, rule 9). So the caregiver sees the
 * patient's medicines and never more (rule 8). Read-only (`readOnly`): no add-by-photo action, no
 * refill action; the cards open this shell's own prescription route and the lead alert opens the
 * read-only `/care/alerts/[id]` (audit C6). Opening is navigation; nothing here writes.
 */
import { MedicinesList, type NextDoseInfo } from '@/features/day/MedicinesList';
import { formatTodayDoseTimeLabel, pickNextOrMostRecent } from '@/features/day/format';
import { getAlerts, getCaregiverLink, getDosesForDay, getPrescriptions, getSettings } from '@/lib/data';
import { kuwaitNow } from '@/lib/config';
import { kuwaitToday } from '@/lib/schedule/dates';
import type { Locale } from '@/i18n/locale';

export async function CaregiverMedicines({ caregiverId, locale }: { caregiverId: string; locale: Locale }) {
  const link = await getCaregiverLink(caregiverId);
  const [prescriptions, alerts, settings, todaysDoses] = await Promise.all([
    getPrescriptions(link.patientId),
    getAlerts(link.patientId),
    getSettings(link.patientId),
    getDosesForDay(link.patientId, kuwaitToday()),
  ]);

  const nextDoseByPrescriptionId: Record<string, NextDoseInfo | undefined> = {};
  for (const rx of prescriptions) {
    if (rx.status !== 'active') continue;
    const dosesForRx = todaysDoses.filter((d) => d.prescriptionId === rx.id);
    const chosen = pickNextOrMostRecent(dosesForRx, kuwaitNow());
    if (chosen) nextDoseByPrescriptionId[rx.id] = { status: chosen.status, timeLabel: formatTodayDoseTimeLabel(chosen.scheduledAt, locale) };
  }

  return (
    <div className="p-3 tablet:p-5">
      <MedicinesList
        prescriptions={prescriptions}
        alerts={alerts}
        nextDoseByPrescriptionId={nextDoseByPrescriptionId}
        tracked={settings.adherenceCheckInEnabled}
        locale={locale}
        hrefBuilder={(rx) => `/${locale}/care/medicines/${rx.id}`}
        alertHrefBuilder={(alert) => `/${locale}/care/alerts/${alert.id}`}
        readOnly
      />
    </div>
  );
}
