# CopyField

`components/ui/CopyField.tsx` — a read-only value with a copy action and a copied confirmation. One
of the eleven components `Build Prompts.md` prompt 1 specifies; its own token-only stylesheet is
`components/ui/styles/CopyField.css`.

## What you provide

`label` and `value` (the string to copy). Optionally `copyLabel`, `copiedLabel`, `lang` and
`className`. There is no `onCopy` — the component owns the copied/not-copied timing itself
(`navigator.clipboard.writeText`, then a few seconds of confirmation) because nothing about that
timing is ever a business decision a screen needs to make.

## When to use it — and, more importantly, when not to

**This component exists for exactly one value in the whole product: the per-patient `webcal://`
calendar link on E1.** It is never for anything else, and above all never for an identifier. Per
the brand book: *"CopyField is for a link a person is meant to use, never for an identity."* A
Civil ID, a chat id, a link token shown on its own, a push endpoint or a role string never passes
through this component or any other — see G9 and CLAUDE.md rule 7. If a future screen wants to let
someone copy a value, that is the moment to stop and ask whether the value is a technical
identifier in disguise, not to reach for this component by habit.

## When not to use it

- For an identifier of any kind (see above — this is the rule, not a style preference).
- For an editable value. The input is `readOnly`; if the patient needs to change it, it is a
  **TextField**.
- For a value with no natural "copy this to paste it somewhere else" use. Most facts on a detail
  screen are a **DetailRow**, not a CopyField.

## Do

- Keep the input `dir="ltr"` regardless of the surrounding page direction — a `webcal://` URL
  reads left-to-right in both languages.
- Give the copy confirmation a `role="status"` (`aria-live="polite"`) so it is announced without
  stealing focus, and let it clear itself after a few seconds rather than staying up forever.
- Use a genuinely placeholder-shaped token in any preview or demo of this component — never a
  real, guessable calendar-link token (the gallery does this; screens read the real value from the
  data layer at runtime).

## Don't

- Don't use it for anything not named above. This is the strict reading, not a suggestion.
- Don't add an `onCopy` prop or otherwise let a screen control the copied-state timing — that
  belongs to the component so every use of it behaves the same way.

## Tokens involved

`navy`, `surface-card`, `border-strong` (via the reused `.wsf-input` class), `ink-muted`,
`radius-sm`, `space-1`, `space-2`, `--ring`/`--ring-gap`, and the `label` / `body` (value) /
`caption` (status) type styles.
