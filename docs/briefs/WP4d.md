# WP4 bundle d — Prescription detail + add/scan (B3, B4) · task brief

Issued by the Phase 1 lead for wave 2 (after wave 1 passed its gates). One subagent. Format: `docs/Master Prompt — Phase 1.md` → TASK BRIEF TEMPLATE.

## OBJECTIVE
Build B3 (prescription detail with the read-only dose-history timeline and the depletion estimate that exists only with dispensing data) and B4 (add/scan with the honest could-not-read state and no hand-typing of prescriber-owned clinical fields).

## READ — in this order, all of it
1. `CLAUDE.md` — rules 1, 3, 9 apply throughout. 2. `docs/Acceptance Criteria and Test Plan.md` — inventory rows B3, B4 with pass criteria; G1, G3, G7. 3. `docs/SCREENS.md` rows B3, B4 (binding: routes, states, components, data functions). 4. `docs/Seed Dataset.md` — the nine prescriptions: which carry `dispensing` and which do not; `rx-006` (handwritten, `needsReview`, core fields only), `rx-007` (returned), `rx-004` (discontinued), `rx-008` (`strengthUnit: "mcg"`, displayed as written, never converted — guard U); سارة's statuses for the with-status timeline, حمد's `tracked:false` for the without. **Never invent a value.** 5. `docs/DECISIONS.md` — CR-002 (the five conditionally-optional fields and what a core-fields-only record renders), CR-003 (strength unit), CR-014 (`Medicines`/`Prescription` board deviations; seed wins), D-008. 6. `docs/UX Principles.md` — checklist, §3 (no dead end), §5 (analysing states say what is happening and roughly how long), §7. 7. Boards: `Prescription`, `AddPrescription` (+ wireframes `README.md` first). 8. `components/ui/README/{DetailRow,SectorChip,DoseTimeline,DepletionMeter,InlineNotice,Button,PhotoInput,LoadingState,ErrorState,AppBar}.md`. 9. Existing code: `lib/data` (`getPrescription`, `getDoseHistory`, `getSettings`, `getRefillOverview`, `submitPrescriptionImage`, `savePrescriptionDraft`), `features/day/` (how bundle c renders cards and links to you — import, never edit), `features/caregiving/` (bundle h's read-only prescription detail in F3 — **read it for parity**: your B3 must render the same content plus the patient's actions; note in your report anywhere the two drift, the lead reconciles), `features/shell/LastKnown.tsx`, `tests/e2e/helpers/session.ts`.

## FILES YOU OWN
`app/[locale]/app/medicines/[prescriptionId]/page.tsx` · `app/[locale]/app/medicines/add/page.tsx` (both currently placeholders) · `features/prescription/**` · `i18n/copy/prescription.ts` (stub exists; fill it) · `docs/backend-notes/wp4d.md` · `tests/e2e/prescription.spec.ts` · `tests/unit/prescription/**`.

## FILES YOU MUST NOT TOUCH
`components/ui/**` · every layout · `features/shell/**`, `features/day/**`, `features/caregiving/**`, `features/identity/**`, `features/landing/**` (import only) · `lib/**`, `types/**` · `i18n/**` except `copy/prescription.ts` · `scripts/**` · existing tests · other bundles' routes · `docs/**` except your fragment.

## DEPENDENCIES
The patient shell layout (WP3) already hides the TabBar on your two pushed routes. Bundle c's B2 links to your `[prescriptionId]` route and its empty state links to your add route — the routes are fixed, nothing to coordinate. B3's refill Button links to `/app/more/refill` (bundle f, wave 3 — a placeholder page exists; link to it, do not build it).

## WHAT TO BUILD (per SCREENS.md, which wins over this summary)
- **B3**: every contract field including dispensing, via `DetailRow`s; `SectorChip`; read-only `DoseTimeline` — with statuses for a tracked patient, without for an untracked one plus one plain line why (keyed on `tracked`/settings, never on the status word — rule 3); `needsReview` record → plain line that fields await confirmation; a core-fields-only record (`rx-006`) renders with **no "undefined", no empty-value artifact** (the empty mark `DetailRow` defines); no `dispensing` → **no `DepletionMeter`, no estimate, no invented number**; refill Button (secondary) linking to D1's route with this rx in context (`?rx=` — read it in D1's own bundle later; you only link). Back via `AppBar`.
- **B4**: idle (PhotoInput) · analysing (LoadingState saying what is happening and roughly how long) · `confident` → read-only review-and-confirm (`DetailRow`s, a confirm Button calling `savePrescriptionDraft`) · `needs_review` → the uncertain fields visibly marked, same confirm path, the saved record flagged · `unreadable` → explicit could-not-read state (ErrorState; retry and a way back; **never a fabricated record**) · saved → back to `/app/medicines` with the record listed. **No text input for any prescriber-owned clinical field anywhere** — the review step is read-only confirmation. `submitPrescriptionImage`'s mock decides the outcome; the fixture switch inside the mock produces each outcome deterministically (read `lib/data/mock/fixtures.ts` for how tests select outcomes — through the published API only).
- G7 (content/loading/empty/error) on both screens; wrap B3's data read in `LastKnown` for the failed-refresh state.

## ACCEPTANCE
Every state in the two SCREENS rows demonstrated in Playwright at 390/834/1440 × ar/en, axe clean, no overflow · `rx-006` renders with no "undefined"/missing-value artifact (explicit test) · no depletion estimate on a no-dispensing rx (explicit test) · `rx-008` shows "50 mcg" exactly as seeded, no conversion (explicit test) · the timeline carries no pill for حمد and pills for سارة, keyed on `tracked` (unit test through your composition) · B4's unreadable path produces no record (assert the medicines list is unchanged) · guards clean · twelve-point checklist per screen.

## INVARIANTS — G1, G10, G12, G9 first, then all twelve verbatim
G1: the timeline and every control here is read-only with respect to dose status — nothing on B3/B4 can create or change one. Rule 3 as above. Rule 9: any "days remaining" figure comes from the data layer's computation against `REFERENCE_NOW`, never computed in the screen.

## PROHIBITIONS
The template's full list: no new dependency · no contract change · no new shared component · no invented seed value · no hard-coded colour/size/copy · no `Date.now()` · no arithmetic on `strengthMg` (guard U) · no fetch/mock import · no hand-typed clinical field · no edit outside your files · no bare `useSearchParams` (D-008).

## NOTES TO RECORD — `docs/backend-notes/wp4d.md`
§2: the extraction outcomes are canned in the mock; what the real pipeline must return per outcome. §3: the backend must refuse `savePrescriptionDraft` for a draft the session's patient does not own (proving call). §4: fields B3/B4 blank without (feed §4's CR-002 rows with what you actually hit). §7: anything awkward.

## REPORT BACK
File list · per-screen state table · B3/F3 parity notes (any drift found against `features/caregiving`'s read-only detail) · command outputs verbatim (`npm run typecheck`, `lint`, `guards`, `test`, `npx playwright test tests/e2e/prescription.spec.ts --workers=1`) · twelve-point checklist per screen · assumptions · gaps. Nothing committed.
