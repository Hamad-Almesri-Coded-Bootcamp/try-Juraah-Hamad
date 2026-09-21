'use client';

import { useId, type ReactNode } from 'react';
import { copy, t, type Locale } from '@/i18n';

export interface ToggleProps {
  id?: string;
  label: ReactNode;
  /** One line under the label — the place for the soft warning a muted check-in needs. */
  description?: ReactNode;
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  lang?: Locale;
  className?: string;
}

/**
 * The settings switch: a label, an optional description line, and a state written in words as
 * well as shown by the knob's position — colour and position are never the only signal. A real
 * `role="switch"` control. See docs/design-system/components/Toggle.md.
 */
export function Toggle({ id, label, description, checked, onChange, disabled, lang = 'en', className }: ToggleProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  const labelId = `${switchId}-label`;
  const descId = `${switchId}-desc`;

  return (
    <div className={['wsf-toggle', className].filter(Boolean).join(' ')}>
      <div className="wsf-toggle__text">
        <span id={labelId} className="wsf-toggle__label type-body-strong">
          {label}
        </span>
        {description && (
          <span id={descId} className="wsf-toggle__desc type-body-small">
            {description}
          </span>
        )}
      </div>
      <div className="wsf-toggle__side">
        <span className="wsf-toggle__state type-label" aria-hidden="true">
          {t(checked ? copy.vocabulary.on : copy.vocabulary.off, lang)}
        </span>
        <button
          id={switchId}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          aria-describedby={description ? descId : undefined}
          disabled={disabled}
          onClick={() => onChange?.(!checked)}
          className="wsf-toggle__hit wsf-focus"
        >
          <span className="wsf-switch" aria-hidden="true">
            <span className="wsf-switch__knob" />
          </span>
        </button>
      </div>
    </div>
  );
}
