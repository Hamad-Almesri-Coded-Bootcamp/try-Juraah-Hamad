/**
 * F3 — caregiver detail access, interaction alert detail: C2's own content, read-only (SCREENS.md;
 * UX Principles §10). It renders the patient's `AlertDetail` with the same data C2 loads
 * (`getAlert`, then `getPrescription` for each involved id), so the band, the bridge of the two
 * prescriptions, the three steps in §8's order (the risk, what to do now, who is checking), the
 * reviewer's decision and the source read exactly as the patient reads them, and never more
 * (rule 8). The bridge cards open this shell's own read-only prescription route. `AlertDetail` has
 * no control at any severity, and both calls are reads: opening an alert never changes its state.
 * The source never prints the raw `TO_BE_SUPPLIED` marker; `AlertDetail` says it is unverified.
 */
import { notFound } from 'next/navigation';
import { AlertDetail } from '@/features/safety/AlertDetail';
import { getAlert, getPrescription } from '@/lib/data';
import type { Locale } from '@/i18n/locale';

export async function CaregiverAlertDetail({ alertId, locale }: { alertId: string; locale: Locale }) {
  // `getAlert` is session-scoped: null for an alert that is not this caregiver's patient's. C2 answers
  // that with the not-found page, and so does this screen.
  const alert = await getAlert(alertId);
  if (!alert) notFound();

  const prescriptions = (await Promise.all(alert.involvedPrescriptionIds.map((id) => getPrescription(id)))).filter(
    (rx): rx is NonNullable<typeof rx> => rx != null,
  );

  return (
    <div className="px-3 pb-5 pt-2 tablet:px-5">
      <AlertDetail
        audience="caregiver"
        alert={alert}
        prescriptions={prescriptions}
        locale={locale}
        prescriptionHrefBuilder={(rx) => `/${locale}/care/medicines/${rx.id}`}
      />
    </div>
  );
}
