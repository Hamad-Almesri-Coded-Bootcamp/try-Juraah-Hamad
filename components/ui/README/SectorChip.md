# SectorChip

Marks a prescription as public- or private-sector in `ink-muted` inside a `border` chip — a provenance label, never a status.

## What you provide

`sector` — `public` or `private`, straight from `Prescription.source.sector`. Optionally `lang` (default `'en'`) for the built-in word, or `label` to name a specific kind of facility.

## When to use it

Beside the issuing facility's name: on a **PrescriptionCard**, in the prescription detail header, and on the refill screen where the sector decides the routing destination.

## When not to use it

- For anything that changes over time. A sector is a fact about where a prescription came from; a dose state belongs to **StatusPill**.
- As the confirmation that a refill was routed correctly. Say the destination in words on the confirmation; the chip only says where the prescription came from.

## Do

- Keep it next to the facility name, in `body-small`, so the two read as one phrase.

## Don't

- Don't give it `success`, `warning` or `danger`. A semantic colour here would say something clinical that is not true.
- Don't fill it. The chip is `surface-card` inside a `var(--border)` hairline.
- Don't use it as a filter control. This one is text, not a target.

## Tokens involved

`ink-muted`, `border`, `surface-card`, `radius-full`, `space-1`, `space-2`, `body-small`.

## Port note

No prop added, removed or renamed against `index.d.ts`.
