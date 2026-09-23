# P2-WP4b — The deterministic engine, database half · task brief

Read `docs/briefs/P2-common.md` first, then `docs/backend-notes/p2-wp4.md` (the pure half's semantics and open questions; D-023, CR-051, D-27 → D-29 in `docs/DECISIONS.md` / `docs/BACKEND-DIVERGENCES.md`). One subagent (Opus). Depends on Gate 1. Files disjoint from WP3/WP5/WP6/WP7 — you own `lib/engine/**` only, plus the tests and fragment named here.

## OBJECTIVE

Put the pure engine behind the database: generation on prescription creation/confirmation, recompute after a reported miss, discontinuation, depletion, and the invitation-expiry selection — as **library functions the other packages call inside their own transaction** (they pass you the `sql` handle from `withSession`/`withAgent`/`withSystem`; you never open a transaction yourself), each unit-tested against the seed at the frozen clock and integration-tested against Postgres.

## FILES YOU OWN

- `lib/engine/doses.ts` (new) — `insertGeneratedDoses(sql, prescription, tracked)` (calls `generateDoses`, inserts with `source: 'seed'` for creation-time rows — the mock's value, bytes must match §5), `regenerateUpcoming(sql, prescription, tracked)` (delete this prescription's `upcoming` rows, insert the generator's — the DELETE policy refuses recorded rows, so a recorded dose can never vanish; assert it), `applyRecompute(sql, prescription, missedDoseId)` (loads this prescription's doses, calls `recomputeAfterReportedMiss`, writes only the diff — added rows stamped **`source: 'system'`** (D-28), dropped rows deleted; returns `{ changed }`), `applyDiscontinuation(sql, prescription, discontinuedAt, reason)` (calls `discontinuePrescription`; updates the prescription — this runs on the agent/system path the `prescription_clinical_fields_locked` trigger admits for `status`/`discontinued_*` only; deletes the cancelled `upcoming` ids; catches the `RangeError` of D-29 and returns a typed refusal result, never throws upward).
- `lib/engine/depletion.ts` (new) — `depletionFor(prescriptionRow)` maps a DB row to the contract `Prescription` and calls `computeDepletion` **unedited**; WP3c imports this rather than mapping itself.
- `lib/engine/expiry.ts` (new) — `expireInvitations(sql, nowIso)`: selects via `invitationsToExpire`, updates each row to `expired` (the `caregiver_transitions` trigger admits `pending→expired` for the system actor when `expires_at <= jurah_now()`), `append('caregiver_invite_expired', actor system, message 'انتهت صلاحية دعوة مقدّم رعاية', relatedId)`, one `job_runs` row; returns the ids. **Touches no `doses` row** — the test diffs the table.
- `tests/unit/engine/*.test.ts` — the mapping functions against the seed rows; `tests/integration/engine/*.test.ts` — Gate 4's named cases **against Postgres**: حمد six rows on 2026-09-21 and three on 2026-09-26; فاطمة 20/22 not 21; `rx-006`/`rx-007` zero; سارة's seven with exact statuses (and CR-051's two extra rows still `upcoming`); recompute after `rx-008-20260919-0700` → `changed: false`, times identical, one `schedule_recomputed` row written by the caller (not by you — assert you wrote none); discontinuation of `rx-003` at 2026-09-21 → doses after the 21st gone, the 21st's remain (D-023), recorded rows untouched; expiry with `nowIso` = 2026-10-03 → `cg-03` and `cg-08` flip, two audit rows, `doses` byte-identical before/after (**E-03** belongs to you: paste it); a forged patient session attempting `regenerateUpcoming` on سارة's `rx-008` cannot delete her recorded rows (policy).
- `docs/backend-notes/p2-wp4b.md`.

## FILES YOU MUST NOT TOUCH

`lib/schedule/**` (pure half — request a change if needed), `lib/data/**`, `lib/session/**`, `lib/db/**`, `supabase/**`, `app/**`, the frozen set. If a trigger refuses a legitimate engine write, **report it** — do not add a migration.

## ACCEPTANCE — Gate 4

Paste: unit + integration outputs (or the loud NOT-A-PASS plus MCP hand proofs of the same SQL), `npm run guards` (guard 4 green — you have added no `missed` write path, and no `status:` literal outside the generator), `npm run verify` exit 0 in mock, frozen-set diff empty.
