# SectorChip

Marks a prescription as public- or private-sector in `ink-muted` inside a `border` chip — a provenance label, never a status.

## What you provide

`sector` — `public` or `private`, straight from `Prescription.source.sector`. Optionally `lang` for the built-in word, or `label` to name a specific kind of facility ("Government centre", "مركز حكومي").

## When to use it

Beside the issuing facility's name: on a **PrescriptionCard**, in the prescription detail header, and on the refill screen where the sector decides the routing destination. It is the visible trace of the fragmentation this platform exists to reconcile — a patient seeing a public chip and a private chip in one list is seeing the problem and the fix at once.

## When not to use it

- For anything that changes over time. A sector is a fact about where a prescription came from; a dose state is not, and belongs to **StatusPill**.
- As the confirmation that a refill was routed correctly. Say the destination in words on the confirmation; the chip only says where the prescription came from.

## Do

- Keep it next to the facility name, in `body-small`, so the two read as one phrase.
- Use `label` when the real facility type is more useful than the bare sector, and keep it as short as the built-in words.

## Don't

- Don't give it `success`, `warning` or `danger`. Public is not safer than private and private is not more urgent than public; a semantic colour here would say something clinical that is not true, and it would spend part of the 5–10% cap `danger` lives under.
- Don't fill it. The chip is `surface-card` inside a `var(--border)` hairline — the quietest thing on the card, sitting below the drug name in `body-strong` and the status pill.
- Don't use it as a filter control. A chip that can be tapped needs a 44×44px target and a pressed state; this one is text.

## Tokens involved

`ink-muted`, `border`, `surface-card`, `radius-full`, `space-1`, `space-2`, and the `body-small` type style.
