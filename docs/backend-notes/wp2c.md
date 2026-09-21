# WP2c — Feedback group: notes

## §4. Fields a screen depends on

- `InteractionAlert` needs `InteractionAlert.severity`, `.reviewStatus`, and (for the sourceCitation
  panel a screen renders beneath it, per `index.d.ts`'s own note) `.sourceCitation` — currently
  `TO_BE_SUPPLIED` for `ia-001` (Seed Dataset.md, owner-owed).

## §7. Things this port found out the hard way

1. **`InteractionAlert`'s `role` conflicts between two binding-looking sources.**
   `docs/design-system/components/InteractionAlert.md` says the `danger` case sets `role="alert"`.
   `docs/briefs/WP2c.md` (this group's own task brief) specifies `role="region"` with
   `aria-labelledby={titleId}`, at every severity. Built to the brief. Not logged to
   `docs/DECISIONS.md` — it is not a spec/seed conflict, just two design-system documents
   disagreeing with each other; the brief is this group's direct instruction.

2. **Four of the five ported components have no `lang` prop in `docs/design-system/index.d.ts`**
   (`InlineNotice`, `EmptyState`, `LoadingState`, `ErrorState`) even though each has a built-in
   fallback word (dismiss / — / loading / retry) sourced from `copy.vocabulary`. No prop was added
   (non-negotiable). Each falls back to English (`'en'`) when its own override prop
   (`dismissLabel` / — / `label` / `retryLabel`) is not supplied. `EmptyState` needs no fallback at
   all — every word on it is caller-supplied. A real Arabic screen using any of the other three must
   pass the override prop explicitly, every time.

3. **No `cancel` key in `i18n/copy/vocabulary.ts`.** `Countdown`'s `cancelLabel` fallback uses
   `copy.vocabulary.back` ("Back" / "رجوع") — the nearest existing word for leaving the flow, not a
   literal "Cancel" ("إلغاء" appears on `SignInStates.dc.html`'s lapsed panel, but no catalogue key
   exists for it). A real screen should pass `cancelLabel` explicitly until the copy deck adds one.

4. **No numeral-localisation utility exists yet.** `StepIndicator`'s "Step X of Y" caption renders
   plain Western-numeral digits in both languages (`docs/wireframes/Setup.dc.html` shows Arabic-Indic
   digits, e.g. "٢ من ٣", in context). Nothing under `lib/` currently converts digits per locale;
   this is a `lib/format`-shaped gap for whichever group ends up owning that directory, not something
   invented here.

5. **`InteractionAlert.description` is not fixed by `docs/Seed Dataset.md` itself** — the document
   fixes `severity`, `reviewStatus`, the drugs, and the review decision/note/date for `ia-002`, and
   marks only `sourceCitation` as owed (for all three alerts, per `lib/data/mock/seed.ts`, not only
   `ia-001` as `Seed Dataset.md`'s prose singles out). It gives no `description` sentence for any of
   the three alerts. By the time this gallery page was finished, `lib/data/mock/seed.ts` existed
   (WP1) with its own plain-language `description` for all three (`buildAlerts()`), each carrying a
   comment making the same read independently: `TO_BE_SUPPLIED` scopes to `sourceCitation` /
   copy-deck / bot-handle only, per CLAUDE.md's pinned memory, not to a description sentence. This
   gallery's three descriptions were rewritten to match `lib/data/mock/seed.ts`'s wording exactly
   (Arabic verbatim; English a close translation) rather than ship a second, competing phrasing —
   read for consistency only, never imported (this group's components and gallery import nothing
   from `lib/data`).

6. **`app/(dev)/[locale]/dev-gallery/c/page.tsx` is a Client Component (`'use client'`)**, reading
   `params` via React's `use()` rather than `await` (Next 16's Client Component pattern for a page
   prop typed `Promise<{locale:string}>`) — required because the gallery attaches real `onClick`
   handlers (`InlineNotice`'s dismiss, `ErrorState`'s retry, `Countdown`'s cancel/retry/lapse, and the
   interactive `EmptyState`/`InteractionAlert` action stand-ins) directly in the page. The five ported
   components and the three new ones stay server-compatible by default; only `InlineNotice.tsx`,
   `ErrorState.tsx` and `Countdown.tsx` themselves carry `'use client'` (they attach a DOM event
   handler in their own JSX); `InteractionAlert` and `EmptyState` accept `actions`/`action` as
   pre-built `ReactNode`s and attach no handler of their own, so they need no directive.

7. **Every `components/ui/*.test.tsx` file this group wrote registers its own
   `afterEach(cleanup)`** (`@testing-library/react` + `vitest`). `@testing-library/react`'s
   auto-cleanup registers itself against a *global* `afterEach`, which `vitest.config.ts`'s
   `globals: false` does not provide — so without an explicit per-file `afterEach(cleanup)`, a test
   file with more than one `render()` call leaks DOM nodes across its own `it()` blocks and
   `getByText`/`getByRole` starts throwing "multiple elements found". This was first caught here
   (all eight of this group's files needed the fix); at the time of writing, `components/ui/
   StatusPill.test.tsx` and `components/ui/DoseRow.test.tsx` (owned by group b) pass, so that group
   independently hit and fixed the same gap, or a later shared fix landed. `tests/setup.ts` itself
   (`import '@testing-library/jest-dom/vitest';` only, as read at the start of this work) still
   carries no global `afterEach(cleanup)` — a single fix there would remove the need for every
   group's component tests to repeat it, but `tests/setup.ts` is shared infrastructure this group
   does not own, so nothing there was changed.

8. **`guards/no-clock.ts` (guard 6) originally scanned every line, comments included** — a file's own
   JSDoc *describing* "no `Date.now()`, no `new Date()`" would have failed the guard it was
   documenting compliance with. `Countdown.tsx`'s comment was phrased to avoid the literal substrings
   regardless (e.g. "Date-dot-now" instead of "`Date.now()`"); the guard itself was independently
   updated (by another session) partway through this work to exempt comment and test-title lines —
   both are now consistent, and the phrasing was left as written rather than reverted.
