# DoseRow

One scheduled dose: drug generic and brand, the dose amount with its unit, and — only when the dose is tracked — its `StatusPill`.

## What you provide

`dose` (`{ status, tracked? }`), `drug` (`{ genericName, brandName?, strengthMg?, strengthUnit? }`), `amountLabel` (already formatted — "One tablet · 500 mg" — this component does no maths), optionally `timeLabel`, `href` or `onOpen`, `lang` (default `'en'`), `className`.

## When to use it

The Today schedule, inside a **ScheduleGroup**; any list of a patient's doses.

## When not to use it

- For a prescription record. That is **PrescriptionCard**.
- For a compact history list. That is **DoseTimeline**.

## Read-only rule (G1)

**DoseRow is read-only by contract.** It offers no checkbox, no "taken" button, no swipe, no long-press, no context menu — nothing that could create or change `Dose.status`. The **only** affordance it may ever carry is a single link or click handler (`href` or `onOpen`) that opens the prescription detail. Adherence is recorded only in the patient's chat with the Adherence Agent, never here.

## The no-status rule (G10 / CLAUDE.md rule 3)

**A dose with `dose.tracked === false` renders no pill at all** — not `upcoming`, not a grey placeholder, nothing. The row becomes a calm plan entry: drug, amount, time — deliberate and calm, not broken. This is decided **only** by `dose.tracked`, **never** by `dose.status`. In the seed data every untracked dose also reads `status: "upcoming"`, so a component that switches on the word looks correct here and is wrong the moment tracking is switched on. When `tracked` is omitted, the contract default is `true` and the pill renders.

## Do

- Pass `amountLabel` already formatted in the reader's language; this component formats nothing.
- Use `href` for a real link into the prescription detail, `onOpen` for a click handler that does the same.

## Don't

- Don't add any control beyond the single optional open action.
- Don't infer `tracked` from `status`, ever.

## Tokens involved

`surface-card`, `border`, `radius-md`, `shadow-sm`, `space-1`, `space-3`, `navy`, `ink-muted`, `body-strong` / `body-small`, `hit-area`, `ring` — plus every token **StatusPill** brings with it.

## Testing note

Root carries `data-testid="dose-row"`. Tests cover `{tracked:false, status:'upcoming'}` (no pill), `{tracked:false, status:'missed'}` (still no pill — defensive, the data never has it), `{tracked:true, status:'missed'}` (pill renders), and `{tracked: undefined}` (pill renders, contract default).
