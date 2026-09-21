# Design system — offline reference

Everything needed to port the components into this repository **without opening the artifact**.
The published artifact (*Jur'ah — جرعة*) stays the visual reference; these are its source files,
copied here so the build does not depend on having it open.

| File | What it is |
|---|---|
| `brand-book.md` | The binding usage rules: the colour proportions, the status→token table, identity display, type, spacing, the prominence rule, and the rules a component may not break. |
| `navigation.md` | How the screens connect: the four surfaces, the three shells, the consent gate, push/sheet/in-place, motion, the safety path, breakpoints, and an entry/exit table for every screen. |
| `tokens.json` | Every token with its exact value **and a usage note** — including the measured contrast ratios. This is the only source of visual values. |
| `index.d.ts` | Every built component's props, documented. Read this before porting one. |
| `bundle.css` | The artifact's own stylesheet — the exact implementation each ported component must reproduce. |
| `components/<Name>.md` | Per-component guidelines: what you provide, when to use it, when not to, do/don'ts, and which tokens it involves. Twenty files, one per built component. |

## How the port works

The artifact ships `components/bundle.js` as a classic script assigning `window.Wasfa`. **Do not
load it.** Port each component into `components/ui/<Name>.tsx` as a typed React component that
reproduces the behaviour and anatomy in its guide, its props in `index.d.ts`, and its styles in
`bundle.css` — with the compiled token custom properties as the only source of visual values.

"Wasfa" is the earlier working name, kept only as that JavaScript global so the artifact's
previews and the wireframe boards keep working. The product is Jur'ah; the namespace never
reaches the shipped code.

## Twenty built, eleven pending

**Built** — Button, IconButton, TextField, Select, Toggle, ChoiceGroup, Card, PrescriptionCard,
StatusPill, SectorChip, DetailRow, DepletionMeter, InteractionAlert, InlineNotice, EmptyState,
LoadingState, ErrorState, AppBar, TabBar, Sheet.

**Pending** — DoseRow, ScheduleGroup, DoseTimeline, AlertRow, ActivityRow, MenuRow, PhotoInput,
CopyField, Countdown, StepIndicator, ContextBanner. These have no guide here yet because they do
not exist yet; `../Design System Foundations.md` says what each one is for, and
`../Build Prompts.md` prompt 1 is the brief that builds them. Per **G5** you never improvise one
inline — report the gap.

## The icon set

26 outline glyphs in the bundle: clock, check, checkLate, missed, danger, warning, info, review,
shield, chevron, chevronDown, building, capsule, home, calendar, users, settings, camera, close,
refresh, inbox, plus, link, trash, search, subscribe.

## The one variable the bundle does not define

`bundle.css` declares its own `--wsf-*` internals (`--wsf-hit`, `--wsf-ico`, `--wsf-ico-sm`,
`--wsf-line`, `--wsf-line-2`, `--wsf-ring`, `--wsf-ring-gap`) and reads every colour, space and
radius from `tokens.json`. It reads exactly one variable that neither file defines:

```
--font-sans
```

The wireframe boards each declare it in their own `<helmet>`, so they render; a Next.js app will
not, and every component will silently fall back to the browser's default sans. **WP0 must emit it**
in the generated `tokens.css`, alongside the tokens, as:

```css
--font-sans: "IBM Plex Sans Arabic", "IBM Plex Sans", system-ui, sans-serif;
```

Load the family from the same Google Fonts `css2` request the boards use, at weights 400 and 600 —
the only two the type scale calls for. If the app self-hosts the font instead, the stack's first
family must keep that exact name so `bundle.css` needs no change.
