# WP2 — Component port · the section every group brief shares

Issued by the Phase 1 lead after Gate 0b. Four subagents in parallel (groups 2a, 2b, 2c, 2d), each with its own brief `docs/briefs/WP2<x>.md` that names OBJECTIVE, FILES YOU OWN and the component list. This file is the rest of the template and applies to all four verbatim.

## READ — all of it, in this order, before writing a line

1. `CLAUDE.md` (root) — the nine rules.
2. `docs/design-system/brand-book.md` — the binding usage rules: proportion of navy/danger, the status→token table, identity display, type, spacing, elevation and the prominence rule, "Rules a component may not break".
3. `docs/design-system/index.d.ts` — **every prop of every built component, verbatim. Your ported component's props are these, no more, no fewer**, with two typed narrowings: `icon?: IconName` (from `components/ui/Icon.tsx`) and `lang?: Locale` (from `i18n/locale.ts`, same two values).
4. `docs/design-system/bundle.css` — the exact implementation. It is already loaded globally as `components/ui/styles/bundle.css` (byte-identical, tested). **A ported component renders the bundle's class anatomy** (`.wsf-btn.wsf-btn--primary.wsf-focus`, `.wsf-field`, `.wsf-pill--missed`, …) and adds no CSS of its own. Read your components' sections (markers `/* ---------- Name ---------- */`).
5. `docs/design-system/components/<Name>.md` for each built component you port — "What you provide", "When (not) to use", do/don't, tokens.
6. `docs/Build Prompts.md` lines 20–146 (**prompt 1**) — the full specification of the eleven pending components: anatomy, states, read-only rules, previews, README guidelines. Build yours to it verbatim; nothing beyond the list.
7. `docs/Design System Foundations.md` — status mapping, "an untracked dose has no status token at all", neutral preference/permission/relationship states, identity display.
8. `docs/UX Principles.md` §4 (hands and eyes), §11 (assistive technology), §12 (bidirectional), §13 (off is a choice), §15 (consent), and the twelve-point checklist at the end.
9. `docs/Acceptance Criteria and Test Plan.md` lines 64–111 — G1–G12 verbatim.
10. `docs/Seed Dataset.md` — the only source of the content your gallery examples show (real drugs, real facilities, real masked names, real times). Never invented content, never lorem ipsum. **The boards' `renderVals()` block carries `strengthMg: 0.05` for Levothyroxine — that is wrong; the seed says `strengthMg: 50, strengthUnit: "mcg"`. Never copy from `renderVals()`.**
11. `docs/DECISIONS.md` → CR-014 (which board values are wrong and why the seed wins), CR-021 (masked name is a formatter, not a component), CR-022 (the eleven are built here), D-001, D-005.
12. The boards listed in your group brief under `docs/wireframes/` — the visual check of anatomy in context. **Read them; do not run them.** Layout and component order come from the board; every value comes from the seed.
13. Existing code you build on: `components/ui/Icon.tsx` (26 glyphs, `IconName`, `mirror`), `styles/tokens.css` (custom properties, `.type-*` classes, `--hit-area`, `--ring`, `--content-max`), `styles/theme.css` (Tailwind bound to tokens), `i18n/copy/vocabulary.ts` and `i18n/index.ts` (`copy.vocabulary`, `t(entry, locale)`), `app/(dev)/[locale]/dev-gallery/_gallery.tsx` (`GalleryPage`, `Section`, `Example`), `tests/setup.ts`, `vitest.config.ts`.

## FILES YOU MUST NOT TOUCH

Everything outside the paths your group brief lists. In particular: any other group's components, `components/ui/Icon.tsx`, `components/ui/styles/bundle.css`, `styles/**`, `app/globals.css`, `app/[locale]/**`, `app/(dev)/[locale]/dev-gallery/layout.tsx`, `page.tsx`, `_gallery.tsx`, everything under `lib/`, `types/`, `i18n/` (you **read** `i18n/copy/vocabulary.ts`; if a word you need is missing, use the nearest existing key and list the gap in your report — never add a key, never write a literal), `scripts/`, `tests/e2e/**`, `docs/**` except your own notes fragment, `package.json` (no dependency).

## DEPENDENCIES — use, do not rebuild

- Tokens only: every visual value is `var(--…)` from `styles/tokens.css` or a bundle class. **No hex, no px font size, no px radius, no `left`/`right`** (guards 2 and 5 fail the build). Logical properties only.
- `Icon` for every glyph; `mirror` only on chevron/subscribe. Never a capsule, clock, check or numeral mirrored.
- Built-in fallback words come from `copy.vocabulary` via `t(…, lang)`; the `lang` prop defaults to `'en'` exactly as `index.d.ts` says; screens always pass it. Any `label`/`title`/`description` the consumer passes is rendered as given, never translated.
- Types from `types/contracts.ts` (WP1): `Dose`, `DoseStatus` (`Dose['status']`), `Prescription`, `InteractionAlert`, `AuditEvent`, `Caregiver`. If a type you need is not there yet when you start, define the narrow local type `index.d.ts` gives (`DoseStatus`, `Sector`, `Severity`, `ReviewStatus`, `PrescriptionSummary`) in your component file and note it; do not edit `types/`.
- Testing: Vitest + `@testing-library/react` + `jest-dom`, jsdom. Component tests live beside the component as `components/ui/<Name>.test.tsx` (exempt from the literal-string rules; nothing else is).

## HOW A COMPONENT IS WRITTEN HERE

- `components/ui/<Name>.tsx`, named export `<Name>` plus `<Name>Props`. Server-compatible by default; add `'use client'` only when the component holds state or handlers (Toggle, Sheet, TabBar with `onChange`, Countdown, PhotoInput, CopyField, TextField with `onChange`, …).
- The class anatomy of `bundle.css` for the twenty ported components — the visual result must be indistinguishable from the artifact's preview. For the eleven pending components you write `components/ui/styles/<Name>.css` (imported from the component; token variables and `--wsf-*`/`--hit-area`/`--ring` only; logical properties; `prefers-reduced-motion` respected) and reuse bundle primitives (`.wsf-focus`, `.wsf-ico`, `.wsf-sr`, `.wsf-pill`, `.wsf-chip`) rather than restyling them.
- Accessibility per UX §11: accessible names match visible labels; icon-only controls carry `aria-label` from a **prop** (never a literal); focus ring is `.wsf-focus` (dual ring, ≥3:1 on every surface); live regions where prompt 1 says "announces"; `aria-current`, `role`, `aria-busy`, `aria-hidden` as the guides state.
- Hit areas: 44×44 minimum, 48 for a primary action, 8px clear space — from `--hit-area`, `--hit-area-primary`, `--target-gap`.
- Two directions: the component must render correctly under `dir="rtl"` and `dir="ltr"` with **no direction-specific code** — logical properties do the flipping; only `Icon mirror` is direction-aware.
- README per component at `components/ui/README/<Name>.md`, written to prompt 1's GUIDELINES: one-sentence summary · what the consumer provides · when to use / when not · do/don'ts naming tokens · **the read-only rule** where prompt 1 requires it. For a ported component the README is the design-system guide adapted to the port (props unchanged, `className` passthrough).
- Gallery: your group's page `app/(dev)/[locale]/dev-gallery/<group>/page.tsx` renders **every component in every state** named in your brief, using `GalleryPage`/`Section`/`Example` from `../_gallery`, with seed content, in the page's locale (`params.locale`). Dev-only, literal strings allowed there and nowhere else.
- Tests per component: renders; each variant/state; the accessibility contract (accessible name, `aria-*`, focus); the rule that matters (e.g. DoseRow `{tracked:false, status:'upcoming'}` renders no pill and no interactive element; Toggle is a real `role="switch"`; Sheet traps focus and closes on Escape; TabBar sets `aria-current`).

## ACCEPTANCE (Gate 2, Master Prompt)

"A components page rendering every component in every state, at 390 and 1440, both directions — including DoseRow's no-status variant and MenuRow holding a relationship state." Plus, per group: **contrast, focus-ring and hit-area checks reported per component** (state the token pair and the measured ratio from `docs/design-system/tokens.json`'s usage notes; state the ring is `.wsf-focus`; state the rendered box meets 44/48). `npm run verify` exit 0 with your files in. `npx vitest run components/ui` green. Your gallery page loads at `/ar/dev-gallery/<group>` and `/en/dev-gallery/<group>` under `next dev` with no console error and no horizontal overflow at 390 (`tests/e2e/gallery.spec.ts` is the lead's check; you run `npx playwright test tests/e2e/gallery.spec.ts -g "gallery <group>"` and paste it).

## INVARIANTS — G1, G10, G12, G9 first; all twelve verbatim in the spec lines 64–111

**G1** No component offers an affordance that records a dose status: no checkbox, "taken" button, swipe, long-press, context menu, or notification action. `DoseRow`, `ScheduleGroup`, `DoseTimeline`, `ActivityRow` are read-only by contract; a `DoseRow` is at most one link to the prescription detail. **G10** Tracking off is normal: `DoseRow` with `tracked: false` renders **no pill at all**, chosen by `tracked`, never by the status word; not-connected/denied/declined/expired states are `ink-muted`, no badge, dot or alert icon. **G12** Nothing here builds a notification or an action on one. **G9** No component prints a Civil ID, a chat id, a token, a push endpoint or a role string; `CopyField` is for the calendar link only; masked names are body-strong text from `lib/format/maskedName` (WP1), never a component of yours. **G4** status is rendered as given. **G5** nothing beyond the twenty + eleven is built; a gap is reported. **G6** 390/834/1440, both directions, 200% text scale, 44×44, never colour alone. **G7/G8** as written.

## PROHIBITIONS

No new dependency · no prop added, removed or renamed against `index.d.ts` (a needed change is a report item, not an edit) · no component outside your list · no invented seed content in the gallery · no hex/px-size/px-radius/`left`/`right` · no `Date.now()` (`Countdown` ticks a counter; it never reads a clock) · no dose-status write · no literal user-facing string outside `i18n/copy/` except inside the gallery page and `*.test.tsx` · no `fetch`, no import from `lib/data/**` · no edit to any file you do not own · no restyling of a bundle class.

## NOTES TO RECORD — `docs/backend-notes/wp2<group>.md`

Usually short: §7 items only (what the design system lacked, what you had to interpret, any prop whose type you narrowed), plus §4 if a component depends on a contract field being present (e.g. `DepletionMeter` needs `dispensing`).

## REPORT BACK

File list · per-component table: variants and states built · contrast pairs and ratios · focus ring · hit area · README written · tests (count) · `npm run verify` full output · `npx vitest run components/ui` output · the Playwright gallery line for your group · assumptions · gaps (a word missing from the vocabulary, a prop `index.d.ts` needs) · anything you could not do and why. Paste commands and outputs; never say "verified" without them. Nothing is committed.
