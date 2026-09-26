'use client';

/**
 * G2s — reviewer decision (`/clinic/review/[alertId]`), Daylight (CR-071; board V2Clinic). It leads
 * with the finding (the danger band), then the bridge between the two prescriptions (public and
 * private sector, the product's core story), the source citation, the patient's context (read-only),
 * and the decision: an optional note and two equal choices, each confirmed in a `Sheet` that names
 * its consequence. Only `submitReviewDecision` is ever called: a reviewer changes the review state and
 * nothing else; no `Prescription` field and no `Dose` is editable from this screen (rule 1 / G1).
 *
 * Three shapes from one markup, keyed off this component's own container width (so the 1280 board
 * renders at 1280, not only at 1440 — D-009):
 * - a phone column: finding, bridge, source, patient context, decision;
 * - from `@[720px]`: the decision column beside the read-only patient context, with the decision
 *   card sticky at the bottom of the viewport, so it stays in reach while the reviewer reads;
 * - from `@[1000px]` (a 1280 window minus the rail): the reviewer's own queue as a first column
 *   (ReviewerDesktop, V2Clinic), the open item marked, never linked, nothing in it writes.
 * On a phone the decision column's wrapper is `display: contents`, so `order` can put the patient
 * context before the decision without duplicating either.
 *
 * `patientContext.trackingOn` decides whether `DoseTimeline` renders at all, and each row's own
 * `tracked` whether it carries a pill — never a check on the status word (rule 3).
 */
import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { InteractionAlert } from '@/components/ui/InteractionAlert';
import { AlertRow } from '@/components/ui/AlertRow';
import { DoseTimeline } from '@/components/ui/DoseTimeline';
import { Icon } from '@/components/ui/Icon';
import { Monogram } from '@/components/ui/Monogram';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { submitReviewDecision } from '@/lib/data';
import { copy, t } from '@/i18n';
import { TO_BE_SUPPLIED } from '@/lib/config';
import { patternLabel, timelineWhen } from '@/features/caregiving/format';
import { doseTimesLabel, rxHeadline, waitedLabel } from './format';
import { PrescriptionBridge } from './PrescriptionBridge';
import { WhyTheyInteract } from './WhyTheyInteract';
import { interpolate } from '@/features/shell/interpolate';
import { formatDate, formatNumber, formatTime } from '@/i18n/format';
import { localizeDrugName, localizeFacility, localizeFirstName } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';
import type { AlertReviewView, ReviewQueueItem } from '@/types/views';

export function ReviewerDecision({
  view,
  locale,
  backHref,
  queue,
  queueBasePath,
}: {
  view: AlertReviewView;
  locale: Locale;
  backHref: string;
  /** The reviewer's own findings queue (`getReviewQueue`), for the wide layout's queue pane. Absent →
   * no pane at any width. */
  queue?: ReviewQueueItem[];
  /** The G1s route the pane's rows link under (`/[locale]/clinic/review`); a string, not a builder,
   * because a Server Component cannot hand a function to this Client Component. */
  queueBasePath?: string;
}) {
  const router = useRouter();
  const ids = useId();
  const [note, setNote] = useState('');
  const [pendingDecision, setPendingDecision] = useState<'confirmed' | 'cleared' | null>(null);
  const [pending, startTransition] = useTransition();
  const { alert, involvedPrescriptions, patientContext } = view;
  const citationIsUnverified = !alert.sourceCitation || alert.sourceCitation === TO_BE_SUPPLIED;
  const queueItem = queue?.find((item) => item.alertId === alert.id);
  const sectors = new Set(involvedPrescriptions.map((rx) => rx.source.sector));

  function commit() {
    const decision = pendingDecision;
    if (!decision) return;
    startTransition(() => {
      void (async () => {
        await submitReviewDecision(alert.id, decision, note || undefined);
        router.push(backHref);
      })();
    });
  }

  const findingMeta = [
    queueItem ? interpolate(t(copy.clinic.g2sFindingPatientTemplate, locale), { name: localizeFirstName(queueItem.patientFirstName, locale) }) : null,
    interpolate(t(copy.clinic.g2sFindingRaisedTemplate, locale), {
      date: formatDate(alert.createdAt.slice(0, 10), locale),
      time: formatTime(alert.createdAt.slice(11, 16), locale),
    }),
    queueItem ? waitedLabel(queueItem.waitedMinutes, locale) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const queuePane =
    queue && queue.length > 0 ? (
      <aside className="hidden flex-col gap-3 @[1000px]:flex" aria-label={t(copy.clinic.reviewerQueuesTitle, locale)}>
        <h2 className="jr-group-title">
          {interpolate(t(copy.clinic.findingsOptionTemplate, locale), {
            count: formatNumber(queue.length, locale),
          })}
        </h2>
        <div className="flex flex-col gap-3">
          {queue.map((item) => {
            const current = item.alertId === alert.id;
            return (
              <div key={item.alertId} aria-current={current ? 'page' : undefined} className={current ? 'rounded-lg shadow-md' : undefined}>
                <AlertRow
                  severity={item.severity}
                  drugs={item.drugNames}
                  reviewStatus="pending_medical_review"
                  metaLabel={`${localizeFirstName(item.patientFirstName, locale)} · ${waitedLabel(item.waitedMinutes, locale)}`}
                  href={current || !queueBasePath ? undefined : `${queueBasePath}/${item.alertId}`}
                  lang={locale}
                />
              </div>
            );
          })}
        </div>
      </aside>
    ) : null;

  const decision = (
    <section
      aria-labelledby={`${ids}-decision`}
      className="@container jr-group order-2 flex flex-col gap-3 p-4 @[720px]:sticky @[720px]:bottom-3 @[720px]:mt-auto @[720px]:shadow-md"
    >
      <h2 id={`${ids}-decision`} className="type-h2">
        {t(copy.clinic.g2sDecisionHeading, locale)}
      </h2>
      <TextField
        label={t(copy.clinic.g2sNoteLabel, locale)}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t(copy.clinic.g2sNotePlaceholder, locale)}
        lang={locale}
      />
      {/* Two legitimate decisions, drawn as two equal options (UX §2; audit M2). The board draws
          confirm as `danger` and clear as `secondary`, logged in docs/DECISIONS.md. The weight of
          the choice lives in the Sheet that commits it, which names the consequence. */}
      <div className="grid gap-2 @[440px]:grid-cols-2">
        <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={() => setPendingDecision('confirmed')}>
          {t(copy.clinic.g2sConfirmButton, locale)}
        </Button>
        <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={() => setPendingDecision('cleared')}>
          {t(copy.clinic.g2sClearButton, locale)}
        </Button>
      </div>
      <p className="flex items-start gap-2 text-ink-muted">
        <Icon name="info" small />
        <span className="type-body-small">{t(copy.clinic.g2sReviewOnlyNote, locale)}</span>
      </p>
    </section>
  );

  const context = (
    <section aria-labelledby={`${ids}-context`} className="order-1 flex min-w-0 flex-col gap-3 @[720px]:self-start">
      <h2 id={`${ids}-context`} className="jr-group-title">
        {t(copy.clinic.g2sContextHeading, locale)}
      </h2>
      <div className="jr-group">
        <h3 className="type-label px-4 pt-3 text-ink-muted">{t(copy.clinic.g2sActiveListHeading, locale)}</h3>
        <ul className="flex flex-col">
          {patientContext.activePrescriptions.map((rx) => (
            <li key={rx.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <Monogram name={localizeDrugName(rx.drug.brandName ?? rx.drug.genericName, locale)} />
              <span className="flex min-w-0 flex-col">
                <span className="type-body-strong">{rxHeadline(rx, locale)}</span>
                <span className="jr-num type-body-small text-ink-muted">
                  {[patternLabel(rx.dosingPattern, locale), doseTimesLabel(rx.doseTimes, locale)].filter(Boolean).join(' · ')}
                </span>
                <span className="type-body-small text-ink-muted">
                  {[localizeFacility(rx.source.facilityName, locale), t(copy.vocabulary[rx.source.sector], locale)].join(' · ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="jr-group flex flex-col gap-2 p-4">
        <h3 className="type-body-strong">{t(copy.clinic.g2sRecentDosesHeading, locale)}</h3>
        {!patientContext.trackingOn ? (
          <p className="type-body-small text-ink-muted">{t(copy.clinic.g2sNoTrackingNote, locale)}</p>
        ) : patientContext.recentDoses.length === 0 ? (
          <p className="type-body-small text-ink-muted">{t(copy.clinic.g2sNoRecentDoses, locale)}</p>
        ) : (
          <DoseTimeline
            items={patientContext.recentDoses.map((d) => ({
              ...timelineWhen(d.scheduledAt, locale),
              status: d.status,
              tracked: d.tracked,
            }))}
            lang={locale}
          />
        )}
      </div>
    </section>
  );

  // The container and the queries are on different elements: a container query looks at an
  // ancestor's inline size, so `@container` sits on the outer div and the `@[…]` classes inside it.
  return (
    <div className="@container relative flex min-h-full flex-col">
      <div className="flex flex-col gap-5 px-3 pb-5 pt-2 tablet:px-5 @[720px]:grid @[720px]:grid-cols-[minmax(0,1fr)_var(--spacing-rail-wide)] @[720px]:items-start @[1000px]:grid-cols-[var(--spacing-rail)_minmax(0,1fr)_var(--spacing-rail-wide)]">
        {queuePane}
        <div className="contents @[720px]:flex @[720px]:min-w-0 @[720px]:flex-col @[720px]:gap-5 @[720px]:self-stretch">
          <section className="flex flex-col gap-2">
            <InteractionAlert
              severity={alert.severity}
              reviewStatus={alert.reviewStatus}
              reviewLabel={alert.reviewStatus === 'pending_medical_review' ? t(copy.clinic.g2sPendingReviewLabel, locale) : undefined}
              title={involvedPrescriptions.map((rx) => localizeDrugName(rx.drug.genericName, locale)).join(' × ')}
              description={alert.description}
              lang={locale}
            />
            <p className="jr-num type-body-small px-1 text-ink-muted">{findingMeta}</p>
          </section>

          <section aria-labelledby={`${ids}-involved`} className="flex flex-col gap-2">
            <h2 id={`${ids}-involved`} className="jr-group-title">
              {t(copy.clinic.g2sInvolvedHeading, locale)}
            </h2>
            {sectors.size > 1 ? <p className="type-body-small px-1 text-ink-muted">{t(copy.clinic.g2sCrossSectorNote, locale)}</p> : null}
            <PrescriptionBridge prescriptions={involvedPrescriptions} locale={locale} />
          </section>

          {/* CR-113: with why-data for the pair, "Why they interact" takes the Source card's place
              (the citation moves inside it); without, today's Source card stays exactly as it was. */}
          {view.why ? (
            <WhyTheyInteract why={view.why} alert={alert} locale={locale} headingId={`${ids}-why`} />
          ) : (
            <section aria-labelledby={`${ids}-source`} className="flex flex-col gap-2">
              <h2 id={`${ids}-source`} className="jr-group-title">
                {t(copy.clinic.g2sSourceHeading, locale)}
              </h2>
              <div className="jr-group p-4">
                {citationIsUnverified ? (
                  <p className="type-body">{t(copy.safety.c2SourceUnverified, locale)}</p>
                ) : (
                  <p className="type-body" dir="ltr">
                    {alert.sourceCitation}
                  </p>
                )}
              </div>
            </section>
          )}

          {decision}
        </div>
        {context}
      </div>

      <Sheet
        open={pendingDecision !== null}
        title={pendingDecision === 'confirmed' ? t(copy.clinic.g2sConfirmSheetTitle, locale) : t(copy.clinic.g2sClearSheetTitle, locale)}
        onClose={() => setPendingDecision(null)}
        closeLabel={t(copy.vocabulary.close, locale)}
        footer={
          <>
            {/* Both commits are drawn the same: red is kept for the finding itself. */}
            <Button variant="primary" fullWidth lang={locale} loading={pending} onClick={commit}>
              {t(copy.clinic.g2sSheetConfirmLabel, locale)}
            </Button>
            <Button variant="quiet" fullWidth lang={locale} onClick={() => setPendingDecision(null)} disabled={pending}>
              {t(copy.identity.cancelLabel, locale)}
            </Button>
          </>
        }
      >
        <p className="type-body">{pendingDecision === 'confirmed' ? t(copy.clinic.g2sConfirmSheetBody, locale) : t(copy.clinic.g2sClearSheetBody, locale)}</p>
      </Sheet>
    </div>
  );
}
