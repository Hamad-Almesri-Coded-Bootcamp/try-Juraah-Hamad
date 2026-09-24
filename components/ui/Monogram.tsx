import { Icon } from './Icon';

/**
 * Monogram (CR-071, a Daylight addition to the design system): the first letters of the name on the
 * box, in a soft tile, so a row matches the pack the patient holds. Decorative — the name itself is
 * always printed beside it — so it is hidden from assistive technology.
 */
export interface MonogramProps {
  /** The name to take the letters from (already in the reader's language). */
  name: string;
  size?: 'md' | 'lg';
  /** A past or inactive medicine. */
  muted?: boolean;
  className?: string;
}

/** Latin: one capital and one lower-case letter ("Br"). Arabic: the first two letters ("بر"). */
export function monogramLetters(name: string): string {
  if (name.trim() === '(unreadable)') return '';
  const word = (name.trim().split(/\s+/)[0] ?? '').replace(/[^\p{L}\p{N}]/gu, '');
  const chars = Array.from(word);
  if (chars.length === 0) return '';
  const [first, second = ''] = chars;
  return /[A-Za-z]/.test(first!) ? `${first!.toUpperCase()}${second.toLowerCase()}` : `${first}${second}`;
}

export function Monogram({ name, size = 'md', muted = false, className }: MonogramProps) {
  const classes = ['jr-mono', size === 'lg' ? 'jr-mono--lg' : null, muted ? 'jr-mono--muted' : null, className]
    .filter(Boolean)
    .join(' ');
  const letters = monogramLetters(name);
  return (
    <span className={classes} aria-hidden="true" dir="auto">
      {letters || <Icon name="capsule" small />}
    </span>
  );
}
