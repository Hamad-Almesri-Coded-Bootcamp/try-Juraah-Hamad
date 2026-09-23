import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface AppBarSharedProps {
  /** The screen's h1 title. */
  title: ReactNode;
  /** One trailing control — an IconButton or a quiet Button. */
  action?: ReactNode;
  className?: string;
}

interface AppBarNoBack extends AppBarSharedProps {
  onBack?: undefined;
  backHref?: undefined;
  backLabel?: undefined;
}

interface AppBarWithOnBack extends AppBarSharedProps {
  /** Adds the back control as a button. Its chevron mirrors under dir="rtl". */
  onBack: () => void;
  backHref?: undefined;
  /** Accessible name of the back control. Required whenever onBack is set. */
  backLabel: string;
}

interface AppBarWithBackHref extends AppBarSharedProps {
  onBack?: undefined;
  /** Adds the back control as a real link, for navigation. Either this or onBack. */
  backHref: string;
  /** Accessible name of the back control. Required whenever backHref is set. */
  backLabel: string;
}

/**
 * Props exactly as docs/design-system/index.d.ts's AppBarProps, narrowed to a discriminated union so
 * backLabel is required at the type level whenever onBack or backHref is set (WP2d interpretation of
 * "backLabel required with onBack" — recorded in README/AppBar.md and the WP2d report; every branch
 * still structurally satisfies the flat AppBarProps shape index.d.ts declares). onBack and backHref
 * are mutually exclusive, matching "Either this or onBack" in index.d.ts.
 */
export type AppBarProps = AppBarNoBack | AppBarWithOnBack | AppBarWithBackHref;

/**
 * The screen's header (Navigation): a navy bar carrying the h1 title, an optional back control whose
 * chevron mirrors in RTL, and one optional trailing action. Renders as a <header>; never used inside a
 * Sheet, which carries its own header and close control.
 *
 * group a's IconButton is not yet built, so the back control is the plain-element stand-in the WP2d
 * brief names: a <button>/<a> carrying the bundle's own IconButton anatomy (`.wsf-btn.wsf-btn--quiet`
 * for colour/shape, `.wsf-iconbtn` for the 44px square hit area, `.wsf-focus` for the ring) rather than
 * the literal `<button class="wsf-iconbtn wsf-focus">` the brief's prose shows — `.wsf-iconbtn` alone
 * carries no colour, border-radius or centring, so the fuller class list is the one that actually
 * renders IconButton.md's anatomy. Recorded in the WP2d report.
 */
export function AppBar({ title, onBack, backHref, backLabel, action, className }: AppBarProps) {
  const classes = ['wsf-appbar', className].filter(Boolean).join(' ');

  const back = onBack ? (
    <button
      type="button"
      className="wsf-btn wsf-btn--quiet wsf-iconbtn wsf-focus"
      aria-label={backLabel}
      onClick={onBack}
    >
      <Icon name="chevron" mirror reverse />
    </button>
  ) : backHref ? (
    <a href={backHref} className="wsf-btn wsf-btn--quiet wsf-iconbtn wsf-focus" aria-label={backLabel}>
      <Icon name="chevron" mirror reverse />
    </a>
  ) : null;

  return (
    <header className={classes}>
      {back}
      <h1 className="wsf-appbar__title type-h1">{title}</h1>
      {action}
    </header>
  );
}
