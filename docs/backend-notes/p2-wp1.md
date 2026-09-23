# P2-WP0 + WP1: scaffold, schema and seed, notes

Written by the WP0+WP1 implementer (brief: `docs/briefs/P2-WP0-WP1.md`), 2026-09-22. The database
is Supabase project `jurah` (`frvubflbpujwuhsxweue`). Everything below was applied and proved
through the Supabase MCP connector, because `JURAH_DATABASE_URL` is still owed (§6).

## 1. What exists now

- **`supabase/migrations/0001…0006`** hold 2 roles, 24 enums and 18 tables (the 12 contract
  entities and the 6 server-side tables). They define 66 named constraints (primary, unique,
  foreign and check), 10 guard triggers, 56 RLS policies, 23 functions and 2 views. All six were
  applied with `apply_migration`, and `list_migrations` shows six. Every file is idempotent, and a
  re-apply leaves the catalog fingerprint unchanged (§5).
- **`scripts/db/{migrate,seed,dump,env}.ts`** work over `JURAH_DATABASE_URL`, and each has a
  `--print` or `--digest-sql` mode for the MCP path. `seed.ts` only imports the `build*()` functions
  and never retypes a value. `dump.ts` computes one md5 per table on the database side and the same
  md5 in TypeScript from the transcription, so the two can be compared.
- **`lib/db/`**: `client.ts` is the only importer of `postgres`. It uses `prepare: false`, reads the
  URL and decides `selectedBackend()`. `withSession.ts` holds `withSession` / `withAgent` /
  `withSystem`. `audit.ts` holds `append()`, and `ids.ts` holds `newId()` (`<prefix>_<ULID>`, whose
  time part is `REFERENCE_NOW`). There is no `lib/db/format.ts`: no projection needed a TS-side
  `iso_kw`, because every timestamp is formatted in SQL.
- **The seam** has thin dispatchers in `lib/data/index.ts` and `lib/session/index.ts` (50 and 5
  exports, each typed `DataApi[…]`/`SessionApi[…]`). The mock bodies moved verbatim to
  `mock-impl.ts`. The one edit in `lib/data/mock-impl.ts` replaces the two inline refusal literals
  with imports from `refusals.ts`, which produce the same bytes. `lib/data/pg/index.ts` implements
  `getPatient`, `getPrescriptions`, `getSettings` and `getInvitationForConsent`; its other 46
  functions throw `P2: not implemented — WP3/WP5`. `lib/session/pg/index.ts` implements
  `getSession`, which reads the existing mock cookie, and the other four throw.
- **The guards.** Guard 8 (`sql-only-in-db.ts`) and guard 9 (`no-secrets.ts`) are new. Guard 4
  now also covers `supabase/**` and `app/api/**`, guard 6 covers the SQL and `scripts/db/**`, and
  guard U covers the SQL.
- **`tests/integration/`** is a second vitest project with 7 files and 114 tests. It re-seeds per
  file and fails loudly without the URL.

## 2. Seed derivations the database needed and the mock did not

| What | Value | Why |
|---|---|---|
| Insert order | civil_id_test_list, accounts, patients, caregivers, prescriptions, doses, interaction_alerts, **messaging_links before settings**, push, refills, calendar, audit_events | FK order, plus the triggers' prerequisites. `settings_tracking_requires_link` would quietly turn سارة's tracking off without ml-03 already present, and `link_caregiver_must_be_active` needs cg-01 first. |
| `seq` | Array order of each `build*()` (cg-01…08, rx-001…009, ml-01…05, rf-01/02, ae-001…047 in id = createdAt order, doses in generator order) | Reproduces `caregiverIds`, the `getPrescriptions`/`getCaregivers` order and the activity tie-break. The seed has no two audit rows with equal `createdAt`, so the tie-break is never exercised. |
| `accounts.assigned_roles` | `roles` filtered to reviewer/admin | Seed rule 2. `account_roles()` re-derives the column and the dump digest asserts it equals the seed's roles table. |
| `Patient.caregiverIds` | Not stored. `seed.ts` asserts the transcribed arrays equal the derivation from `buildCaregivers()`. | D-21 |
| `messaging_links.chat_id` for ml-03 and ml-04 (`connected`) | `seed-synthetic-chat-<id>` | Required by `link_connected_has_chat`. The seed states no chat id. The value is never projected and names itself synthetic. It is **not** `[TO BE SUPPLIED]`, because a chat id is not something the owner owes. |
| `messaging_links.token_expires_at` for ml-05 (`pending`) | `REFERENCE_NOW + 15 min` = `2026-09-21T09:30:00+03:00` | Required by `link_pending_has_token`. The seed calls the token "live", and CR-048 sets a 15-minute expiry. ml-02 (`expired`) is left null. |
| `messaging_links.created_at` | `connectedAt` when stated, otherwise `REFERENCE_NOW` (the column default) | NOT NULL, not a contract field |
| `calendar_subscriptions.created_at` | `REFERENCE_NOW` (the column default) | Same |
| `refill_requests.sector` / `routed_from_sector` | Taken from the prescription by the trigger | §3.4 |
| Dose encoding | Runs of plain generated doses are sent as `unnest` of `YYYYMMDDHHmm` keys, and the id is re-derived in SQL | The explicit 949-row statement is about 150 KB, too large for the MCP connector. `seed.ts` asserts each dose's id equals the convention before it uses the compact form. The digest proves the result equals the generator row by row. |
| Seed actor | `jurah.session = {"role":"system"}`, `jurah.now = REFERENCE_NOW` | SCHEMA §4. The guard triggers see a system actor, and every default reads the frozen clock. |

## 3. Where SCHEMA.md could not be built as written, and what was built instead

Each item below is a deviation, and the report lists them all.

1. **Table count.** SCHEMA's heading says "Contract entities (11)", but its list has 12 tables.
   All 12 were built, plus the 6 server-side tables, for 18 in total.
2. **More SECURITY DEFINER functions than the one SCHEMA names.** `can_read_patient()` must be a
   definer. It reads `caregivers`, `interaction_alerts` and `prescriptions`, whose own policies
   call it, so as an invoker it recurses ("infinite recursion in policy"). Four more are definers
   for the same kind of reason: `jurah_session_is(role)` (it verifies an assigned clinic role
   against `accounts`, which `jurah_app` cannot read), `caregiver_ids_for_patient()`,
   `invitation_patient_first_name()` and `account_roles()`. **None of them writes anything, and
   none can move a caregiver row to `active`.** `caregiver_transitions` is independent of
   `current_user`: the probe with the owner and a system session was refused (§5). So G9's "no
   SECURITY DEFINER path to active" still holds.
3. **`can_read_patient` differs from SCHEMA's list in three ways.** (a) The `system` actor reads
   everything, because API-SURFACE §B's webhook, job and ICS paths run as `jurah_app` with role
   system. (b) The caregiver branch also requires the row's `civil_id` to equal the session's
   `civilId`. (c) The reviewer branch also requires `acc.assigned_roles ∋ reviewer`.
4. **`refill_routed_matches_sector` via a generated column.** A generated column cannot read
   another table. The build adds `refill_requests.sector`, which the trigger fills from the
   prescription, and the generated column `routed_from_sector`, and the check is
   `routed_to = routed_from_sector`. Ownership is also a foreign key,
   `refill_requests_prescription_owner_fkey (prescription_id, patient_id) → prescriptions (id, patient_id)`,
   which needs the new `prescriptions_id_patient_id_key`. `refill_routing` also fires `BEFORE
   UPDATE`: only `status` may change.
5. **`rx_cr002_invariant_1` is written null-safely.** SCHEMA's
   `field_review_status in ('pending','returned')` is NULL for an unflagged row, and a check that
   evaluates to NULL passes. The build uses `coalesce(…, false)`.
6. **Constraints SCHEMA left unnamed now have names.** The dose-times element regex is
   `rx_dose_times_shape`, through the immutable helper `jurah_hhmm_array_ok()`. `duration_days > 0`
   is `rx_duration_days_positive`. The audit trigger that fires after a dose update is
   `doses_status_recorded_audit`, and the audit scope check is `audit_patient_scope_has_patient`.
   The foreign keys and unique constraints follow the `<table>_<cols>_fkey|key` convention.
7. **`doses.seq` was added.** SCHEMA's doses table has no `seq`, but API-SURFACE §B's ICS ETag is
   "from the doses' max seq". The column is never projected.
8. **`doses_status_write` also fires `BEFORE INSERT`.** An insert whose status is not `upcoming`
   is a status write, and without this `jurah_app`'s generation grant could create a recorded
   dose. The allowed writers are `jurah_agent` and the `system` actor. `jurah_app` has no
   `UPDATE(status)` grant at all, so in practice the `system` allowance serves only the owner-run
   seed and engine.
9. **`prescription_clinical_fields_locked` is broader than SCHEMA's text.** `id`/`patient_id`
   never change. The field review is **one-shot**: `field_review_status` and its note, by, at and
   `needs_review` change only on a reviewer's `pending → confirmed|returned` (E-34). `status` and
   the discontinuation fields change only for `jurah_agent` or `system`.
10. **One-shot through RLS returns 0 rows instead of raising.** After a decision, a reviewer
    usually cannot SEE the record any more: ia-002 and rx-009 are not in any queue, so
    `can_read_patient` is false. The second `update` then matches 0 rows and the trigger never
    fires. The trigger does raise wherever the row is visible, as the owner with a reviewer
    session shows (§5). **WP5 must treat "0 rows updated" as the one-shot refusal** and not
    expect an exception every time.
11. **`link_chat_id_server_only`** allows a non-null `chat_id` only for the `system` actor and never
    for `jurah_agent`. That covers the webhook as `jurah_app`+system and the owner-run seed.
    SCHEMA's literal "`current_user = 'jurah_app'` and system" would have refused the seed.
    Clearing the value is always allowed, since `disconnectMessaging` clears it.
12. **`settings_tracking_requires_link` reads the subject's LATEST link** (`order by seq desc`,
    the row `getMessagingLink` shows), not "any connected row". An older connected row behind a
    newer expired one no longer counts as connected.
13. **`audit_events_immutable` is a STATEMENT-level trigger**, so an `update`/`delete` that matches
    no row raises too.
14. **`snapshots.data` is `json`, not `jsonb`.** jsonb re-sorts keys, and a snapshot must come back
    byte-identical.
15. **Column-level grants are stricter than SCHEMA's table.** `jurah_app` cannot SELECT
    `patients.civil_id`, `patients.telegram_chat_id`, `messaging_links.chat_id` or
    `push_subscriptions.endpoint/p256dh/auth`. `accounts` has **no** SELECT, only
    `UPDATE(last_chosen_role)`. **WP2** needs a definer resolver for `signIn` and must reach
    `account_roles()` and `civil_id_test_list` through it; both are owner-only today. The
    `sessions` policies (own `subject_id`, or system) are a placeholder for WP2 to replace.
16. **`civil_id_for_session()` runs before the role drop.** The brief orders "set local role, then
    resolve". The build resolves as the owner FIRST, in the same transaction, then drops to
    `jurah_app`, and revokes EXECUTE from both app roles. Otherwise any seam query running as
    `jurah_app` could resolve any subject's Civil ID.
17. **SQL-side opaque ids** (the trigger's audit row) are `ae_<32 hex>` from `gen_random_uuid()`.
    Application ids are `ae_<ULID>` (`lib/db/ids.ts`). Both are opaque (CR-041).
18. **`jurah_now()`'s fallback is the wall clock `now()`**, as the brief states. `withSession()`
    always sets `jurah.now`.
19. **Migration history.** The MCP connector records a timestamp `version`, not the file prefix.
    `migrate.ts` records the prefix and treats either as applied. `0001`'s stored text differs from
    the file by one comment line (corrected after applying: "live in 0005" became "live at the top
    of 0004"). The md5 of 0002–0006's stored text equals the files'.
20. **`has_table_privilege('jurah_agent','doses','update')` is `false`**, because the grant is
    column-level. The binding check is `has_column_privilege(…,'status','UPDATE')`: agent true,
    app false (§5).
21. **Guard 8 cannot be implemented as literally worded.** The brief says "no `` sql` `` tag
    outside lib/db/** and scripts/db/**", but `withSession(fn)` hands its callback a tagged `sql`
    that `lib/data/pg/**` must use. The rule as built, documented in the guard's header, has four
    parts. `import 'postgres'` is allowed only in `lib/db/client.ts`. The raw connection
    (`getSql`/`closeSql`) is imported only in `lib/db`, `scripts/db` and `tests/integration`; the
    dispatchers import `selectedBackend` alone. A SQL tag or `.unsafe(` may appear only there and
    in `lib/{data,session}/pg/**`, and every pg/ file that runs SQL must import `withSession`. An
    `insert into audit_events` may appear only in `lib/db/audit.ts`, the migration trigger, the
    seed and the tests.
22. **Guard 9's value check excludes two kinds of value.** It skips `JURAH_DATA_BACKEND`, whose
    value `mock` is a mode and would match everywhere, and any value shorter than 12 characters.
    `.env*` files other than `.env.example` are not scanned. When `.env.local` is absent the value
    sub-check prints NOT A PASS.
23. **Two extra files:** `scripts/db/env.ts` (loads `.env.local` for tsx and vitest, which Next
    does not do for them) and `supabase/README.md`.
24. **`jurah_app` holds full SELECT on `caregivers`, `civil_id` included.**
    `getInvitationForConsent`'s WHERE clause compares `c.civil_id` with the session's own
    `civilId`, and that needs the column privilege. No projection selects the column; the
    integration test scans the shapes for twelve-digit runs.
25. **`jurah_agent` holds full SELECT on `patients` and `caregivers`, `civil_id` included.** The
    agent route handlers are trusted server code. WP7 can tighten this to column grants that
    exclude `civil_id`, which is a candidate change, not done here.
26. **`jurah_agent` has no DELETE on `doses`.** SCHEMA's RLS table says doses DELETE is for
    `jurah_app` only. API-SURFACE §B, however, runs `/api/agent/schedule/recompute` (which cancels
    upcoming doses) as `jurah_agent`. The two documents disagree and the build follows SCHEMA.
    **The lead should decide before WP4b/WP7**, or the recompute route will hit
    `permission denied`.
27. **`lib/data/refusals.ts` imports `DEFAULT_SETTINGS` from `lib/data/mock/seed.ts`,** so the pg
    backend's import graph includes the mock seed module (its functions and constants, not the
    store). This is deliberate (D-022: one source for the bytes of the defaults).
28. **Objects SCHEMA does not name:** the migration helper `jurah_ensure_constraint()`,
    `jurah_new_id()`, `jurah_hhmm_array_ok()`, the unique `prescriptions_id_patient_id_key`, and
    the default `caregivers.access_level = 'read_only'`.

## 4. For the packages that follow

- **WP3 / Gate 3.** `print-shapes.ts --backend=postgres` calls `getInvitationForConsent('cg-08')`
  with a **null** session, exactly as the mock fixture was recorded. The pg implementation
  enforces E-24 (the invited Civil ID only), so the postgres run returns the `expired`
  placeholder and that line will read DIFFERS. That is the tightening, not a bug. The integration
  test proves the byte-identical shape under سارة's own session. The lead should decide whether
  the round-trip call runs as سارة.
- **WP3.** Keep every projection in `lib/data/shapes.ts` (key order). `PatientView` puts `phone`
  and `telegramLinkedAt` after `caregiverIds`, the order in which the mock's `updatePatientPhone`
  appends `phone`.
- **WP3.** `caregiverIds` comes from `caregiver_ids_for_patient()`, because a caregiver's own RLS
  shows it only its own row.
- **WP5.** See §3.10: one-shot refusals often arrive as 0 rows. `refill_routing` raises
  `prescription not found for this patient` when the prescription is invisible to the caller,
  and `does not belong` when it is visible but foreign.
- **WP2.** See §3.15 and §3.16. `withSession` expects a *verified* `Session` and resolves
  `civilId` itself.
- **CR-050.** `prescription_drafts` has no link to the saved prescription, and the draft is
  deleted on save, so `hasSourceImage` cannot be derived from it after the save. WP5 must keep
  the image somewhere keyed by prescription.

## 5. Gate 1 proof outputs (through the MCP connector)

- **Migrations.** `list_migrations` returns `0001_roles_and_functions · 0002_types · 0003_tables ·
  0004_constraints_and_triggers · 0005_rls · 0006_views`. The re-apply executed the six recorded
  texts again. The catalog fingerprint was identical before and after (`ALL 420 211e7975a904c0845b8ea52418ff0b3c`),
  the data digest was unchanged (`ab486922b16aac3dfb9a1eadb2f58114`), and the history still has 6
  rows.
- **Seed.** The function body loaded equals `seed.ts --body` byte for byte (md5
  `297a7eb7e88cff1d08ddbbc11110f926` with its leading newline). Every one of the 20 per-table
  digests equals `dump.ts --expected`. Counts: accounts 11 · patients 4 · caregivers 8 ·
  prescriptions 9 · alerts 3 · settings 3 · links 5 · push 4 · refills 2 · calendar 1 · doses 949
  · audit 47. A second run gave identical digests.
- **The four functions** were run as the exact `PG_QUERIES` text under the forged sessions. The
  rows were mapped through `shapes.ts` and `refusals.ts`, and all four were byte-identical to
  `tests/fixtures/shapes.json`. `settings` had 3 rows (pt-04: 0) before the read and 3 (pt-04: 0)
  after it.
- **RLS.** A cg-03 forged session sees 0 prescriptions and a cg-01 session sees 4. As `jurah_app`,
  `update audit_events` returns `permission denied`; as the owner it returns
  `audit_events is append-only`.
- **Constraint and trigger probes** (39 of them, each rolled back): every one was rejected by the
  named constraint or trigger, and every positive control was accepted. Two rows read
  `ACCEPTED` but are refusals: عبدالله → cg-03 (`· pending`) and عبدالله → حمد's settings
  (`refill_alerts_enabled=true`). RLS hid the row, so the statement matched 0 rows and the value
  is unchanged (§3.10).
- **Cleanup.** The helper schema `jurah_scratch` (the seed wrapper, digest and catalog-fingerprint
  functions) was dropped afterwards. The raw digest query then still matched all 15 tables, and
  `get_advisors(security)` leaves one INFO: `civil_id_test_list` has RLS on and no policy. That is
  deliberate, since the table has no grant at all.

## 6. What still needs `JURAH_DATABASE_URL`

`npx tsx scripts/seed-diff.ts --backend=postgres` (the record-by-record run over the dump),
`npm run test:integration` (114 tests, none yet run against the database),
`npx tsx scripts/print-shapes.ts --backend=postgres`, `npm run db:migrate` / `db:seed` / `db:dump`,
and `dump.ts --digest`. Also unproven at runtime: `selectedBackend()`'s default, under which
`next dev`/`next start` with a URL set pick `postgres`; it needs a real URL to observe. Every one
of these commands currently fails loudly with a NOT A PASS line. The
same assertions were made by hand through the MCP connector (§5).

## 7. Things found out the hard way

- **The MCP `execute_sql` call runs as ONE transaction and returns only the last statement's
  rows.** `set local role` and `set_config(..., true)` therefore work across the statements of a
  single call and never leak into the next one.
- **Supabase's `postgres` is not a superuser but has CREATEROLE.** `grant jurah_app to postgres`
  is still needed before `set role`.
- **Supabase's default privileges** grant every new table, sequence and function to
  `anon`/`authenticated`/`service_role`, and grant function EXECUTE to PUBLIC. The build turns
  them off in 0001 and revokes them in 0005. A test proves 0 grants remain.
- **`current_setting('x', true)` returns `''`, not NULL,** once a transaction-local value has
  existed on the connection. `jurah_session()` and `jurah_now()` must `nullif(…, '')`.
- **A second `apply_migration` adds a second history row.** The idempotency proof therefore
  re-executes the recorded statements with `execute_sql`.
- **`scripts/seed-diff.ts` runs its `main()` on import,** so importing `SEED_COUNTS` from it runs
  the mock diff. The integration test parses the literal from the source text instead.
- **An RLS `USING` clause can make a trigger's refusal unreachable** (§3.10). Negative tests have
  to say which of the two refused.
- **Next loads `.env.local` for `dev`/`start`; tsx and vitest do not.** `scripts/db/env.ts` fills
  that gap for the scripts and the harness only.
