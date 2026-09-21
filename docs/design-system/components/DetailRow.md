# DetailRow

A label-and-value pair for the prescription detail screen, built so that a missing value never breaks the layout and never prints "undefined".

## What you provide

`label` and `value`. `value` may be `null`, `undefined` or an empty string — every nullable field in the `Prescription` contract will be exactly that at some point. Optionally `emptyMark` (the em dash it draws instead) and `emptyLabel` (what a screen reader hears in its place).

## When to use it

The prescription detail screen, field by field, including the whole pharmacist-entered `dispensing` block. Also inside a **Sheet** to restate what an action is about to do.

## When not to use it

- For something the patient can change. That is a **TextField** or a **Select**.
- For a dose status. That is a **StatusPill**.
- For a number the patient is meant to judge at a glance, like remaining supply. That is a **DepletionMeter**.

## Do

- Render every field the contract defines, present or not. A row reading "Special notes — —" tells the patient the prescriber wrote nothing; a row that vanishes tells them nothing at all, and hides the difference between "no notes" and "we lost the notes".
- Keep the label in `label`/`ink-muted` above the value in `body`/`navy`. Stacked rather than columned, because Arabic field names run long and the patient is reading on a phone.

## Don't

- Don't collapse an empty row, and don't hide the block it sits in. A prescription that has not been dispensed yet still shows its dispensing section, each row empty.
- Don't put the em dash in `navy` — an empty value is secondary information and takes `ink-muted`, which is exactly what the component does.

## Tokens involved

`navy`, `ink-muted`, `border`, `space-1`, `space-3`, and the `label` / `body` type styles.
