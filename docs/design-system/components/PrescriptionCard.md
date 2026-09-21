# PrescriptionCard

One prescription as a row on the dashboard: brand and generic name, the issuing facility with its sector chip, the next or most recent dose with its status pill, and a chevron into the detail view.

## What you provide

`prescription` — the `Prescription` shape from the data contract, or at least its `drug` and `source` objects. Optionally `dose` (`{ status }`, the next or most recent one), `doseTimeLabel` (already formatted — this component does no date maths and calls no scheduler), `strengthUnit`, `onOpen` and `lang`.

`onOpen` is what makes the whole card a button and adds the chevron. Leave it off in the caregiver's read-only view of a prescription that has no detail screen behind it.

## When to use it

The dashboard's active-prescription list, the refill screen's per-prescription rows, and the caregiver view — which must render exactly the same underlying data as the patient's, since a discrepancy between the two is a failure of the whole caregiver feature.

## When not to use it

- For the full prescription record. The detail screen shows every field, including the nullable pharmacist ones, with **DetailRow**.
- For a dose in a schedule list. A dose is not a prescription; a row with a **StatusPill** and a time is enough.

## Do

- Set the brand name first in `body-strong` with the strength, and the generic underneath in `body-small`/`ink-muted` — this is the exact pair patients lose between the clinic and home, and the brand actually dispensed may differ from the prescribed generic.
- Keep a Latin drug name readable inside Arabic copy: the card lays out with logical properties, so the row flips wholesale under `dir="rtl"` while "Metformin 500" keeps its own order.
- Handle a prescription with no dose yet — pass `dose={null}` and the status row is simply absent rather than empty.

## Don't

- Don't colour the card by status. The **StatusPill** carries the dose state; a red-edged card would spend the `danger` budget that belongs to the interaction alert and would tell a colour-blind patient nothing.
- Don't put the refill action inside the card. A card that is itself a button cannot hold another button; put the action on the detail or refill screen.
- Don't hide the sector to save a line. Public versus private is what decides refill routing, and it is the one piece of provenance the patient can act on.

## Tokens involved

`surface-card`, `navy`, `ink-muted`, `border`, `navy-tint`, `radius-md`, `shadow-sm`, `space-1`, `space-2`, `space-3`, and the `body-strong` / `body-small` / `label` type styles — plus every token **StatusPill** and **SectorChip** bring with them.
