# P2-WP4 — The deterministic engine (pure half) · task brief

Issued by the Phase 2 lead after the owner approved Phase 0 (2026-09-22). One subagent (Opus). Runs **in parallel with P2-WP0-WP1**; your files are disjoint from that package's. The database writer half of WP4 comes in a second brief once the schema exists (Gate 1).

## OBJECTIVE

Add to `lib/schedule/` the three deterministic operations Phase 1 did not need and Phase 2 must have — **recomputation after a REPORTED miss**, **discontinuation**, and **read-time invitation expiry** — as pure functions with no clock read, no model call, no I/O, unit-tested to 100 % against the hand-computed tables in `docs/Seed Dataset.md` at the frozen `REFERENCE_NOW`. And write the spec-level tests that pin the existing generator's boundaries the master prompt names by name.

## READ — all of it first

1. `CLAUDE.md` rules 1, 3, 4, 9.
2. `docs/Acceptance Criteria and Test Plan.md` → PHASE 2 → "Schedule & depletion logic" and "Dose status write path" (search those headings).
3. `docs/Seed Dataset.md` → "The frozen clock", "Doses" (all three tables), "Prescriptions".
4. `docs/BACKEND-PLAN.md` §3 WP4 row and Gate 4; §1 D-021.
5. `docs/AI Agents Acceptance Criteria.md` lines 107–130 only (what "reported miss" and "recompute" mean to the other track: the agent decides *when*; you compute *what*; "dose-time arithmetic is traceable to a deterministic code path").
6. `lib/schedule/generate.ts`, `depletion.ts`, `dates.ts`, `group.ts`, `index.ts` and `tests/unit/schedule/*.test.ts` — **you build beside them and do not edit them**; the generator is already proven against the seed.
7. `lib/data/mock/seed.ts` → `buildDoses` (سارة's overlay) and `lib/data/mock/caregivers.ts` → `pendingInvitationsFor` / `acceptInvitation` (the read-time expiry rule as the mock states it).
8. `types/contracts.ts` → `Dose`, `Prescription`, `Caregiver` (frozen; read only).

## FILES YOU OWN

- `lib/schedule/recompute.ts` (new) — `recomputeAfterReportedMiss(prescription, existingDoses, missedDoseId): { doses: Dose[]; changed: boolean }`. Semantics (write them at the top of the file): a **reported** miss changes nothing about *when* the remaining doses fall — the schedule is a function of the prescription's own fields alone, so "recompute" = regenerate the remaining `upcoming` doses from `generateDoses(prescription, tracked)` and keep every dose that already carries a recorded status (`taken_on_time`, `taken_late`, `missed`) exactly as it is. The missed dose itself is **not** touched here (its status was written by the agent path; you never write a status — rule 1). Result: for the seed, recompute after `rx-008-20260919-0700` yields the identical set of `scheduledAt` values, `changed: false`, and for `rx-005` (alternate-day) the 20/22/24 cadence survives — that is the test the master prompt names.
- `lib/schedule/discontinue.ts` (new) — `discontinuePrescription(prescription, existingDoses, discontinuedAt, reason): { prescription: Prescription; doses: Dose[]; cancelledDoseIds: string[] }` — sets `status:'discontinued'`, `discontinuedAt`, `discontinuedReason`; removes every `upcoming` dose whose date is **after** `discontinuedAt` (inclusive semantics exactly as the generator's own comment: rx-004 stops generating "after 2026-06-28", not before it); never removes or changes a recorded dose. Pure.
- `lib/schedule/expiry.ts` (new) — `foldInvitationExpiry(caregiver, nowIso): Caregiver['status']` (a `pending` row with `expiresAt <= nowIso` reads as `expired`; every other status unchanged) and `invitationsToExpire(caregivers, nowIso): Caregiver[]` (the job's selection). `nowIso` is a parameter, never read from a clock.
- `lib/schedule/index.ts` — **append** the new exports (do not reorder or remove existing ones).
- `tests/unit/schedule/recompute.test.ts`, `discontinue.test.ts`, `expiry.test.ts`, and `tests/unit/schedule/boundaries.test.ts` (new) — the master prompt's named cases against the seed's own records built from `lib/data/mock/seed.ts`'s `buildPrescriptions()`/`buildSettings()`/`buildDoses()`: حمد 2026-09-21 → exactly six rows at 08:00×2, 14:00, 18:00, 20:00×2, all `tracked:false`, all `upcoming`; 2026-09-26 → three rows (Metformin ×2, Warfarin), no Ibuprofen (duration ends 2026-09-25); فاطمة `rx-005` → doses on 14, 16, 18, 20, 22, 24 September and **none on the 21st**; `rx-006` and `rx-007` → zero doses; `rx-004` → nothing after 2026-06-28; سارة's seven rows on 19–21 September with the seed's exact statuses and `recordedAt`s; **rule 4**: passing a `nowIso` three days later through any function in this package leaves every `upcoming` dose `upcoming` (there is no code path to make it `missed` — the test asserts the module exports no function whose name or body contains `missed` as an assignment).
- `docs/backend-notes/p2-wp4.md` (new) — your fragment: the exact semantics you chose for "recompute" and "discontinue" and why, and anything the spec left ambiguous.

## FILES YOU MUST NOT TOUCH

Everything else. In particular `lib/schedule/generate.ts`, `depletion.ts`, `dates.ts`, `group.ts` (proven; if you believe one is wrong, report it), `lib/data/**`, `lib/session/**`, `lib/db/**`, `supabase/**`, `scripts/**`, the frozen set (`app/[locale]/**`, `components/**`, `features/**`, `i18n/**`, `types/**`, `styles/**`, `public/**`), `docs/**` except your fragment.

## INVARIANTS

Rule 1 / G1: **nothing in this package assigns a dose status.** Not `missed`, not anything. You copy existing statuses through and construct new doses only via `generateDoses` (which sets `upcoming`). Guard 4 (`scripts/guards/no-dose-write.ts`) allows `lib/schedule/` to construct doses — do not abuse that allowance: no `status:` literal other than through the generator.
Rule 4: silence is not evidence — no function here compares `scheduledAt` to "now" to decide anything about a dose.
Rule 9 / G3: no `Date.now()`, no bare `new Date()`; `nowIso` is always a parameter.
Rule 3: `tracked` is carried through from the existing dose or from the generation-time argument, never inferred from the status word.

## ACCEPTANCE — Gate 4 (pure half)

Paste: `npx vitest run tests/unit/schedule` (every new test green, every existing one still green); `npm run guards` (guard 4 and 6 green); `npm run typecheck`; `git diff --stat 8cd7794 -- 'app/[locale]' components features i18n types styles public` empty. Never self-certify.

## REPORT BACK

Objective · files · outputs · the semantics decisions · anything ambiguous in the spec about recompute/discontinue that the owner should confirm (goes to the fragment, not silently decided).
