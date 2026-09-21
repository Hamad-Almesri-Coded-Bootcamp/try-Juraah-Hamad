**جرعة / Jur'ah** is the visual foundation for a medication-safety platform serving patients in Kuwait — elderly patients above all, the family members who look after them, and the clinical reviewers who check safety findings — in Arabic and English, on phone, tablet and desktop. Every screen is designed on top of these tokens, so a token changed here changes every screen at once.

**On the name.** The product is جرعة (Jur'ah). "Wasfa" was the working name while this system was built, and it survives in one place on purpose: the JavaScript namespace `window.Wasfa` that `components/bundle.js` assigns, which every `preview.html` here and the project's wireframe canvas already import from. Renaming that global would break both for no gain — in the repository each component is re-implemented as a typed React component anyway, so the namespace never reaches the product. Read "Wasfa" as the module name, not the product.

**What is built.** Tokens (colour, type, spacing, radius, elevation), this brand book, `navigation.md`, a cover, **twenty components** across Actions, Forms, Data display, Feedback, Navigation and Overlays, each with a README and a bilingual preview, plus a 26-glyph outline icon set. **Eleven components are still pending** — `DoseRow`, `ScheduleGroup`, `DoseTimeline`, `AlertRow`, `ActivityRow`, `MenuRow`, `PhotoInput`, `CopyField`, `Countdown`, `StepIndicator`, `ContextBanner`.

**What this system does not own.** The screen inventory, the four roles and the routes live in the project's `Acceptance Criteria and Test Plan.md`, which is the binding specification; the interface rules live in `UX Principles.md`. Where this artifact and that specification disagree, the specification wins and the artifact gets corrected.

## The identity, in proportion

Hold the brand's own split. `navy` carries 70–80% of what a person sees: headers, navigation, icons, borders, primary buttons and all primary text. `surface-app` and `surface-card` carry the ground beneath it. `danger` — Medical Red — never exceeds 5–10% of a screen; it belongs to a real drug-interaction alert, a missed dose, or a single critical figure, and to nothing else. A screen where red has become decorative has broken this system, because the one place red must be unmistakable is the interaction alert that the project treats as the platform's core safety promise.

`navy-soft` is the secondary navy: a secondary button, the active tab, a link, a chart's second series. `navy-tint` is the quiet wash behind a selected row, an information panel, a grouped section header or a context banner — the only tinted background allowed on a routine screen.

## Colour

Set primary text and icons in `navy` on `surface-card` or `surface-app`. Drop to `ink-muted` only for text that is genuinely secondary — dispense dates, source-clinic captions, field helper text, placeholders — and never for a drug name, a dose, a frequency, or any part of an alert.

Draw hairline dividers and card edges with `border`. Give every control the patient operates — text input, select, toggle, checkbox, secondary button — a `border-strong` outline, which is the only border in this system that meets the 3:1 a control boundary needs. Put `on-fill` on anything filled with `navy`, `navy-soft`, `danger`, `warning` or `success`; `navy` text on those fills is not safe and was never checked for it.

Status carries one token each, and always a glyph or word beside it, so hue is never the only signal a patient or caregiver has:

| State in the data contract | Token |
| --- | --- |
| `Dose.status: upcoming` | `ink-muted` text, no fill |
| `Dose.status: taken_on_time` · `reviewStatus: auto_cleared` | `success` |
| `Dose.status: taken_late` · `severity: warning` · refill and depletion alerts | `warning` |
| `Dose.status: missed` · `severity: danger` | `danger` |
| `reviewStatus: pending_medical_review` | `warning`, with copy saying a reviewer is still checking |
| `Prescription.needsReview` · `fieldReviewStatus: pending` | `warning`, worded as awaiting confirmation, never as an error |
| `fieldReviewStatus: returned` | `ink-muted`, worded as sent back to the clinic |
| `source.sector: public` / `private` | not a status: `ink-muted` label in a `border` chip, never a semantic colour |

`pending_medical_review` is deliberately `warning` and never `success` or `danger` alone: it is neither cleared nor a confirmed emergency, and presenting it as either would misread the escalation policy the product is built on.

**A dose with `tracked: false` has no status token at all.** It renders no pill — not `upcoming`, not a grey placeholder, nothing. Adherence follow-up is optional in this product, and a patient who has not switched it on is looking at a *plan*, not a log. `DoseRow` therefore needs a first-class no-status variant rather than a fallback.

**Preference, permission, connection and invitation states are neutral, never semantic.** `MessagingLink.status`: `connected` → `success`; `pending` → `ink-muted` with a waiting treatment; `not_connected` and `expired` → `ink-muted`. `PushSubscription.permission`: `granted` → `success`; `default` → `ink-muted`; **`denied` and `unsupported` → `ink-muted` too, never `warning` and never `danger`**. `Caregiver.status`: `active` → `success`; `pending` → `ink-muted`, worded as awaiting the invited person's acceptance; **`declined`, `expired` and `revoked` → `ink-muted`**. No badge, no dot, no alert icon for any of these. A choice someone has not made, a permission a browser has blocked, an invitation a person has declined and time running out are not faults, and the `danger` token belongs to drug safety alone — spending it here would break the one place red must be unmistakable.

**Intentional additions.** The supplied palette defines navy, soft navy, Medical Red, white and two greys; it has no success or caution colour, so this system adds `success` and `warning`. Both were chosen to survive beside `danger`: `success` sits at a teal-green well off the red–green axis, so a red–green colour-blind patient can still separate a taken dose from a missed one, and `warning` is a deep amber that carries white text at 6.4:1. Replace either only with a colour that keeps both properties.

## Identity on screen

A person's name is shown at its minimum useful precision. Where a reader has not been granted a full name — above all the caregiver-invitation confirmation — the name is masked as **first name in full · each middle name as its initial followed by exactly three asterisks · last name in full**: `عبدالله م*** ع*** المطيري`. Three asterisks always, whatever the real length, so the mask never leaks how long a name is. Set it as ordinary `body-strong` text: no chip, no monospace, no "masked" annotation, because the reader's whole task is to recognise a name.

**No component ever prints a Civil ID back to the screen**, whole or masked, and no visual state distinguishes "this Civil ID has an account" from "this Civil ID does not". Both resolve to the same confirmation step, with the same wording, on the same surface.

## Type

Set everything in `sans`. It stacks IBM Plex Sans Arabic over IBM Plex Sans, so an Arabic sentence and a Latin drug name on one line share a single set of letterforms instead of visibly switching typeface mid-sentence. Load both families at weights 400 and 600 from Google Fonts; the stack falls back to the platform's own system font if neither arrives.

Use `h1` once per screen for its title and `h2` for a section inside it — there is no third heading level and this product does not need one. Set drug names, dose amounts and alert headlines in `body-strong`; these are precisely the facts patients lose between the clinic and home, which is the problem the platform exists to solve. Keep `body` at 17px anywhere the patient reads in order to act: the base size sits above the usual 14–16px because of who uses this, not by accident. `label` drives buttons, form labels, status pills and sector chips — keep its letter-spacing in English, and drop any uppercase transform in Arabic, which has no letter case.

**One bounded exception: the public landing page.** It may use the `display` style and a wider vertical rhythm than the in-app screens, and it may lay its sections out with its own markup. It may not introduce a colour, font family, radius or shadow outside these tokens, restyle a component, or use `danger` decoratively. Nothing else in the product gets this exception.

## Spacing and layout

Design mobile-first, then widen. Elderly patients, and the relatives following their adherence, reach this on a phone long before a laptop. Use `space-3` as the minimum page gutter at phone width and `space-5` at tablet and desktop; separate stacked cards — prescriptions, doses, caregivers — with `space-4`; use `space-2` for the tight gap inside a pill or chip. Give every tappable control a 44×44px minimum hit area (48 for a primary action) with at least 8px between adjacent targets, regardless of how small a glyph looks. On this audience that is not a nicety.

## Elevation, radius, and the prominence rule

`shadow-sm` is a card at rest. Reserve `shadow-md` together with `radius-lg` for the interaction alert, modals and bottom sheets, and let nothing else carry both. A `danger`-severity interaction alert must be the single most prominent element on the medications dashboard: build it as a full `danger` fill — not a stripe, not a left border — with `on-fill` text at `h2` and `body-strong` sizes, `radius-lg`, `shadow-md`, and placement above every prescription card. It appears for every patient, whatever they opted into. Use `radius-md` for cards and primary buttons, `radius-sm` for inputs and chips, `radius-full` for status pills and sector tags.

## Arabic and English in one layout

Lay every screen out with logical properties — `margin-inline-start`, `padding-inline-end`, `text-align: start` — never `left` or `right`, so flipping `dir` between `rtl` and `ltr` moves the whole screen correctly on its own. Mirror glyphs that encode direction: back and forward chevrons, the calendar-subscribe arrow. Never mirror one that depicts an object or a fixed symbol — a capsule, a syringe, a clock face, a checkmark, or any numeral — and never mirror a masked name's asterisk runs away from their own initials. Keep a Latin drug name inside an Arabic sentence from reversing the line around it, and write Arabic copy the way a Kuwaiti patient actually reads: plain and direct, the register the platform's own chat check-ins use, not formal Modern Standard Arabic.

## Iconography

One outline family, 26 glyphs, shipped in the bundle: clock, check, checkLate, missed, danger, warning, info, review, shield, chevron, chevronDown, building, capsule, home, calendar, users, settings, camera, close, refresh, inbox, plus, link, trash, search, subscribe. No mixing of styles. Drawn in `navy` on light surfaces and `on-fill` on filled ones, legible at 24px minimum because of the audience, and never the only carrier of a status.

## Rules a component may not break

- **No component may offer an affordance that records a dose status**, and that includes a notification's own actions. `DoseRow`, `ScheduleGroup`, `DoseTimeline` and `ActivityRow` are read-only by contract.
- **Every action is a visible control.** No swipe-to-act, no long-press-only menu, no drag, no hover-only affordance.
- **Accept and decline carry equal visual weight** on a consent screen: same size, same width, same prominence. Decline is never a text link, never smaller, never grey, never below the fold.
- **An off or blocked state is drawn as a choice**, never with a warning colour, alert icon, dot or badge. Describe the gain, not the deficiency.
- **Write controls are absent, not disabled**, wherever a role cannot act. A greyed-out button tells a caregiver the app is broken; an absent one tells them the truth about their access.
- **No component ever displays a technical identifier** — no chat id, no link token, no push endpoint, no role string, no Civil ID. `CopyField` is for a link a person is meant to use, never for an identity.
- The language switch belongs to `AppBar`, never to a settings screen.

## What comes next

The eleven pending components, on exactly these tokens, then the specification's full screen inventory designed from them rather than invented per screen. `navigation.md` beside this file governs how those screens connect.
