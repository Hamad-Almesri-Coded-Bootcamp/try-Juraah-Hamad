# AP-11a — cannot_verify in the app (CR-078)

Time-boxed run, branch `polish/ap-11a-cannot-verify-app`, started 2026-09-24 17:58
Kuwait time against a ~18:13 box. Full gate (`npm run guards` + `notes:check` +
`typecheck` + targeted vitest + eslint) ran green below; the root `npm run verify`
and the e2e specs did not fit the box and are owed (see "Owed" below).

## What changed

1. **Contract** (`types/views.ts`) — `DrugCheckOutcome` gains a third member,
   `{ kind: 'cannot_verify' }`. No `drugName`, no `verdict`: nothing is guessed,
   nothing was screened.
2. **App mapping** (`lib/agent-webhooks/core.ts`) — `readDrugCheck` passes
   `appOutcome.kind === 'cannot_verify'` through as its own outcome (extra fields
   on it are never read); anything else unexpected still falls to
   `could_not_identify`. Doc comments at the top of the file and above the
   function now name `cannot_verify` (CR-078).
3. **Screen** (`features/supply/DrugCheckFlow.tsx`, C3) — new `Phase` member
   `cannot_verify`, handled in `handlePhotoChange` right after the
   `could_not_identify` branch and before any `getAlert` call. Renders an
   `InlineNotice tone="warning"` (no drug name, no success tone, no
   `ErrorState` — the photo was read fine; a retry does not fix a data gap),
   then the same secondary "check another photo" button, then the quiet
   back-to-Safety button. Header doc comment and the G7 state list updated.
4. **Copy** (`i18n/copy/supply.ts`) — `c3CannotVerifyTitle` /
   `c3CannotVerifyBody`, Fusha Arabic + English, `placeholder: true` like their
   neighbours, no U+2014. Never implies the medicine is safe; explicitly says
   nothing was recorded or saved.
5. **Tests** —
   - `tests/unit/agent-webhooks/core.test.ts`: the `cannot_verify` case moved
     out of the "anything unexpected" list into its own `it()` asserting four
     cases (bare `cannot_verify`, `cannot_verify` with extra fields, a non-2xx
     status, and `identified` with `verdict: 'cannot_verify'` — all read back
     correctly, the last two still falling to `could_not_identify`).
   - New `tests/unit/supply/DrugCheckFlow.cannot-verify.test.tsx` — mocks
     `checkDrugPhoto` directly (the mock backend has no honest path that
     produces this outcome), asserts the warning-tone content state in both
     `ar` and `en`, that no interaction/could-not-identify title renders, that
     `getAlert` is never called, that no link to `/app/safety/ia-` exists, and
     that "check another photo" returns to the capture screen.
6. **Docs** (`docs/API-SURFACE.md:52`, `docs/SCREENS.md:139`,
   `docs/BACKEND-NOTES.md:49`) — description text only, updated to list
   `cannot_verify` alongside the existing two outcomes. No new seam functions;
   `notes:check` (below) confirms the function counts are unchanged.

**Not touched, on purpose:** `agents/knowledge/**` (the agent-side mapping that
would make a live Travel Check answer actually carry `cannot_verify`),
`lib/data/pg/reads-clinic.ts`, `lib/data/mock-impl.ts`,
`lib/data/refusals/reads-clinic.ts`. See "Owed."

## Proof (pasted, not summarised)

Branch created:
```
$ git switch -c polish/ap-11a-cannot-verify-app origin/main
Switched to a new branch 'polish/ap-11a-cannot-verify-app'
branch 'polish/ap-11a-cannot-verify-app' set up to track 'origin/main'.
$ git log --oneline -1
1a774a7 Merge pull request #8 from Hamad-Almesri-Coded-Bootcamp/polish/ap-02-voice-inside-rule-1
```
(`origin/main`'s tip at fetch time was `1a774a7`, not the `4881ffb` the run
plan named — the plan's claim was stale/inaccurate; branching from the actual
current `origin/main` is the correct action and is what happened.)

Contract + mapping tests:
```
$ npx vitest run tests/unit/agent-webhooks/core.test.ts tests/unit/agent-webhooks/index.test.ts
 Test Files  2 passed (2)
      Tests  26 passed (26)
```

Screen tests (new spec + sibling spec):
```
$ npx vitest run tests/unit/supply/DrugCheckFlow.cannot-verify.test.tsx tests/unit/supply/DrugCheckFlow.test.tsx
 Test Files  2 passed (2)
      Tests  7 passed (7)
```
(First attempt failed on a `vi.mock` hoisting error, then on an ambiguous
`findByText` match because `c3CaptureTitle` and `c3TakePhoto` share the same
English string — fixed by asserting the capture screen's unique photo label
instead, matching the sibling spec's own retry assertion. Green after both
fixes.)

Typecheck:
```
$ npm run typecheck
> tsc --noEmit
(no output — 0 errors)
```

i18n copy-catalogue tests:
```
$ npx vitest run tests/unit/i18n.test.ts tests/unit/i18n
 Test Files  2 passed (2)
      Tests  18 passed (18)
```

Guards:
```
$ npm run guards
✓ guard 2 · no raw hex / px font-size / px radius in ui code
✓ guard 3 · seam: no mock import outside lib/data, no fetch in ui code
✓ guard 4 · G1: no Dose.status write path, no notification action
✓ guard 5 · logical properties only (no left/right)
✓ guard 6 · G3: REFERENCE_NOW drives every time comparison (no Date.now())
✓ guard 7 · no literal user-facing string outside i18n/copy
✓ guard 8 · SQL runs only through lib/db (withSession is the one path)
✓ guard 9 · no secret in the repository or the client bundle
  !! .env.local absent — the value sub-check (d) had NO INPUT — NOT A PASS for (d); (a)-(c) still ran
✓ guard U · strengthMg is displayed as written, never converted
✓ guard P · owed values: 5 missing, 998 placeholder copy entries
✓ guard T · every spacing utility names a step the theme generates
✓ guard S · seed invariants (docs/Seed Dataset.md)
All guards passed.
```
(`.env.local` being absent is a pre-existing condition of this worktree, not
something this change introduced or can fix from inside a no-live-systems box.)

notes:check:
```
$ npm run notes:check
✓ ## 1. The data-access surface … ✓ ## 7. Things Phase 1 found out the hard way
§1 rows for lib/data/api.ts: 50/50
§5 shapes for lib/data/api.ts: 50/50
§1 rows for lib/session/api.ts: 5/5
§5 shapes for lib/session/api.ts: 5/5
```
(Same 50/5 counts as before this change — the doc edits were description text
only, per the plan, so the seam's function count is unchanged.)

eslint (changed files):
```
$ npx eslint types/views.ts lib/agent-webhooks/core.ts features/supply/DrugCheckFlow.tsx i18n/copy/supply.ts tests/unit/supply/DrugCheckFlow.cannot-verify.test.tsx tests/unit/agent-webhooks/core.test.ts
(no output — clean)
```

Pre-commit sanity:
```
$ git diff --stat
 docs/API-SURFACE.md                    |  2 +-
 docs/BACKEND-NOTES.md                  |  2 +-
 docs/SCREENS.md                        |  2 +-
 features/supply/DrugCheckFlow.tsx      | 28 ++++++++++++++++++++++++++--
 i18n/copy/supply.ts                    | 10 ++++++++++
 lib/agent-webhooks/core.ts             | 11 +++++++++--
 tests/unit/agent-webhooks/core.test.ts | 12 +++++++++++-
 types/views.ts                         |  5 ++++-
 8 files changed, 63 insertions(+), 9 deletions(-)

$ git diff | grep -c "not-deployed"
0

$ git status --short styles/tokens.css
(no output — untouched)
```

## Owed

- **The agent-side mapping** (`agents/knowledge/src/travel-check.js`'s
  `appOutcomeFor`, its tests, `agents/knowledge/scripts/check.js`, its README,
  `agents/knowledge/workflows/agent-travel-check.json`, and
  `tests/unit/agent/knowledge-contract.test.ts`) — cut up front for time, not
  attempted, so nothing there needed restoring. Until this lands, a real
  Travel Check answer with `verdict: 'cannot_verify'` still maps to
  `could_not_identify` on the wire, which is safe (fails closed) but means the
  new screen state is currently unreachable outside a test. AP-11 or a
  follow-up owns this.
- **390px screenshots (ar and en)** of the `cannot_verify` state under
  `docs/backend-notes/ap-11a/` — the mock backend has no honest path that
  returns `cannot_verify` (adding one risks flipping the existing C3 e2e
  results, per the plan). Owed by whoever captures them live after the agent
  mapping above ships and the workflow is republished.
- **A new e2e case** for `cannot_verify` in `tests/e2e/supply.spec.ts` — same
  reason, no mock path. Not attempted.
- **Full `npm run verify`** — needs ~12 minutes, does not fit this box. Owed
  by the merge step.
- **`E2E_PORT=3110 npx playwright test tests/e2e/supply.spec.ts`** — not run;
  by the time the gates above finished, well under 9 minutes remained in the
  box, and the plan says to run it only with ≥9 minutes left. Owed by a
  follow-up run.
- **Republishing the n8n workflow** `agent-travel-check` — a live step, and
  moot until the agent-side mapping (above) exists in the JSON anyway.
- **Hallmark audit + UX checklist on C3** — the Skill tool was not invoked in
  this run (time went to the contract, screen and gates instead, which is the
  functional core the box prioritized). Recorded here as **not run (time
  box)**, not fabricated. The change stays inside the existing design system
  (`InlineNotice`, `Button`, `NavigateButton`, no new hex/px), but the formal
  audit and the twelve-point checklist are owed.
- **Final wording approval** for `c3CannotVerifyTitle` / `c3CannotVerifyBody`
  — both carry `placeholder: true` like their neighbours; the copy review is
  owed.

## Deploy-order note

Either merge order is safe: `readDrugCheck` still maps anything it does not
recognise to `could_not_identify` (fails closed), so this PR alone changes
nothing about what a real Travel Check answer produces until the agent-side
mapping (owed, above) also ships and is republished.
