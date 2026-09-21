/**
 * Guard 4 — G1: no code path writes Dose.status, and no notification carries an action.
 * Static approximation, documented in BACKEND-NOTES §7:
 *  (a) no object literal `status: '<dose word>'` outside the seed, the schedule generator, contracts and tests;
 *  (b) no assignment `.status = '<dose word>'` anywhere, and no `dose.status =` at all;
 *  (c) no `actions:` on a notification (showNotification / new Notification), repo-wide incl. public/sw.js;
 *  (d) no exported data-layer function whose name suggests recording, marking or logging a dose.
 */
import { walk, scan, rel, type GuardResult } from './_shared';
import { existsSync, readFileSync } from 'node:fs';

const DOSE_WORDS = '(upcoming|taken_on_time|taken_late|missed)';

export function run(): GuardResult {
  const code = walk('.', ['.ts', '.tsx', '.js', '.mjs']).filter((f) => !rel(f).startsWith('scripts/'));
  const allowedToConstructDoses = (f: string) =>
    /^lib\/data\/mock\/seed/.test(rel(f)) || rel(f).startsWith('lib/schedule/') || rel(f).startsWith('tests/') || rel(f) === 'types/contracts.ts' || /\.test\.tsx?$/.test(rel(f));
  const v = [
    ...scan(code.filter((f) => !allowedToConstructDoses(f)), 'dose status literal in an object', new RegExp(`\\bstatus\\s*:\\s*['"]${DOSE_WORDS}['"]`)),
    ...scan(code, 'assignment to .status with a dose word', new RegExp(`\\.status\\s*=(?!=)\\s*['"]${DOSE_WORDS}['"]`)),
    ...scan(code, 'assignment to dose.status', /\bdoses?(\[[^\]]*\])?\.status\s*=(?!=)/),
    ...scan(code, 'notification action', /\bactions\s*:/, (l) => !/^\s*(\/\/|\*|\/\*)/.test(l)),
    ...scan(code, 'NotificationAction type', /\bNotificationAction\b/),
  ];
  const api = 'lib/data/api.ts';
  if (existsSync(api)) {
    const src = readFileSync(api, 'utf8');
    const names = [...src.matchAll(/^\s*(?:export\s+)?(?:declare\s+)?(?:async\s+)?function\s+(\w+)|^\s*(\w+)\s*\(/gm)].map((m) => m[1] ?? m[2]).filter(Boolean) as string[];
    for (const n of names) {
      if (/dose/i.test(n) && /(record|mark|log|set|update|write|take|miss)/i.test(n)) v.push({ file: api, line: 0, text: n, rule: 'data function that could write a dose status' });
    }
  }
  return { name: 'guard 4 · G1: no Dose.status write path, no notification action', violations: v };
}
