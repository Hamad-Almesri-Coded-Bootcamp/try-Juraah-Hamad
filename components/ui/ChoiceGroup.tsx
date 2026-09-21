'use client';

import { Fragment, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface ChoiceGroupOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface ChoiceGroupProps {
  /** segmented = one row of buttons (2–3 short options) · radio = a stacked list (longer labels). Default 'segmented'. */
  variant?: 'segmented' | 'radio';
  /** Required: groups the inputs for the keyboard and for assistive technology. */
  name: string;
  label: ReactNode;
  value: string;
  onChange?: (next: string) => void;
  options: ChoiceGroupOption[];
  helperText?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * A set of mutually exclusive options shown all at once, as real `<input type="radio">` elements
 * inside a `<fieldset>` so arrow keys move between options exactly as a patient's screen reader
 * expects. The selected option carries a check glyph — the fill is never the only signal. See
 * docs/design-system/components/ChoiceGroup.md.
 */
export function ChoiceGroup({
  variant = 'segmented',
  name,
  label,
  value,
  onChange,
  options,
  helperText,
  disabled,
  className,
}: ChoiceGroupProps) {
  return (
    <fieldset className={['wsf-cg', `wsf-cg--${variant}`, className].filter(Boolean).join(' ')} disabled={disabled}>
      <legend className="wsf-cg__legend type-label">{label}</legend>
      <div className="wsf-cg__opts">
        {options.map((opt) => {
          const optId = `${name}-${opt.value}`;
          const checked = value === opt.value;
          return (
            <Fragment key={opt.value}>
              <input
                type="radio"
                id={optId}
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange?.(opt.value)}
                disabled={disabled || opt.disabled}
                className="wsf-cg__input"
              />
              <label htmlFor={optId} className="wsf-cg__opt">
                {variant === 'radio' ? (
                  <>
                    <span className="wsf-cg__mark" aria-hidden="true">
                      {checked && <Icon name="check" small />}
                    </span>
                    <span className="wsf-cg__opt-text">
                      <span className="type-body">{opt.label}</span>
                      {opt.description && <span className="wsf-cg__opt-desc type-body-small">{opt.description}</span>}
                    </span>
                  </>
                ) : (
                  <>
                    {checked && <Icon name="check" small />}
                    <span className="type-body">{opt.label}</span>
                  </>
                )}
              </label>
            </Fragment>
          );
        })}
      </div>
      {helperText && <p className="wsf-field__note type-caption">{helperText}</p>}
    </fieldset>
  );
}
