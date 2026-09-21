# EmptyState

What a screen shows when there is genuinely nothing to show — an icon, a headline, a line of
explanation, and usually one thing to do about it. Ported from the design system — props unchanged
from `docs/design-system/index.d.ts` (`icon` narrowed to `IconName`), plus `className` passthrough.

## What you provide

`title`, and normally `description` and `action` (a Button-shaped node — this component attaches no
handler of its own; the action's own interactivity is the caller's client boundary, which is why
`EmptyState` itself stays server-compatible). Optionally `icon`, defaulting to `inbox`.

## When to use it

A dashboard with no active prescriptions. A caregiver list with nobody linked. A refill screen where
nothing is due. A dose history with no entries yet.

## When not to use it

- When the data failed to load — that is an **ErrorState**.
- While the data is still coming — that is a **LoadingState**.

## Do

- Write the description as what will happen, not as an apology.
- Pick an icon that names the missing thing, in `ink-muted`, at `space-6`.

## Don't

- Don't offer an action that cannot help.
- Don't put a colour on the icon — an empty state is not a status.

## A gap worth knowing about

`index.d.ts` gives `EmptyState` no `lang` prop and no built-in copy is needed — every word here is
supplied by the caller, so there is nothing to fall back on and nothing to report.

## Tokens involved

`navy`, `ink-muted`, `space-2`, `space-3`, `space-4`, `space-6`, and the `h2` / `body` type styles.
