# Toggle

`components/ui/Toggle.tsx` — the settings switch: a label, an optional description line, and a
state that is written in words (`On`/`Off`, from `copy.vocabulary`) as well as shown by the knob's
position. A real `role="switch"` control, not a styled checkbox. Client component.

## What you provide

`label`, `checked` and `onChange(next)` — controlled, like every other form control here.
Optionally `description` (one line under the label), `disabled`, `id` and `lang` for the built-in
On/Off wording.

## When to use it

Only the four settings the Feature Toggle Policy allows: daily adherence check-in, refill alerts,
calendar sync, and — as a pair with **Select** or **ChoiceGroup** — the channel that check-in uses.

## When not to use it

- For the dashboard, interaction screening, or the schedule and extraction engine. There is no
  toggle for these, not even a disabled one.
- For a choice between two named things. "WhatsApp or email" is a **ChoiceGroup**, not a switch —
  a switch would make one of them the absence of the other.
- For an action. Requesting a refill is a **Button**.

## Do

- Use `description` for the soft warning a muted check-in needs: turning the daily check-in off
  reduces adherence-tracking accuracy, and the patient should read that before flipping it, not
  after.
- Keep the label a noun phrase and the description a sentence.

## Don't

- Don't remove the On/Off word. Knob position plus colour is two signals, but only one survives a
  colour-blind reading and a low-contrast screen in sunlight; the word is what makes the state
  unambiguous. This port marks that word `aria-hidden`, because the button's own `aria-checked`
  already announces the state to assistive technology — the word is for sighted reading only.
- Don't animate it beyond the built-in 120ms (`.wsf-switch`), and never past
  `prefers-reduced-motion` — the bundle handles both; this port adds no motion of its own.

## Tokens involved

`navy`, `on-fill`, `surface-card`, `border-strong`, `ink-muted`, `radius-full`, `radius-sm`,
`space-1`–`space-5`, and the `body-strong` (label) / `body-small` (description) / `label` (on/off
word) type styles.
