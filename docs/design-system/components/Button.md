# Button

The system's standard action control, in four variants and two sizes, with a 44×44px minimum box at every size.

## What you provide

`variant` (`primary` · `secondary` · `danger` · `quiet`, default `primary`), `size` (`md` · `lg`), the label as children, and an `onClick`. Optionally `icon` (a name from the bundle's outline set), `mirrorIcon` for a glyph that encodes direction, `fullWidth`, `loading`, `disabled`, and `lang` for the screen-reader "Loading" text. Everything else passes through to the underlying `<button>`, so `type`, `form` and `aria-*` work as usual.

You always write the label yourself. The component never translates, never truncates and never uppercases — `label` carries its letter-spacing in English and nothing else, per the brand book's rule about Arabic having no letter case.

## When to use it

- `primary` — the one action the screen exists for: request a refill, send a prescription for review, accept a caregiver invitation. One per screen, in `navy`.

  **Never** a button that writes a dose status. Under **G1** nothing in the interface — not a button, a checkbox, a swipe, a long-press or a notification action — may write `Dose.status`; that path belongs to the adherence agent alone. “Taken”, “I took it”, “mark as missed” and “snooze this dose” are not buttons in this system, and their absence is the product’s central claim, not an omission to be fixed.
- `secondary` — the alternative that a patient might reasonably take instead: view details, choose another pharmacy. Its `border-strong` outline is the only border in this system that meets the 3:1 a control boundary needs.
- `danger` — an action that removes or stops something: discontinue a medication, revoke a caregiver's access. Never for "submit" and never as decoration; `danger` is capped at 5–10% of a screen and belongs first to the interaction alert.
- `quiet` — dismiss, "not now", a tertiary link-like action inside a card.

## When not to use it

- For an icon-only control. Use **IconButton**, which keeps the hit area without a visible label.
- For navigation between top-level sections. Use **TabBar**.
- Inside a `danger` **InteractionAlert** as a `primary` button — navy on red is not a checked pair. The alert restyles `secondary` and `quiet` to `on-fill` for exactly this reason; use those.

## Do

- Give `size="lg"` with `fullWidth` to the primary action at phone width. The primary audience is elderly, and a full-width 52px target is the reason this variant exists.
- Keep `loading` on the button that was pressed, and leave its label in place — the spinner replaces the leading icon, not the words.
- Pass `mirrorIcon` on a chevron or the calendar-subscribe arrow, and leave it off a capsule, a clock or a checkmark.

## Don't

- Don't set a colour, radius or font size on a button. `primary` is `var(--navy)` on `var(--on-fill)`, `danger` is `var(--danger)` on `var(--on-fill)`, both at `var(--radius-md)`; the hover state darkens the fill rather than reaching for a colour the palette does not have.
- Don't rely on `disabled` alone to explain why an action is unavailable — say so in helper text or an **InlineNotice** beside it.
- Don't put two `primary` buttons on one screen. If both actions matter equally, one of them is `secondary`.
- Don't build a dose-status control in any variant, however it is worded. See the **G1** note above — this is the one rule in the system that no screen, state or role may relax.

## Tokens involved

`navy`, `navy-soft`, `navy-tint`, `danger`, `on-fill`, `border-strong`, `radius-md`, `space-2`, `space-3`, `space-4`, and the `label` / `body-strong` type styles.
