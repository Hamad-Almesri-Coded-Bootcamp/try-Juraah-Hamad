# features/day

B1 (Dose Schedule — Today) and B2 (My Medicines)'s presentational layer. Every fetch happens in
`app/[locale]/app/page.tsx` and `app/[locale]/app/medicines/page.tsx`; nothing in this folder calls
the data layer, imports mock data, or reads the clock. Two components are the cross-bundle contract
bundle h (F2, the caregiver home) consumes read-only.

## `DoseDayList`

```ts
interface DoseDayListProps {
  doses: DoseWithPrescription[];                 // one day's doses, from getDosesForDay — already
                                                  // day-filtered and ascending
  tracked: boolean;                               // Settings.adherenceCheckInEnabled — whether the
                                                  // tracking-off explanation renders at all
  locale: Locale;
  hrefBuilder: ((dose: DoseWithPrescription) => string) | null;  // a row's only affordance; null = no links
  readOnly?: boolean;                             // caregiver view: explanation stays, its Button doesn't
  settingsHref?: string;                          // where "turn tracking on" points; ignored when readOnly
  emptyTitle?: ReactNode;                         // override the default "no doses today" copy
  emptyDescription?: ReactNode;
  className?: string;
}
```

Renders one `ScheduleGroup` per distinct clock time, each holding that time's `DoseRow`s, inside a
`data-testid="dose-list"` root. **That root never contains anything but `ScheduleGroup`/`DoseRow`** —
no button, no input, no click handler beyond a row's own single optional link. The tracking-off
notice (and its "turn tracking on" action) is a **sibling of that root, not a child of it** — the
standing test `tests/e2e/g1-today-tracking-off.spec.ts` reads the root and must find nothing
interactive inside it.

**The `tracked` prop only ever gates the notice.** Each row's own pill visibility is decided, per
row, by that dose's own `dose.tracked` — passed straight through to `DoseRow`, which is the one
place G10/CLAUDE.md rule 3 is actually enforced. Passing `tracked={false}` here does not, by itself,
hide any pill; it only controls whether the explanatory `InlineNotice` renders below the list. In
this product's data every dose for one patient carries the same `tracked` value at any moment, so
in practice the two always agree — but the component does not assume that, and neither should a
future caller.

When `doses` is empty, the list root renders an `EmptyState` in its place (no tracking-off notice —
there is nothing to explain when there is nothing to show). `emptyTitle`/`emptyDescription` let the
caller distinguish "this day has none" (a day gap, e.g. an alternate-day cadence) from "no active
prescription exists at all" (a brand-new patient) — the default copy is the former.

## `MedicinesList`

```ts
interface NextDoseInfo { status: DoseStatus; timeLabel: string; }

interface MedicinesListProps {
  prescriptions: Prescription[];                  // active AND past — from getPrescriptions
  alerts: InteractionAlert[];                     // from getAlerts, already sorted most-severe-first
  nextDoseByPrescriptionId: Record<string, NextDoseInfo | undefined>;
  tracked: boolean;                               // Settings.adherenceCheckInEnabled
  locale: Locale;
  hrefBuilder: ((prescription: Prescription) => string) | null;
  readOnly?: boolean;                             // caregiver view: no add/scan action in the empty state
  addHref?: string;                               // the empty state's "add a prescription" action
  safetyHref?: string;                            // "see all alerts", shown only when alerts.length > 1
  className?: string;
}
```

Renders, in order: the single most severe `InteractionAlert` (never more than one at once — the rest
are linked via `safetyHref` when there is more than one), the active-prescription cards
(`PrescriptionCard`, or a thin `PrescriptionCardLink` wrapper when `hrefBuilder` is given — see the
gap note below), and a de-emphasised past group (`completed`/`discontinued`, reason and date, no
refill action, composed on the bare `Card` rather than `PrescriptionCard` — see the gap note). An
entirely empty patient (no prescriptions at all, active or past) gets the B2 empty state instead,
with an add/scan action only when `!readOnly`.

**`tracked` gates every card's dose row, not just `nextDoseByPrescriptionId`.** Even when the caller
supplies an entry, a card shows no status pill unless `tracked` is true — the same defence-in-depth
`DoseDayList` applies. When untracked, the current `PrescriptionCard` (see the gap note) shows *no*
dose row at all rather than a bare time, which under-delivers B2's "otherwise the next dose time"
pass criterion; logged in `docs/backend-notes/wp4c.md` §7, not patched here.

## `PrescriptionCardLink`

`components/ui/PrescriptionCard` takes `onOpen: MouseEventHandler`, not an `href` (unlike `DoseRow`
and `Card`, which render a real link). This one-line `'use client'` wrapper reuses the same
`router.push` pattern `features/shell/NavigateButton.tsx` already uses elsewhere in the repo, so
`MedicinesList` can honour its own `hrefBuilder` contract without touching `components/ui/**`.

## Read-only contract for bundle h

Both components render **zero interactive elements beyond the row/card link** whenever `hrefBuilder`
is non-null, and **zero links at all** when it is `null`. `readOnly` additionally removes every
write-shaped control (the "turn tracking on" Button, the "add a prescription" action) while leaving
the explanatory text in place — exactly what F2 asks for: "the caregiver sees the same plan, the
same explanation, never more" (UX Principles §10).

## A design-system gap, reported not patched (docs/backend-notes/wp4c.md §7)

`PrescriptionCardProps.doseTimeLabel` only renders when `dose` is also given (`index.d.ts` and the
port both gate the whole dose row on `dose`'s presence). B2 asks for "the next dose status **only
when tracked, otherwise the next dose time**" — with the shipped component there is no way to show
a bare time without a status pill. `MedicinesList` omits the dose row entirely for an untracked
patient's card rather than inventing a prop or a pill; a future `PrescriptionCard` revision that
decouples `doseTimeLabel` from `dose` would close this gap cleanly.
