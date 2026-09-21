# WP2b — Data display — notes fragment

Per `docs/briefs/WP2-common.md`'s NOTES TO RECORD: §7 items (design-system gaps, interpretations, narrowed
prop types), plus §4 (fields a screen depends on). Merged into `docs/BACKEND-NOTES.md` by the lead.

## §4 — Fields a screen depends on

- `DoseRow` / `DoseTimeline` depend on `Dose.tracked` being set correctly **at generation time** by
  the schedule engine — the pill decision reads only this flag, never `Dose.status`, so a generator
  bug that leaves `tracked` unset (rather than explicitly `false`) on an untracked patient's doses
  would silently show pills it must not (contract default is `true` when the field is absent).
- `AlertRow`'s `metaLabel` is a single pre-composed `ReactNode` (e.g. "حمد سالم المطيري · قطاع عام
  + خاص"); the component takes no separate patient/sector props, so the screen that renders a
  reviewer queue is responsible for composing that line itself (masked or full name per its own
  read-access rules) before passing it in.
- `ActivityRow`'s `code` prop (the literal `AuditEvent.actor.role` / `.type` string) should be
  supplied **only** by X1, the admin audit log (CR-010's G9 exception). Every other consumer —
  the patient's activity feed, the reviewer queues — must leave it unset.

## §7 — Interpretations, gaps and things found out the hard way

1. **`PrescriptionCardProps` has no `aria-label` field** (`docs/design-system/index.d.ts`), so when
   `onOpen` turns the card into a `<button>`, its accessible name falls back to the button's full
   visible text content (brand, strength, generic, sector, facility, and the dose row when present).
   That is functional but verbose; a future `aria-label` prop on `PrescriptionCard` would be a
   welcome addition, matching `Card`'s own `aria-label`. Not invented here — `index.d.ts` is
   authoritative and unmodified.

2. **`DoseRow`'s `drug.strengthMg` / `drug.strengthUnit` are accepted but not separately rendered.**
   The board anatomy (`TodayPlan.dc.html`, `Main.dc.html`) shows the dose amount and strength as one
   pre-formatted line — exactly what the `amountLabel` prop already carries (e.g. "حبة واحدة · ٥٠٠
   ملغم"). Rendering `strengthMg`/`strengthUnit` a second time would risk a second, differently
   formatted number on the same row. They stay in the prop shape for type completeness and are
   available to a future revision; today only `genericName`/`brandName` are drawn from `drug`.

3. **`ActivityRow`'s actor glyph is a many-to-one mapping.** The bundle's 26-glyph set has no
   per-role icon; `patient`/`caregiver` both use `users`, `admin`/`system` both use `settings`,
   `reviewer` uses `review`, `agent` uses `refresh`. The glyph is documented as decorative only —
   the accessible signal is `actor.label` (the human word), never the icon. Reported rather than
   inventing a new glyph (G5).

4. **`Card`'s `as` default only covers two of the five element choices**, per `index.d.ts`'s own
   comment ("Defaults to 'button' when onClick is set, 'div' otherwise"). `href` alone does **not**
   select `as="a"` — a consumer wanting a link passes `as="a"` explicitly alongside `href`, matching
   the doc's own example ("href with `as="a"`"). Implemented literally; not extended.

5. **`MenuRow`'s `trailing` slot and the design system's `Toggle` don't compose cleanly.** `Toggle`
   (group a) always renders its own visible label — there is no label-less/icon-only variant — so
   nesting a `Toggle` inside `MenuRow`'s `trailing` would show the setting's name twice (once from
   `MenuRow.label`, once from `Toggle.label`). The gallery therefore demonstrates the `trailing` slot
   with a plain `<input type="checkbox">` stand-in, per the brief's own fallback wording. Whoever
   builds the Settings screen (E3) should compose `Toggle` **standalone as its own full-width row**
   (as `Settings.dc.html` already does) rather than nesting it in `MenuRow`, unless `Toggle` later
   grows a way to suppress its own visible label.

6. **`DepletionMeter`'s "low" gallery state uses `lowAtDays={14}`, not the component's own default
   of 7.** Neither prescription in the seed with real `dispensing` data (`rx-001`, `rx-003`) is
   naturally "low" against the 7-day default (≈70 and ≈10 days respectively, CR-014's own
   approximation). Rather than invent a fabricated remaining/total pair, the gallery shows `rx-003`'s
   real figures (20/60, ≈10 days) against a 14-day threshold — within `DepletionMeter.md`'s own rule
   ("keep `lowAtDays` at 7 unless the prescription's own refill window says otherwise").

7. **Guard 7 (`no-literal-copy`) would flag the mandated `strengthUnit` default.** `index.d.ts` says
   "Default `' mg'`" for `PrescriptionCard`; a direct destructuring default
   (`strengthUnit = ' mg'`) matches the guard's `strengthUnit\s*=\s*["']…` pattern and would report
   as a literal-copy violation. `PrescriptionCard.tsx` hoists it to a differently-named module
   constant (`DEFAULT_STRENGTH_UNIT`) instead — same literal value, same rendered output, no
   guard trip. Flagged in case a future guard revision wants to special-case this prop.

8. **Guard 4 (`no-dose-write`, G1) scans `app/` for the object-literal pattern `status: '<dose
   word>'`.** The gallery page constructs every `Dose`-shaped fixture through a small
   shorthand-property helper (`mkDose(status, tracked)` returning `{ status, tracked }`) instead of
   writing the pattern directly, so the static guard's approximation isn't tripped by dev-only
   fixture data that is not, in fact, a write path.

9. **`tests/setup.ts` only registers jest-dom matchers** (`globals: false` in `vitest.config.ts`), so
   Testing Library's automatic `afterEach(cleanup)` does not fire on its own. Every WP2b test file
   imports `cleanup` and calls `afterEach(cleanup)` itself, matching the pattern already present in
   `AppBar.test.tsx`. Missing this produced real cross-test DOM bleed-through (`getByText` "multiple
   elements found" failures) during development — worth calling out for any group that copies a test
   file without noticing the import.

10. **`ActivityRow`'s `layout="table"` cells now carry `overflow-wrap: anywhere`.** An unbreakable
    token in a cell (a timestamp, or the literal enum string X1 shows via `code`) was found to force
    a CSS Grid ancestor's auto-sized track wider than the 390px viewport — not by breaking that one
    cell visibly, but by inflating the *whole gallery page*'s width via nested `display:grid`
    containers upstream (`GalleryPage` → `Section` → `Example`, none of which are WP2b's files). The
    fix lives in two places: `ActivityRow.css` (owned here, applies to every consumer) and the
    gallery's own `<table>` gets `table-layout: fixed` (also owned here). A consumer building the
    real audit log at narrow widths should keep `table-layout: fixed` on its `<table>`.

11. **Out of scope, reported, not fixed:** `next build` currently fails repository-wide on
    `components/ui/styles/Countdown.css:1` (group c/WP2c's file) — a `*/` sequence inside a
    documentation comment closes the CSS block comment early, leaving a stray `/` that breaks
    Turbopack's CSS parser. Confirmed unrelated to any WP2b file (none of WP2b's six new stylesheets
    contain `*/` inside a comment). Flagged as a background task rather than edited here, since
    editing another group's file is out of scope for this brief.

12. **Out of scope, reported, not fixed:** `npm run verify`'s `typecheck` step currently fails on
    `tests/unit/data/mock-store.test.ts` (an untracked WP1 file mid-write at the time of this
    report — a comparison against a `'ui'` literal that the current `Dose['source']` union doesn't
    include). `seed:diff` fails because `scripts/seed-diff.impl.ts` is not yet implemented, and
    `notes:check` reports `docs/BACKEND-NOTES.md` is missing all §1/§5 rows because that merged file
    does not exist yet — both are the lead's/WP1's responsibility per `docs/briefs/WP2-common.md`.
    Every other `npm run verify` step (`typecheck` restricted to WP2b's own files, `lint`,
    `check:tokens`, `guards`, `test`) passes; see the main report for full command output.
