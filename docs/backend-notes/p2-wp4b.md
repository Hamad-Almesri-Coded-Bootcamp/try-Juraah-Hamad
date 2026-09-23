# P2-WP4b: the deterministic engine, database half, notes

Written by the WP4b implementer (brief: `docs/briefs/P2-WP4b.md`), 2026-09-22. The pure half is
`lib/schedule/**` (WP4, `docs/backend-notes/p2-wp4.md`) and was **not edited**. This package adds
`lib/engine/**`: library functions that other packages call **inside their own transaction**. None
of them opens a transaction, sets a role, connects or reads a clock.

## 1. What exists

| File | Exports | Caller runs it under |
|---|---|---|
| `lib/engine/doses.ts` | `insertGeneratedDoses(sql, rx, tracked) → Dose[]` · `regenerateUpcoming(sql, rx, tracked) → {deletedIds, inserted, keptRecordedIds}` · `applyRecompute(sql, rx, missedDoseId) → {changed, addedIds, droppedIds}` · `applyDiscontinuation(sql, rx, discontinuedAt, reason) → {ok:true, prescription, cancelledDoseIds} \| {ok:false, reason:'invalid_date'\|'not_active'\|'not_found'}` · `EngineInvariantError` | generation: the patient's or reviewer's `withSession()` · recompute and discontinuation: `withSystem()` (D-025) |
| `lib/engine/depletion.ts` | `depletionFor(prescriptionRow) → Depletion` (maps the row, then calls `computeDepletion` unedited) | pure, no SQL. WP3c imports it |
| `lib/engine/expiry.ts` | `expireInvitations(sql, nowIso) → {ok:true, expiredIds} \| {ok:false, reason:'invalid_now'}` · `INVITE_EXPIRED_MESSAGE` | `withSystem()` only (job route, WP5/WP6) |
| `lib/engine/rows.ts` | `prescriptionFromRow`, `doseFromRow`, `loadPrescription(sql, id)`, `loadDoses(sql, id)` | any |
| `lib/engine/sql.ts` | `ENGINE_SQL`: all 11 statements as text, `PRESCRIPTION_COLUMNS`, `DOSE_COLUMNS` | — |
| `lib/engine/index.ts` | barrel | — |

Tests: `tests/unit/engine/{rows,doses,expiry,boundaries}.test.ts` (95 tests, mock, part of
`npm run test`), with `tests/unit/engine/fakeTx.ts`, a recording stand-in for the transaction.
`tests/integration/engine/{generation,recompute,discontinuation,expiry}.test.ts` and `_engine.ts`,
plus `tests/integration/enforcement/dose.test.ts` (**E-03**; WP7 appends E-01/02/04/05 there).

**Every statement runs through `sql.unsafe(ENGINE_SQL.<name>, params)`.** A gate proof can therefore
run the identical text through the MCP connector, with the parameters bound by plpgsql
`EXECUTE … USING` (§4). Lists travel as **one `jsonb` parameter**, never as a driver array: the
`postgres` driver sends an untyped JS array as the text `a,b` (`inferType` returns 0, then `'' + x`).

## 2. The rules, and where each is enforced twice

- **Nothing writes a dose status.** No `ENGINE_SQL` statement updates `doses`. The insert has **no
  `status` column** (the default `'upcoming'` is the generator's word), and `assertOnlyUpcoming`
  refuses to insert or delete any dose object whose status is not `upcoming`. The static scan in
  `boundaries.test.ts` (with positive controls) finds no `status:` literal, no `.status =`, no
  `'missed'` and no `update doses` in `lib/engine/*.ts`. The only dose word there is `upcoming`.
  **Guard 4 is green.**
- **A recorded dose is never deleted.** Both deletes carry `status = 'upcoming'`. The
  `doses_delete_upcoming` policy refuses a recorded row to `jurah_app` regardless: proven with a
  *bare* `delete … where prescription_id = 'rx-008'` from سارة's own session, which removed 177
  rows and left the 3 recorded ones (§4 P7). `regenerateUpcoming` also re-counts the recorded ids
  after its delete and throws `EngineInvariantError` (rolling the caller back) if one vanished;
  there is a unit test for this.
- **A recorded id is never re-inserted.** `regenerateUpcoming` filters the generator's output
  against the surviving recorded ids explicitly, not with `on conflict do nothing`.
- **Rule 4.** No doses function takes a clock (asserted on each function's `toString()`). E-03
  runs the expiry job and three recomputes with `jurah.now` advanced 3 and then 14 days. The doses
  table stays byte-identical, `rx-003-20260921-0800` stays `upcoming|false`, and the only
  `missed` row is سارة's reported one (§4 P5).
- **The engine writes no audit row for doses.** `schedule_recomputed`, `prescription_discontinued`,
  `prescription_added` and `prescription_field_confirmed` are the **caller's** to append (asserted:
  0 new audit rows after `applyRecompute` and `applyDiscontinuation`). `expireInvitations` does
  append, once per row flipped, as the brief states.
- **D-29.** `applyDiscontinuation` validates the date with the pure function **before any
  statement runs** and returns `invalid_date`. `expireInvitations` does the same for `nowIso` and
  returns `invalid_now`. Neither throws for a refusal. `EngineInvariantError` is thrown only for a
  broken invariant, which is a bug and never a user-reachable refusal.
- **The throw contract is uneven on purpose, and callers must know it.** `applyDiscontinuation`
  and `expireInvitations` return refusal values. `insertGeneratedDoses` and `regenerateUpcoming`
  let a Postgres refusal propagate, for example `new row violates row-level security policy for
  table "doses"` for a session that cannot write that patient's doses (§4 P7). They run inside the
  caller's transaction, and the transaction is aborted by then anyway. **The seam caller (WP3a
  `savePrescriptionDraft`, WP5 `confirmPrescriptionFields`) must map that error to its D-022
  refusal shape** and must never let it reach `error.tsx`.

## 3. Decisions taken here (for the lead to confirm)

1. **The caller writes `prescription_discontinued`.** The brief says so for `schedule_recomputed`
   ("written by the caller (not by you)") and is silent on discontinuation. BACKEND-PLAN's WP4 row
   says WP4 writes it, while API-SURFACE §B lists it under the route. I chose the symmetric rule:
   the recompute route (WP7) appends both. **No document defines the message text for
   `prescription_discontinued`**, and the mock never writes one. WP7 needs one; it is copy the owner
   may want to word, so I did not invent it.
2. **`expireInvitations` sets the transaction's clock to `nowIso`** (`set_config('jurah.now',
   nowIso, true)`) before its update. The `caregiver_transitions` trigger compares against
   `jurah_now()`, and without this step a test that passes a later `nowIso` gets the trigger's
   "not expired yet" raise. In production the seam passes `REFERENCE_NOW`, which `withSystem()`
   has already set, so nothing changes. The statement is transaction-local.
3. **The expiry UPDATE repeats the trigger's condition** (`status = 'pending' and expires_at <=
   jurah_now()`), so the database stays the authority. A row the TypeScript selection picked but
   the database clock disagrees about is simply not touched and not audited (unit-tested).
4. **One `job_runs` row per run, including `rows_affected = 0`**, so "the job ran" is provable.
5. **The expiry audit row's `createdAt` is `jurah_now()`**, the moment the job ran. That equals
   `nowIso` and not the row's `expiresAt`, whereas the seed's cg-05 row carries its `expiresAt`.
   Each is honest about its own event.
6. **`applyRecompute` requires the caller to have recorded the miss first** (p2-wp4 §5.5). A call
   before that is a no-op with zero writes (tested on the CR-051 dose `rx-009-20260919-1300`).
7. **Refusal values instead of the brief's bare types.** `applyDiscontinuation` returns
   `{ok:false, reason}` as the brief asks. `expireInvitations` returns `{ok, expiredIds}` rather
   than a bare `string[]`, so that a malformed `nowIso` has a non-throwing refusal (D-29).
   `applyRecompute` returns `{changed}` plus `addedIds`/`droppedIds`.

## 3a. For WP5: the confirm path must regenerate BEFORE it confirms the row

`regenerateUpcoming`'s real caller is `confirmPrescriptionFields`, under a **reviewer** session. The
`doses_insert` and `doses_delete_upcoming` policies need `can_read_patient(patient)`. The reviewer
branch of that function is true only while the patient still has a queue item, meaning a
prescription with `needs_review` and `field_review_status` other than `confirmed`, or a pending
alert. The mock's order is to update the row to `confirmed` and then regenerate. In Postgres that
order closes the reviewer's read in the middle of the transaction. The delete then silently matches
0 rows, and the insert raises RLS.

The seed hides this: فاطمة has two flagged records, so confirming one keeps her in the queue. Probe
P8 (§4) makes rx-006 her only queue item:

- **update, then regenerate:** `update 1 · recordedIds 0 · deleteUpcoming 0 · insert → new row
  violates row-level security policy for table "doses"`;
- **regenerate, then update:** `recordedIds 0 · deleteUpcoming 0 · insert 30 · update 1`, which
  leaves 30 doses and `confirmed|false`.

**WP5 must call `regenerateUpcoming(sql, <the confirmed Prescription built in TS>, tracked)` before
the `update prescriptions` statement** (both in one transaction), or run the regeneration under
`withSystem()`.

## 3b. For the route owners: E-03 is proven for the library, not yet for the route

ENFORCEMENT E-03's rejected call names `/api/jobs/expire-invitations` and the WP4 recompute. That
route does not exist yet (WP5/WP6). `tests/integration/enforcement/dose.test.ts` › `E-03` and hand
proof P5 exercise the **library functions the route will call**. Under the WPfinal counting rule,
a row "whose call was never made (e.g. the route did not exist)" is a failure. **The route owner
must extend that E-03 test to invoke the route itself** (and the recompute route, WP7) once it
exists.

## Divergences

Same columns as `docs/BACKEND-DIVERGENCES.md`; numbered `WP4b-n` for the lead to renumber at the gate.

| # | Function / place | Mock | Backend | Why | Could a screen notice? |
|---|---|---|---|---|---|
| WP4b-1 | Regeneration on `confirmPrescriptionFields` (`regenerateUpcoming`) | Drops **every** dose of the prescription (`store.doses.filter(d => d.prescriptionId !== rx.id)`), recorded ones included, then regenerates | Deletes `upcoming` rows only. A recorded dose and its id survive, and the generator's dose for that id is skipped | Rule 1: a recorded dose is never deleted (policy `doses_delete_upcoming`) | No. No seed prescription under field review has a recorded dose |
| WP4b-2 | `applyDiscontinuation` with a full datetime | n/a (the mock never discontinues) | `discontinued_at` stores the **calendar date** (`dateOf(discontinuedAt)`), the same value the cancel boundary uses. The returned `Prescription.discontinuedAt` is that date, as a later read returns it | The column is `date`, and the boundary and the column must not disagree | No |
| WP4b-3 | Expiry job clock | n/a (no job in the mock) | Sets `jurah.now = nowIso` for the job's transaction; the audit row's `createdAt` = that instant | The trigger reads `jurah_now()` (§3.2, §3.5) | No |
| WP4b-4 | Recompute-added doses | n/a | `source: 'system'` (D-28), `tracked` from the missed dose, `upcoming` from the generator | D-28 | No (`source` is rendered nowhere) |

## Change requests

1. **Guard 8 must admit `lib/engine/**`**, or `npm run guards` and `npm run verify` stay red on 12
   lines. The brief places SQL-running library code in `lib/engine/**` (the callers pass the
   handle in), but `scripts/guards/sql-only-in-db.ts` allows a SQL tag or `.unsafe(` only in
   `lib/db`, `scripts/db`, `tests/integration` and `lib/{data,session}/pg`. `scripts/**` is outside
   this package, so the guard is **not** edited here, and the handle was **not** renamed to dodge
   the regex. Proposed change (lead): add `f.startsWith('lib/engine/')` to `inPg`, with the
   analogous requirement that such a file import its `Tx` type from `@/lib/db/withSession` (every
   engine file that runs SQL already does), and never `getSql`.
2. **The brief's expiry expectation disagrees with the seed.** The brief says "`nowIso` =
   2026-10-03 → `cg-03` and `cg-08` flip, two audit rows". The seed has cg-08 expiring
   **2026-10-04T09:30+03:00**, so at 2026-10-03 only cg-03 flips (one row); WP4's pure test says
   the same. The seed wins. The suites prove both instants: 2026-10-03 flips cg-03 (1 audit row),
   and 2026-10-05 flips cg-03 and cg-08 (2 rows). ENFORCEMENT E-20 already names only cg-03 at
   2026-10-03.
3. **`prescription_discontinued` message text** (§3.1): owed to WP7 by the lead or the owner.
4. **Not mine, found in passing:** `npm run typecheck` fails in `lib/session/verify.ts:108`
   (WP2's file: `Uint8Array<ArrayBufferLike>` is not a `BufferSource`). Nothing in `lib/engine` or
   its tests has a type error.

## 4. Gate 4 proofs by hand (JURAH_DATABASE_URL is empty)

`npm run test:integration -- tests/integration/engine tests/integration/enforcement` fails loudly,
verbatim: `Error: !! integration skipped — JURAH_DATABASE_URL not set — NOT A PASS` ·
`Test Files  6 failed (6)` · `Tests  45 skipped (45)`. The word "skipped" is vitest's: `beforeAll`
throws in the WP1 harness, so every test in each file is reported not-run, and each FILE fails.
Five of the six files are this package's. The sixth, `enforcement/read-supply.test.ts`, is WP3c's
and matched the path filter. The same cases were proved through the Supabase MCP
`execute_sql` on `frvubflbpujwuhsxweue` as follows. A scratchpad driver (not in the repository) ran
the **real `lib/engine` functions** against a recording transaction whose reads were answered from:

- the prescriptions and pending caregivers **read from the database** with the engine's own
  projection;
- the seed's doses, **md5-checked against the database inside each proof**, and aborted on drift.

Every statement the engine emitted was replayed verbatim in one plpgsql `DO` block, under the same
role (`set local role jurah_app`) and session GUC. Each replay checked `ROW_COUNT` against the
simulation, and the block ended with `raise exception 'PROOF …'`, which rolled everything back. A
sentinel probe (an insert into `job_runs` visible inside, `0` rows in a separate call afterwards)
showed that the rollback holds. Baseline before and after all proofs: doses 949 (md5
`48fab7265c4ccfeeaa1680087398a02c`), recorded 5, audit 47, job_runs 0, caregivers and
prescriptions exactly as seeded.

| # | Case | Result |
|---|---|---|
| P1 | `insertGeneratedDoses` for rx-002, rx-005, rx-006, rx-007 after wiping their doses, **verbatim replay** (system) | doses digest back to `949 / 48fab726…` (wiped to 898). حمد 21st: `08:00 rx-002 · 08:00 rx-003 · 14:00 rx-002 · 18:00 rx-001 · 20:00 rx-002 · 20:00 rx-003` (six, all `upcoming false seed`). 26th: `08:00 rx-003 · 18:00 rx-001 · 20:00 rx-003` (three). فاطمة: 20th `09:00 rx-005`, 21st `[]`, 22nd `09:00 rx-005`. rx-006/rx-007: 0 rows and no insert issued |
| P1b | the engine's full re-generation of rx-001…rx-007 (589 rows), compared by md5 with the database | `engine_result_equals_db_rows: true` (`f4b5d262…`, n 589) |
| P2 | سارة's seven | `missed` 07:55 · `taken_on_time` 07:05 · `taken_on_time` 13:20 · `taken_late` 22:40 · `taken_on_time` 07:12 (all `adherence_agent`) · two `upcoming seed`. The CR-051 rows rx-009-20260919-1300/2100 are `upcoming` |
| P2b | `regenerateUpcoming` rx-008 + rx-009 under سارة's session (deleted 177+178, inserted 177+178, kept 3+2 recorded), result md5 vs the database | `true` (`29cd9507…`, n 360) |
| P3 | `applyRecompute(rx-008, rx-008-20260919-0700)`, verbatim | `changed:false`. Two statements, both reads. Doses digest, audit count (47) and the md5 of rx-008's 180 scheduled times (`d7b9cb9c…`) are identical before and after |
| P3b | the same with `rx-008-20260925-0700` removed first | re-added as `…|2026-09-25T07:00:00+03:00|upcoming|true|system`. No audit row added (the one `schedule_recomputed` is the seed's) |
| P4 | `applyDiscontinuation(rx-003, '2026-09-21')`, verbatim (system) | 162 doses after the 21st → 0. The 21st keeps `08:00` and `20:00`. Recorded-rows md5 is unchanged (`0cd3a393…`). Row reads `discontinued|2026-09-21|الطبيب أوقف الدواء`. 0 `prescription_discontinued` rows (caller's) |
| P5 | **E-03**: `jurah.now` = 2026-09-24T09:15, then `expireInvitations('2026-10-05')`, recompute rx-008/rx-009 (CR-051 dose)/rx-003 (untracked, past), verbatim | three `changed:false`. Doses `949 / 48fab726…` before **and** after. `rx003_0800 = upcoming|false`. `missed_rows = ["rx-008-20260919-0700"]` (the reported one only). cg-03 and cg-08 expired |
| P6 | expiry at 2026-10-03 and at 2026-10-05, verbatim | 10-03: `cg-03:expired`, `cg-08:pending`, one audit row `pt-01|system|caregiver_invite_expired|انتهت صلاحية دعوة مقدّم رعاية|cg-03|2026-10-03T00:00:00+03:00`, `job_runs = expire_invitations|1`, doses identical. 10-05: both expired, two rows (pt-01 cg-03, pt-02 cg-08), `job_runs … |2`, doses identical |
| P8 | the reviewer confirm-path ordering (§3a): rx-007 removed in setup so rx-006 is فاطمة's only queue item; reviewer `acc-10`; `regenerateUpcoming`'s statements with the engine's 30-row payload for the confirmed rx-006 | A (update, then regenerate): `update 1, recordedIds 0, deleteUpcoming 0, insert → new row violates row-level security policy for table "doses"`. B (regenerate, then update): `insert 30, update 1`, rx-006 `confirmed|false` with 30 doses |
| P7 | policy probes | سارة bare delete of rx-008 → 177 deleted, 3 recorded left, 3 rows left. Forged حمد session replaying `regenerateUpcoming` on rx-008: recordedIds 0, deleteUpcoming 0, insert → `new row violates row-level security policy for table "doses"`. `jurah_agent` running the engine's delete → `permission denied for table doses` (D-025) |

## 5. Things found out the hard way

- **`concat_ws` renders a boolean as `t`/`f`, while `string_agg(… || tracked)` renders it as
  `true`/`false`.** The first drift guard compared a TypeScript md5 built with `'true'` and failed.
  That was a formatting mismatch, not drift: the guard fired (red), was diagnosed by sampling
  rows, and was fixed to `t`/`f` (green).
- **An untyped JS array is not a Postgres array to the `postgres` driver**, in either the tag or
  `unsafe` (`inferType([...]) === 0`, then `'' + x`). A jsonb parameter behaves identically from
  TypeScript and from a hand-run `EXECUTE … USING`.
- **plpgsql `EXECUTE … USING` binds `$n` exactly like the driver does**, so a DO block can replay
  the application's statement text unchanged. `GET DIAGNOSTICS … ROW_COUNT` then checks each
  statement, and `raise exception` both returns the proof and rolls it back. Through the connector
  this is the only way to get "mutate, read, roll back" into one call.
- **Guard 4's assignment scan covers tests too**, so a positive-control sample `dose.status =
  'missed'` in a test string trips it. The sample is split the way WP4's boundaries test does.
- **Mutation check.** Each of nine mutants turned `tests/unit/engine` red, and it was green again
  after each revert (95/95):
  1. recompute rows stamped `seed`;
  2. `discontinued_at` written as given;
  3. recorded ids re-inserted;
  4. non-active discontinued;
  5. no clock alignment in the expiry job;
  6. malformed `nowIso` reaching the database;
  7. `deleteUpcoming` without its filter;
  8. a `status` column in the insert;
  9. a `status: 'missed'` literal.

## 6. What is not proven and why

- **The integration suites have not run**, because `JURAH_DATABASE_URL` is empty. §4 proves the
  same cases by hand. The first real run may still surface driver-level details the hand proofs
  cannot see, such as the `postgres` driver's parameter handling for `sql.unsafe(text, [jsonText])`
  (the text and the jsonb cast are identical to the replay).
- **P1b and P2b compare an md5 over the engine's simulated result with the database**, rather than
  replaying 589 or 355 inserted rows verbatim through the connector. The statement shape of those
  inserts is proven verbatim in P1 (51 rows) and P3b.
