# WP2a — Actions + Forms

## 4. Fields a screen depends on

None of the eight components in this group reads a data-contract field directly — every value
(`label`, `value`, `options`, `checked`, `File`) comes in as a prop from the screen that owns the
data. Nothing here calls `lib/data` or holds a `Dose`, `Prescription` or `Caregiver` shape.

## 7. Things Phase 1 found out the hard way

- **`URL.createObjectURL`/`revokeObjectURL` and `navigator.clipboard` do not exist in jsdom.**
  `PhotoInput.test.tsx` stubs `URL` globally for the run; `CopyField.test.tsx` defines
  `navigator.clipboard` with `Object.defineProperty` (not `vi.stubGlobal('navigator', …)`, which
  would silently drop the rest of jsdom's real `Navigator` prototype and destabilise React's own
  environment checks).
- **`@testing-library/react`'s automatic `afterEach(cleanup)` needs a global `afterEach`.**
  `vitest.config.ts` sets `globals: false`, so nothing registers it. Every test file that calls
  `render()` more than once needs its own `afterEach(cleanup)` import, or later `it()`s in the same
  file collide with elements a prior `it()` left mounted (`getByRole` then throws "multiple
  elements found"). This is true for every WP2 group's test files, not just this one's eight —
  flagging it here so the lead can decide whether `tests/setup.ts` should carry it once instead.
- **The `react-hooks/set-state-in-effect` ESLint rule blocks the textbook
  `useState` + `useEffect(() => setUrl(...))` pattern for `URL.createObjectURL`.** `PhotoInput`
  instead creates the object URL during render with `useMemo(() => value ? URL.createObjectURL(value) : null, [value])`
  and only revokes it in the effect's cleanup function. This is the accepted trade-off the lint
  rule pushes toward, not a defensively perfect one: React does not formally guarantee a memoised
  value is computed exactly once, so under an unusual re-render a blob URL could in principle be
  created and immediately orphaned before its owning effect cleans up the *previous* one. Flagging
  it in case group review wants the alternative (a small custom hook wrapping `useState`+`useEffect`
  with an explicit "previous file" ref instead of relying on `useMemo`'s cache).
- **`IconButtonProps` (`index.d.ts`) extends `ButtonHTMLAttributes<HTMLButtonElement>` even though
  `href` renders an `<a>`.** The port cannot type both branches from one prop bag without a cast;
  `IconButton.tsx` casts the button-typed rest props to `AnchorHTMLAttributes` for the `href`
  branch with a comment explaining why, rather than narrowing or widening the published prop type.
- **`TextField`'s `type`/`inputMode` are declared as plain `string` in `index.d.ts`**, looser than
  React's own `HTMLInputTypeAttribute` / `InputHTMLAttributes['inputMode']` unions. The port casts
  at the point of use (`type as HTMLInputTypeAttribute`, `inputMode as InputHTMLAttributes<...>['inputMode']`)
  rather than narrowing the public prop type, per the brief's "narrowed only as the common brief
  says" — only `icon`/`lang` were named as narrowings, so this stayed loose and cast instead.
- **`docs/wireframes/AddPrescription.dc.html` and `DrugCheck.dc.html` predate `PhotoInput`** (it
  was still a pending component when those boards were drawn) — both show a plain `Button
  variant="secondary" icon="camera"` in place of it. `PhotoInput` was built to `Build Prompts.md`
  prompt 1's anatomy (idle / preview / analysing, two real file-input affordances) rather than to
  those two buttons; the boards' layout order (photo control, then the extracted/identified
  fields) is still what the gallery and any future screen should follow.
- **`docs/wireframes/Calendar.dc.html` renders its own read-only-value-plus-copy-button markup**
  (predates `CopyField` too) with a token that reads as a real one
  (`webcal://jurah.app/ics/p-1042/7f3c9a`). The gallery deliberately does **not** reuse that string
  — it uses `webcal://jurah.app/ics/[TOKEN]` — so nothing that looks like a real per-patient link
  ships anywhere in this repository.
- **Group c's `InteractionAlert` and `Countdown` already exist in `components/ui/` as of this
  write** (concurrent WP2 work). The gallery's "Button inside a danger fill" state imports and
  renders the real `InteractionAlert` rather than the brief's plain-`div` fallback, since it was
  available — this proves `Button`'s `.wsf-btn--secondary`/`--quiet` classes pick up the alert's
  on-fill CSS correctly and keeps axe's contrast check honest (a bare `background: var(--danger)`
  div with navy-on-danger secondary/quiet buttons measures under 3:1 and fails wcag2aa). If group
  c's component shape changes before Gate 2, `app/(dev)/[locale]/dev-gallery/a/page.tsx`'s one
  `InteractionAlert` usage is the only place that would need updating.

## Gaps / vocabulary

No vocabulary key was missing. `takePhoto`, `choosePhoto`, `remove`, `analysing`, `copy`, `copied`
and `required` were all already present in `i18n/copy/vocabulary.ts` — no fallback word was
guessed or invented.
