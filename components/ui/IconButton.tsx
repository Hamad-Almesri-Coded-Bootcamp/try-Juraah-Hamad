import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required. The accessible name — an icon-only control has no other one. */
  label: string;
  /** Name of an icon from the bundle's outline set. */
  icon: IconName;
  variant?: 'quiet' | 'primary' | 'secondary' | 'danger';
  /** Mirrors the glyph under dir="rtl". Use for chevrons and the calendar-subscribe arrow only. */
  mirrorIcon?: boolean;
  /** Points the glyph backward (Icon's `reverse`) — with `mirrorIcon`, a back or previous chevron. */
  reverseIcon?: boolean;
  /** Renders a real link instead of a button — for a back control or any navigation. */
  href?: string;
}

/**
 * An icon-only control that keeps a 44×44px hit area no matter how small its glyph is drawn.
 * See docs/design-system/components/IconButton.md.
 */
export function IconButton({
  label,
  icon,
  variant = 'quiet',
  mirrorIcon,
  reverseIcon,
  href,
  className,
  type = 'button',
  disabled,
  ...rest
}: IconButtonProps) {
  const classes = ['wsf-btn', `wsf-btn--${variant}`, 'wsf-iconbtn', 'wsf-focus', className].filter(Boolean).join(' ');

  if (href) {
    // `rest` is typed for a <button> (index.d.ts extends ButtonHTMLAttributes even though `href`
    // renders an <a> — a design-system prop-shape gap, reported rather than changed here).
    const anchorRest = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a href={href} aria-label={label} className={classes} {...anchorRest}>
        <Icon name={icon} mirror={mirrorIcon} reverse={reverseIcon} />
      </a>
    );
  }

  return (
    <button {...rest} type={type} disabled={disabled} aria-label={label} className={classes}>
      <Icon name={icon} mirror={mirrorIcon} reverse={reverseIcon} />
    </button>
  );
}
