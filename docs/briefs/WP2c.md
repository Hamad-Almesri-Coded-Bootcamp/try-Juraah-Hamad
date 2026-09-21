# WP2c — Feedback · task brief

Read `docs/briefs/WP2-common.md` first; it is the rest of this brief.

## OBJECTIVE
Port InteractionAlert, InlineNotice, EmptyState, LoadingState, ErrorState from the design system, and build Countdown, StepIndicator, ContextBanner to Build Prompts prompt 1, each with README, tests and gallery states.

## FILES YOU OWN
`components/ui/InteractionAlert.tsx` · `InlineNotice.tsx` · `EmptyState.tsx` · `LoadingState.tsx` · `ErrorState.tsx` · `Countdown.tsx` · `StepIndicator.tsx` · `ContextBanner.tsx` · their `*.test.tsx` · `components/ui/styles/{Countdown,StepIndicator,ContextBanner}.css` · `components/ui/README/<each>.md` · `app/(dev)/[locale]/dev-gallery/c/page.tsx` · `docs/backend-notes/wp2c.md`.

## BOARDS TO CHECK
`AlertDanger`, `Medicines`, `MedicinesDesktop` (the danger alert: full `danger` fill, `radius-lg`, `shadow-md`, above every card, `h2`/`body-strong` on-fill; secondary/quiet buttons inside render on-fill), `AlertReviewed` (reviewed state — per CR-014 the gallery uses ia-002's real reviewer note), `CaregiverHome`, `CaregiverPlan`, `CaregiverDetail` (ContextBanner caregiver case; InlineNotice), `ClinicEntry`, `ReviewerQueue`, `AuditLog` (ContextBanner simulated-role case), `SystemPages` (H3 last-known-data banner), `Login`, `SignInStates` (Countdown running/lapsed), `Setup` (StepIndicator), `States` (EmptyState, LoadingState, ErrorState), `NotifyStates`, `Messaging` (InlineNotice tones; an off state is never `warning`).

## COMPONENT NOTES
- **InteractionAlert** — `.wsf-alert--<severity>`, severity word (`copy.vocabulary.severity*` unless `severityLabel`), review sentence (`copy.vocabulary.<reviewStatus>` unless `reviewLabel`), `drugs` one per line, `description` body-strong on danger, `actions` slot (buttons; inside danger the alert restyles secondary/quiet to on-fill — this is bundle CSS, not yours to add), `titleId` for `aria-labelledby`, `role="region"`. `danger` + `pending_medical_review` must **not** offer any dismiss. `sourceCitation` is not a prop here; the screen renders it beneath.
- **InlineNotice** — tones `info | success | warning`, **never danger**; `onDismiss` renders an IconButton-like close (use group a's `IconButton` if present, else a plain `<button class="wsf-iconbtn wsf-focus">` with `aria-label={dismissLabel ?? t(copy.vocabulary.dismiss)}`); `role="status"`.
- **EmptyState / ErrorState / LoadingState** — `.wsf-state`; ErrorState `description` says what went wrong **and** what to do; `onRetry` renders a Button (group a's, or a plain `.wsf-btn.wsf-btn--secondary` until it lands); LoadingState variants `list | detail | alert | lines`, `rows`, `aria-busy` + an `aria-live="polite"` label (`copy.vocabulary.loading`), skeleton bars from `.wsf-skel`.
- **Countdown** (new, prompt 1) — props: `seconds` (total), `state: 'running' | 'completed' | 'lapsed'`, `onLapse?()`, `onRetry?()`, `onCancel?()`, `label`, `retryLabel?`, `cancelLabel?`, `lang?`. Running: remaining seconds as text (large, `h1`) and a determinate `role="progressbar"` (`aria-valuenow`), announcing every ten seconds through a polite live region, **a visible cancel control always present** (navigation.md: "nobody faces a screen counting at them with no exit"). Completed: the check glyph and the done word. Lapsed: the lapsed word and a retry Button. **Ticks with `setInterval` on a seconds counter; never `Date.now()`, `performance.now()` or `new Date()`.** Reduced motion respected.
- **StepIndicator** (new) — `steps: string[]` (max four, assert), `current` index, `label`; `<ol>` with `aria-current="step"`; progress direction follows reading direction automatically (logical properties); numerals never mirror.
- **ContextBanner** (new) — `variant: 'caregiver' | 'simulated' | 'lastKnown'`, `title` (e.g. "تعرض ملف حمد" composed by the consumer), `detail?` (as-of time, role label), `icon?`; `navy-tint` background, `navy` text, **never the danger token**, not dismissable, `role="note"` (or `status` for lastKnown), sticky under the AppBar by the consumer's layout, not by you.

## GALLERY STATES
InteractionAlert: 3 severities × 3 review states (nine), danger with actions, reviewed with reviewer note (ia-002) · InlineNotice: 3 tones, with/without title, dismissable · EmptyState: with action, without · LoadingState: 4 variants · ErrorState: with retry, without · Countdown: running (e.g. 18 s left), completed, lapsed · StepIndicator: first, middle, last of three; of four · ContextBanner: caregiver ("تعرض ملف حمد"), simulated role (reviewer), last-known data with an as-of time from `REFERENCE_NOW` formatting done in the page.

## ACCEPTANCE ADDITIONS
Contrast: `on-fill` on `danger`/`warning`/`success`/`navy`, `navy` on `navy-tint`, `warning` text on `surface-card` — pairs and ratios from `tokens.json`. Tests: Countdown never imports or calls `Date.now` (assert by reading the file in the test), reaches `lapsed` and calls `onLapse` once with fake timers, exposes cancel while running; InteractionAlert danger+pending renders no dismiss; InlineNotice rejects `tone="danger"` at the type level; ContextBanner never sets a danger class.
