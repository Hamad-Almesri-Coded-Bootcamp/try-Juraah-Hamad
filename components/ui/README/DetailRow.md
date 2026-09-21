# DetailRow

A label-and-value pair, built so that a missing value never breaks the layout and never prints "undefined".

## What you provide

`label` and `value`. `value` may be `null`, `undefined` or an empty string — every nullable field in the `Prescription` contract will be exactly that at some point. Optionally `emptyMark` (the em dash it draws instead) and `emptyLabel` (what a screen reader hears in its place — defaults to `copy.vocabulary.empty`), and `lang` (default `'en'`).

**No component ever renders a Civil ID back to the screen through this row**, masked or whole (CLAUDE.md rule 6). Do not pass one.

## When to use it

The prescription detail screen, field by field, including the whole pharmacist-entered `dispensing` block. Also inside a **Sheet** to restate what an action is about to do.

## When not to use it

- For something the patient can change. That is a **TextField** or a **Select**.
- For a dose status. That is a **StatusPill**.
- For a number the patient is meant to judge at a glance, like remaining supply. That is a **DepletionMeter**.
- For an identifier of any kind — a chat id, a link token, a push endpoint, a role string, a Civil ID.

## Do

- Render every field the contract defines, present or not.
- Keep the label in `label`/`ink-muted` above the value in `body`/`navy`.

## Don't

- Don't collapse an empty row, and don't hide the block it sits in.
- Don't put the em dash in `navy` — it takes `ink-muted`.

## Tokens involved

`navy`, `ink-muted`, `border`, `space-1`, `space-3`, `label` / `body`.

## Port note

No prop added, removed or renamed against `index.d.ts`.
