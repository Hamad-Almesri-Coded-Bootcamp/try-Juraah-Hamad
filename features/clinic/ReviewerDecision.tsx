'use client';

/**
 * G2s — reviewer decision (`/clinic/review/[alertId]`). Three shapes from one markup, keyed off this
 * component's own container width (so the 1280 board renders at 1280, not only at 1440 — D-009):
 * stacked at phone width; decision beside the read-only patient-context panel from `@[720px]`; and
 * from `@[1000px]` (a 1280 window minus the rail) the `ReviewerDesktop` board's third pane — the reviewer's own queue, with the
 * open item marked, so a reviewer working through several findings never leaves the screen to see
 * what is left. Confirming the risk or clearing it each commit only through a `Sheet`, and only
 * `submitReviewDecision` is ever called — no `Prescription` field and no `Dose` is editable from
 * this screen (rule 1 / G1: nothing here can touch `Dose.status`).
 *
 * `patientContext.trackingOn` decides whether `DoseTimeline` renders a pill per row at all — never a
 * check on the status word (rule 3): an untracked patient's recent-dose list is a plain list of
 * times, exactly like the patient's own untracked Today.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { InteractionAlert } from '@/components/ui/InteractionAlert';
import { AlertRow } from '@/components/ui/AlertRow';
import { Card } from '@/components/ui/Card';
import { DetailRow } from '@/components/ui/DetailRow';
import { SectorChip } from '@/components/ui/SectorChip';
import { DoseTimeline } from '@/components/ui/DoseTimeline';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { submitReviewDecision } from '@/lib/data';
import { copy, t } from '@/i18n';
import { TO_BE_SUPPLIED } from '@/lib/config';
import { formatStrength, patternLabel, timelineWhen } from '@/features/caregiving/format';
import { doseTimesLabel, prescriptionLine, waitedLabel } from './format';
import { interpolate } from '@/features/shell/interpolate';
import { formatNumber } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import type { AlertReviewView, ReviewQueueItem } from '@/types/views';
import type { Prescription } from '@/types/contracts';

function rxHeadline(rx: Prescription, locale: Locale): string {
  const strength = formatStrength(rx.drug, locale);
  return strength ? `${rx.drug.genericName} ${strength}` : rx.drug.genericName;
}

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
  const [note, setNote] = useState('');
  const [pendingDecision, setPendingDecision] = useState<'confirmed' | 'cleared' | null>(null);
  const [pending, startTransition] = useTransition();
  const { alert, involvedPrescriptions, patientContext } = view;
  const drugNames = involvedPrescriptions.map((rx) => rx.drug.genericName);
  const citationIsUnverified = !alert.sourceCitation || alert.sourceCitation === TO_BE_SUPPLIED;

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

  const queuePane =
    queue && queue.length > 0 ? (
      <aside className="hidden @[1000px]:flex @[1000px]:w-rail-wide @[1000px]:shrink-0 flex-col gap-3" aria-label={t(copy.clinic.reviewerQueuesTitle, locale)}>
        <h2 className="type-h2">
          {interpolate(t(copy.clinic.findingsOptionTemplate, locale), {
            count: formatNumber(queue.length, locale),
          })}
        </h2>
        <div className="flex flex-col gap-3">
          {queue.map((item) => {
            const current = item.alertId === alert.id;
            return (
              <div key={item.alertId} aria-current={current ? 'page' : undefined}>
                <AlertRow
                  severity={item.severity}
                  drugs={item.drugNames}
                  reviewStatus="pending_medical_review"
                  metaLabel={`${item.patientFirstName} · ${waitedLabel(item.waitedMinutes, locale)}`}
                  href={current || !queueBasePath ? undefined : `${queueBasePath}/${item.alertId}`}
                  lang={locale}
                />
              </div>
            );
          })}
        </div>
      </aside>
    ) : null;

  // The container and the queries are on different elements: a container query looks at an
  // ancestor's inline size, so `@container` sits on the outer div and the `@[…]` classes on the row.
  return (
    <div className="@container relative flex min-h-full flex-col">
      <div className="flex flex-col gap-4 p-3 tablet:p-5 @[720px]:flex-row @[720px]:items-start @[720px]:gap-6">
        {queuePane}
        <div className="flex flex-1 flex-col gap-4 @[1000px]:max-w-content">
          <InteractionAlert
            severity={alert.severity}
            reviewStatus={alert.reviewStatus}
            title={drugNames.join(' × ')}
            description={alert.description}
            drugs={involvedPrescriptions.map((rx) => prescriptionLine(rx, locale))}
            lang={locale}
          />

          <section className="flex flex-col gap-2">
            <h2 className="type-h2">{t(copy.clinic.g2sSourceHeading, locale)}</h2>
            <Card flat>
              {citationIsUnverified ? (
                <span className="type-body-small">{t(copy.safety.c2SourceUnverified, locale)}</span>
              ) : (
                <span className="type-body-small" dir="ltr">
                  {alert.sourceCitation}
                </span>
              )}
            </Card>
          </section>

          <section className="flex flex-col gap-3" aria-label={t(copy.clinic.g2sInvolvedHeading, locale)}>
            <h2 className="type-h2">{t(copy.clinic.g2sInvolvedHeading, locale)}</h2>
            {involvedPrescriptions.map((rx) => (
              <DetailRow
                key={rx.id}
                label={rxHeadline(rx, locale)}
                value={[patternLabel(rx.dosingPattern, locale), doseTimesLabel(rx.doseTimes, locale), rx.source.facilityName].filter(Boolean).join(' · ')}
                lang={locale}
              />
            ))}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="type-h2">{t(copy.clinic.g2sDecisionHeading, locale)}</h2>
            <TextField
              label={t(copy.clinic.g2sNoteLabel, locale)}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t(copy.clinic.g2sNotePlaceholder, locale)}
              lang={locale}
            />
            {/* Two legitimate decisions, drawn as two equal options (UX §2; audit M2). The board draws
                confirm as `danger` and clear as `secondary` — logged in docs/DECISIONS.md. The weight
                of the choice lives in the Sheet that commits it, not in which button is louder. */}
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={() => setPendingDecision('confirmed')}>
                {t(copy.clinic.g2sConfirmButton, locale)}
              </Button>
              <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={() => setPendingDecision('cleared')}>
                {t(copy.clinic.g2sClearButton, locale)}
              </Button>
            </div>
            <InlineNotice tone="info" title={t(copy.clinic.g2sReviewOnlyNote, locale)} />
          </section>
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <h2 className="type-h2">{t(copy.clinic.g2sContextHeading, locale)}</h2>
          <section className="flex flex-col gap-2" aria-label={t(copy.clinic.g2sActiveListHeading, locale)}>
            {patientContext.activePrescriptions.map((rx) => (
              <Card key={rx.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="type-body-strong flex-1">{rxHeadline(rx, locale)}</span>
                  <SectorChip sector={rx.source.sector} lang={locale} />
                </div>
                <span className="type-body-small">
                  {[patternLabel(rx.dosingPattern, locale), doseTimesLabel(rx.doseTimes, locale), rx.source.facilityName].filter(Boolean).join(' · ')}
                </span>
              </Card>
            ))}
          </section>

          <section className="flex flex-col gap-2" aria-label={t(copy.clinic.g2sRecentDosesHeading, locale)}>
            <h3 className="type-h2" style={{ fontSize: 'inherit' }}>
              {t(copy.clinic.g2sRecentDosesHeading, locale)}
            </h3>
            {!patientContext.trackingOn ? (
              <div className="flex flex-col gap-1">
                <span className="type-body-small">{t(copy.clinic.g2sNoTrackingNote, locale)}</span>
                <span className="type-caption">{t(copy.clinic.g2sNoTrackingSubnote, locale)}</span>
              </div>
            ) : patientContext.recentDoses.length === 0 ? (
              <span className="type-body-small">{t(copy.clinic.g2sNoRecentDoses, locale)}</span>
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
          </section>
        </div>

        <Sheet
          open={pendingDecision !== null}
          title={pendingDecision === 'confirmed' ? t(copy.clinic.g2sConfirmSheetTitle, locale) : t(copy.clinic.g2sClearSheetTitle, locale)}
          onClose={() => setPendingDecision(null)}
          closeLabel={t(copy.vocabulary.close, locale)}
          footer={
            <>
              <Button variant={pendingDecision === 'confirmed' ? 'danger' : 'primary'} fullWidth lang={locale} loading={pending} onClick={commit}>
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
    </div>
  );
}
