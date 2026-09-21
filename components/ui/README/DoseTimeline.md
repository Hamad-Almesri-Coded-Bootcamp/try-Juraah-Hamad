# DoseTimeline

A compact vertical history of a prescription's doses with their statuses, for the prescription detail and the reviewer's patient-context panel.

## What you provide

`items` — an array of `{ dateLabel, timeLabel, status, tracked? }`, each already formatted. Optionally `lang` (default `'en'`), `className`.

## When to use it

The prescription detail's dose history, and the reviewer's read-only patient-context panel.

## When not to use it

- For today's schedule. That is **ScheduleGroup** + **DoseRow**.
- For a single dose. That is **DoseRow**.

## Read-only rule (G1)

**DoseTimeline is read-only by contract.** It is a history, not a form: no row offers any control, and nothing in it can create or change a `Dose.status`.

## The no-status rule

Exactly as **DoseRow**: a row whose `tracked` is `false` renders **no pill**, decided by `tracked` alone, never by `status`. **DoseTimeline must also be correct with no statuses at all** — an untracked patient's history is simply a list of times, and that is not a degraded state, it is the honest one.

## Do

- Order items newest first, matching the prescription detail's "دوز الجرعات" / dose-history section.
- Pass `tracked` on every item; omitting it defaults to tracked (contract default `true`).

## Don't

- Don't add an action to a row.
- Don't collapse the list when every item is untracked — render every row, pill-less.

## Tokens involved

`ink-muted`, `border`, `space-1`, `space-2`, `body-small` — plus every token **StatusPill** brings with it.
