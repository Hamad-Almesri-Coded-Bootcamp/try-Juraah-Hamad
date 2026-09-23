/**
 * The one Postgres client (D-017): porsager `postgres` over JURAH_DATABASE_URL, the Supabase
 * transaction-mode pooler, so `prepare: false` (a pooled backend cannot keep named statements
 * between transactions) and a small `max`. THIS IS THE ONLY FILE THAT IMPORTS `postgres`
 * (guard 8, scripts/guards/sql-only-in-db.ts); everything else receives a transaction handle from
 * lib/db/withSession.ts or, for the owner-only scripts/db/* tooling, calls `getSql()` directly.
 *
 * Environment reading is confined to this module and the two seam dispatchers, which import
 * `selectedBackend()` from here (D-020). Nothing is ever logged: the URL carries the password.
 */
import postgres from 'postgres';

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;
export type Row = postgres.Row;
/** A value bound to a `$n::json`/`$n::jsonb` parameter — passed as itself, never pre-stringified (lib/engine/sql.ts). */
export type JsonValue = postgres.JSONValue;

let client: Sql | null = null;

/** The configured connection string, or '' — never printed. */
export function databaseUrl(): string {
  return (process.env.JURAH_DATABASE_URL ?? '').trim();
}

/**
 * D-020: which implementation sits behind the seam. An explicit JURAH_DATA_BACKEND wins. Unset,
 * it is `mock` everywhere (vitest, tsx scripts, `next build`) EXCEPT inside a running Next server
 * (`next dev` / `next start`, where Next sets NEXT_RUNTIME) with a database URL configured, where
 * it is `postgres`. Choosing `postgres` without a URL is never silently downgraded — `getSql()`
 * throws on first use.
 */
export function selectedBackend(): 'mock' | 'postgres' {
  const explicit = (process.env.JURAH_DATA_BACKEND ?? '').trim();
  if (explicit === 'mock' || explicit === 'postgres') return explicit;
  if (explicit) throw new Error(`JURAH_DATA_BACKEND must be 'mock' or 'postgres' (got '${explicit}')`);
  const insideNextServer = !!process.env.NEXT_RUNTIME && process.env.NEXT_PHASE !== 'phase-production-build';
  return insideNextServer && databaseUrl() !== '' ? 'postgres' : 'mock';
}

/** The pooled client, created on first use. Throws loudly — never falls back to the mock. */
export function getSql(): Sql {
  if (client) return client;
  const url = databaseUrl();
  if (!url) {
    throw new Error(
      'JURAH_DATA_BACKEND=postgres but JURAH_DATABASE_URL is empty — refusing to fall back to the mock. ' +
        'Set JURAH_DATABASE_URL (the transaction-pooler URI) in .env.local.',
    );
  }
  const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);
  const sslInUrl = /[?&]sslmode=/.test(url);
  client = postgres(url, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: local || sslInUrl ? undefined : 'require',
    onnotice: () => {},
  });
  return client;
}

/** Scripts and the integration harness close the pool so the process can exit. */
export async function closeSql(): Promise<void> {
  if (client) {
    const c = client;
    client = null;
    await c.end({ timeout: 5 });
  }
}
