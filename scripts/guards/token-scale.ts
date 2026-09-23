/**
 * Guard T — no spacing utility the theme does not generate (audit C3, 2026-09-23).
 *
 * styles/theme.css resets Tailwind's spacing scale (`--spacing-*: initial`) and names only the
 * token steps. Any spacing-family utility on a step it does not name — `bottom-24`, `h-14`,
 * `max-h-96`, and even `inset-0` / `top-0` before the zero step existed — compiles to NO CSS AT ALL,
 * silently. That is how the assistant launcher sat below the edge of every phone, how the Sheet and
 * assistant layers were 0×0 boxes, and how the caregiver's whose-data banner stopped being sticky.
 *
 * The allowed steps are read from theme.css itself (every `--spacing-<name>:` it defines), so adding
 * a named step there is the one way to make a new size legal. Keyword values Tailwind generates
 * without the theme (full, auto, dvh, fractions, arbitrary `[…]`) are allowed. The input exists from
 * day one (theme.css and the UI folders), so this guard can never pass by absence.
 */
import { readFileSync } from 'node:fs';
import { walk, rel, isDevSurface, UI_DIRS, type GuardResult, type Violation } from './_shared';

const FAMILIES = [
  'p', 'px', 'py', 'pt', 'pb', 'ps', 'pe',
  'm', 'mx', 'my', 'mt', 'mb', 'ms', 'me',
  'gap', 'gap-x', 'gap-y', 'space-x', 'space-y',
  'inset', 'inset-x', 'inset-y', 'top', 'bottom', 'start', 'end',
  'w', 'h', 'min-w', 'min-h', 'max-w', 'max-h', 'size',
  'translate-x', 'translate-y', 'scroll-m', 'scroll-p', 'basis',
];
/** Values Tailwind resolves without the spacing theme. */
const KEYWORDS = new Set([
  'full', 'auto', 'screen', 'dvh', 'dvw', 'svh', 'svw', 'lvh', 'lvw', 'min', 'max', 'fit', 'px', 'none', 'prose',
  '3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl',
]);

// Longest family names first so `min-h-48` is read as min-h + 48, not h + 48.
const FAMILY_ALT = [...FAMILIES].sort((a, b) => b.length - a.length).map((f) => f.replace('-', '\\-')).join('|');
// A class token: optional variant prefix ending in `:`, optional negative, family, `-`, a bare step.
// The look-behind keeps `--space-3`-style custom properties out; the look-ahead keeps fractions,
// arbitrary values and longer words (`w-rail-wide` is read whole) out.
const TOKEN = new RegExp(`(?<![\\w-])(?:[^\\s"'\`{}()]*:)?-?(${FAMILY_ALT})-([a-z0-9][a-z0-9.-]*)(?![\\w/\\[-])`, 'g');

export function themeSteps(css: string): Set<string> {
  const steps = new Set<string>();
  for (const m of css.matchAll(/--spacing-([a-z0-9-]+)\s*:/g)) steps.add(m[1]!);
  return steps;
}

export function findUngenerated(text: string, steps: Set<string>): { step: string; token: string; line: number }[] {
  const out: { step: string; token: string; line: number }[] = [];
  text.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments describe classes; they do not ship them
    for (const m of line.matchAll(TOKEN)) {
      const step = m[2]!;
      if (KEYWORDS.has(step) || steps.has(step)) continue;
      out.push({ step, token: m[0], line: i + 1 });
    }
  });
  return out;
}

export function run(): GuardResult {
  const steps = themeSteps(readFileSync('styles/theme.css', 'utf8'));
  const files = UI_DIRS.flatMap((d) => walk(d, ['.tsx', '.ts'])).filter((f) => !isDevSurface(f) && !/\.test\.tsx?$/.test(f));
  const violations: Violation[] = [];
  for (const f of files) {
    for (const hit of findUngenerated(readFileSync(f, 'utf8'), steps)) {
      violations.push({ file: rel(f), line: hit.line, text: hit.token, rule: `step "${hit.step}" is not a --spacing-* token in styles/theme.css` });
    }
  }
  return {
    name: 'guard T · every spacing utility names a step the theme generates',
    violations,
    notes: [`theme steps: ${[...steps].join(', ')} (styles/theme.css) · ${files.length} files scanned`],
  };
}
