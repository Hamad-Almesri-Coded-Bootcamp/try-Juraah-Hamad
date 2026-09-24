import type * as React from 'react';
import Link from 'next/link';
import { Icon, type IconName } from './Icon';

export interface MenuRowProps {
  label: React.ReactNode;
  /** A short value shown at the row's end, e.g. a setting's current state or a relationship state. */
  value?: React.ReactNode;
  /** A line under the label instead of (or beside) `value`. */
  description?: React.ReactNode;
  icon?: IconName;
  href?: string;
  onClick?: () => void;
  /**
   * 'relationship' marks a caregiver-invitation state ("awaiting acceptance", "declined", "expired",
   * "revoked"). Both tones render `value` in ink-muted with no badge, dot or alert icon — a
   * relationship state is never a fault state (CLAUDE.md rule 8, brand book).
   */
  tone?: 'default' | 'relationship';
  /** A control slot at the row's end — a Toggle in a settings list. Mutually exclusive with
   * `href`/`onClick`: two nested interactive targets in one row is one the patient cannot reach. */
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * One destination or setting in a list: label, optional value or description, chevron that mirrors
 * in RTL (Build Prompts prompt 1). Used for More, profile, help, settings rows, the clinic lists and
 * the patient's caregiver list — whose value slot must read well holding a relationship state.
 */
export function MenuRow({ label, value, description, icon, href, onClick, tone = 'default', trailing, className }: MenuRowProps) {
  const interactive = !trailing && (Boolean(href) || Boolean(onClick));
  // A trailing control makes the row wrap at phone width (MenuRow.css, audit M13); every other row
  // keeps its one-line layout.
  const classes = ['jr-menu-row', trailing ? 'jr-menu-row--trailing' : null, interactive ? 'wsf-focus' : null, className]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {icon ? <Icon name={icon} className="jr-menu-row__icon" /> : null}
      <span className="jr-menu-row__text">
        <span className="jr-menu-row__label type-body">{label}</span>
        {description ? <span className="jr-menu-row__desc type-body-small">{description}</span> : null}
      </span>
      {value ? (
        <span className="jr-menu-row__value type-body-small" data-tone={tone}>
          {value}
        </span>
      ) : null}
      {trailing ? <span className="jr-menu-row__trailing">{trailing}</span> : null}
      {interactive ? <Icon name="chevron" mirror className="jr-menu-row__go" /> : null}
    </>
  );

  if (interactive && href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  if (interactive && onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}
