/** Guard 5 — bidirectional by construction: no physical left/right in CSS or Tailwind classes. */
import { walk, scan, type GuardResult } from './_shared';

const PHYSICAL_CSS = /(^|[^-\w])(left|right)\s*:|\b(margin|padding|border|inset|scroll-margin|scroll-padding)-(left|right)\b|\btext-align\s*:\s*(left|right)\b|\bborder-(top|bottom)-(left|right)-radius\b|\bfloat\s*:\s*(left|right)\b|\bclear\s*:\s*(left|right)\b/;
const PHYSICAL_TW = /(^|[\s"'`{(])-?(ml|mr|pl|pr|left|right|inset-x|rounded-[lr]|rounded-[tb][lr]|border-[lr]|scroll-m[lr]|scroll-p[lr]|origin-(left|right|top-left|top-right|bottom-left|bottom-right)|bg-(left|right)|object-(left|right)|float-(left|right)|clear-(left|right)|text-(left|right))(-[^\s"'`})]+)?(?=[\s"'`})]|$)/;

export function run(): GuardResult {
  const files = [...['app', 'components', 'features'].flatMap((d) => walk(d, ['.ts', '.tsx', '.css'])), 'styles/theme.css', 'styles/base.css'];
  const v = [
    ...scan(files, 'physical CSS property', PHYSICAL_CSS, (l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\[dir=/.test(l)),
    ...scan(files.filter((f) => /\.tsx?$/.test(f)), 'physical Tailwind class', PHYSICAL_TW, (l) => /className|class=|cx\(|clsx\(|cn\(/.test(l) || /['"`]/.test(l)),
  ];
  return { name: 'guard 5 · logical properties only (no left/right)', violations: v };
}
