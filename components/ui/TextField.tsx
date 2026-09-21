'use client';

import { useId, type ChangeEventHandler, type HTMLInputTypeAttribute, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';
import { copy, t, type Locale } from '@/i18n';

export interface TextFieldProps {
  /** Supplied when you need a stable id; generated otherwise. */
  id?: string;
  label: ReactNode;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  /** Sits under the field in caption/ink-muted. Replaced by `error` when that is set. */
  helperText?: ReactNode;
  /** A message. Truthy switches the field to its error state: danger outline, warning glyph, role="alert". */
  error?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  type?: string;
  inputMode?: string;
  autoComplete?: string;
  /** Forces the input's own direction — set 'ltr' for a Civil ID or a Latin drug name inside an Arabic screen. */
  dir?: 'rtl' | 'ltr';
  lang?: Locale;
  className?: string;
}

/**
 * A labelled single-line input with helper text, an error state and a disabled state, outlined in
 * `border-strong`. Controlled — holds no state of its own. See
 * docs/design-system/components/TextField.md.
 */
export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  helperText,
  error,
  disabled,
  required,
  type = 'text',
  inputMode,
  autoComplete,
  dir,
  lang = 'en',
  className,
}: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const noteId = `${fieldId}-note`;
  const note = error ?? helperText;

  return (
    <div className={['wsf-field', error ? 'wsf-field--error' : null, className].filter(Boolean).join(' ')}>
      <label htmlFor={fieldId} className="wsf-field__label type-label">
        {label}
        {required && <span className="wsf-field__req type-label">{t(copy.vocabulary.required, lang)}</span>}
      </label>
      <input
        id={fieldId}
        className="wsf-input wsf-focus type-body"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        type={type as HTMLInputTypeAttribute}
        inputMode={inputMode as InputHTMLAttributes<HTMLInputElement>['inputMode']}
        autoComplete={autoComplete}
        dir={dir}
        lang={lang}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={note ? noteId : undefined}
      />
      {note && (
        <p id={noteId} role={error ? 'alert' : undefined} className={['wsf-field__note', error ? 'wsf-field__note--error' : null, 'type-caption'].filter(Boolean).join(' ')}>
          {error && <Icon name="warning" small />}
          {note}
        </p>
      )}
    </div>
  );
}
