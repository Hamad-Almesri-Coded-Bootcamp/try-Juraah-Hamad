'use client';

/**
 * F1's two-step invite flow (docs/wireframes/InviteMasked.dc.html), exported as a self-contained
 * component so bundle b's A2 can reuse it (DEPENDENCIES §2 — the caregiver-invite step of first-run
 * setup) without either bundle importing the other's screen code. Owns its own Sheet, its own step
 * state, and every data call the flow needs (`lookupMaskedName`, `inviteCaregiver`); the caller only
 * mounts it and reacts to `onDone` (invited, or the person backed out — either way the caller closes
 * it and refreshes its own list).
 *
 * Step one is a real form (`<form action>`, the sign-in form's pattern): Enter submits, Continue is
 * never disabled-until-filled, and each empty or malformed field gets its own message saying what to
 * write (UX §5/§6). The Civil ID is read as A1 and X0 read it (`normaliseCivilId`), so an Arabic
 * keyboard's digits work here too.
 *
 * The no-account twin (G9): when `lookupMaskedName` returns `null`, this skips the confirmation step
 * entirely and creates the invitation immediately, landing on the SAME "created" panel, rendered by
 * the SAME branch of this component, as the confirmed-name path. Nothing here can render a different
 * created screen for the two cases (tests/unit/caregiving/noAccountTwin.test.tsx), and the panel
 * never prints the Civil ID or anything derived from it (rule 6).
 */
import { useState, useTransition } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { Monogram } from '@/components/ui/Monogram';
import { MaskedName } from '@/lib/format/maskedName';
import { inviteCaregiver, lookupMaskedName } from '@/lib/data';
import { civilIdProblem, normaliseCivilId } from '@/features/identity/civilId';
import { copy, t } from '@/i18n';
import { localizePersonName } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';

type Step = 'entry' | 'confirm' | 'created';

interface FieldErrors {
  civilId?: string;
  name?: string;
  relationship?: string;
}

export function InviteSheet({ patientId, locale, onDone }: { patientId: string; locale: Locale; onDone: () => void }) {
  const [step, setStep] = useState<Step>('entry');
  const [civilId, setCivilId] = useState('');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [maskedName, setMaskedName] = useState<string>('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  /** The form's action: a client function, so React blocks a native submit before hydration. */
  function handleContinue() {
    if (pending) return;
    const id = normaliseCivilId(civilId);
    const problem = civilIdProblem(id);
    const next: FieldErrors = {
      civilId: problem === 'required' ? t(copy.caregiving.f1CivilIdRequiredError, locale) : problem ? t(copy.caregiving.f1CivilIdError, locale) : undefined,
      name: name.trim() ? undefined : t(copy.caregiving.f1NameRequiredError, locale),
      relationship: relationship.trim() ? undefined : t(copy.caregiving.f1RelationshipRequiredError, locale),
    };
    setErrors(next);
    if (next.civilId || next.name || next.relationship) return;

    const invite = { civilId: id, name: name.trim(), relationship: relationship.trim() };
    startTransition(() => {
      void (async () => {
        const { maskedName: found } = await lookupMaskedName(id);
        if (found) {
          setMaskedName(found);
          setStep('confirm');
          return;
        }
        // No account: proceeds identically, straight to the same 'created' outcome (G9).
        await inviteCaregiver(patientId, invite);
        setStep('created');
      })();
    });
  }

  function handleConfirmYes() {
    startTransition(() => {
      void (async () => {
        await inviteCaregiver(patientId, { civilId: normaliseCivilId(civilId), name: name.trim(), relationship: relationship.trim() });
        setStep('created');
      })();
    });
  }

  function handleConfirmNo() {
    setCivilId('');
    setErrors({});
    setStep('entry');
  }

  // Masked in the reader's language, keeping its shape: 'ناصر ح*** المطيري' → 'Nasser H*** Al-Mutairi'.
  const shownMaskedName = localizePersonName(maskedName, locale);

  return (
    <Sheet
      open
      title={t(copy.caregiving.f1InviteStep1Title, locale)}
      onClose={onDone}
      closeLabel={t(copy.caregiving.f1CloseSheetLabel, locale)}
    >
      {step === 'entry' && (
        <form action={handleContinue} noValidate className="flex flex-col gap-4">
          <TextField
            label={t(copy.caregiving.f1CivilIdLabel, locale)}
            value={civilId}
            onChange={(e) => {
              setCivilId(e.target.value);
              setErrors((prev) => ({ ...prev, civilId: undefined }));
            }}
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            helperText={t(copy.caregiving.f1CivilIdHelper, locale)}
            error={errors.civilId}
            lang={locale}
          />
          <TextField
            label={t(copy.caregiving.f1NameKnownLabel, locale)}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            autoComplete="off"
            error={errors.name}
            lang={locale}
          />
          <TextField
            label={t(copy.caregiving.f1RelationshipLabel, locale)}
            value={relationship}
            onChange={(e) => {
              setRelationship(e.target.value);
              setErrors((prev) => ({ ...prev, relationship: undefined }));
            }}
            autoComplete="off"
            error={errors.relationship}
            lang={locale}
          />
          <Button type="submit" variant="primary" size="lg" fullWidth lang={locale} loading={pending}>
            {t(copy.caregiving.f1ContinueButton, locale)}
          </Button>
          <p className="type-body-small text-center text-ink-muted">{t(copy.caregiving.f1NoExtraFieldsNote, locale)}</p>
        </form>
      )}

      {step === 'confirm' && (
        <div className="flex flex-col gap-4">
          <p className="type-body-strong">{t(copy.caregiving.f1ConfirmQuestion, locale)}</p>
          <div className="flex items-center gap-3 rounded-lg bg-surface-app p-3">
            <Monogram name={shownMaskedName} />
            <MaskedName fullName={shownMaskedName} />
          </div>
          <p className="type-body-small text-ink-muted">{t(copy.caregiving.f1MaskedHelper, locale)}</p>
          <div className="flex flex-col gap-2">
            <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={handleConfirmYes}>
              {t(copy.caregiving.f1ConfirmYes, locale)}
            </Button>
            <Button variant="secondary" size="lg" fullWidth lang={locale} onClick={handleConfirmNo} disabled={pending}>
              {t(copy.caregiving.f1ConfirmNo, locale)}
            </Button>
          </div>
          <InlineNotice tone="info">{t(copy.caregiving.f1ConfirmationAidNote, locale)}</InlineNotice>
        </div>
      )}

      {step === 'created' && (
        <div className="flex flex-col items-center gap-4 text-center" data-testid="invite-created-panel">
          <span className="flex rounded-full bg-navy-tint p-3 text-navy">
            <Icon name="check" />
          </span>
          <p className="type-h2">{t(copy.caregiving.f1CreatedTitle, locale)}</p>
          <div className="w-full text-start">
            <InlineNotice tone="info" title={t(copy.caregiving.f1CreatedNoticeTitle, locale)}>
              {t(copy.caregiving.f1CreatedNoticeBody, locale)}
            </InlineNotice>
          </div>
          <p className="type-body-small text-ink-muted">{t(copy.caregiving.f1CreatedSubnote, locale)}</p>
          <Button variant="primary" size="lg" fullWidth lang={locale} onClick={onDone}>
            {t(copy.caregiving.f1CreatedDone, locale)}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
