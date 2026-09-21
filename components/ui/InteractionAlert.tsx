import type { IconName } from './Icon';
import { Icon } from './Icon';
import { copy, t, type Locale } from '@/i18n';

/** InteractionAlert.severity from the data contract. */
export type Severity = 'info' | 'warning' | 'danger';
/** InteractionAlert.reviewStatus from the data contract. */
export type ReviewStatus = 'auto_cleared' | 'pending_medical_review' | 'reviewed';

export interface InteractionAlertProps {
  severity: Severity;
  /** Omit only where the platform genuinely has no review state to show. */
  reviewStatus?: ReviewStatus;
  title: React.ReactNode;
  /** Plain-language risk description. Set at body-strong on a danger alert. */
  description?: React.ReactNode;
  /** The interacting drugs, one per line. */
  drugs?: string[];
  /** Overrides the severity word above the title. */
  severityLabel?: string;
  /** Overrides the review-state sentence. Keep any replacement unambiguous about who has and has not checked. */
  reviewLabel?: string;
  /** Buttons. Inside a danger alert, secondary renders as an on-fill button with danger text (bundle.css). */
  actions?: React.ReactNode;
  /** Connects the title to the region via aria-labelledby. Supply one whenever several alerts may render together. */
  titleId?: string;
  lang?: Locale;
  className?: string;
}

const SEVERITY_ICON: Record<Severity, IconName> = { danger: 'danger', warning: 'warning', info: 'info' };
const SEVERITY_WORD = {
  danger: copy.vocabulary.severityDanger,
  warning: copy.vocabulary.severityWarning,
  info: copy.vocabulary.severityInfo,
} as const;
const REVIEW_ICON: Record<ReviewStatus, IconName> = {
  pending_medical_review: 'clock',
  reviewed: 'review',
  auto_cleared: 'check',
};
const REVIEW_WORD = {
  pending_medical_review: copy.vocabulary.pending_medical_review,
  reviewed: copy.vocabulary.reviewed,
  auto_cleared: copy.vocabulary.auto_cleared,
} as const;

/**
 * The platform's safety-critical component: a drug-interaction finding. At severity="danger" it
 * renders as a full-fill, radius-lg, shadow-md panel — the single most prominent element a screen
 * can hold — and never offers a dismiss (index.d.ts has no onDismiss prop; nothing here invents one).
 * No hooks: server-compatible by default. Supply `titleId` yourself whenever more than one alert may
 * render on a page at once (this gallery does), so each region keeps a distinct accessible name.
 */
export function InteractionAlert({
  severity,
  reviewStatus,
  title,
  description,
  drugs,
  severityLabel,
  reviewLabel,
  actions,
  titleId,
  lang = 'en',
  className,
}: InteractionAlertProps) {
  const classes = ['wsf-alert', `wsf-alert--${severity}`, className].filter(Boolean).join(' ');
  const descClass = severity === 'danger' ? 'type-body-strong' : 'type-body';
  return (
    <div className={classes} role="region" aria-labelledby={titleId}>
      <div className="wsf-alert__head">
        <Icon name={SEVERITY_ICON[severity]} className="wsf-alert__icon" />
        <div className="wsf-alert__title">
          <span className="wsf-alert__severity type-label">{severityLabel ?? t(SEVERITY_WORD[severity], lang)}</span>
          <h2 id={titleId} className="type-h2" style={{ margin: 0 }}>
            {title}
          </h2>
        </div>
      </div>
      {description && <p className={`wsf-alert__desc ${descClass}`}>{description}</p>}
      {drugs && drugs.length > 0 && (
        <ul className="wsf-alert__drugs">
          {drugs.map((drug) => (
            <li key={drug} className="type-body">
              {drug}
            </li>
          ))}
        </ul>
      )}
      {reviewStatus && (
        <div className={`wsf-alert__review wsf-alert__review--${reviewStatus}`}>
          <Icon name={REVIEW_ICON[reviewStatus]} small className="wsf-alert__review-icon" />
          <p className="type-body-small" style={{ margin: 0 }}>
            {reviewLabel ?? t(REVIEW_WORD[reviewStatus], lang)}
          </p>
        </div>
      )}
      {actions && <div className="wsf-alert__actions">{actions}</div>}
    </div>
  );
}
