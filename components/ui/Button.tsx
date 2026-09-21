import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { copy, t, type Locale } from '@/i18n';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = navy fill · secondary = border-strong outline · danger = danger fill · quiet = no fill, no border. Default 'primary'. */
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
  /** md sets the label type style, lg sets body-strong and a taller box. Default 'md'. */
  size?: 'md' | 'lg';
  /** Swaps the leading icon for a spinner, sets aria-busy and disables the button. The label stays put. */
  loading?: boolean;
  /** Stretches the button to its container — the phone-width default for a primary action. */
  fullWidth?: boolean;
  /** Name of a leading icon from the bundle's outline set. */
  icon?: IconName;
  /** Mirrors the leading icon under dir="rtl". Only for glyphs that encode direction. */
  mirrorIcon?: boolean;
  /** Language of the bundle's own fallback copy (the screen-reader 'Loading' text). Default 'en'. */
  lang?: Locale;
  children?: ReactNode;
}

/**
 * The system's standard action control: four variants, two sizes, a 44×44px minimum box (48 at
 * `size="lg"`). Renders the bundle's `.wsf-btn` anatomy verbatim — see docs/design-system/components/Button.md.
 *
 * G1: this component never writes `Dose.status`. There is no "taken", "mark as missed" or "snooze"
 * variant, in any colour — that path belongs to the Adherence Agent's chat alone, and its absence
 * here is the product's central safety claim, not a gap to fill in later.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  mirrorIcon,
  lang = 'en',
  className,
  children,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    'wsf-btn',
    `wsf-btn--${variant}`,
    size === 'lg' ? 'wsf-btn--lg' : null,
    fullWidth ? 'wsf-btn--block' : null,
    size === 'lg' ? 'type-body-strong' : 'type-label',
    'wsf-focus',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button {...rest} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={classes}>
      {loading ? (
        <span className="wsf-spinner" aria-hidden="true" />
      ) : icon ? (
        <Icon name={icon} mirror={mirrorIcon} />
      ) : null}
      {children}
      {loading && <span className="wsf-sr">{t(copy.vocabulary.loading, lang)}</span>}
    </button>
  );
}
