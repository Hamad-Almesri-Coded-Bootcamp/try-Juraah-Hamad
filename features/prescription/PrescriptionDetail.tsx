/**
 * B3 — prescription detail (`/[locale]/app/medicines/[prescriptionId]`), the patient's own read-only
 * view: every `Prescription` contract field including the dispensing block, the remaining supply only with a
 * dispensing record, the windowed dose history and the one patient action this screen owns, a
 * secondary Button into D1 (refill) carrying this rx in `?rx=`.
 *
 * This file loads; `./PrescriptionDetailView` draws (Daylight, CR-071). The caregiver's F3 is this
 * screen minus its action (UX §10) and can render the same view with `refillHref={null}` and its own
 * read-only alert route, so the two read the same labels (`copy.prescription.*`), the same
 * formatters (`./format`) and the same windowed history, and cannot drift apart again (audit M10).
 * Nothing here can create or change a `Dose.status` (G1).
 */
import { EmptyState } from '@/components/ui/EmptyState';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { standingDangerAlerts } from '@/features/day/TodayView';
import { getAlerts, getDoseHistory, getPrescription, getPrescriptions, getSettings } from '@/lib/data';
import { kuwaitNow } from '@/lib/config';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { Prescription } from '@/types/contracts';
import { PrescriptionDetailView, type PrescriptionDetailInteraction } from './PrescriptionDetailView';

/** The standing danger finding (pending, or confirmed by the reviewer) this prescription is part
 * of, with the generic names of every prescription it involves — or null. Shared with F3. */
export async function interactionFor(
  rx: Prescription,
  alertHref: (alertId: string) => string,
): Promise<PrescriptionDetailInteraction | null> {
  const [alerts, prescriptions] = await Promise.all([getAlerts(rx.patientId), getPrescriptions(rx.patientId)]);
  const alert = standingDangerAlerts(alerts).find((a) => a.involvedPrescriptionIds.includes(rx.id));
  if (!alert) return null;
  const nameById = new Map(prescriptions.map((p) => [p.id, p.drug.genericName] as const));
  return {
    severity: alert.severity,
    reviewStatus: alert.reviewStatus,
    drugs: alert.involvedPrescriptionIds.map((id) => nameById.get(id) ?? '').filter(Boolean),
    href: alertHref(alert.id),
  };
}

export async function PrescriptionDetail({
  prescriptionId,
  locale,
  emptyBackHref,
}: {
  prescriptionId: string;
  locale: Locale;
  emptyBackHref: string;
}) {
  const rx = await getPrescription(prescriptionId);
  if (!rx) {
    // G7's empty state for a detail route: a prescription id that does not exist, or exists for a
    // different patient (getPrescription's own session check already returned null either way — it
    // never distinguishes the two to this screen, and this screen does not either).
    return (
      <div className="p-3 tablet:p-5">
        <EmptyState
          icon="capsule"
          title={t(copy.prescription.b3EmptyTitle, locale)}
          description={t(copy.prescription.b3EmptyDescription, locale)}
          action={
            <NavigateButton href={emptyBackHref} variant="secondary" lang={locale}>
              {t(copy.prescription.b3EmptyAction, locale)}
            </NavigateButton>
          }
        />
      </div>
    );
  }

  const [history, settings, interaction] = await Promise.all([
    getDoseHistory(prescriptionId),
    getSettings(rx.patientId),
    interactionFor(rx, (id) => `/${locale}/app/safety/${id}`),
  ]);

  return (
    <PrescriptionDetailView
      rx={rx}
      history={history}
      nowIso={kuwaitNow()}
      locale={locale}
      interaction={interaction}
      refillHref={rx.status === 'active' ? `/${locale}/app/more/refill?rx=${rx.id}` : null}
      // The note keys off Settings.adherenceCheckInEnabled, never off any dose's status word (rule
      // 3); each row's own pill still keys off that dose's own `tracked`.
      trackingOffNote={
        !settings.adherenceCheckInEnabled ? (
          <p className="type-body-small m-0 px-1 text-ink-muted">{t(copy.prescription.doseHistoryTrackingOffNote, locale)}</p>
        ) : null
      }
    />
  );
}
