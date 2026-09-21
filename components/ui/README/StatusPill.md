# StatusPill

The four dose statuses from the data contract, each rendered as its own glyph and its own word so hue is never the only signal.

## What you provide

`status` — one of `upcoming`, `taken_on_time`, `taken_late`, `missed`, straight from `Dose.status`. Optionally `lang` to pick the built-in Arabic or English word (default `'en'`), or `label` to supply your own. The glyph is chosen by status and cannot be turned off.

## When to use it

Wherever a single dose's state is shown: on a **PrescriptionCard**, inside a **DoseRow** or **DoseTimeline** row, and in the caregiver's read-only view of the same data. **`StatusPill` is rendered only when the dose is tracked** — `DoseRow` and `DoseTimeline` decide this by `Dose.tracked`, never by the status word.

## When not to use it

- For a prescription's `status` (`active` / `completed` / `discontinued`). That is not a dose state and has no pill.
- For `source.sector`. Use **SectorChip**.
- For an interaction's `severity` or `reviewStatus`. Those belong to **AlertRow** / **InteractionAlert**.
- For an untracked dose. An untracked dose carries **no status token at all** — not this component, not a grey placeholder.

## Do

- Keep `upcoming` unfilled — `ink-muted` text inside a `border-strong` outline.
- Use the built-in words where you can.

## Don't

- Don't recolour a status. `taken_on_time` is `success`, `taken_late` is `warning`, `missed` is `danger`.
- Don't drop the word to save space. The glyph and the word are the accessible signal; the fill is the reinforcement.

## Tokens involved

`success`, `warning`, `danger`, `on-fill`, `ink-muted`, `border-strong`, `radius-full`, `space-1`, `space-2`, `label`.

## Port note

Root carries `data-testid="status-pill"` — the runtime proof that a component decides the pill by `tracked`, not by `status`, reads this attribute. No prop added, removed or renamed against `index.d.ts`.
