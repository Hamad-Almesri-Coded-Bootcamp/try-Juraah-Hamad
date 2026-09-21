# Navigation and flow

Read this beside the brand book. The brand book governs how a screen looks; this governs how screens connect — which is what a patient actually experiences. The audience is elderly patients, the relatives following their treatment, and clinicians working through a queue, so the test for every decision here is not elegance, it is whether someone who opens this once a day, in a hurry or unwell, always knows where they are and how to get back.

**This file follows the project's `Acceptance Criteria and Test Plan.md`, which owns the screen inventory, the four roles and the routes.** Where the two disagree, that specification wins and this file gets corrected.

## Four surfaces

The product is not one app with a mode switch. It is a public page and three shells, each looking like the same product and behaving like its own place.

```
/[locale]                         Landing page — no shell, no session, one way in
        │
        ▼
/[locale]/signin                  Civil ID → Hawiati countdown (simulated)
        │
        ├─► /[locale]/invitation   Caregiver invitation — consent. No shell.
        │                          Accept or decline before anything is revealed.
        │
        ├─► role chooser           only when one Civil ID holds two ACTIVE roles
        │
        ├─► /[locale]/app/…        PATIENT shell    — Today · My Medicines · Safety · More
        ├─► /[locale]/care/…       CAREGIVER shell  — Today · Medicines · More  (read-only)
        └─► /[locale]/clinic/…     CLINIC shell     — Review · Audit  (direct URL only)
```

`[locale]` is `ar` or `en` and sets `dir` on `<html>`. The clinic shell is not linked from the landing page and not discoverable in the patient app — and that is filing, not security: every route is protected by a server-side role check like any other.

## The patient shell

```
Today (home) ──────────── Prescription detail ── Refill request (sheet)
My Medicines ──────────── Prescription detail
      └────────────────── Interaction alert detail
Safety ────────────────── Interaction alert detail
      └────────────────── Drug check ─────────── analysing → result  (in place)
More ──┬─ Refill
       ├─ Calendar sync
       ├─ Notifications & messaging ─ connect chat (in place states)
       ├─ Caregivers ───────────────── invite (sheet) → masked-name confirmation (sheet)
       ├─ Activity
       ├─ Settings
       ├─ Profile ──────────────────── sign out
       └─ Help
```

Four destinations, one level of depth, and nothing a patient needs more than two taps from home. **Today** answers "what do I take today". **My Medicines** answers "what am I on, and is anything wrong" — it carries the interaction alert. **Safety** is every finding plus the camera check. **More** holds everything configured once and then forgotten. If a screen seems to need a third level, it is a Sheet, not another push.

**Add / scan a prescription** is reached from My Medicines and from Today's empty state. It is the one flow that starts with a camera and ends in a record the patient confirms but does not author.

## The caregiver shell

A caregiver signs in as themselves — a separate shell, not a mode toggle inside the patient's app, and never a login to the patient's account.

```
Today (read-only) ─────── Prescription detail (read-only)
Medicines (read-only) ─── Interaction alert detail (read-only)
More ──┬─ Activity (read-only)
       ├─ Profile & notifications ─ their own chat / push · unlink myself · sign out
       └─ Help (written for the relative)
```

Three destinations. A persistent `navy-tint` banner names whose data is open on **every** screen of the shell. **Write controls are absent, not disabled**: a greyed-out button tells a caregiver the app is broken, an absent one tells them the truth about their access. A caregiver never sees more than the patient sees — if the patient has adherence tracking off, the caregiver sees the same plan and the same one-line explanation, not a fuller picture. They have no settings screen: their preferences are their own notification channels and nothing else.

Someone who is both a patient and a caregiver switches between the two shells **without signing out**, from More in either one.

## The clinic shell

```
Review ──┬─ Interaction findings queue ─── Decision  (confirm / clear, each confirming)
         └─ Field-confirmation queue ───── Confirm fields / return to clinic
Audit ──── System audit log (filters in place, never a new screen)
```

Two destinations. Visibly labelled a simulated clinical role. The reviewer's decision screen carries a read-only patient-context panel — the active medication list, each prescription's facility and sector, recent dose history — because a clinician cannot judge an interaction from two records alone. The admin sees event metadata and cannot open a clinical record at all.

## Entering, and the consent gate

**Sign-in is outside every shell:** no tabs, no navigation, nothing to get lost in. The Hawiati countdown always shows the seconds remaining and a way to cancel — nobody faces a screen counting at them with no exit. A visible way back to the landing page stays on screen throughout.

**The consent gate is the one thing that must not be skipped.** A Civil ID whose only claim is a pending caregiver invitation lands on the invitation screen and nowhere else. Signing in is never acceptance:

- Before acceptance the screen shows who is asking, exactly what accepting will let them see, exactly what it will not let them do, and that the patient will be told. It shows **no** prescription, dose, alert or activity data of any kind.
- **Accept and decline are two buttons of equal size and weight.** Decline is never a link, never smaller, never grey, never below the fold.
- Accepting lands in the caregiver shell (or the role chooser, for someone who is also a patient). Declining lands on a plain acknowledgement outside the app, with nothing revealed.
- A patient who already uses the app answers the same screen from a quiet notice on Today or in More, **without signing out**, and returns to exactly where they were.

On a normal sign-in, land directly on the shell's home with its content already rendered. No splash screen, no onboarding carousel, no "welcome" step between approval and the medication list. First-run setup runs once, and only its language step is required.

## Push, sheet, or in place

Every transition in this product is one of three, and picking the wrong one is what makes an app feel confusing:

**Push** — a deeper view of something on the current screen: prescription detail, interaction alert detail, a More destination, a reviewer decision. It slides in from the reading-forward edge, gets an AppBar with a visible back control, and returns to exactly where it came from.

**Sheet** — a decision or a short task that must not cost the page behind it: confirming a refill request, inviting a caregiver, the masked-name confirmation, revoking access, unlinking yourself, confirming a discontinuation, a reviewer committing a decision. It rises from the bottom on phone and becomes a centred modal from 834px up. It is dismissible, and dismissing it changes nothing.

**In place** — a state change on the same screen: analysing → result on the drug check, loading → loaded, a toggle saving, a permission being asked for, a chat link moving from waiting to connected, an audit filter applying. Never navigate for a state change; the reader keeps their position and their context.

Switching tabs is none of the three. Cross-fade, no slide — sliding would imply depth that isn't there — and each tab keeps its own scroll position and its own back stack. **Switching between the patient and caregiver shells is also a cross-fade**, and it re-renders the banner; it is never a sign-out.

The consent screen is an exception to all of it: it is a full page with no shell, and the only ways out are its own two buttons.

## Motion

Direction follows reading direction: forward means leftward in Arabic and rightward in English. Bind it to the inline axis, never to a literal left or right, and the Arabic build gets the right motion for free.

Pushes enter over 200–240ms on an ease-out curve and leave over 160–200ms ease-in; sheets take 240ms. Under `prefers-reduced-motion` all of it collapses to a 120ms cross-fade. Nothing on a first paint animates in — in particular the interaction alert must be present in the first painted frame, not revealed by a transition.

## The safety path

This is the one flow that is not a matter of taste:

- A `danger` alert renders on My Medicines above everything else, in the first frame, every time the profile contains one — **for every patient, whatever they opted into**. It cannot be dismissed, swiped away or collapsed. The only thing a patient can do with it is open it.
- Opening the alert does not clear it. It stays until `reviewStatus` changes in the data — someone reading it is not a resolution.
- A `pending_medical_review` alert offers no action that implies resolution. No "OK", no "Got it", no "Dismiss". Its detail screen says a reviewer is still checking and what happens next.
- A drug check that raises an interaction hands off to the same interaction alert detail screen. Never a second, parallel alert experience for the same kind of risk.
- While screening is still running, show the checking state. Never show a "safe" verdict that screening has not actually returned.
- The caregiver's path to the same finding is the same screen, read-only. A caregiver never sees alarm without a way to open the detail.

## Adherence is never recorded in the interface

No screen, no row, no menu and **no notification action** may create or change a dose status. A dose row opens the prescription detail and does nothing else. This is hardest to hold on the most-seen screen in the product — Today with tracking off, which is the default — where the row is a plan entry with no status pill at all. There is no checkbox there, no "taken" button, no swipe, and no "mark all as taken". The temptation is the point: that screen is where the product's core promise is either kept or quietly broken.

## Notifications lead somewhere; they never collect

A notification opens the screen that holds the thing in full, and carries no action that writes clinical data. Nothing important is delivered *only* by notification: the in-app path always exists, so a blocked permission or an unlinked chat is never why someone fails to learn about a danger finding. Connecting a channel and granting a permission are each a flow with their own states, never a bare switch, and an off or blocked state is drawn as a choice rather than a fault.

## Finishing a task

Every task ends where it started, with the change visible. Request a refill and you are back on the same list, sheet gone, that prescription now showing "requested" and its routing destination. Invite a caregiver and you are back on the caregiver list with **awaiting acceptance** on that row. Accept an invitation and you are in the caregiver shell looking at the person you accepted for. A reviewer commits a decision and returns to the queue with that item gone from it.

Confirmation is the changed state plus a short InlineNotice — not a separate success screen, and never a dead end to navigate out of. Never finish a task by dropping someone on a different tab or at the top of the app.

## Never a dead end

Every empty state, every error, the drug check's "could not identify this medication", a declined invitation, an expired one, a lapsed countdown and the three system pages all carry the next action. An empty medication list offers what to do about it. A failed load offers retry. The offline page shows the last known data with an "as of" line. A screen that only reports a problem is unfinished.

## Across breakpoints

**Phone (390).** Bottom TabBar, single column, full-width cards, sheets from the bottom, a visible back control in the AppBar on every pushed screen.

**Tablet (834).** Navigation moves to a side rail. A list-plus-detail two-pane layout is allowed on My Medicines and on the reviewer queues — with one exception: the interaction alert stays full width across both panes, because prominence outranks layout symmetry. Sheets become centred modals.

**Desktop (1440).** Persistent labelled side navigation. Cap content near 880px so a line of `body` at 17px stays readable; a medication list stretched across a 1440px window is worse, not better. The audit log and the reviewer queues may use the extra width for their columns. The landing page has its own wider rhythm.

## Rules for an elderly-first flow

One primary action per screen — everything else is quieter. No action exists only as a gesture: no swipe-to-revoke, no long-press menus, no hidden drawers, no hamburger. Anything consequential confirms in a Sheet that names exactly what is about to happen ("Stop Warfarin and cancel 14 remaining doses?", "Revoke Abdullah's access to your record?"), not a generic "Are you sure?". Nothing auto-advances except the mock Hawiati countdown. Back is always visible on a pushed screen, and the system back and the AppBar back do the same thing. Times read as "today, 8:00 PM", never as a raw timestamp. Loading uses skeletons shaped like the content they stand in for, so nothing jumps when data arrives — and a control never moves between two states of the same screen.

## Entry and exit, screen by screen

Screen codes are the specification's.

| Screen | Reached from | Returns to | Transition |
| --- | --- | --- | --- |
| L1 Landing | the public URL | — | — |
| A0 Session gate | every entry | the right shell, or signin / invitation | skeleton, never a blank |
| A1 Sign-in | L1; sign out | its destination, on approval | — |
| A1b Role chooser | A1, two active roles only | the chosen shell | — |
| A2 First-run setup | A1, once | B1 Today | in place, step by step |
| F0 Invitation consent | A1 for a pending-only ID; the notice on B1 / More | the caregiver shell, or plainly out | full page, no shell |
| B1 Today | patient tab 1; after setup | — | cross-fade |
| B2 My Medicines | patient tab 2 | — | cross-fade |
| B3 Prescription detail | a row on B1; a card on B2; F2 (read-only) | its origin | push |
| B4 Add / scan | B2; B1's empty state | B2, the record now listed | push |
| C1 Safety | patient tab 3 | — | cross-fade |
| C2 Alert detail | the alert on B2; C1; a C3 result; F2 (read-only) | its origin, alert still present | push |
| C3 Drug check | C1 | same screen; or pushes C2 | in place |
| D1 Refill | More; a prescription detail | its origin, status now requested | push, then sheet |
| E1 Calendar sync | More; B1's notice | More | push |
| E2 Activity | More; F2's More | its origin | push |
| E3 Settings | More | More | push |
| E4 Help | More | More | push |
| E5 Notifications & messaging | More; A2's offer; E3's adherence row; A3 | its origin | push, states in place |
| A3 Profile | More | More; L1 on sign out | push |
| F1 Caregivers | More | More, list updated | push, invite in a sheet |
| F2 Caregiver home | after accepting F0; the shell switch | — | cross-fade |
| F3 Caregiver detail | F2 | F2 | push |
| F4 Caregiver profile | caregiver More | More; L1 on sign out | push |
| F5 Caregiver help | caregiver More | More | push |
| X0 Clinic entry | the direct URL | a clinic destination | — |
| G1s Findings queue | clinic tab 1 | — | cross-fade |
| G2s Reviewer decision | G1s | G1s, that item resolved | push, commit in a sheet |
| G3s Field-confirmation queue | clinic tab 1 | — | in place beside G1s |
| X1 Audit log | clinic tab 2 | — | cross-fade |
| H1–H3 System pages | any failure | the nearest safe place | replace |

## What this file still assumes

Eleven components are pending, and the flows above depend on some of them: `MenuRow` for every More list and the caregiver list, `ContextBanner` for the caregiver banner and the simulated-role label, `Countdown` for the Hawiati step, `StepIndicator` for first-run setup, `DoseRow` and `ScheduleGroup` for Today, `AlertRow` for the queues, `ActivityRow` for the activity feed and the audit log. Build them before designing the screens that stand on them, or the flow described here has nothing to run on.
