# WP4 bundle a — Landing (L1) · task brief

Issued by the Phase 1 lead after Gate 3. One subagent. Format: `docs/Master Prompt — Phase 1.md` → TASK BRIEF TEMPLATE.

## OBJECTIVE
Build L1, the public landing page at `/[locale]` — ten sections in spec order, the language switch in its own header, a static Today mockup placeholder, a primary button that continues a signed-in user into the right shell — with **no data-layer call** and no clinic link anywhere.

## READ — in this order, all of it
1. `CLAUDE.md`. 2. `docs/Acceptance Criteria and Test Plan.md` — the L1 inventory row and **G11 in full** (every listed content item is a pass criterion). 3. `docs/SCREENS.md` row L1 (route, states, components, "Data functions: none"). 4. `docs/UX Principles.md` — the twelve-point checklist, §4 (holds at 390/200%/RTL), §6. 5. `docs/DECISIONS.md` CR-019 (the mockup is a placeholder image now, swapped for a real B1 export at bundle c's gate; no seed values in L1's code). 6. Boards `docs/wireframes/Landing.dc.html`, `Landing1440.dc.html` (and `README.md` first). 7. `docs/design-system/` brand book sections the boards cite; `components/ui/README/{Button,Card}.md`. 8. Existing code: `app/[locale]/page.tsx` (WP0's placeholder you replace), `features/shell/LanguageSwitch.tsx` (reuse, do not copy), `lib/session` (`getSession` only), `i18n/` (your module `i18n/copy/landing.ts` is registered already), `app/globals.css`, `styles/tokens.css`.

## FILES YOU OWN
`app/[locale]/page.tsx` · `features/landing/**` · `i18n/copy/landing.ts` (stub exists; fill it) · `public/landing/**` (the placeholder mockup image and any static art, with licence-free content you generate) · `docs/backend-notes/wp4a.md` · `tests/e2e/landing.spec.ts` · `tests/unit/landing/**`.

## FILES YOU MUST NOT TOUCH
Everything else — `components/ui/**`, `features/shell/**` (import, never edit), `lib/**`, `types/**`, `i18n/**` except `copy/landing.ts`, other bundles' routes, `scripts/**`, existing tests, `docs/**` except your fragment.

## DEPENDENCIES
`Button`, `Card`, `EmptyState` from `components/ui`; `LanguageSwitch` from `features/shell`; `getSession()` from `lib/session` for the signed-in state only; `homePathFor` from `features/shell/tabs` if it fits (read it) to point the primary button at the right shell.

## WHAT TO BUILD
- The ten sections G11 lists, in its order, as the boards draw them. L1 is the one screen allowed its own layout markup (owner-approved exception in SCREENS.md) — still tokens-only, logical properties only.
- Header: app name + `LanguageSwitch` (shared component, per its README the signin layout already shows the pattern).
- Hero mockup: a static placeholder image under `public/landing/` at the final aspect ratio with a **full text alternative** describing the Today screen (CR-019). No dose values, names or seed data in the image or the alt text beyond generic description.
- Signed-in state: `getSession()`; when a session exists the primary button reads its continue-variant copy and links into that session's shell home (patient → `/app`, caregiver → `/care`, reviewer → `/clinic/review`, admin → `/clinic/audit`, pending-only → `/invitation`). No session → the sign-in route.
- Images-unavailable state: every image has alt text and the layout holds without it (test by blocking images or asserting alt + intrinsic-size CSS).
- **The clinic route is never linked or named** anywhere on L1.

## ACCEPTANCE
G11 item-by-item (report a checklist) · SCREENS.md L1 states each demonstrated in `tests/e2e/landing.spec.ts` at 390/834/1440 × ar/en, axe clean, no horizontal overflow · zero imports from `lib/data` (assert in a unit test: the module graph of `features/landing` and `app/[locale]/page.tsx` contains no `lib/data`) · guards clean · the twelve-point checklist reported.

## INVARIANTS — G1, G10, G12, G9 first, then all twelve verbatim from the spec
G1: nothing on L1 (or anywhere) records a dose. G9: no technical identifier. G11: content complete, every screenshot a real screen (hence CR-019's placeholder discipline). G2: language switch present.

## PROHIBITIONS
The template's full list (Master Prompt): no new dependency · no contract change · no new shared component · no invented seed value · no hard-coded colour/size/copy · no `Date.now()` · no fetch/mock import · no clinic link · no edit outside your files.

## NOTES TO RECORD — `docs/backend-notes/wp4a.md`
§6: the mockup placeholder and its planned swap (CR-019). §7: anything awkward. Nothing else — L1 has no data surface.

## REPORT BACK
File list · G11 item checklist · command outputs verbatim (`npm run typecheck`, `npm run lint`, `npm run guards`, `npm run test`, `npx playwright test tests/e2e/landing.spec.ts --workers=1`) · twelve-point checklist · assumptions · gaps. Nothing committed.
