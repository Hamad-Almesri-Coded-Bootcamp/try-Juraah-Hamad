'use client';

/**
 * G2s — reviewer decision (`/clinic/review/[alertId]`). Two columns from tablet width up (the
 * `ReviewerDesktop` board's own layout: decision on one side, the read-only patient-context panel on
 * the other), stacked at phone width. Confirming the risk or clearing it each commit only through a
 * `Sheet`, and only `submitReviewDecision` is ever called — no `Prescription` field and no `Dose` is
 * editable from this screen (rule 1 / G1: nothing here can touch `Dose.status`).
 *
 * `patientContext.trackingOn` decides whether `DoseTimeline` renders a pill per row at all — never a
 * check on the status word (rule 3): an untracked patient's recent-dose list is a plain list of
 * times, exactly like the patient's own untracked Today.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { InteractionAlert } from '@/components/ui/InteractionAlert';
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
import { doseTimesLabel, prescriptionLine } from './format';
import type { Locale } from '@/i18n/locale';
import type { AlertReviewView } from '@/types/views';
import type { Prescription } from '@/types/contracts';

function rxHeadline(rx: Prescription, locale: Locale): string {
  const strength = formatStrength(rx.drug, locale);
  return strength ? `${rx.drug.genericName} ${strength}` : rx.drug.genericName;
}

export function ReviewerDecision({ view, locale, backHref }: { view: AlertReviewView; locale: Locale; backHref: string }) {
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

  return (
    <div className="relative flex min-h-full flex-col gap-4 p-3 desktop:flex-row desktop:items-start desktop:gap-6">
      <div className="flex flex-1 flex-col gap-4">
        <InteractionAlert
          severity={alert.severity}
          reviewStatus={alert.reviewStatus}
          title={drugNames.join(' × ')}
          description={alert.description}
          drugs={involvedPrescriptions.map(prescriptionLine)}
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
          <div className="flex gap-2">
            <Button variant="danger" size="lg" fullWidth lang={locale} onClick={() => setPendingDecision('confirmed')}>
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
              items={patientContext.recentDoses.map((d) => ({ ...timelineWhen(d.scheduledAt, locale), status: d.status, tracked: d.tracked }))}
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
  );
}
