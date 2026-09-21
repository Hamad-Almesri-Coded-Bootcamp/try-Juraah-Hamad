# ScheduleGroup

The clock-time header grouping one time's `DoseRow`s — correct with one row and with several.

## What you provide

`timeLabel` (already formatted, e.g. "8:00 AM" / "٨:٠٠ ص" — no date maths done here) and `children` (one or more `DoseRow`s).

## When to use it

The Today schedule: one `ScheduleGroup` per distinct dose time, in chronological order.

## When not to use it

- For a history list. That is **DoseTimeline**.
- To group anything that is not a set of doses sharing one clock time.

## Read-only rule (G1)

**ScheduleGroup is read-only by contract.** It groups and labels; it offers no affordance of its own, and it must never gain one — a "mark all taken" control on this header would be the core safety rule broken through the one place that looks like a natural home for it.

## Do

- Keep every `DoseRow` inside one `ScheduleGroup` at the same clock time.
- Let each `ScheduleGroup` label itself via `aria-labelledby`, so assistive technology announces the time before the rows.

## Don't

- Don't add a control to the header, ever.
- Don't mirror the clock glyph under `dir="rtl"` — it depicts a real-world object, not a direction.

## Tokens involved

`ink-muted`, `border`, `space-1`, `space-2`, `label`.

## Accessibility note

The header is not a document heading (the product has only `h1`/`h2`); it is a labelled group landmark, wired with `aria-labelledby` to a generated id rather than a semantic `<h3>`.
