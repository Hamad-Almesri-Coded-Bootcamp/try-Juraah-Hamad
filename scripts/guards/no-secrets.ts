/**
 * Guard 9 — no secret in the repository or the client bundle (BACKEND-PLAN §2, E-45). Repo-wide
 * (excluding node_modules, .git and .next except .next/static/**, which IS scanned when present —
 * that is what ships to a browser), every text file is checked for:
 *  (a) a Postgres connection string carrying a password: postgres(ql)://user:password@host;
 *  (b) a Supabase secret key (sb_secret_…);
 *  (c) a JWT-shaped token (eyJ… three base64url segments) longer than 100 characters;
 *  (d) the literal VALUE of every non-empty JURAH_* variable in .env.local (read here, never
 *      printed) — except JURAH_DATA_BACKEND, whose value ('mock'/'postgres') is a mode, not a
 *      secret, and values shorter than 12 characters, which would match ordinary words.
 * .env.local itself and the other gitignored .env.* files are the one place those values may
 * live and are not scanned. When .env.local is absent the value scan has NO INPUT: it is reported
 * loudly as NOT A PASS for (d) (the pattern scans still ran and still gate the result).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { rel, type GuardResult, type Violation } from './_shared';

const SKIP = new Set(['node_modules', '.git', 'coverage', 'playwright-report', 'test-results', '.turbo']);
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|eot|pdf|zip|gz|mp4|webm|avif|lockb|tsbuildinfo)$/i;
const MAX_BYTES = 5 * 1024 * 1024;

function files(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    const r = rel(p);
    if (r === '.next') { if (existsSync('.next/static')) files('.next/static', out); continue; }
    if (/^\.env(\..+)?$/.test(e) && e !== '.env.example') continue;
    const st = statSync(p);
    if (st.isDirectory()) files(p, out);
    else if (!BINARY.test(e) && st.size <= MAX_BYTES) out.push(p);
  }
  return out;
}

function localSecretValues(): { values: { name: string; value: string }[]; present: boolean } {
  if (!existsSync('.env.local')) return { values: [], present: false };
  const values: { name: string; value: string }[] = [];
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^\s*(JURAH_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    const name = m[1] ?? '';
    const value = (m[2] ?? '').replace(/^['"]|['"]$/g, '');
    if (!value || name === 'JURAH_DATA_BACKEND' || value.length < 12) continue;
    values.push({ name, value });
  }
  return { values, present: true };
}

export function run(): GuardResult {
  const v: Violation[] = [];
  const all = files('.');
  const { values, present } = localSecretValues();
  const patterns: [string, RegExp][] = [
    // user and host are real identifier characters, so a prose description of the pattern itself
    // (docs/briefs: "postgresql://…:…@") is not a connection string.
    ['postgres URI with a password', /postgres(?:ql)?:\/\/[A-Za-z0-9._%-]+:[^\s@/'"`…]+@[A-Za-z0-9.-]+/i],
    ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{8,}/],
    ['JWT longer than 100 chars', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ];
  for (const f of all) {
    const text = readFileSync(f, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      for (const [rule, re] of patterns) {
        const m = re.exec(line);
        if (m && (rule !== 'JWT longer than 100 chars' || m[0].length > 100)) v.push({ file: rel(f), line: i + 1, text: '(match redacted)', rule });
      }
      for (const { name, value } of values) {
        if (line.includes(value)) v.push({ file: rel(f), line: i + 1, text: '(value redacted)', rule: `value of ${name} from .env.local` });
      }
    });
  }
  const notes = [
    `scanned ${all.length} text files${existsSync('.next/static') ? ' (including .next/static/**)' : ' (.next/static absent — nothing built to scan)'}`,
    present
      ? `.env.local present: ${values.length} secret value(s) checked (names only: ${values.map((x) => x.name).join(', ') || 'none non-empty'})`
      : '!! .env.local absent — the value sub-check (d) had NO INPUT — NOT A PASS for (d); (a)–(c) still ran',
  ];
  return { name: 'guard 9 · no secret in the repository or the client bundle', violations: v, notes };
}
