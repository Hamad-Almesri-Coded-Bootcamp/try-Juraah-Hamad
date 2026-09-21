# TextField

A labelled single-line input with helper text, an error state and a disabled state, outlined in `border-strong`.

## What you provide

`label` and `value`, plus an `onChange` — this is a controlled input and holds no state of its own. Optionally `placeholder`, `helperText`, `error` (a message; truthy switches the field into its error state), `required`, `disabled`, `type`, `inputMode`, `autoComplete`, and `dir` to force one field's direction inside a screen that runs the other way. An `id` is generated if you don't pass one, and the label, the input and the note underneath are wired together for you.

## When to use it

Any free-text or numeric entry the patient or caregiver makes: the Civil ID on the verification screen, a caregiver's name or phone on the invite flow, a medication name in a search box.

## When not to use it

- For a fixed set of options. Use **Select**, or **ChoiceGroup** when there are two or three and the choice is worth seeing at a glance.
- For an on/off setting. Use **Toggle**.
- For read-only prescription facts on the detail screen. Use **DetailRow** — a disabled input reads as something the patient could have edited, which a dispensed prescription is not.

## Do

- Set `dir="ltr"` on a Civil ID, a phone number or a Latin drug name inside an Arabic screen, so the digits and letters keep their own order while the label and helper text stay in Arabic.
- Write the error as what to do next, not just what failed: "This Civil ID is not in the demo record set" beats "Invalid input". The message carries a warning glyph and `role="alert"`, so the danger outline is never the only signal.
- Keep `helperText` to one line in `caption`/`ink-muted`, and put anything longer above the field.

## Don't

- Don't use `border` for the outline. A control boundary needs 3:1 and only `border-strong` holds it; `border` is for dividers and card edges.
- Don't set placeholder text in place of a label — a placeholder in `ink-muted` disappears the moment the patient types, and for this audience that is the label gone.
- Don't shrink the input below `body` (17px) or below the 44px minimum height. The base size sits above the usual 14–16px because of who uses this.

## Tokens involved

`surface-card`, `surface-app`, `navy`, `ink-muted`, `border-strong`, `danger`, `radius-sm`, `space-1`, `space-2`, `space-3`, and the `label` / `body` / `caption` type styles.
