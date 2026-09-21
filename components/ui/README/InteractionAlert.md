# InteractionAlert

The platform's safety-critical component: a drug-interaction finding, rendered at `danger` as the
single most prominent element a screen can hold, and always carrying whether a human reviewer has
checked it. Ported from the design system's `InteractionAlert` — props unchanged from
`docs/design-system/index.d.ts`, plus the usual `className` passthrough.

## What you provide

`severity` (`danger` · `warning` · `info`), `title`, and normally `description` in plain language.
Optionally `drugs` — the interacting prescriptions, one per line, named the way the patient will
recognise them — `reviewStatus` (`pending_medical_review` · `reviewed` · `auto_cleared`), `actions`
(buttons), `severityLabel` and `reviewLabel` to override the built-in copy, `titleId`, and `lang`
(defaults `'en'`, as `index.d.ts` states).

Render it once per finding, above every prescription card on the dashboard.

## The two states that matter most

**`danger`** is a full `danger` fill with `on-fill` text, the title at `h2` and the description at
`body-strong`, `radius-lg` and `shadow-md`. Not a stripe, not a left border, not a red-edged card.

**`pending_medical_review`** reads as *a medical reviewer is still checking this*, never as a
resolved answer. `reviewed` says a reviewer has checked it; `auto_cleared` says it was screened
automatically and nothing was found — three sentences, each carried by its own glyph (`clock` ·
`review` · `check`) so the state is never colour alone.

## When not to use it

- For anything that is not a safety finding — a muted check-in warning, a saved-settings
  confirmation, or a refill routing note is an **InlineNotice**.
- For a failed request. Use **ErrorState**.
- More than once at a time at `danger` — lead with the most severe and link to the rest.

## Do

- Write the description the way the Adherence Agent talks: plain, direct, the register a Kuwaiti
  patient actually reads.
- Name both drugs and both facilities.
- Use `secondary` and `quiet` buttons for `actions` — inside a `danger` alert bundle.css restyles
  them to on-fill automatically; this component adds no restyling of its own.
- Supply `titleId` yourself whenever more than one alert might render on the same page (this
  component's own gallery does, with nine at once) — `aria-labelledby` needs a stable id to point
  at, and this component has no hook of its own to generate one, so it stays server-compatible.

## Don't

- Don't dress `pending_medical_review` in `success`, and don't let it sit alone in `danger` either.
- Don't let `warning` or `info` borrow `shadow-md` and `radius-lg` — those are `danger`'s alone.
- **There is no `onDismiss` prop on this component, on purpose, at every severity — not only
  `danger` + `pending_medical_review`.** A patient cannot make an interaction go away by closing
  it; the `actions` slot is for navigation and review actions, never for a close control.
- Don't let this component decide severity or review state — both are rendered exactly as given.

## Read-only rule

This component never writes anything. It has no state-changing prop of its own; `actions` is a
slot the screen fills, and the screen's own choices there are outside this component's contract.

## A read on the design-system guide's own role note (reported, not changed here)

`docs/design-system/components/InteractionAlert.md` says the danger case sets `role="alert"`.
`docs/briefs/WP2c.md` (this port's own brief) specifies `role="region"` with `aria-labelledby`
instead, at every severity, so this file follows the brief. Logged as a discrepancy in
`docs/backend-notes/wp2c.md` §7 — not a spec/seed conflict, so not logged to `docs/DECISIONS.md`.

## Tokens involved

`danger`, `warning`, `success`, `navy`, `navy-soft`, `navy-tint`, `on-fill`, `surface-card`,
`border`, `radius-lg`, `radius-md`, `radius-sm`, `shadow-md`, `shadow-sm`, `space-1`–`space-4`, and
the `h2` / `body-strong` / `body` / `body-small` / `label` type styles.
