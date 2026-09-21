# InlineNotice

A low-stakes message that is deliberately not a safety alert: information, a confirmation, or a
caution the patient can act on at leisure. Ported from the design system — props unchanged from
`docs/design-system/index.d.ts`, plus `className` passthrough.

## What you provide

The message as children. Optionally `tone` (`info` by default, or `success` · `warning` — there is
no `danger` member in the type, so passing one is a compile-time error, not a runtime check), `title`,
and `onDismiss` with `dismissLabel` for a notice the patient may put away.

## When to use it

The "this is a simulation" banner on the identity screen. The refill confirmation naming the
pharmacy it went to. The reminder that calendar sync is one-directional. The soft warning beside a
muted check-in toggle. A not-connected / off state, worded as a choice (§13) — never `warning` for
"not connected yet".

## When not to use it

- For a drug interaction, at any severity — that is an **InteractionAlert**.
- For a failed operation the patient should retry — that is an **ErrorState**.
- For an empty list — that is an **EmptyState**.

## Do

- Give it a `title` when the message is longer than a line.
- Say what follows, not just what happened.

## Don't

- Don't give it a `danger` tone — there isn't one, on purpose.
- Don't make it dismissible when the patient needs it every time they see the screen.
- Don't stack more than two on one screen.

## A gap worth knowing about

`index.d.ts` gives `InlineNotice` no `lang` prop, so this port's built-in dismiss word
(`copy.vocabulary.dismiss`) falls back to English when `dismissLabel` is not supplied. An Arabic
screen must pass `dismissLabel` explicitly. Logged in `docs/backend-notes/wp2c.md` §7.

## Tokens involved

`navy`, `navy-soft`, `navy-tint`, `success`, `warning`, `surface-card`, `border`, `radius-md`,
`space-1`, `space-2`, `space-3`, and the `body-strong` / `body-small` type styles.
