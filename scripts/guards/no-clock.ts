/** Guard 6 — G3: no Date.now() and no argument-less new Date() outside lib/config.ts. */
import { walk, scan, rel, type GuardResult } from './_shared';

export function run(): GuardResult {
  const files = ['app', 'components', 'features', 'lib', 'i18n', 'types', 'public'].flatMap((d) => walk(d, ['.ts', '.tsx', '.js'])).filter((f) => rel(f) !== 'lib/config.ts');
  // Comment lines and test titles may NAME the forbidden call (a test asserting its absence must); code may not.
  const isProse = (l: string) => /^\s*(\/\/|\*|\/\*)/.test(l) || /^\s*(it|test|describe)\s*\(/.test(l);
  const v = [
    ...scan(files, 'Date.now()', /\bDate\.now\s*\(/, (l) => !isProse(l)),
    ...scan(files, 'new Date() without an argument', /\bnew\s+Date\s*\(\s*\)/, (l) => !isProse(l)),
  ];
  return { name: 'guard 6 · G3: REFERENCE_NOW drives every time comparison (no Date.now())', violations: v };
}
