# ErrorState

What went wrong, what it means for the patient, and what to do about it — with a retry. Ported from
the design system — props unchanged from `docs/design-system/index.d.ts`, plus `className`
passthrough. `'use client'`: it attaches the retry button's `onClick` itself.

## What you provide

`title` and `description` (both, always — what went wrong **and** what to do). Normally `onRetry`,
with `retryLabel` when "Try again" is not the right verb.

## When to use it

A failed load on any screen, and the photo check's "could not identify this medication" result.

## When not to use it

- For a genuinely empty list — that is an **EmptyState**.
- For a drug interaction — that is an **InteractionAlert**, a safety finding is not an error.
- For a field the patient filled in wrongly — that is the `error` prop on **TextField** / **Select**.

## Do

- Reassure where you truthfully can ("Nothing has been lost — your medications are saved").
- Make the description actionable when the patient can actually act.

## Don't

- Don't draw the icon in `danger` — it is `warning`, deliberately (`.wsf-state--error .wsf-state__ico`
  in bundle.css).
- Don't use a `danger` Button for the retry — retrying is safe (this port renders the retry as
  `.wsf-btn.wsf-btn--secondary`, matching the brief's plain stand-in until group a's `Button` lands).

## A gap worth knowing about

`index.d.ts` gives `ErrorState` no `lang` prop, so the built-in retry word (`copy.vocabulary.retry`)
falls back to English when `retryLabel` is not supplied. An Arabic screen must pass `retryLabel`
explicitly. Logged in `docs/backend-notes/wp2c.md` §7.

## Tokens involved

`warning`, `navy`, `ink-muted`, `space-2`, `space-3`, `space-4`, `space-6`, and the `h2` / `body`
type styles.
