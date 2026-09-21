# Select

A labelled dropdown with the same anatomy as **TextField** — label, helper text, error state, disabled state, `border-strong` outline.

## What you provide

`label`, `value`, `onChange` and `options` (`{ value, label, disabled? }`). Optionally `placeholder` (shown as a disabled first option while `value` is empty), `helperText`, `error`, `required`, `disabled` and an `id`.

It renders a real `<select>`, so the operating system's own picker opens — the wheel on iOS, the list on Android — which is the control this audience already knows.

## When to use it

Notification channel on the settings screen, a pharmacy branch on the refill flow, a relationship on the caregiver invite — any choice with four or more options, or one where the options are not worth showing all at once.

## When not to use it

- For two or three options that matter at a glance. Use **ChoiceGroup**, where the patient sees every choice without opening anything.
- For on/off. Use **Toggle**.
- To pick a date or a time. The schedule is computed by the deterministic layer; a patient never sets a dose time by hand.

## Do

- Put the real default in `value` rather than leaving it empty with a placeholder. A settings screen should open already answered.
- Disable it, with helper text saying why, when the value is derived — the dispensing sector comes from the prescription's source and is never a choice.

## Don't

- Don't hide the label. The chevron is not a label, and a placeholder disappears the moment a value is set.
- Don't put more than one required select in a row at phone width; stack them with `space-4`.

## Tokens involved

`surface-card`, `surface-app`, `navy`, `ink-muted`, `border-strong`, `danger`, `radius-sm`, `space-1`, `space-2`, `space-3`, and the `label` / `body` / `caption` type styles.
