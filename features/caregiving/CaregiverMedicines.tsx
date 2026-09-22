/**
 * F2 — caregiver home, Medicines (docs/wireframes/CaregiverHome.dc.html). Reuses B2's data AND its
 * renderer: `features/day`'s `MedicinesList` (bundle c's cross-bundle contract, DEPENDENCIES §1 — it
 * landed mid-build) with `readOnly` and a `hrefBuilder` into this bundle's own prescription detail
 * route. No add/scan action, no refill action — read-only throughout (G1; CLAUDE.md rule 8).
 */
import { MedicinesList, type NextDoseInfo } from '@/features/day/MedicinesList';
import { formatTodayDoseTimeLabel, pickNextOrMostRecent } from '@/features/day/format';
import { getAlerts, getCaregiverLink, getDosesForDay, getPrescriptions, getSettings } from '@/lib/data';
import { REFERENCE_DATE } from '@/lib/schedule/dates';
import type { Locale } from '@/i18n/locale';

export async function CaregiverMedicines({ caregiverId, locale }: { caregiverId: string; locale: Locale }) {
  const link = await getCaregiverLink(caregiverId);
  const [prescriptions, alerts, todayDoses, settings] = await Promise.all([
    getPrescriptions(link.patientId),
    getAlerts(link.patientId),
    getDosesForDay(link.patientId, REFERENCE_DATE),
    getSettings(link.patientId),
  ]);

  const nextDoseByPrescriptionId: Record<string, NextDoseInfo | undefined> = {};
  for (const rx of prescriptions) {
    const dosesForRx = todayDoses.filter((d) => d.prescriptionId === rx.id);
    const pick = pickNextOrMostRecent(dosesForRx, `${REFERENCE_DATE}T23:59:59+03:00`);
    if (pick) nextDoseByPrescriptionId[rx.id] = { status: pick.status, timeLabel: formatTodayDoseTimeLabel(pick.scheduledAt, locale) };
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
        readOnly
      />
    </div>
  );
}
