'use client';

import { useId, type ChangeEventHandler, type ReactNode } from 'react';
import { Icon } from './Icon';
import { copy, t, type Locale } from '@/i18n';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  id?: string;
  label: ReactNode;
  value?: string;
  helperText?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  dir?: 'rtl' | 'ltr';
  lang?: Locale;
  className?: string;
  options: SelectOption[];
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  /** Shown as a disabled first option while `value` is empty. */
  placeholder?: string;
}

/**
 * A labelled dropdown with the same anatomy as TextField — label, helper text, error state,
 * disabled state, `border-strong` outline — over a real `<select>`. See
 * docs/design-system/components/Select.md.
 */
export function Select({
  id,
  label,
  value,
  helperText,
  error,
  disabled,
  required,
  dir,
  lang = 'en',
  className,
  options,
  onChange,
  placeholder,
}: SelectProps) {
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
      <div className="wsf-select-wrap">
        <select
          id={fieldId}
          className="wsf-input wsf-select wsf-focus type-body"
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          dir={dir}
          lang={lang}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={note ? noteId : undefined}
        >
          {placeholder && !value && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="wsf-select__ico" aria-hidden="true">
          <Icon name="chevronDown" />
        </span>
      </div>
      {note && (
        <p id={noteId} role={error ? 'alert' : undefined} className={['wsf-field__note', error ? 'wsf-field__note--error' : null, 'type-caption'].filter(Boolean).join(' ')}>
          {error && <Icon name="warning" small />}
          {note}
        </p>
      )}
    </div>
  );
}
