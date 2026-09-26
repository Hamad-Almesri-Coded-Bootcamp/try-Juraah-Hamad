import type * as React from 'react';
import { Icon } from './Icon';

export interface DisclosureProps {
  /** The row's label, already translated. */
  summary: React.ReactNode;
  children: React.ReactNode;
  /** Open at first render (the reader can still close it). */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * A labelled row that opens to show more (CR-113, a pending component the design system lacks), on
 * the native details/summary pair: keyboard and screen-reader behaviour come from the platform, no
 * script. 44 px hit area, a visible focus ring, a forward chevron in both languages that turns to
 * point down when open.
 */
export function Disclosure({ summary, children, defaultOpen, className }: DisclosureProps) {
  const classes = ['jr-disclosure', className].filter(Boolean).join(' ');
  return (
    <details className={classes} open={defaultOpen || undefined}>
      <summary className="jr-disclosure__summary type-body-small">
        <span className="jr-disclosure__label">{summary}</span>
        <Icon name="chevron" small mirror className="jr-disclosure__chevron" />
      </summary>
      <div className="jr-disclosure__body">{children}</div>
    </details>
  );
}
