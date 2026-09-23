# supabase/ — the Jur'ah database

Schema for Supabase project `jurah` (`frvubflbpujwuhsxweue`, Postgres 17, D-015). `docs/SCHEMA.md`
is the specification: every table, column, constraint, trigger, role, function and policy it names
exists here under that name. `docs/backend-notes/p2-wp1.md` lists every place the SQL differs from
it and says why.

## The migrations, 0001–0011

Eleven files. 0001–0006 are WP1's schema; 0007–0011 are later packages' additions (D-026), each applied
through Path 1 below (Path 2 waits for `JURAH_DATABASE_URL`) and listed here. `list_migrations` shows them in APPLICATION order, which put
0009 before 0008 (the two are independent); on a fresh database `migrate.ts` applies them by file name.

| File | Holds |
|---|---|
| `0001_roles_and_functions.sql` | Roles `jurah_app` and `jurah_agent` (NOLOGIN, NOBYPASSRLS, granted to `postgres`). Supabase's default grants to `anon`/`authenticated`/`service_role` switched off. The functions that read no table: `jurah_session()`, `jurah_now()`, `iso_kw()`, `mask_name()`, `jurah_new_id()`, `jurah_hhmm_array_ok()`, and the helper `jurah_ensure_constraint()`. |
| `0002_types.sql` | The 24 enum types, one per contract union. There is no `'ui'` dose source. |
| `0003_tables.sql` | 18 tables: the 12 contract entities and the 6 server-side tables. Columns, types, nullability and defaults only. |
| `0004_constraints_and_triggers.sql` | The definer helpers (`can_read_patient`, `civil_id_for_session`, `account_roles`, `jurah_session_is`, `caregiver_ids_for_patient`, `invitation_patient_first_name`), every named constraint, and the 10 guard triggers. |
| `0005_rls.sql` | RLS enabled on every table (enabled, not forced), a revoke of everything, then exactly the column-level grants and the policies. |
| `0006_views.sql` | `push_subscriptions_view` (security invoker) and `audit_log_admin` (security definer, CR-047). |
| `0007_sessions_and_signin.sql` | P2-WP2 (D-018, D-026). `signin_claims(civil_id, at)` — the one security-definer claims query behind `signIn`/`getRoleOptions` (test list, patient, first active caregiver row, clinic roles, `last_chosen_role`, unexpired pending invitations; never a Civil ID; byte-identical output for the two `no_claims` IDs). `session_row_ok(...)` — a sessions row may be inserted only for a subject of the same Civil ID as the transaction's session that still holds the role. The real `sessions` policies (own rows · a patient's caregivers' rows, for revocation · system), no un-revoke. Applied with `apply_migration` on 2026-09-22; the stored text's md5 equals the file's (`0eda5d27c30ac2d0d72588cfc69bbd32`). |
| `0008_agent_grants.sql` | P2-WP7 (D-026). Tightens `jurah_agent` to the columns the six agent routes and WP6's agent-role target reads need: `patients` SELECT (`id`) only, `caregivers` SELECT (`id, seq, linked_patient_id, status`) only — no `civil_id`, `name`, `phone` or `telegram_chat_id` — and nothing on `accounts`. Every other `jurah_agent` grant is 0005's (doses UPDATE (`status, recorded_at, source`), no DELETE — D-025). **Order matters:** 0005's blanket revoke-then-grant would restore the wide grants, so a re-apply runs 0005 → 0006 → 0007 → 0008 → 0009 in order. Applied with `apply_migration` on 2026-09-22 (version `20260922201849`); the stored text's md5 equals the file's (`8a7ff0d2f34a4645117140094ecbebff`). |
| `0009_masked_name_lookup.sql` | P2-WP5 (D-026; numbered 0009 because WP7's brief reserves 0008). `lookup_masked_name(civil_id, session_id)` — `lookupMaskedName`'s security-definer path over `accounts` (which `jurah_app` cannot read): no session → null and no write; otherwise one `lookup_audit` row per call, the account query and the masking run on every branch, and `null` once the session has more than 10 rows in 60 s (CR-043). `invitation_masked_name(caregiver_id)` — dropped again by 0010 (D-036: the invite audit line is always neutral). Neither touches `caregivers.status`. Applied with `apply_migration` on 2026-09-22; the stored text's md5 equals the file's (`a3be7c34862033e3d1e0c1e91990fde2`; the first text, `019b0b29…`, was replaced in place the same day to mask on both branches — the stored history text was updated to the file's, see docs/backend-notes/p2-wp5.md). |
| `0010_lookup_rate_limit_wall_clock.sql` | P2-WP5 follow-up (D-037, D-036). `lookup_masked_name` re-created so `lookup_audit.at` is stamped with `clock_timestamp()` and the 60-second window counts against `clock_timestamp()` — the one sanctioned SQL wall-clock read besides `jurah_now()`'s fallback (guard 6 allows exactly those two function bodies); under the frozen clock the eleventh lookup was otherwise refused for the session's whole life. Drops `invitation_masked_name`. Applied with `apply_migration` on 2026-09-22; the stored text's md5 equals the file's (`a7f44a1e489f7321542c9faf8045041e`). |
| `0011_trigger_guards_null_safe.sql` | WPfinal, first integration run against the real database (D-039). `caregiver_transitions` and `prescription_clinical_fields_locked` re-created with 0004's bodies byte for byte, except that each boolean guard is wrapped in `coalesce(…, false)`. A NULL guard made `if … and not x then raise` fall through: a reviewer session could change the clinical fields of any never-flagged prescription (`field_review_status` NULL), and the owner with no session could cancel an invitation or end an active link. Applied with `apply_migration` on 2026-09-23; the stored text's md5 equals the file's (`e3b18354e05914b0e6c9baef4a742ea6`). |

Every file is idempotent, so applying it again changes nothing. Types, roles and constraints are
created only when absent. Functions, triggers and views use `create or replace`, and policies are
dropped if they exist and then created. The migrations must run in order: 0005's revoke-then-grant
also resets the view grants, and 0006 grants them again.

## Path 1: the Supabase MCP connector (no connection string needed)

This is how the migrations were first applied. No local `supabase` CLI, `psql` or Docker exists on
the build machine.

1. For each file, in order: `apply_migration(project_id='frvubflbpujwuhsxweue', name=<file stem>, query=<file contents>)`.
   The connector records the migration with a timestamp version and `name` set to the stem, so
   `list_migrations` shows one row per file (ten).
2. Seed: run `npx tsx scripts/db/seed.ts --print` and pass the output to `execute_sql`. It is one
   transaction, and its first statement truncates every table. `--body` prints the same statements
   without `begin`/`commit`, for wrapping in a function or `do` block.
3. Verify: run `npx tsx scripts/db/dump.ts --digest-sql` and pass the output to `execute_sql`. Compare
   the result with `npx tsx scripts/db/dump.ts --expected`. There is one md5 per table, computed
   from `lib/data/mock/seed.ts`, and equal digests mean every row and every column matches.
4. To re-apply without adding a history row, run the recorded text again with `execute_sql`
   (`execute array_to_string(statements, E'\n')` over `supabase_migrations.schema_migrations`, in
   version order). A second `apply_migration` would record a duplicate history row.

## Path 2: `scripts/db/*` over `JURAH_DATABASE_URL`

Put the transaction-pooler URI (the `postgres` role, with its password) in `.env.local` as
`JURAH_DATABASE_URL`. That file is gitignored. Never put the value in any tracked file: guard 9
fails if it appears in one. Then run:

```bash
npm run db:migrate                 # applies pending files; version = 4-digit prefix, name = stem
npx tsx scripts/db/migrate.ts --reapply   # runs every file again, records nothing (idempotency proof)
npm run db:seed                    # the seed, one transaction
npx tsx scripts/db/dump.ts --digest       # every table against the transcription, row by row
npm run db:dump -- --out dump.json # canonical JSON; seed twice, dump twice, diff: identical
npx tsx scripts/seed-diff.ts --backend=postgres   # verification 13 against the database
npx tsx scripts/print-shapes.ts --backend=postgres  # the round trip against tests/fixtures/shapes.json
npm run test:integration           # tests/integration/**, re-seeds per file
```

`migrate.ts` skips a migration that is already recorded under its prefix (this script) or under
its stem (the MCP connector), so the two paths can be mixed. Without the URL, every one of these
commands fails loudly and prints `NOT A PASS`. None of them falls back to the mock.

## The application's side

Product code never connects directly. `lib/db/withSession.ts` is the only SQL path (guard 8).
Each call is one transaction. The caller's Civil ID is resolved as the owner, then
`set local role jurah_app`, then `jurah.session` and `jurah.now` are set with `set_config(..., true)`.
The seed and the migrations run as the owner, which RLS does not bind. The seed runs with
`jurah.session = {"role":"system"}`, so the guard triggers see a system actor.
