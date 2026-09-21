# Countdown

The "open the Hawiati app and approve" countdown: remaining time, determinate progress, a completed
state, and a lapsed state that can be retried — always with a visible way out. New component
(`docs/Build Prompts.md` prompt 1); `components/ui/styles/Countdown.css` is its own stylesheet,
token variables only, built on `.wsf-focus` / `.wsf-ico` / `.wsf-sr` / `.wsf-btn*` from bundle.css.

## What you provide

`seconds` (the total the countdown started with) and `state` — you control it: `'running'` starts
the internal tick, and you flip to `'lapsed'` or `'completed'` in response to `onLapse` or your own
outcome; this component never decides its own outcome. `label` (visible heading, e.g. "Open the
Hawiati app and approve"). Optionally `onLapse`, `onRetry`, `onCancel`, `retryLabel`, `cancelLabel`,
`lang` (defaults `'en'`).

## When to use it

Sign-in's simulated Hawiati approval (A1), and the same pattern anywhere else a short, cancellable,
retriable wait needs a determinate on-screen clock.

## When not to use it

- For an indeterminate wait — that's a **LoadingState**.
- For anything that would silently expire and lock the patient out with no way back — `onCancel`
  exists so that never happens (navigation.md: "nobody faces a screen counting at them with no
  exit").

## Do

- Always wire `onCancel` while the countdown can be running — this port renders the cancel control
  whenever `onCancel` is supplied, and it is expected to be supplied for every running instance.
- Read `aria-valuenow` off the ring rather than parsing the visible number — they're the same value,
  but the ARIA one is unaffected by locale formatting.
- Let the caller decide what "seconds" means each time it renders: passing a fresh `seconds` value
  while flipping `state` back to `'running'` (a retry) restarts the internal counter from that value.

## Don't

- Don't read the wall clock — this component ticks a seconds counter with `setInterval` and never
  calls the system clock (guard 6, G3). A unit test reads its own source file to enforce this.
- Don't build a second countdown for "completed" or "lapsed" wording — the built-in words come from
  `copy.vocabulary.countdownDone` / `countdownLapsed`.
- Don't skip the live region — remaining time is announced politely every ten seconds
  (`copy.vocabulary.secondsLeft`), not on every tick, which would be unusable noise for a screen
  reader.

## A gap worth knowing about

`i18n/copy/vocabulary.ts` has no `cancel` key. `cancelLabel`'s built-in fallback uses
`copy.vocabulary.back` ("Back" / "رجوع") — the nearest existing word for leaving the flow, not a
literal "Cancel". A real screen should pass `cancelLabel` explicitly until the copy deck adds one.
Logged in `docs/backend-notes/wp2c.md` §7.

## Tokens involved

`navy`, `navy-tint`, `success`, `surface-card`, `border`, `radius-lg`, `radius-full`, `shadow-sm`,
`space-1`–`space-4`, `space-6`, and the `h1` / `body-strong` type styles.
