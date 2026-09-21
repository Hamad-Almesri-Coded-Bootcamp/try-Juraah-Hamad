# Jur'ah (جرعة) — Design System Foundations

**Status:** published as a Claude Design System artifact, now titled **Jur'ah — جرعة**. Tokens (colour, type, spacing, radius, elevation), a brand-book README, `navigation.md`, a cover, and **twenty components** are built. **Eleven more are pending** — see Open items.

**Naming note:** the artifact was renamed from the earlier working name "Wasfa" to **Jur'ah — جرعة**. One thing kept that old name on purpose: the JavaScript namespace **`window.Wasfa`** that `components/bundle.js` assigns, which every component preview inside the artifact and every artboard of the wireframe canvas already import from. Renaming that global would break both for no gain, and in the repository each component is re-implemented as a typed React component anyway, so the namespace never reaches the product. Read "Wasfa" as a module name, never as the product.

**Scope note:** this system is the shared visual layer for the Frontend + Backend track. Every screen is designed from these tokens rather than styled per screen, so a token change propagates across the whole product. The screen inventory, the role model and the routes live in `Acceptance Criteria and Test Plan.md`, which owns them; the interface rules live in `UX Principles.md`, which is binding; the data values every screen is designed around live in `Seed Dataset.md`.

**`navigation.md` is current (September 2026).** It used to describe one shell with four destinations (Medications / Refills / Drug check / Settings) and a nine-screen build, and every document carried a warning about the conflict. It has been rewritten and now describes what the product actually is: **four surfaces** — a public landing page, a patient shell (Today · My Medicines · Safety · More), a caregiver shell (Today · Medicines · More) and an unadvertised clinic shell (Review · Audit) — plus the invitation-consent screen that belongs to no shell, and a full entry/exit table for all **thirty screens and three system pages**. Its original rules on push / sheet / in-place transitions, motion, the safety path, finishing a task, never a dead end and the breakpoints were good and were kept. Where it and the spec still disagree, the spec's **G8** wins.

**Consumption in code (decided):** the artifact's `components/bundle.js` is a classic script assigning `window.Wasfa`, which is the artifact environment's format and does not import cleanly into Next.js. In the repository each component is ported to a typed React component under `components/ui/<Name>.tsx`, reproducing the behaviour and anatomy documented in its card, preview and README, with the compiled `tokens.css` as the only source of visual values. The artifact remains the visual reference and the rulebook; the repository holds the working implementation. The artifact serves `tokens.json` but no `tokens.css`, so a consumer supplies the custom properties (`--navy`, `--space-3`, `--radius-md`, …) the bundle's stylesheet reads.

## Colour tokens

| Token | Value | Role |
|---|---|---|
| `surface-app` | `#f5f7fa` | App and dashboard background behind every screen |
| `surface-card` | `#ffffff` | Cards, list rows, sheets, modals, inputs |
| `navy` | `#062958` | Brand core (70–80% of what a person sees): primary text, icons, borders, headers, primary buttons |
| `navy-soft` | `#0b356f` | Secondary navy: secondary buttons, active tab, links |
| `navy-tint` | `#e8eef7` | Selected row, information panel, grouped section header, context banner |
| `ink-muted` | `#55637a` | Secondary text only (dates, captions, placeholders) |
| `border` | `#e2e8f1` | Hairline dividers and card edges (decorative) |
| `border-strong` | `#7d8da6` | Control outlines — inputs, selects, toggles (meets 3:1) |
| `danger` | `#d5272c` | Medical Red, capped at 5–10% of a screen: interaction alerts, missed dose, critical metrics |
| `warning` | `#8a5200` | **Added**: taken_late, refill and depletion alerts, `pending_medical_review`, a flagged field awaiting confirmation |
| `success` | `#0e7c61` | **Added**: taken_on_time, `auto_cleared`, a connected channel, a granted permission. Teal-green, off the red–green axis |
| `on-fill` | `#ffffff` | Text and icons on any navy, red, amber or green fill |

Single Light theme for now; dark and high-contrast themes are open items.

## Status mapping (bound to the Data Contracts)

`upcoming` → `ink-muted`, no fill · `taken_on_time` / `auto_cleared` → `success` · `taken_late` / `severity: warning` / refill alerts → `warning` · `missed` / `severity: danger` → `danger` · `pending_medical_review` → `warning`, with copy saying a reviewer is still checking · `reviewed` → reads from `reviewerDecision`: `confirmed` keeps the severity's colour, `cleared` reads as resolved · `needsReview` on a prescription, and `fieldReviewStatus: "pending"` → `warning`, worded as awaiting confirmation, never as an error · `fieldReviewStatus: "returned"` → `ink-muted`, worded as sent back to the clinic · `source.sector` is **not** a status: `ink-muted` label in a `border` chip · `ContextBanner` uses `navy-tint`, never `danger`.

**An untracked dose has no status token at all.** A `Dose` with `tracked: false` renders **no pill** — not `upcoming`, not a grey placeholder, nothing. The row is a plan entry: drug, dose, time. This follows from **G10**, and it is why `DoseRow` needs a first-class no-status variant rather than a fallback. Note the trap in the seed data: an untracked dose also *reads* `upcoming`, so a component that decides by the status word looks correct on the default patient and breaks the moment tracking is switched on. Decide by `tracked`.

**Preference, permission and connection states are neutral, never semantic.** `MessagingLink.status`: `connected` → `success` · `pending` → `ink-muted` with a waiting treatment · `not_connected` and `expired` → `ink-muted` on `surface-card`, or `navy-tint` for a panel. `PushSubscription.permission`: `granted` → `success` · `default` → `ink-muted` · **`denied` and `unsupported` → `ink-muted` too, never `warning` and never `danger`**, with the explanation carried by copy rather than colour. No badge, no dot, no alert icon for any of these. An unmade or blocked choice is not a fault (`UX Principles.md` §13), and the `danger` token belongs to drug safety only — spending it on a preference would break the one place red must be unmistakable.

**A caregiver invitation's state is a relationship state, not a fault state.** `Caregiver.status`: `active` → `success` · `pending` → `ink-muted` with a waiting treatment, worded as awaiting the caregiver's acceptance · **`declined`, `expired` and `revoked` → `ink-muted`, never `warning` and never `danger`**. A declined invitation is a person exercising a choice, and an expired one is time passing; neither is an error the patient must fix. The patient's caregiver list may offer to invite again, but shows no alert icon, red dot or badge on any of these rows. A `pending` row states plainly that the caregiver sees nothing until they accept — that sentence is the point of the row, not a caveat under it.

Every status also carries a glyph or word. Colour alone is never the signal.

## Identity display

A person's name is shown at its **minimum useful precision** (spec **G9**). The masked form is: **first name in full · each middle name as its initial letter followed by exactly three asterisks · last name in full** — for example `عبدالله م*** ع*** المطيري`. Three asterisks always, whatever the real length; the count of asterisks must never leak the length of a name. `Seed Dataset.md` holds the canonical worked examples, including a two-part name where nothing is masked.

- The masked form is used wherever one person is shown a name they have not been granted in full — above all the caregiver-invitation confirmation, where it is the only thing the patient sees before the invitation is addressed.
- It is rendered as ordinary `body-strong` text on `surface-card`. It gets no chip, no mono font and no "masked" annotation: it must read as a name, because the patient's task is to recognise it.
- The asterisks are decorative to assistive technology: the accessible name reads the first and last name with the middle names announced as hidden, never as a run of punctuation.
- **No component ever renders a Civil ID back to the screen**, masked or whole, and no screen state distinguishes "this Civil ID has an account" from "this Civil ID does not". Both resolve to the same confirmation step and the same wording. This is a design-system rule because it is one `DetailRow` away from being broken by accident.

## Type

One family stack, `sans` = IBM Plex Sans Arabic → IBM Plex Sans → system-ui, weights 400/600 from Google Fonts, so Arabic and Latin share letterforms on the same line.

Styles: `display` 32/40, `h1` 26/34, `h2` 20/28 (all 600); `body` 17/26 400, `body-strong` 17/26 600, `body-small` 14/20, `caption` 13/18, `label` 13/16 600 with 0.02em tracking. Body sits at 17px, not the usual 14–16px, because the primary audience is elderly; drug names, doses and alert headlines always take `body-strong`. Nothing renders below 14px, and every layout holds at 200% text scale.

**One bounded exception, owner-approved: the public landing page.** It may use the `display` style, a wider vertical rhythm than the in-app screens, and its own layout markup for its ten sections. It may **not** introduce a colour, font family, radius or shadow outside these tokens, restyle a component, or use the `danger` token decoratively. Nothing else in the product gets this exception.

## Scale

Spacing `space-1…6` = 4 / 8 / 16 / 24 / 32 / 48px. Radius `radius-sm` 8, `radius-md` 12, `radius-lg` 20, `radius-full` 999. Shadows `shadow-sm` (card at rest) and `shadow-md` (alert banner, modals, sheets), both tinted navy.

## Components built (20)

**Actions** Button · IconButton
**Forms** TextField · Select · Toggle · ChoiceGroup
**Data display** Card · PrescriptionCard · StatusPill · SectorChip · DetailRow · DepletionMeter
**Feedback** InteractionAlert · InlineNotice · EmptyState · LoadingState · ErrorState
**Navigation** AppBar · TabBar
**Overlays** Sheet

Each carries a `README.md` (usage rules, tokens involved, do/don'ts) and a `preview.html` showing several real states with real Arabic and English content. The bundle also ships a 26-glyph outline icon set (clock, check, checkLate, missed, danger, warning, info, review, shield, chevron, chevronDown, building, capsule, home, calendar, users, settings, camera, close, refresh, inbox, plus, link, trash, search, subscribe).

## Rules carried from the brief and the UX principles

- **No component may offer an affordance that records a dose status** — and that now includes a notification's own actions. `DoseRow`, `ScheduleGroup`, `DoseTimeline` and `ActivityRow` are read-only by contract, and their READMEs must say so, most of all on the untracked schedule where no statuses show at all.
- **Every action is a visible control.** No swipe-to-act, no long-press-only menu, no drag, no hover-only affordance.
- A `danger`-severity interaction alert is the most prominent element on the medications dashboard: full `danger` fill (not a stripe or left border), `on-fill` text at `h2`/`body-strong`, `radius-lg` + `shadow-md`, above every prescription card. It appears for every patient, whatever they opted into.
- **An off or blocked state is drawn as a choice**, never with a warning colour, alert icon, dot or badge. Describe the gain, not the deficiency. The same holds for a declined or expired caregiver invitation.
- **Accept and decline carry equal visual weight** on any consent screen. Decline is a full-width `Button` of the same size as accept — never a text link, never a smaller or greyer control, never below the fold (`UX Principles.md` §15).
- **Write controls are absent, not disabled**, wherever a role cannot act — the caregiver shell above all. A greyed-out button tells a caregiver the app is broken; an absent one tells them the truth about their access.
- The language switch belongs to `AppBar`, never to the settings screen.
- Navigation is `TabBar` per shell — four destinations for the patient, three for the caregiver, two for the clinic — plus `MenuRow` lists inside More. No hamburger, no hidden drawer. **The landing page and the invitation-consent screen have no shell and no tab bar**: the consent screen is reached before any role is resolved, and it must not put the caregiver inside a product they have not yet agreed to enter.
- **No component ever displays a technical identifier**: no chat id, no link token, no push endpoint, no role string, no Civil ID. `CopyField` is for links a person is meant to use (the calendar feed), never for an identity.
- Mobile-first: `space-3` gutter at phone width, `space-5` at tablet and desktop. Minimum 44×44px hit area (48 for primary actions) with at least 8px between adjacent targets.
- Bidirectional layout uses CSS logical properties only, so `dir` flips a whole screen. Directional chevrons mirror; capsules, syringes, clocks, checkmarks and numerals never do. **Masked names never mirror**: the asterisk runs stay attached to their own initials in both directions.
- Arabic copy reads plainly, in the register the Adherence Agent uses, never uppercased or letter-spaced.

## The wireframe canvas

**Jur'ah Wireframes — 48 artboards, current as of spec v7.3, and the approved visual reference for the Phase 1 build.** It is built from this system's real components (`x-import` against the `Wasfa.*` globals) with the tokens installed under `project/ds/wasfa/`, and its content comes from `Seed Dataset.md`, so the drug names, facilities, times and masked names on the boards are the ones to build with.

Coverage, so nobody has to guess whether something is missing:

- **Every screen in the inventory has a board at 390.** The multi-state screens carry several panels on one board: the four sign-in states, the four notification permission states, the invitation's accept / decline / expired outcomes, the two-step invitation with the masked name and its no-account twin, and the three system pages.
- **Wider boards exist where the layout actually changes** — Today at 834, My Medicines at 1280, the reviewer decision with its patient-context panel at 1280, the audit log at 1440, and the landing page at 1440. Everything else follows the breakpoint rules in `navigation.md` deterministically (tab bar on phone, side rail from 834, persistent side navigation and a ~880px content cap on desktop), so a board per screen per size would add pages without adding decisions.
- **One board is English/LTR** (Today) to prove the mirroring: chevrons flip, capsules and clocks and numerals do not.
- **The boards that carry the most weight** are `TodayPlan` (tracking off — the default and the most-seen screen), `InviteConsent` (the consent gate), `AuditLog1440` (the demo's proof moment) and `NotifyStates` (all four permission states, including the honest iOS install path).

Nothing in the canvas predates the current spec any more. Where a board and the spec ever disagree, the spec wins and the board gets corrected.

## Open items

**Eleven components still to build:**

| Component | Group | Serves |
|---|---|---|
| `DoseRow` | Data display | Today — one dose, **with and without** a status. Read-only. |
| `ScheduleGroup` | Data display | Today — the clock-time grouping. |
| `DoseTimeline` | Data display | Prescription detail and the reviewer's context panel, with or without statuses. Read-only. |
| `AlertRow` | Data display | The patient's safety list and both reviewer queues. |
| `ActivityRow` | Data display | The patient's activity feed **and the admin audit log** — so it needs an optional actor slot (who caused the event) and a patient reference. Read-only. |
| `MenuRow` | Data display | More, profile, help, settings rows, the caregiver list (including `pending`, `declined` and `expired` rows) and the clinic shell's lists. |
| `PhotoInput` | Forms | Prescription intake and the drug check. |
| `CopyField` | Forms | Calendar sync — the per-patient webcal link. |
| `Countdown` | Feedback | Sign-in — the simulated Hawiati approval. |
| `StepIndicator` | Feedback | First-run setup progress. |
| `ContextBanner` | Feedback | Caregiver session context; the simulated-role label in the clinic shell; a last-known-data notice. |

The screens added in v6, v7 and v7.2 need **no twelfth component**: the role choosers are `Card` with an action, the notification and permission states are `InlineNotice` + `Button` + `MenuRow`, the reviewer's patient-context panel is `Card` + `PrescriptionCard` + `DetailRow` + `DoseTimeline`, the audit log's table is `ActivityRow` plus `Select` filters, the **invitation-consent screen (F0) is `Card` + `DetailRow` + two equal-weight `Button`s** with the masked name as `body-strong` text, and the landing page uses its own layout markup under the bounded exception above. The wireframe boards were drawn within exactly these constraints, which is the practical proof that the list of eleven is complete.

**Other open items:** `Dashboard-EN-390` is still missing from the older polished-screens artifact (the wireframe canvas covers the case with its English Today board). The dashboard's past-medications grouping is wireframed but not finished at polish level. Dark and high-contrast themes are deferred. A QR code for desktop-to-phone chat linking remains a possible later addition; the app is phone-first, so a deep-link button suffices.
