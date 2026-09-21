# InteractionAlert

The platform's safety-critical component: a drug-interaction finding, rendered at `danger` as the single most prominent element a screen can hold, and always carrying whether a human reviewer has checked it.

## What you provide

`severity` (`danger` · `warning` · `info`, from `InteractionAlert.severity`), `title`, and normally `description` in plain language. Optionally `drugs` — the interacting prescriptions, one per line, named the way the patient will recognise them — `reviewStatus` (`pending_medical_review` · `reviewed` · `auto_cleared`), `actions` (buttons), `severityLabel` and `reviewLabel` to override the built-in copy, `titleId`, and `lang`.

At `severity="danger"` the component sets `role="alert"`. Render it once per finding, above every prescription card on the dashboard.

## The two states that matter most

**`danger`** is a full `danger` fill with `on-fill` text, the title at `h2` and the description at `body-strong`, `radius-lg` and `shadow-md`. Not a stripe, not a left border, not a red-edged card. This is the visual form the brand book specifies, and the acceptance criteria require that the dashboard alert be more prominent than anything else on the screen by colour, position and size.

**`pending_medical_review`** must read as *a medical reviewer is still checking this*, never as a resolved answer. The built-in sentence says so in both languages and ends by saying it is not final. `reviewed` says a reviewer has checked it; `auto_cleared` says it was screened automatically and nothing was found — three different sentences, carried by a glyph and a word inside a panel that sits on `on-fill` inside a danger alert and on `navy-tint` otherwise, so it stays legible on either.

## When not to use it

- For anything that is not a safety finding. A muted check-in warning, a saved-settings confirmation or a refill routing note is an **InlineNotice**.
- For a failed request. Use **ErrorState**.
- More than once at a time at `danger`. The multi-conflict state stacks findings, but two full-bleed red banners fighting for attention is one banner too many — lead with the most severe and link to the rest.

## Do

- Write the description the way the Adherence Agent talks: plain, direct, the register a Kuwaiti patient actually reads. "These two were prescribed by different clinics" tells the patient something true about their own situation.
- Name both drugs and both facilities. The whole point is that neither clinic could see the other's prescription.
- Use the alert's `secondary` and `quiet` buttons for its actions — inside a danger alert they restyle to `on-fill`, because navy on red is not a checked pair.

## Don't

- Don't dress `pending_medical_review` in `success`, and don't let it sit alone in `danger` either. The brand book puts it at `warning` on purpose: it is neither cleared nor a confirmed emergency, and presenting it as either misreads the escalation policy the product is built on.
- Don't let `warning` or `info` borrow `shadow-md` and `radius-lg`. Lower severity means lower weight — `warning` is a `surface-card` panel outlined in `warning` at `radius-md`, `info` is a `navy-tint` panel with no shadow at all.
- Don't add a dismiss control to a `danger` alert. A patient cannot make an interaction go away by closing it.
- Don't let this component decide severity or review state. Both come from the Interaction Screening Agent through the deterministic validation layer; the component only renders what it is given.

## Tokens involved

`danger`, `warning`, `success`, `navy`, `navy-soft`, `navy-tint`, `on-fill`, `surface-card`, `border`, `radius-lg`, `radius-md`, `radius-sm`, `shadow-md`, `shadow-sm`, `space-1`–`space-4`, and the `h2` / `body-strong` / `body` / `body-small` / `label` type styles.
