# EmptyState

What a screen shows when there is genuinely nothing to show — an icon, a headline, a line of explanation, and usually one thing to do about it.

## What you provide

`title`, and normally `description` and `action` (a **Button**). Optionally `icon`, a name from the bundle's outline set; it defaults to a tray.

## When to use it

A dashboard with no active prescriptions. A caregiver list with nobody linked. A refill screen where nothing is due. A dose history with no entries yet.

## When not to use it

- When the data failed to load. That is an **ErrorState** — the difference matters, because "you have no prescriptions" and "we could not fetch your prescriptions" mean opposite things to someone deciding whether to take a tablet.
- While the data is still coming. That is a **LoadingState**; an empty state shown for half a second reads as bad news that then turns out to be false.

## Do

- Write the description as what will happen, not as an apology: a prescription written at any clinic appears here on its own, so the patient knows the screen is working and that nothing is required of them.
- Pick an icon that names the missing thing — a capsule for prescriptions, people for caregivers — in `ink-muted`, at `space-6`.

## Don't

- Don't offer an action that cannot help. "Refresh" belongs on a list that might fill; a patient with no prescriptions cannot create one.
- Don't put a colour on the icon. An empty state is not a status.

## Tokens involved

`navy`, `ink-muted`, `space-2`, `space-3`, `space-4`, `space-6`, and the `h2` / `body` type styles.
