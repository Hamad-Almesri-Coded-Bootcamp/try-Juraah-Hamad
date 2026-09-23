# P2-WP7 — The agent integration point · task brief

Read `docs/briefs/P2-common.md` first. One subagent (Opus). Depends on Gate 1 and on WP4's pure engine (`lib/schedule/recompute.ts`, `discontinue.ts`). This package builds **the one documented way the AI-agents track writes results** — and nothing of the agents themselves. G1 is yours to prove in the database.

## ROUTES YOU IMPLEMENT (`app/api/agent/**`)

Per `docs/API-SURFACE.md` §B, exactly these, with the listed statuses:
- `POST /api/agent/doses/[doseId]/status` — body `{ status, recordedAt, source }`; `source` must be `'adherence_agent'`; `taken_late` requires `recordedAt`; `withAgent` → `update doses set status, recorded_at, source` — the `doses_status_write` trigger and `dose_untracked_has_no_status` do the refusing; the `AFTER UPDATE` trigger appends `dose_status_recorded` (verify it named actor `agent` and the mock's message form `تسجيل حالة جرعة — <word>: <drug>` — if the trigger cannot compose the drug name, compose the message in the handler via `append()` and make the trigger only *enforce* that a row exists; document which).
- `POST /api/agent/schedule/recompute` — `{ prescriptionId, reason: 'reported_miss' | 'discontinued', missedDoseId?, discontinuedAt?, discontinuedReason? }`; bearer-checked, then **`withSystem` only** (D-025 — `jurah_agent` has no `DELETE` on `doses`): `recomputeAfterReportedMiss` or `discontinuePrescription` from `lib/schedule`, then delete/insert only `upcoming` doses (a recorded dose is never deleted — the DELETE policy already forbids it), `append('schedule_recomputed', actor system)` / `append('prescription_discontinued', actor agent, message `أُوقفت وصفة <genericName>` — D-032)`. Use `lib/engine`'s `applyRecompute` / `applyDiscontinuation` (WP4b) — never a second engine.
- `POST /api/agent/alerts` — an `InteractionAlert` minus `id`; `reviewStatus` must be `pending_medical_review` or `auto_cleared` (422 otherwise, and 422 for any reviewer field); `sourceCitation` required (empty and `[TO BE SUPPLIED]` allowed); insert with `newId('ia')`; `append('alert_raised', actor agent)`; then recipients via the same query as `alert-recipients` and `lib/push/send.ts` / `lib/messaging/telegram.ts` (WP6) — **payload carries no action**; when `PUSH_IS_SIMULATED`/`BOT_IS_SIMULATED`, nothing is sent and the response says `delivered: []`.
- `POST /api/agent/prescriptions` — the extraction write path: `{ patientId, prescription, needsReview, uncertainFields? }` where `prescription.source` is **required** (CR-042: this is where the real source arrives); insert (`newId('rx')`), generate doses via `lib/schedule/generate.ts` when unflagged, `append('prescription_added', actor agent)`; constraint violations → 422 naming the constraint.
- `GET /api/agent/check-in-eligibility` — patients where `settings.adherence_check_in_enabled` and the most recent `messaging_links` row is `connected`; returns `[{ patientId, chatId, language, frequency }]`.
- `GET /api/agent/alert-recipients?patientId=` — the patient's own channels if connected, plus **`active` caregivers only** with their `chatId`/push presence; 404 for an unknown patient.

Auth: `Authorization: Bearer <JURAH_AGENT_TOKEN>` (from `lib/config.ts`'s server-only `AGENT_TOKEN`, WP6 adds it — if it is not there yet, add it with the same pattern and say so); constant-time compare; **a request carrying a session cookie but no bearer is 403**, never 200; missing/wrong bearer 401. Handlers live in `lib/agent/*.ts` with thin `route.ts` files.

## MIGRATION YOU MAY ADD

`supabase/migrations/0008_agent_grants.sql` (D-026): tighten `jurah_agent` to the columns its six routes need — no `SELECT` on `patients.civil_id`, `caregivers.civil_id`, `accounts`; apply through both paths and record it in `supabase/README.md`. Never edit `0001`–`0007`.

## TESTS

`tests/integration/enforcement/dose.test.ts` (WP4b started it with E-03 at the library level) — append **E-01, E-02, E-04, E-05**, and extend **E-03** to call the real `POST /api/jobs/expire-invitations` route (WP6's) so the row is not a "call never made"; `tests/integration/enforcement/agent.test.ts` — every route × every user role → 401/403 pasted; a `tracked:false` dose → 409; `reviewStatus:'reviewed'` → 422; a caregiver `pending` never in `alert-recipients`; `check-in-eligibility` returns exactly سارة for the seed. `tests/unit/agent/*.test.ts` for body validation. The demo's proof moment as a test: `select actor_role, count(*) from audit_events where type='dose_status_recorded' group by 1` → only `agent`/`system`, before and after writing a status through the route. `docs/backend-notes/p2-wp7.md` + a section in `docs/API-SURFACE.md` §B only if a status code or body shape had to change (report, do not silently edit — the lead merges).

## ACCEPTANCE — Gate 7

Paste: the enforcement rows by id · the audit-log proof query · `curl` transcripts for one success and one refusal per route · `npm run guards` (guard 4 must still find no `missed` write path outside the trigger definition) · `npm run verify` exit 0 in mock · frozen-set diff empty. If `JURAH_DATABASE_URL` is absent: the loud NOT-A-PASS output plus MCP hand proofs of the trigger refusals (`set role jurah_app; update doses set status…` → permission denied; `set role jurah_agent; update doses set status='taken_on_time' where id='rx-002-20260921-0800'` → `dose_untracked_has_no_status`).
