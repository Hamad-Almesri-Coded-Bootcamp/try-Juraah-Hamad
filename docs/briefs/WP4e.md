# WP4 bundle e — Safety list + alert detail (C1, C2) · task brief

Issued by the Phase 1 lead for wave 2 (after wave 1 passed its gates). One subagent. Format: `docs/Master Prompt — Phase 1.md` → TASK BRIEF TEMPLATE.

## OBJECTIVE
Build C1 (the safety alerts list) and C2 (the interaction alert detail whose pending state never reads as final and whose citation is honest about being unverified).

## READ — in this order, all of it
1. `CLAUDE.md`. 2. `docs/Acceptance Criteria and Test Plan.md` — inventory rows C1, C2 with pass criteria; **§8's three-part safety copy rule in full** (what happened · what it means · what to do — and a pending alert never reads as a final verdict); G7, G9, G10. 3. `docs/SCREENS.md` rows C1, C2 (binding). 4. `docs/Seed Dataset.md` — the three alerts: `ia-001` (`pending_medical_review`, `sourceCitation` `[TO BE SUPPLIED]`), `ia-002` (`reviewed`, decision + note + reviewedBy per CR-028's label rule), `ia-003` (`auto_cleared`); which prescriptions each involves. **Never invent a value — above all no invented citation text.** 5. `docs/DECISIONS.md` — CR-028 (reviewedBy renders as a human label, never an id or Civil ID), CR-012/CR-014 board deviations, D-008. 6. `docs/UX Principles.md` — checklist, §8, §6 (severity never by colour alone). 7. Boards: `Safety`, `AlertDanger`, `AlertReviewed`, `States` (+ wireframes `README.md` first). 8. `components/ui/README/{AlertRow,InteractionAlert,Card,DetailRow,PrescriptionCard,EmptyState,Button,AppBar}.md`. 9. Existing code: `lib/data` (`getAlerts`, `getAlert`, `getPrescription`), `features/day/MedicinesList` (how B2 placed the alert — for visual consistency, import nothing you don't need), `features/caregiving/` (bundle h's read-only alert detail in F3 — **read it for parity**: your C2 is the patient's view of the same content; note drift, the lead reconciles), `features/shell/LastKnown.tsx`, `tests/e2e/helpers/session.ts`.

## FILES YOU OWN
`app/[locale]/app/safety/page.tsx` · `app/[locale]/app/safety/[alertId]/page.tsx` (both currently placeholders; **not** `safety/check/page.tsx` — C3 is bundle f's, wave 3) · `features/safety/**` · `i18n/copy/safety.ts` (stub exists; fill it) · `docs/backend-notes/wp4e.md` · `tests/e2e/safety.spec.ts` · `tests/unit/safety/**`.

## FILES YOU MUST NOT TOUCH
`components/ui/**` · every layout · every other `features/*` (import only) · `lib/**`, `types/**` · `i18n/**` except `copy/safety.ts` (the three review-state words live in `i18n/copy/vocabulary.ts` — reuse, never redefine) · `scripts/**` · existing tests · other bundles' routes · `docs/**` except your fragment.

## DEPENDENCIES
The patient shell layout (WP3) shows the TabBar on `/app/safety` (Safety tab) and hides it on your pushed detail. B2 (bundle c) links its alert banner to your `[alertId]` route. C1's drug-check entry links to `/app/safety/check` (bundle f's placeholder — link, do not build).

## WHAT TO BUILD (per SCREENS.md, which wins over this summary)
- **C1**: alerts most severe first, most recent within severity; `reviewed` and `auto_cleared` history included, visually quieter but present; `AlertRow` severity read never by colour alone; none → reassuring EmptyState, not alarming; a Button entry to C3's route. Wrap in `LastKnown`.
- **C2**: `pending_medical_review` → §8's three parts, explicit "a clinical reviewer will look at this" framing, **no OK/dismiss/acknowledge control of any kind** — reading it changes nothing (assert: `getAlert` is a read; the mock call log shows no write); `reviewed` → the decision, the reviewer's note, who (human label per CR-028); `auto_cleared` → what that means; `sourceCitation` **verbatim**; an empty/`[TO BE SUPPLIED]` citation renders the explicit "unverified/to be supplied" line from your catalogue, never invented text; involved prescriptions as read-only `PrescriptionCard`s linking to B3. Opening never changes state.

## ACCEPTANCE
Every state in the two SCREENS rows demonstrated in Playwright at 390/834/1440 × ar/en, axe clean, no overflow · pending-never-final: an explicit test that C2 for `ia-001` contains no dismiss/OK/resolve control and the three-part structure is present · citation honesty: `ia-001` renders the unverified line, `ia-002`/`ia-003` render their seeded citations verbatim (explicit test) · opening `ia-001` writes nothing (mock call log assertion) · severity ordering on C1 (test) · guards clean · twelve-point checklist per screen.

## INVARIANTS — G1, G10, G12, G9 first, then all twelve verbatim
G1: nothing here writes anything — this bundle is entirely reads. G9: no alert id rendered as content (route params are not content); reviewedBy as a human label. G10: history states neutral.

## PROHIBITIONS
The template's full list: no new dependency · no contract change · no new shared component · no invented seed value or citation · no hard-coded colour/size/copy · no `Date.now()` · no fetch/mock import · no edit outside your files · no bare `useSearchParams` (D-008).

## NOTES TO RECORD — `docs/backend-notes/wp4e.md`
§3: reading an alert must never transition its state server-side (proving call: GET the alert twice, state identical; and no audit event of a review type from a patient session). §4: fields C1/C2 blank without. §7: anything awkward (the `[TO BE SUPPLIED]` citation handling above all).

## REPORT BACK
File list · per-screen state table · C2/F3 parity notes against `features/caregiving`'s read-only alert detail · command outputs verbatim (`npm run typecheck`, `lint`, `guards`, `test`, `npx playwright test tests/e2e/safety.spec.ts --workers=1`) · twelve-point checklist per screen · assumptions · gaps. Nothing committed.
