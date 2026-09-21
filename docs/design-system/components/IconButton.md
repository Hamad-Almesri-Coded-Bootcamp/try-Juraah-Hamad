# IconButton

An icon-only control that keeps a 44×44px hit area no matter how small its glyph is drawn.

## What you provide

`icon` (a name from the bundle's outline set) and `label` — the accessible name, which is required because an icon-only control has no visible text. Optionally `variant` (`quiet` by default, or `primary` · `secondary` · `danger`), `mirrorIcon` for a directional glyph, and any `<button>` attribute including `onClick` and `disabled`.

## When to use it

In an **AppBar** — the back chevron and one trailing action. To dismiss an **InlineNotice** or close a **Sheet**. Anywhere a labelled **Button** would crowd a row that is already full.

## When not to use it

- For the main action of a screen. An elderly patient should not have to recognise a glyph to find the thing the screen is for; use **Button** with words.
- More than twice in one bar. Three unlabelled glyphs in a row is a puzzle.
- Inside a **PrescriptionCard** that is itself a button — one hit area cannot sit inside another.

## Do

- Write `label` as the action, not the glyph: "Back to medications", "رجوع للوحة الأدوية" — not "chevron".
- Set `mirrorIcon` on the back chevron and the calendar-subscribe arrow, and leave it off the capsule, camera, clock and checkmark.
- Let it inherit `on-fill` inside an **AppBar**; the bar's own rule handles that, so do not set a colour.

## Don't

- Don't shrink it below `var(--wsf-hit)`. The glyph may be 24px but the button is 44px, and that gap is the whole point of the component.
- Don't use `danger` for anything but removal. Revoking a caregiver qualifies; closing a panel does not, and red spent here is red taken from the interaction alert.

## Tokens involved

`navy`, `navy-soft`, `navy-tint`, `danger`, `on-fill`, `border-strong`, `radius-md`, `space-2`.
