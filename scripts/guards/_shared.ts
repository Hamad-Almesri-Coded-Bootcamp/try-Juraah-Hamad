import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export type Violation = { file: string; line: number; text: string; rule: string };
export type GuardResult = { name: string; violations: Violation[]; notes?: string[] };

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'out', 'coverage', 'playwright-report', 'test-results']);

export function walk(dir: string, exts: string[], out: string[] = []): string[] {
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
}

export function rel(p: string): string {
  return relative(process.cwd(), p).split(sep).join('/');
}

/** The dev-only gallery is exempt from the visual and copy guards (never built for production). */
export function isDevSurface(p: string): boolean {
  return rel(p).startsWith('app/(dev)/');
}

export function scan(files: string[], rule: string, re: RegExp, filter?: (line: string) => boolean): Violation[] {
  const v: Violation[] = [];
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (re.test(line) && (!filter || filter(line))) v.push({ file: rel(f), line: i + 1, text: line.trim().slice(0, 140), rule });
      re.lastIndex = 0;
    });
  }
  return v;
}

export function report(r: GuardResult): boolean {
  if (r.violations.length === 0) {
    console.log(`✓ ${r.name}`);
  } else {
    console.log(`✗ ${r.name} — ${r.violations.length} violation(s)`);
    for (const v of r.violations) console.log(`    ${v.file}:${v.line}  [${v.rule}]  ${v.text}`);
  }
  for (const n of r.notes ?? []) console.log(`    · ${n}`);
  return r.violations.length === 0;
}

export const UI_DIRS = ['app', 'components', 'features'];
export const CODE_EXTS = ['.ts', '.tsx', '.css', '.mjs', '.js'];
