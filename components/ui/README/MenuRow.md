# MenuRow

One destination or setting in a list: label, optional value or description, and a chevron that mirrors in RTL.

## What you provide

`label`. Optionally `value`, `description`, `icon`, `href` or `onClick`, `tone` (`'default' | 'relationship'`), `trailing` (a control slot, e.g. a `Toggle`), `className`.

`trailing` and `href`/`onClick` are mutually exclusive: a row holding a trailing control renders as a plain container, never nested inside a button or link, because two interactive targets in one row is one the patient cannot reach.

## When to use it

The More tab, profile, help, settings rows, the clinic shell's lists, and the patient's caregiver list.

## When not to use it

- For a dose. That is **DoseRow**.
- For a prescription. That is **PrescriptionCard**.

## The relationship-state rule

**A caregiver-invitation row's `value` holds a relationship state — "awaiting acceptance", "declined", "expired", "revoked" — and that value is always `ink-muted`, with no badge, no dot and no alert icon.** Pass `tone="relationship"` for these rows. A relationship state is not a fault state: a declined invitation is a person exercising a choice, an expired one is time passing, and neither gets the `danger` or `warning` treatment (CLAUDE.md rule 8; brand book, "Preference, permission, connection and invitation states are neutral").

## Do

- Give every row a 44×44 minimum hit area (already built in).
- Use `trailing` for a `Toggle` in a settings list, not `onClick` plus a nested control.

## Don't

- Don't badge, dot or colour a relationship-state value.
- Don't nest a button or checkbox inside an `href`/`onClick` row.

## Tokens involved

`navy`, `ink-muted`, `border`, `navy-tint`, `space-1`–`space-3`, `hit-area`, `body` / `body-small`.
