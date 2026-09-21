# AlertRow

One interaction finding in a list: severity, the drugs involved, and the review state, legible without opening it.

## What you provide

`severity` (`'info' | 'warning' | 'danger'`), `drugs` (string array — the interacting drugs, joined into the headline unless `title` is given), `reviewStatus` (`'auto_cleared' | 'pending_medical_review' | 'reviewed'`). Optionally `title`, `metaLabel` (a patient/sector line, for a reviewer queue), `href` or `onOpen`, `lang` (default `'en'`), `className`.

## When to use it

The patient's Safety list, and both reviewer queues (interaction review, field confirmation as a close cousin).

## When not to use it

- For the full alert. The alert detail screen uses **InteractionAlert** (`danger` fill, actions, source citation).
- For a dose's own status. That is **StatusPill**.

## Do

- Always show the severity word beside its glyph — colour is never the only signal (brand book status table).
- Word `pending_medical_review` as still-checking, never as resolved. It is `warning`, never `success` or `danger` alone: it is neither cleared nor a confirmed emergency.
- Pass `metaLabel` on a reviewer queue so a row is legible without opening it — patient and sector, never a Civil ID.

## Don't

- Don't recolour a severity to make a point.
- Don't let a row's only affordance be anything other than opening the finding (`href`/`onOpen`). Nothing here can act on the alert; that lives in **InteractionAlert**'s actions.

## Tokens involved

`danger`, `warning`, `navy-soft`, `ink-muted`, `border`, `border-strong`, `surface-card`, `radius-md`, `shadow-sm`, `space-1`–`space-3`, `label` / `body-strong` / `body-small`.
