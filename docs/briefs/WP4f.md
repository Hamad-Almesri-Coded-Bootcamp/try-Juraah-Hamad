# WP4 bundle f — Drug check + refill (C3, D1) · task brief

Issued by the Phase 1 lead for wave 3 (after wave 2 passed its gates). One subagent. Format: `docs/Master Prompt — Phase 1.md` → TASK BRIEF TEMPLATE.

## OBJECTIVE
Build C3 (the travel/photo drug check with an honest could-not-identify state) and D1 (the refill request whose routing destination is always the prescription's own sector and whose estimate exists only with dispensing data).

## READ — in this order, all of it
1. `CLAUDE.md`. 2. `docs/Acceptance Criteria and Test Plan.md` — inventory rows C3, D1 with pass criteria; G7, G9, G10. 3. `docs/SCREENS.md` rows C3, D1 (binding: routes, states, components, data functions). 4. `docs/Seed Dataset.md` — which prescriptions carry `dispensing` (and so an estimate) and which do not; the two seeded `RefillRequest` rows (`rx-003` requested, `rx-001` approved); each prescription's `source.sector` (the routing rule: `routedTo` must match it); `REFERENCE_NOW`. **Never invent a value.** 5. `docs/DECISIONS.md` — CR-014 board deviations, D-008. 6. `docs/UX Principles.md` — checklist, §3, §5 (analysing states say what is happening and roughly how long), §7. 7. Boards: `DrugCheck`, `Refill` (+ wireframes `README.md` first). 8. `components/ui/README/{PhotoInput,LoadingState,Card,InteractionAlert,ErrorState,Button,DepletionMeter,SectorChip,Sheet,InlineNotice,MenuRow,AppBar}.md`. 9. Existing code: `lib/data` (`checkDrugPhoto`, `getRefillOverview`, `requestRefill`, `getRefillRequests`), `lib/data/mock/fixtures.ts` (how tests select the mock's outcomes through the published API — at least one test image must produce `could_not_identify`), `features/safety/` (bundle e's C2 — your identified-interaction result hands off to its route; read how it renders severity so your result Card is consistent; import only), `features/shell/LastKnown.tsx`, `tests/e2e/helpers/session.ts`.

## FILES YOU OWN
`app/[locale]/app/safety/check/page.tsx` · `app/[locale]/app/more/refill/page.tsx` (both currently placeholders) · `features/supply/**` · `i18n/copy/supply.ts` (stub exists; fill it) · `docs/backend-notes/wp4f.md` · `tests/e2e/supply.spec.ts` · `tests/unit/supply/**`.

## FILES YOU MUST NOT TOUCH
`components/ui/**` · every layout · every other `features/*` (import only) · `lib/**`, `types/**` · `i18n/**` except `copy/supply.ts` · `scripts/**` · existing tests · other bundles' routes · `docs/**` except your fragment.

## DEPENDENCIES
C1 (bundle e) already links to your check route; B3 (bundle d) links to your refill route with `?rx=` naming the prescription it came from — read that param (server page `searchParams` props, or under Suspense per D-008) to scroll/highlight that line; absent means the plain list. The shell (WP3) hides the TabBar on the pushed check screen and shows it on `/app/more/refill`.

## WHAT TO BUILD (per SCREENS.md, which wins over this summary)
- **C3**: idle (`PhotoInput`) · analysing (`LoadingState`, what is happening and roughly how long) · result: the drug named with the verdict **screened against the patient's full active profile** (whatever `checkDrugPhoto` returns — the screen adds no screening logic of its own); an identified interaction renders the result summary and **hands off to C2's route** for the alert itself, never re-implementing C2 · **could-not-identify**: an explicit, honest state (ErrorState tone per the board; retry + way back; never a guessed drug). Every outcome comes from `checkDrugPhoto`; the fixture switch selects outcomes in tests.
- **D1**: per active rx a Card: remaining of total, the depletion estimate **only when the line has one** (`daysRemaining !== null` — no dispensing → no estimate, no invented number), `SectorChip`, request Button · request → `Sheet` confirm **naming the routing destination derived from that rx's own `source.sector`** (public → public pharmacy, private → private pharmacy, in your catalogue's words) · after `requestRefill`: the same list with that line now "requested" + destination and an `InlineNotice`; the request Button gone for it (absent, not disabled) · **my requests** section: the `RefillRequest` rows (seeded two + any created) with status via `MenuRow` · already-requested seeded line (`rx-003`) renders as requested from first load. Wrap the list in `LastKnown`.

## ACCEPTANCE
Every state in the two SCREENS rows demonstrated in Playwright at 390/834/1440 × ar/en, axe clean, no overflow · could-not-identify produced by a fixture-selected image in an explicit test, and no record/alert is created by it · the confirm Sheet names the destination equal to the rx's `source.sector` for one public and one private rx (explicit test) · no estimate rendered for a `daysRemaining: null` line (explicit test) · after requesting, `getRefillRequests` gains the row and the audit log gains its event (through the published API) · guards clean · twelve-point checklist per screen.

## INVARIANTS — G1, G10, G12, G9 first, then all twelve verbatim
G1: nothing here touches a dose status — a refill request is a supply write, never clinical adherence. G9: no request id or token on screen; statuses as human labels. Rule 9: `daysRemaining` comes from the data layer, never computed in the screen.

## PROHIBITIONS
The template's full list: no new dependency · no contract change · no new shared component · no invented seed value · no hard-coded colour/size/copy · no `Date.now()` · no arithmetic on `strengthMg` · no fetch/mock import · no edit outside your files · no bare `useSearchParams` (D-008).

## NOTES TO RECORD — `docs/backend-notes/wp4f.md`
§2: `checkDrugPhoto` outcomes are canned; what the real pipeline must return; the routing rule computed in the mock. §3: the backend must refuse `requestRefill` for a prescription the session's patient does not own, for an inactive rx, and must derive `routedTo` server-side from the rx's sector, ignoring anything the client sends (proving calls). §4: fields C3/D1 blank without. §7: anything awkward.

## REPORT BACK
File list · per-screen state table · command outputs verbatim (`npm run typecheck`, `lint`, `guards`, `test`, `npx playwright test tests/e2e/supply.spec.ts --workers=1`) · twelve-point checklist per screen · assumptions · gaps. Nothing committed.
