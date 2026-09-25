# Jur'ah (جرعة) — Phase 2 Database Schema

One table per contract entity (`types/contracts.ts`, transcribed field by field), plus six server-side tables no contract names and no screen sees. Postgres 17 on Supabase, schema `public` (wiped, D-015). Every column below carries its type and nullability; every foreign key and constraint is named so `WP1`'s negative tests can name them too. **`NOT NULL` follows `docs/BACKEND-NOTES.md` §4:** a field is `NOT NULL` when a screen renders nothing sensible without it, nullable when its absence is a designed state.


> **As built (Gate 1, 2026-09-22).** The six migrations under `supabase/migrations/` are the schema of record; this document is the specification they were built from. WP1 recorded **28 deviations** in `docs/backend-notes/p2-wp1.md` §3, all reviewed and accepted by the lead. The ones a later reader must know: the contract-entity list below has **12** tables, not 11 (`accounts` is the twelfth) — 18 with the server-side ones · `can_read_patient()` and four read-only helpers are `SECURITY DEFINER` (policy recursion), **none writes and none can activate a caregiver row** (verified by probe and by `pg_proc` scan) · the `system` actor reads every patient (the webhook, job and ICS paths) · a reviewer's caregiver-style checks also verify the assigned role · **one-shot refusals usually surface as 0 rows under RLS rather than a raise** (the decided record leaves the reviewer's view), so the seam treats 0 rows as the refusal · column grants are stricter than §3's table (no `SELECT` on `patients.civil_id`, chat ids or push keys for `jurah_app`; `accounts` has no `SELECT`, only `UPDATE(last_chosen_role)`) · `refill_routed_matches_sector` is a generated column over a trigger-filled `refill_requests.sector` plus an ownership foreign key · `doses.seq` exists (ICS `ETag`) · `snapshots.data` is `json` (key order) · `civil_id_for_session()` runs **before** the role drop, as the owner, with `EXECUTE` revoked from both app roles · `jurah_agent` has **no `DELETE` on `doses`** (D-025: the recompute route runs as `system`) · later packages add migrations `0007+` only (D-026).

## Conventions

- **Ids are `text`**, never `uuid`: the contracts say `id: string` and Phase 1's shapes carry `pt-01`, `rx-001`, `rx-002-20260921-0800` … Seed rows keep those exact ids; runtime rows get an opaque prefix-plus-ULID (`rx_01J…`) — CR-041.
- **`seq bigint generated always as identity`** on every table whose contract shape is an ordered array (`caregiverIds`, `getPrescriptions`, `getCaregivers`, `getRefillRequests`, `getActivity` tie-break). It is never projected; it only reproduces the mock's insertion order.
- **Timestamps are `timestamptz`**, projected through `iso_kw(t)` = `to_char(t at time zone 'Asia/Kuwait', 'YYYY-MM-DD"T"HH24:MI:SS"+03:00"')` so the bytes match §5. Dates are `date` → `YYYY-MM-DD`. Dose times are `text[]` of `HH:mm` (a `check` enforces the shape).
- **`strength_mg` holds the number in `strength_unit`'s unit** (the contract's own warning): `rx-008` is `50` with `mcg`, never `0.05`. No SQL anywhere multiplies or divides it; Guard U is extended to `supabase/migrations/**`.
- **Enums** are Postgres `enum` types named after the contract union; `dose_source` has no `'ui'` value, so the database cannot store one.
- **Every table has RLS enabled** (`alter table … enable row level security`, deliberately **not** `force`): policies bind `jurah_app` and `jurah_agent`, and the owner (`postgres`) bypasses them. The owner is used only by migrations and the seed script; what stops a seam query from ever running as the owner is `withSession()` being the only way to run SQL (a guard greps for any other `sql\`` outside `lib/db/`) and the Gate 0 smoke test asserting `current_user = 'jurah_app'` inside the transaction (risk 3). Policies are keyed on `jurah_session()` — a `stable` SQL function returning `current_setting('jurah.session', true)::jsonb`.
- **The session GUC carries the resolved Civil ID.** `withSession()` enriches the verified `Session` with `civilId` **server-side, inside the transaction**, before `set_config` — the value never leaves the database connection, so G9 holds — and every policy and trigger reads `jurah_session()->>'civilId'` directly. There is no per-row resolver call in SQL; `civil_id_for_session()` is the one `SECURITY DEFINER` function `withSession()` itself calls to do that enrichment.
- **`TRUNCATE` is the seed's single sanctioned exception to append-only:** the re-runnable seed, as owner, truncates every table (including `audit_events`) before writing; `jurah_app` and `jurah_agent` hold no `TRUNCATE` on anything.

```sql
create type role_t          as enum ('patient','caregiver','reviewer','admin');
create type actor_role_t    as enum ('patient','caregiver','reviewer','admin','agent','system');
create type caregiver_status_t as enum ('pending','active','declined','expired','revoked');
create type sector_t        as enum ('public','private');
create type strength_unit_t as enum ('mg','mcg','g','ml','IU');
create type dosing_pattern_t as enum ('daily','alternate_day','other');
create type field_review_t  as enum ('pending','confirmed','returned');
create type rx_status_t     as enum ('active','completed','discontinued');
create type dose_status_t   as enum ('upcoming','taken_on_time','taken_late','missed');
create type dose_source_t   as enum ('adherence_agent','system','seed');       -- never 'ui'
create type severity_t      as enum ('info','warning','danger');
create type review_status_t as enum ('auto_cleared','pending_medical_review','reviewed');
create type reviewer_decision_t as enum ('confirmed','cleared');
create type routed_to_t     as enum ('public_pharmacy','private_pharmacy');
create type refill_status_t as enum ('requested','approved','denied');
create type subject_type_t  as enum ('patient','caregiver');
create type link_status_t   as enum ('not_connected','pending','connected','expired');
create type push_status_t   as enum ('active','revoked');
create type push_permission_t as enum ('default','granted','denied','unsupported');
create type audit_scope_t   as enum ('patient','system');
create type audit_type_t    as enum (/* the 25 values of AuditEvent.type, verbatim */);
create type language_t      as enum ('ar','en');
create type checkin_freq_t  as enum ('daily','every_other_day');
create type channel_t       as enum ('none','telegram','whatsapp','email');
```

---

## 1. Contract entities (11)

### `accounts` ← `Account`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text **PK** | no | `acc-01`… |
| `civil_id` | text **UNIQUE** | no | never selected by any seam projection; `check (civil_id ~ '^[0-9]{12}$')` |
| `name` | text | no | full name; shown in full only to its holder |
| `assigned_roles` | role_t[] | no | **only `reviewer`/`admin`**; `check (assigned_roles <@ '{reviewer,admin}')`. `Account.roles` is **derived** (seed rule 2): `account_roles(civil_id)` = patient iff a `patients` row · caregiver iff ≥ 1 `active` caregiver row · plus `assigned_roles`. |
| `last_chosen_role` | role_t | yes | server-side only (BACKEND-NOTES §2: persist the last choice per account) |

### `patients` ← `Patient`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text **PK** | no | |
| `civil_id` | text **UNIQUE**, **FK → accounts(civil_id)** | no | a patient always has an account |
| `name` | text | no | screens: A3 |
| `telegram_chat_id` | text | yes | null is NORMAL (G10); never projected to a screen |
| `telegram_linked_at` | timestamptz | yes | |
| `phone` | text | yes | optional contact number |
| `language` | language_t | no | |
| `onboarding_completed` | boolean | no | A0 routes on it |
| *(derived)* `caregiverIds` | — | — | `select array_agg(id order by seq) from caregivers where linked_patient_id = p.id` — never a stored array |

### `caregivers` ← `Caregiver` (one row per invitation)

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text **PK** | no | |
| `seq` | identity | no | ordering only |
| `civil_id` | text | no | **no FK** — an invitee may have no account (`cg-05`); `check` twelve digits |
| `name` | text | no | the patient's claim, never a lookup; `[TO BE SUPPLIED]` for `cg-05` |
| `relationship` | text | no | F1 renders it |
| `phone` | text | yes | read by no screen |
| `telegram_chat_id` | text | yes | alerts only, never projected |
| `linked_patient_id` | text **FK → patients(id)** | no | |
| `status` | caregiver_status_t | no | F1 groups on it; access reads `= 'active'` **alone** |
| `invited_at` | timestamptz | no | |
| `expires_at` | timestamptz | no | F1 pending wording; expiry folded into `status` at read time |
| `accepted_at` | timestamptz | yes | set **only** by the accept transition |
| `declined_at` | timestamptz | yes | |
| `revoked_at` | timestamptz | yes | CR-027: both kinds of withdrawal |
| `access_level` | text | no | `check (access_level = 'read_only')` |

Constraints: `caregivers_active_has_accepted` `check (status <> 'active' or accepted_at is not null)` · `caregivers_declined_has_declined_at` · `caregivers_revoked_has_revoked_at` · `caregivers_pending_is_clean` `check (status <> 'pending' or (accepted_at is null and declined_at is null and revoked_at is null))`. **Trigger `caregiver_transitions`** (`BEFORE UPDATE`): allowed edges only — `pending→active` (**iff** `jurah_session()->>'civilId'` resolves to this row's `civil_id`, and `expires_at > jurah_now()`), `pending→declined` (same caller rule), `pending→revoked` (linked patient's session; `accepted_at` must stay null), `pending→expired` (system, `expires_at <= jurah_now()`), `active→revoked` (linked patient's session **or** the caregiver's own session for self-unlink). Every other edge, every other caller, and any change to `civil_id`/`linked_patient_id` **raises**. There is no `SECURITY DEFINER` path that activates a row.

### `prescriptions` ← `Prescription`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text **PK** | no | |
| `seq` | identity | no | |
| `patient_id` | text **FK → patients(id)** | no | |
| `facility_name` | text | no | §4: rendered raw at ten sites; **empty string allowed** (CR-042) |
| `sector` | sector_t | no | refill routing is derived from this alone |
| `generic_name` | text | no | |
| `brand_name` | text | yes | generic-only records |
| `strength_mg` | numeric | yes | CR-002; **unconverted** |
| `strength_unit` | strength_unit_t | yes | absent → `mg` on the screen (CR-003); stored only when stated (`rx-008`) so §5 bytes match |
| `dose_per_administration` | numeric | no | |
| `frequency_per_day` | int | yes | CR-002 |
| `duration_days` | int | no | `check (> 0)` |
| `dosing_pattern` | dosing_pattern_t | no | |
| `start_date` | date | yes | CR-002 |
| `dose_times` | text[] | yes | `check (dose_times is null or dose_times <@ … ~ '^[0-2][0-9]:[0-5][0-9]$')` |
| `prescribed_at` `prescriber_name` `timing_relative_to_food` `route_of_administration` `special_notes` `indication` | text / timestamptz | yes | genuinely optional |
| `dispensing_units_per_package` | int | yes | |
| `dispensing_total_quantity_dispensed` | numeric | yes | |
| `dispensing_dispense_date` | date | yes | |
| `dispensing_brand_actually_dispensed` | text | yes | |
| `needs_review` | boolean | no | G3s queue |
| `field_review_status` | field_review_t | yes | absent for never-flagged |
| `field_reviewed_by` | text FK → accounts(id) | yes | |
| `field_reviewed_at` | timestamptz | yes | |
| `field_review_note` | text | yes | |
| `status` | rx_status_t | no | |
| `discontinued_reason` | text | yes | required when `discontinued` |
| `discontinued_at` | date | yes | required when `discontinued` |

Constraints (each a WP1 negative test):
- `rx_dose_times_match_frequency` — **the write-time constraint the spec names:** `check (dose_times is null or frequency_per_day is null or cardinality(dose_times) = frequency_per_day)`.
- `rx_cr002_invariant_1` — `check (needs_review or field_review_status in ('pending','returned') or (strength_mg is not null and frequency_per_day is not null and start_date is not null and dose_times is not null))`: an `active`, unflagged prescription carries the clinical four (`brandName` excluded — generic-only, Gate 0b).
- `rx_dispensing_all_or_none` — the three required dispensing columns null together or set together.
- `rx_discontinued_complete` — `check (status <> 'discontinued' or (discontinued_reason is not null and discontinued_at is not null))`.
- `rx_confirmed_has_reviewer` — `check (field_review_status is distinct from 'confirmed' or field_reviewed_by is not null)`.
- **Trigger `prescription_clinical_fields_locked`** (`BEFORE UPDATE`): `generic_name`, `brand_name`, `strength_mg`, `strength_unit`, `dose_per_administration`, `frequency_per_day`, `duration_days`, `dosing_pattern`, `start_date`, `dose_times`, `sector`, `facility_name` may change **only** when `jurah_session()->>'role' = 'reviewer'` **and** the same statement moves `field_review_status` from `pending` to `confirmed` (the audited confirm path), or when the caller is `jurah_agent` acting on the WP4 discontinuation path (which changes `status`, `discontinued_*` and nothing clinical). Anything else raises.

### `doses` ← `Dose`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text **PK** | no | deterministic `<rx>-<YYYYMMDD>-<HHmm>` from the generator (not a counter — kept) |
| `prescription_id` | text **FK → prescriptions(id) ON DELETE CASCADE** | no | |
| `scheduled_at` | timestamptz | no | B1 orders on it |
| `status` | dose_status_t | no | default `upcoming` |
| `tracked` | boolean | no | default true; **`false` is stored explicitly** (a null would render a pill) |
| `recorded_at` | timestamptz | yes | |
| `source` | dose_source_t | yes | never `ui` (enum) |

Constraints: `dose_taken_late_has_recorded_at` `check (status <> 'taken_late' or recorded_at is not null)` · `dose_untracked_has_no_status` **`check (tracked or status = 'upcoming')`** — a dose with `tracked:false` can never hold a status, whatever writes it. **Grants:** `jurah_app` has `SELECT`, `INSERT`, `DELETE` (generation and regeneration) and `UPDATE (scheduled_at, tracked)` only; **`UPDATE (status, recorded_at, source)` is granted to `jurah_agent` alone.** **Trigger `doses_status_write`** (`BEFORE UPDATE OF status`): raises unless `current_user = 'jurah_agent'` or the session actor is `system` on the WP4 recompute path; then `AFTER UPDATE OF status` **inserts** `audit_events(type='dose_status_recorded', actor_role = 'agent' | 'system', related_id = dose id)` — every status write is audited by construction. **No function, job or trigger anywhere sets `status = 'missed'` from the clock**; `scripts/guards/no-dose-write.ts` scans `supabase/migrations/**` and `app/api/**` for `missed` in any `update` or `set` statement.

### `interaction_alerts` ← `InteractionAlert`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text PK · `patient_id` FK → patients · `involved_prescription_ids` text[] · `severity` severity_t · `description` text · `source_citation` text (**not null, empty string allowed** — `[TO BE SUPPLIED]` is a value) · `created_at` timestamptz · `review_status` review_status_t | no | C1 sorts on `created_at` unguarded |
| `reviewer_decision` reviewer_decision_t · `reviewer_note` text · `reviewed_at` timestamptz · `reviewed_by` text FK → accounts(id) | yes | |

Constraints: `alert_reviewed_complete` `check (review_status <> 'reviewed' or (reviewer_decision is not null and reviewed_at is not null and reviewed_by is not null))` · `alert_unreviewed_clean` (the four null unless `reviewed`) · `alert_involves_something` `check (cardinality(involved_prescription_ids) >= 1)`. **Trigger `alert_review_once`** (`BEFORE UPDATE`): the five review fields change only when `old.review_status = 'pending_medical_review'` and the caller is a reviewer; all other columns are immutable after insert; a second decision **raises** (the mock overwrites — tightened per BACKEND-NOTES §3 wp4i). Inserts only by `jurah_agent`.

### `refill_requests` ← `RefillRequest`

`id` text PK · `seq` · `patient_id` FK → patients · `prescription_id` FK → prescriptions · `requested_at` timestamptz · `routed_to` routed_to_t · `status` refill_status_t — all `NOT NULL`. **Trigger `refill_routing`** (`BEFORE INSERT`): loads the prescription; raises unless `prescription.patient_id = new.patient_id` and `prescription.status = 'active'` (D-014); **overwrites** `new.routed_to` with `case sector when 'public' then 'public_pharmacy' else 'private_pharmacy' end` — a client-supplied value can never survive. Constraint `refill_routed_matches_sector` re-checks the same equality via a `check` on a generated column for defence in depth.

### `calendar_subscriptions` ← `CalendarSubscription`

`patient_id` text **PK** FK → patients · `token` text **UNIQUE NOT NULL** (32 random bytes, base64url; it is the patient's own secret and is shown to them on E1 — the spec's bounded exception) · `ics_url` text NOT NULL · `created_at`. RLS: the owning patient only.

### `messaging_links` ← `MessagingLink`

`id` text PK · `seq` · `subject_type` subject_type_t · `subject_id` text · `channel` channel_t default `telegram` · `status` link_status_t NOT NULL default `not_connected` · `link_token` text UNIQUE (CR-048; cleared on connect/disconnect) · `token_expires_at` timestamptz · `chat_id` text (**never projected to any seam shape**) · `connected_at` timestamptz · `created_at`. Constraints: `link_connected_has_chat` `check (status <> 'connected' or chat_id is not null)` · `link_pending_has_token` `check (status <> 'pending' or (link_token is not null and token_expires_at is not null))`. **Trigger `link_chat_id_server_only`**: `chat_id` may be set only when `current_user = 'jurah_app'` **and** `jurah_session()->>'role' = 'system'` (the webhook path) — a user session's statement carrying a `chat_id` raises. **Trigger `link_caregiver_must_be_active`** (`BEFORE INSERT`): a caregiver subject's row can be created only while its `caregivers.status = 'active'`. "Most recent row wins" is `order by seq desc limit 1`.

### `push_subscriptions` ← `PushSubscription`

`id` text PK · `subject_type` · `subject_id` · `status` push_status_t NOT NULL · `permission` push_permission_t NOT NULL · `created_at` timestamptz NOT NULL · **server-side only, never projected:** `endpoint` text · `p256dh` text · `auth` text · `endpoint_updated_at`. One row per subject (`UNIQUE (subject_type, subject_id)`). The seam's projection is a view `push_subscriptions_view` that omits the three key columns; `jurah_app` has `SELECT` on the view and column-level `SELECT` on the table excluding them.

### `audit_events` ← `AuditEvent` — **append-only at the database level**

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text PK | no | seed `ae-001…`; runtime opaque (CR-041) |
| `seq` | identity | no | tie-break for equal `created_at` |
| `scope` | audit_scope_t | no | |
| `patient_id` | text FK → patients | yes | `check (scope <> 'patient' or patient_id is not null)` |
| `actor_role` | actor_role_t | no | |
| `actor_id` | text | yes | |
| `type` | audit_type_t | no | |
| `message` | text | no | `check (message !~ '[0-9]{12}')` — **no Civil ID in any message, enforced** |
| `created_at` | timestamptz | no | |
| `related_id` | text | yes | |

**Append-only, three ways:** `revoke update, delete on audit_events from public, jurah_app, jurah_agent` · **trigger `audit_events_immutable`** `BEFORE UPDATE OR DELETE … raise exception 'audit_events is append-only'` (binds the owner too) · `revoke truncate`. **No client authors a row:** `INSERT` is granted to `jurah_app`/`jurah_agent`, and the only code that inserts is `lib/db/audit.ts`'s `append()` inside `withSession()` plus the two triggers above — a guard greps for any other `insert into audit_events`. Constraint `audit_dose_status_actor` **`check (type <> 'dose_status_recorded' or actor_role in ('agent','system'))`** — the demo's proof moment is a database constraint, not a filter.

### `settings` ← `Settings`

`patient_id` text **PK** FK → patients · `adherence_check_in_enabled` bool NOT NULL default false · `adherence_check_in_frequency` checkin_freq_t NOT NULL default `daily` · `refill_alerts_enabled` bool NOT NULL default false · `calendar_sync_enabled` bool NOT NULL default false · `web_push_enabled` bool NOT NULL default false · `notification_channel` channel_t NOT NULL default `none` · `language` language_t NOT NULL default `ar`. **No row for بدر, by design; the seam returns the defaults without writing.** No column may ever represent disabling the dashboard, screening or the engine — there is none, and `ENFORCEMENT.md` E-33 asserts the column list. **Trigger `settings_tracking_requires_link`** (`BEFORE INSERT OR UPDATE OF adherence_check_in_enabled`): when the new value is `true` and no `connected` `messaging_links` row exists for the patient, the trigger resets it to `old`/`false` (G10: a quiet refusal, never an error), and the seam's whitelist admits only the seven keys.

---

## 2. Server-side tables (7) — no contract, no screen

| Table | Columns | Purpose |
|---|---|---|
| `voice_turns` | `id` text PK · `seq bigint generated always as identity` · `patient_id` text **NOT NULL FK → patients(id) on delete cascade** · `topic` text, `check in ('launch','next_dose','dose_amount','today','forgot','record','unclear','bye')` (`record` added by migration 0013) · `language` text, `ar` or `en` · `reply` text, 1 to 2000 characters · `created_at` timestamptz default `jurah_now()` | CR-069, amended by CR-102. One Alexa turn; not clinical data, no dose status. Index `voice_turns_patient_seq (patient_id, seq)`. The app reads it through `lib/assistant` `voiceTurns` (`lib/data/pg/voice.ts`), beside the seam and not one of its 55 functions. Migrations `0012_voice_turns.sql`, `0013_voice_turns_record_topic.sql`. |
| `sessions` | `id` text PK (random) · `subject_id` text · `role` role_t null · `linked_patient_id` text null · `pending_invitation_only` bool · `created_at` · `expires_at` · `revoked_at` null | D-018. The cookie carries the signed `Session` plus `sid`; every seam call checks `revoked_at is null and expires_at > now`. `check (pending_invitation_only or role is not null)`. |
| `prescription_drafts` | `draft_id` text PK · `patient_id` FK · `prescription` jsonb · `confident` bool · `uncertain_fields` text[] · `image` bytea null · `created_at` | B4's in-flight drafts (the mock's `store.drafts`); `image is not null` drives `hasSourceImage` (CR-050). RLS: owning patient. |
| `lookup_audit` | `id` identity · `session_id` text · `subject_id` text · `at` timestamptz | CR-043: every masked-name lookup, **no Civil ID column exists**. Rate limit: `count(*) where session_id = $1 and at > now() - interval '60 seconds' > 10` → refuse with the same shape. |
| `snapshots` | `subject_id` text · `key` text · `data` jsonb · `as_of` timestamptz · PK `(subject_id, key)` | `readLastKnownSnapshot`, scoped to the caller (D-014), a serialised copy (§2). |
| `civil_id_test_list` | `civil_id` text PK | The twelve test IDs, so `signIn`'s step 2 is a table the seed owns rather than a constant duplicated in two places; still mirrored by `ALL_TEST_CIVIL_IDS` for the mock and checked equal by `seed:diff`. |
| `job_runs` | `id` identity · `job` text · `ran_at` · `rows_affected` | The expiry job's own record, so "the job ran" is provable without reading `audit_events`. |

---

## 3. Roles, functions, RLS

**Roles.** `jurah_app` (`NOLOGIN`, no `BYPASSRLS`; the seam's role, entered with `SET LOCAL ROLE` inside `withSession()`), `jurah_agent` (`NOLOGIN`; the agent route handlers), both granted to `postgres` so the single pooled connection can `SET ROLE`. `postgres` (owner) is used only by migrations and the seed. `anon`/`authenticated`/`service_role` (Supabase's PostgREST roles) get **no** grants on any table — the Data API is not the transport.

**Functions.** `jurah_session() returns jsonb stable` (the verified session **plus** `civilId`, enriched by `withSession()`) · `jurah_now() returns timestamptz stable` (reads `jurah.now` GUC set by `withSession()` from `REFERENCE_NOW`, D-021) · `civil_id_for_session(subject_id text, role role_t, pending boolean) returns text stable security definer` (called once per transaction by `withSession()` to enrich the GUC; resolves only the caller's own subject; the Civil ID never leaves the connection) · `can_read_patient(patient_id text) returns boolean stable` — the mock's `canReadPatient` in SQL: patient self · caregiver `active` and linked · reviewer with a queue item for that patient · admin never · `mask_name(text) returns text immutable` (CR-047; first + middle initials + `***` + last; honorifics `د.`/`م.` stripped; tested against the eight seed examples) · `iso_kw(timestamptz) returns text immutable` · `account_roles(civil_id text) returns role_t[] stable` (seed rule 2).

**RLS policies (one line each; the full SQL is WP1's).**

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `accounts` | never by `jurah_app` directly — only through `civil_id_for_session()`, `mask_name` via `lookupMaskedName`'s definer function, and `signIn`'s definer resolver | owner only | `last_chosen_role` by the account's own session | never |
| `patients` | `can_read_patient(id)` | owner (seed) / `jurah_agent` never | own row, columns `phone`, `onboarding_completed`, `language` | never |
| `caregivers` | linked patient's session (all states) · the row's own civil id (its own row) · `can_read_patient(linked_patient_id)` for the caregiver's own active row | patient session for `linked_patient_id = self` | trigger-governed (above) | never |
| `prescriptions` | `can_read_patient(patient_id)` · reviewer: `needs_review` rows or queue-member patients | patient self (draft save) · `jurah_agent` | trigger-governed | never (discontinue is an `update`) |
| `doses` | `can_read_patient` via prescription | `jurah_app` (generation) · `jurah_agent` | column grants above | `jurah_app` only for `status = 'upcoming'` (regeneration) — a recorded dose is never deleted |
| `interaction_alerts` | `can_read_patient(patient_id)` · reviewer: `pending_medical_review` rows | `jurah_agent` | reviewer, trigger-governed | never |
| `refill_requests` | `can_read_patient(patient_id)` | patient self, trigger-governed | `system` only (status changes) | never |
| `calendar_subscriptions` | patient self | patient self | patient self | never |
| `messaging_links` | subject self | subject self (trigger) | subject self · `system` (webhook) | never |
| `push_subscriptions` (view) | subject self | subject self | subject self | subject self (`DELETE /api/push/subscription`) |
| `audit_events` | `scope='patient' and can_read_patient(patient_id)` · admin: everything via `audit_log_admin` view | `jurah_app`/`jurah_agent` via `append()` | **never** | **never** |
| `settings` | `can_read_patient(patient_id)` | patient self | patient self (trigger) | never |
| `voice_turns` | only the patient the row belongs to (`voice_turns_patient_select`, to `jurah_app`, `jurah_session_is('patient')` and `patient_id` = the session's `subjectId`) — never a caregiver, reviewer, admin or the agent | `jurah_agent` only, on five columns (`voice_turns_agent_insert`, `with check (jurah_session_is('agent'))`) | never | never |
| `sessions` `snapshots` `lookup_audit` `prescription_drafts` | own rows only | own | own | own (`revoked_at` is an update) |

**What the admin role can reach, exhaustively:** `select` on `audit_log_admin` (the view) and `sessions`/`snapshots` own rows. `can_read_patient` returns `false` for `admin` unconditionally; there is no grant on `patients`, `prescriptions`, `doses`, `interaction_alerts`, `caregivers` — so "an admin reads audit metadata and nothing else" and "may not create, accept or revoke an invitation" are both the absence of a grant, provable with `has_table_privilege`.

---

## 4. Seed

`scripts/db/seed.ts` imports `buildAccounts()`, `buildPatients()`, `buildCaregivers()`, `buildPrescriptions()`, `buildSettings()`, `buildDoses()`, `buildAlerts()`, `buildMessagingLinks()`, `buildPushSubscriptions()`, `buildRefillRequests()`, `buildCalendarSubscriptions()`, `buildAuditEvents()` from `lib/data/mock/seed.ts` — **the one transcription of `docs/Seed Dataset.md`**, already diffed against `tests/fixtures/seed-expected.json` by `npm run seed:diff` — and writes them as `postgres` inside one transaction, `truncate … restart identity cascade` first, so a second run yields an identical dump (the owner's `TRUNCATE` is the one sanctioned exception to `audit_events`' append-only rule, above). `calendar_subscriptions.token` for سارة keeps the seed's `mock-token-cal-pt-03` so §5 matches; runtime tokens are random. The seed runs as the owner, which RLS does not bind (RLS is enabled, not forced), with `jurah.session = '{"role":"system"}'` so the guard triggers see a system actor; `check` constraints still apply to it — it never writes a `dose_status_recorded` row with a user actor because `audit_dose_status_actor` would refuse it. **The seed also runs between every e2e suite invocation at WPfinal**, replacing Phase 1's "restart `next dev`" ritual (BACKEND-NOTES §7's last lesson), since a server restart resets nothing in Postgres.
