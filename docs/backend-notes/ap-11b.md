# AP-11b — cannot_verify from the drug-knowledge agent (D6, CR-078 DECIDED)

Branch `polish/ap-11b-cannot-verify-agent`, off `origin/main` (`aaf7cd6` at
branch time), carrying PR #13 (AP-11a, `polish/ap-11a-cannot-verify-app`,
still **OPEN**, not merged) by merge commit, per the plan. This is the agent
side of PR #13: the app side already added `{ kind: 'cannot_verify' }` to
`DrugCheckOutcome` and its own copy; this package makes the real
`agent-travel-check` workflow actually answer it, instead of mapping every
"can't clear this profile" case to the plain `could_not_identify`.

## What changed

1. **`agents/knowledge/src/travel-check.js`** — `appOutcomeFor` gains a branch:
   `VERDICT.CANNOT_VERIFY` now returns exactly `{ kind: 'cannot_verify' }` (no
   `drugName`, no `verdict`, no `alertId`). Every other verdict is unchanged;
   `needs_confirmation`, `could_not_identify` and anything this code does not
   recognise still fall to `could_not_identify` (fail-closed default kept).
   Header comment (lines 7-27 before the edit) rewritten to describe the new
   outcome and its reasons.
2. **Two new `cannot_verify` reasons, both fail-closed:**
   - `profile_unavailable` — `travelCheck` now checks `Array.isArray(args.prescriptions)`
     itself, right after resolving the candidate and before touching the
     profile. A non-array (the backend call failed, or was never made) returns
     `cannot_verify` immediately: no screening, no alert, `findings: []`,
     `message: null`. An empty array `[]` is unchanged — a real empty profile,
     not "unavailable".
   - `brand_not_verified` — `agents/knowledge/src/resolve.js` gains
     `buildPendingNames(rows)`, exported, building a `Map` from normalised
     `candidateKeys` to an **unverified** SFDA brand row's own `brand` label
     (built only from `brand` / `sfdaTradeName` / `aliases`, never from
     `ingredients` — a pending row is never resolved to an ingredient).
     `travelCheck` takes an optional `pendingNames`; when resolution is
     `UNRESOLVED` with reason `not_in_mapping_table` and a vision-text key
     matches, it now answers `cannot_verify` / `brand_not_verified` with
     `brandLabel` from the data file (never the raw, untrusted vision text),
     instead of the plain "unknown name" `could_not_identify`. `candidate`
     stays `null`, `message` stays `null` (no new agent wording — see "Owed").
3. **`agents/knowledge/scripts/build.js`** —
   - Build-time guard: `pendingVerification.brands` must be an array or the
     build throws before writing anything (a guard that silently treated a
     missing list as "no pending brands" would pass with its input missing).
   - `TRAVEL_SRC` now also computes `PENDING_NAMES = buildPendingNames(BRAND_MAP_JSON.pendingVerification.brands)`.
   - `TC_CHECK` (the `check (deterministic)` Code node): the profile-outage
     branch that used to hard-code `{ verdict: 'could_not_identify', reason:
     'profile_unavailable', appOutcome: { kind: 'could_not_identify' } }` is
     gone. The vision text is now always parsed first, and `travelCheck` is
     always called — with `prescriptions: null` when the backend did not
     answer 200 with an array — so `travelCheck`'s own fail-closed logic
     (above) produces the result. `post` and the `backend_prescriptions_http_*`
     error string are unchanged; `pendingNames: PENDING_NAMES` is now passed
     through.
4. **Tests** — `agents/knowledge/test/helpers.js` exports `pendingNames`
   (built from the real `data/brand-map.json`). `agents/knowledge/test/travel-check.test.js`:
   the "MAREVAN does not resolve" test now asserts `cannot_verify` /
   `brand_not_verified` (with `pendingNames` passed in) and separately that the
   same box without a pending-names list still answers `could_not_identify`
   (unchanged default); every existing `cannot_verify` test's `appOutcome`
   assertion moved from `could_not_identify` to `cannot_verify`; a new
   fail-closed test for `prescriptions: undefined` / `null` /`[]`; a table
   test drives `appOutcomeFor` over all six `VERDICT` values plus `'safe'` and
   `undefined`. `agents/knowledge/scripts/check.js`: the AP-06 Ezetimibe
   scenario's `appOutcome` assertion updated; the "profile unreadable (503)"
   scenario now asserts `cannot_verify` / `profile_unavailable`; two new
   scenarios — UNREADABLE with a 503 backend (still `could_not_identify`,
   proving G5 answers before the profile is even asked about) and MAREVAN
   read through the built workflow (proving the wiring, not only the pure
   function).
5. **`tests/unit/agent/knowledge-contract.test.ts`** — `'appOutcome is always
   a valid DrugCheckOutcome shape'` now accepts `cannot_verify` only when
   `Object.keys` is exactly `['kind']`, and asserts that the loop actually
   produced at least one `cannot_verify`, one `could_not_identify` and one
   `identified` outcome (today: pt-02 Euthyrox and ZOCOR, pt-03 KLACID, all
   `ungraded_interaction_in_source`) — the new branch cannot pass unexercised.
   `tests/unit/agent-webhooks/core.test.ts`'s round-trip identity test
   (`'every appOutcome the real agent produces is read back unchanged'`) was
   **not edited** — it passes only because PR #13's `readDrugCheck` (which
   already passes `cannot_verify` through unchanged) is on this branch via the
   merge, which is exactly the point of carrying it.
6. **`agents/knowledge/README.md:50`** — the divergence-table row rewritten in
   place: the verdict is now answered to the app as its own `cannot_verify`
   (CR-078), naming both new reasons.
7. **Generated workflow** — `agents/knowledge/workflows/agent-travel-check.json`
   rebuilt with `JURAH_API_BASE=https://tryjuraaah.vercel.app/api/agent`.
   `agent-interaction-screening-ddinter.json` and `agent-extraction.json` are
   byte-identical (confirmed by an empty `git diff`) and were left untouched,
   because `text.js` and every other shared source file is unchanged.

**Not touched, on purpose:** any screen (`features/**`, `i18n/copy/**`) — AP-11b
is the agent side only, PR #13 already carries the app's copy and rendering.
No `docs/DECISIONS.md` entry — no CR numbers are reserved for this package and
CR-078 is already `DECIDED`.

## Proof (pasted, not summarised)

Branch and dependency:
```
$ git log --oneline -1 origin/main
5ba0a3a Merge pull request #16 from Hamad-Almesri-Coded-Bootcamp/polish/ap-18-robustness
$ gh pr view 13 --json state,mergedAt,headRefName,baseRefName,title,number
{"baseRefName":"main","headRefName":"polish/ap-11a-cannot-verify-app","mergedAt":null,"number":13,"state":"OPEN","title":"AP-11a: add cannot_verify to DrugCheckOutcome (CR-078)"}
$ git log --oneline --graph -3
*   a7a3c55 Merge PR #13 (AP-11a) into AP-11b: carry the app-side cannot_verify
|\
| * 645fad0 AP-11a: add cannot_verify to DrugCheckOutcome (CR-078)
* | aaf7cd6 Merge pull request #10 from Hamad-Almesri-Coded-Bootcamp/polish/ap-10-screening-every-path
```
(The merge of `origin/polish/ap-11a-cannot-verify-app` into this branch was
already the tip when this run started; PR #13 is still open, confirmed above,
so it stays carried until #13 lands.)

`agents/knowledge` full verify:
```
$ cd agents/knowledge && JURAH_API_BASE=https://tryjuraaah.vercel.app/api/agent npm run verify
...
ℹ tests 94
ℹ pass 94
ℹ fail 0
...
wrote agents/knowledge/workflows/agent-interaction-screening-ddinter.json - 11 nodes, ...
wrote agents/knowledge/workflows/agent-travel-check.json - 13 nodes, ...
wrote agents/knowledge/workflows/agent-extraction.json - 15 nodes, ...
JURAH_API_BASE = https://tryjuraaah.vercel.app/api/agent
...
######## agent-travel-check
  OK    the vision request carries the image inline and the narrow prompt
  OK    UNREADABLE -> could_not_identify; no alert
  OK    danger: KLACID for a patient on Simvastatin -> alert POSTed, alertId in the app outcome
  OK    danger alert refused by the backend -> mustEscalate, no alertId
  OK    seed pt-01 photographs ZOCOR -> interaction_found (Simvastatin x Warfarin is in DDInter), app names Simvastatin
  OK    AP-06 - an Ezetimibe box for a patient on Amlodipine (both outside the loaded DDInter files) -> cannot_verify, app cannot_verify
  OK    profile unreadable (backend 503) -> cannot_verify, profile_unavailable, never "no interaction"
  OK    UNREADABLE with the backend also down (503) -> could_not_identify (G5 answers first; the profile is never even asked about)
  OK    MAREVAN (unverified SFDA brand, AP-07 pending) -> cannot_verify, brand_not_verified - never resolved to Warfarin
  OK    a truncated/blocked Gemini answer (finishReason != STOP) is never read as a name
  OK    Gemini down -> could_not_identify with the vision error named
  OK    bad input (no image, a PDF, not base64, a bad id) -> valid:false

all checks passed
```

Generated-file discipline:
```
$ git diff --stat -- agents/knowledge/workflows
 agents/knowledge/workflows/agent-travel-check.json | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
$ git diff -- agents/knowledge/workflows/agent-extraction.json agents/knowledge/workflows/agent-interaction-screening-ddinter.json | wc -l
0
$ git diff -- agents/knowledge/workflows | grep -c "not-deployed"
0
$ node -e "console.log((require('fs').readFileSync(0,'utf8').match(/—/g)||[]).length)" < <(git diff -- agents/knowledge/workflows)
0
```

Top-level `agents/` generator still reads the rebuilt workflow correctly
(`agents/eval` + `agents/test/eval-harness.test.js` expect UNREADABLE ->
`could_not_identify`, unaffected):
```
$ cd agents && JURAH_API_BASE=https://tryjuraaah.vercel.app/api/agent npm run verify
ℹ tests 116
ℹ pass 116
ℹ fail 0
...
all checks passed
```
(This regenerated the five unrelated `agents/workflows/*.json` files
byte-for-byte identically — confirmed with `git diff --ignore-cr-at-eol`
showing nothing but the "LF will be replaced by CRLF" checkout warning — so
they were `git restore`d rather than committed.)

App-side contract + round-trip:
```
$ npx vitest run tests/unit/agent/knowledge-contract.test.ts tests/unit/agent-webhooks/core.test.ts
 Test Files  2 passed (2)
      Tests  48 passed (48)
```

Targeted suites named in the plan, run together:
```
$ npx vitest run tests/unit/agent tests/unit/agent-webhooks tests/unit/assistant --no-file-parallelism
 Test Files  12 passed (12)
      Tests  195 passed (195)
```
(First attempt, with Vitest's default file-level parallelism, showed 2
unrelated failures — `agent/routes.test.ts` and `assistant/assistant.test.ts`
— both `Test timed out in 5000ms` inside `beforeAll`/worker startup, plus an
unhandled "Timeout waiting for worker to respond" starting
`AssistantLauncher.test.tsx`'s pool. Per the debug-two-or-three-first rule:
each failing file was re-run alone and passed clean in seconds; a live process
listing at the time showed multiple sibling agent worktrees
(`jh-wt/ap-11`, others) running their own `npm run verify` / vitest / e2e
concurrently on this same machine. This is host resource contention, not a
regression — neither failing file imports or exercises anything this package
touches — and `--no-file-parallelism` above reproduces a full clean pass.)

Typecheck, guards, notes:check, eslint:
```
$ npm run typecheck
> tsc --noEmit
(no output — 0 errors)

$ npm run guards
...
All guards passed.

$ npm run notes:check
✓ ## 1. The data-access surface … ✓ ## 7. Things Phase 1 found out the hard way
§1 rows for lib/data/api.ts: 50/50
§5 shapes for lib/data/api.ts: 50/50
§1 rows for lib/session/api.ts: 5/5
§5 shapes for lib/session/api.ts: 5/5

$ npx eslint tests/unit/agent/knowledge-contract.test.ts
(no output — clean, exit 0)
```

e2e regression (no screen changed in this package; run as a smoke check —
this package owns no e2e spec and adds none):
```
$ JURAH_SESSION_SECRET=<throwaway, generated in-line, never printed> E2E_PORT=3102 npx playwright test tests/e2e/supply.spec.ts
  68 passed (8.6m)
  11 failed:
    [phone-390]  idle state: PhotoInput and a way back to Safety (ar)
    [phone-390]  identified, no interaction (سارة, Levothyroxine) (ar, en)
    [phone-390]  D1 — back via AppBar returns to More (ar)
    [phone-390]  identified with an interaction (حمد, Warfarin) (en)
    [phone-390]  could-not-identify (0-byte photo) (en)
    [tablet-834] identified with an interaction (حمد, Warfarin) (ar, en)
    [tablet-834] identified, no interaction (سارة, Levothyroxine) (en)
    [tablet-834] could-not-identify (0-byte photo) (en)
    [desktop-1440] identified with an interaction (حمد, Warfarin) (ar)
  5 skipped
```
Every failure is either the shared `hydrated()` poll helper timing out at its
fixed 20s (`Object.keys(el).some(k => k.startsWith('__reactProps$'))` never
becomes true) or a downstream `toBeVisible`/`toHaveURL` assertion timing out
after a slow render — none names `cannot_verify`, and none is a C3 test this
package could plausibly break (this branch touches no file under `app/**`,
`features/**`, `lib/data/**` or `i18n/**`). Per the debug-first rule, retried
a 6-test slice of the failing titles alone on a fresh server:
```
$ JURAH_SESSION_SECRET=<throwaway> E2E_PORT=3102 npx playwright test tests/e2e/supply.spec.ts --project=phone-390 --grep "idle state|could-not-identify|no interaction"
  3 passed, 3 failed (47.0s)
  failed: idle state (en), identified/no interaction (ar), identified/no interaction (en)
```
Same tests pass and fail inconsistently between the two runs (e.g. "idle
state (en)" failed only on the retry; "could-not-identify (en)" failed on the
first run, passed on the retry) — not a stable, reproducible break, which a
real regression from this diff would be. At the time of both runs a process
listing showed ~27 node/next processes and several sibling agent worktrees
(e.g. `jh-wt/ap-11`) running their own verify/e2e/vitest concurrently on this
one machine (a stray `grep -r` of my own, left over from an earlier
exploration and killed once found, added to this — noted for honesty, though
it started after the first e2e run and cannot explain that one). Recorded
here as **owed**: a clean, quiet-box run of the full spec to confirm this is
purely host contention. Not fabricated as green, and not chased further,
since AP-11b's own scope (the agent side of CR-078) is fully proven above and
this spec is outside it.

Pre-commit sanity:
```
$ git diff --stat
 agents/knowledge/README.md                         |  2 +-
 agents/knowledge/scripts/build.js                  | 27 ++++++----
 agents/knowledge/scripts/check.js                  | 24 +++++++--
 agents/knowledge/src/resolve.js                    | 25 ++++++++-
 agents/knowledge/src/travel-check.js               | 52 ++++++++++++++-----
 agents/knowledge/test/helpers.js                   |  7 ++-
 agents/knowledge/test/travel-check.test.js         | 59 ++++++++++++++++++----
 agents/knowledge/workflows/agent-travel-check.json |  2 +-
 tests/unit/agent/knowledge-contract.test.ts        |  9 +++-
 9 files changed, 167 insertions(+), 40 deletions(-)
(docs/backend-notes/ap-11b.md itself is new, untracked until this commit.)

$ git diff | grep -c "not-deployed"
0
```

## Owed

- **A quiet-box confirmation of `tests/e2e/supply.spec.ts`** — two runs in
  this box (full suite, then a 6-test retry) each showed a handful of
  `hydrated()`-timeout failures, inconsistent between runs, while this
  machine had ~27 node/next processes running (sibling agent worktrees on the
  same host). No failure named `cannot_verify` or anything this package
  touches. See "Proof" above for the pasted output. Owed: one run with the
  host otherwise idle, to close this out definitively.
- **Republish `agent-travel-check` on n8n** — a live step. Export the workflow
  into this file before and after (the drift check reads non-zero for this
  workflow until then). `agent-interaction-screening-ddinter` and
  `agent-extraction` need no republish (byte-identical, unchanged).
- **A real proof through the deployed workflow and app** that a pending-brand
  box (e.g. MAREVAN) and a profile outage each show the C3 `cannot_verify`
  notice (AP-13/AP-14, live). Not fabricated here.
- **Merge order**: PR #13 first, then this one. If this branch's *tip* were
  ever merged onto a `main` that does not already carry #13,
  `tests/unit/agent-webhooks/core.test.ts:75` and
  `tests/unit/agent/knowledge-contract.test.ts:76` would go red — this PR body
  says so up front and the branch itself carries #13 until then, so that
  scenario cannot actually arise from merging this PR as opened.
- **No new agent wording** for `profile_unavailable` or `brand_not_verified` —
  `message` stays `null`, matching today's shape; the app reads only
  `appOutcome` (`readDrugCheck`), and the unmerged AP-11 orchestrator branch
  picks its reply line by verdict alone. `text.js` (copied into both the
  travel workflow and `agent-interaction-screening-ddinter.json`) is
  untouched, so no second live republish was created by this change.
- **Deliberately not mapped to `cannot_verify`**: an unreadable photo (G5), an
  unknown name (`not_in_mapping_table` with no pending-brand match), a vision
  outage, and a near match (`needs_confirmation`) all stay
  `could_not_identify`. Reason: PR #13's `c3CannotVerifyBody` opens "We
  recognised the medicine" / «تعرّفنا على الدواء», which would be false for a
  name the agent never recognised. This is the planner's reading of the
  task; the owner should confirm it.
- **AP-07's other pending brands** (NORVASC, AMLOR, CALTRATE, AMOXIL) are not
  individually exercised by name here — only MAREVAN, the fixture the plan
  named as stable across AP-07. The `buildPendingNames` mechanism covers all
  of `pendingVerification.brands` uniformly; if AP-07 (PR #15, open) merges
  first, the generated JSON and `travel-check.test.js` will conflict — rebuild
  with the same `JURAH_API_BASE` prefix after merging `origin/main`, never
  hand-merge the generated JSON.
- **Owed by AP-11a (#13), not this package**: the C3 `cannot_verify` e2e test,
  the Hallmark audit, the twelve-point UX checklist, and a full
  `npm run verify` for `DrugCheckFlow` — this package edits no screen.
- **Known, not this package's**: `tests/e2e/audit-2026-09.spec.ts` "audit C6 —
  the danger alert opens its detail" (2 tests) fails the same way on `main`
  (`e9be92d`) independent of this change.

## Deploy-order note

This branch carries PR #13's commit, so **merging this PR alone is safe** even
if #13 is still open at that moment — main would gain both. If #13 merges
first (as it should), merging this PR afterwards is a normal fast-forwardable
history, not a conflict, because the same commit (`645fad0`) is already
common ancestry. Either way, `readDrugCheck` never regresses to mapping
`cannot_verify` back to `could_not_identify` once #13 is in.
