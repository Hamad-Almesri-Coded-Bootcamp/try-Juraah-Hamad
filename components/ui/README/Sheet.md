# Sheet

A focused overlay: a bottom sheet at phone width, a centred modal from tablet width up, at
`radius-lg` and `shadow-md`.

## What you provide

`open`, `title`, and the content as children. Optionally `onClose` with `closeLabel` (**required**
whenever `onClose` is set — the port narrows `SheetProps` to a discriminated union so this is a type
error, not just a documented rule, matching the same treatment `AppBar` gives `backLabel`), `footer`
(its buttons), and `mode` (`auto` by default; force `sheet` or `modal`).

It renders nothing when `open` is false. It positions itself against the nearest positioned
ancestor, so the screen it belongs to needs `position: relative`.

## When to use it

Confirming a refill request and showing where it routes. Inviting a caregiver. Revoking a
caregiver's access. The subscribe instructions on the calendar screen. Anything that needs a
decision before the screen underneath makes sense again.

## When not to use it

- For an interaction alert. A `danger` alert belongs on the dashboard, above the prescriptions,
  where the patient meets it without having to open anything — and a sheet can be dismissed, which
  an interaction cannot.
- For a whole screen's worth of content. If the patient will scroll it, it is a screen.
- Two at once. One sheet per artboard, one decision at a time.

## Do

- Restate what is about to happen, with **DetailRow**, before the confirming button. A refill sheet
  names the drug and the pharmacy it will reach, so the sector routing is visible before it is
  committed, not after.
- Put the confirming action first in `footer` and the way out second; both stretch to fill the row
  at phone width (`.wsf-sheet__foot > *` handles the stretch).

## Don't

- Don't reach for `radius-lg` and `shadow-md` anywhere else. Together they belong to this, to
  modals, and to the `danger` interaction alert — nothing else in the product floats.
- Don't make the scrim decorative. It is a real button labelled with `closeLabel`, so a patient who
  taps beside the sheet gets out, and the keyboard can reach the same escape.

## Tokens involved

`surface-card`, `navy`, `border`, `radius-lg`, `shadow-md`, `space-2`, `space-3`, `space-4`,
`space-6`, and the `h2` type style.

## Behaviour (a real modal dialog)

`role="dialog"` `aria-modal="true"`, `aria-labelledby` pointing at the title. Focus moves to the
first focusable control on open (the close button when present, otherwise the panel itself) and is
trapped inside while open (Tab cycles from the last focusable back to the first, and back). Escape
and a scrim click both call `onClose` when it is supplied. The scrim carries `tabIndex={-1}`: it is
a real, labelled, clickable button (Sheet.md's own "Don't"), but never a Tab stop — the focus trap
already keeps Tab inside the panel, so the scrim is pointer/touch-only by design, the same as most
dialog scrims. Body scroll is locked (`overflow: hidden` on `<body>`) while open and restored on
close. Focus returns to whatever had it before the sheet opened. There is no submit of its own —
dismissing it changes nothing.

## Port notes (WP2d)

- **Close control stand-in.** group a's `IconButton` is not built yet, so the close control uses the
  same fuller stand-in class list `AppBar` does: `wsf-btn wsf-btn--quiet wsf-iconbtn wsf-focus`, not
  the brief's literal minimal snippet (`.wsf-iconbtn` alone carries no colour or centring). Swap in
  the real `IconButton` once it ships.
- **Motion gap.** The WP2d brief calls for "240ms motion collapsing under reduced motion" on
  open/close. `docs/design-system/bundle.css`'s Sheet section (`.wsf-sheet-root`, `.wsf-sheet`, …)
  defines no transition or animation at all — only `Button`'s spinner, `Toggle`'s knob and
  `LoadingState`'s skeleton pulse get motion in the whole bundle. Since a ported component "adds no
  CSS of its own" (common brief), no transition was added here; Sheet opens and closes without
  animation, as the bundle ships it. Flagged for the owner rather than invented.
- **Prop addition: none.** `SheetProps` is exactly `open`, `onClose`, `title`, `mode`, `footer`,
  `closeLabel`, `children`, `className` from `index.d.ts` — narrowed to a discriminated union, not
  changed.
