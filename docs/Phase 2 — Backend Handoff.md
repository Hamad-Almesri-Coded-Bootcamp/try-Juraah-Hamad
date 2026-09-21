# Jur'ah (جرعة) — Phase 2 Backend Handoff

**Read this only when Phase 1 is finished.** Nothing here is built during Phase 1. Its purpose is the opposite: to state, before the frontend is written, **what the frontend must leave behind** so that the backend can be built later in one pass, by a fresh session that has never seen this conversation.

**Owner:** the project owner (Hamad). **Binding specification for Phase 2:** the *PHASE 2 — BACKEND* section of `Acceptance Criteria and Test Plan.md`. This file does not replace it; it is the bridge — the mental model, the seam, the notes contract, and the single prompt that starts the work.

---

## 1. The model, stated precisely

The intuition is right, and it is worth making exact because one word in it changes what gets built.

**The frontend is not the plug. The frontend defines the socket, and the mock data layer is a temporary plug sitting in it.** Phase 2 pulls that temporary plug out and pushes a real one in — same socket, same shape, same number of pins.

```
        Phase 1                                Phase 2
   ┌──────────────────┐                  ┌──────────────────┐
   │  screens (30)    │                  │  screens (30)    │   ← untouched
   ├──────────────────┤                  ├──────────────────┤
   │ THE SEAM:        │  the socket —    │ THE SEAM:        │   ← untouched
   │ one typed async  │  its shape is    │ one typed async  │
   │ data-access layer│  fixed in Phase 1│ data-access layer│
   ├──────────────────┤                  ├──────────────────┤
   │ mock implementa- │   swapped        │ real API calls → │
   │ tion (in memory, │  ───────────►    │ backend → DB     │
   │ from the seed)   │                  │                  │
   └──────────────────┘                  └──────────────────┘
```

Three consequences, and they are the whole reason this file exists:

- **A screen must never know which side of the seam it is on.** No component imports mock data, no component holds a fetch, no component branches on "are we in Phase 1". If a screen would behave differently against a real backend, the seam is in the wrong place.
- **The socket's shape is decided in Phase 1 and is expensive to change afterwards.** That is why the Data Contracts are transcribed field by field into `types/contracts.ts` at the very start (WP1), before a single screen — and why "do not redesign the contracts" is a standing rule for both phases.
- **Swapping the plug is not the whole job.** The mock layer enforces nothing: it hands back whatever the seed says. The backend has to *enforce* — roles, the consent gate, the dose-status write path, rate limits. Those rules exist in the interface as *absences* (there is no dose-logging control to click) and in the backend as *refusals* (the endpoint rejects the call). **Phase 1 proves the absence; Phase 2 proves the refusal.** Both are required; neither substitutes for the other.

One more correction worth having in mind: the socket carries **functions, not HTTP**. The seam is `getDosesForDay(patientId, date)`, not `GET /api/doses`. Phase 1 fixes the function signatures and their return shapes; Phase 2 is free to choose the transport behind them (REST, RPC, direct Supabase client) as long as the signatures and shapes do not move.

---

## 2. What Phase 1 leaves behind

Seven artefacts. Six of them are already required by `Master Prompt — Phase 1.md`; the seventh is the one this file adds.

| # | Artefact | Why Phase 2 needs it |
|---|---|---|
| 1 | `types/contracts.ts` | The contracts as code. Phase 2's tables are generated from it, and a write-then-read round trip is compared against it. |
| 2 | The typed data-access layer | The socket. Its function list *is* the backend's API surface. |
| 3 | The config module | One file holding the API base URL, the auth token, the bot handle, the push public key and `REFERENCE_NOW`. Phase 2 changes values here, not code. |
| 4 | The session module | Where a real session replaces the simulated one. It already models subject id, role, linked patient id and the pending-invitation case. |
| 5 | The mock implementation | The reference behaviour. When the real backend returns something different, the mock is the arbiter of what the screens expected. |
| 6 | `/docs/DECISIONS.md` | Everything the Phase 1 agent thought was wrong or ambiguous, and how it was answered. Phase 2 inherits those answers instead of re-litigating them. |
| 7 | **`/docs/BACKEND-NOTES.md`** | **New. The written handover. Section 3 specifies it exactly.** |

### Why the notes file, when the code is right there

Because the backend session will read the code and still not know four things, and every one of them is a bug waiting to happen:

- **Where the mock cheated.** A mock can return a computed ICS URL that no server generates, a masked name computed client-side from the seed, an `expiresAt` that never actually expires. Each of those is a shortcut that must become real — and none of them looks like a shortcut in the code.
- **Which rules are enforced nowhere yet.** Phase 1 has no server, so "a pending caregiver reads nothing" is currently true only because the mock chooses not to return it. That is not enforcement; it is politeness. The notes name every such rule explicitly so Phase 2 turns each one into a refusal it can demonstrate.
- **What each function is really for.** `getPatientContext(alertId)` is one function to a reader and a three-table join with a role check to an implementer.
- **What the screens do with the answer.** A field that looks optional in the contract may be the only thing a screen renders. Phase 2 must know which fields have a screen depending on them.

---

## 3. `/docs/BACKEND-NOTES.md` — the contract for the notes

**Written by the Phase 1 lead, appended to continuously — not at the end.** A note is added the moment a shortcut is taken or a rule is deferred, because by the last day nobody remembers. `WPfinal` reviews it for completeness; it is a Phase 1 deliverable and Phase 1 is not done without it.

It has exactly seven sections:

**1. The data-access surface.** Every function in the data layer, in one table: name · arguments and their types · return type · which screens call it · one line on what it is for. This is the API surface, so it is the first thing Phase 2 reads.

**2. Where the mock cheated.** Every place the mock does something a real backend must do properly. One row each: what the mock does now · what the backend must do instead · what breaks if it is missed. The known candidates: the ICS feed URL and its token, the masked-name computation, invitation expiry (a clock, not a read), the link token's single use, push subscription and permission state, `REFERENCE_NOW` itself, and anything derived in the browser that should be derived on the server.

**3. Rules that are currently absences, and must become refusals.** Every invariant that Phase 1 satisfies by *not offering* something. For each: the invariant · how Phase 1 satisfies it · what the backend must reject · and the exact call that proves the rejection. At minimum: writing `Dose.status` from any user session · accepting an invitation on someone else's behalf · reading patient data with a pending/declined/expired/revoked caregiver session · a caregiver writing anything of the patient's · a reviewer editing a clinical field outside the audited flow · an admin reading a clinical body · a client-supplied role, `chatId` or audit event · a client-supplied `Settings` key that isn't on the permitted list.

**4. Fields a screen depends on.** Which contract fields have a screen that renders nothing sensible without them, and which are genuinely optional. Phase 2 uses this to decide what is `NOT NULL`.

**5. The shapes, verbatim.** For each data function, one real example of what the mock returned — copied from the running app, not retyped. This is the fixture the round-trip test compares against, and the reason a write-then-read comparison is possible at all.

**6. Deferred to Phase 2 by design.** Everything Phase 1 deliberately did not do: real push subscription and VAPID keys, the real bot, real ICS generation, real Civil ID integration, real authentication for the caregiver/reviewer/admin roles, the rate limit on the masked-name lookup. With, for each, the file and line where the placeholder sits.

**7. Things Phase 1 found out the hard way.** A short, honest list: what turned out awkward, what the agent asked about, what a screen needed that the contract did not have. This is the section that saves Phase 2 a week, and the one most likely to be skipped — so it is explicitly required.

---

## 4. Decided before Phase 2 starts

Four decisions belong to the owner, not to the implementing agent. Two are already made; two are open.

**Decided — the seam stays put.** The data-layer function signatures and return shapes do not change in Phase 2. If the backend needs a different shape, that is a change request against this file and the spec, not a quiet edit.

**Decided — enforcement is server-side, always.** Every rule in section 3 is enforced on the server even though the interface already prevents it. The interface is not a security boundary; it never was. This is also what makes the clinic route's obscurity honest: it is filing, and the role check is the protection.

**Open — the database.** `Acceptance Criteria and Test Plan.md` names Supabase or Postgres. Supabase brings auth, row-level security and a generated client, which fits the role model well; plain Postgres brings fewer moving parts and no vendor shape. **Decide before the Phase 2 prompt is pasted**, because row-level security versus application-level checks changes how section 3's refusals are written.

**Open — where it runs.** Next.js route handlers in the same deployment is the shortest path and keeps the seam trivial. A separate service is more honest architecturally and more work. Either satisfies the spec.

---

## 5. The Phase 2 master prompt

One prompt, pasted into a fresh session that has the repository and these documents. The lead plans from a full read of the frontend and delegates implementation, exactly as Phase 1 ran.

```
ROLE — YOU ARE THE LEAD, NOT THE IMPLEMENTER

You are planning and running Phase 2 — the backend — of Jur'ah (جرعة), a medication-safety
platform for patients in Kuwait. Phase 1 is complete: a full frontend of thirty screens and three
system pages, running against a mock data layer behind one typed interface. Your job is to put a
real backend behind that interface WITHOUT CHANGING IT.

You think, plan, decompose, delegate, review and integrate. You do not write feature code
yourself. Implementation goes to Sonnet subagents you launch with the Agent tool (model: sonnet),
from task briefs you write. You own the plan, the task graph, the review gates, the integration
and the final verification report. Independent tasks launch in parallel, in one message.

READ FIRST — in this order, and read the CODE, not only the documents
1. docs/Acceptance Criteria and Test Plan.md — the PHASE 2 section is the binding specification.
   Every "Non-negotiable invariant" is a hard requirement. It also owns the Data Contracts, the
   role model and the route structure.
2. docs/Phase 2 — Backend Handoff.md — the seam, and what Phase 1 handed over.
3. docs/BACKEND-NOTES.md — written by the Phase 1 lead. Sections 2 and 3 are your real worklist:
   where the mock cheated, and which rules are currently absences that you must turn into
   refusals you can demonstrate.
4. docs/DECISIONS.md — everything Phase 1 raised and how it was answered. Do not re-open a
   settled question; add to the file if you find a new one.
5. docs/Seed Dataset.md — the canonical cast. Your seed script produces exactly these records, so
   a write-then-read round trip can be compared against what Phase 1 returned.
6. docs/Project Brief.md — the safety principles and why they are shaped this way.
7. THE FRONTEND ITSELF — a full scan, before you plan anything:
   · types/contracts.ts, field by field
   · every function in the data-access layer, with its callers
   · the session module and the config module
   · the mock implementation, which is the reference behaviour
   · every screen that reads a field you are about to make NOT NULL
   Produce the inventory in Phase 0 below. Do not plan from the documents alone: the code is what
   actually has to keep working.

THE RULE THAT GOVERNS EVERYTHING YOU DO
The frontend does not change. Not a component, not a screen, not a data-layer signature, not a
return shape. You replace what is BEHIND the data layer. If you believe the interface must change,
that is a CHANGE REQUEST to me — log it, keep going with the interface as it is, and wait.
The one exception: the config module's values (API base URL, auth token, bot handle, push public
key) are meant to change. Changing values there is expected; changing its shape is not.

═══════════════════════════════════════════════════════════════════════
PHASE 0 — SCAN AND PLAN (you, alone, no subagents yet)
═══════════════════════════════════════════════════════════════════════

Produce, and show me, before any implementation:

1. /docs/BACKEND-PLAN.md — work packages, dependencies, what runs in parallel, which subagent
   gets each, and the review gate each ends at.
2. /docs/API-SURFACE.md — every data-layer function from the code, with the endpoint or query that
   will serve it, the role(s) allowed to call it, the tables it touches, and the audit event it
   writes if any. This table is the contract between the two phases: nothing on it may change
   shape, and nothing may be added that no screen calls.
3. /docs/SCHEMA.md — one table per contract entity, every column with its type and nullability,
   every foreign key, every constraint. Name explicitly: doseTimes.length === frequencyPerDay as a
   write-time constraint, AuditEvent append-only at the database level, and which columns are
   NOT NULL because a screen depends on them (BACKEND-NOTES section 4).
4. /docs/ENFORCEMENT.md — the refusal matrix. One row per rule in BACKEND-NOTES section 3: the
   invariant · where it is enforced · the exact call that must be rejected · the test that proves
   the rejection. A rule with no test on this table is not enforced, whatever the code says.
5. A CHANGE REQUEST LIST — anything in the contracts, the notes or the spec that cannot be built
   as written.
6. A RISK LIST — the three most likely failures and how the plan mitigates each.

Then stop and wait for my approval.

═══════════════════════════════════════════════════════════════════════
WORK PACKAGES — the default decomposition
═══════════════════════════════════════════════════════════════════════

WP0  Scaffold (you): the database project, migrations tooling, the seed script generated from
     Seed Dataset.md, environment handling with no secret in the repository, and the test
     harness. → GATE 0: migrations run, the seed loads, tests execute.
WP1  Schema and seed (one subagent, blocks everything): every table, key and constraint from
     SCHEMA.md; the seed producing exactly Seed Dataset.md, re-runnable and identical.
     → GATE 1: the seed diffs clean against Seed Dataset.md record by record.
WP2  Auth and role resolution (one subagent): Civil ID validation against the test list; roles
     resolved server-side, counting a caregiver ONLY when status is active; a session carrying
     subject id, role and linked patient id; the pending-invitation session that can reach the
     consent data and nothing else. → GATE 2: the refusal matrix rows for role resolution pass.
WP3  Read paths (parallel subagents by domain: prescriptions and doses · alerts and review ·
     refills and calendar · activity and audit), each with its role scoping.
WP4  The deterministic engine (one subagent, no model call anywhere in it): schedule generation,
     recomputation on a REPORTED miss, discontinuation, depletion. Unit-tested against the
     hand-computed tables in Seed Dataset.md and its frozen REFERENCE_NOW — including the
     alternate-day cadence that lands on 20 and 22 September but not the 21st, and the
     prescription whose duration ends 25 September. → GATE 4: 100% on those cases.
WP5  Write paths and enforcement (one subagent, the most dangerous package): settings, refills,
     prescription intake, the caregiver invitation lifecycle, field confirmation, review
     decisions. Every row of ENFORCEMENT.md tested. → GATE 5: I review this one line by line.
WP6  Channels (one subagent): the messaging link path with a single-use expiring token; real web
     push with VAPID; the ICS feed. No secret reaches the client or the repository.
WP7  The agent integration point (one subagent): the authenticated agent write path, check-in
     eligibility, alert recipients (active caregivers only), and the audit events the backend
     writes on the agents' behalf with actor.role "agent".
WPfinal Verification and handoff (you): everything under VERIFICATION, then the spec's Phase 2
     criteria item by item, pass/fail with evidence. Never self-certify.

═══════════════════════════════════════════════════════════════════════
NON-NEGOTIABLE INVARIANTS — into every task brief, every time
═══════════════════════════════════════════════════════════════════════

G1   The only writers of Dose.status are the deterministic schedule logic and the authenticated
     agent write path. NO endpoint reachable by a patient, caregiver, reviewer or admin session
     may set a dose status — prove it by attempting the call and showing the refusal. And no
     scheduled job, cron, migration or cleanup task may transition a dose to `missed` for going
     unanswered. Do not write a "mark overdue as missed" job. A dose with tracked:false is never
     given a status. Every dose-status write appends an audit event naming its actor.
G9   Identity. The masked-name lookup returns a masked name ONLY for a Civil ID with an account,
     and its response is INDISTINGUISHABLE otherwise — same status code, same shape, same latency
     class; compare them byte for byte apart from the name. It is rate-limited per session and
     every call is audited: it is an identity oracle otherwise. Three asterisks per middle name
     whatever the real length, unit-tested directly. No Civil ID is ever returned to a client or
     written into an audit body.
     The invitation gate: creating an invitation grants NOTHING; the ONLY transition to active is
     the invited person's own authenticated acceptance; no endpoint, job, migration or admin
     action activates one on their behalf, and signing in does not accept. Expiry is enforced at
     read time as well as by a job. A pending, declined, expired or revoked caregiver reads
     nothing — prove it against every patient-scoped endpoint.
G10  The chat is optional. No endpoint may require a messaging link to serve any other feature.
     adherenceCheckInEnabled:true is rejected without a connected link.
G12  Notifications alert, never collect. No push payload carries an action that writes clinical
     data; safety-critical content is never only in a payload; a denied or revoked subscription
     blocks no feature; nothing is ever sent to a caregiver whose invitation is not active.
G11  The landing page needs no backend and must not gain one.
Plus: no endpoint, field or code path disables the dashboard, interaction screening or the
     schedule engine — verify by direct API call · refill routedTo always matches the originating
     prescription's sector · a reviewer may write only the five review fields and the field-
     confirmation fields, and may read only patients with an item in one of their queues · an
     admin reads audit metadata and nothing else, and may not create, accept or revoke an
     invitation · AuditEvent is append-only and never authored by a client · no secret (bot token,
     VAPID private key) in the repository or the client bundle · the six AI agents are NOT built.

═══════════════════════════════════════════════════════════════════════
VERIFICATION — run these, paste the output, do not self-certify
═══════════════════════════════════════════════════════════════════════

1.  Typecheck, lint and build pass with zero errors, frontend included.
2.  THE ROUND TRIP: for every data-layer function, the real backend's response is compared
    against the shape BACKEND-NOTES section 5 recorded from the mock. Reported as a table,
    function by function. A difference is a failure, not a new shape.
3.  THE REFUSAL MATRIX: every row of ENFORCEMENT.md executed as a test, with the actual HTTP
    status and body pasted. Any row that passes because the call was never made is a failure.
4.  Schedule and depletion unit tests against Seed Dataset.md and the frozen REFERENCE_NOW.
5.  The masking function unit-tested: three asterisks per middle name, with none, one and several.
6.  The masked-name lookup's two responses diffed byte for byte, and its rate limit demonstrated.
7.  A repository-wide search proving no secret and no key is committed or bundled.
8.  A grep proving no code path writes Dose.status outside the two permitted writers, and that no
    "overdue → missed" job exists.
9.  The ICS feed opened in a real calendar client, and a write-back attempt refused.
10. THE FRONTEND WALKED UNCHANGED against the real backend, in all four roles plus the
    pending-invitation case, reported per screen. No screen file may have been modified — show
    `git diff --stat` over the frontend directories and prove it is empty.
11. The audit log filtered to dose-status writes, showing every actor is the agent or the system
    and none is a user role. This is the demo's proof moment; it must be true in the database, not
    only on the screen.
12. The spec's Phase 2 criteria walked item by item with evidence.

ON COMPLETION
List separately: what is complete · what is still a placeholder and why · what I owe you · every
open item in DECISIONS.md · and, most importantly, every place where the real backend behaves
differently from the mock, with the reason.
```

---

## 6. The five things that will bite

Written down now, so they are not discovered later.

**1. The mock was polite; the backend must be rude.** Every "a pending caregiver sees nothing" that currently holds because the mock declines to return data has to become a server-side refusal with a test behind it. This is the single largest block of Phase 2 work and it is invisible in the frontend code — which is exactly why BACKEND-NOTES section 3 exists.

**2. `REFERENCE_NOW` has to stop being a constant without breaking the demo.** Phase 1 renders against a frozen clock so the schedule looks the same on presentation day. A real backend generating doses from the real clock will not reproduce the seed's tables. Decide deliberately: keep the frozen clock as a seeded offset for the demo, or generate relative to the seed date and accept different rows. Either way, decide it before WP4, not during it.

**3. The masked-name endpoint is the one genuine security surface in the product.** It answers "does this Civil ID have an account, and what is the person called". Indistinguishable responses and a per-session rate limit are what keep it from being a directory. Build it once, carefully, with the byte-for-byte test — and never add a "helpful" error message to it afterwards.

**4. Append-only has to be enforced by the database, not by discipline.** A revoke trigger, or table permissions with no UPDATE and no DELETE on `AuditEvent`. An application that merely never updates the table is not append-only, and the audit log is the project's proof of its own core claim.

**5. The first thing that will tempt someone to touch the frontend is a shape mismatch.** A field arrives as a string instead of a number, an array comes back nested one level deeper. The correct move is always to fix the backend's shape, never the screen — and verification #10's empty `git diff --stat` over the frontend is what keeps that honest.

---

## 7. What Phase 2 does not include

The six AI agents, their prompts, their RAG setup and their n8n workflows — that is the other track, `AI Agents Acceptance Criteria.md`. Phase 2 builds the **integration point** they plug into (the authenticated write path, check-in eligibility, alert recipients, the audit events written on their behalf) and nothing more. Also out: WhatsApp, PRN medication, a caregiver linked to more than one patient, prescriber and pharmacist portals, and real Civil ID integration.
