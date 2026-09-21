# WP2a — Actions + Forms · task brief

Read `docs/briefs/WP2-common.md` first; it is the rest of this brief.

## OBJECTIVE
Port Button, IconButton, TextField, Select, Toggle, ChoiceGroup from the design system, and build PhotoInput and CopyField to Build Prompts prompt 1, each with README, tests and gallery states.

## FILES YOU OWN
`components/ui/Button.tsx` · `IconButton.tsx` · `TextField.tsx` · `Select.tsx` · `Toggle.tsx` · `ChoiceGroup.tsx` · `PhotoInput.tsx` · `CopyField.tsx` · their `*.test.tsx` · `components/ui/styles/PhotoInput.css` · `components/ui/styles/CopyField.css` · `components/ui/README/{Button,IconButton,TextField,Select,Toggle,ChoiceGroup,PhotoInput,CopyField}.md` · `app/(dev)/[locale]/dev-gallery/a/page.tsx` · `docs/backend-notes/wp2a.md`.

## BOARDS TO CHECK
`Login`, `SignInStates`, `ClinicEntry`, `InviteMasked` (TextField with `dir="ltr"` for a Civil ID inside an Arabic screen), `Settings` (Toggle, Select, ChoiceGroup), `MedicinesPast` (ChoiceGroup segmented), `AddPrescription` and `DrugCheck` (where PhotoInput sits), `Calendar` (where CopyField sits), `InviteConsent` (two `size="lg" fullWidth` Buttons of equal weight), `AlertDanger` (secondary/quiet inside a danger fill render on-fill).

## COMPONENT NOTES
- **Button** — four variants, two sizes, `loading` swaps the leading icon for `.wsf-spinner`, sets `aria-busy` and `disabled`, label stays. `type="button"` default. README carries the G1 note verbatim from `Button.md`.
- **IconButton** — `label` required (the accessible name); `href` renders an `<a>`; `mirrorIcon`.
- **TextField** — generated id when none; `helperText` replaced by `error` (`role="alert"`, `aria-invalid`, `aria-describedby`); `dir` forces the input's direction; `inputMode`/`autoComplete` passthrough; required mark from `copy.vocabulary.required`.
- **Select** — native `<select>` in `.wsf-select-wrap` with the chevronDown glyph; `placeholder` as a disabled first option while `value` is empty.
- **Toggle** — `role="switch"` with `aria-checked`, the on/off word from `copy.vocabulary.on/off` beside the knob (never colour alone), `description` slot, 44px hit block.
- **ChoiceGroup** — `fieldset`/`legend`; `segmented` (2–3 options, one row) and `radio` (stacked, with `description`); arrow-key navigation is the native radio group's.
- **PhotoInput** (new, prompt 1) — idle: two visible affordances, "take a photo" (`capture="environment"`) and "choose a photo", both real `<label>`+`<input type="file" accept="image/*">` controls at 48px; preview: the chosen image (`URL.createObjectURL`, revoked on change/unmount) with a `Remove` `Button variant="quiet"`; `analysing`: the input disabled, `aria-busy`, the spinner and the analysing word. Props: `value?: File | null`, `onChange(file | null)`, `state?: 'idle' | 'preview' | 'analysing'`, `label`, `takeLabel?`, `chooseLabel?`, `removeLabel?`, `analysingLabel?`, `lang?`, `className?`. Never uploads anything; never calls `fetch`.
- **CopyField** (new, prompt 1) — read-only `<input readOnly>` holding the value with `dir="ltr"`, a `Button variant="secondary"` "Copy" that calls `navigator.clipboard.writeText` and flips to the copied confirmation (`role="status"`, polite) for a few seconds; a `label` above. **For the webcal:// link only — README says "never for an identifier".** Props: `label`, `value`, `copyLabel?`, `copiedLabel?`, `lang?`, `className?`.

## GALLERY STATES
Button: 4 variants × 2 sizes, loading, disabled, fullWidth, with icon, inside a danger fill (borrow group c's InteractionAlert only if it exists; otherwise a `div` with `background: var(--danger)`) · IconButton: quiet/primary/secondary/danger, as link, mirrored chevron · TextField: default, filled, helper, error, disabled, required, `dir="ltr"` Civil-ID-shaped input **with a non-seed value such as an empty field — never a seed Civil ID** · Select: placeholder, chosen, error, disabled · Toggle: on, off, with description, disabled · ChoiceGroup: segmented (3 options) and radio (with descriptions) · PhotoInput: idle, preview (use a data-URI placeholder image drawn in code, not a real photo), analysing · CopyField: idle and copied, holding سارة's calendar link shape (`webcal://…` with a placeholder token, never a real token).

## ACCEPTANCE ADDITIONS
Every control has a 44px box (48 for `size="lg"`), a `border-strong` outline where the brand book requires it, `.wsf-focus` ring; the error state is announced; Toggle and ChoiceGroup are keyboard-complete. Tests: Button `loading` sets `aria-busy` and keeps the label; IconButton without `label` is a type error; TextField error → `role="alert"` and `aria-invalid`; Toggle → `role="switch"`; PhotoInput exposes two labelled file inputs in idle and none enabled in analysing; CopyField's copy button has an accessible name and the copied status is `role="status"`.
