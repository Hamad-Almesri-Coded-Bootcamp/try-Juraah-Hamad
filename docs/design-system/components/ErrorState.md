# ErrorState

What went wrong, what it means for the patient, and what to do about it — with a retry.

## What you provide

`title` and `description`. Normally `onRetry`, with `retryLabel` when "Try again" is not the right verb.

## When to use it

A failed load on any screen, and the photo check's "could not identify this medication" result, where the failure is expected often enough to be designed for rather than apologised for.

## When not to use it

- For a genuinely empty list. That is an **EmptyState**.
- For a drug interaction. That is an **InteractionAlert** — a safety finding is not an error.
- For a field the patient filled in wrongly. That is the `error` prop on **TextField** or **Select**, next to the field itself.

## Do

- Reassure where you truthfully can. "Nothing has been lost — your medications are saved" is the sentence that stops a patient re-taking a dose because the screen looked broken.
- Make the description actionable when the patient can actually act: photograph the box from the side showing the name, in good light, with no letters covered.

## Don't

- Don't draw the icon in `danger`. It is `warning`, deliberately — a network failure is not a medical emergency, and red here spends the 5–10% budget that belongs to the interaction alert.
- Don't use a `danger` **Button** for the retry. Retrying is safe.

## Tokens involved

`warning`, `navy`, `ink-muted`, `space-2`, `space-3`, `space-4`, `space-6`, and the `h2` / `body` type styles.
