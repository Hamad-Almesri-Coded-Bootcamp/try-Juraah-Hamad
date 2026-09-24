'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { copy, t, type Locale } from '@/i18n';

export interface CopyFieldProps {
  label: ReactNode;
  value: string;
  copyLabel?: string;
  copiedLabel?: string;
  lang?: Locale;
  className?: string;
}

const COPIED_TIMEOUT_MS = 3000;

/**
 * A read-only value with a copy action and a copied confirmation (Build Prompts prompt 1, Forms).
 * For the per-patient webcal:// calendar link only — never for an identifier. See
 * docs/design-system/README (CopyField is "for links a person is meant to use, never for an
 * identity") and components/ui/README/CopyField.md.
 */
export function CopyField({ label, value, copyLabel, copiedLabel, lang = 'en', className }: CopyFieldProps) {
  const fieldId = useId();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const handleCopy = () => {
    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), COPIED_TIMEOUT_MS);
      })
      .catch(() => {
        // Clipboard access can be refused by the browser; the control stays usable, the value
        // remains selectable in the read-only field itself.
      });
  };

  return (
    <div className={['wsf-copyfield', className].filter(Boolean).join(' ')}>
      <label htmlFor={fieldId} className="wsf-copyfield__label type-label">
        {label}
      </label>
      <div className="wsf-copyfield__row">
        <input id={fieldId} type="text" readOnly dir="ltr" lang={lang} value={value} className="wsf-input wsf-focus type-body wsf-copyfield__input" />
        <Button variant="secondary" lang={lang} onClick={handleCopy}>
          {copyLabel ?? t(copy.vocabulary.copy, lang)}
        </Button>
      </div>
      <p role="status" aria-live="polite" className="wsf-copyfield__status type-caption">
        {copied && (
          <>
            <Icon name="check" small />
            {copiedLabel ?? t(copy.vocabulary.copied, lang)}
          </>
        )}
      </p>
    </div>
  );
}
