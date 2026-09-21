# Card

The base surface every grouped block in the product sits on: `surface-card`, `radius-md`, `shadow-sm`, `space-3` padding.

## What you provide

The content, as children. Optionally `onClick` (which turns the whole card into a `<button>` and needs an `aria-label` saying where it goes), `as` to force a different element, `href` with `as="a"`, and `flat` to drop the shadow for a card nested inside another surface.

## When to use it

Any self-contained block on a screen: the next-dose summary, a caregiver row, the dispensing sub-section of the prescription detail, a settings group. **PrescriptionCard** is built on it and should be used instead wherever the content is a prescription.

## When not to use it

- For a safety message. An **InteractionAlert** at `danger` is a full `danger` fill at `radius-lg` and `shadow-md`, and it must out-weigh every card on the screen.
- For a modal or a bottom sheet. Use **Sheet**, which also carries `radius-lg` and `shadow-md`.
- As a page background. `surface-app` is the ground; a card that fills the viewport is just a differently coloured page.

## Do

- Separate stacked cards with `space-4`, and keep the page gutter at `space-3` on a phone and `space-5` from tablet width up.
- Give a tappable card an `aria-label` that names the destination — "Amlodipine 5 mg — open details" — because the card's own text is several lines and a screen reader will otherwise read all of them as the link name.
- Use `flat` for a card inside a card, so the elevation stays a single step.

## Don't

- Don't reach for `shadow-md`. Together with `radius-lg` it is reserved for the interaction alert, modals and sheets; a card that borrows it starts competing with the one element that must never be out-shouted.
- Don't tint a card. `navy-tint` is the only tinted background allowed on a routine screen, and it belongs to a selected row or an information panel, not to a whole card.
- Don't nest a tappable card inside another tappable card. Two overlapping hit areas is one of them the patient cannot reach.

## Tokens involved

`surface-card`, `surface-app`, `border`, `navy-tint`, `navy`, `radius-md`, `shadow-sm`, `space-3`, `space-4`, `space-5`.
