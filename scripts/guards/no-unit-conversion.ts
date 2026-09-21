/**
 * Guard U — `Prescription.drug.strengthMg` holds the number in the unit `strengthUnit` names (rx-008 is
 * `strengthMg: 50, strengthUnit: "mcg"`, never 0.05). Nothing may multiply, divide or otherwise convert it:
 * a reader who trusts the field name produces a 1000× levothyroxine dose. Owner's rule 3, Gate 0b.
 *  (a) `strengthMg` on either side of `*` or `/`, or inside Math / Number arithmetic helpers;
 *  (b) the literals 1000 / 0.001 / 1e3 / 1e-3 on any line that also mentions strength;
 *  (c) any identifier suggesting a unit conversion (toMg, toMcg, mgToMcg, convertStrength, …).
 */
import { walk, scan, rel, type GuardResult } from './_shared';

export function run(): GuardResult {
  const code = walk('.', ['.ts', '.tsx', '.js', '.mjs']).filter((f) => !rel(f).startsWith('scripts/'));
  const notComment = (l: string) => !/^\s*(\/\/|\*|\/\*)/.test(l);
  const v = [
    ...scan(code, 'arithmetic on strengthMg', /strengthMg\s*\)?\s*[*/]|[*/]\s*\(?\s*[\w.]*strengthMg/, notComment),
    ...scan(code, 'unit factor beside a strength', /strength/i, (l) => notComment(l) && /\b(1000|0\.001|1e3|1e-3)\b/.test(l)),
    ...scan(code, 'unit-conversion helper', /\b(to(Mg|Mcg|Gram|Grams|Ml|IU)|(mg|mcg|g|ml|iu)To(Mg|Mcg|G|Ml|IU)|convert(Strength|Unit|Dose))\b/, notComment),
  ];
  return { name: 'guard U · strengthMg is displayed as written, never converted', violations: v };
}
