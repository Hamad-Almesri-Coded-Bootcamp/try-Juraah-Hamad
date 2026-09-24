import type * as React from 'react';
import Link from 'next/link';

export interface CardProps {
  /** Defaults to 'button' when onClick is set, 'div' otherwise. Set 'a' (with href) to render a link. */
  as?: 'div' | 'section' | 'li' | 'button' | 'a';
  onClick?: React.MouseEventHandler;
  href?: string;
  /** Drops shadow-sm — for a card inside another surface. */
  flat?: boolean;
  'aria-label'?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * The base surface every grouped block sits on: surface-card, radius-md, shadow-sm, space-3 padding
 * (docs/design-system/components/Card.md). A tappable card carries `.wsf-focus` and a full-width hit
 * area; give it an `aria-label` naming its destination whenever its own text runs to several lines.
 */
export function Card({ as, onClick, href, flat, className, children, ...rest }: CardProps) {
  const tag = as ?? (onClick ? 'button' : 'div');
  const classes = ['wsf-card', flat ? 'wsf-card--flat' : null, tag === 'button' || tag === 'a' ? 'wsf-focus' : null, className]
    .filter(Boolean)
    .join(' ');

  if (tag === 'button') {
    return (
      <button type="button" className={classes} onClick={onClick} {...rest}>
        {children}
      </button>
    );
  }
  if (tag === 'a') {
    return (
      <Link href={href ?? '#'} className={classes} onClick={onClick} {...rest}>
        {children}
      </Link>
    );
  }
  const Tag = tag;
  return (
    <Tag className={classes} onClick={onClick} {...rest}>
      {children}
    </Tag>
  );
}
