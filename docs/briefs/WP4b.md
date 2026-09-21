# WP4 bundle b — Sign-in, role chooser, first-run setup, profile (A1, A1b, A2, A3 + A0 state tests) · task brief

Issued by the Phase 1 lead after Gate 3. One subagent. Format: `docs/Master Prompt — Phase 1.md` → TASK BRIEF TEMPLATE.

## OBJECTIVE
Build the identity surfaces: A1 sign-in with the simulated Hawiati countdown, A1b role chooser, A2 first-run setup (four steps), A3 patient profile — and the state tests for A0 (which WP3 built; you test it, never edit it).

## READ — in this order, all of it
1. `CLAUDE.md`. 2. `docs/Acceptance Criteria and Test Plan.md` — inventory rows A0, A1, A1b, A2, A3 and their pass criteria; the role model; G2, G7, G9, G10. 3. `docs/SCREENS.md` rows A0–A3 (routes, states, components, data functions — binding). 4. `docs/ROLES.md` — the test list, `SignInOutcome` handling, what is not a role. 5. `docs/Seed Dataset.md` — the cast table (twelve Civil IDs in the test list per CR-025; بدر `268110500413` is the `onboardingCompleted:false` patient; `277091900873` has **no account**). 6. `docs/UX Principles.md` — checklist, §2 (flows show steps), §5, §8. 7. `docs/DECISIONS.md` — CR-001 (**no Civil ID printed, ever** — A3's identity line is "signed in with Hawiati (simulated)"), CR-004, CR-005, CR-025, D-005, D-008 (`useSearchParams` always under Suspense). 8. Boards: `Login`, `SignInStates` (4 panels), `RoleChooser`, `SessionGate`, `Setup`, `Profile` (+ wireframes `README.md` first). 9. `components/ui/README/{TextField,Button,Card,Countdown,InlineNotice,StepIndicator,ChoiceGroup,DetailRow,MenuRow,Toggle,Sheet}.md`. 10. Existing code: `lib/session` (all five functions), `lib/data` (`getPatient`, `updatePatientPhone`, `completeOnboarding`, `getSettings`, `updateSettings`, `getPushState`, `getPushCapability`, `requestPushPermission`, `getMessagingLink`, `startMessagingLink`, `getCaregivers`), `lib/config.ts` (`HAWIATI_COUNTDOWN_SECONDS`), `features/shell/` (`SignOutButton`, `LanguageSwitch`, `gate.ts` — import only), `app/[locale]/signin/layout.tsx` (WP3's, do not edit), `tests/e2e/helpers/session.ts`.

## FILES YOU OWN
`app/[locale]/signin/page.tsx` · `app/[locale]/signin/choose/page.tsx` · `app/[locale]/app/setup/page.tsx` · `app/[locale]/app/more/profile/page.tsx` (all currently placeholders) · `features/identity/**` · `i18n/copy/identity.ts` (stub exists; fill it) · `docs/backend-notes/wp4b.md` · `tests/e2e/identity.spec.ts` · `tests/unit/identity/**`.

## FILES YOU MUST NOT TOUCH
`app/[locale]/gate/**` (A0 is WP3's — you write tests against it, and report any gap) · the signin/invitation/shell **layouts** · `components/ui/**` · `features/shell/**`, `features/landing/**`, `features/day/**`, `features/caregiving/**` (import only) · `lib/**`, `types/**` · `i18n/**` except `copy/identity.ts` · `scripts/**` · existing tests · other bundles' routes · `docs/**` except your fragment.

## DEPENDENCIES
The session module is complete — the countdown is UI only (`HAWIATI_COUNTDOWN_SECONDS` from config; `signIn` resolves after it). `SignOutButton` from `features/shell` is the sign-out control. WP3 already hides the TabBar on `/app/setup` and shows it on `/app/more/profile`; no shell change is needed. **Cross-bundle contract:** A2's optional invite step reuses bundle h's `InviteSheet` exported from `features/caregiving` — import it; if it has not landed when you get there, render the step's frame with a quiet placeholder Card, mark it in your report, and the lead wires it at the gate. A2's notification offer calls the E5 data functions directly (three equal options: browser → `requestPushPermission`; chat → `startMessagingLink`; later → nothing).

## WHAT TO BUILD (per SCREENS.md, which wins over this summary)
- **A1**: Civil ID entry (`TextField` dir=ltr numeric), the seven states in the row. The **`no_claims` wording is identical whether or not the ID has an account** (rule 6 — test `298052000731`-style no-role IDs and `277091900873` produce byte-identical messages; never reveal account existence). Countdown with visible seconds and cancel; lapsed offers retry keeping the input. Approved routes by `SignInOutcome`: single role → its shell home (or `/gate`), multiple → A1b, pending-only → F0. Invalid ID: specific error, input kept.
- **A1b**: only for two **active** roles; two equal Cards (own medicines / "<first name>'s medicines" + relationship from `RoleOption`); remembers the last choice (`chooseRole` handles persistence — read its behaviour); a pending invitation renders as a quiet notice, never a role card.
- **A2**: four steps with `StepIndicator` — language (required, `ChoiceGroup`, persists via `updateSettings`) → notification offer (three equal Cards; declining is normal) → optional caregiver invite (see contract above) → closing explainer. Abandoning returns to the same step (persist step in the URL or session-neutral state — no new storage mechanism). Completing calls `completeOnboarding` then lands on `/app`. Declining everything lands on B1 with no warning. Reached by بدر.
- **A3**: name · identity line per CR-001 (no Civil ID) · browser-notification and chat status lines, both neutral (G10), each a `MenuRow` linking to `/app/more/notifications` · optional contact phone (`TextField` + `updatePatientPhone`) · language display-only · caregiver count linking to `/app/more/caregivers` · **sign out** via the shared `SignOutButton` (secondary tone).
- **A0 tests**: in `tests/e2e/identity.spec.ts`, assert every A0 routing state in the SCREENS row (none → signin; pending-only → invitation; بدر → `/app/setup`; patient → `/app`; caregiver → `/care`; reviewer → `/clinic/review`; admin → `/clinic/audit`) and that the gate renders a skeleton, never blank.

## ACCEPTANCE
Every state in the four SCREENS rows demonstrated in Playwright at 390/834/1440 × ar/en, axe clean, no overflow · the `no_claims` identical-wording assertion is an explicit test · signing in as ناصر never grants anything beyond `/invitation` (A0 test) · guards clean · twelve-point checklist per screen.

## INVARIANTS — G1, G10, G12, G9 first, then all twelve verbatim
G9/rule 6: **no Civil ID printed back, masked or whole; never reveal whether an ID has an account**. G10: not-connected/denied states neutral, never errors. Rule 5: signing in is never acceptance — nothing in A1/A1b touches an invitation's status.

## PROHIBITIONS
The template's full list: no new dependency · no contract change · no new shared component · no invented seed value (the test list is the seed's twelve IDs, CR-025) · no hard-coded colour/size/copy · no `Date.now()` (the countdown uses config + timers, not clock reads) · no fetch/mock import · no edit outside your files · no bare `useSearchParams` (D-008).

## NOTES TO RECORD — `docs/backend-notes/wp4b.md`
§2: the client-side countdown standing in for Hawiati; where the "remembered role choice" lives in the mock. §3: the backend must never reveal account existence on lookup (the proving call: `signIn` with an accountless vs a no-role ID must be indistinguishable in shape, wording and timing). §4: fields A1–A3 depend on. §7: anything awkward.

## REPORT BACK
File list · per-screen state table · command outputs verbatim (`npm run typecheck`, `lint`, `guards`, `test`, `npx playwright test tests/e2e/identity.spec.ts --workers=1`) · twelve-point checklist per screen · assumptions · gaps · any needed-change request. Nothing committed.
