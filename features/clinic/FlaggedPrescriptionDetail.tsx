'use client';

/**
 * G3s's detail screen (`/clinic/review/fields/[prescriptionId]`) — the flagged prescription's
 * values, pre-filled from the record, editable in `TextField`s (D-004: this is the one screen in the
 * product where that is allowed, because correcting an uncertain OCR read *is* the reviewer's job
 * here, audited by `confirmPrescriptionFields` itself). Each action commits only through a `Sheet`:
 * **confirm** clears `needsReview` and lets the prescription start feeding the schedule and
 * interaction screening; **return** sets `fieldReviewStatus: "returned"` with a reason and leaves it
 * out of both, permanently for Phase 1.
 *
 * Daylight (CR-071): it leads with the record (which prescription, from where) and that it is on
 * hold, then the image and the form. From `@[900px]` the record and the image stay in a column of
 * their own beside the form, the way a reviewer reads a document against the values typed from it.
 *
 * What a reviewer types is normalised before it is read (`parseFieldDraft`): an Arabic keyboard
 * writes "٠٨:٠٠، ٢٠:٠٠", the record stores "08:00" and "20:00". A value that cannot be read is
 * reported on its field and never reaches the schedule.
 *
 * No image asset exists anywhere in the data layer (`FieldQueueItem.hasSourceImage` is a boolean, not
 * a URL, and `Prescription` carries no image field) — this bundle does not invent one. The source
 * image section renders an honest placeholder with the accessible description SCREENS.md asks for
 * ("the source image, with alt"), never a fabricated picture.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PrescriptionCard } from '@/components/ui/PrescriptionCard';
import { DetailRow } from '@/components/ui/DetailRow';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { Icon } from '@/components/ui/Icon';
import { confirmPrescriptionFields, returnPrescriptionToClinic } from '@/lib/data';
import { copy, t } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { localizeText } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';
import type { Prescription } from '@/types/contracts';
import { parseFieldDraft, type FieldDraft, type FieldDraftError } from './format';
import { AsWritten } from '@/components/ui/AsWritten';

type SheetKind = 'confirm' | 'return' | null;

const ERROR_COPY: Record<FieldDraftError, keyof typeof copy.clinic> = {
  number: 'g3sNumberInvalidError',
  date: 'g3sStartDateInvalidError',
  times: 'g3sDoseTimesInvalidError',
};

export function FlaggedPrescriptionDetail({ prescription, locale, backHref }: { prescription: Prescription; locale: Locale; backHref: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<FieldDraft>({
    brandName: prescription.drug.brandName ?? '',
    strengthMg: prescription.drug.strengthMg != null ? String(prescription.drug.strengthMg) : '',
    frequencyPerDay: prescription.frequencyPerDay != null ? String(prescription.frequencyPerDay) : '',
    startDate: prescription.startDate ?? '',
    doseTimes: prescription.doseTimes?.join(', ') ?? '',
  });
  const [errors, setErrors] = useState<ReturnType<typeof parseFieldDraft>['errors']>({});
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);
  const [openSheet, setOpenSheet] = useState<SheetKind>(null);
  const [pending, startTransition] = useTransition();

  const alreadyReturned = prescription.fieldReviewStatus === 'returned';

  // The values the photo left out are the ones the reviewer is here to read (CR-002).
  const notRead = {
    strengthMg: prescription.drug.strengthMg == null,
    frequencyPerDay: prescription.frequencyPerDay == null,
    startDate: prescription.startDate == null,
    doseTimes: !prescription.doseTimes || prescription.doseTimes.length === 0,
  };

  function edit(field: keyof FieldDraft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function errorFor(field: keyof FieldDraft) {
    const kind = errors[field];
    return kind ? t(copy.clinic[ERROR_COPY[kind]], locale) : undefined;
  }

  function hint(field: keyof typeof notRead, extra?: string) {
    const lines = [notRead[field] ? t(copy.clinic.g3sNotReadHint, locale) : null, extra ?? null].filter(Boolean);
    if (lines.length === 0) return undefined;
    return (
      <span className="flex flex-col">
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
    );
  }

  function openConfirmSheet() {
    const parsed = parseFieldDraft(draft);
    setErrors(parsed.errors);
    if (Object.values(parsed.errors).some(Boolean)) return;
    setOpenSheet('confirm');
  }

  function handleConfirm() {
    const { values } = parseFieldDraft(draft);
    startTransition(() => {
      void (async () => {
        const update: Partial<Prescription> = {
          drug: { ...prescription.drug, brandName: values.brandName, strengthMg: values.strengthMg },
          frequencyPerDay: values.frequencyPerDay,
          startDate: values.startDate,
          doseTimes: values.doseTimes,
        };
        await confirmPrescriptionFields(prescription.id, update, note || undefined);
        setOpenSheet(null);
        router.push(backHref);
      })();
    });
  }

  function openReturnSheet() {
    if (!reason.trim()) {
      setReasonError(t(copy.clinic.g3sReturnReasonRequiredError, locale));
      return;
    }
    setReasonError(undefined);
    setOpenSheet('return');
  }

  function handleReturn() {
    startTransition(() => {
      void (async () => {
        await returnPrescriptionToClinic(prescription.id, reason);
        setOpenSheet(null);
        router.push(backHref);
      })();
    });
  }

  const record = <PrescriptionCard prescription={prescription} lang={locale} />;

  if (alreadyReturned) {
    return (
      <div className="flex w-full max-w-content flex-col gap-5 px-3 pb-5 pt-2 tablet:px-5">
        {record}
        <InlineNotice tone="info" title={t(copy.clinic.g3sReturnReasonLabel, locale)}>
          <AsWritten text={localizeText(prescription.fieldReviewNote, locale)} locale={locale} />
        </InlineNotice>
        {prescription.fieldReviewedAt ? (
          <div className="jr-group px-4">
            <DetailRow label={t(copy.clinic.g3sReturnedOnLabel, locale)} value={formatDate(prescription.fieldReviewedAt.slice(0, 10), locale)} lang={locale} />
          </div>
        ) : null}
        <p className="type-body-small px-1 text-ink-muted">{t(copy.clinic.g3sReturnedBody, locale)}</p>
      </div>
    );
  }

  return (
    <div className="@container px-3 pb-5 pt-2 tablet:px-5">
      <div className="flex flex-col gap-5 @[900px]:grid @[900px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @[900px]:items-start @[900px]:gap-6">
        <div className="flex flex-col gap-5 @[900px]:sticky @[900px]:top-3">
          {record}
          <InlineNotice tone="warning" title={t(copy.clinic.g3sOutOfScheduleTitle, locale)}>
            {t(copy.clinic.g3sOutOfScheduleBody, locale)}
          </InlineNotice>
          <section className="flex flex-col gap-2" aria-label={t(copy.clinic.g3sSourceImageHeading, locale)}>
            <h2 className="jr-group-title">{t(copy.clinic.g3sSourceImageHeading, locale)}</h2>
            <div role="img" aria-label={t(copy.clinic.g3sSourceImageAlt, locale)} className="jr-group flex min-h-figure items-center justify-center">
              <Icon name="capsule" className="jr-fact__icon" />
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="@container jr-group flex flex-col gap-4 p-4" aria-label={t(copy.clinic.g3sFieldsHeading, locale)}>
            <h2 className="type-h2">{t(copy.clinic.g3sFieldsHeading, locale)}</h2>
            <div className="grid gap-4 @[520px]:grid-cols-2">
              <TextField label={t(copy.clinic.g3sFieldBrand, locale)} value={draft.brandName} onChange={(e) => edit('brandName', e.target.value)} lang={locale} />
              <TextField
                label={t(copy.clinic.g3sFieldStrength, locale)}
                value={draft.strengthMg}
                onChange={(e) => edit('strengthMg', e.target.value)}
                inputMode="decimal"
                dir="ltr"
                helperText={hint('strengthMg')}
                error={errorFor('strengthMg')}
                lang={locale}
              />
              <TextField
                label={t(copy.clinic.g3sFieldFrequency, locale)}
                value={draft.frequencyPerDay}
                onChange={(e) => edit('frequencyPerDay', e.target.value)}
                inputMode="numeric"
                dir="ltr"
                helperText={hint('frequencyPerDay')}
                error={errorFor('frequencyPerDay')}
                lang={locale}
              />
              <TextField
                label={t(copy.clinic.g3sFieldStartDate, locale)}
                value={draft.startDate}
                onChange={(e) => edit('startDate', e.target.value)}
                placeholder={t(copy.clinic.g3sFieldStartDatePlaceholder, locale)}
                dir="ltr"
                helperText={hint('startDate')}
                error={errorFor('startDate')}
                lang={locale}
              />
            </div>
            <TextField
              label={t(copy.clinic.g3sFieldDoseTimes, locale)}
              value={draft.doseTimes}
              onChange={(e) => edit('doseTimes', e.target.value)}
              helperText={hint('doseTimes', t(copy.clinic.g3sDoseTimesHelper, locale))}
              error={errorFor('doseTimes')}
              dir="ltr"
              lang={locale}
            />
            <TextField label={t(copy.clinic.g3sConfirmNoteLabel, locale)} value={note} onChange={(e) => setNote(e.target.value)} lang={locale} />
            <Button variant="primary" size="lg" fullWidth lang={locale} onClick={openConfirmSheet}>
              {t(copy.clinic.g3sConfirmButton, locale)}
            </Button>
          </section>

          <section className="jr-group flex flex-col gap-4 p-4">
            {/* No section aria-label here: the TextField below already gives this one field its own
                accessible name, and a second element with the identical name only confuses. */}
            <h2 className="type-h2">{t(copy.clinic.g3sReturnHeading, locale)}</h2>
            <TextField
              label={t(copy.clinic.g3sReturnReasonLabel, locale)}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError(undefined);
              }}
              placeholder={t(copy.clinic.g3sReturnReasonPlaceholder, locale)}
              error={reasonError}
              lang={locale}
            />
            <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={openReturnSheet}>
              {t(copy.clinic.g3sReturnButton, locale)}
            </Button>
          </section>

          <p className="type-body-small px-1 text-ink-muted">{t(copy.clinic.g3sNoOtherEditPathNote, locale)}</p>
        </div>
      </div>

      <Sheet
        open={openSheet === 'confirm'}
        title={t(copy.clinic.g3sConfirmSheetTitle, locale)}
        onClose={() => setOpenSheet(null)}
        closeLabel={t(copy.vocabulary.close, locale)}
        footer={
          <>
            <Button variant="primary" fullWidth lang={locale} loading={pending} onClick={handleConfirm}>
              {t(copy.clinic.g3sConfirmButton, locale)}
            </Button>
            <Button variant="quiet" fullWidth lang={locale} onClick={() => setOpenSheet(null)} disabled={pending}>
              {t(copy.clinic.g3sSheetDismiss, locale)}
            </Button>
          </>
        }
      >
        <p className="type-body">{t(copy.clinic.g3sConfirmSheetBody, locale)}</p>
      </Sheet>

      <Sheet
        open={openSheet === 'return'}
        title={t(copy.clinic.g3sReturnSheetTitle, locale)}
        onClose={() => setOpenSheet(null)}
        closeLabel={t(copy.vocabulary.close, locale)}
        footer={
          <>
            {/* Navy, not red: red is kept for a drug-interaction finding. The body names what it costs. */}
            <Button variant="primary" fullWidth lang={locale} loading={pending} onClick={handleReturn}>
              {t(copy.clinic.g3sSheetReturnLabel, locale)}
            </Button>
            <Button variant="quiet" fullWidth lang={locale} onClick={() => setOpenSheet(null)} disabled={pending}>
              {t(copy.clinic.g3sSheetDismiss, locale)}
            </Button>
          </>
        }
      >
        <p className="type-body">{t(copy.clinic.g3sReturnSheetBody, locale)}</p>
      </Sheet>
    </div>
  );
}
