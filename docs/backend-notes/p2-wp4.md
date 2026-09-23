# P2-WP4 (pure half): the deterministic engine, notes

Written by the WP4 pure-half implementer (brief: `docs/briefs/P2-WP4.md`). Three new pure modules
sit beside the proven generator, which was left unedited: `lib/schedule/recompute.ts`,
`lib/schedule/discontinue.ts` and `lib/schedule/expiry.ts`. They are exported from
`lib/schedule/index.ts`, with the new lines appended after the existing ones. The tests are in
`tests/unit/schedule/{recompute,discontinue,expiry,boundaries}.test.ts`. None of these modules reads
a clock, calls a model or performs I/O, and none assigns a dose status.

## 1. "Recompute after a reported miss": the semantics chosen

`recomputeAfterReportedMiss(prescription, existingDoses, missedDoseId): { doses, changed }`

**The principle.** A reported miss changes nothing about when the remaining doses fall. The
schedule depends only on the prescription's own fields: `startDate`, `doseTimes`, `dosingPattern`,
`frequencyPerDay`, `durationDays`, and `discontinuedAt` once it is discontinued. The generator
never reads a miss, so a miss cannot shift, compress or collapse the cadence. "Recompute" is
therefore a **reconciliation** of the prescription's `upcoming` doses against
`generateDoses(prescription, tracked)`:

1. **Recorded doses are kept exactly as they are.** A recorded dose is any dose whose status is
   not `upcoming`, and that includes the missed dose itself. The agent path writes statuses and
   this function never does (rule 1).
2. **Generated doses that are not already recorded.** When an `upcoming` dose with the same id
   already exists, the function keeps that stored object unchanged, so its `tracked` and `source`
   carry through (rule 3). Otherwise it adds the generator's dose, whose `upcoming` status comes
   from the generator alone.
3. **Stale doses are dropped.** An existing `upcoming` dose that the generator no longer produces
   is removed, for example one past a discontinuation date. Nothing ever extends past
   `startDate + durationDays` (TC-RS-04), because the generator never goes there.
4. **Other prescriptions pass through.** Doses that belong to other prescriptions are returned
   untouched.
5. **`tracked` for a brand-new dose** comes from the missed dose (`missed.tracked ?? true`, the
   contract's default). The fixed signature has no `tracked` argument. The miss was recorded, so
   that dose was tracked, and the agent never runs for a tracking-off patient (TC-RS-06).
6. **`changed`** is true only if the returned set differs from the input, meaning a dose was
   added, dropped or altered. The comparison uses a fingerprint of id, prescription, scheduledAt,
   status, tracked, recordedAt and source.
7. **Order.** When `changed` is false, the input order comes back unchanged. When it is true,
   other prescriptions' doses come first in input order, followed by this prescription's doses
   ascending by `scheduledAt`, with ties broken by `id`.

**No-op cases.** Each of these returns the input (copied) with `changed: false`:

- the id is not in `existingDoses`;
- the id belongs to a different prescription;
- the dose is not recorded as `missed`;
- the dose is `tracked: false`. An untracked dose is never given a status, so a "miss" on one is
  impossible input.
- The prescription is still flagged for review and not `confirmed`. TC-RS-07 says "no schedule
  generated **or recomputed**". Without this guard, the generator would return `[]` and every
  upcoming dose would be silently dropped.

**Results on the seed.** Recompute after `rx-008-20260919-0700` gives `changed: false` with an
identical set of 180 `scheduledAt` values. For `rx-005` (alternate-day, generated tracked for the
test, with the 2026-09-20 dose reported missed) the 14/16/18/20/22/24 cadence holds, no dose falls
on the 21st, and all 30 doses sit an even number of days from `startDate`. A daily dose planted on
the 21st to simulate a collapsed schedule in storage is removed, which gives `changed: true`.

**Why reconcile instead of "shift the next dose".** The spec's phrase "recalculated from
`doseTimes`" (TC-RS-01) and "without collapsing an alternate-day cadence" together only hold if
the miss is never an input to the arithmetic. Any design that anchors the next dose on the time of
the missed dose will, on an alternate-day drug, produce a dose one day after the miss. That is
exactly the collapse the seed's rx-005 exists to catch.

## 2. Discontinuation: the semantics chosen

`discontinuePrescription(prescription, existingDoses, discontinuedAt, reason): { prescription, doses, cancelledDoseIds }`

1. **The prescription.** It comes back as a new object with `status: 'discontinued'`, and with
   `discontinuedAt` and `discontinuedReason` exactly as given. Nothing else on it changes.
2. **Which doses are cancelled.** A dose is cancelled only when all three hold: it belongs to this
   prescription, it is still `upcoming`, and its calendar date is **strictly after** the calendar
   date of `discontinuedAt`. The discontinuation day itself is inclusive, which is the generator's
   own boundary: rx-004 stops "after 2026-06-28". Both sides are reduced to `YYYY-MM-DD` with
   `dateOf`, so `discontinuedAt` may be a bare date (the seed's form) or a full datetime, and it is
   stored as given. Because the rule matches the generator, the remaining doses equal
   `generateDoses(discontinued prescription)` exactly (tested). A recompute after a
   discontinuation returns `changed: false` (tested).
3. **Recorded doses are never removed or changed, whatever their date.** A discontinuation
   backdated to 2026-09-20 keeps سارة's `taken_on_time` dose on 2026-09-21 (tested). Past logs are
   untouched (TC-RS-03).
4. **Other prescriptions' doses** pass through untouched.
5. **Only an `active` prescription transitions.** A prescription that is already `discontinued` or
   `completed` comes back unchanged with `cancelledDoseIds: []`. The first discontinuation's date
   and reason remain the record, and a second call does not rewrite them.
6. **A malformed date throws.** A `discontinuedAt` that does not start with an ISO date throws a
   `RangeError`. `reason` is passed through without validation (the contract types it as an
   optional string).

## 3. Read-time invitation expiry: the semantics chosen

`foldInvitationExpiry(caregiver, nowIso)` and `invitationsToExpire(caregivers, nowIso)`

- **The rule.** A `pending` row with `expiresAt <= nowIso` reads as `expired`. Every other status
  is returned unchanged, whatever its `expiresAt` says: cg-01 and cg-02 are `active` with past
  `expiresAt` values and stay `active`. This is the exact complement of the mock's
  `pendingInvitationsFor` (`expiresAt > nowIso`). The test cross-checks the two at nine instants,
  including both seed boundaries.
- **Comparison is by instant (`Date.parse`), not by string.** For two `+03:00` strings, which
  covers every seed and mock value, the result is identical to the mock's string comparison. It
  stays correct when Postgres hands a `timestamptz` back in another offset, such as `…Z`, where a
  string comparison silently is not. **The WP4 writer half and WP5 should compare the same way**
  (or compare in SQL against `jurah_now()`).
- **A malformed `expiresAt` fails closed** and reads as `expired`. A malformed `nowIso` throws.
- **`invitationsToExpire` returns the selected rows unmodified**, in input order. The writer half
  sets `expired` and appends `caregiver_invite_expired`.

## 4. Invariants, and how they are proven

- **Rule 1 (no status write).** The package contains no `.status =`. The only `status:` literal
  is `upcoming`, and it appears only in `generate.ts`. The word `missed` appears only on the right
  of `===` or `!==`. These are enforced by a static scan in `boundaries.test.ts` over every
  `lib/schedule/*.ts` file, with comments stripped. The same patterns are also run over the
  runtime `toString()` of every exported function. The scan has positive controls, so it cannot
  pass by absence. Guard 4's allowance for `lib/schedule/` goes unused apart from the generator's
  existing literal.
- **Rule 4 (silence is not evidence).** Neither `recompute` nor `discontinue` has a `nowIso`
  parameter (their arity is asserted), and neither reads a clock (a static scan for `Date.now`,
  bare `new Date()`, `REFERENCE_NOW`, `referenceNow` and `REFERENCE_DATE`). A later `nowIso`
  (REFERENCE_NOW + 3 days) passed through every clock-taking function in the package, with
  recompute and discontinue also run over every seed prescription, leaves every `upcoming` dose
  `upcoming`. That includes the purest fixtures: سارة's tracked, unanswered, already-past rx-009
  doses on 2026-09-19.
- **Red, then green.** Five mutations were applied to the new modules one at a time and reverted
  after each run:
  1. the discontinue boundary changed from `>` to `>=`;
  2. the expiry boundary changed from `<=` to `<`;
  3. recompute generating with `dosingPattern: 'daily'`;
  4. recompute inferring `missed` for earlier unanswered doses;
  5. expiry importing `REFERENCE_NOW`.

  Each one turned tests red. The run outputs are in the WP4 report.

## 5. Ambiguities for the owner to confirm (decided here as written, not silently)

1. **Same-day doses survive a discontinuation.** The inclusive boundary matches the generator, but
   it means that a discontinuation reported at 09:15 on 2026-09-21 leaves that day's 18:00 dose
   listed as `upcoming`. The alternative, cancelling by instant, would make discontinue and the
   generator disagree, and the generator is proven and must not be edited. The owner should
   confirm that the inclusive day is intended. If it is not, change the generator's comparison and
   this one together, never one alone.
2. **`tracked` for doses that recompute adds** is taken from the missed dose, because the fixed
   signature has no `tracked` argument. A patient whose tracking state changed after generation
   cannot be represented with this signature. The agent only runs while tracking is on, so the
   practical answer is `true`. If the owner wants the patient's current `Settings` instead, the
   signature needs a fourth parameter, and that would be a change request.
3. **`source` on doses that recompute adds** is the generator's `'seed'`. The contract's `source`
   enum is `adherence_agent | system | seed`. The DB writer half may want `'system'` for rows it
   creates at runtime, and that is its decision. Existing rows keep their own `source`.
4. **Re-discontinuing is a no-op.** The first date and reason win. An alternative would be a
   correction path that rewrites them, which would need its own audit event.
5. **Recompute requires the dose to already be recorded as `missed`.** The agent must write the
   status first and then call recompute. When it is called before the write, recompute is a no-op.
   The ordering is for the agent-integration package (WP7) to fix in `API-SURFACE.md` §B.
6. **سارة has "seven rows" for 19–21 September in the seed, but the generated store holds nine.**
   The seed table lists seven rows for 19–21 September, while rx-009 (which starts 2026-09-05) also
   generates 13:00 and 21:00 on **2026-09-19**. Those two doses are tracked, `upcoming`, past
   `REFERENCE_NOW` and unanswered. The seed's table omits them, and the seed module generates them.
   The test asserts the seven stated rows by id with their exact status, `recordedAt` and `source`,
   and separately asserts that the two unlisted rows are `upcoming`. It does not assert "exactly
   seven". The owner should confirm whether the 19th's rx-009 doses belong in the table (as
   `upcoming`, or as recorded statuses the seed has not stated), or whether the table is only an
   excerpt. **This must not be "fixed" by marking them `missed`** (rule 4).

7. **For the writer half and WP5: these helpers throw, and the seam must not.**
   `discontinuePrescription` throws a `RangeError` on a malformed `discontinuedAt`.
   `foldInvitationExpiry` and `invitationsToExpire` throw on a malformed `nowIso`. These are pure
   helpers, not seam functions, so throwing is correct here. However, D-022 treats a refusal that
   reaches `error.tsx` as a bug, so the seam wrapper must validate its input and return the
   refusal shape, and must never let these throws escape.

   A related trap: a **bare-date** `expiresAt` such as `2026-10-02` parses as UTC midnight, not
   Kuwait midnight. Every seed and mock value is a full `+03:00` datetime (built with `at()` or
   `addDaysIso`), so this does not bite today. The writer half must keep writing full datetimes.
8. **Instant versus string comparison.** The brief states the expiry rule as `expiresAt <=
   nowIso`, which the mock implements as a string comparison. This package compares instants. The
   two agree on every `+03:00` value, and the tests cross-check them at nine instants. No row was
   appended to `docs/BACKEND-DIVERGENCES.md`, because that file is outside this package's write
   scope. If the lead counts this as a divergence, the lead should add the row.

## 6. Things found out the hard way

- **A naive scan for `missed` in an assignment misses a ternary.** `status: cond ? ('missed' as
  const) : d.status` contains no `status: 'missed'` and no `= 'missed'`, so the first version of
  the static scan passed with the mutation in place, although the behavioural rule-4 test caught
  it. The scan now flags every `'missed'` literal that is not the right-hand side of `===` or
  `!==`. Guard 4's regex (a) has the same blind spot for code outside `lib/schedule`. That is worth
  a look when guard 4 is next revised; it is not changed here because `scripts/**` is outside this
  package's scope.
- **The boundaries tests pin the existing generator and seed module.** They were green on the
  first run. They were not mutation-tested, because making them go red would mean editing
  `generate.ts` or `lib/data/mock/seed.ts`, and both are outside this package's write scope.
