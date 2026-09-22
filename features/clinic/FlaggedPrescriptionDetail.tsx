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
 * No image asset exists anywhere in the data layer (`FieldQueueItem.hasSourceImage` is a boolean, not
 * a URL, and `Prescription` carries no image field) — this bundle does not invent one. The source
 * image section renders an honest placeholder with the accessible description SCREENS.md asks for
 * ("the source image, with alt"), never a fabricated picture.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { Icon } from '@/components/ui/Icon';
import { confirmPrescriptionFields, returnPrescriptionToClinic } from '@/lib/data';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { Prescription } from '@/types/contracts';

type SheetKind = 'confirm' | 'return' | null;

export function FlaggedPrescriptionDetail({ prescription, locale, backHref }: { prescription: Prescription; locale: Locale; backHref: string }) {
  const router = useRouter();
  const [brandName, setBrandName] = useState(prescription.drug.brandName ?? '');
  const [strengthMg, setStrengthMg] = useState(prescription.drug.strengthMg != null ? String(prescription.drug.strengthMg) : '');
  const [frequencyPerDay, setFrequencyPerDay] = useState(prescription.frequencyPerDay != null ? String(prescription.frequencyPerDay) : '');
  const [startDate, setStartDate] = useState(prescription.startDate ?? '');
  const [doseTimes, setDoseTimes] = useState(prescription.doseTimes?.join(', ') ?? '');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);
  const [openSheet, setOpenSheet] = useState<SheetKind>(null);
  const [pending, startTransition] = useTransition();

  const alreadyReturned = prescription.fieldReviewStatus === 'returned';

  function handleConfirm() {
    startTransition(() => {
      void (async () => {
        const values: Partial<Prescription> = {
          drug: {
            ...prescription.drug,
            brandName: brandName || undefined,
            strengthMg: strengthMg ? Number(strengthMg) : undefined,
          },
          frequencyPerDay: frequencyPerDay ? Number(frequencyPerDay) : undefined,
          startDate: startDate || undefined,
          doseTimes: doseTimes
            ? doseTimes
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        };
        await confirmPrescriptionFields(prescription.id, values, note || undefined);
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

  if (alreadyReturned) {
    return (
      <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-3 tablet:p-5">
        <Card className="flex flex-col gap-2">
          <span className="type-body-strong">{prescription.drug.genericName}</span>
          <span className="type-body-small">{prescription.source.facilityName}</span>
        </Card>
        <InlineNotice tone="info" title={t(copy.clinic.g3sReturnReasonLabel, locale)}>
          {prescription.fieldReviewNote}
        </InlineNotice>
        <span className="type-caption">{t(copy.clinic.g3sOutOfScheduleBody, locale)}</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-3 tablet:p-5">
      <section className="flex flex-col gap-2" aria-label={t(copy.clinic.g3sSourceImageHeading, locale)}>
        <h2 className="type-h2">{t(copy.clinic.g3sSourceImageHeading, locale)}</h2>
        <div role="img" aria-label={t(copy.clinic.g3sSourceImageAlt, locale)} className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-md border border-border">
          <Icon name="capsule" />
        </div>
      </section>

      <InlineNotice tone="warning" title={t(copy.clinic.g3sOutOfScheduleTitle, locale)}>
        {t(copy.clinic.g3sOutOfScheduleBody, locale)}
      </InlineNotice>

      <section className="flex flex-col gap-3" aria-label={t(copy.clinic.g3sFieldsHeading, locale)}>
        <h2 className="type-h2">{t(copy.clinic.g3sFieldsHeading, locale)}</h2>
        <TextField label={t(copy.clinic.g3sFieldBrand, locale)} value={brandName} onChange={(e) => setBrandName(e.target.value)} lang={locale} />
        <TextField label={t(copy.clinic.g3sFieldStrength, locale)} value={strengthMg} onChange={(e) => setStrengthMg(e.target.value)} inputMode="decimal" dir="ltr" lang={locale} />
        <TextField label={t(copy.clinic.g3sFieldFrequency, locale)} value={frequencyPerDay} onChange={(e) => setFrequencyPerDay(e.target.value)} inputMode="numeric" dir="ltr" lang={locale} />
        <TextField
          label={t(copy.clinic.g3sFieldStartDate, locale)}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder={t(copy.clinic.g3sFieldStartDatePlaceholder, locale)}
          dir="ltr"
          lang={locale}
        />
        <TextField
          label={t(copy.clinic.g3sFieldDoseTimes, locale)}
          value={doseTimes}
          onChange={(e) => setDoseTimes(e.target.value)}
          helperText={t(copy.clinic.g3sDoseTimesHelper, locale)}
          dir="ltr"
          lang={locale}
        />
        <TextField label={t(copy.clinic.g3sConfirmNoteLabel, locale)} value={note} onChange={(e) => setNote(e.target.value)} lang={locale} />
        <Button variant="primary" size="lg" fullWidth lang={locale} onClick={() => setOpenSheet('confirm')}>
          {t(copy.clinic.g3sConfirmButton, locale)}
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        {/* No section aria-label here — the TextField below already gives this one field its own
            accessible name, and duplicating it on the wrapping section only creates two elements
            with the identical accessible name (also referenced only once). */}
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

      <span className="type-caption">{t(copy.clinic.g3sNoOtherEditPathNote, locale)}</span>

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
            <Button variant="danger" fullWidth lang={locale} loading={pending} onClick={handleReturn}>
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
