<!-- Hallmark · audit · pre-emit critique: P4 H5 E4 S5 R4 V— (audit verb: no variety axis) -->
# Jur'ah (جرعة) — visual design audit (Hallmark `audit`)

**Date:** 2026-09-24 · **Asked:** "the current design is boring and messy — make it modern and easy to use."
**Scope:** all 45 routes × {390 ar, 390 en, 1440 en} = 135 renders, against the working tree (HEAD plus the uncommitted CR-070 fixes). Backend: mock, `REFERENCE_NOW` 2026-09-21 09:15.
**Status: not binding.** This report changes no screen, board, token or seed. It sits beside `2026-09-23-hallmark-ux-audit.md`, which graded **rule drift**. This one grades what the owner raised: **hierarchy, rhythm and density**.

**Capture caveat.** The dev server's mock store still held writes from earlier test runs (a second Ibuprofen and an "(unreadable)" prescription on حمد, extra sign-in rows). The findings below are stated against the **seed** (six doses in four time groups on حمد's Today), not against those leftovers.

## Buckets

- **code**: fixable in `features/` and `app/`, inside the tokens, the spec and the boards. No decision needed.
- **owner**: needs a board, token, design-system component or spec change. The build follows the board until the owner says yes; a yes is logged as a new CR.
- **logged**: already in CR-069 or CR-070. Given one line here so the list is complete, not argued again.

## The diagnosis in one paragraph

The system underneath is sound: contrast, target sizes, the navy/red discipline and the bilingual layout all hold, and none of that should be thrown away. What reads as boring is that **every piece of content wears the same box**: a white, shadowed, 12px-radius card, whether it is a dose, a prescription, a landing claim, a help answer or a note. What reads as messy is that **no screen leads with its answer**. Today doesn't say what to take next, the prescription page doesn't say how to take it, and More doesn't say what state anything is in. On top of that, empty and repeated data is shown at full weight. The fix is composition (grouping, a lead line, less chrome, using the width), not new colours or fonts.

---

## Critical

**V1 · One container for everything: the card wall** — *owner (Today, landing) · code (Help, Refill)*
- Seen: 6 separate dose cards on Today, one per prescription on Medicines, 16 on the landing, 5 on Help (E4/F5), 5 on Refill, 6 on G2s. An action, a record and a note all look alike, so nothing leads. Hallmark tells: card wall, 3-/6-column feature grid (landing).
- Where: `components/ui/DoseRow.tsx` (the board's `.doserow` draws a card per dose), `features/landing/*Section.tsx`, `features/supply/RefillList.tsx`, the Help screens.
- Fix: **one surface per group, with hairline rows inside it.** The app already uses this pattern on More (`MenuRow`). Today gets one card per time slot. Help becomes one list, and the landing moves to typographic lists (CR-069(f)).

**V2 · Today has no focal point, and its hierarchy is upside down** — *owner*
- Seen: the time, which is what a patient scans by, is the smallest text on the screen (13px muted caption on a hairline, `.timehead` on the board). Every dose underneath is a full card with a chevron. The screen never answers "what do I take next?".
- Fix:
  - The time becomes the group heading at `h2` (20px navy), with the doses as rows inside one group card.
  - One plain line under the date: "Next: 14:00 · Ibuprofen 400 mg". It is worded as a plan, with no pill and no status, and it is computed from `kuwaitNow()`, so it reads correctly with tracking off.
  - This is B1 scope and a board change, so it needs the owner.

**V3 · Prescription detail (B3, F3) is an 18-row form dump** — *code, plus one owner check*
- Seen:
  - One column of label-over-value rows. 7 of them read "—" (food, route, indication, notes, prescriber, prescribed on, brand dispensed).
  - Generic name, brand name and strength repeat the header.
  - The dose history is a bare list of dates.
  - The `Prescription` board draws 7 rows plus 2 for dispensing.
- Spec: B3 shows "every contract field", so nothing may be dropped.
- Fix:
  1. Lead with how to take it: dose, times, with food, duration.
  2. Collapse the empty fields into one named line: "Not on this prescription: route, indication, notes, prescriber, prescribed on." Every field is still shown, by name.
  3. From 834px up, use a two-column label/value grid.
- Owner check: does a named "not on this prescription" line satisfy "every contract field"?

## Major

**V4 · The navy AppBar slab is the only colour on the screen, and it floats on desktop** — *owner (design-system AppBar)*
- Every screen is a full-bleed navy bar over a grey ground and white boxes: the generic admin-template look.
- At 1440 the bar is 880px wide and hangs beside an empty gutter (m8). The `h1` sits in chrome rather than on the page.
- Proposal: a light AppBar variant (`surface-card`, hairline, navy title) that spans the content pane. Navy stays on the active tab, primary buttons and text, which is what the brand book's 70–80% navy rule describes.

**V5 · Desktop wastes the width** — *owner*
- Today at 1440 is an 815px column of thin cards, with the chevron about 780px from the drug name. Roughly 60% of the screen is empty.
- Only B2 (the board's two-column grid) and G2s use the space.
- Proposal: from 1280px up, Today gets a second column holding the day's safety line, the next refill and the tracking notice. All three already exist as components.

**V6 · The danger alert has four start edges inside one red block** — *owner (InteractionAlert) · logged CR-069(c)*
- Seen: the icon and label, the title, the drug lines and the full-width white "Checked by…" bar each start at a different inset. A white button follows, all inside a red box that covers 34–38% of the phone screen.
- Fix: align every line to one start edge, and adopt the CR-069(c) danger band.

**V7 · Mixed-language lines in the English UI** — *owner (contract/seed) · extends CR-069(e)*
- Seen: `InteractionAlert.description` ("أخذ الوارفارين مع الإيبوبروفين يرفع خطر النزيف."), the discontinued reason ("Reason: الطبيب أوقف الدواء…") and every activity message are Arabic-only seed strings, shown inside English layouts.
- Nothing makes the product look more unfinished to an English-reading examiner.
- Fix: carry both languages in the contract, or render the sentence from typed parameters. This is CR-069(e), widened to these two fields.

**V8 · More is a bare list, and it shows less than its board** — *code*
- Seen: 8 labels, with the lower half of the screen empty.
- The `More` board puts each row's state under its label: "one request pending approval", "Telegram · connected", "1" caregiver, calendar "on".
- Two icons are stand-ins: Profile uses `home`, and notifications use `link` (m3, a design-system gap).
- Fix: add the board's status line to each row. The data already exists through `getRefillRequests`, `getSettings`, the messaging link and `getCaregivers`.

**V9 · The activity feed stacks four lines per event, with no days** — *code*
- Seen:
  - Each row stacks four lines: the English type title, the Arabic message, the actor and a full timestamp.
  - "Signed in" repeats six times at 9:15.
  - The page is 4,600px long.
- The `Activity` board draws one line per event plus a relative time ("today 9:02", "yesterday 3:10").
- Fix:
  - Day headers: Today · Yesterday · 20 September.
  - One line per event plus its time.
  - The actor only when it isn't the patient.
- The same applies to F3 activity. X1 (m9) wants the same grouping.

**V10 · Refill shows stretched chips and five identical buttons** — *code*
- `features/supply/RefillList.tsx:84`: `flex flex-col` stretches the `SectorChip` across the whole card. This is a bug.
- Every card ends in the same full-width outlined button, the "Refill requested" notice is a card inside a card, and "My requests" rows lose their edge.
- The `Refill` board sets facility · sector as one text line.
- Fix: `items-start` on the header column, the facility · sector line as the board draws it, and the notice as a plain line.

**V11 · A flat type scale** — *owner (follows V2/V4)*
- In-app screens use three sizes: 17, 14 and 13px. The only larger type is the 26px `h1` inside the navy bar.
- With one weight step (400/600), everything reads at the same volume.
- Fix, inside the existing tokens:
  - Put the date and the page title on the page at `h1` size.
  - Set time slots and sections at `h2`.
  - Put `space-5` above each section so the rhythm shows the structure.

**V12 · Landing** — *code (image) · logged CR-069(f), M19*
- At 1440 the hero is a short text block centred in a tall frame beside the phone preview.
- The preview (`public/landing/today-preview.png`) is the Arabic screen on the English page too.
- Below the hero sit 16 equal cards (CR-069(f)) and three identical sign-in buttons (M19).
- Fix: a preview image per locale, the hero sized to its content, and CR-069(f).

## Minor

- **V13** The Assistant pill floats in the corner of every screen (CR-069(k), logged).
- **V14** "My Medicines" wraps to two lines in the tab bar in English (CR-069(d), logged).
- **V15** Settings shows designer notes as copy ("…schedule engine always run…"), and the frequency choice stays navy-filled while tracking is off (M3/m14, logged).
- **V16** Safety (C1) is one row and one button over a 70% empty screen, and the photo check is the loudest control on it. The tab carries no count (CR-069(g), logged).

## What to keep

- The palette and its discipline: navy for structure, red only for danger, teal off the red–green axis.
- One IBM Plex stack for Arabic and Latin.
- The 17px body text and the 44/48px targets.
- The logical-property layout: every render flips cleanly between RTL and LTR.
- The honest empty and off states.

A "modern" pass that swapped these for trend colours or a display face would make the product worse for its audience.

---

**Summary: 3 critical · 9 major · 4 minor** (by bucket: 4 code, 7 owner, 5 already logged)
**Verdict:** reads as an unfinished admin template, not as slop. The components are right, but the composition isn't. V3, V8, V9 and V10 can be fixed today without a decision. V1, V2, V4 and V5 are what would make the product feel modern, and they need the owner's yes on the boards.

---

## Outcome (2026-09-24, CR-071)

The owner approved the v2 "Daylight" mock and asked for it on every screen, with Fusha Arabic, هويتي, one language per locale, text that reads as a person wrote it, and no em dashes. It is built on branch `visual-redesign` and recorded in `docs/DECISIONS.md` under CR-071.

**Checks on the redesign before the merge (`5ae4608`).**

- `npm run verify`: exit 0 (1,123 unit tests, and a production build of 74 pages).
- `npm run guards`: all passed.
- `tests/e2e/language-purity.spec.ts`: 41 of 41 routes pass in both locales at 390px. The same spec against the commit before the redesign (`ff86837`): 37 failed.
- Full e2e on the mock backend: 964 passed and 29 failed in one run. The 29 share the in-memory store and depend on test order; all 29 passed on a fresh server with `--last-failed --workers=1`.
- G1's runtime proof (no dose-status control in the list): 3 of 3.

**Against the real database.** A production build of the branch was pointed at the live Supabase database and rendered at 390px in both locales:

- the public pages;
- every patient screen as Hamad, Fatima and Sara;
- the invitation;
- every clinic screen as the reviewer and the admin.

The patient screens show the live rows. For example, Hamad's Today shows the six doses from the database. The server logged no errors. The branch changes no file in `lib/`, `supabase/` or `types/`, so the data layer and the database policies are the ones already deployed.

Two screens could not be opened there, both because of live data, not the code:

- **The caregiver screens (F2 to F5).** On the live database, Hamad withdrew Abdullah's (cg-01) and Sara's (cg-02) access on 2026-09-21. No active caregiver is left, and the sessions policy (`session_row_ok`, 0007) correctly refuses a caregiver session for a withdrawn link. To demo the caregiver shell there, invite a caregiver and accept the invitation again. The mock backend renders these screens, and the e2e suite covers them.
- **G2 for ia-001.** That alert has already been reviewed on the live database, so the reviewer's queue is empty and G2 shows "not found". This is correct.

That run also found one problem: a reviewer who reached "not found" saw the patient assistant. It is fixed (`app/[locale]/not-found.tsx`).

**After merging `main` (the agents track's voice work) and the post-merge fixes: `bdaaabf`, the commit pushed.**

- `npm run verify`: exit 0 (1,139 unit tests, and a production build of 74 pages). `npm run guards`: all passed.
- Full e2e on the mock backend, every width against one server: 958 passed and 35 failed. The 35 depend on test order, not on code: tests earlier in the same run confirm `ia-001` and decline `cg-08`, and those rows live in one shared in-memory store. All 35 then passed on a fresh server (`--last-failed --workers=1`). So 993 passed, and 114 are skipped by design (width-specific).
- Language purity: 41 of 41 routes, in both locales.
- A five-lens review of the merge, with each finding checked by two independent skeptics, upheld 16 findings. The web app's side is fixed and tested: assistant replies declared in their language; the panel follows the person and the page; no assistant Server Action on page load. The agents track's side is listed in `docs/DECISIONS.md` CR-071 (x).
- Runs broke twice for reasons outside the code. Next's dev server rewrote `prerender-manifest.json` while it was being read, when recompiling pages it had unloaded (its default keeps 2 pages for 25 s). Separately, three dev servers plus browsers on this 16 GB machine swapped (load 543). The final run kept every page compiled (a test-worktree-only setting) and used one server.
