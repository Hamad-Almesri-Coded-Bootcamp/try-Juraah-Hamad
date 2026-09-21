# ContextBanner

A persistent, non-dismissable strip naming the context of the session: whose data a caregiver is
viewing, the simulated-role label in the clinic shell, or that the data shown is the last known copy
with an "as of" time. Information, never an alert. New component (`docs/Build Prompts.md` prompt 1);
`components/ui/styles/ContextBanner.css` is its own stylesheet, token variables only.

## What you provide

`variant` (`'caregiver' | 'simulated' | 'lastKnown'`), `title` (composed by you — e.g. "Viewing the
record of حمد", built from `copy.vocabulary.viewingRecordOf` and a real name; this component looks
up no vocabulary and renders no name of its own). Optionally `detail` (an as-of time, a role label —
formatted by you; `REFERENCE_NOW` never reaches this file) and `icon`.

## When to use it

The caregiver shell's "you are viewing حمد's record, read-only" strip (`CaregiverHome` /
`CaregiverPlan` / `CaregiverDetail`). The clinic shell's "simulated role" strip (`ClinicEntry` /
`ReviewerQueue` / `AuditLog`). A screen showing a last-known / offline copy of its data, with an
as-of time (the H3 system-page pattern).

## When not to use it

- For a dismissable message — that's an **InlineNotice**.
- For a safety finding — that's an **InteractionAlert**.
- For a one-off confirmation ("Copied", "Connected") — that's a **StatusPill** or **InlineNotice**.

## Do

- Keep it sticky under the AppBar through the *consumer's* layout (a wrapping `position: sticky`
  where the screen mounts it) — this component sets no position of its own.
- Use `role="status"` (the `lastKnown` variant, automatic) when the banner itself is the thing being
  announced; `role="note"` (`caregiver` / `simulated`, automatic) otherwise.

## Don't

- Don't reach for the `danger` token, ever, on any variant — even where a board elsewhere renders a
  simulated-role strip in a full `navy` fill (`ReviewerQueue.dc.html`); this port follows the brief's
  navy-tint / navy anatomy uniformly, logged in `docs/backend-notes/wp2c.md` §7.
- Don't add a dismiss control — `variant` has no case for it, and none is rendered.
- Don't let a caregiver's banner say more than the patient would see on their own equivalent screen
  (UX §10).

## Tokens involved

`navy`, `navy-soft`, `navy-tint`, `ink-muted`, `space-1`, `space-2`, `space-3`, and the
`body-small` / `caption` type styles.
