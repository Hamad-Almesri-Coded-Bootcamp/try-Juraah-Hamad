import icons from '@/design/icons.json';

export type IconName = keyof typeof icons.paths;
export const ICON_NAMES = Object.keys(icons.paths) as IconName[];

export interface IconProps {
  /** One of the design system's 26 outline glyphs. */
  name: IconName;
  /** 20px box instead of 24px. Only where the guideline allows it. */
  small?: boolean;
  /**
   * Mirror under dir="rtl". Only for glyphs that encode direction (chevron, subscribe) — never a
   * capsule, clock, checkmark or numeral (brand book: "Arabic and English in one layout").
   */
  mirror?: boolean;
  /**
   * Point the glyph the other way in both directions — a BACKWARD chevron (audit C5, 2026-09-23).
   * The one `chevron` glyph points to the reading end in LTR; `mirror` flips it only under RTL, so
   * `chevron + mirror` is a FORWARD arrow in both languages (a row's "open"). A back or previous
   * control needs `mirror` and `reverse` together: LTR points left, RTL points right. `reverse` is
   * `scale`, `wsf-mirror` is `transform`, so the two compose. The design system's reference draws
   * back as `chevron + mirror` too — a gap logged in docs/DECISIONS.md, not a style choice.
   */
  reverse?: boolean;
  className?: string;
}

/**
 * The 26-glyph outline icon set, drawn in currentColor, 2px stroke, decorative to assistive
 * technology (an icon never carries meaning alone — the label beside it does). Paths come from
 * design/icons.json, extracted once from the design system's bundle.js.
 */
export function Icon({ name, small, mirror, reverse, className }: IconProps) {
  const d = icons.paths[name];
  const classes = ['wsf-ico', small ? 'wsf-ico--sm' : null, mirror ? 'wsf-mirror' : null, reverse ? '-scale-x-100' : null, className]
    .filter(Boolean)
    .join(' ');
  return (
    <svg className={classes} viewBox={icons.viewBox} role="presentation" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}
