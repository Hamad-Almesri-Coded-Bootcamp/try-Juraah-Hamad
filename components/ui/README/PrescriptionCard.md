# PrescriptionCard

One prescription as a row: brand and generic name, the issuing facility with its sector chip, the next or most recent dose with its status pill, and a chevron into the detail view.

## What you provide

`prescription` — the `PrescriptionSummary` shape (`drug`, `source`). Optionally `dose` (`{ status }`, the next or most recent one; omit or pass `null` and the status row is simply absent), `doseTimeLabel` (already formatted — this component does no date maths and calls no scheduler), `strengthUnit` (default `' mg'`), `onOpen` and `lang`.

`onOpen` is what makes the whole card a button and adds the chevron. Leave it off in the caregiver's read-only view of a prescription that has no detail screen behind it.

## When to use it

The dashboard's active-prescription list, the refill screen's per-prescription rows, and the caregiver view — which must render exactly the same underlying data as the patient's, since a discrepancy between the two is a failure of the whole caregiver feature.

## When not to use it

- For the full prescription record. The detail screen shows every field, including the nullable pharmacist ones, with **DetailRow**.
- For a dose in a schedule list. A dose is not a prescription; use **DoseRow**.

## Do

- Set the brand name first in `body-strong` with the strength, and the generic underneath in `body-small`/`ink-muted`.
- Handle a prescription with no dose yet — pass `dose={null}` (or omit it) and the status row is simply absent rather than empty.

## Don't

- Don't colour the card by status. **StatusPill** carries the dose state; a red-edged card would spend the `danger` budget that belongs to the interaction alert.
- Don't hide the sector to save a line. Public versus private decides refill routing.

## Tokens involved

`surface-card`, `navy`, `ink-muted`, `border`, `navy-tint`, `radius-md`, `shadow-sm`, `space-1`, `space-2`, `space-3`, `body-strong` / `body-small` / `label` — plus every token **StatusPill** and **SectorChip** bring with them.

## Port note

`strengthUnit` is appended after `strengthMg` exactly as written, never converted (Levothyroxine, `rx-008`, is `strengthMg: 50, strengthUnit: "mcg"` — never `0.05`; the boards' `renderVals()` block carries the wrong `0.05` value and is not the source of truth). `index.d.ts` has no `aria-label` prop on `PrescriptionCardProps`, so a button card falls back to its full visible text as its accessible name — reported in `docs/backend-notes/wp2b.md` as a prop gap, not invented here.
