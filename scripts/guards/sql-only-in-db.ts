/**
 * Guard 8 — D-017 / BACKEND-PLAN risk 3: withSession() is the ONLY way product code runs SQL.
 * The rule, exactly (docs/backend-notes/p2-wp1.md §3 explains why the brief's literal wording —
 * "no sql` outside lib/db" — cannot hold, since withSession() hands its callback a tagged `sql`):
 *  (a) `import … from 'postgres'` only in lib/db/client.ts (the one client);
 *  (b) lib/db/client's connection (getSql/closeSql, or the whole module) imported only from
 *      lib/db/**, scripts/db/**, tests/integration/** (owner-only tooling and the harness) — product
 *      code can never obtain a raw connection, only the transaction handle withSession()/
 *      withAgent()/withSystem() passes in. The two seam dispatchers import `selectedBackend` alone;
 *  (c) a `sql\`` / `tx\`` tag or `.unsafe(` only in lib/db/**, scripts/db/**, tests/integration/**
 *      and lib/{data,session}/pg/** and lib/engine/** (the deterministic engine, D-025/WP4b: it
 *      runs on the handle its caller passes in) — and a pg/ or engine file that runs SQL must
 *      import lib/db/withSession (so the only handle it can hold is the callback's) and may never
 *      import the raw client (rule b);
 *  (d) `insert into audit_events` only in lib/db/audit.ts, supabase/migrations/** (the trigger),
 *      scripts/db/seed.ts and tests/integration/** (SCHEMA.md §1: "a guard greps for any other").
 * The guard must see its input: it fails if lib/db/withSession.ts or lib/db/client.ts is absent.
 */
import { existsSync, readFileSync } from 'node:fs';
import { walk, rel, type GuardResult, type Violation } from './_shared';

const TAG = /\b(sql|tx)\s*`|\.unsafe\s*\(/;
const isComment = (l: string) => /^\s*(\/\/|\*|\/\*)/.test(l);

export function run(): GuardResult {
  const v: Violation[] = [];
  const notes: string[] = [];
  for (const must of ['lib/db/client.ts', 'lib/db/withSession.ts']) {
    if (!existsSync(must)) v.push({ file: must, line: 0, text: '', rule: 'guard input missing — the one SQL path does not exist' });
  }
  const code = walk('.', ['.ts', '.tsx', '.js', '.mjs']).map(rel);
  const inDbTooling = (f: string) => f.startsWith('lib/db/') || f.startsWith('scripts/db/') || f.startsWith('tests/integration/');
  const inPg = (f: string) => f.startsWith('lib/data/pg/') || f.startsWith('lib/session/pg/') || f.startsWith('lib/engine/');
  let scanned = 0;
  let tagFiles = 0;
  for (const f of code) {
    if (f.startsWith('scripts/guards/')) continue; // the guards name the patterns they forbid
    scanned++;
    const src = readFileSync(f, 'utf8');
    const lines = src.split('\n');
    let usesTag = false;
    lines.forEach((line, i) => {
      if (isComment(line)) return;
      const at = { file: f, line: i + 1, text: line.trim().slice(0, 140) };
      if (/from\s+['"]postgres['"]|require\(\s*['"]postgres['"]\s*\)|import\(\s*['"]postgres['"]\s*\)/.test(line) && f !== 'lib/db/client.ts') {
        v.push({ ...at, rule: "import from 'postgres' outside lib/db/client.ts" });
      }
      const clientImport = /from\s+['"](@\/lib\/db\/client|(\.\.?\/)+(lib\/)?db\/client|\.\/client)['"]|import\(\s*['"][^'"]*db\/client['"]\s*\)/.test(line);
      const connectionImport = clientImport && !/^\s*import\s+type\b/.test(line) && !/^\s*import\s*\{\s*(selectedBackend|databaseUrl)(\s*,\s*(selectedBackend|databaseUrl))?\s*\}\s*from/.test(line);
      if (connectionImport && !inDbTooling(f)) {
        v.push({ ...at, rule: 'raw client imported outside lib/db, scripts/db, tests/integration' });
      }
      if (TAG.test(line)) {
        usesTag = true;
        if (!inDbTooling(f) && !inPg(f)) v.push({ ...at, rule: 'SQL run outside lib/db, scripts/db, tests/integration, lib/*/pg, lib/engine' });
      }
      if (/insert\s+into\s+(public\.)?audit_events\b/i.test(line) && !(f === 'lib/db/audit.ts' || f === 'scripts/db/seed.ts' || f.startsWith('tests/integration/'))) {
        v.push({ ...at, rule: 'insert into audit_events outside lib/db/audit.ts' });
      }
    });
    if (usesTag) tagFiles++;
    if (usesTag && inPg(f) && !/from\s+['"]@\/lib\/db\/withSession['"]/.test(src)) {
      v.push({ file: f, line: 0, text: '', rule: 'a pg/ or engine file runs SQL but does not take its handle from lib/db/withSession' });
    }
  }
  // (d) in SQL: the only insert into audit_events in the migrations is the doses trigger.
  const sqlFiles = walk('supabase', ['.sql']).map(rel);
  for (const f of sqlFiles) {
    const n = (readFileSync(f, 'utf8').match(/insert\s+into\s+(public\.)?audit_events\b/gi) ?? []).length;
    if (n > 0) notes.push(`${f}: ${n} insert into audit_events (the doses_status_recorded_audit trigger)`);
  }
  notes.push(`scanned ${scanned} code files; ${tagFiles} run SQL (all inside the allowed directories when green)`);
  return { name: 'guard 8 · SQL runs only through lib/db (withSession is the one path)', violations: v, notes };
}
