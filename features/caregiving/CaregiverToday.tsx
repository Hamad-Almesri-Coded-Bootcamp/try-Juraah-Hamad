/**
 * F2 — caregiver home, Today (docs/wireframes/CaregiverHome.dc.html, CaregiverPlan.dc.html; Daylight
 * layout V2Caregiver, CR-071). The patient's Today and this screen are ONE composition,
 * `features/day`'s `TodayView`, fed the same data (`getDosesForDay`, `getSettings`, `getAlerts`,
 * `getPrescriptions` for the linked patient), so the caregiver sees exactly the patient's day and
 * never more (rule 8): the sky with the week strip and the day dial, a standing danger finding
 * pointed to (CR-069(g)), the day in parts. Read-only by construction (`readOnly`, no settings link,
 * no empty-state action): every affordance is a real link, into this shell's own read-only routes.
 * Write controls are absent, not disabled.
 */
import type { ReactNode } from 'react';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { TodayView, standingDangerAlerts } from '@/features/day/TodayView';
import { interpolate } from '@/features/shell/interpolate';
import { getAlerts, getCaregiverLink, getDosesForDay, getPrescriptions, getSettings } from '@/lib/data';
import { kuwaitNow } from '@/lib/config';
import { kuwaitToday } from '@/lib/schedule/dates';
import { copy, t } from '@/i18n';
import { localizeFirstName } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function CaregiverToday({
  caregiverId,
  locale,
  day,
  actions,
}: {
  caregiverId: string;
  locale: Locale;
  /** `?day=YYYY-MM-DD`; absent or malformed means today (Kuwait clock, rule 9). */
  day?: string;
  /** The bar's actions (the assistant and the language switch), supplied by the page. */
  actions?: ReactNode;
}) {
  const link = await getCaregiverLink(caregiverId);
  const today = kuwaitToday();
  const nowIso = kuwaitNow();
  const isoDate = day && ISO_DATE.test(day) ? day : today;
  const [doses, settings, prescriptions, alerts] = await Promise.all([
    getDosesForDay(link.patientId, isoDate),
    getSettings(link.patientId),
    getPrescriptions(link.patientId),
    getAlerts(link.patientId),
  ]);

  const baseHref = `/${locale}/care`;
  const name = localizeFirstName(link.patientFirstName, locale);
  const drugNameById = new Map(prescriptions.map((p) => [p.id, p.drug.genericName] as const));

  return (
    <TodayView
      locale={locale}
      title={t(copy.shell.careTabToday, locale)}
      eyebrow={interpolate(t(copy.caregiving.f2DayOfTemplate, locale), { name })}
      actions={actions}
      isoDate={isoDate}
      today={today}
      nowIso={nowIso}
      dayHref={(iso) => (iso === today ? baseHref : `${baseHref}?day=${iso}`)}
      homeHref={baseHref}
      doses={doses}
      tracked={settings.adherenceCheckInEnabled}
      hrefBuilder={(dose) => `/${locale}/care/medicines/${dose.prescriptionId}`}
      // The same pointer the patient's Today shows for a danger finding that still stands, opening
      // the caregiver's read-only alert. A navigation, never a write (rule 8).
      alerts={standingDangerAlerts(alerts).map((a) => ({
        id: a.id,
        severity: a.severity,
        reviewStatus: a.reviewStatus,
        drugs: a.involvedPrescriptionIds.map((id) => drugNameById.get(id) ?? '').filter(Boolean),
        href: `/${locale}/care/alerts/${a.id}`,
      }))}
      // An empty day reads as it does for the patient: the same plan, the same explanation (UX §10).
      readOnly
      // The same fact as the patient's own line (UX §10), in the caregiver's voice, naming the
      // patient, with no action: the patient's line ("turn it on") is written to the patient. Each
      // row's pill still keys off that dose's own `tracked` (rule 3), never this setting.
      trackingOffNotice={
        <InlineNotice title={interpolate(t(copy.caregiving.f2TrackingOffNoticeTitleTemplate, locale), { name })}>
          {interpolate(t(copy.caregiving.f2TrackingOffNoticeBodyTemplate, locale), { name })}
        </InlineNotice>
      }
    />
  );
}
