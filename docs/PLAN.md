# Jur'ah (جرعة) — Phase 1 Plan

**Status (2026-09-21):** Gates 0–3 approved by the owner. WP0–WP3 complete. **WP4 wave 1 (a, b, c, h) passed its gate**: `npm run verify` exit 0 · all e2e suites green run serially by the lead (day+G1 113 · caregiving 69 · identity 70 · landing 51 · roles/shells/smoke/gallery 99) · **the G1 runtime-proof spec green at all three viewports, unedited** · CR-019 mockup swapped for the real B1 export · fragments merged (`scripts/merge-notes.ts`, idempotent) · CR-029–CR-034 logged. **Wave 2 (d, e, i) passed its gate** (2026-09-22): `verify` exit 0; every suite audited against its `--list` total — clinic 81/81 · prescription 96/96 · safety 114/114 · caregiving 69/69 · day+G1 117/117 · identity+landing 126/126 · roles/shells/smoke/gallery 99/99; the F3 parity fixes landed (reviewed-state block, doseTimes, citation honesty, involved prescriptions); CR-035 fixed; CR-036/037/038 implemented at the seam and `RESOLVED`; CR-039 logged `DEFAULT` for the owner. **Wave 3 (f, g) passed its gate and WPfinal is complete** (2026-09-22): all 30 screens + 3 system pages built; `verify` exit 0; 472 unit tests; 897 e2e tests across nine suites, each audited against its `--list` total, 0 failures; the fourteen verification items and the spec's handoff checklist walked with evidence in `docs/VERIFICATION.md`; `BACKEND-NOTES.md` complete (all nine fragments merged, §5 shapes regenerated). Owner still owes: bilingual copy deck, three `sourceCitation`s, real bot handle, CR-006 caregiver row values, demo script; open CRs listed at the end of `docs/VERIFICATION.md`. Originally: Phase 0 deliverable, no implementation until Gate 0 approval. Companion files written in the same pass: `SCREENS.md` (the completeness contract), `ROLES.md`, `DECISIONS.md` (change requests and architecture decisions). The visual references are in the repository: `docs/design-system/` (brand book, `navigation.md`, `tokens.json`, `index.d.ts`, `bundle.css`, twenty component guides) and `docs/wireframes/` (48 boards + README); they are byte-identical to the published artifacts (owner-verified at Gate 0; see §9). Nothing here restates the spec; it says how the spec gets built.

## 1. Shape of the build

- **Lead** (this session): plans, briefs, reviews every diff, runs every verification command itself, integrates, writes `PLAN.md`, `SCREENS.md`, `ROLES.md`, `DECISIONS.md`, merges `BACKEND-NOTES.md`. Writes code only for WP0, integration conflicts, and sub-ten-line review fixes.
- **Sonnet subagents**: one per work package or bundle, each with the task-brief template from the Master Prompt, each owning an exclusive set of paths.
- **Gates**: the owner reviews at Gate 0 (this plan), Gate 1 (contracts + seed), Gate 2 (components page), Gate 3 (shells + reachability), then one gate per screen bundle, then the final verification report.

**Stack (decided by the Master Prompt, detailed here):** Next.js 15 App Router · React 19 · TypeScript strict · Tailwind CSS v4 with the theme bound to the compiled token custom properties (D-001) · IBM Plex Sans Arabic + IBM Plex Sans (400/600) loaded from the same Google Fonts `css2` request the boards use, as `docs/design-system/README.md` prescribes, so the family name in `--font-sans` stays exact · a hand-written i18n module (no library) · no state library · a PWA manifest and a service-worker shell that subscribes to nothing.

**Dependencies the scaffold adds (approval requested now, so "no new dependency without asking" is satisfied for the whole build):**

| Purpose | Package(s) |
|---|---|
| Framework | `next` 16.3.5, `react` / `react-dom` 19.3.0, `typescript` 5.9.3 (TypeScript 7 is out but Next 16 is validated against 5.x), `@types/*`. `tsconfig.json` is left exactly as `next build` rewrote it on first run (`jsx: react-jsx`, `.next/dev/types/**/*.ts` in `include`) — accepted by the owner at Gate 0b; do not hand-edit it back |
| Styling | `tailwindcss`, `@tailwindcss/postcss` |
| Lint | `eslint` **9.39.5** (not 10: `eslint-plugin-react` 7.37 does not yet declare ESLint 10 as a peer), `eslint-config-next` 16.3.5, `eslint-plugin-react` 7.37.5 (for `react/jsx-no-literals`, the copy-catalogue guard) |
| Unit tests | `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` |
| Screen matrix + a11y | `@playwright/test`, `@axe-core/playwright` |
| Scripts | `tsx` (guard scripts and the token compiler) |

Nothing else. Subagents may not add a package.

**Runtime proof of G1 (owner, Gate 0b).** `tests/e2e/g1-today-tracking-off.spec.ts` signs in as حمد via `tests/e2e/helpers/session.ts` and asserts the B1 dose list has zero `<button>`, `<input>`, `onClick`, `role="button"` and zero status pills. Bundle c builds B1 to these hooks: `data-testid="dose-list"` on the list root; WP2 group b puts `data-testid="dose-row"` on `DoseRow` and `data-testid="status-pill"` on `StatusPill`. The test is red until B1 exists; it is never skipped.

## 2. Repository layout (fixed in WP0 so ownership can be exclusive)

```
app/
  [locale]/
    layout.tsx                 html lang + dir, fonts, tokens.css, app bar slot
    page.tsx                   L1 landing (bundle a)
    signin/page.tsx            A1 · signin/choose/page.tsx A1b   (bundle b)
    gate/page.tsx              A0                                 (WP3)
    invitation/page.tsx        F0                                 (bundle h)
    app/                       patient shell layout + tab bar     (WP3)
      page.tsx B1 · medicines/ B2 B3 B4 · safety/ C1 C2 C3 · setup/ A2
      more/  page.tsx (menu, WP3) · refill D1 · calendar E1 · activity E2 ·
             settings E3 · help E4 · notifications E5 · caregivers F1 · profile A3
    care/                      caregiver shell layout + banner + tab bar (WP3)
      page.tsx F2 · medicines/ F2,F3 · alerts/[id] F3 · more/ (menu, WP3) ·
      more/activity F3 · more/profile F4 · more/help F5
    clinic/                    clinic shell layout + side nav (WP3)
      page.tsx X0 · choose X0 · review/ G1s G2s · review/fields G3s · audit X1
    offline/page.tsx H3 · not-found.tsx H1 · error.tsx H2
  global-error.tsx H2 · manifest.ts · sw.ts (service-worker shell)
components/ui/<Name>.tsx       the 20 ported + 11 pending components, one file each; imported by path — no barrel file
components/ui/Icon.tsx         written by the lead in WP0 from design/icons.json, so all four WP2 groups import it
components/ui/README/<Name>.md ported guideline notes per component
features/<bundle>/             screen-level composition owned by one bundle
lib/config.ts                  API base URL · auth token · BOT_HANDLE '@jurah_bot' · PUSH_PUBLIC_KEY placeholder · REFERENCE_NOW
lib/data/api.ts                the 50 typed signatures (published interface)
lib/data/index.ts              'use server' implementation delegating to mock/
lib/data/mock/                 seed.ts (transcribed) · store.ts · identity.ts · <domain>.ts
lib/session/                   cookie session, role resolution
lib/schedule/                  deterministic dose generator + depletion (unit-tested)
lib/format/                    dates (REFERENCE_NOW-relative), numerals, strengths, maskedName
i18n/                          locale, direction, copy/<bundle>.ts, index.ts
types/contracts.ts             Data Contracts transcribed
design/icons.json              the 26 glyph paths, extracted once by the lead from the artifact's bundle.js (not in the repo)
styles/tokens.css              GENERATED by scripts/build-tokens.ts from docs/design-system/tokens.json
scripts/guards/*.ts            the seven repository guards
scripts/build-tokens.ts        docs/design-system/tokens.json → styles/tokens.css
tests/unit/**                  vitest
tests/e2e/**                   playwright: screen matrix, role walks, a11y
docs/backend-notes/<bundle>.md fragments merged into docs/BACKEND-NOTES.md by the lead
```

## 3. Work packages

### WP0 — Scaffold · lead · no subagent
**Contents.** Next + TS + Tailwind; `[locale]` routing with `dir` on `<html>` and `/` → `/ar`; the layout skeleton above with empty route files; `lib/config.ts`; `scripts/build-tokens.ts` reading `docs/design-system/tokens.json` → `styles/tokens.css` (D-001) with the Tailwind theme bound to the custom properties; `design/icons.json` extracted by the lead from the artifact's `bundle.js` (the one file the local reference folder does not carry, and the only time anything reads it) and `components/ui/Icon.tsx` rendering those 26 glyphs with the `mirror` flag, so WP2's four groups share it without owning it; fonts; PWA manifest + service-worker shell (registers, caches the app shell, serves `/offline`, subscribes to nothing); the seven guard scripts and `npm run verify`; vitest and playwright wired with one smoke test each; `docs/BACKEND-NOTES.md` created with its seven section headings empty; `docs/backend-notes/` folder; `.env.example` with the placeholders.
**Gate 0 exit → Gate 0b (build check):** `typecheck`, `lint`, `build`, `verify` pass on the empty scaffold; guards demonstrably fail on a planted violation of each rule (a hex, a `left:`, a `Date.now()`, a mock import, a `fetch`, a literal string, a `status:` write on a Dose) — pasted output.

### WP1 — Contracts, data layer, session, i18n, seed · one subagent · blocks everything
**Contents.** `types/contracts.ts` transcribed field by field (CR-002 deviation marked) · `lib/session/api.ts` (5 signatures) and `lib/data/api.ts` (50 signatures) exactly as in `SCREENS.md`'s appendix, with their view types · `lib/data/mock/*` implementing all of them against the transcribed seed as amended at Gate 0: twelve people (بدر the never-onboarded patient with no Settings/MessagingLink/PushSubscription row, CR-004), the eleven-row `Account` table (CR-008, `roles` **derived and asserted**, د. خالد reviewer + admin, CR-005), nine prescriptions with `strengthUnit: "mcg"` on rx-008 (`strengthMg: 50`, never converted, CR-003), doses **generated** by `lib/schedule` (never hand-typed), three alerts, three settings rows, messaging links, push subscriptions, refill requests, the calendar subscription, eight caregiver rows including the two `revoked` ones with `revokedAt` (CR-006, CR-027), audit rows of every type (CR-018 derivations listed) · `lib/schedule` generator and depletion with unit tests against the seed's tables (alternate-day 14/16/18/20/22; rx-002 ending 2026-09-25; rx-004 nothing after 2026-06-28; rx-006/007 nothing; `tracked` from the patient's setting) · `lib/format/maskedName` with tests for none, one and several middle names, always three asterisks · `lib/session` (cookie, `signIn` outcomes, role resolution per `ROLES.md`) · `i18n` module: locale, direction, numerals, the copy catalogue index and the shared vocabulary file (four dose-status words, two sector words, three review-state words, actor labels, event-type labels), every key marked placeholder · the dev-only fault/fixture switch inside the mock (D-002).
**Notes.** Fills `BACKEND-NOTES.md` §1 (every function), §4 (fields screens depend on, from `SCREENS.md`), §5 (one real returned example per function, printed by a script, not retyped), opens §2 with the shortcuts it takes (identity directory, ICS token, masked name computed client-side, expiry by comparison to `REFERENCE_NOW`, single-use token, push state) and §3 with every absence.
**Gate 1.** Owner reviews contracts field by field · a round-trip script calls every function and prints its shape · `scripts/seed-diff.ts` diffs the mock against a JSON transcription of `Seed Dataset.md` record by record and reports a table · the untracked patient's doses carry `tracked:false` and the tracked patient's carry statuses with `source: "adherence_agent"` · `getInvitationForConsent` for ناصر returns five fields and nothing else; every patient-scoped function returns nothing for his session · `lookupMaskedName` returns the same shape for `285061400412` and `277091900873` · schedule and masking tests pass (pasted).

### WP2 — Component port · four subagents in parallel · starts when `types/contracts.ts` lands (WP1 milestone 1), finishes alongside WP1
Each group ports its share of the twenty from `docs/design-system/index.d.ts`, `components/<Name>.md` and `bundle.css`, against `tokens.css` only, and builds its share of the eleven pending ones **to the specification in `docs/Build Prompts.md` prompt 1** (anatomy, states, previews, READMEs; CR-022) with a README each under `components/ui/README/`. Board anatomy in `docs/wireframes/` is the visual check. No screen code. Each reports contrast, focus-ring and 44×44 hit-area checks per component.

| Group | Built (ported) | Pending (built new) |
|---|---|---|
| 2a Actions + Forms | Button · IconButton · TextField · Select · Toggle · ChoiceGroup | PhotoInput · CopyField |
| 2b Data display | Card · PrescriptionCard · StatusPill · SectorChip · DetailRow · DepletionMeter | DoseRow (**`tracked` prop; no-status variant is first-class**) · ScheduleGroup · DoseTimeline · AlertRow · ActivityRow (actor slot + patient reference; list and table layouts) · MenuRow (leading text, trailing value, chevron, relationship-state variant) |
| 2c Feedback | InteractionAlert · InlineNotice · EmptyState · LoadingState · ErrorState | Countdown · StepIndicator · ContextBanner (caregiver context · simulated-role · last-known-data variants) |
| 2d Navigation + Overlays | AppBar (language switch in the action slot) · TabBar (bottom < 834, side rail ≥ 834; 4/3/2 items) · Sheet | — (Icon.tsx is WP0's) |

**Gate 2.** A dev-only gallery route under `app/(dev)/[locale]/dev-gallery/` — excluded from guards 2 and 7 by path, and returning `notFound()` in production builds — renders every component in every state at 390 and 1440, rtl and ltr, including DoseRow's no-status variant, MenuRow holding `pending`/`declined`/`expired`, ContextBanner's three variants, all four TabBar item counts, and InteractionAlert at all three severities × three review states. Axe passes on the page. Owner reviews.

### WP3 — Shells, routing, system pages · one subagent · after WP1 + WP2
**Contents.** Root and locale layouts · the app bar with the language switch that swaps the locale segment and persists `Settings.language` · middleware + layout role gates per `ROLES.md` · A0 gate route · patient shell (4 tabs, More menu) · caregiver shell (3 tabs, ContextBanner on every screen, More menu with the role switch) · clinic shell (2 destinations, side rail from 834, simulated-role banner, sign-out in the rail per CR-020) · in-shell role switch calling `chooseRole` · H1, H2, H3 + the failed-refresh pattern (`readLastKnownSnapshot`) · empty placeholder pages for every route in `SCREENS.md` so reachability can be tested before the bundles land.
**Gate 3.** Playwright role walks: every route reachable in its own shell and redirected from the others; ناصر's session reaches `/invitation` and nothing else (every other route redirects, and no patient-scoped function is called — asserted by a mock call log); the caregiver shell has no route the patient lacks; the reviewer cannot open `/clinic/audit`, the admin cannot open `/clinic/review`; nothing a patient needs is deeper than two taps (a route-depth assertion); back is predictable; sign out lands on L1 with no way back (history assertion).

### WP4 — Screen bundles · parallel subagents in waves · demo-critical first
Each bundle owns `features/<bundle>/`, its route files, `i18n/copy/<bundle>.ts`, `docs/backend-notes/<bundle>.md`, and its tests. It touches no shell, no component, no data-layer file. A bundle needing a component change or a data-function change reports it; the lead serialises a WP2/WP1 follow-up.

| Wave | Bundle | Screens | Boards | Owner review focus |
|---|---|---|---|---|
| 1 | **c** Today + My Medicines | B1 B2 | TodayPlan · Main · TodayMissed · Today834 · TodayLTR · Medicines · MedicinesPast · MedicinesDesktop · States | G10 tracking-off read; pill keyed on `tracked`; duration boundary; empty day; alert prominence |
| 1 | **h** Invitation + caregivers | F0 F1 F2 F3 F4 F5 | InviteConsent · InviteStates · Caregivers · InviteMasked · CaregiverHome · CaregiverPlan · CaregiverDetail · CaregiverProfile · CaregiverHelp | **the invitation invariants**: nothing before consent, equal buttons, decline grants nothing, masked name three asterisks, no-account twin identical, no write control anywhere, never more than the patient |
| 1 | **b** Sign-in + chooser + setup + profile | A0(states) A1 A1b A2 A3 | Login · SignInStates · RoleChooser · SessionGate · Setup · Profile | identical wording for `no_claims`; signing in is never acceptance; four setup steps; CR-001 default |
| 1 | **a** Landing | L1 | Landing · Landing1440 | G11 item by item; clinic route absent; no data call |
| 2 | **d** Prescription detail + add/scan | B3 B4 | Prescription · AddPrescription | no `undefined`; no estimate without dispensing; could-not-read state; no hand-typed clinical field |
| 2 | **e** Safety list + alert detail | C1 C2 | Safety · AlertDanger · AlertReviewed | §8 three-part copy; pending never reads final; citation "unverified" until the owner supplies it |
| 2 | **i** Clinic | X0 G1s G2s G3s X1 | ClinicEntry · ReviewerQueue · FieldQueue · ReviewerDecision · ReviewerDesktop · AuditLog · AuditLog1440 | review fields only; no patient without a queue item; audit metadata only, labels not enums (CR-010); the dose-status filter proof moment |
| 3 | **f** Drug check + refill | C3 D1 | DrugCheck · Refill | could-not-identify; routing = own sector; no estimate without dispensing |
| 3 | **g** Calendar + activity + settings + help + notifications | E1 E2 E3 E4 E5 | Calendar · Activity · Settings · Help · Messaging · NotifyStates · More | E3 exactly the permitted controls; four permission states; iOS install steps; bot handle from config, labelled simulated; off is neutral |

Wave 1 runs four bundles in parallel; wave 2 starts as wave-1 bundles pass their gates (the owner reviews each before the next begins, so waves overlap at the owner's pace). Bundle (a)'s Today mockup image is swapped in after (c) passes (CR-019).

**Per-bundle gate.** The bundle's screens render at 390/834/1440 × rtl/ltr in every required state (Playwright table) · the twelve-point checklist reported per screen · guards clean · the bundle's `backend-notes` fragment present · the lead has read the diff and re-run the bundle's tests itself.

### WPfinal — Verification and handoff · lead
Run the fourteen verification items from the Master Prompt and paste output; walk the spec's handoff checklist item by item with evidence; merge and complete `BACKEND-NOTES.md` (§3 and §7 above all); report complete / placeholder / owed / open.

## 4. Dependency graph and parallelism

```
WP0 ──► WP1 ──┬──────────────────────► WP3 ──► WP4 wave 1 (a,b,c,h) ──► wave 2 (d,e,i) ──► wave 3 (f,g) ──► WPfinal
              │  (contracts.ts lands first)
              └──► WP2a ┐
                   WP2b ├─ parallel ──► Gate 2 ─┘
                   WP2c │
                   WP2d ┘
```

Exclusive ownership: WP1 owns `types/`, `lib/data/`, `lib/session/`, `lib/schedule/`, `lib/format/`, `i18n/index.ts`, `i18n/vocabulary.ts`, `docs/backend-notes/wp1.md`. WP2 groups own disjoint files in `components/ui/`. WP3 owns layouts, middleware, `app/[locale]/gate`, the More menus, the system pages. Bundles own their `features/` folder, route pages, copy module and notes fragment. The lead owns `docs/*.md` at the top level.

## 5. Verification wiring (WP0 scripts, run at every gate)

| # | Check | Mechanism |
|---|---|---|
| 1 | typecheck · lint · build | `tsc --noEmit`, `next lint`, `next build` |
| 2 | no hex / px font-size / px radius in `components/`, `app/`, `features/` | `scripts/guards/no-raw-values.ts` (regex over `.tsx`, `.css`, Tailwind arbitrary values); excludes `app/(dev)/**` and `styles/tokens.css` (generated) |
| 3 | no import from `lib/data/mock` outside `lib/data`; no `fetch(` in components | `scripts/guards/seam.ts` |
| 4 | no `Dose.status` write outside `lib/schedule` and the seed; no notification payload with an action | `scripts/guards/no-dose-write.ts` (AST: assignments to `.status` on Dose-typed values; `actions:` in any `Notification` options) |
| 5 | no physical `left`/`right` (CSS props, Tailwind `ml- mr- pl- pr- left- right- text-left text-right`) | `scripts/guards/logical-only.ts` |
| 6 | no `Date.now()` / `new Date()` without an argument outside `lib/config.ts` | `scripts/guards/no-clock.ts` |
| 7 | no literal user-facing string outside `i18n/copy/` | `react/jsx-no-literals` (strings in JSX) + `scripts/guards/no-literal-copy.ts` (Arabic-script or sentence-like literals in `.tsx` props). Both exclude `app/(dev)/**`, the components gallery, which is dev-only and never built for production |
| 8 | unit tests: schedule, depletion, masking, numerals, role resolution | `vitest` |
| 9 | screen matrix 390/834/1440 × rtl/ltr × states, no horizontal overflow | `tests/e2e/matrix.spec.ts` produces a Markdown table |
| 10 | twelve-point checklist per screen | reported by each bundle, spot-checked by the lead against the matrix screenshots |
| 11–12 | role walks (untracked patient · other three roles · pending-only) | `tests/e2e/roles.spec.ts` with a mock call log asserting which data functions were invoked |
| 13 | seed diff | `scripts/seed-diff.ts` |
| 14 | BACKEND-NOTES completeness | `scripts/notes-check.ts` (seven headings, a row per data function in §1 and §5) |
| P | owed values: every `[TO BE SUPPLIED]` placeholder counted and listed (never fails; reported at every gate) | `scripts/guards/placeholders.ts` |
| S | seed invariants (Gate 0 decision 1, Gate 0b rules 1–4): an `active` prescription with `needsReview:false` carries `startDate`, `doseTimes`, `frequencyPerDay`, `strengthMg` (`brandName` optional — CR-002 reading); the generator yields nothing without `startDate` and `doseTimes.length === frequencyPerDay`; `Account.roles` recomputed and equal to the table; every `revoked` row has `revokedAt` and no access path reads `acceptedAt`; `rx-008` unconverted; no Civil ID in any shape or message; بدر has no Settings/MessagingLink/PushSubscription row | `scripts/guards/seed-invariants.ts` (added by WP1 once the seed exists) |
| U | `strengthMg` is never multiplied or divided; no unit-conversion helper exists (Gate 0b rule 3) | `scripts/guards/no-unit-conversion.ts` |

`npm run verify` runs 1–8, 13, 14, P, S and U; 9, 11 and 12 run with `npm run e2e`. The WP0 guard scripts are 2, 3, 4, 5, 6, 7, U and P; S is WP1's. `seed:diff` and `notes-check` print a loud `!!` line while their input is absent — that line is not a pass and must be gone at Gate 1.

## 6. Component gap list (G5)

The eleven pending components are known and are built in WP2 (CR-022). Beyond them, every element on the 48 boards maps to an existing or pending component, with these findings:

| Finding | Recommendation |
|---|---|
| **Masked name** — needs a11y semantics (asterisks decorative, middle names announced as hidden) and bidi isolation; `Build Prompts.md` prompt 1 rules explicitly: "Do NOT add a MaskedName component" | Not a component. A formatter in `lib/format/maskedName.tsx` returns the marked-up `body-strong` text with that behaviour, used everywhere a masked name renders (CR-021). No decision needed. |
| **Textarea** for the reviewer note and the return reason | None exists; use `TextField` (D-004). Minor. |
| **Table layout** for the audit log at 1440 | `ActivityRow` gets a `layout: 'list' | 'table'` variant within its pending spec (it already needs actor and patient slots); no new component. |
| **Two-pane list + detail** at 834 (My Medicines, reviewer queues) | Layout, not a component; built in the bundle's `features/` composition with logical properties. |
| **Language switch** | `AppBar`'s action slot with a quiet `Button`; no new component. |
| **Role option cards** (A1b, X0, A2 offer) | `Card` + `Button`, as Foundations states. |
| **Stale README** | `TabBar/README.md` describes five destinations; G8 wins (CR-016). |

No other gap found. The claim in Foundations that no twelfth component is needed holds.

## 7. Risk list

| # | Risk | Why it is likely | Mitigation in this plan |
|---|---|---|---|
| 1 | **A renderer keys the pill on the status word**, looks right on حمد (every untracked dose reads `upcoming`) and breaks the moment tracking is on — or the caregiver view shows what the patient cannot see | The seed makes the wrong implementation look correct | `DoseRow` takes `tracked` and `status` separately and renders no pill when `tracked` is false regardless of the word; a unit test renders `{tracked:false, status:'upcoming'}` and asserts no pill; the matrix walks حمد, سارة and عبدالله's view of حمد; the guard forbids any `status` write |
| 2 | **Seed drift and invented values** across nine parallel bundles (a brand name here, a timestamp there) | Boards already carry invented values ("Ostocal", ages, wrong dates), and bundles read boards | Only WP1 writes seed data; bundles receive data through the layer and may not hard-code any value; `seed-diff.ts` runs at every gate; briefs say "seed wins over the board" and list the known board deviations (CR-014) |
| 3 | **Copy sprawl and shared-file collisions**: literal strings in screens, two agents editing the catalogue or BACKEND-NOTES, a bundle "fixing" a shared component inline | Nine bundles, one catalogue, one notes file | Per-bundle copy modules and notes fragments (D-003); `jsx-no-literals` + the Arabic-literal guard fail the build; exclusive path ownership per brief; the lead reads every diff and rejects any edit outside the bundle's paths |

Two further risks the plan carries knowingly: the **in-memory mock resets when the dev server restarts** (accepted, recorded for §7 of the notes), and **copy is placeholder until the owner's deck arrives**, so every gate review reads structure, not sentences.

## 8. What the owner still owes (unchanged from the Master Prompt)
The real `sourceCitation` for `ia-001` (C2 and G2s show "unverified" / "to be supplied" until then) · the bilingual copy deck · the real bot handle (config value) — three counted items; the demo script is the owner's own and not a code artifact · answers to the `BLOCKS` and `DEFAULT` items in `DECISIONS.md`.

## 9. Reference folders and the published artifacts

`docs/design-system/` and `docs/wireframes/` are the reference every brief cites. The owner confirmed at Gate 0 that they are byte-identical to the published artifacts (verified by hash after the boards' latest revision was published); the lead's earlier comparison in this section was made before that publish and was stale, so it is withdrawn. The published artifacts are read again exactly once in Phase 1, by the lead in WP0, to extract the 26 icon paths from `bundle.js`, which the repository copy does not carry. Boards are never edited in the repository; a board that disagrees with the seed or the spec is logged in `DECISIONS.md` and corrected by the owner.
