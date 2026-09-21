# LoadingState

A skeleton shaped like the content it stands in for, rather than a spinner on a blank page.

## What you provide

Nothing required. Optionally `variant` — `list` (dashboard prescription cards), `detail` (a single record), `alert` (the interaction banner) or `lines` — plus `rows` and `label`, the sentence a screen reader hears while it is up.

## When to use it

Any screen whose data arrives asynchronously: the dashboard's first paint, the prescription detail, the "analysing" step of the photo check. The data layer is built as promises from Phase 1 precisely so these states are exercised before a real backend exists.

## When not to use it

- For an action inside a control. A button that is working shows its own spinner — that is **Button**'s `loading` prop.
- When you know the result will be empty. Skip to **EmptyState**.
- For more than a few seconds. Past that, a patient needs words; show an **ErrorState** with a retry.

## Do

- Match the variant to what will replace it, and keep the row count the same. A skeleton that resolves into a different shape makes the page jump, and a jumping page is how an elderly patient loses their place.
- Reserve the alert skeleton for a screen that may show a `danger` alert, so the banner's space is held rather than pushing every card down when it arrives.

## Don't

- Don't animate it hard. The pulse is 1.6s and disappears entirely under `prefers-reduced-motion`.
- Don't paint skeleton bars in a status colour. They are `navy-tint` — the quiet wash — because they carry no meaning yet.

## Tokens involved

`navy-tint`, `surface-card`, `border`, `radius-sm`, `radius-md`, `radius-lg`, `radius-full`, `shadow-sm`, `space-2`, `space-3`, `space-4`, `space-6`.
