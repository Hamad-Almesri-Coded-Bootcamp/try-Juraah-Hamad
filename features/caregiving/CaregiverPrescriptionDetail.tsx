/**
 * F3 — caregiver detail access, prescription detail: B3 minus every action (SCREENS.md; UX
 * Principles §10, "identical to the patient's view minus actions"). It renders B3's own view,
 * `PrescriptionDetailView`, with the same data B3 loads (`getPrescription`, `getDoseHistory`,
 * `getSettings`, and B3's `interactionFor`), so one field never has two names across the two shells
 * (audit M10) and the caregiver never sees more than the patient (rule 8). The differences are the
 * absences and the routes: no refill action (`refillHref={null}`), the interaction row opens this
 * shell's read-only alert, and the tracking-off line speaks about the patient rather than to them.
 * Nothing here can create or change a `Dose.status` (G1); the only buttons disclose more history.
 */
import { EmptyState } from '@/components/ui/EmptyState';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { interactionFor } from '@/features/prescription/PrescriptionDetail';
import { PrescriptionDetailView } from '@/features/prescription/PrescriptionDetailView';
import { getDoseHistory, getPrescription, getSettings } from '@/lib/data';
import { kuwaitNow } from '@/lib/config';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

export async function CaregiverPrescriptionDetail({ prescriptionId, locale }: { prescriptionId: string; locale: Locale }) {
  const rx = await getPrescription(prescriptionId);
  if (!rx) {
    // B3's own empty state: an id that does not exist, or is not this caregiver's patient's
    // (getPrescription's session check returns null either way, and this screen never tells which).
    return (
      <div className="p-3 tablet:p-5">
        <EmptyState
          icon="capsule"
          title={t(copy.prescription.b3EmptyTitle, locale)}
          description={t(copy.prescription.b3EmptyDescription, locale)}
          action={
            <NavigateButton href={`/${locale}/care/medicines`} variant="secondary" lang={locale}>
              {t(copy.caregiving.f3EmptyBackAction, locale)}
            </NavigateButton>
          }
        />
      </div>
    );
  }

  const [history, settings, interaction] = await Promise.all([
    getDoseHistory(prescriptionId),
    getSettings(rx.patientId),
    interactionFor(rx, (id) => `/${locale}/care/alerts/${id}`),
  ]);

  return (
    <PrescriptionDetailView
      rx={rx}
      history={history}
      nowIso={kuwaitNow()}
      locale={locale}
      interaction={interaction}
      refillHref={null}
      // Keys off Settings.adherenceCheckInEnabled, never a status word (rule 3); in the caregiver's
      // voice, about the patient, with no action (UX §10, rule 8).
      trackingOffNote={
        !settings.adherenceCheckInEnabled ? (
          <p className="type-body-small m-0 px-1 text-ink-muted">{t(copy.caregiving.f3DoseHistoryTrackingOffNote, locale)}</p>
        ) : null
      }
    />
  );
}
