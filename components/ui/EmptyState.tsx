import { Icon, type IconName } from './Icon';

export interface EmptyStateProps {
  icon?: IconName;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A Button, usually. Rendered as given — this component attaches no handler of its own, so it
   * stays server-compatible; the action's own interactivity is the caller's client boundary. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * What a screen shows when there is genuinely nothing to show. No `lang` prop in index.d.ts and no
 * built-in copy is needed — every word here is supplied by the caller.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const classes = ['wsf-state', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <Icon name={icon ?? 'inbox'} className="wsf-state__ico" />
      <h2 className="wsf-state__title type-h2">{title}</h2>
      {description && <p className="wsf-state__desc type-body">{description}</p>}
      {action && <div className="wsf-state__action">{action}</div>}
    </div>
  );
}
