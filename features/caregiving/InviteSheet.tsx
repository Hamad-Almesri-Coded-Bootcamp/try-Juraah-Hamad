'use client';

/**
 * F1's two-step invite flow (docs/wireframes/InviteMasked.dc.html), exported as a self-contained
 * component so bundle b's A2 can reuse it (DEPENDENCIES §2 — the caregiver-invite step of first-run
 * setup) without either bundle importing the other's screen code. Owns its own Sheet, its own step
 * state, and every data call the flow needs (`lookupMaskedName`, `inviteCaregiver`); the caller only
 * mounts it and reacts to `onDone` (invited, or the person backed out — either way the caller closes
 * it and refreshes its own list).
 *
 * The no-account twin (G9): when `lookupMaskedName` returns `null`, this skips the confirmation step
 * entirely and creates the invitation immediately, landing on the SAME "created" panel, rendered by
 * the SAME branch of this component, as the confirmed-name path. Nothing here can render a different
 * created screen for the two cases (tests/unit/caregiving/no-account-twin.test.tsx).
 */
import { useState, useTransition } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { MaskedName } from '@/lib/format/maskedName';
import { inviteCaregiver, lookupMaskedName } from '@/lib/data';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

type Step = 'entry' | 'confirm' | 'created';

const CIVIL_ID_PATTERN = /^\d{12}$/;

export function InviteSheet({ patientId, locale, onDone }: { patientId: string; locale: Locale; onDone: () => void }) {
  const [step, setStep] = useState<Step>('entry');
  const [civilId, setCivilId] = useState('');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [maskedName, setMaskedName] = useState<string>('');
  const [civilIdError, setCivilIdError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function handleContinue() {
    setCivilIdError(undefined);
    if (!CIVIL_ID_PATTERN.test(civilId)) {
      setCivilIdError(t(copy.caregiving.f1CivilIdError, locale));
      return;
    }
    startTransition(() => {
      void (async () => {
        const { maskedName: found } = await lookupMaskedName(civilId);
        if (found) {
          setMaskedName(found);
          setStep('confirm');
          return;
        }
        // No account — proceeds identically, straight to the same 'created' outcome (G9).
        await inviteCaregiver(patientId, { civilId, name, relationship });
        setStep('created');
      })();
    });
  }

  function handleConfirmYes() {
    startTransition(() => {
      void (async () => {
        await inviteCaregiver(patientId, { civilId, name, relationship });
        setStep('created');
      })();
    });
  }

  function handleConfirmNo() {
    setCivilId('');
    setStep('entry');
  }

  return (
    <Sheet
      open
      title={t(copy.caregiving.f1InviteStep1Title, locale)}
      onClose={onDone}
      closeLabel={t(copy.caregiving.f1CloseSheetLabel, locale)}
    >
      {step === 'entry' && (
        <div className="flex flex-col gap-3">
          <TextField
            label={t(copy.caregiving.f1CivilIdLabel, locale)}
            value={civilId}
            onChange={(e) => setCivilId(e.target.value)}
            dir="ltr"
            inputMode="numeric"
            helperText={t(copy.caregiving.f1CivilIdHelper, locale)}
            error={civilIdError}
          />
          <TextField label={t(copy.caregiving.f1NameKnownLabel, locale)} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label={t(copy.caregiving.f1RelationshipLabel, locale)} value={relationship} onChange={(e) => setRelationship(e.target.value)} />
          <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleContinue} disabled={!civilId || !name || !relationship}>
            {t(copy.caregiving.f1ContinueButton, locale)}
          </Button>
          <p className="type-caption">{t(copy.caregiving.f1NoExtraFieldsNote, locale)}</p>
        </div>
      )}

      {step === 'confirm' && (
        <div className="flex flex-col gap-3">
          <p className="type-body-strong">{t(copy.caregiving.f1ConfirmQuestion, locale)}</p>
          <div className="p-3">
            <MaskedName fullName={maskedName} />
          </div>
          <p className="type-body-small">{t(copy.caregiving.f1MaskedHelper, locale)}</p>
          <div className="flex flex-col gap-2">
            <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleConfirmYes}>
              {t(copy.caregiving.f1ConfirmYes, locale)}
            </Button>
            <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={handleConfirmNo} disabled={pending}>
              {t(copy.caregiving.f1ConfirmNo, locale)}
            </Button>
          </div>
          <InlineNotice tone="info" title={t(copy.caregiving.f1ConfirmationAidNote, locale)} />
        </div>
      )}

      {step === 'created' && (
        <div className="flex flex-col gap-3" data-testid="invite-created-panel">
          <p className="type-body-strong">{t(copy.caregiving.f1CreatedTitle, locale)}</p>
          <InlineNotice tone="info" title={t(copy.caregiving.f1CreatedNoticeTitle, locale)}>
            {t(copy.caregiving.f1CreatedNoticeBody, locale)}
          </InlineNotice>
          <p className="type-body-small">{t(copy.caregiving.f1CreatedSubnote, locale)}</p>
          <Button variant="primary" size="lg" fullWidth lang={locale} onClick={onDone}>
            {t(copy.caregiving.f1CreatedDone, locale)}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
