# StatusPill

The four dose statuses from the data contract, each rendered as its own glyph and its own word so hue is never the only signal.

## What you provide

`status` — one of `upcoming`, `taken_on_time`, `taken_late`, `missed`, straight from `Dose.status`. Optionally `lang` to pick the built-in Arabic or English word, or `label` to supply your own. The glyph is chosen by status and cannot be turned off.

## When to use it

Wherever a single dose's state is shown: on a **PrescriptionCard**, beside a row in the dose history, at the head of the dose detail, and in the caregiver's read-only view of the same data.

## When not to use it

- For a prescription's `status` (`active` / `completed` / `discontinued`). That is not a dose state and has no pill.
- For `source.sector`. Use **SectorChip**, which is deliberately `ink-muted` in a `border` chip and must never take a semantic colour.
- For an interaction's `severity` or `reviewStatus`. Those belong to **InteractionAlert**, which carries far more weight than a pill.

## Do

- Keep `upcoming` unfilled — `ink-muted` text inside a `border-strong` outline. A scheduled dose is not an achievement and should not read as one.
- Put the dose time beside the pill in `body-small`, not inside it. The pill says what happened; the row says when.
- Use the built-in words where you can. "Taken late" / "أُخذت متأخرة" is the wording the Adherence Agent's replies map onto.

## Don't

- Don't recolour a status. `taken_on_time` is `success`, `taken_late` is `warning`, `missed` is `danger`, and `success` sits off the red–green axis on purpose so a red–green colour-blind patient can still separate a taken dose from a missed one.
- Don't drop the word to save space. Two pills that differ only by hue are two pills a colour-blind patient cannot tell apart — the glyph and the word are the accessible signal, the fill is the reinforcement.
- Don't stack more than one pill in a row. If a prescription has several doses worth showing, that is a list, not a cluster of pills.

## Tokens involved

`success`, `warning`, `danger`, `on-fill`, `ink-muted`, `border-strong`, `radius-full`, `space-1`, `space-2`, and the `label` type style.
