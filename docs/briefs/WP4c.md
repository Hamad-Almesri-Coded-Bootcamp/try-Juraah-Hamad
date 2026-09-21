# WP4 bundle c — Today + My Medicines (B1, B2) · task brief

Issued by the Phase 1 lead after Gate 3. One subagent. The demo-critical bundle: B1 is the product's proof that **nothing in the interface records a dose**. Format: `docs/Master Prompt — Phase 1.md` → TASK BRIEF TEMPLATE.

## OBJECTIVE
Build B1 (Dose Schedule — Today, the patient home, with `?day=` navigation) and B2 (My Medicines with the danger alert always on top), tracking-off first, and turn the standing red test `tests/e2e/g1-today-tracking-off.spec.ts` green without touching it.

## READ — in this order, all of it
1. `CLAUDE.md` — rules 1, 3, 4, 9 are this bundle's whole job. 2. `docs/Acceptance Criteria and Test Plan.md` — inventory rows B1, B2 with pass criteria; G1, G3, G7, G10 verbatim. 3. `docs/SCREENS.md` rows B1, B2 (binding: routes, states, components, data functions). 4. `docs/Seed Dataset.md` — حمد's six doses (08:00 ×2 · 14:00 · 18:00 · 20:00 ×2), `tracked:false` throughout; سارة's tracked days 19–21 Sept with `taken_on_time`/`taken_late`/`missed`; فاطمة's empty 2026-09-21; rx-002 ends 2026-09-25 (the duration boundary); `REFERENCE_NOW`. **Never invent a value.** 5. `docs/DECISIONS.md` CR-014 — the board deviations for `Main`, `TodayMissed`, `Medicines`, `MedicinesDesktop` (invented Amoxicillin, wrong times, pills on untracked doses): **the seed wins; tracked/missed states render from سارة, empty from فاطمة**. 6. `docs/UX Principles.md` — checklist, §1, §3, §7 (44px), §9 (tracking-off read). 7. Boards: `TodayPlan` (the default, tracking off), `Main`, `TodayMissed`, `Today834`, `TodayLTR`, `States`, `Medicines`, `MedicinesPast`, `MedicinesDesktop` (+ wireframes `README.md` first). 8. `components/ui/README/{DoseRow,ScheduleGroup,StatusPill,PrescriptionCard,InteractionAlert,SectorChip,InlineNotice,EmptyState,IconButton,Card,Button}.md` — DoseRow's `tracked` prop and its no-status variant above all. 9. Existing code: `lib/data` (`getDosesForDay`, `getPendingInvitationsForSubject`, `getSettings`, `getPrescriptions`, `getAlerts`), `lib/schedule` (read-only), `features/shell/LastKnown.tsx` (the failed-refresh wrapper — use it), `i18n/copy/vocabulary.ts` (the four dose-status words live there — reuse, never redefine), `tests/e2e/g1-today-tracking-off.spec.ts` and `tests/e2e/helpers/session.ts` (read; never edit).

## FILES YOU OWN
`app/[locale]/app/page.tsx` · `app/[locale]/app/medicines/page.tsx` (both currently placeholders) · `features/day/**` · `i18n/copy/day.ts` (stub exists; fill it) · `docs/backend-notes/wp4c.md` · `tests/e2e/day.spec.ts` · `tests/unit/day/**`.

## FILES YOU MUST NOT TOUCH
`components/ui/**` (a DoseRow/PrescriptionCard gap is reported, never patched inline) · `features/shell/**` and every other `features/*` (import only) · `lib/**`, `types/**` · `i18n/**` except `copy/day.ts` · `scripts/**` · `tests/e2e/g1-today-tracking-off.spec.ts` and all existing tests · other bundles' routes · `docs/**` except your fragment.

## DEPENDENCIES
The patient shell layout (WP3) already wraps your routes with the TabBar. `DoseRow` (WP2) already keys its pill on `tracked` and carries `data-testid="dose-row"`/`"status-pill"`. **Hooks the standing test needs from you:** `data-testid="dose-list"` on B1's list root. **Cross-bundle contract (bundle h consumes these):** export from `features/day` two presentational, props-driven components — `DoseDayList` (the day's grouped dose list: takes the fetched doses, `tracked`, locale, an optional href-builder for row links, `readOnly`) and `MedicinesList` (the B2 card list incl. alert placement: takes prescriptions, alerts, next-dose info, locale, href-builder, `readOnly`) — fetching stays in your page components, never in these two. Document their exact props in `features/day/README.md` (inside your folder). With `readOnly` (caregiver use) they render **zero interactive elements beyond row links**, and with a null href-builder no links at all.

## WHAT TO BUILD (per SCREENS.md, which wins over this summary)
- **B1**: date shown prominently; day navigation both ways (mirrored chevron `IconButton`s) + return to today; `?day=YYYY-MM-DD`, absent = the day of `REFERENCE_NOW`. **Tracking off (حمد, the default)**: no pills, no controls, one plain line offering to turn tracking on → a quiet Button linking to `/app/more/settings` — that button lives OUTSIDE the `data-testid="dose-list"` root, which must contain zero `<button>`, `<input>`, `onClick`, `role="button"`. Tracked day (سارة): mixed statuses via StatusPill inside DoseRow; a missed dose renders from her 20 Sept data. Future day; empty day (فاطمة, reassuring EmptyState); duration boundary visible one day forward (rx-002 ends 2026-09-25); pending-invitation quiet line → `/invitation` (never a modal); row tap → `/app/medicines/[id]` and nothing else. Wrap the list in `LastKnown` for the failed-refresh state.
- **B2**: danger alert on top, most prominent, full-width even in the 834 two-pane; multiple alerts lead with the most severe and link the rest; PrescriptionCard shows dose status **only when tracked**, next-dose time otherwise; SectorChip per card; **past** group (`completed`, and `discontinued` with reason + date, no refill action); empty state offers add/scan → `/app/medicines/add`; card tap → B3's route.
- Remember rule 3: the pill's absence keys off `Dose.tracked`, never the status word — your unit test renders `{tracked:false, status:'upcoming'}` through your composition and asserts no pill.

## ACCEPTANCE
`npx playwright test tests/e2e/g1-today-tracking-off.spec.ts --workers=1` **green, unedited** · every state in the two SCREENS rows demonstrated in `tests/e2e/day.spec.ts` at 390/834/1440 × ar/en (TodayLTR proves direction), axe clean, no overflow · the `{tracked:false, status:'upcoming'}` no-pill unit test · حمد's view of 2026-09-21 shows exactly his six seed doses at the seed times · guards clean · twelve-point checklist per screen.

## INVARIANTS — G1, G10, G12, G9 first, then all twelve verbatim
**G1: no button, checkbox, swipe, long-press, context menu or any control that could create or change a dose status — anywhere in this bundle.** G3/rule 9: every time comparison via `REFERENCE_NOW` through the data layer. Rule 3 as above. Rule 4: nothing renders or computes `missed` from silence — statuses come only from the data layer.

## PROHIBITIONS
The template's full list: no new dependency · no contract change · no new shared component · no invented seed value · no hard-coded colour/size/copy · no `Date.now()` · no status inferred from the clock · no fetch/mock import · no edit outside your files · no bare `useSearchParams` (D-008 — B1's `?day=` reading included).

## NOTES TO RECORD — `docs/backend-notes/wp4c.md`
§3: G1 as an absence on B1/B2 and the server-side refusal that must replace it. §4: fields B1/B2 blank without. §7: anything awkward (the `?day=` boundary rules, the duration-boundary derivation).

## REPORT BACK
File list · per-screen state table · the exported `DoseDayList`/`MedicinesList` prop signatures · command outputs verbatim (`npm run typecheck`, `lint`, `guards`, `test`, `npx playwright test tests/e2e/day.spec.ts tests/e2e/g1-today-tracking-off.spec.ts --workers=1`) · twelve-point checklist per screen · assumptions · gaps. Nothing committed.
