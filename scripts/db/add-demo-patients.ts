/**
 * D-041 / D-042 — adds the demo patients and demo doctors (lib/data/mock/demo-patients.ts) to a LIVE
 * database without touching anything else. Insert-only and idempotent (`on conflict do nothing`): it never truncates,
 * so the activity already on production survives, and running it twice changes nothing.
 *
 * `npm run db:seed` truncates every table, so it removes these two as well — run this again after
 * any re-seed (and after `npm run test:integration`, which re-seeds per file).
 *
 * What it writes, per patient, and nothing more: one `civil_id_test_list` row (the database's half of
 * A1's test list), one `accounts` row with no stored role (`patient` is derived from the patients
 * row, seed rule 2), one `patients` row with the patient's `onboarding_completed`. No Settings row,
 * exactly like بدر: reading settings for a patient with no row returns the documented defaults.
 * Per doctor: one `civil_id_test_list` row and one `accounts` row whose `assigned_roles` is the
 * doctor's clinic roles (`{reviewer}`). No patients row.
 *
 *   npx tsx scripts/db/add-demo-patients.ts           run over JURAH_DATABASE_URL (fails loudly without it)
 *   npx tsx scripts/db/add-demo-patients.ts --print   the SQL to stdout (the MCP path: execute_sql)
 */
import { pathToFileURL } from 'node:url';
import { REFERENCE_NOW } from '../../lib/config';
import { DEMO_CLINICIANS, DEMO_PATIENTS } from '../../lib/data/mock/demo-patients';

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;

export function buildDemoPatientsSql({ transaction = true }: { transaction?: boolean } = {}): string {
  const out: string[] = [];
  out.push(`select set_config('jurah.session', '{"role":"system"}', true), set_config('jurah.now', ${q(REFERENCE_NOW)}, true);`);
  const everyone = [...DEMO_PATIENTS, ...DEMO_CLINICIANS];
  const roles = (r: readonly string[]) => `'{${r.join(',')}}'::role_t[]`;
  out.push(`insert into civil_id_test_list (civil_id) values\n  ${everyone.map((p) => `(${q(p.civilId)})`).join(',\n  ')}\non conflict do nothing;`);
  out.push(`insert into accounts (id, civil_id, name, assigned_roles) values\n  ${[
    ...DEMO_PATIENTS.map((p) => `(${q(p.accountId)}, ${q(p.civilId)}, ${q(p.name)}, ${roles([])})`),
    ...DEMO_CLINICIANS.map((c) => `(${q(c.accountId)}, ${q(c.civilId)}, ${q(c.name)}, ${roles(c.roles)})`),
  ].join(',\n  ')}\non conflict do nothing;`);
  out.push(`insert into patients (id, civil_id, name, language, onboarding_completed) values\n  ${DEMO_PATIENTS.map((p) => `(${q(p.patientId)}, ${q(p.civilId)}, ${q(p.name)}, 'ar'::language_t, ${p.onboardingCompleted})`).join(',\n  ')}\non conflict do nothing;`);
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
    console.log(`✓ demo people present: ${[...DEMO_PATIENTS.map((p) => p.patientId), ...DEMO_CLINICIANS.map((c) => c.accountId)].join(', ')}`);
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
