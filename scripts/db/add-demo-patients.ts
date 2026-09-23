/**
 * D-041 — adds the two demo patients (lib/data/mock/demo-patients.ts) to a LIVE database without
 * touching anything else. Insert-only and idempotent (`on conflict do nothing`): it never truncates,
 * so the activity already on production survives, and running it twice changes nothing.
 *
 * `npm run db:seed` truncates every table, so it removes these two as well — run this again after
 * any re-seed (and after `npm run test:integration`, which re-seeds per file).
 *
 * What it writes, per patient, and nothing more: one `civil_id_test_list` row (the database's half of
 * A1's test list), one `accounts` row with no stored role (`patient` is derived from the patients
 * row, seed rule 2), one `patients` row with `onboarding_completed = false`. No Settings row, exactly
 * like بدر: reading settings for a patient with no row returns the documented defaults.
 *
 *   npx tsx scripts/db/add-demo-patients.ts           run over JURAH_DATABASE_URL (fails loudly without it)
 *   npx tsx scripts/db/add-demo-patients.ts --print   the SQL to stdout (the MCP path: execute_sql)
 */
import { pathToFileURL } from 'node:url';
import { REFERENCE_NOW } from '../../lib/config';
import { DEMO_PATIENTS } from '../../lib/data/mock/demo-patients';

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;

export function buildDemoPatientsSql({ transaction = true }: { transaction?: boolean } = {}): string {
  const out: string[] = [];
  out.push(`select set_config('jurah.session', '{"role":"system"}', true), set_config('jurah.now', ${q(REFERENCE_NOW)}, true);`);
  out.push(`insert into civil_id_test_list (civil_id) values\n  ${DEMO_PATIENTS.map((p) => `(${q(p.civilId)})`).join(',\n  ')}\non conflict do nothing;`);
  out.push(`insert into accounts (id, civil_id, name, assigned_roles) values\n  ${DEMO_PATIENTS.map((p) => `(${q(p.accountId)}, ${q(p.civilId)}, ${q(p.name)}, '{}'::role_t[])`).join(',\n  ')}\non conflict do nothing;`);
  out.push(`insert into patients (id, civil_id, name, language, onboarding_completed) values\n  ${DEMO_PATIENTS.map((p) => `(${q(p.patientId)}, ${q(p.civilId)}, ${q(p.name)}, 'ar'::language_t, false)`).join(',\n  ')}\non conflict do nothing;`);
  const body = out.join('\n');
  return transaction ? `begin;\n${body}\ncommit;\n` : `${body}\n`;
}

async function main() {
  if (process.argv.includes('--print')) {
    process.stdout.write(buildDemoPatientsSql());
    return;
  }
  const { loadLocalEnv } = await import('./env');
  loadLocalEnv();
  const { getSql, closeSql, databaseUrl } = await import('../../lib/db/client');
  if (!databaseUrl()) {
    console.error('!! add-demo-patients — JURAH_DATABASE_URL not set — NOTHING WRITTEN (use --print for the MCP path)');
    process.exit(1);
  }
  try {
    const body = buildDemoPatientsSql({ transaction: false });
    await getSql().begin(async (tx) => {
      await tx.unsafe(body);
    });
    console.log(`✓ demo patients present: ${DEMO_PATIENTS.map((p) => p.patientId).join(', ')}`);
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
