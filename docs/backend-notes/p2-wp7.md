# P2-WP7 — the agent integration point · notes

Written by the WP7 implementer (brief `docs/briefs/P2-WP7.md`), 2026-09-22. This package builds
**the one documented way the AI-agents track writes results**. It does not build the agents.
`JURAH_DATABASE_URL`, `JURAH_BOT_TOKEN` and `JURAH_VAPID_PRIVATE_KEY` are still empty, so every
database statement below was proved by hand through the Supabase MCP connector. Each mutating proof
ran inside a `do` block that ends in `raise exception`, so it rolled back and carried its own
evidence. The integration files fail loudly, by design.

## 1. What exists now

| File | What it does |
|---|---|
| `app/api/agent/doses/[doseId]/status/route.ts` | `POST`. Thin: calls `postDoseStatus`. |
| `app/api/agent/schedule/recompute/route.ts` | `POST` → `postRecompute`. |
| `app/api/agent/alerts/route.ts` | `POST` → `postAlert`. |
| `app/api/agent/prescriptions/route.ts` | `POST` → `postPrescription`. |
| `app/api/agent/check-in-eligibility/route.ts` | `GET` → `getCheckInEligibility`. |
| `app/api/agent/alert-recipients/route.ts` | `GET` → `getAlertRecipients`. |
| `lib/agent/handlers.ts` | The six handlers. They always run in the same order: auth → validation (422) → backend (503 under the mock) → database → status. |
| `lib/agent/auth.ts` | `refuseUnlessAgent`. A verified user session is 403 (even with a valid bearer). A missing or wrong bearer is 401. The token check is constant time. An unset token refuses everyone. |
| `lib/agent/validate.ts` | Strict body validators for all six routes. They are pure and unit-tested. |
| `lib/agent/messages.ts` | The audit messages (Arabic; they live here because guard 7 scans `app/**`). |
| `lib/agent/notify.ts` | Alert delivery through `lib/push/send.ts` (`sendPush`, the whitelist) and `lib/messaging/telegram.ts`. The patient and ACTIVE caregivers only. |
| `lib/agent/http.ts` | `json`, `invalid`, `refusedBy`, `readJson`, `unavailableUnderMock`. |
| `lib/data/pg/agent.ts` | **Every SQL statement of the six routes** (`PG_QUERIES_AGENT`) and their `withAgent`/`withSystem` bodies. See §2.1. |
| `supabase/migrations/0008_agent_grants.sql` | D-026. Tightens `jurah_agent`'s grants (§4). Applied and recorded in `supabase/README.md`. |
| `tests/unit/agent/validate.test.ts`, `routes.test.ts` | 47 tests. They cover every route × every user role (403, and 403 with a valid bearer too), 401, 422, 409, 503-under-mock, E-06's payload, and the route enumeration. |
| `tests/integration/enforcement/dose.test.ts` | E-01, E-02, E-04 and E-05 are appended. E-03 is extended to call the real `POST /api/jobs/expire-invitations` (WP6's) and `POST /api/agent/schedule/recompute`. |
| `tests/integration/enforcement/agent.test.ts` | The routes against the database: every role, 409, 422, E-07's HTTP half, eligibility and the 0008 grants. |

## 2. Decisions taken here (for the lead)

1. **The SQL lives in `lib/data/pg/agent.ts`, not in `lib/agent/`.** The brief says "handlers live
   in `lib/agent/*.ts`". Guard 8 admits a SQL tag or `.unsafe(` only in `lib/db`, `scripts/db`,
   `tests/integration`, `lib/{data,session}/pg/**` and `lib/engine/**`. So the handlers in
   `lib/agent/` hold no SQL: they validate and orchestrate, and they call `lib/data/pg/agent.ts`.
   That is the same shape WP6's routes use with `pg/channels.ts`. The file is not in the lead's
   `pg/` barrel, and nothing imports it through the barrel. The lead accepted this when resuming
   the package.
2. **The dose-status audit row is the trigger's.** `doses_status_recorded_audit` already composes
   the mock's form `تسجيل حالة جرعة — <word>: <generic_name>` with `actor_role = 'agent'` for
   `jurah_agent`, so the handler appends nothing. That keeps it impossible to write a status
   without the audit row, and impossible to append the row twice.
3. **403 is checked before the bearer.** A request carrying a verified user session is 403 even
   with a valid agent bearer ("403 any user session cookie", API-SURFACE §B). If the session
   lookup itself throws, a request that presented the `jurah.session` cookie is refused 403
   rather than let through. An **unsigned or tampered** cookie is no session under WP2's signed
   cookie, so without a bearer it is **401, not 403**. That is correct and not a missed refusal.
4. **Under the mock backend the work is 503; 401, 403 and 422 are real.** Auth and validation run
   before the backend check (the same pattern as WP6's routes).
5. **The recompute appends `schedule_recomputed` on every run for a recorded miss**, whether or
   not the schedule changed. The seed's own row is for a recompute that is `changed:false`
   (p2-wp4b P3). A call for a dose that is not a recorded `missed` is refused with **409
   `not_a_recorded_miss`** and appends nothing. That covers an untracked past dose, which rule 4
   says is never a miss.
6. **Discontinuation** requires `discontinuedReason`, because `rx_discontinued_complete` forbids a
   null reason. `discontinuedAt` defaults to `REFERENCE_NOW`'s date (D-021). The route appends
   `prescription_discontinued` with actor `agent` and the message `أُوقفت وصفة <genericName>`
   (D-032), even though the transaction runs as the system actor (D-025).
7. **Alerts.** `reviewStatus` must be `pending_medical_review` or `auto_cleared`, otherwise 422.
   Any reviewer field is 422, and so is an `id`. `sourceCitation` is required as a string; an
   empty string and the owner's placeholder marker are both accepted. Every involved prescription
   must belong to the patient (otherwise 422 `not_prescriptions_of_this_patient`). The alert
   inserts with `newId('ia')`, and `alert_raised` (actor agent) is appended with the alert's
   `createdAt`. Delivery runs **after the commit**, so a failed push never un-raises an alert.
   While both channels are simulated nothing is read or sent, and the response carries
   `delivered: []`.
8. **Prescriptions.** `prescription.source` is required (CR-042), with a non-empty facility and a
   sector of public or private. The review decision fields (`fieldReviewNote`, `fieldReviewedBy`,
   `fieldReviewedAt`, and `fieldReviewStatus: 'confirmed'`) belong to the reviewer and are 422. A
   flagged extraction is stored `needs_review = true, field_review_status = 'pending'` and gets no
   doses (the generator returns `[]`). An unflagged one is stored with `field_review_status` null
   and gets its doses through WP4b's `insertGeneratedDoses` (never a second engine). `tracked` is
   the patient's `adherence_check_in_enabled` at that moment (rule 3). The CR-002 rule and
   `doseTimes.length === frequencyPerDay` are left to the database, which answers 422 naming the
   constraint. **CR-054 is not reproduced here:** the mock writes `'pending'` on a confident
   save, and the agent path writes null.
9. **Caregiver locale for a notification** is the linked patient's `settings.language`, because
   a caregiver has no Settings row.
10. **An agent may overwrite a recorded status** (e.g. `taken_on_time` over a `missed`). No
    constraint or document forbids it, and the trigger appends a second `dose_status_recorded` row,
    so the history stays whole. Whether a correction should be allowed at all is a design
    question for the lead and owner, not something I decided.
11. **0008 is idempotent, proved.** Re-running the file's statements through `execute_sql` left
    `jurah_agent`'s SELECT columns exactly `caregivers.id, caregivers.linked_patient_id,
    caregivers.seq, caregivers.status, patients.id`, with no `civil_id` and nothing on `accounts`.
    The migration history stayed at 9 rows.

## 3. Proofs (JURAH_DATABASE_URL empty — MCP connector, project `frvubflbpujwuhsxweue`)

Before any proof: doses 949, recorded 5, audit 47. After all of them (every mutating proof
rolled back): doses 949, recorded 5, audit 47, prescriptions 9, alerts 3, `rx-003` active,
`rx-009-20260921-1300` `upcoming|true`, 0 proof rows.

- **The demo's proof moment**, `select actor_role, count(*) from audit_events where
  type='dose_status_recorded' group by 1`. Before: `agent 5`. Inside the proof, after the agent
  wrote `taken_on_time` on سارة's `rx-009-20260921-1300` with the route's exact statement:
  `agent 6`. After the rollback: `agent 5`. At no point does a `patient`, `caregiver`,
  `reviewer`, `admin` or `system` row exist.
- **E-02.** As `jurah_agent`, the route's `recordDoseStatus` text on `rx-002-20260921-0800` →
  `check_violation dose_untracked_has_no_status`, and the row stays `upcoming|false|null`.
- **E-04.** On `rx-009-20260921-1300`, the statement returned `{"id":"rx-009-20260921-1300",…,
  "status":"taken_on_time","tracked":true,"recorded_at":"2026-09-21T13:05:00+03:00",
  "source":"adherence_agent"}`. The newest audit row was `patient|pt-03|agent|null|
  dose_status_recorded|تسجيل حالة جرعة — في وقتها: Calcium carbonate + vitamin D3|
  2026-09-21T09:15:00+03:00|rx-009-20260921-1300|ae_…`, and the audit count went 47 → 48.
- **E-01 / E-05.** As `jurah_app`, `update doses set status='taken_on_time'` under حمد, عبدالله,
  د. خالد (reviewer), م. دانة (admin), سارة (on her own tracked dose) and even the `system` actor
  → `42501 permission denied for table doses` every time. `rx-003-20260921-0800` stays
  `upcoming|false`.
- **Prescriptions (verbatim statements and real validator output).** An unflagged Amoxicillin
  for pt-01 was inserted with `needs_review=false frs=null`. Tracking was off, so 21 doses were
  inserted, all `upcoming` and untracked, and the audit row was
  `agent|prescription_added|أُضيفت وصفة Amoxicillin`. Two doseTimes for frequency 3 →
  `rx_dose_times_match_frequency`. Unflagged with no startDate → `rx_cr002_invariant_1`.
- **Alerts (verbatim).** The prescriptions query returned rx-001 Warfarin and rx-002 Ibuprofen.
  The insert returned `review_status pending_medical_review`, `source_citation ""` and
  `created_at 2026-09-21T09:15:00+03:00`. The audit row was
  `agent|alert_raised|تنبيه تعارض خطير: Warfarin و Ibuprofen`, byte-identical to the seed's ia-001
  row.
- **Recompute and discontinue** (`jurah_app`, session system):
  - `rx-008-20260919-0700` reads `rx-008:missed`, and `rx-008-20260920-0700` reads
    `taken_on_time` (→ 409).
  - rx-008's doses md5 is `e2f73b9c…` before and after.
  - The audit row is `system|schedule_recomputed|إعادة حساب جدول Levothyroxine بعد جرعة فائتة|rx-008`.
  - Discontinuing rx-003 at 2026-09-21 updated 1 row and cancelled 162 doses. It kept
    `09-21 08:00` and `09-21 20:00` (D-023), and the md5 of the recorded doses was unchanged.
  - That discontinuation's audit row is `agent|prescription_discontinued|أُوقفت وصفة Metformin|rx-003`.
  - A second discontinuation matched 0 rows (→ 409).
- **Reads under the 0008 grants (as `jurah_agent`):**
  - `recipients(pt-01)` = the patient pt-01 (no chat, no push), then cg-01 (chat
    `seed-synthetic-chat-ml-04`) and cg-02. **No cg-03 through cg-08** (E-07, HTTP half).
  - `recipients(pt-03)` = pt-03 with `seed-synthetic-chat-ml-03`, and `recipients(pt-99)` = `[]`
    (→ 404).
  - `eligibility` = exactly `[{pt-03, seed-synthetic-chat-ml-03, ar, daily}]`.
  - `select civil_id from patients` / `from caregivers` → `permission denied`.
  - WP6's `pushTarget`/`chatTarget`/`activeCaregivers` shapes still run.
- **curl against `next dev` on :3100** (mock backend) returned the same statuses on all six
  routes for each caller:
  - no cookie and no bearer, a wrong bearer, the job token, or an unsigned cookie → 401;
  - a signed cookie for حمد, عبدالله, د. خالد or م. دانة → 403, with no bearer **and** with the
    valid agent bearer;
  - the agent bearer alone → 503.
  Every 422 carries `{error:'invalid_body', field, reason}`.

## Divergences

| # | Function / place | Mock | Backend | Why | Could a screen notice? |
|---|---|---|---|---|---|
| WP7-1 | Agent routes under `JURAH_DATA_BACKEND=mock` | n/a (the mock has no agent path) | 401/403/422 are real; the work answers 503 `{error:'unavailable'}` | The mock has no store the agents could write to, and the routes never fabricate one (same as W6-11) | No. No screen calls a route |
| WP7-2 | `dose_status_recorded` `createdAt` for a live write | Seed rows carry the moment of the answer (e.g. 07:55) | `jurah_now()` (REFERENCE_NOW under the frozen clock), not the body's `recordedAt`. `recorded_at` on the dose carries `recordedAt` | The trigger stamps the audit row. D-021 | E2's activity time reads 09:15 for a live write. No seed screen changes |
| WP7-3 | `dose_status_recorded` message for rx-009 | Seed rows say `Calcium carbonate + D3` | The trigger reads the stored generic name `Calcium carbonate + vitamin D3` | The seed's hand-written messages abbreviate the name; the prescription row does not | Yes, E2 text for a live write. The owner may align the seed's messages or the name |
| WP7-4 | `POST /api/agent/schedule/recompute` statuses | n/a | Adds 409 (`not_a_recorded_miss`, `prescription_not_active`) and 422 (bad date, a dose of another prescription) to §B's `401 · 403 · 404` | The engine's refusal values need a non-throwing status (D-29) | No |
| WP7-5 | Recompute body | §B lists `discontinuedReason?` as optional | Required for `discontinued` (422 without it); `discontinuedAt` optional, defaulting to REFERENCE_NOW's date | `rx_discontinued_complete` forbids a null reason; D-021 | No |
| WP7-6 | Agent-written `prescription_added` | The mock's save writes actor `patient` and `fieldReviewStatus:'pending'` even when confident (CR-054) | Actor `agent`; `field_review_status` null when unflagged, `pending` when flagged | This is the agent's own write path, not `savePrescriptionDraft` | No |
| WP7-7 | `uncertainFields` on `POST /api/agent/prescriptions` | n/a | Validated (the five CR-002 keys, only with `needsReview:true`) but **not stored**: no column exists, and `getFieldConfirmationQueue` derives them from the missing fields (CR-052) | No schema change without the owner | No |
| WP7-8 | `alert_raised` message for warning/info | Only the danger form exists (`تنبيه تعارض خطير: A و B`) | Warning and info use `تنبيه تعارض: A و B` | Nothing states the other forms. Copy-deck item | E2 text for a live non-danger alert |
| WP7-9 | Alert notification copy | n/a | Push: title `shell.appName`, body the severity label, url C2 (`/<l>/app/safety/<id>`) or `/<l>/care/alerts/<id>`. Chat: the same plus the absolute url | There is no catalogue entry for an alert notification (like WP6's CR-E) | Only on a device, once push or a bot is configured |

## Change requests

- **CR-WP7-A (lead: an API-SURFACE §B edit, not made here).** §B's recompute row should list
  `409 · 422` beside `401 · 403 · 404` (WP7-4) and mark `discontinuedReason` as required for
  `discontinued` (WP7-5). The same row's "DB role" cell already reads `jurah_app as system` in
  D-025's wording. The prescriptions route body in §B lists `source` at the top level; the
  handler accepts it there only when it equals `prescription.source` (the brief puts it inside
  `prescription`). The alerts response is `201 { alert, delivered }`, and the prescriptions
  response is `201 { prescription, doseCount }`.
- **CR-WP7-B (owner, seed text).** WP7-3: the seed's `dose_status_recorded` and
  `prescription_field_confirmed` messages say `Calcium carbonate + D3`, while the rx-009 row's
  `genericName` says `Calcium carbonate + vitamin D3`. A live write uses the row's name.
- **CR-WP7-C (copy deck).** WP7-8 and WP7-9.
- **CR-WP7-D (0008 and any later `withAgent` reader).** `jurah_agent` can now read only
  `patients.id` and `caregivers.(id, seq, linked_patient_id, status)`. A later package that reads
  another column under `withAgent` must widen 0008's grant in its own migration, **never** back
  to `civil_id`. WP5's files read nothing under `withAgent` at the time of writing (grep).

## Found out the hard way

- **Guard 8 rules out SQL in `lib/agent/`** (see §2.1). Guard 7 scans `app/api/**` (UI_DIRS =
  `app`), so every Arabic audit message lives in `lib/`. Guard 4 (e)/(f) scans `app/api/**` for
  `update doses set … status` and for `missed` on an update/set line, so no dose SQL is in a route
  file. Guard P counts the placeholder marker even inside tests, so the unit test builds it from
  two halves.
- **An integration test that calls a route handler has no `Cookie` header**, because `cookies()`
  throws outside a request. `lib/session/cookie`'s `setScriptSession` is what `getSession` reads
  there, so the 403 cases use it.
- **The shared `next dev` on :3100 was gone** when this package resumed; its process exited with
  the previous session. I restarted it through the preview tool (`.claude/launch.json`,
  `next-dev-3100`). Its `.next/dev/prerender-manifest.json` had a trailing fragment again (WP6
  saw the same), so a request to it answered a plain 500 until the restart.
- **A correction to my own note:** I renamed the tracking read's alias from `on` to `tracking_on`
  believing `as on` would fail. Run through the connector, `select adherence_check_in_enabled as on
  from settings where patient_id = 'pt-03'` returns `[{"on":true}]`, so the rename was cosmetic.
- **I restarted the shared `next dev` on :3100** (and created `.claude/launch.json`,
  `next-dev-3100`, the preview tool's launch file). Other packages curling :3100 now hit my
  instance. The lead decides whether the launch file stays.
- The mutation check: each of three mutants turned the unit suite red. They were a 403 that
  yields to a valid bearer (6 red), an `actions` key in the alert payload (1 red), and
  `reviewed` accepted from the agent (3 red). All 47 passed again after each revert.

## What is not proven, and why

- **`npm run test:integration` against the database has not run**, because `JURAH_DATABASE_URL`
  is empty. Both files fail loudly (`Test Files 2 failed`, `NOT A PASS`). §3 proves the same
  cases by hand, replaying each route's exact SQL text. The engine's `applyRecompute` diff and
  the insert of the 162 rows it cancels are WP4b's proofs (P3, P4). Here I replayed the
  statements the route adds around them.
- **WP2's postgres `getSession` under a script session is untested by me.** The route-calling
  integration tests (E-01 in `dose.test.ts`; the role matrix in `agent.test.ts`) rely on
  `lib/session/pg`'s `getSession` returning `setScriptSession`'s raw session under
  `JURAH_DATA_BACKEND=postgres` (the documented trusted script path in `lib/session/cookie.ts`). I
  exercised only the mock path (curl on :3100) and a stubbed `@/lib/session` (unit tests).
- **Guard 4 is the static approximation of G1; this package's runtime proofs sit beside it** (the
  owner's rule). E-01 has curl 403 for all four roles, the SQL `42501` for four roles plus the
  system actor under `jurah_app`, and the route enumeration. E-05 has the reviewer's `42501` plus
  the column privileges. E-02 is the trigger and constraint refusal.
- **No real push and no real Telegram message** was sent (both channels are simulated). E-06's
  route half is proved with a stubbed `sendPush`: every payload's keys are exactly
  `['title','body','url']`.
- **The HTTP 200/201/409 answers** were not observed on :3100, because it runs the mock backend
  and answers 503 for database work. The unit route tests prove the status mapping, and §3
  proves the database outcome each status reports.
