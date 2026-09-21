# ChoiceGroup

`components/ui/ChoiceGroup.tsx` — a set of mutually exclusive options shown all at once: a
segmented control for two or three short labels, or a radio list when the options need a line of
explanation. Client component: it holds the radio inputs' `onChange`.

## What you provide

`name` (required — it groups the inputs for the keyboard and for assistive technology), `label`,
`value`, `onChange(next)` and `options` (`{ value, label, description?, disabled? }`). Optionally
`variant` (`segmented` by default, or `radio`), `helperText` and `disabled`.

It renders real `<input type="radio">` elements inside a `<fieldset>`, adjacent siblings of their
`<label>` (the same pattern the bundle uses for `:checked + .wsf-cg__opt`), so arrow keys move
between options exactly as a patient's screen reader expects — no keyboard handling of this port's
own.

## When to use it

Adherence check-in frequency — daily or every other day — as a segmented control. Notification
channel as a radio list, where each option earns a line saying what it means in practice.

## When not to use it

- For more than four options. Use **Select**.
- For something that can be both on and off *and* configured. Pair a **Toggle** with this, rather
  than inventing an "off" option inside the group.

## Do

- Order the options the way the patient would say them, and put the recommended one first with its
  reason in `description`.
- Keep segmented labels to two or three words so they survive Arabic, English and a 390px screen.

## Don't

- Don't rely on the fill to say which option is chosen. The selected option carries a check glyph
  — in the circle for `radio`, beside the label for `segmented` — and the radio variant thickens
  its border to `var(--line-2)` as well.
- Don't uppercase or letter-space the Arabic labels.
- `description` only renders for the `radio` variant — a segmented row has no room for it, and the
  design system ties description text to the stacked layout.

## Tokens involved

`navy`, `navy-tint`, `on-fill`, `surface-card`, `border-strong`, `ink-muted`, `radius-sm`,
`radius-full`, `space-1`, `space-2`, `space-3`, and the `label` (legend) / `body` (option label) /
`body-small` (description) type styles.
