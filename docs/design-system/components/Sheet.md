# Sheet

A focused overlay: a bottom sheet at phone width, a centred modal from tablet width up, at `radius-lg` and `shadow-md`.

## What you provide

`open`, `title`, and the content as children. Optionally `onClose` with `closeLabel`, `footer` (its buttons), and `mode` (`auto` by default; force `sheet` or `modal`).

It renders nothing when `open` is false. It positions itself against the nearest positioned ancestor, so the screen it belongs to needs `position: relative`.

## When to use it

Confirming a refill request and showing where it routes. Inviting a caregiver. Revoking a caregiver's access. The subscribe instructions on the calendar screen. Anything that needs a decision before the screen underneath makes sense again.

## When not to use it

- For an interaction alert. A `danger` alert belongs on the dashboard, above the prescriptions, where the patient meets it without having to open anything — and a sheet can be dismissed, which an interaction cannot.
- For a whole screen's worth of content. If the patient will scroll it, it is a screen.
- Two at once. One sheet per artboard, one decision at a time.

## Do

- Restate what is about to happen, with **DetailRow**, before the confirming button. A refill sheet names the drug and the pharmacy it will reach, so the sector routing is visible before it is committed, not after.
- Put the confirming action first in `footer` and the way out second; both stretch to fill the row at phone width.

## Don't

- Don't reach for `radius-lg` and `shadow-md` anywhere else. Together they belong to this, to modals, and to the `danger` interaction alert — nothing else in the product floats.
- Don't make the scrim decorative. It is a real button labelled "Close", so a patient who taps beside the sheet gets out, and the keyboard can reach the same escape.

## Tokens involved

`surface-card`, `navy`, `border`, `radius-lg`, `shadow-md`, `space-2`, `space-3`, `space-4`, `space-6`, and the `h2` type style.
