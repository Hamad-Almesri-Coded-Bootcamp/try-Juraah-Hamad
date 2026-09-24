/**
 * C2 — interaction alert detail (`/[locale]/app/safety/[alertId]`), Daylight (CR-071, board
 * V2Alert). In order: the band (severity and the two drugs, red only for a danger finding), the
 * "bridge" (the involved prescriptions side by side, each with its sector and facility, a × between
 * them), then one card of numbered steps in the order UX Principles §8 sets (what the risk is, what
 * to do now, who is checking it), the decision of the reviewer when there is one, and the source.
 *
 * The what-to-do step is said only for a danger finding while `pending_medical_review` holds (the
 * approved wording, `c2WhatToDoHeading` / `c2WhatToDoPendingBody`, the same two strings
 * `pendingDangerGuidance` joins for B2's card): on a warning or info finding it would manufacture
 * alarm (§8's reverse clause), and once a reviewer has decided, the decision block says what holds.
 *
 * Read-only by construction (G1): no OK, dismiss, acknowledge or resolve control exists here at any
 * severity. Only a reviewer closes a finding, so there is nothing for the reader to press; the screen
 * does not explain that absence (a designer note, dropped in the Daylight pass). The prescription
 * cards are links to B3 when `prescriptionHrefBuilder` is given, plain cards when it is not, so the
 * caregiver's read-only copy (F3) can reuse this component as is.
 *
 * `reviewed` → the decision, the reviewer's note, who and when. "Who" (CR-028): `reviewedBy` is an
 * `Account.id`, never a Civil ID, and no published data function resolves it to a name, so a fixed
 * role label is shown (`copy.safety.c2ReviewerValue`), never the raw id (G9).
 *
 * `sourceCitation` renders verbatim, or, for an empty or `TO_BE_SUPPLIED` citation, the honest
 * "unverified" line. Never an invented or plausible-looking citation.
 *
 * Every data string is localised at display time (CR-071, language purity): drug names through
 * `localizeDrugName`, facilities through `localizeFacility`, the description and note through
 * `localizeText`. Numbers and strengths go through `i18n/format` (the prescription's own unit).
 */
import type { AlertAudience } from './guidance';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { DetailRow } from '@/components/ui/DetailRow';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Monogram } from '@/components/ui/Monogram';
import { SectorChip } from '@/components/ui/SectorChip';
import { copy, t } from '@/i18n';
import { formatDate, formatNumber, formatStrength, formatTime } from '@/i18n/format';
import { localizeDrugName, localizeFacility, localizeText } from '@/i18n/localize';
import { TO_BE_SUPPLIED } from '@/lib/config';
import type { Locale } from '@/i18n/locale';
import type { InteractionAlert as InteractionAlertRecord, Prescription } from '@/types/contracts';
import { AsWritten } from '@/components/ui/AsWritten';

const DECISION_COPY = {
  confirmed: copy.safety.c2DecisionConfirmed,
  cleared: copy.safety.c2DecisionCleared,
} as const;

const SEVERITY_WORD = {
  danger: copy.vocabulary.severityDanger,
  warning: copy.vocabulary.severityWarning,
  info: copy.vocabulary.severityInfo,
} as const;
const SEVERITY_ICON: Record<InteractionAlertRecord['severity'], IconName> = { danger: 'danger', warning: 'warning', info: 'info' };
/** The band: a red fill only for a real danger finding; a warning or info finding is visibly lighter. */
const BAND_CLASS: Record<InteractionAlertRecord['severity'], string> = {
  danger: 'bg-danger text-on-fill shadow-sm',
  warning: 'border-2 border-warning bg-surface-card text-navy shadow-sm',
  info: 'bg-navy-tint text-navy',
};
const BAND_ICON_CLASS: Record<InteractionAlertRecord['severity'], string> = {
  danger: 'text-on-fill',
  warning: 'text-warning',
  info: 'text-navy-soft',
};

const REVIEW_WORD = {
  pending_medical_review: copy.vocabulary.pending_medical_review,
  reviewed: copy.vocabulary.reviewed,
  auto_cleared: copy.vocabulary.auto_cleared,
} as const;
const REVIEW_ICON: Record<InteractionAlertRecord['reviewStatus'], IconName> = {
  pending_medical_review: 'clock',
  reviewed: 'review',
  auto_cleared: 'check',
};
const REVIEW_ICON_CLASS: Record<InteractionAlertRecord['reviewStatus'], string> = {
  pending_medical_review: 'text-warning',
  reviewed: 'text-navy',
  auto_cleared: 'text-success',
};

/** The name on the box first, then its strength in the prescription's own unit (never converted). */
function nameWithStrength(rx: Prescription, locale: Locale): string {
  const name = localizeDrugName(rx.drug.brandName ?? rx.drug.genericName, locale);
  return rx.drug.strengthMg != null ? `${name} ${formatStrength(rx.drug.strengthMg, rx.drug.strengthUnit, locale)}` : name;
}

function PrescriptionTile({ rx, href, locale }: { rx: Prescription; href?: string; locale: Locale }) {
  const brand = localizeDrugName(rx.drug.brandName ?? rx.drug.genericName, locale);
  const body = (
    <>
      <Monogram name={brand} />
      <span className="type-body-strong">{nameWithStrength(rx, locale)}</span>
      {rx.drug.brandName ? <span className="type-body-small text-ink-muted">{localizeDrugName(rx.drug.genericName, locale)}</span> : null}
      <span className="type-body-small text-ink-muted">{localizeFacility(rx.source.facilityName, locale)}</span>
      <SectorChip sector={rx.source.sector} lang={locale} />
    </>
  );
  const layout = 'flex min-w-0 flex-1 flex-col items-center gap-2 text-center';
  return href ? (
    <Card as="a" href={href} className={layout}>
      {body}
    </Card>
  ) : (
    <Card className={layout}>{body}</Card>
  );
}

/** The two prescriptions side by side with a × between them; one, or more than two, stack. */
function Bridge({
  prescriptions,
  severity,
  locale,
  hrefFor,
  audience,
}: {
  prescriptions: Prescription[];
  severity: InteractionAlertRecord['severity'];
  locale: Locale;
  hrefFor: (rx: Prescription) => string | undefined;
  audience: AlertAudience;
}) {
  if (prescriptions.length === 0) return null;
  const sectors = new Set(prescriptions.map((rx) => rx.source.sector));
  const caption =
    prescriptions.length === 2 && sectors.size === 2
      ? t(audience === 'caregiver' ? copy.safety.c2BridgeMixedPairCaregiver : copy.safety.c2BridgeMixedPair, locale)
      : prescriptions.length > 1
        ? t(audience === 'caregiver' ? copy.safety.c2BridgeTogetherCaregiver : copy.safety.c2BridgeTogether, locale)
        : null;
  const danger = severity === 'danger';

  return (
    <section className="flex flex-col gap-3" aria-label={t(copy.safety.c2InvolvedHeading, locale)} data-testid="alert-bridge">
      {prescriptions.length === 2 ? (
        <div className="flex items-stretch">
          <PrescriptionTile rx={prescriptions[0]!} href={hrefFor(prescriptions[0]!)} locale={locale} />
          <div className="relative flex w-hit flex-none items-center justify-center" aria-hidden="true">
            <span className={`absolute start-0 end-0 top-1/2 border-t-2 border-dashed ${danger ? 'border-danger' : 'border-border-strong'}`} />
            <span
              className={`relative flex size-5 items-center justify-center rounded-full border-2 bg-surface-card ${danger ? 'border-danger text-danger' : 'border-border-strong text-navy'}`}
            >
              <Icon name="close" small />
            </span>
          </div>
          <PrescriptionTile rx={prescriptions[1]!} href={hrefFor(prescriptions[1]!)} locale={locale} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {prescriptions.map((rx) => (
            <PrescriptionTile key={rx.id} rx={rx} href={hrefFor(rx)} locale={locale} />
          ))}
        </div>
      )}
      {caption ? <p className="m-0 text-center type-body-small text-ink-muted">{caption}</p> : null}
    </section>
  );
}

interface Step {
  key: string;
  heading: string;
  body: ReactNode;
}

/** The numbered steps. Every number is navy: the band above already carries the red, and danger
 * stays under a tenth of a phone screen (UX §8). */
function Steps({ steps, locale }: { steps: Step[]; locale: Locale }) {
  return (
    <ol className="jr-group m-0 flex list-none flex-col p-4" aria-label={t(copy.safety.c2StepsLabel, locale)} data-testid="alert-steps">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={step.key} className="flex gap-3" data-step={step.key}>
            <span className="flex flex-none flex-col items-center" aria-hidden="true">
              <span
                className="jr-num flex size-hit items-center justify-center rounded-full bg-navy type-body-strong text-on-fill"
              >
                {formatNumber(i + 1, locale)}
              </span>
              {!last ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
            </span>
            <span className={`flex min-w-0 flex-1 flex-col gap-1 pt-2 ${last ? '' : 'pb-4'}`}>
              <span className="jr-display type-body-strong text-navy">{step.heading}</span>
              {step.body}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export interface AlertDetailProps {
  alert: InteractionAlertRecord;
  /** The involved prescriptions, resolved by the page via `getPrescription` for every id in
   * `alert.involvedPrescriptionIds`, in that order. A missing or unreadable one is not shown. */
  prescriptions: Prescription[];
  locale: Locale;
  /** Builds the href for a prescription card, opening B3. Absent → the cards are not links. */
  prescriptionHrefBuilder?: (prescription: Prescription) => string;
  /** A caregiver reads the same finding about someone else's record: the lines that say "your" change voice. */
  audience?: AlertAudience;
  className?: string;
}

export function AlertDetail({ alert, prescriptions, locale, prescriptionHrefBuilder, audience = 'patient', className }: AlertDetailProps) {
  const citationIsUnverified = !alert.sourceCitation || alert.sourceCitation === TO_BE_SUPPLIED;
  const pending = alert.reviewStatus === 'pending_medical_review';
  const showWhatToDo = alert.severity === 'danger' && pending;
  const title = prescriptions.map((rx) => localizeDrugName(rx.drug.genericName, locale)).join(' × ');
  const bandId = `alert-${alert.id}-title`;

  const steps: Step[] = [
    {
      key: 'risk',
      heading: t(alert.severity === 'info' ? copy.safety.c2StepFindingHeading : copy.safety.c2StepRiskHeading, locale),
      body: (
        <p className="m-0 type-body">
          <AsWritten text={localizeText(alert.description, locale)} locale={locale} />
        </p>
      ),
    },
    ...(showWhatToDo
      ? [
          {
            key: 'what-to-do',
            heading: t(copy.safety.c2WhatToDoHeading, locale),
            body: (
              <p className="m-0 type-body">
                {t(audience === 'caregiver' ? copy.safety.c2WhatToDoPendingBodyCaregiver : copy.safety.c2WhatToDoPendingBody, locale)}
              </p>
            ),
          },
        ]
      : []),
    {
      key: 'who',
      heading: t(pending ? copy.safety.c2StepWhoPendingHeading : copy.safety.c2StepWhoDoneHeading, locale),
      body: (
        <p className="m-0 flex items-start gap-2 type-body">
          <Icon name={REVIEW_ICON[alert.reviewStatus]} className={`mt-1 flex-none ${REVIEW_ICON_CLASS[alert.reviewStatus]}`} small />
          <span>{t(REVIEW_WORD[alert.reviewStatus], locale)}</span>
        </p>
      ),
    },
  ];

  return (
    <div className={['flex flex-col gap-5', className].filter(Boolean).join(' ')}>
      <section
        className={`flex items-center gap-3 rounded-lg px-4 py-3 ${BAND_CLASS[alert.severity]}`}
        aria-labelledby={bandId}
        data-testid="alert-band"
        data-severity={alert.severity}
      >
        <Icon name={SEVERITY_ICON[alert.severity]} className={`flex-none ${BAND_ICON_CLASS[alert.severity]}`} />
        <span className="flex min-w-0 flex-col">
          <span className="type-label">{t(SEVERITY_WORD[alert.severity], locale)}</span>
          <h2 id={bandId} className="jr-display m-0 type-h2">
            {title}
          </h2>
        </span>
      </section>

      <Bridge
        prescriptions={prescriptions}
        severity={alert.severity}
        locale={locale}
        hrefFor={(rx) => (prescriptionHrefBuilder ? prescriptionHrefBuilder(rx) : undefined)}
        audience={audience}
      />

      <Steps steps={steps} locale={locale} />

      {alert.reviewStatus === 'reviewed' && (
        <section className="flex flex-col gap-2">
          <h2 className="jr-group-title">{t(copy.safety.c2ReviewHeading, locale)}</h2>
          <div className="jr-group flex flex-col px-4 py-2" data-testid="alert-decision">
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
            <DetailRow label={t(copy.safety.c2NoteLabel, locale)} value={alert.reviewerNote ? <AsWritten text={localizeText(alert.reviewerNote, locale)} locale={locale} /> : null} lang={locale} />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="jr-group-title">{t(copy.safety.c2SourceHeading, locale)}</h2>
        <div className="jr-group px-4 py-3">
          {citationIsUnverified ? (
            <p className="m-0 type-body-small text-ink-muted">{t(copy.safety.c2SourceUnverified, locale)}</p>
          ) : (
            <p className="m-0 type-body-small" dir="auto">
              {alert.sourceCitation}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
