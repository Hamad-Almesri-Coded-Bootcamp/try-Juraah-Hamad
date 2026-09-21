/**
 * Guard 7, part two — no literal user-facing string outside the copy catalogue (i18n/copy).
 * Part one is eslint react/jsx-no-literals (JSX children). This part catches:
 *  (a) any Arabic-script literal in ui code,
 *  (b) sentence-like string values on the props that carry copy (label, title, placeholder, …).
 */
import { walk, scan, isDevSurface, type GuardResult, UI_DIRS } from './_shared';

const COPY_PROPS = '(label|title|placeholder|helperText|description|error|alt|aria-label|aria-description|closeLabel|backLabel|retryLabel|dismissLabel|emptyLabel|emptyMark|severityLabel|reviewLabel|unit|doseTimeLabel|strengthUnit)';

export function run(): GuardResult {
  // Unit tests beside a component render literal fixtures on purpose and never ship.
  const files = UI_DIRS.flatMap((d) => walk(d, ['.ts', '.tsx'])).filter((f) => !isDevSurface(f) && !/\.test\.tsx?$/.test(f));
  const v = [
    ...scan(files, 'Arabic literal in ui code', /['"`][^'"`]*[؀-ۿ][^'"`]*['"`]/, (l) => !/^\s*(\/\/|\*|\/\*)/.test(l)),
    ...scan(files, 'copy literal on a prop', new RegExp(`\\b${COPY_PROPS}\\s*=\\s*["'][^"']*[A-Za-z]{2,}[^"']*["']`), (l) => !/^\s*(\/\/|\*|\/\*)/.test(l)),
    ...scan(files, 'copy literal on a prop (object)', new RegExp(`\\b${COPY_PROPS}\\s*:\\s*["'][^"']*\\s[^"']*[A-Za-z]{2,}[^"']*["']`), (l) => !/^\s*(\/\/|\*|\/\*)/.test(l)),
  ];
  return { name: 'guard 7 · no literal user-facing string outside i18n/copy', violations: v };
}
