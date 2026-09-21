# AppBar

The screen's header: a `navy` bar carrying the screen title, an optional back action whose chevron
mirrors in RTL, and one optional trailing action.

## What you provide

`title` — the screen's one `h1`. Optionally the back control — `backHref` for a real link, or
`onBack` for a handler — with `backLabel` (**required** whenever either is set: the port narrows
`AppBarProps` to a discriminated union so this is a type error, not just a documented rule); and
`action`, a single **IconButton** or quiet **Button**.

## When to use it

At the top of every screen. A shell's top-level screens — اليوم, أدويتي, السلامة and المزيد for a
patient; مراجعة and تدقيق for the clinic — take a title and no back action, since the **TabBar** is
how the person moves between them. Nested screens — prescription detail, interaction alert detail,
caregiver invite — take the back action.

## When not to use it

- Inside a **Sheet**. A sheet has its own header with its own close control.
- Twice on one screen. `h1` appears once per screen, and this is where it lives.

## Do

- Let the back chevron mirror. It encodes direction, so it flips with `dir`; the gear, camera,
  capsule and clock beside it never do.
- Write `backLabel` as a destination — "Back to medications", "رجوع للوحة الأدوية" — so a screen
  reader announces where the patient will land.
- Let a long title truncate. The bar holding its height matters more than the last three words of a
  facility name, and the full name is in the content below.

## Don't

- Don't put two actions in the trailing slot. One, or none.
- Don't set colours on what sits inside it. The bar is `navy`, its contents are `on-fill` at
  14.3:1, and its quiet buttons hover to `navy-soft` — all handled by the bundle's
  `.wsf-appbar .wsf-btn--quiet` rule.
- Don't use it as a place for status. A dose status belongs beside its dose.

## Tokens involved

`navy`, `navy-soft`, `on-fill`, `space-2`, `space-3`, and the `h1` type style.

## Port notes (WP2d)

- Renders a `<header class="wsf-appbar">`; the title is `<h1 class="wsf-appbar__title type-h1">`.
  No explicit `role="banner"` is set — a top-level `<header>` carries that role implicitly, and the
  common brief's rhetorical "role="banner"? The bar is a `<header>`" reads as confirming the
  implicit role is enough.
- **Back control stand-in.** group a's `IconButton` is not built yet at the time of this port, so
  the back control is the plain-element stand-in the brief names, but with the fuller class list
  that actually reproduces `IconButton.md`'s anatomy: `wsf-btn wsf-btn--quiet wsf-iconbtn wsf-focus`
  (`.wsf-iconbtn` alone sets only the 44px hit area — no colour, radius or centring — so the base
  `.wsf-btn`/`.wsf-btn--quiet` classes are needed too). Swap in the real `IconButton` once group a
  ships it; the props and behaviour do not change.
- **Prop addition: none.** `AppBarProps` is exactly `title`, `onBack`, `backHref`, `backLabel`,
  `action`, `className` from `index.d.ts` — narrowed to a discriminated union (see above) rather
  than adding or renaming anything.
