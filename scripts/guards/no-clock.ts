/**
 * Guard 6 — G3: no Date.now() and no argument-less new Date() outside lib/config.ts.
 * Phase 2 (P2-WP1, D-021): also scripts/db/** (lib/db/** and lib/data/pg/** are under lib/), and
 * the SQL in supabase/**: no now() / current_timestamp / clock_timestamp() / statement_timestamp()
 * / transaction_timestamp() / current_date / localtimestamp anywhere EXCEPT inside jurah_now()'s
 * own body (its wall-clock fallback) — every other SQL clock read goes through jurah_now().
 * D-037 (P2-WP5 follow-up): ONE more body may read the wall clock — lookup_masked_name() (migration
 * 0010), whose rate-limit window is an operational control, not a domain time comparison. The
 * allow is by function name, for the lines between its `create or replace function` and `$$;`
 * only; the notes line names both functions and counts each one's reads.
 */
import { existsSync, readFileSync } from 'node:fs';
import { walk, scan, rel, sqlWithoutComments, type GuardResult, type Violation } from './_shared';

/** The only SQL function bodies that may read the wall clock: jurah_now()'s fallback (D-021) and the
 * masked-name rate-limit window (D-037). */
const CLOCK_ALLOWED = ['jurah_now', 'lookup_masked_name'];

const SQL_CLOCK = /\bnow\s*\(\s*\)|\bcurrent_timestamp\b|\bclock_timestamp\s*\(|\bstatement_timestamp\s*\(|\btransaction_timestamp\s*\(|\bcurrent_date\b|\blocaltimestamp\b|\bcurrent_time\b|\blocaltime\b/i;

function sqlClockViolations(): { v: Violation[]; files: number; exempt: Record<string, number> } {
  const v: Violation[] = [];
  const exempt: Record<string, number> = Object.fromEntries(CLOCK_ALLOWED.map((n) => [n, 0]));
  const files = walk('supabase', ['.sql']).map(rel);
  if (existsSync('supabase') && files.length === 0) v.push({ file: 'supabase', line: 0, text: '', rule: 'guard input missing — supabase/ holds no .sql' });
  for (const f of files) {
    const lines = sqlWithoutComments(readFileSync(f, 'utf8'));
    let inAllowed: string | null = null;
    lines.forEach((line, i) => {
      const fn = /create\s+or\s+replace\s+function\s+(?:public\.)?(\w+)\s*\(/i.exec(line)?.[1];
      if (fn && CLOCK_ALLOWED.includes(fn)) inAllowed = fn;
      if (SQL_CLOCK.test(line)) {
        if (inAllowed) exempt[inAllowed] = (exempt[inAllowed] ?? 0) + 1;
        else v.push({ file: f, line: i + 1, text: line.trim().slice(0, 140), rule: `SQL clock read outside ${CLOCK_ALLOWED.join('() / ')}()` });
      }
      if (inAllowed && /^\s*\$\$;\s*$/.test(line)) inAllowed = null;
    });
  }
  return { v, files: files.length, exempt };
}

export function run(): GuardResult {
  const files = ['app', 'components', 'features', 'lib', 'i18n', 'types', 'public', 'scripts/db'].flatMap((d) => walk(d, ['.ts', '.tsx', '.js'])).filter((f) => rel(f) !== 'lib/config.ts');
  // Comment lines and test titles may NAME the forbidden call (a test asserting its absence must); code may not.
  const isProse = (l: string) => /^\s*(\/\/|\*|\/\*)/.test(l) || /^\s*(it|test|describe)\s*\(/.test(l);
  const v = [
    ...scan(files, 'Date.now()', /\bDate\.now\s*\(/, (l) => !isProse(l)),
    ...scan(files, 'new Date() without an argument', /\bnew\s+Date\s*\(\s*\)/, (l) => !isProse(l)),
  ];
  const sqlc = sqlClockViolations();
  v.push(...sqlc.v);
  const allowed = Object.entries(sqlc.exempt).map(([fn, n]) => `${n} in ${fn}()`).join(', ');
  const notes = [`SQL: ${sqlc.files} migration file(s) scanned; clock reads allowed only inside ${CLOCK_ALLOWED.join('() and ')}() (D-021 fallback, D-037 rate-limit window): ${allowed}; code: lib/db/**, lib/data/pg/**, scripts/db/** included`];
  return { name: 'guard 6 · G3: REFERENCE_NOW drives every time comparison (no Date.now())', violations: v, notes };
}
