/**
 * F3 — caregiver detail access, interaction alert detail (C2's content; opening never changes state
 * — SCREENS.md). The three-part safety shape (UX Principles §8) for a `danger` finding still
 * `pending_medical_review`: what the risk is (InteractionAlert's own description); what to do
 * immediately (this bundle's fixed copy, since the seed's description field holds only the risk
 * sentence); who is checking it (InteractionAlert's built-in `reviewStatus` sentence already covers
 * this — see InteractionAlert.md).
 *
 * Parity fix (bundle e's C2 gate review, wave 1): a `reviewed` alert also renders the reviewer's
 * decision, note and date — identical in shape to `features/safety/AlertDetail.tsx` (bundle e's C2,
 * the spec-correct reference), composed independently here rather than imported (same reasoning
 * both bundles use elsewhere: a change to the caregiver's read-only view must never silently change
 * the patient's). "Who" is the same fixed human label bundle e uses, never a resolved name or the
 * raw `reviewedBy` Account id (CR-028/CR-031 — no published function resolves it to a display name).
 * `auto_cleared` needs no extra section: `InteractionAlert`'s own built-in `reviewStatus` sentence
 * already says it was screened automatically and nothing was found.
 *
 * Parity fix, round 2 (wave-1 gate follow-up): the source citation never prints the raw
 * `TO_BE_SUPPLIED` marker (a technical placeholder reaching a reader is worse than a wording drift)
 * — an explicit "unverified / pending" sentence stands in for it, matched by hand to bundle e's own
 * `c2SourceUnverified`. And the involved-prescriptions section (C2's own section, previously missing
 * here) lists each one as a read-only `PrescriptionCard` linking into this bundle's own
 * `/care/medicines/[id]` route — the same server-component card-link pattern already used in
 * `CaregiverMedicines.tsx` (a real `<a href>`, since a server component cannot attach `onOpen`).
 */
import { InteractionAlert } from '@/components/ui/InteractionAlert';
import { PrescriptionCard } from '@/components/ui/PrescriptionCard';
import { Card } from '@/components/ui/Card';
import { DetailRow } from '@/components/ui/DetailRow';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { getAlert, getPrescription } from '@/lib/data';
import { formatDate, formatTime } from '@/i18n/format';
import { TO_BE_SUPPLIED } from '@/lib/config';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { InteractionAlert as InteractionAlertRecord } from '@/types/contracts';

const DECISION_COPY = {
  confirmed: copy.caregiving.f3AlertDecisionConfirmed,
  cleared: copy.caregiving.f3AlertDecisionCleared,
} as const satisfies Record<NonNullable<InteractionAlertRecord['reviewerDecision']>, unknown>;

export async function CaregiverAlertDetail({ alertId, locale }: { alertId: string; locale: Locale }) {
  const alert = await getAlert(alertId);
  if (!alert) {
    return <InlineNotice tone="info" title={t(copy.vocabulary.empty, locale)} />;
  }
  const prescriptions = (await Promise.all(alert.involvedPrescriptionIds.map((id) => getPrescription(id)))).filter((p) => p != null);
  const drugNames = prescriptions.map((p) => p.drug.genericName);
  const citationIsUnverified = !alert.sourceCitation || alert.sourceCitation === TO_BE_SUPPLIED;

  return (
    <div className="flex flex-col gap-3 p-3">
      <InteractionAlert
        severity={alert.severity}
        reviewStatus={alert.reviewStatus}
        title={drugNames.join(' × ')}
        description={alert.description}
        drugs={drugNames}
        lang={locale}
      />

      {alert.severity === 'danger' && alert.reviewStatus === 'pending_medical_review' && (
        <Card>
          <span className="type-body-strong">{t(copy.caregiving.f3AlertRiskLabel, locale)}</span>
          <span className="type-body">{alert.description}</span>
          <span className="type-body-strong">{t(copy.caregiving.f3AlertActionLabel, locale)}</span>
          <span className="type-body">{t(copy.caregiving.f3AlertActionBody, locale)}</span>
          <span className="type-body-strong">{t(copy.caregiving.f3AlertWhoLabel, locale)}</span>
          <span className="type-body">{t(copy.caregiving.f3AlertWhoBody, locale)}</span>
        </Card>
      )}

      {alert.reviewStatus === 'reviewed' && (
        <div className="flex flex-col gap-2">
          <span className="type-h2">{t(copy.caregiving.f3AlertReviewHeading, locale)}</span>
          <Card className="flex flex-col gap-3">
            <DetailRow
              label={t(copy.caregiving.f3AlertDecisionLabel, locale)}
              value={alert.reviewerDecision ? t(DECISION_COPY[alert.reviewerDecision], locale) : null}
              lang={locale}
            />
            <DetailRow label={t(copy.caregiving.f3AlertReviewerLabel, locale)} value={t(copy.caregiving.f3AlertReviewerValue, locale)} lang={locale} />
            <DetailRow
              label={t(copy.caregiving.f3AlertDateLabel, locale)}
              value={alert.reviewedAt ? `${formatDate(alert.reviewedAt.slice(0, 10), locale)} · ${formatTime(alert.reviewedAt.slice(11, 16), locale)}` : null}
              lang={locale}
            />
            <DetailRow label={t(copy.caregiving.f3AlertNoteLabel, locale)} value={alert.reviewerNote} lang={locale} />
          </Card>
        </div>
      )}

      {prescriptions.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="type-h2">{t(copy.caregiving.f3AlertInvolvedHeading, locale)}</span>
          {prescriptions.map((rx) => (
            <a key={rx.id} href={`/${locale}/care/medicines/${rx.id}`} className="wsf-focus" style={{ display: 'block' }}>
              <PrescriptionCard prescription={rx} lang={locale} />
            </a>
          ))}
        </div>
      )}

      <Card flat>
        <span className="type-caption">{t(copy.caregiving.f3AlertSourceLabel, locale)}</span>
        {citationIsUnverified ? (
          <span className="type-body-small">{t(copy.caregiving.f3AlertSourceUnverified, locale)}</span>
        ) : (
          <span className="type-body-small" dir="ltr" style={{ textAlign: 'start' }}>
            {alert.sourceCitation}
          </span>
        )}
      </Card>

      <InlineNotice tone="info" title={t(copy.caregiving.f3ReadOnlyAlertNote, locale)} />
    </div>
  );
}
