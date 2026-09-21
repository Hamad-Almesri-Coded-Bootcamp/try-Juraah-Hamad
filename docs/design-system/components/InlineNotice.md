# InlineNotice

A low-stakes message that is deliberately not a safety alert: information, a confirmation, or a caution the patient can act on at leisure.

## What you provide

The message as children. Optionally `tone` (`info` by default, or `success` · `warning`), `title`, and `onDismiss` with `dismissLabel` for a notice the patient may put away.

## When to use it

The "this is a simulation" banner on the identity screen. The refill confirmation naming the pharmacy it went to. The reminder that calendar sync is one-directional. The soft warning beside a muted check-in toggle.

## When not to use it

- For a drug interaction, at any severity. That is an **InteractionAlert**, and downgrading one to a notice would hide the thing the platform exists to surface.
- For a failed operation the patient should retry. That is an **ErrorState**.
- For an empty list. That is an **EmptyState**.

## Do

- Give it a `title` when the message is longer than a line, so the point survives a glance.
- Say what follows, not just what happened: "It has gone to the Amiri Hospital pharmacy — public sector, the same source as the prescription" is a confirmation the patient can check.

## Don't

- Don't give it a `danger` tone. There isn't one, on purpose. A notice red enough to compete with the interaction alert is a notice in the wrong component.
- Don't make a notice dismissible when the patient needs it every time they see the screen — the simulation banner on the identity screen stays.
- Don't stack more than two on one screen.

## Tokens involved

`navy`, `navy-soft`, `navy-tint`, `success`, `warning`, `surface-card`, `border`, `radius-md`, `space-1`, `space-2`, `space-3`, and the `body-strong` / `body-small` type styles.
