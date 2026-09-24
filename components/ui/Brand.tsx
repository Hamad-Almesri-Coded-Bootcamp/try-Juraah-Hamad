/**
 * The day mark and the brand lockup (CR-072, a Daylight addition to the design system): the Today
 * dial as the product's logo, a day's track with two doses on it, at 08:00 and 20:00.
 *
 * Rules it carries:
 * - A clock face is a real-world object, so the mark never mirrors in RTL. Only the lockup's order
 *   follows `dir`: the mark sits at the start, before the name, in both languages.
 * - It is decorative: the name is always printed beside it as text from the copy catalogue, so the
 *   mark is hidden from assistive technology and a screen reader hears the name once.
 * - Navy and white only (daylight.css): `border-strong` track and `navy` doses on light surfaces,
 *   the sky's `glass-line` track and `on-fill` doses inside `.jr-sky`. Never `danger`.
 * - The track is two arcs with a gap around each dose, not a full ring with a knocked-out stroke,
 *   so the mark needs no background colour and no mask id and sits on any surface.
 */

/** Two arcs of the 24-hour face (r 31, midnight at the top), each stopping 12 units short of a dose. */
const TRACK = 'M68.95 74.53A31 31 0 0 1 19.28 45.86M31.05 25.47A31 31 0 0 1 80.72 54.14';
/** 08:00 and 20:00 on the same face. */
const DOSES = [
  { cx: 76.85, cy: 65.5 },
  { cx: 23.15, cy: 34.5 },
] as const;

export function DayMark({ className }: { className?: string }) {
  return (
    <svg
      className={['jr-daymark', className].filter(Boolean).join(' ')}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <path className="jr-daymark__track" d={TRACK} strokeWidth={11} fill="none" />
      {DOSES.map((d) => (
        <circle key={d.cx} className="jr-daymark__dose" cx={d.cx} cy={d.cy} r={8} />
      ))}
    </svg>
  );
}

export interface BrandProps {
  /** The name as the reader sees it, from the copy catalogue (`shell.appName` or `shell.clinicWordmark`). */
  name: string;
  /** Carries the wordmark's type (`jr-wordmark`, `jr-display text-h2`…); the mark scales with it. */
  className?: string;
}

/** The mark and the name on one line. Replaces a bare wordmark wherever the product names itself. */
export function Brand({ name, className }: BrandProps) {
  return (
    <span className={['jr-brand', className].filter(Boolean).join(' ')}>
      <DayMark />
      <span className="jr-brand__name">{name}</span>
    </span>
  );
}
