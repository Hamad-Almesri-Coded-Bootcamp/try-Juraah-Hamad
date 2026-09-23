# P2 — common section for every Phase 2 brief after Gate 1

Every `P2-WP*.md` brief from WP2 onward includes this file by reference. Read it in full before your own brief.

## READ — always, in this order

1. `CLAUDE.md` (root) — the nine rules.
2. `docs/BACKEND-PLAN.md` — §0 (the frozen set and its proof command), §1 (D-015 → D-022, all approved by the owner), §3 (your WP row and its gate), §6 (round trip, refusal proof, store reset, **key order**).
3. `docs/API-SURFACE.md` — the rows for the functions you implement: the query, the roles, the tables, the audit event. **The signature and return shape are fixed; the "Serves it" column is your specification.**
4. `docs/SCHEMA.md` — the tables, constraints, triggers, roles and policies WP1 built (read the real SQL under `supabase/migrations/` too; where SQL and document differ, `docs/backend-notes/p2-wp1.md` says why).
5. `docs/ENFORCEMENT.md` — every row whose tag your brief names is yours to make true **and** to prove with a test titled by its id in `tests/integration/enforcement/<tag>.test.ts`.
6. `docs/BACKEND-DIVERGENCES.md` — the rows that touch your functions. **Do not edit that file** (several packages run at once): put every new divergence in a `## Divergences` section of your own `docs/backend-notes/p2-wp<N>.md` fragment, in the same table columns; the lead merges them at your gate.
7. `docs/BACKEND-NOTES.md` §1 (your functions' callers), §2 (the cheats you replace), §3 (the absences you turn into refusals), §4 (which fields a screen depends on), §5 (**the exact bytes your function must return** — also in `tests/fixtures/shapes.json`).
8. `docs/DECISIONS.md` — D-014, D-016 → D-022, CR-041 → CR-050, CR-040.
9. The plumbing WP1 built and the lead split by package at Gate 1: `lib/db/withSession.ts` (`withSession`, `withAgent`, `withSystem` — **the only way to run SQL**), `lib/db/audit.ts` (`append` — **the only way to write an audit row**), `lib/db/ids.ts`; `lib/data/pg/<your-package>.ts`, `lib/data/refusals/<your-package>.ts`, `lib/data/shapes/<your-package>.ts` — **you edit only the three files named for your package**; `lib/data/pg/index.ts`, `lib/data/refusals.ts` and `lib/data/shapes.ts` are barrels the lead owns and you never touch; `lib/data/shapes/_core.ts` has `compact`, `str`, `num`, `DbRow`; `docs/backend-notes/p2-wp1.md` §3 lists WP1's 28 deviations from `SCHEMA.md` (read them — several change what you must do, e.g. one-shot refusals surface as 0 rows, not a raise); `tests/integration/setup.ts` and `helpers.ts` (`probe`, `rejects`, `accepts`, `S`, `app(...)`).
10. The mock body of every function you implement, in `lib/data/mock-impl.ts` / `lib/session/mock-impl.ts` — **the reference behaviour**, except where `ENFORCEMENT.md` says "mock does not refuse today", in which case the spec wins.

## RULES THAT APPLY TO EVERY PACKAGE

- **The frontend does not change.** Frozen: `app/[locale]/**`, `components/**`, `features/**`, `i18n/**`, `types/**`, `styles/**`, `public/**`. Before you report, run `git diff --stat 8cd7794 -- 'app/[locale]' components features i18n types styles public` and paste it; it must print nothing. If you believe a screen or a shape must change, **stop that item, write the change request in your fragment, and continue with the shape as it is.**
- **Refusal = the mock's shape, from `lib/data/refusals/<your-package>.ts`** (D-022). Add the refusal literal for each of your functions there, replace the inline literal in `mock-impl.ts` with the import (behaviour identical — `mock-impl.ts` is shared, so edit **only the lines of your own functions**), and use it in your `pg/` file. A refusal that throws reaches `error.tsx` and is a bug.
- **Projection = a literal in `lib/data/shapes/<your-package>.ts` in the mock's key order.** Compare against `tests/fixtures/shapes.json` as a **string**, never deep-equal.
- **Every SQL statement runs inside `withSession()`/`withAgent()`/`withSystem()`**; guard 8 fails the build otherwise. Never `SET ROLE` yourself; never read `process.env` outside `lib/config.ts` and `lib/db/client.ts`.
- **Every audit row goes through `append()`** with the `type`, `actor`, `message` and `relatedId` the mock writes (BACKEND-NOTES §5 shows them). Messages are plain Arabic, names masked, **never a Civil ID**.
- **`REFERENCE_NOW` is the clock** (D-021): it reaches SQL as `jurah_now()`; in TS, every function that needs "now" takes `nowIso` and the seam passes `REFERENCE_NOW`. No `Date.now()`, no bare `new Date()`.
- **No Civil ID crosses the seam or lands in a log.** Projections never select `civil_id`; a test scans every shape you return for `\d{12}`.
- **Ids:** seed rows keep their text ids; rows you create get `newId('<prefix>')` (CR-041).
- **Integration tests fail loudly without `JURAH_DATABASE_URL`** — never skip-as-pass. If the URL is still absent when you run, paste that failing output and additionally prove each refusal row by hand through the Supabase MCP `execute_sql` (project `frvubflbpujwuhsxweue`), pasting the SQL and its result. Re-seed (`npm run db:seed` or the MCP path in `supabase/README.md`) before any run that mutates.
- **Never self-certify.** Every acceptance item is a pasted command and output.
- Do not commit. Do not touch a file another package owns (each brief lists ownership); if you need a change there, request it in your report.

## THE INVARIANTS — into your code, every time

G1 — The only writers of `Dose.status` are the deterministic schedule logic and the authenticated agent write path. No function reachable by a patient, caregiver, reviewer or admin session sets a dose status; no job, cron, migration or cleanup transitions a dose to `missed` for going unanswered; a dose with `tracked:false` is never given a status; every dose-status write appends an audit event naming its actor.
G9 — The masked-name lookup returns a masked name only for a Civil ID with an account and is indistinguishable otherwise (status, shape, latency class); it is rate-limited per session and audited; three asterisks per middle name whatever the real length; no Civil ID is ever returned or written into an audit body. Creating an invitation grants nothing; the only transition to `active` is the invited person's own authenticated acceptance; signing in does not accept; expiry is enforced at read time as well as by a job; a `pending`, `declined`, `expired` or `revoked` caregiver reads nothing.
G10 — The chat is optional. No function requires a messaging link to serve any other feature. `adherenceCheckInEnabled:true` is refused without a `connected` link, quietly.
G12 — Notifications alert, never collect: no payload carries an action; safety-critical content is never only in a payload; a denied or revoked subscription blocks no feature; nothing is ever sent to a caregiver whose invitation is not `active`.
G11 — The landing page needs no backend and must not gain one.
Plus — no endpoint, field or code path disables the dashboard, interaction screening or the schedule engine · `routedTo` always matches the originating prescription's sector · a reviewer writes only the five review fields and the field-confirmation fields, and reads only patients with an item in one of their queues · an admin reads audit metadata and nothing else and may not create, accept or revoke an invitation · `AuditEvent` is append-only and never authored by a client · no secret in the repository or the client bundle · the six AI agents are NOT built.

## REPORT BACK — the shape of your final message

Objective · files created/changed · **every acceptance command with its pasted output** · the `ENFORCEMENT.md` rows you proved, by id, with the pasted result · every divergence you appended to `BACKEND-DIVERGENCES.md` · every change request you raised · what you found out the hard way (also in your `docs/backend-notes/p2-wp<N>.md` fragment) · what you could not prove and why.
