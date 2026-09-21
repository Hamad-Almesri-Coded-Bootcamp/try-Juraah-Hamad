'use client';

import { Icon, type IconName } from './Icon';
import { copy, t } from '@/i18n';

export interface InlineNoticeProps {
  /** Never 'danger' — a safety-critical message is an InteractionAlert. Default 'info'. */
  tone?: 'info' | 'success' | 'warning';
  title?: React.ReactNode;
  /** Fires the dismiss control. Omit for a notice that must stay put. */
  onDismiss?: () => void;
  dismissLabel?: string;
  children?: React.ReactNode;
  className?: string;
}

const TONE_ICON: Record<NonNullable<InlineNoticeProps['tone']>, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'warning',
};

/**
 * A low-stakes message, deliberately not a safety alert: `tone` has no 'danger' member, so passing
 * one is a compile-time error — the type itself is the enforcement, nothing here checks at runtime.
 * index.d.ts gives InlineNotice no `lang` prop, so the built-in dismiss word falls back to English
 * ('en') when `dismissLabel` is not supplied; an Arabic screen must pass `dismissLabel` explicitly
 * (reported as a gap in docs/backend-notes/wp2c.md).
 */
export function InlineNotice({ tone = 'info', title, onDismiss, dismissLabel, children, className }: InlineNoticeProps) {
  const classes = ['wsf-notice', `wsf-notice--${tone}`, className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="status">
      <Icon name={TONE_ICON[tone]} className="wsf-notice__ico" />
      <div className="wsf-notice__body">
        {title && <strong className="wsf-notice__title type-body-strong">{title}</strong>}
        <div className="type-body-small">{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="wsf-btn wsf-btn--quiet wsf-iconbtn wsf-focus"
          onClick={onDismiss}
          aria-label={dismissLabel ?? t(copy.vocabulary.dismiss, 'en')}
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}
