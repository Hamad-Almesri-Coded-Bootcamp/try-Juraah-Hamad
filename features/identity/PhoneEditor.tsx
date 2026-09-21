'use client';

import { useState, useTransition } from 'react';
import { updatePatientPhone } from '@/lib/data';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

/** A3's optional contact phone. Controlled, dirty-tracked so the save action only appears once
 * there is something new to save (`updatePatientPhone`, the one write this screen makes besides
 * sign-out — G1: never a dose, never a Civil ID, never a technical identifier). */
export function PhoneEditor({ patientId, initialPhone, locale }: { patientId: string; initialPhone: string | null; locale: Locale }) {
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(() => {
      void (async () => {
        await updatePatientPhone(patientId, phone.trim() ? phone.trim() : null);
        setDirty(false);
      })();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <TextField
        label={t(copy.identity.phoneLabel, locale)}
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          setDirty(true);
        }}
        dir="ltr"
        inputMode="tel"
        autoComplete="tel"
        placeholder={t(copy.identity.phonePlaceholder, locale)}
        lang={locale}
      />
      {dirty && (
        <Button variant="secondary" lang={locale} loading={pending} onClick={handleSave}>
          {t(copy.identity.phoneSaveLabel, locale)}
        </Button>
      )}
    </div>
  );
}
