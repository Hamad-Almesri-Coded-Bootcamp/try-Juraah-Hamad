/**
 * Applies supabase/migrations/*.sql in order over JURAH_DATABASE_URL (D-015), each in its own
 * transaction, recording it in supabase_migrations.schema_migrations so Supabase's
 * `list_migrations` shows it: version = the file's numeric prefix, name = the file stem.
 *
 * A migration already recorded — under its prefix (this script) OR under its stem as the name
 * (the MCP connector's `apply_migration`, which records a timestamp version) — is skipped. Every
 * file is idempotent anyway (create-if-absent / create-or-replace / drop-policy-if-exists), so
 * `--reapply` runs them all again WITHOUT recording, to prove a re-apply is a no-op.
 *
 *   npx tsx scripts/db/migrate.ts             apply pending migrations (fails loudly without the URL)
 *   npx tsx scripts/db/migrate.ts --reapply   run every file again, record nothing
 *   npx tsx scripts/db/migrate.ts --print     concatenate the files to stdout (the MCP path)
 *   npx tsx scripts/db/migrate.ts --list      list the files with their md5
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Sql } from '../../lib/db/client';

export const MIGRATIONS_DIR = 'supabase/migrations';

export interface MigrationFile {
  version: string;
  name: string;
  file: string;
  sql: string;
  md5: string;
}

export function migrationFiles(dir = MIGRATIONS_DIR): MigrationFile[] {
  const files = readdirSync(dir).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
  if (files.length === 0) throw new Error(`no migrations found in ${dir}`);
  return files.map((f) => {
    const sql = readFileSync(join(dir, f), 'utf8');
    const name = f.replace(/\.sql$/, '');
    return { version: f.slice(0, 4), name, file: f, sql, md5: createHash('md5').update(sql).digest('hex') };
  });
}

async function ensureHistoryTable(sql: Sql): Promise<void> {
  await sql.unsafe(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text);`);
}

export async function migrate(sql: Sql, opts: { reapply?: boolean } = {}): Promise<string[]> {
  const log: string[] = [];
  await ensureHistoryTable(sql);
  const applied = await sql.unsafe(`select version, name from supabase_migrations.schema_migrations`);
  const done = new Set(applied.flatMap((r) => [String(r.version), String(r.name)]));
  for (const m of migrationFiles()) {
    const recorded = done.has(m.version) || done.has(m.name);
    if (recorded && !opts.reapply) {
      log.push(`·  ${m.name} — already applied, skipped`);
      continue;
    }
    await sql.begin(async (tx) => {
      await tx.unsafe(m.sql);
      if (!recorded) {
        await tx.unsafe(`insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)`, [m.version, m.name, [m.sql]]);
      }
    });
    log.push(`${recorded ? '↻' : '✓'}  ${m.name} — ${recorded ? 're-applied (no history row)' : 'applied and recorded'}  md5 ${m.md5}`);
  }
  return log;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--print')) {
    for (const m of migrationFiles()) process.stdout.write(`-- ==== ${m.file} ====\n${m.sql}\n`);
    return;
  }
  if (args.includes('--list')) {
    for (const m of migrationFiles()) console.log(`${m.version}  ${m.name.padEnd(34)} ${m.md5}`);
    return;
  }
  const { loadLocalEnv } = await import('./env');
  loadLocalEnv();
  const { getSql, closeSql, databaseUrl } = await import('../../lib/db/client');
  if (!databaseUrl()) {
    console.error('!! db:migrate — JURAH_DATABASE_URL not set — NOTHING APPLIED (use --print for the MCP path)');
    process.exit(1);
  }
  try {
    for (const line of await migrate(getSql(), { reapply: args.includes('--reapply') })) console.log(line);
  } finally {
    await closeSql();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
