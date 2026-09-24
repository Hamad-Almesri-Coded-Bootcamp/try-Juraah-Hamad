import { Icon, type IconName } from './Icon';

export interface ContextBannerProps {
  variant: 'caregiver' | 'simulated' | 'lastKnown';
  /** e.g. "Viewing the record of حمد" — composed by the consumer from the vocabulary and a real
   * name; this component renders no name and no vocabulary lookup of its own, so it needs no `lang`
   * prop (not in the brief's list for this component; nothing here has a built-in fallback word). */
  title: React.ReactNode;
  /** As-of time, role label, or similar — formatted by the consumer (REFERENCE_NOW never reaches
   * this file). */
  detail?: React.ReactNode;
  icon?: IconName;
  className?: string;
}

/**
 * A persistent, non-dismissable strip naming the context of the session: whose data a caregiver is
 * viewing, the simulated-role label in the clinic shell, or that data shown is the last known copy.
 * Information, never an alert — always navy-tint / navy, never the danger token, no onClick, no
 * close control. Sticky positioning under the AppBar is the consumer's layout, not this component's.
 */
export function ContextBanner({ variant, title, detail, icon, className }: ContextBannerProps) {
  const classes = ['wsf-ctxbanner', `wsf-ctxbanner--${variant}`, className].filter(Boolean).join(' ');
  return (
    <div className={classes} role={variant === 'lastKnown' ? 'status' : 'note'}>
      {icon && <Icon name={icon} small className="wsf-ctxbanner__icon" />}
      <div className="wsf-ctxbanner__text">
        <p className="wsf-ctxbanner__title type-body-small">{title}</p>
        {detail && <p className="wsf-ctxbanner__detail type-caption">{detail}</p>}
      </div>
    </div>
  );
}
