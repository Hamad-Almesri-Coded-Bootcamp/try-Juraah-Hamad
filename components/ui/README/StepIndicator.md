# StepIndicator

Progress through a short multi-step flow (first-run setup) — never more than four steps. New
component (`docs/Build Prompts.md` prompt 1); `components/ui/styles/StepIndicator.css` is its own
stylesheet, token variables only.

## What you provide

`steps` — one label per step, at most four (a fifth throws rather than silently rendering a bar the
product never designed a fifth segment for), used as each step's assistive-technology name. `current`
— the zero-based index in progress. `label` — the accessible name of the whole list (e.g. "First-run
setup progress"). Optionally `lang` (defaults `'en'`).

## When to use it

A2's first-run setup and any other short (≤4-step), linear, non-skippable flow that benefits from a
visible "how much is left" signal.

## When not to use it

- For a flow the patient can jump around in freely — a step *indicator* implies a fixed order.
- For more than four steps — the product has not designed a fifth segment; redesign the flow or ask,
  rather than stretching this component past its spec.

## Do

- Pass real step names in `steps`, even though only the current step's name is visible in the
  caption — every step's name is still read by assistive technology via a visually-hidden label.
- Let logical properties carry the RTL/LTR flip; there is no direction-specific code here on purpose.

## Don't

- Don't mirror the "Step X of Y" numerals — they are plain digits, never touched by `Icon`'s
  `mirror` prop or any transform.
- Don't invent a fifth bar by truncating `steps` yourself — fix the flow instead.

## A gap worth knowing about

The "Step X of Y" caption renders plain Western-numeral digits in both languages; no numeral
formatter (e.g. Arabic-Indic digits for `ar`) exists yet in the repository to convert them. Logged
in `docs/backend-notes/wp2c.md` §7.

## Tokens involved

`navy`, `border`, `ink-muted`, `radius-full`, `space-1`, `space-2`, and the `caption` type style.
