# LoadingState

A skeleton shaped like the content it stands in for, rather than a spinner on a blank page. Ported
from the design system — props unchanged from `docs/design-system/index.d.ts`, plus `className`
passthrough.

## What you provide

Nothing required. Optionally `variant` — `list` (dashboard prescription cards), `detail` (a single
record), `alert` (the interaction banner, reserving its space) or `lines` — plus `rows` (default 3,
ignored by `alert`) and `label`, the sentence a screen reader hears while it is up.

## When to use it

Any screen whose data arrives asynchronously: the dashboard's first paint, the prescription detail,
the "analysing" step of the photo check.

## When not to use it

- For an action inside a control — that is **Button**'s own `loading` prop.
- When you know the result will be empty — skip to **EmptyState**.
- For more than a few seconds — show an **ErrorState** with a retry instead.

## Do

- Match the variant to what will replace it, and keep the row count the same.
- Reserve `alert` for a screen that may show a `danger` alert.

## Don't

- Don't animate it hard — the pulse is bundle.css's own 1.6s, and disappears under
  `prefers-reduced-motion` (bundle.css handles that; nothing here adds its own animation).
- Don't paint a bar in a status colour — they carry no meaning yet (`navy-tint`, from `.wsf-skel__bar`
  in bundle.css).

## A gap worth knowing about

`index.d.ts` gives `LoadingState` no `lang` prop, so the built-in `label` fallback
(`copy.vocabulary.loading`) falls back to English when `label` is not supplied. An Arabic screen
must pass `label` explicitly. Logged in `docs/backend-notes/wp2c.md` §7.

## Tokens involved

`navy-tint`, `surface-card`, `border`, `radius-sm`, `radius-md`, `radius-lg`, `radius-full`,
`shadow-sm`, `space-2`, `space-3`, `space-4`, `space-6`.
