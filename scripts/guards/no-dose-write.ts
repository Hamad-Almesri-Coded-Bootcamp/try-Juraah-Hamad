/**
 * Guard 4 — G1: no code path writes Dose.status, and no notification carries an action.
 * Static approximation, documented in BACKEND-NOTES §7:
 *  (a) no object literal `status: '<dose word>'` outside the seed, the schedule generator, contracts and tests;
 *  (b) no assignment `.status = '<dose word>'` anywhere, and no `dose.status =` at all;
 *  (c) no `actions:` on a notification (showNotification / new Notification), repo-wide incl. public/sw.js;
 *  (d) no exported data-layer function whose name suggests recording, marking or logging a dose.
 * Phase 2 (P2-WP1) — the database and the HTTP surface too, supabase/** and app/api/**:
 *  (e) no line and no statement that both UPDATEs/SETs and names 'missed' (rule 4: nothing
 *      turns a dose into `missed` from the clock — no function, job or trigger does, and this
 *      proves none exists; the dose_status_t enum's own label list neither updates nor sets);
 *  (f) no `update doses set … status` anywhere in them — the migrations contain none (the one
 *      status write path is jurah_agent's column grant, exercised by app/api/agent, WP7).
 */
import { existsSync as exists, readdirSync } from 'node:fs';
import { walk, scan, rel, sqlWithoutComments, type GuardResult, type Violation } from './_shared';
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
  // (e)/(f) supabase/** and app/api/**
  const notes: string[] = [];
  const dbFiles = [...walk('supabase', ['.sql']), ...walk('app/api', ['.ts', '.tsx', '.js', '.sql'])].map(rel);
  if (exists('supabase/migrations') && readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).length === 0) {
    v.push({ file: 'supabase/migrations', line: 0, text: '', rule: 'guard input missing — supabase/migrations holds no .sql' });
  }
  const dbViolations: Violation[] = [];
  for (const f of dbFiles) {
    const lines = f.endsWith('.sql') ? sqlWithoutComments(readFileSync(f, 'utf8')) : readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/missed/i.test(line) && /\b(update|set)\b/i.test(line)) dbViolations.push({ file: f, line: i + 1, text: line.trim().slice(0, 140), rule: "'missed' on an update/set line" });
    });
    const text = lines.join('\n');
    let offset = 0;
    for (const stmt of text.split(';')) {
      const lineNo = text.slice(0, offset).split('\n').length;
      offset += stmt.length + 1;
      if (/\bupdate\b[\s\S]*\bset\b/i.test(stmt) && /'missed'/i.test(stmt)) dbViolations.push({ file: f, line: lineNo, text: stmt.trim().slice(0, 140), rule: "a statement that updates and names 'missed'" });
      if (/\bupdate\s+(public\.)?doses\s+set\b[\s\S]*\bstatus\b/i.test(stmt)) dbViolations.push({ file: f, line: lineNo, text: stmt.trim().slice(0, 140), rule: 'update doses set status' });
    }
  }
  v.push(...dbViolations);
  notes.push(`supabase/** and app/api/** scanned: ${dbFiles.length} file(s)${exists('app/api') ? '' : ' (app/api does not exist yet — WP6/WP7 create it; the rule applies the moment it does)'}`);
  return { name: 'guard 4 · G1: no Dose.status write path, no notification action', violations: v, notes };
}
