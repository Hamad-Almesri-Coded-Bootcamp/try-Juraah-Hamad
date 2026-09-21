# DepletionMeter

Remaining quantity and days to depletion for one prescription, written out as numbers and drawn as a bar behind them.

## What you provide

`remaining` and `total` — both from `dispensing`, and both already computed. Optionally `label`, `unit`, `daysRemaining` (from the deterministic depletion forecast; `null` when the prescription has not been dispensed or the forecast is unavailable), `lowAtDays` (7 by default), and `lang` (default `'en'`).

This component does no arithmetic. Depletion is plain maths owned by the schedule layer, never by a model and never by a view.

## When to use it

The refill screen, once per prescription, above its Request refill action.

## When not to use it

- For adherence. A meter of doses taken against doses scheduled is a different idea and is not this component.
- For anything without a dispensed total. With no `dispensing` record there is no denominator; show the prescription without a meter and say it has not been dispensed yet.

## Do

- Pass `daysRemaining` whenever you have it.
- Keep `lowAtDays` at 7 unless the prescription's own refill window says otherwise.

## Don't

- Don't let the bar be the only signal. The count is always written above it, and the low state adds a warning glyph and the "Running low" word.
- Don't paint a low meter in `danger`. Running out of a repeat prescription is a `warning` event.

## Tokens involved

`navy`, `warning`, `border`, `ink-muted`, `radius-full`, `space-2`, `body-strong` / `body-small`.

## Port note

`role="progressbar"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax` and `aria-labelledby` pointing at the always-present count (and the label, when given) — not `role="meter"`, which lacks the assistive-technology support this component needs. No prop added, removed or renamed against `index.d.ts`.
