# WP2d — Navigation + Overlays · task brief

Read `docs/briefs/WP2-common.md` first; it is the rest of this brief.

## OBJECTIVE
Port AppBar, TabBar and Sheet from the design system, each with README, tests and gallery states. No pending component in this group (Icon is WP0's).

## FILES YOU OWN
`components/ui/AppBar.tsx` · `TabBar.tsx` · `Sheet.tsx` · their `*.test.tsx` · `components/ui/README/{AppBar,TabBar,Sheet}.md` · `app/(dev)/[locale]/dev-gallery/d/page.tsx` · `docs/backend-notes/wp2d.md`.

## BOARDS TO CHECK
Every 390 board with a shell (`TodayPlan`, `Medicines`, `Safety`, `More`, `CaregiverHome`, `ReviewerQueue`, `AuditLog`) for AppBar + bottom TabBar; `Today834` (side rail), `MedicinesDesktop`, `ReviewerDesktop`, `AuditLog1440` (persistent side navigation, ~880px content cap is the page's, not yours), `TodayLTR` (back chevron mirrors, nothing else does), `Refill`, `InviteMasked`, `Caregivers`, `ReviewerDecision` (Sheet: bottom sheet at phone, centred modal from 834), `InviteConsent` (no shell, no tab bar — a negative check).

## COMPONENT NOTES
- **AppBar** — `title` rendered as the screen's `h1` (`.wsf-appbar__title`; props exactly as `index.d.ts`), `onBack` **or** `backHref` (never both), `backLabel` required with `onBack` (type-enforced via a discriminated union that still satisfies `AppBarProps`), the back chevron mirrors, one trailing `action` slot (the language switch lives here, G2 — the switch itself is WP3's). `role="banner"`? The bar is a `<header>`.
- **TabBar** — `items` `{ id, label, icon: IconName, badge? }`, `value`, `onChange`, `layout: auto | bottom | side` (auto = bottom below 834, side rail from 834 — the switch is CSS in `bundle.css` `.wsf-tabs--bottom/--side` via media queries; `auto` renders both classes' logic as the bundle does), `label` = the `<nav>` accessible name. Active item: `aria-current="page"`, `navy-tint` background, `navy` leading-edge indicator — three signals. **Labels always visible under icons.** `badge` renders a count with an assistive suffix from the consumer's label. Built from the signed-in role's item set by the consumer: the component accepts 2, 3 or 4 items and **rejects more than 4 at the type level** (`items` as a tuple union) — README quotes `TabBar.md`'s G8 table. Items are links when an `href` is present in the item (add `href?: string` **only if** `index.d.ts`'s `onChange` alone cannot express navigation — it cannot in App Router, so add `href?` and record it as the one prop addition in your report and README).
- **Sheet** — `open`, `onClose`, `title` (`aria-labelledby`), `mode: auto | sheet | modal` (bottom sheet below 834, centred modal from 834 — bundle `.wsf-sheet-root--sheet/--modal`), `footer` for buttons, `closeLabel` on the close IconButton (group a's `IconButton` if present, else `<button class="wsf-iconbtn wsf-focus">` with the label). Behaviour: `role="dialog" aria-modal="true"`, focus moves in on open and returns on close, focus trapped (Tab cycles), Escape closes, scrim click closes, body scroll locked while open, 240ms motion collapsing under reduced motion (bundle CSS). Dismissing changes nothing — the component has no submit.

## GALLERY STATES
AppBar: title only; with back button; with back link; with action slot (a quiet button stand-in) · TabBar: the three real item sets (patient 4 — اليوم · أدويتي · السلامة · المزيد with icons home/capsule/shield/settings; caregiver 3 — اليوم · الأدوية · المزيد; clinic 2 — مراجعة · تدقيق) in `bottom` and in `side` layout, with and without a badge, active item varying · Sheet: closed trigger, open as sheet, open as modal (force `mode`), with footer buttons of equal weight.

## ACCEPTANCE ADDITIONS
Tests: AppBar back control has the accessible name and mirrors; TabBar sets exactly one `aria-current`, renders a label for every item, refuses 5 items (type test with `@ts-expect-error`); Sheet traps focus, closes on Escape and on scrim click, restores focus, is absent from the DOM (or `hidden`) when `open` is false. Hit areas: tab items ≥ 44px, back control 44px, close 44px. Contrast: `navy` on `navy-tint` (active tab), `ink-muted` on `surface-card` (inactive label).
