# TabBar

The product's top-level navigation: a bottom bar at phone width, a side rail from tablet width up.

## What you provide

`items` (`{ id, label, icon, badge?, href? }`), `value` — the active item's id — and `onChange(id)`.
Optionally `layout` (`auto` by default; force `bottom` or `side` for a fixed layout or a preview) and
`label`, the accessible name of the navigation landmark.

`auto` switches at 834px, which is the tablet width the screens are drawn at.

## When to use it

Once per screen, for the top-level destinations of the shell the screen belongs to. There are three
shells, and each has its own item set (**G8**):

| Shell | Items |
|---|---|
| Patient | اليوم · أدويتي · السلامة · المزيد (4) |
| Caregiver | اليوم · الأدوية · المزيد (3) |
| Clinic | مراجعة · تدقيق (2) |

Refills, the drug check, the calendar, the activity log, settings, help and the messaging link live
**under المزيد**, not in the bar. The caregiver shell does **not** reuse the patient's items: it has
three of its own, because the surfaces it can reach are fewer — a caregiver bar carrying السلامة
would promise a screen the role cannot open.

## When not to use it

- For steps in a flow. The refill request is a **Sheet** over the screen that started it, not a tab.
- For filtering a list. That is a **ChoiceGroup**.
- For more than the shell's own item count. A fifth patient destination means the information
  architecture needs a decision, not a smaller tap target — the overflow is المزيد, which already
  exists. **This port refuses a 5th item at the type level** (`items` is a `[T,T]|[T,T,T]|[T,T,T,T]`
  tuple union), not only by convention.
- For a destination a role cannot reach. The bar is built from the signed-in role's shell, never
  filtered down from a larger one, so a disabled or hidden tab never appears.

## Do

- Always show the label under the icon. An icon-only bottom bar asks an elderly patient to learn
  four glyphs, and this product cannot afford a guess.
- Keep `badge` for counts that need acting on — refills due — and off everything else.

## Don't

- Don't signal the active item by colour alone. It carries a `navy-tint` background, a `navy`
  indicator bar along the leading edge, and `aria-current="page"`; the colour is the third signal,
  not the first.
- Don't hide it on a nested screen. The patient should always be able to get back to their
  medications in one tap.

## Tokens involved

`navy`, `navy-tint`, `ink-muted`, `surface-card`, `border`, `danger`, `on-fill`, `radius-sm`,
`radius-full`, `space-1`, `space-2`, `space-3`, `space-4`, and the `label` / `caption` type styles.

## Port notes (WP2d)

- **Prop addition: `href?: string` on a `TabBarItem`.** This is the one permitted addition against
  `index.d.ts` (recorded in the WP2d report). `index.d.ts`'s `onChange` alone cannot express
  navigation under the App Router — a tab needs a real `<a href>` for the browser's own navigation,
  back/forward and "open in a new tab" to work. When `href` is present the item renders as a link;
  `onChange` still fires on click (if supplied) so a consumer can keep local `value` state in sync
  with the route without waiting on a route-change effect.
- Active item gets all three signals from `bundle.css` automatically (`.wsf-tabs__item[aria-current="page"]`
  sets the `navy-tint` background and colour; the `::after` pseudo-element draws the leading-edge
  indicator) — the component only sets `aria-current="page"`, never inline colour.
- **Badge accessible name.** `badge`'s glyph is `aria-hidden`; the item's accessible name becomes
  `"{item.label} {item.badge}"` — built entirely from the consumer's own `label` and the numeral, no
  invented word ("items", "due", …) is introduced. This is the "assistive suffix from the consumer's
  label" the WP2d brief calls for.
