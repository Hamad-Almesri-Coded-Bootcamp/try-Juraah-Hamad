/**
 * C2 — interaction alert detail (`/[locale]/app/safety/[alertId]`). The three-part safety shape
 * (UX Principles §8 — what the risk is · what to do right now · who is checking it) for a
 * danger-severity finding while it is `pending_medical_review`: the risk and the "who" sentence are
 * `InteractionAlert`'s own built-in copy (severity description + `reviewStatus` sentence — see
 * `components/ui/README/InteractionAlert.md`), and this component adds only the missing middle part:
 * the what-to-do-now heading. No OK/dismiss/acknowledge control exists anywhere on this screen, at
 * any severity — `InteractionAlert` has no such prop by design, and nothing here adds
 * one; reading this screen calls only `getAlert`/`getPrescription`, both reads (G1).
 *
 * `reviewed` → the decision, the reviewer's note and who reviewed it. "Who" (CR-028): `reviewedBy`
 * crosses the seam as an `Account.id` (e.g. `acc-10`), never a Civil ID — but no published data
 * function resolves that id to a display name (the same gap CR-031 named for F4's own caregiver
 * name; logged in docs/backend-notes/wp4e.md §7 as a WP1 follow-up for this bundle). Rendering the
 * raw id would itself break G9 ("no technical identifier reaches a screen"), so this component shows
 * a fixed role label ("a medical reviewer" / `copy.safety.c2ReviewerValue`) instead of a name.
 *
 * `sourceCitation` renders verbatim, or — since every seeded alert currently holds the
 * `TO_BE_SUPPLIED` marker (`docs/Seed Dataset.md`: "leave it unwritten rather than invent a
 * citation") — the explicit, honest "unverified" line from this bundle's catalogue. Never an
 * invented or plausible-looking citation.
 */
import { InteractionAlert } from '@/components/ui/InteractionAlert';
import { Card } from '@/components/ui/Card';
import { DetailRow } from '@/components/ui/DetailRow';
import { PrescriptionCardLink } from '@/features/day/PrescriptionCardLink';
import { copy, t } from '@/i18n';
import { formatDate, formatTime } from '@/i18n/format';
import { TO_BE_SUPPLIED } from '@/lib/config';
import type { Locale } from '@/i18n/locale';
import type { InteractionAlert as InteractionAlertRecord, Prescription } from '@/types/contracts';

const DECISION_COPY = {
  confirmed: copy.safety.c2DecisionConfirmed,
  cleared: copy.safety.c2DecisionCleared,
} as const;

/** "Warfarin 5 mg — مستشفى الفروانية" — the interacting drug, its strength (unit exactly as
 * written, never converted — CLAUDE.md) and its issuing facility, matching the approved wireframe's
 * own `pair` shape (`AlertDanger.dc.html`'s renderVals). */
function drugLine(rx: Prescription): string {
  const unit = rx.drug.strengthUnit ?? 'mg';
  const strength = rx.drug.strengthMg != null ? ` ${rx.drug.strengthMg} ${unit}` : '';
  return `${rx.drug.genericName}${strength} — ${rx.source.facilityName}`;
}

export interface AlertDetailProps {
  alert: InteractionAlertRecord;
  /** The involved prescriptions, resolved by the page via `getPrescription` for every id in
   * `alert.involvedPrescriptionIds`, in that order. A missing/unreadable one (deleted, inaccessible)
   * is simply left out — never a broken row. */
  prescriptions: Prescription[];
  locale: Locale;
  /** Builds the href for a `PrescriptionCard`'s only affordance — opening B3. */
  prescriptionHrefBuilder: (prescription: Prescription) => string;
  className?: string;
}

export function AlertDetail({ alert, prescriptions, locale, prescriptionHrefBuilder, className }: AlertDetailProps) {
  const drugNames = prescriptions.map((rx) => rx.drug.genericName);
  const citationIsUnverified = !alert.sourceCitation || alert.sourceCitation === TO_BE_SUPPLIED;

  return (
    <div className={['flex flex-col gap-4', className].filter(Boolean).join(' ')}>
      <InteractionAlert
        severity={alert.severity}
        reviewStatus={alert.reviewStatus}
        title={drugNames.join(' × ')}
        description={alert.description}
        drugs={prescriptions.map(drugLine)}
        lang={locale}
      />

      {alert.severity === 'danger' && alert.reviewStatus === 'pending_medical_review' && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="type-h2">{t(copy.safety.c2WhatToDoHeading, locale)}</h2>
            <p className="type-body">{t(copy.safety.c2WhatToDoPendingBody, locale)}</p>
          </section>
          <p className="type-caption">{t(copy.safety.c2NoActionNote, locale)}</p>
        </>
      )}

      {alert.reviewStatus === 'reviewed' && (
        <section className="flex flex-col gap-2">
          <h2 className="type-h2">{t(copy.safety.c2ReviewHeading, locale)}</h2>
          <Card className="flex flex-col gap-3">
            <DetailRow
              label={t(copy.safety.c2DecisionLabel, locale)}
              value={alert.reviewerDecision ? t(DECISION_COPY[alert.reviewerDecision], locale) : null}
              lang={locale}
            />
            <DetailRow label={t(copy.safety.c2ReviewerLabel, locale)} value={t(copy.safety.c2ReviewerValue, locale)} lang={locale} />
            <DetailRow
              label={t(copy.safety.c2DateLabel, locale)}
              value={alert.reviewedAt ? `${formatDate(alert.reviewedAt.slice(0, 10), locale)} · ${formatTime(alert.reviewedAt.slice(11, 16), locale)}` : null}
              lang={locale}
            />
            <DetailRow label={t(copy.safety.c2NoteLabel, locale)} value={alert.reviewerNote} lang={locale} />
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-3" aria-label={t(copy.safety.c2InvolvedHeading, locale)}>
        <h2 className="type-h2">{t(copy.safety.c2InvolvedHeading, locale)}</h2>
        {prescriptions.map((rx) => (
          <PrescriptionCardLink key={rx.id} href={prescriptionHrefBuilder(rx)} prescription={rx} lang={locale} />
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="type-h2">{t(copy.safety.c2SourceHeading, locale)}</h2>
        <Card flat>
          {citationIsUnverified ? (
            <span className="type-body-small">{t(copy.safety.c2SourceUnverified, locale)}</span>
          ) : (
            <span className="type-body-small" dir="ltr" style={{ textAlign: 'start' }}>
              {alert.sourceCitation}
            </span>
          )}
        </Card>
      </section>
    </div>
  );
}
