# Jur'ah (جرعة) — Phase 2 Backend Plan

**Status (2026-09-23): all work packages built and gated — WP0/WP1 (Gate 1), WP2 (Gate 2), WP3a–d (Gate 3), WP4/WP4b (Gate 4), WP5 (Gate 5 — built and lead-reviewed; open for the owner's line-by-line review), WP6 (Gate 6), WP7 (Gate 7); WPfinal in progress (`docs/VERIFICATION.md` → "Phase 2"). Every gate is proven through the Supabase connector and by hand: `JURAH_DATABASE_URL` is still owed, so the integration suites (29 files) and the Postgres round trip have never run through the app and fail loudly by design. Implementation ran on Opus at the owner's request.** Written by the Phase 2 lead after a full read of `docs/Acceptance Criteria and Test Plan.md` (PHASE 2 section), `docs/Phase 2 — Backend Handoff.md`, `docs/BACKEND-NOTES.md` (all seven sections), `docs/DECISIONS.md`, `docs/Seed Dataset.md`, `docs/Project Brief.md`, and the frontend itself: `types/contracts.ts` field by field, all 55 seam functions in `lib/data/index.ts` and `lib/session/index.ts` with their callers, `lib/config.ts`, `lib/session/*`, `lib/data/mock/*`, `lib/schedule/*`, `proxy.ts`, the guard scripts, `scripts/print-shapes.ts` and `tests/fixtures/shapes.json`.

Companion Phase 0 documents, all in `docs/`: `API-SURFACE.md` (the contract between the phases) · `SCHEMA.md` (every table, column, key and constraint) · `ENFORCEMENT.md` (the refusal matrix) · `BACKEND-DIVERGENCES.md` (every place the real backend will behave differently from the mock — started now, appended as we go, per the owner's BACKEND-NOTES rule) · `DECISIONS.md` (D-015 → D-022 and CR-041 → CR-050, this pass).

---

## 0. The rule that governs everything

**The frontend does not change.** Not a component, not a screen, not a data-layer signature, not a return shape. Phase 2 replaces what is *behind* `lib/data/index.ts` and `lib/session/index.ts`. The config module's **values** may change; its shape may not.

### The frozen set, and the one command that proves it (D-019)

| Frozen (verification #10 must show an empty diff) | Changeable in Phase 2 |
|---|---|
| `app/[locale]/**` · `components/**` · `features/**` · `i18n/**` · `types/**` · `styles/**` · `public/**` | `lib/**` (the seam's implementation, session, schedule, config values) · `proxy.ts` (the session verifier — artefact 4 of the handoff) · `app/api/**` (new: the HTTP surface) · `scripts/**` · `tests/**` · `supabase/**` (new) · `docs/**` · `package.json` (dependencies) · `.env.example` |

Baseline is the last commit, `8cd7794`. The proof command, pinned now so it is never reinterpreted:

```bash
git diff --stat 8cd7794 -- 'app/[locale]' components features i18n types styles public
```

It must print nothing at every gate and at WPfinal. `types/contracts.ts` and `types/views.ts` are inside the frozen set on purpose: a shape that has to change is a change request, not an edit.

---

## 1. Decisions taken at Phase 0 (each logged in `docs/DECISIONS.md`; all approved by the owner's "go ahead", 2026-09-22)

| # | Decision | Status |
|---|---|---|
| D-015 | **Supabase Postgres, the existing project `jurah` (`frvubflbpujwuhsxweue`), wiped on the owner's instruction.** Migrations are SQL files in `supabase/migrations/`, applied through the Supabase MCP connector (no local CLI, `psql` or Docker on this machine). | `RESOLVED` (owner) |
| D-016 | **Runs inside the same Next.js deployment. The seam stays server functions.** Screens keep importing `'use server'` functions from `@/lib/data` and `@/lib/session`; Phase 2 replaces their bodies. HTTP route handlers under `app/api/**` exist only for what genuinely needs HTTP: the agent integration point, the bot webhook, the ICS feed, push subscription, and the expiry job. | `RESOLVED` (owner) |
| D-017 | **Enforcement is in the database, read from a server-verified session.** One direct Postgres connection (`postgres` driver, transaction-mode pooler, `prepare: false`). Every seam call runs in one transaction that first executes `SET LOCAL ROLE jurah_app` (a role bound by RLS, no `BYPASSRLS`, no `UPDATE` on `doses.status`) and `set_config('jurah.session', <verified session JSON>, true)`; every RLS policy and every guard trigger reads `current_setting('jurah.session', true)`. The agent route handlers run as `jurah_agent`, the only role with column-level `UPDATE (status, recorded_at, source)` on `doses`. `audit_events` has `UPDATE`/`DELETE` revoked from every role **and** a `BEFORE UPDATE OR DELETE` trigger that raises (grants alone do not bind the table owner). | `RESOLVED` (owner) |
| D-018 | **The session becomes a signed cookie plus a `sessions` table.** Cookie `jurah.session` carries `base64url(JSON{session, sid, exp}).HMAC-SHA256`; `proxy.ts` verifies the signature with Web Crypto at the edge (so its role redirects keep working); the data layer additionally checks `sessions.revoked_at is null` so sign-out then replay is a provable refusal. `Session`'s shape is unchanged. `proxy.ts`, `lib/session/cookie.ts` and `tests/e2e/helpers/session.ts` change — they are the session module and its test helper, not screens. | `RESOLVED` (owner) |
| D-019 | The frozen set and its proof command, above. | `RESOLVED` (owner) |
| D-020 | **The mock stays alive as a selectable backend.** `lib/data/index.ts` and `lib/session/index.ts` become thin dispatchers on a server-only `JURAH_DATA_BACKEND=mock\|postgres` (vitest and `npm run verify` default to `mock`; `next dev`/`next start` default to `postgres` once the env is present). The mock implementation moves intact to `lib/data/mock-impl.ts`; the real one lives in `lib/data/pg/`. 24 unit tests import `lib/data/mock/*` directly and `print-shapes.ts`/`seed:diff` reset the mock store; none of them break. `scripts/print-shapes.ts --backend=postgres` **is** verification #2's round-trip table. | `RESOLVED` (owner) |
| D-021 | **`REFERENCE_NOW` stays the frozen clock for all of Phase 2, backend included.** Generation is already pure; only invitation expiry, depletion, `waitedMinutes` and the expiry job read "now", and they read `REFERENCE_NOW` from `lib/config.ts`. Every server function that needs a clock takes `nowIso` as a parameter (as the mock's helpers already do), so the tests that "advance the clock" pass a later value — never the wall clock. Flipping to real time after the demo is a one-value change in the config module. | `RESOLVED` (owner) |
| D-022 | **Refusals keep the mock's return shapes at the seam.** Screens have no `try/catch`; a thrown server function lands on `error.tsx` (H2). So a refused call returns exactly what the mock returns today (`[]`, `null`, the default `Settings`, the empty `AlertReviewView`, the `ml-default` link …) while the refusal itself happens in the database (RLS returns zero rows, or a guard trigger raises and the seam maps it). `ENFORCEMENT.md` therefore carries two proofs per row: the DB-level refusal and the unchanged seam shape. Route handlers, which have a real HTTP status, return it. | `RESOLVED` (owner) |

---

## 2. Gate 0 preconditions — already met, with proof

**The Supabase project is empty.** Run 2026-09-22 after the wipe (D-015):

```
list_tables(public)      → {"tables":[]}
list_migrations          → {"migrations":[]}
select … counts →  auth_users 0 · auth_users_triggers 0 · public_tables 0 · public_views 0 ·
                   public_enums 0 · public_functions 0 · public_sequences 0 ·
                   schema_migrations 0 · storage_objects 0
```

**The frontend is green at the baseline** (`docs/VERIFICATION.md`, 2026-09-22): `npm run verify` exit 0 · 473 unit tests · 897 e2e tests across nine suites · `notes:check` 55/55.

**What the owner owes before WP0 can run** (each an environment value, never a file in the repository):

| Value | Env var | Needed by |
|---|---|---|
| Postgres connection string (transaction pooler URI, `postgres` role) for project `jurah` | `JURAH_DATABASE_URL` | WP0 seed script, every seam call |
| A 32-byte random session-signing secret | `JURAH_SESSION_SECRET` | D-018 |
| Agent-path bearer credential | `JURAH_AGENT_TOKEN` | WP7 |
| Cron/job credential | `JURAH_JOB_TOKEN` | WP5/WP6 expiry job |
| Telegram bot token (owed; `[TO BE SUPPLIED]` until a bot exists) | `JURAH_BOT_TOKEN` | WP6 |
| VAPID keypair (the public half goes to `NEXT_PUBLIC_PUSH_PUBLIC_KEY`) | `JURAH_VAPID_PRIVATE_KEY` | WP6 |

`.env.example` names each with an empty placeholder (added at Phase 0 — a changeable file); `scripts/guards/placeholders.ts` keeps counting the `[TO BE SUPPLIED]` markers; a new guard (WP0) greps the repository and the client bundle for any real secret.

---

## 3. Work packages, dependencies, parallelism, review gates

The lead plans, briefs, reviews and integrates; Sonnet subagents implement from written briefs (`docs/briefs/P2-WP*.md`, to be written at each launch). Independent packages launch in one message.

```
WP0 ──► WP1 ──► WP2 ──┬──► WP3a (prescriptions · doses)      ─┐
                      ├──► WP3b (alerts · review)              ├──► WP5 ──► WPfinal
                      ├──► WP3c (refills · calendar)           │      ▲
                      ├──► WP3d (activity · audit · settings)  ┘      │
                      ├──► WP4  (deterministic engine)  ────────────────┘
                      ├──► WP6  (channels: link · push · ICS)  ─────────┘
                      └──► WP7  (agent integration point)  ─────────────┘
```

| WP | Scope | Who | Depends on | Gate — passes only with pasted output |
|---|---|---|---|---|
| **WP0 Scaffold** | `postgres` dependency; `lib/db/` (connection, `withSession()` transaction helper that always sets role + GUC); `supabase/migrations/` tooling (`scripts/db/migrate.ts` reads the SQL files and applies them through the MCP or the connection); `scripts/db/seed.ts` generated **from the same transcription the mock uses** (`lib/data/mock/seed.ts`'s `build*()` functions, which `seed:diff` already proves match `docs/Seed Dataset.md`); `JURAH_DATA_BACKEND` dispatch in the two seam modules with the mock moved intact; `tests/integration/` harness (vitest project against the real DB, guarded to skip loudly — never pass — when `JURAH_DATABASE_URL` is absent); the secret-scan guard. | lead | owner's env values | **Gate 0:** migrations apply to the empty project; the seed loads and is re-runnable to an identical state (run twice, diff the dump); `npm run verify` still exit 0 with `mock`; one integration smoke test forges a caregiver session for a `pending` row and shows **zero rows** from `prescriptions` (the RLS mechanism works through the pooler). |
| **WP1 Schema and seed** | Every table, type, key, constraint, RLS policy and guard trigger in `SCHEMA.md`; the two DB roles; the seed producing exactly the seed's records. | 1 subagent | WP0 | **Gate 1:** `scripts/seed-diff.ts --backend=postgres` diffs clean against `tests/fixtures/seed-expected.json` record by record; every `SCHEMA.md` constraint has a negative test (a row that must be rejected, shown rejected). |
| **WP2 Auth and role resolution** | `lib/session/pg/`: Civil ID against the test list; roles resolved server-side (caregiver only when `active`); signed cookie + `sessions` table (D-018); `proxy.ts` edge verification; the pending-only session; `last_chosen_role` persisted per account (BACKEND-NOTES §2); `signIn`'s two `no_claims` responses indistinguishable; `tests/e2e/helpers/session.ts` mints signed cookies. | 1 subagent | WP1 | **Gate 2:** every `ENFORCEMENT.md` row tagged `auth` passes; the timing distributions of `signIn(منى)` vs `signIn(277091900873)` overlap (200 samples each, pasted); the twelve seed IDs resolve exactly as `docs/ROLES.md`'s table says. |
| **WP3a–d Read paths** | The 33 read functions of `API-SURFACE.md`, by domain, each mapping RLS's zero rows to the mock's refusal shape (D-022); `readLastKnownSnapshot` persisted per subject. | 4 subagents in parallel | WP2 | **Gate 3:** `print-shapes.ts --backend=postgres` matches `tests/fixtures/shapes.json` byte for byte for every read function (created-row ids per CR-041); `ENFORCEMENT.md` rows tagged `read` pass. |
| **WP4 Deterministic engine** | Reuse `lib/schedule/*` unedited (pure, already tested against the seed); add the DB writer for generation, **recomputation on a REPORTED miss** (regenerate only the remaining `upcoming` doses from the prescription's own fields — the generator never reads the miss, so an alternate-day cadence cannot collapse), discontinuation (cancel remaining `upcoming` doses, write `prescription_discontinued`), depletion, the `caregiver_invite_expired` job. No model call anywhere. | 1 subagent | WP1 | **Gate 4:** 100 % on the seed's hand-computed tables at the frozen clock — حمد's six rows on 2026-09-21 and three on 2026-09-26; فاطمة's 20/22 not 21; سارة's seven; `rx-006`/`rx-007` generate nothing; recompute after the 2026-09-19 miss changes no scheduled time and no cadence. |
| **WP5 Write paths and enforcement** | The 17 write functions: settings (seven keys, G10 refusal), phone, onboarding, refills (ownership + active + sector routing in a trigger), prescription intake (draft → row → doses), the invitation lifecycle (invite · cancel · revoke · accept · decline · self-unlink, expiry at read time **and** by job), field confirmation (five keys only, transactional regeneration, one-shot), review decisions (one-shot), the masked-name lookup (session-required, rate-limited, audited to a server-side table, byte-identical responses). Every `ENFORCEMENT.md` row tested. | 1 subagent | WP3, WP4 | **Gate 5 — the owner reviews line by line:** every `ENFORCEMENT.md` row executed with the actual result pasted; the masked-name lookup's two responses diffed byte for byte apart from the name; the rate limit demonstrated; write-then-read shapes match §5. |
| **WP6 Channels** | Messaging link: random single-use expiring token, `POST /api/messaging/telegram/webhook` resolves `/start <token>` and stores `chat_id` (bot token server-side; `BOT_IS_SIMULATED` honest while the handle is owed); web push: `POST/DELETE /api/push/subscription`, VAPID, payloads with no `actions`, nothing to a non-`active` caregiver; ICS: `GET /api/calendar/{token}.ics`, spec-valid, regenerated when doses change, every non-GET method 405. | 1 subagent | WP2 | **Gate 6:** the ICS feed opened in a real calendar client and a write-back refused (pasted); a push payload with `actions` stripped at the server; a used token refused a second chat; a token for one subject refused for another. |
| **WP7 Agent integration point** | `app/api/agent/**` authenticated by `JURAH_AGENT_TOKEN`, running as `jurah_agent`: dose-status write (`tracked:false` refused; every write appends `dose_status_recorded` with `actor.role: "agent"` via the trigger); check-in eligibility (tracking on **and** `connected` link); alert recipients (`active` caregivers only); alert write with `sourceCitation`; extraction write with `needsReview`/`startDate`/`doseTimes`; schedule recompute on a reported miss. Documented in `API-SURFACE.md` §B for the agents track. | 1 subagent | WP4, WP5 | **Gate 7:** the audit log filtered to `dose_status_recorded` shows only `agent`/`system` actors, in the database; a patient/caregiver/reviewer/admin session against every agent endpoint → 401/403 pasted. |
| **WPfinal Verification and handoff** | The twelve verification items of the master prompt, item by item, with output; the spec's Phase 2 criteria walked; `BACKEND-DIVERGENCES.md` closed; `BACKEND-NOTES.md` §6 placeholders updated to what is now real. | lead | all | Never self-certified. |

**Parallelism.** WP3a–d, WP4, WP6 and WP7's read half all fan out after Gate 2 in one message; WP5 waits for WP3+WP4; WP7's write half waits for WP5. No two subagents own the same file — the file ownership table goes into each brief.

**What every brief carries, verbatim:** the invariant block from the master prompt (G1, G9, G10, G11, G12, and the "plus" list), the frozen set and its proof command, D-017's `withSession()` rule (no query outside it), D-022's refusal-shape rule, and "a guard that passes because its input does not exist is a failure" (owner's standing rule).

---

## 4. Change request list — nothing here is built as written until the owner answers

Full text in `docs/DECISIONS.md`; one line each here.

| CR | What cannot be built as written | Default taken meanwhile |
|---|---|---|
| CR-041 | §5's shapes for **created** rows carry counter ids (`rx-draft-10`, `rf-03`, `cg-09`, `ml-live-1`, `ae-live-0001`); §2 requires opaque database ids. Both cannot hold. | Seed rows keep their text ids byte-for-byte; created rows get opaque ids; the round trip treats `id` on a created row as *present and a string*, everything else byte-exact. |
| CR-042 | §2 says "refuse a prescription with no source", but B4's `ExtractionOutcome` carries no `source` and the real extraction is the agents track's. Refusing breaks B4 unchanged. | The backend writes what the mock writes (`facilityName: ''`, `sector: 'public'`) and the divergence log names it as *not yet enforced*; enforcement lands when the extraction write path (WP7) carries a source. |
| CR-043 | The spec requires every masked-name lookup to be audited; `AuditEvent.type` has no matching value and widening the union is a contract change. | A server-side table `lookup_audit` (session id, subject id, timestamp — **never** the Civil ID) drives the rate limit; X1 does not show it. |
| CR-044 | Verification #3 wants "the actual HTTP status and body" per refusal, but 55 of the surface's functions are server functions with no status. | Route handlers paste status + body; seam functions paste the SQL/RLS result **and** the unchanged return shape (D-022). |
| CR-045 | Five mutations write no audit row (`updatePatientPhone`, `completeOnboarding`, `enableCalendarSync`, `sendTestNotification`, `sendTestMessage`) and the `AuditEvent.type` union has no value for them. | Left unaudited, matching the mock; the owner may widen the union. |
| CR-046 | `getRecentDoses` has no caller anywhere. | Served (the seam is fixed), flagged in `API-SURFACE.md`. |
| CR-047 | `getAuditLog` masks `patients.name` for an admin who may read no clinical record; the mask must be computed where the admin's role cannot reach the name. | A SQL function `mask_name(text)` invoked inside a `SECURITY DEFINER` view that returns only the masked string; unit-tested against the seed's eight examples **and** cross-checked against `lib/format/maskedName.tsx`. |
| CR-048 | §2 says store only the link token's hash; §5's `getMessagingLink`/`startMessagingLink` shapes return `linkToken` on read. | Store the token in clear with a 15-minute expiry and single use; it is the owner's own short-lived secret, never rendered (rule 7). Owner may prefer hash-and-hide, which changes the read shape. |
| CR-049 | The mock's extraction and drug-check are byte-size stubs; the real pipelines are the agents track's, and Phase 2 must not build them. | Phase 2 keeps a deterministic provider behind the seam (same byte-size switch, labelled `simulated`), stores the image and the draft, and exposes the agent write path for the real result. |
| CR-050 | G3s needs a source image; `Prescription` has no image field (`FieldQueueItem.hasSourceImage` is a boolean). | `prescription_drafts.image` is stored server-side and `hasSourceImage` is derived from it; no contract field added. |
| D-014 | Four refusals the mock does not make (`getAlertForReview` queue gating, `savePrescriptionDraft` ownership, `readLastKnownSnapshot` scoping, `requestRefill` ownership). | Built from the spec; each is a row in `ENFORCEMENT.md` marked "mock does not refuse today". |
| CR-040 | Refill for a flagged prescription — `OPEN`. | The mock's inclusive behaviour is kept; noted in the divergence log as a pending owner decision. |

Two seeded facts, not change requests but worth the owner's eye: only 23 of the 25 `AuditEvent.type` values appear in the seed — `prescription_discontinued` and `caregiver_self_unlinked` are written at runtime by WP4 and WP5 and will never be in the seed; and `Account.roles` is stored as *assigned* roles only (`reviewer`/`admin`) and derived otherwise, as seed rule 2 requires.

---

## 5. Risk list — the three most likely failures

| # | Failure | How the plan mitigates it |
|---|---|---|
| 1 | **A shape difference from the real database tempts a frontend edit** — a `numeric` arrives as a string, a timestamp loses its `+03:00`, an array nests one level deeper, or **the keys come back in a different order** (the mock's order is per-function and not uniform — see §6). | Timestamps are stored as `timestamptz` and formatted by one SQL function `iso_kw()` to exactly `YYYY-MM-DDTHH:mm:ss+03:00`; dates as `date` → `YYYY-MM-DD`; numerics cast to `float8`/`int`; every read projects through a TypeScript literal in `lib/data/shapes.ts` that fixes key order per function. `print-shapes.ts --backend=postgres` diffs the **serialised string** against `tests/fixtures/shapes.json` at Gate 3, and the pinned `git diff --stat` command runs at every gate. |
| 2 | **`proxy.ts`'s edge signature check and the data layer's session check diverge**, so a route is reachable that the data layer refuses (or vice versa), or a revoked session still passes the edge. | One shared verification module (`lib/session/verify.ts`, Web-Crypto only, imported by both `proxy.ts` and `lib/session/pg/`); a replay test (sign out, replay the cookie against `/ar/app` **and** against `getDosesForDay`) at Gate 2; `requireRole` in the shell layouts stays as the second gate exactly as Phase 1 built it. |
| 3 | **Transaction-mode pooling breaks the `set_config` session model** — a GUC set on one connection is read on another, or `SET LOCAL ROLE` is forgotten on one code path and a query runs as the table owner, bypassing RLS. | `withSession()` is the *only* exported way to run SQL (a guard greps for any other `sql\`` outside `lib/db/`); it sets role and GUC inside the same transaction; a Gate 0 smoke test asserts `current_user = 'jurah_app'` and `current_setting('jurah.session')` inside the transaction and shows a forged pending-caregiver session reading zero rows through the pooler. |

---

## 6. Where the round trip and the refusals get compared

- **Round trip (verification #2):** `npx tsx scripts/print-shapes.ts --backend=postgres` against a freshly re-seeded database, diffed against `tests/fixtures/shapes.json` (the mock's recorded shapes) with CR-041's id rule. Reported as a table, function by function, in `docs/VERIFICATION.md`.
- **Refusal matrix (verification #3):** `tests/integration/enforcement/*.test.ts`, one file per `ENFORCEMENT.md` tag, each test named by its row id (`E-01` …); the run's output is pasted. A row without a test is a failure of the plan, not of the code.
- **Store reset between suites** (BACKEND-NOTES §7's last lesson): the seed script is re-runnable to an identical state; the integration harness re-seeds in `beforeAll` per file. **The e2e suites mutate state too** (`clinic` reviews `ia-001`, `prescription` adds Brufen rows on every project × locale, `caregiving` declines `cg-08`, `supply` requests refills) and Phase 1 reset by restarting `next dev`, which resets nothing in Postgres — so at WPfinal `npm run db:seed` runs between every Playwright invocation, exactly where the restart used to be, and an idempotent test that *skips* because the state was already mutated counts as a failure under the counting rule. `playwright.config.ts`'s `webServer.command` pins `JURAH_DATA_BACKEND=postgres` explicitly so no run walks a backend by accident. No HTTP reset endpoint exists, by design.
- **Byte equality means key order too.** `tests/fixtures/shapes.json` is compared as a serialised string, and the mock's key order is not uniform: `getSettings(pt-04, no row)` has `patientId` **last** (`{...DEFAULT_SETTINGS, patientId}`) while `getSettings(pt-01)` has it first; live audit rows carry `id` last; `getAuditLog` appends `patientMaskedName` last; `DoseWithPrescription` keeps the dose's keys then appends `drug` and `dosePerAdministration`. A `select *`/`row_to_json` projection reproduces none of that, so every Postgres read projects through a TypeScript object literal that copies the mock's key order per function (`lib/data/shapes.ts`, shared by both implementations alongside `refusals.ts`), and the Gate 3 diff is on the string, never on deep-equal.

---

## 7. Open, waiting for the owner

1. Approval of this plan and of D-016 → D-022.
2. Answers, or acceptance of the defaults, for CR-041 → CR-050 and D-014.
3. The environment values in §2.
4. CR-040 (refill for a flagged prescription), still `OPEN` from Phase 1.
