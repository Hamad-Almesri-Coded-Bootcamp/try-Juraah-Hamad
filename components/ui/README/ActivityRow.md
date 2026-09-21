# ActivityRow

One logged event. Serves two consumers: the patient's activity feed (what happened, when, and a link to the thing it happened to) and the admin audit log (which also needs an actor and a patient reference).

## What you provide

`title`, `timeLabel` (already formatted). Optionally `description`, `href` (the only affordance this row ever offers), `actor` (`{ label, kind }` — `label` is the human word from the vocabulary; `kind` only picks a decorative glyph, never rendered as text), `code` (the literal `AuditEvent.actor.role` string — pass this **only** from X1, the admin audit log; every other screen leaves it unset, CR-010), `patientRef` (a masked name, from `lib/format/maskedName`, never a component of its own), `layout` (`'list' | 'table'`, default `'list'`).

`ActivityRow.Table` is the paired `<thead>` for `layout="table"` — pass its five column headers as `columns` (`time`, `event`, `actor`, `patient`, `description`), each already resolved from the copy catalogue by the caller.

## When to use it

The patient's Activity feed (E2), list layout. The admin audit log (X1), table layout at 1440, list layout narrower.

## When not to use it

- For a dose. That is **DoseRow** / **DoseTimeline**.
- For an interaction finding. That is **AlertRow**.

## Read-only rule (G1)

**ActivityRow is read-only by contract.** The only affordance it offers is `href`, a link to the thing the event happened to. Nothing here can create, edit or undo a logged event, and nothing here can record a dose status.

## Do

- Pass `actor.label` as the human word ("Adherence assistant", "System") from the vocabulary, never the raw enum.
- Reserve `code` for X1: it is the one surface allowed to show the literal role string, and only beside its human label, never instead of it (CR-010, the G9 exception).
- Pass `patientRef` as a masked name on the admin audit log; never a Civil ID, anywhere.

## Don't

- Don't invent a second icon per role — the icon set has 26 glyphs and no role-specific set; the actor glyph is decorative supplementary information, not the accessible signal (the label text is).
- Don't put clinical detail (dose amounts, alert text) in `description` outside X1's own scope rules.

## Tokens involved

`navy`, `ink-muted`, `border`, `navy-tint`, `space-1`–`space-3`, `body` / `body-small` / `caption` / `label`.
