import type * as React from 'react';
import { Icon, type IconName } from './Icon';

export interface TagProps {
  /**
   * neutral — a plain fact (a source's level); info — navy-tint, a label that asks for attention (an
   * AI draft); success — a done state (checked by a person). Never the danger token: red stays for
   * the finding itself.
   */
  tone: 'neutral' | 'info' | 'success';
  children: React.ReactNode;
  icon?: IconName;
  className?: string;
}

/**
 * A short label on a surface (CR-113, a pending component the design system lacks). Not
 * interactive: no onClick, no close control. The words come from the consumer, already translated.
 */
export function Tag({ tone, children, icon, className }: TagProps) {
  const classes = ['jr-tag', `jr-tag--${tone}`, className].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      {icon && <Icon name={icon} small className="jr-tag__icon" />}
      <span className="jr-tag__label type-label">{children}</span>
    </span>
  );
}
