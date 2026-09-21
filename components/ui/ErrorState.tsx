'use client';

import { Icon } from './Icon';
import { copy, t } from '@/i18n';

export interface ErrorStateProps {
  title: React.ReactNode;
  /** What went wrong and what to do about it — both, always (this component does not enforce the
   * sentence shape; ErrorState.md does). */
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * What went wrong, what it means, and a retry — never a danger icon or a danger Button; retrying is
 * safe. No `lang` prop in index.d.ts, so the built-in retry word falls back to English ('en') when
 * `retryLabel` is not supplied — reported as a gap. 'use client': it attaches onClick itself.
 */
export function ErrorState({ title, description, onRetry, retryLabel, className }: ErrorStateProps) {
  const classes = ['wsf-state', 'wsf-state--error', className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="alert">
      <Icon name="warning" className="wsf-state__ico" />
      <h2 className="wsf-state__title type-h2">{title}</h2>
      {description && <p className="wsf-state__desc type-body">{description}</p>}
      {onRetry && (
        <div className="wsf-state__action">
          <button type="button" className="wsf-btn wsf-btn--secondary wsf-focus" onClick={onRetry}>
            {retryLabel ?? t(copy.vocabulary.retry, 'en')}
          </button>
        </div>
      )}
    </div>
  );
}
