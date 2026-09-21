# PhotoInput

`components/ui/PhotoInput.tsx` — capture-or-upload for prescription intake (B4) and the drug check
(C3): three states — idle (two real affordances), preview (the chosen image with a Remove action),
and analysing (busy, nothing left to press). One of the eleven components `Build Prompts.md`
prompt 1 specifies; there is no bundle card for it, so this port carries its own token-only
stylesheet, `components/ui/styles/PhotoInput.css`.

## What you provide

`value` (a `File | null`), `onChange(file | null)`, and `label` (what the photo is of). Optionally
`state` (`'idle' | 'preview' | 'analysing'` — defaults to `'preview'` when `value` is set and
`'idle'` otherwise, but the screen that owns the "analysing" moment should pass `state="analysing"`
explicitly rather than relying on a timer inside this component), `takeLabel`, `chooseLabel`,
`removeLabel`, `analysingLabel`, `lang` and `className`.

## When to use it

Anywhere the patient supplies a photo of a physical object: the prescription photo in B4, the drug
packet photo in C3. Nowhere else — it is not a general file picker.

## When not to use it

- For anything that is not a photo of a physical object the patient is holding up to the camera.
- As a place to show the *result* of analysing a photo. PhotoInput's job ends at handing back a
  `File`; the extraction result (B4) or the identified drug and the interaction check (C3) render
  with **DetailRow** and, where relevant, **InteractionAlert** beside it, not inside it.

## Do

- Offer both `take a photo` (`capture="environment"`) and `choose a photo` in idle — never only
  one. Some patients photograph in the moment; a caregiver filling this in later has to upload.
- Revoke the object URL you handed the browser. This component does it for you
  (`URL.revokeObjectURL` on every value change and on unmount) — never build a second PhotoInput
  that also holds the file, or the URLs leak twice.
- Pass `state="analysing"` for exactly as long as the simulated check takes, then move to
  `'preview'` or clear `value` — never leave it stuck busy.

## Don't

- Don't call `fetch` from inside this component, and it never will: the photo goes nowhere on its
  own. The screen decides what "analysing" means and supplies the result separately.
- Don't render a file input without its paired visible `<label>` — the hidden input plus adjacent
  label is what keeps both a 48px hit target and a real accessible name; wrapping the input inside
  the label instead breaks the focus-ring selector in `PhotoInput.css`.
- Don't offer a way to interact with the photo while `state="analysing"` — no Remove, no second
  capture. The read-only rule that governs `DoseRow` et al. does not apply here (this is a form
  control, not a status display), but "nothing to press while busy" is its own accessibility rule:
  `aria-busy="true"` on the preview container, and no interactive descendant.

## Tokens involved

`navy`, `navy-tint`, `on-fill`, `surface-card`, `border`, `border-strong` (via the reused `.wsf-btn`
classes on the take/choose labels), `radius-sm`, `radius-md`, `space-2`, `space-3`, `--hit-area-primary`
(48px, per the brand book's "primary action" hit area), `--ring`/`--ring-gap` (the dual focus
ring), and the `label` / `type-label` type styles for the heading and control text.
