# P2-WP0 + WP1 — Scaffold, schema and seed · task brief

Issued by the Phase 2 lead after the owner approved Phase 0 (2026-09-22). One subagent (Opus). **Blocks WP2, WP3, WP5, WP6, WP7.** You build the database and the plumbing that every later package plugs into. You do not build any read or write function's real body except the four that Gate 1's proof needs (listed below).

## OBJECTIVE

Turn `docs/SCHEMA.md` into SQL migrations applied to the (empty) Supabase project `jurah`, load the seed so that `docs/Seed Dataset.md`'s records exist byte-for-byte, and put in place the plumbing — the `withSession()` transaction helper, the backend dispatch, the integration-test harness, the new guards — so that a forged session provably reads zero rows through the real pooler.

## READ — in this order, all of it, before writing a line

1. `CLAUDE.md` (root) — the nine rules. Rule 9 (`REFERENCE_NOW`) and rule 1 (no dose-status write path) bind SQL too.
2. `docs/BACKEND-PLAN.md` — §0 (the frozen set and its proof command — **you may not touch a frozen file**), §1 (D-015 → D-022, all approved), §3's WP0 and WP1 rows and their gates, §5 (the three risks — risk 3 is yours), §6.
3. `docs/SCHEMA.md` — **every line is a requirement.** Every table, column, type, nullability, constraint name, trigger, role, function and policy in it must exist with that name. Where it says "each a WP1 negative test", write the test.
4. `docs/API-SURFACE.md` §A conventions and §C (the sessions the tests run under).
5. `docs/ENFORCEMENT.md` — rows E-05, E-15, E-25 (test-list part), E-39 and the RLS mechanism behind E-21 are yours to make true at the database level; the tests for the others come with later packages, but your policies and triggers are what they will exercise.
6. `docs/BACKEND-DIVERGENCES.md` — D-1, D-3, D-20, D-21, D-26 concern you.
7. `docs/Seed Dataset.md` — the values. `lib/data/mock/seed.ts` is their one transcription and `scripts/seed-diff.impl.ts` + `tests/fixtures/seed-expected.json` already prove it matches. **Your seed script imports the `build*()` functions from `lib/data/mock/seed.ts`; it never retypes a value.**
8. The code you replace behind: `lib/data/index.ts`, `lib/session/index.ts`, `lib/session/cookie.ts`, `lib/data/mock/*`, `lib/schedule/*`, `scripts/print-shapes.ts`, `scripts/seed-diff.ts`, `scripts/seed-diff.impl.ts`, `scripts/guards/*`, `vitest.config.ts`, `package.json`.
9. `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md` — this Next version's env loading. Read it before touching env handling.
10. `docs/DECISIONS.md` — D-014, D-015 → D-022, CR-041, CR-047, CR-048.

## FILES YOU OWN (create or modify nothing else)

- `supabase/migrations/*.sql` (new) — numbered `0001_roles_and_functions.sql`, `0002_types.sql`, `0003_tables.sql`, `0004_constraints_and_triggers.sql`, `0005_rls.sql`, `0006_views.sql`. Idempotent where Postgres allows (`create … if not exists`, `create or replace function`), so a re-apply on the same project is a no-op.
- `supabase/README.md` (new) — how migrations and the seed are applied (two paths: the MCP connector, and `scripts/db/*` over `JURAH_DATABASE_URL`).
- `scripts/db/migrate.ts` (new) — applies the migration files in order over `JURAH_DATABASE_URL`, recording each in `supabase_migrations.schema_migrations` (version = file prefix, name = file stem) so `list_migrations` shows them; `--print` concatenates them to stdout for the MCP path.
- `scripts/db/seed.ts` (new) — imports the `build*()` functions, emits **one transaction** of SQL (`truncate … restart identity cascade` first, then inserts in FK order), runs it over `JURAH_DATABASE_URL`; `--print` writes the SQL to stdout / `--out <file>`. Deterministic: two runs, identical dump.
- `scripts/db/dump.ts` (new) — dumps every table ordered by primary key to canonical JSON, for the "run twice, identical" proof and for `seed-diff --backend=postgres`.
- `lib/db/client.ts` (new) — the `postgres` (porsager) client from `JURAH_DATABASE_URL`, `prepare: false` (transaction-mode pooler), `max` small; **the only file that imports `postgres`**.
- `lib/db/withSession.ts` (new) — `withSession<T>(session: Session | null, fn: (sql) => Promise<T>): Promise<T>`: one transaction; `set local role jurah_app`; resolves the caller's Civil ID **inside the transaction** through `civil_id_for_session(...)` and sets `select set_config('jurah.session', $json, true)` with `{subjectId, role, linkedPatientId, pendingInvitationOnly, civilId}`; `set_config('jurah.now', REFERENCE_NOW, true)`; runs `fn`; commits or rolls back. A second export `withAgent(fn)` does the same with `set local role jurah_agent` and `{role:'agent'}`; `withSystem(fn)` with `jurah_app` + `{role:'system'}` for the webhook/job paths. **No other file may run SQL** — you add guard 8 (below) to prove it.
- `lib/db/audit.ts` (new) — `append(sql, event)` — the one insert path into `audit_events` (opaque id `ae_<ulid>`).
- `lib/db/ids.ts` (new) — `newId(prefix)` → `<prefix>_<ULID>` (CR-041). Use `crypto.randomUUID()`-derived or a tiny ULID; no dependency.
- `lib/db/format.ts` (new) — TS side of `iso_kw`/dates if a projection needs it.
- `lib/data/index.ts` and `lib/session/index.ts` → **thin dispatchers** on `JURAH_DATA_BACKEND` (D-020): `'mock'` → `./mock-impl`, `'postgres'` → `./pg`; default `mock` when unset **except** `next start`/`next dev` with `JURAH_DATABASE_URL` set, where the default is `postgres`; **fail loudly at first call if `postgres` is chosen and `JURAH_DATABASE_URL` is empty** — never silently fall back. Both files keep `'use server'` and export the exact same 50 / 5 names typed as `DataApi[...]` / `SessionApi[...]`. `scripts/notes-check.ts` and guard 4 parse `lib/data/api.ts`, not `index.ts` — leave `api.ts` untouched.
- `lib/data/mock-impl.ts` (new, the current `lib/data/index.ts` body moved **verbatim**) and `lib/session/mock-impl.ts` (likewise). The mock files under `lib/data/mock/*` stay where they are, unchanged.
- `lib/data/pg/index.ts` (new) — exports all 50 names. **Only four have real bodies in this package** (Gate 1's proof needs them): `getPatient`, `getPrescriptions`, `getSettings`, `getInvitationForConsent`. The other 46 throw `new Error('P2: not implemented — WP3/WP5')` so a later package cannot accidentally pass a test by inheriting the mock. Same for `lib/session/pg/index.ts` (5 names; `getSession` real — reads the **existing unsigned mock cookie for now**; WP2 replaces it; the other four throw).
- `lib/data/refusals.ts` and `lib/data/shapes.ts` (new; D-022 and BACKEND-PLAN §6 key order) — for the four functions you implement, the refusal shape and the projection literal, imported by **both** `mock-impl.ts` (replace its inline literal with the import, behaviour identical) and `pg/`.
- `tests/integration/**` (new) — a second vitest project (`vitest.integration.config.ts`), `environment: node`, `include: tests/integration/**`; `tests/integration/setup.ts` re-seeds in `beforeAll` per file via `scripts/db/seed.ts`'s exported function. **When `JURAH_DATABASE_URL` is absent every integration file prints one loud line `!! integration skipped — JURAH_DATABASE_URL not set — NOT A PASS` and fails** (owner's rule: a guard that passes because its input does not exist is worse than no guard). `npm run test:integration`.
- `tests/integration/schema/*.test.ts` — one negative test per named constraint/trigger in `SCHEMA.md` (the row that must be rejected, rejected by that name), plus: RLS smoke (a forged caregiver session for `cg-03` → `getPrescriptions('pt-01')` → `[]` **and** the raw `select count(*) from prescriptions` inside `withSession` → 0), `current_user = 'jurah_app'` inside `withSession`, `jurah_session()->>'civilId'` resolved for حمد, `audit_events` update/delete raise even as owner, `has_table_privilege('jurah_agent','doses','update')` true and `('jurah_app', …)` false for `status`, `mask_name` against the eight seed examples and equal to `maskName` from `lib/format/maskedName.tsx` on the same inputs, `iso_kw` round trip of `2026-09-21T09:15:00+03:00`.
- `scripts/seed-diff.impl.ts` — add `--backend=postgres`: same record-by-record comparison against `tests/fixtures/seed-expected.json`, reading through `scripts/db/dump.ts`. The mock path unchanged.
- `scripts/print-shapes.ts` — add `--backend=postgres` (sets `JURAH_DATA_BACKEND` before importing the seam; re-seeds first). With only four real functions it will show 51 throws — that is expected at this gate and the output is still pasted.
- `scripts/guards/`: **guard 8 `sql-only-in-db.ts`** (no `` sql` `` tag, no `import … from 'postgres'`, outside `lib/db/**` and `scripts/db/**`); **guard 9 `no-secrets.ts`** (repo-wide, excluding `node_modules`/`.next`: no `postgresql://…:…@`, no `sb_secret_`, no `eyJ…` JWT longer than 100 chars, no value of any `JURAH_*` var from `.env.local` — read the file if present, grep for each non-empty value; also scans `.next/static/**` when it exists); extend **guard 4** (`no-dose-write.ts`) to scan `supabase/**` and `app/api/**` for `missed` inside any `update`/`set` statement and for any `update doses set status` outside migration `0004`'s trigger definition; extend **guard 6** (`no-clock.ts`) to `lib/db/**`, `lib/data/pg/**`, `scripts/db/**`, `supabase/**` (SQL: no `now()` except inside `jurah_now()`'s fallback — everything reads `jurah_now()`); extend guard U (`no-unit-conversion.ts`) to `supabase/**`. Register 8 and 9 in `run.ts`.
- `vitest.config.ts` — exclude `tests/integration/**` from the unit project. `package.json` — add `postgres` (pin the current 3.x), scripts `db:migrate`, `db:seed`, `db:dump`, `test:integration`; **`verify` unchanged** (it must stay green in `mock`).
- `.env.example` — already has the Phase 2 block; adjust comments only if a name changes (it should not).
- `docs/backend-notes/p2-wp1.md` (new) — your fragment: every seed derivation the SQL needed that the mock did not (ordering, `seq`, id prefixes), every place `SCHEMA.md` could not be built as written (with what you did instead), and the Gate 1 proof outputs.

## FILES YOU MUST NOT TOUCH

Everything in the frozen set: `app/[locale]/**`, `components/**`, `features/**`, `i18n/**`, `types/**`, `styles/**`, `public/**`. Also `proxy.ts` and `lib/session/cookie.ts` (WP2's), `lib/schedule/**` (WP4's), `lib/config.ts` (the lead's; its values are already what you need), `lib/data/api.ts`, `lib/session/api.ts`, `lib/data/mock/**`, `docs/**` except your fragment, `tests/unit/**`, `tests/e2e/**`. Run `git diff --stat 8cd7794 -- 'app/[locale]' components features i18n types styles public` before you report; it must print nothing.

## HOW TO APPLY MIGRATIONS AND THE SEED WITHOUT A CONNECTION STRING

`JURAH_DATABASE_URL` is **not yet available** (the owner owes it). You have the Supabase MCP connector: `apply_migration(project_id='frvubflbpujwuhsxweue', name, query)` for each migration file (one call per file, name = file stem, so `list_migrations` records them), `execute_sql` for the seed SQL from `scripts/db/seed.ts --print` and for every verification query. Write the tooling so it works over the URL too, but **prove Gate 1 through the MCP path now**, and write in your report exactly which proofs still need the URL (the `seed-diff --backend=postgres` record-by-record run and `tests/integration`). Never paste a connection string or a key into any file.

## THE INVARIANTS — into your SQL, not only your tests

G1 — `doses.status` is writable by `jurah_agent` alone (column grant) plus the WP4 system recompute path; `check dose_untracked_has_no_status`; the `AFTER UPDATE OF status` trigger appends `dose_status_recorded` with actor `agent`/`system`; `check audit_dose_status_actor`; **no function, job or trigger sets `missed` from the clock — do not write one, and make guard 4 prove none exists.**
G9 — no projection your four functions return contains `civil_id`; `check (message !~ '[0-9]{12}')` on `audit_events`; `lookup_audit` has no Civil ID column; `mask_name` gives exactly three asterisks per middle name whatever its length; the invitation gate is the `caregiver_transitions` trigger — **there is no `SECURITY DEFINER` path, no policy and no role that can move a row to `active` except the invited Civil ID's own session**.
G10 — `settings_tracking_requires_link` resets the flag quietly, never raises.
G12 — nothing in this package sends anything.
G11 — nothing in this package touches `app/[locale]/page.tsx`.
Plus: `refill_routing` overwrites `routed_to` from the sector and raises on ownership/status; `audit_events` append-only three ways (revoke, trigger, no `TRUNCATE` for the two app roles — the owner's `TRUNCATE` in the seed is the single sanctioned exception, `SCHEMA.md` conventions); `anon`/`authenticated`/`service_role` get no grants; the seed's `dose_status_recorded` rows are all `agent`/`system`.

## ACCEPTANCE — Gate 1

Paste every command and its output; never describe a pass.
1. Every migration applied (`list_migrations` shows the six); a second `apply` is a no-op.
2. The seed loaded through `execute_sql`; `select count(*)` per table equals `SEED_COUNTS` in `scripts/seed-diff.ts` (accounts 11 · patients 4 · caregivers 8 · prescriptions 9 · alerts 3 · settings 3 · messaging_links 5 · push_subscriptions 4 · refill_requests 2 · calendar_subscriptions 1) and `doses` equals the mock's `getStore().doses.length`; `audit_events` equals the mock's count and `select distinct type` has 23 values.
3. Byte-for-byte: `getPatient('pt-01')`, `getPrescriptions('pt-01')`, `getSettings('pt-04')` (no row → defaults, **no row written** — prove with a count before/after), `getInvitationForConsent('cg-08')` through `execute_sql`-driven checks of the projection you wrote, compared to the strings in `tests/fixtures/shapes.json`, **key order included**.
4. RLS smoke through MCP: `set role jurah_app; select set_config('jurah.session', '{"subjectId":"cg-03","role":"caregiver","linkedPatientId":"pt-01","civilId":"288110300229"}', true); select count(*) from prescriptions where patient_id='pt-01'` → 0; same with `cg-01` → 4. `set role jurah_app; update audit_events set message='x'` → `permission denied`; as owner → `audit_events is append-only`.
5. Every negative test in `tests/integration/schema/` written; the file runs and **fails loudly** without the URL (paste that output — it is the honest state); the same assertions executed by hand through `execute_sql` for the constraints on `doses`, `caregivers`, `refill_requests`, `audit_events`, `settings` (paste the error names).
6. `npm run verify` exit 0 in `mock` (unchanged behaviour); `npm run guards` shows guards 8 and 9 present and green, and 4/6/U scanning the new directories.
7. `git diff --stat 8cd7794 -- 'app/[locale]' components features i18n types styles public` prints nothing.

## REPORT BACK

Objective · files created/changed · every Gate 1 command with output · what still needs `JURAH_DATABASE_URL` · every deviation from `SCHEMA.md` with the reason (a deviation not reported is a defect) · what you found out the hard way (goes to `docs/backend-notes/p2-wp1.md` §7). Never self-certify.
