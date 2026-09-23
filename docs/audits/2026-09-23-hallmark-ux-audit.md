<!-- Hallmark · audit · pre-emit critique: P4 H4 E4 S5 R4 V— (audit verb: no variety axis) -->
# Jur'ah (جرعة) — full-app UX audit (Hallmark `audit`)

**Date:** 2026-09-23 · **Scope:** every route in the Phase 1 inventory (45 routes × {390 ar, 390 en, 1440 ar} = 135 renders, plus a 200 % text pass on all 45 and 40 driven interaction states) · **Backend:** mock (`JURAH_DATA_BACKEND=mock`), seed data, `REFERENCE_NOW` = 2026-09-21 09:15.
**Status: not binding.** This is an audit report. It changes no spec, board, token or seed. Items marked **DECISIONS** are proposals for `docs/DECISIONS.md`, and the owner decides them.

## Status after the fix pass (2026-09-24)

The owner asked for the fixes ("do the best for the project"). Code fixes are logged as **CR-070**; everything that needs an owner decision (a board, a token, a contract or the design-system reference) is logged as **CR-069**. Nothing is committed.

| Finding | Status | Proof (red on HEAD → green now) |
|---|---|---|
| C1 full name in F1 | **Withdrawn**: the contract makes `Caregiver.name` the patient's own claim | none needed; unchanged |
| C2 sheets under the TabBar | **Fixed**: the Sheet portals into a viewport layer | `Sheet.test.tsx` "renders in its own fixed viewport layer…" ✗→✓; e2e `audit-2026-09.spec.ts` C2 |
| C3 assistant off-screen | **Fixed**, plus 8 more dead utilities found (`inset-0`, `top-0`, `m-0`…) | guard T: 9 violations on HEAD → 0; e2e C3 + sticky-banner |
| C4 cards lose flex | **Fixed**: bundle and tokens in `@layer components` | re-capture diff (105 identical, rest reviewed); e2e C4 |
| C5 arrows | **Fixed**, AppBar back included | e2e C5 (computed direction, en + ar) |
| C6 alert dead end | **Fixed** (patient + caregiver) | `MedicinesList.test` ✗→✓; e2e C6 |
| C7 caregiver app bar | **Fixed** | `careAppBars.test.tsx` ✗→✓; e2e C7 |
| C8 13px tokens | **DECISIONS** CR-069(a) | none |
| C9 decline bounce | **Fixed** | `invitation-layout.test.tsx` ✗→✓; verified live |
| NEW: 50 mcg shown as "50 mg" | **Fixed** (`PrescriptionCard` ignored the prescription's unit) | `PrescriptionCard.test.tsx` ✗→✓ |
| NEW: pending glyph uncoloured | **Fixed** (`InteractionAlert` modifier mismatch) | `InteractionAlert.test.tsx` ✗→✓ |
| M1, M4, M5, M7–M15, M19, m1, m2, m5, m7 | **Fixed** (CR-070) | the area passes' tests, each ✗ on HEAD |
| M2 equal choices | **Fixed to the spec**; the board deviations are logged in CR-069(b) | `equalButtons.test.tsx`, `setup-flow.test.tsx` |
| M3 design notes as copy | **DECISIONS** (copy deck) CR-069(m) | none |
| M6 drug-name order | **DECISIONS** CR-069(l): the Today board and `PrescriptionCard.md` disagree | none |
| M11 C3 three-part answer | **Partly fixed** (C2 order, B2 card); C3 needs a contract change, CR-069(o) | `AlertDetail.test` ✗→✓ |
| M16, M17, M18, M20, M21 | **DECISIONS** CR-069(c)(d)(e)(f)(g) | none |
| M22 headings | **Partly fixed** (F2/F3 now have one h1); A1/A1b/F0 still title the wordmark | none |
| m3, m11, m12 | **DECISIONS** CR-069(h)(n)(i) | none |
| m10 rail label wrap | **Dropped**: `AppShell.tsx` makes it wrap on purpose | none |
| m4, m6, m8, m9, m13, m14 | **Deferred** (polish) | none |
| E5 permission states "not exercised" | **Not a defect**: E5 reads the stored `PushSubscription`, and the seed carries each state | none |

**Checks on the fixed tree.** `npm run verify` exits 0: typecheck, lint (only the existing `<img>` warning), token sync, all 13 guards (new: guard T), **1,032 unit tests** (up from 942), seed diff, notes check and the production build.

### Fix log: commands and outputs

Every fix below went red on HEAD before the change and green after it (the owner's rule: never green by absence).

```
# guard T against HEAD's tree (git archive HEAD) — then the working tree
✗ guard T · every spacing utility names a step the theme generates — 9 violation(s)
    app/[locale]/care/layout.tsx:27  [step "0" …]  top-0
    features/assistant/AssistantLauncher.tsx:129  [step "24" …]  bottom-24
    features/assistant/AssistantLauncher.tsx:135  [step "0" …]  inset-0
    features/assistant/AssistantLauncher.tsx:160  [step "96" …]  max-h-96
    features/clinic/FlaggedPrescriptionDetail.tsx:110  [step "48" …]  min-h-48
    features/identity/ProfileScreen.tsx:66  [step "14" …]  h-14 / w-14
    features/landing/Hero.tsx:39  [step "0" …]  m-0
    features/shell/ClinicNav.tsx:56  [step "0" …]  top-0
✓ guard T · every spacing utility names a step the theme generates

# components/ui/Sheet.test.tsx "renders in its own fixed viewport layer…" — HEAD's Sheet, then the fix
× renders in its own fixed viewport layer, outside the screen that opened it   →   48 passed | 1 skipped

# tests/unit/invitation-layout.test.tsx — HEAD's layout, then the fix
× no session inside the Server Action request that just declined → renders   →   3 passed

# components/ui/PrescriptionCard.test.tsx — 50 mcg levothyroxine
× en: 50 mcg stays 50 mcg, never 50 mg
× ar: Arabic-Indic digits and the Arabic unit word                             →   9 passed

# components/ui/InteractionAlert.test.tsx — HEAD's component, then the fix
× uses the bundle's own review modifiers, so the pending glyph gets its colour  →   6 passed
```

- **Area pass A** (caregiving and identity) wrote 30 failing tests before any source change, then turned them green. Examples: `× ar: h1 is the caregiver "Today" tab label`, `× "123" + Enter says a Civil ID has 12 digits`, `× lang="ar": the visible number is Arabic-Indic`.
- **Area pass B** (patient screens) did the same per fix. Examples: `Unable to find … "Open the alert"`, `expected 90 to be 13` (history window), `Received: "70 / 90"`, `'حبة واحدة · ٤٠٠ mg'`, `not to match /border-inline-start/`, `got 2` primaries on E5.

```
$ npm run verify
✓ styles/tokens.css is in sync with docs/design-system/tokens.json
… all 13 guards ✓ (guard 5, guard T, guard U, guard P, guard S …)
 Test Files  113 passed (113)
      Tests  1032 passed | 1 skipped (1033)
✓ Compiled successfully · ✓ Generating static pages (74/74)
verify exit 0
```

**Re-capture** (all 45 routes × 390 ar/en and 1440 ar, 200% pass, same script as the audit):
- At most one primary button per screen, except the landing page's same-action sign-in repeated three times (the board's choice) and F0/A1b/X0, which have none by design.
- F2 and F3 each have exactly one `h1`. Zero horizontal scroll at 100% on every route.
- axe: 0 violations on all 90 phone renders, as before. No identifier leaks.
- The 200% overflow is unchanged; it lives in `bundle.css` (CR-069(d)).

## How this was graded

The project has a locked design system (`docs/design-system/`, the brand book, `UX Principles.md`), so this audit grades **drift from that system and from the binding UX rules**, not distance from Hallmark's own house taste. These Hallmark gates are **waived** because the brand book mandates the opposite:

| Hallmark gate | Why it does not apply here |
|---|---|
| 1 / 37 single typeface | The brand book sets one IBM Plex Sans Arabic + IBM Plex Sans stack on purpose (a drug name and Arabic text share letterforms). |
| 7 pure-white surface | `surface-card` is the system's card ground. |
| 22 / 48 hex, not OKLCH | `styles/tokens.css` is compiled from the owner's `tokens.json`. The project rule is "no hex in `components/` or `app/`", and that holds. |
| 3 equal-column grid (landing) | `Landing.dc.html` and `Landing1440.dc.html` draw 3-across and 6-across. The structural note under L1 is scoped to what the board allows. |
| 42 / 43 AI nav and footer | The shells use a bottom TabBar or side rail, and the landing footer is a single inline line (Ft2). Both pass. |

Every fix carries one of three **buckets**:

- **code**: a change in `features/`, `app/` or `components/`.
- **DECISIONS**: the board, token or spec is the source, or two binding documents disagree. Per the owner's rule, the board or token is never edited locally; log the conflict and the owner corrects the source.
- **copy deck**: the string is marked `placeholder: true` in `i18n/copy/*` and belongs to the owed bilingual copy deck.

Severity: **critical** means a binding rule, invariant or feature fails for a real user. **Major** means a UX Principle is broken or the screen reads as unfinished. **Minor** means polish.

---

## Critical

**C1 · ~~A full name of an invited person is shown back to the patient~~ — WITHDRAWN (2026-09-24).** The binding contract defines `Caregiver.name` as "the name the PATIENT knows them by — a claim, not a lookup" (`docs/Acceptance Criteria and Test Plan.md:294`), and both backends store exactly what the patient typed on invite (`lib/data/mock/caregivers.ts:102`, `lib/data/pg/writes.ts`). F1 therefore shows the patient's own input back; the seed happens to hold full names as those claims. No invariant is broken, and nothing was changed. The no-account row's `[TO BE SUPPLIED]` label is the seed's own loud marker (CR-069(j)).

**C2 · On phones the bottom TabBar paints over every Sheet**
- Where: `features/shell/AppShell.tsx` (the `<aside>` comes after the content in DOM order, with no stacking order set). The Sheet pins to the same positioned root.
- Seen at 390×844: in the D1 confirm-refill sheet only the title is visible, and "Send the request" sits under the tab bar. In the F1 invite sheet, Continue is covered (a scripted click on it timed out after 30 s). The F1 revoke sheet has its action under the bar and the page shifted sideways.
- Fix: give the Sheet layer (scrim and panel) a stacking order above the aside, or hide the aside while a Sheet is open. Then re-run the Sheet e2e at 390. Bucket **code**.

**C3 · The assistant (CR-067) is off-screen on every phone**
- Where: `features/assistant/AssistantLauncher.tsx:89`, `fixed bottom-24 end-4`. `styles/theme.css` resets the spacing scale to steps 1–6, so `bottom-24` generates **no CSS rule**. Measured live at 375×812: computed `bottom: -44px`, button top y = 812 (the viewport edge), `.bottom-24` rule absent. `tablet:bottom-6` works, which is why the launcher shows at 1440.
- The same silent failure affects `max-h-96` (`AssistantLauncher.tsx:120`, so the conversation list is unbounded), `h-14` (`features/identity/ProfileScreen.tsx:66`) and `min-h-48` (`features/clinic/FlaggedPrescriptionDetail.tsx:110`).
- Fix: use token steps or `var(--hit-area)` arithmetic. Add a guard that fails on any spacing utility the theme does not generate, so this cannot pass silently again. Bucket **code**.

**C4 · Card layouts silently lose their flex, so titles run into their bodies**
- Where: `components/ui/styles/bundle.css:217` sets `.wsf-card { display: block }`. It is unlayered, so it beats Tailwind's layered `flex` / `flex-col` / `gap-*`. There are 34 `<Card className="flex …">` usages in 20 files, plus five landing sections that put two bare inline `<span>`s in a Card (`features/landing/{Problem,Solution,Features,Audience,Safety}Section.tsx`). Verified live: `wsf-card flex flex-1 flex-col gap-2` computes to `display: block`.
- Seen: `تعليمات تضيع بعد العيادةالمريض يطلع…` (landing, every card) · `أُوقف في ٢٨ يونيو ٢٠٢٦السبب:` (past medicines, B2 and F2) · `حمد's medicinesابنتيOpen حمد's record` (A1b) · `Browser notificationsAlerts only` (A2 step 2) · `…the simulated Hawiati flowLinked to حمد's record` (F4) · `What does Jur'ah do?It gathers…` (E4, F5) · `Medical reviewThe queue…confirmation.Open the review queues` (X0 chooser).
- Fix: import the bundle into a cascade layer below utilities (`@import '../components/ui/styles/bundle.css' layer(components);`). The file stays byte-identical, so `bundle-css.test.ts` still holds. Then re-run the 390/834/1440 matrix, because `AppShell.tsx`'s comments rely on "bundle wins" for `.wsf-tabs`. Bucket **code**.

**C5 · Day-navigation arrows point the wrong way**
- Where: `app/[locale]/app/page.tsx:100` / `:105` and `features/caregiving/CaregiverToday.tsx:27` / `:32`. "Previous" uses `mirrorIcon` and "next" uses nothing. The base chevron points right and `.wsf-mirror` flips it only under RTL.
- Seen: in English both arrows point right, so "previous day" points forward. In Arabic both point inward at the date. For this audience the arrow is the control.
- Fix: "next" gets `mirrorIcon` (points toward the reading end). "Previous" must point toward the start edge, so it flips in LTR and not in RTL. Bucket **code**.

**C6 · The danger alert on My Medicines is a dead end**
- Where: `features/day/MedicinesList.tsx:100-106`. The alert only gets an action when `alerts.length > 1`. Hamad has one alert, so the most prominent element in the app opens nothing. `CaregiverMedicines` inherits the same behaviour.
- Spec: C2 is "push from B2", and F2 says "danger alert shown, opens C2 content read-only". UX §10 says "a view that shows alarm without detail is worse than no view". The card also lacks §8 part 2 ("what to do now"), which only C2 carries.
- Fix: always pass an action, "افتح التنبيه / Open the alert", pointing to `/app/safety/[id]`, or `/care/alerts/[id]` in the caregiver shell. Bucket **code**.

**C7 · Caregiver Today and Medicines have no app bar: no title, no `h1`, no language switch**
- Where: `/[locale]/care` and `/[locale]/care/medicines`. Measured: `h1` is empty on both, in both locales.
- Rules: UX §1 "every screen carries a title in the app bar", §12 "the language switch… reachable on every screen", and the brand book "the language switch belongs to AppBar". F3, F4 and F5 do carry one.
- Fix: render `AppBar` (title and switch) beneath the ContextBanner, as the other caregiver screens do. Bucket **code**.

**C8 · Buttons, status pills, tab labels and dose times are 13px, below the binding 14px floor**
- Where: `tokens.json` sets `type-label` and `type-caption` to 13px (compiled to `styles/tokens.css:53-57`). `label` drives every `Button` (md), `StatusPill`, `TabBar` label and `SectorChip`. Measured on the phone renders: dose times (`٨:٠٠`), "Turn it on", "Request a refill", "Taken on time", "Serious interaction", "Sign out", "Read-only", and 364 text nodes on X1.
- Rule: UX §4 says "never smaller than 14px anywhere", and that rule is binding. The two binding sources conflict.
- Fix: raise `label` and `caption` to at least 14px, and set type in `rem` so a browser font-size preference applies (every type token is `px` today). Bucket **DECISIONS** (owner-owned tokens).

**C9 · Declining the invitation lands on the sign-in form with no acknowledgement** (observed on mock; verify on Postgres)
- Where: `features/caregiving/InviteConsent.tsx:71-77`. The handler sets `'declined'`, but for a pending-only session the page ends at `/en/signin`. Most likely the re-render re-runs the gate on a session whose invitation is no longer pending.
- Spec: F0 "declined: plain acknowledgement, way out, nothing revealed". The e2e test covers only an *already*-declined row opened by a patient session, not a live decline by a pending-only session.
- Fix: keep the pending-only session valid for the acknowledgement render, or route to a public "declined" page that carries the `f0Declined*` copy. Add the e2e case. Bucket **code**.

---

## Major

**M1 · The assistant launcher is a `primary` button on every screen.** Measured: every route has one extra `wsf-btn--primary` ("Assistant"). F0 then has two primaries (Accept + Assistant) and adds a third exit to a screen whose "only exits are its two buttons". The launcher also sits on A2, which has "no chrome during the flow", and gives reviewers and caregivers the signed-out guest prompts ("what is Jur'ah", "how do I sign in"). Fix: quiet or secondary variant; do not mount on F0, A2 or the clinic shell. Bucket **code** (`AssistantLauncher.tsx:89-93`, `app/[locale]/layout.tsx:57`).

**M2 · Three boards draw "equal" choices unequally.** `InviteConsent.dc.html` (primary vs secondary), `Setup.dc.html` (primary, secondary, secondary) and `ReviewerDecision.dc.html` (danger vs secondary) break UX §2, §13 and §15 and the brand book's "same size, same width, same prominence". The build follows the boards; the e2e test checks size only. Bucket **DECISIONS** (the owner corrects the boards).

**M3 · Design notes are rendered as user copy.** Examples: `f0EqualNote` "Accepting and declining are the same size and weight…" (`caregiving.ts:36`); `equalWeightNote` "'Later' is an ordinary choice, the same size and weight — not a small link" (`identity.ts:122`); C2 "no 'Done' or 'Got it' button here, on purpose"; A1 "What you typed stays"; B4 "Fields the prescriber owns are never typed by hand here"; F5 "The controls are not disabled — they are simply absent"; E3 and G3s "schedule engine" / "screening engine"; X0 "that is filing, not protection". The first two are board annotations copied as text. Fix: cut them, or say the user-facing truth ("You can connect later from Settings"). Bucket **copy deck**. X0's line is spec-mandated in substance, so reword it; don't drop it.

**M4 · The relationship reads in the patient's first person.** F0 shows "يقول إنك ابني" (he says you're *my* son), and A1b shows `ابنتي` under حمد's record for Sara. The seed stores the patient's own label, so do not change the seed. Fix the template to quote the patient, e.g. `وصفك بـ«{relationship}»` / `Described you as “{relationship}”` (`caregiving.ts:17` and the A1b template). Bucket **copy deck + code**.

**M5 · F0's "what you will never be able to do" list reads like a permission list.** The heading `وما راح تقدر:` can be read as "and what you'll be able to", and the four items are affirmative verbs styled exactly like the "you will see" list. For the one list consent hinges on, give each row a `close` glyph with an unambiguous negative heading, and each "see" row a `check` glyph. Bucket **code + copy deck**.

**M6 · The drug-name hierarchy flips between screens.** `DoseRow` (Today, Refill) sets the generic name first in bold ("**Ibuprofen** Brufen"). `PrescriptionCard` (My Medicines) sets the brand first ("**Brufen 400 mg** / Ibuprofen"), which is the rule `PrescriptionCard.md:22` states ("brand name first… the exact pair patients lose"). A patient matching the box in hand meets two orders. Fix: one order everywhere, aligned to `PrescriptionCard.md` (`components/ui/DoseRow.tsx:44-45`). Bucket **code**.

**M7 · Units and digits are inconsistent in Arabic.**
- Patient screens show `٤٠٠ mg` (Arabic-Indic digits with a Latin unit), while the clinic shows `ملغ ٥`.
- Western digits appear in Arabic in the countdown (`24`, `components/ui/Countdown.tsx:113`), the refill meter (`70 / 90`, `70 أيام`) and A3 ("2 مربوط").
- `70 أيام` is also ungrammatical; it should be `٧٠ يومًا`.
- Fix: one unit and number formatter in `i18n/format.ts`, used everywhere. Bucket **code**.

**M8 · Prescription detail is a 5,909px page.** The dose history lists all 90 planned doses, including future dates up to 29 November under the heading "Dose history". The caregiver version is 6,106px. "Request a refill" sits at the very end. Fix: show the last 7 and next 7 days with a "show all" disclosure, and label the future part "Planned". Bucket **code** (`PrescriptionDetail.tsx`, `CaregiverPrescriptionDetail.tsx`).

**M9 · Bare numbers where a dose should read as speech** (UX §3). B3 shows "Dose 1" and F3 shows "Dose per administration 1". The DoseRow already says "One tablet · 400 mg". Bucket **code**.

**M10 · The caregiver shell reuses patient-voice copy and titles.**
- F3 prescription detail is titled **"My Medicines"** (`h1`).
- F2 Today shows the patient line "ما نتابع التزامك… شغّل المتابعة", addressed to a caregiver who cannot turn it on. F3 already has the right caregiver line ("The patient has not turned on dose tracking…").
- The F3 field labels differ from B3's for the same fields: "Dose per administration" vs "Dose", "Prescriber" vs "Prescribing doctor", "Start date" vs "Starts on", "Dispense date" vs "Dispensed on".

This breaks UX §3 (one word per concept) and §10 ("identical to the patient's view minus actions"). Bucket **code + copy deck**.

**M11 · Danger findings outside C2 skip the three-part safety shape** (UX §8, "wherever it appears"). The C3 result names only Warfarin (not the drug it interacts with) and has no "who is checking" line. The B2 and F2 cards lack "what to do now". Fix: reuse C2's three-part block. On C2 itself, move "what to do now" above the reviewer line, so the order is risk → what to do → who is checking. Bucket **code**.

**M12 · Today's empty state is a dead end for a new patient.** After A2, Badr lands on "No active prescriptions yet — as soon as a doctor issues you a prescription…" with no action. SCREENS.md makes B4 "push from B2 / B1 empty state", and UX §1 and §7 ask for one action. Fix: an EmptyState action to `/app/medicines/add`. Bucket **code**.

**M13 · The F1 caregiver list breaks at 390px in English.** Names wrap one word per line, the status overlaps the name, and "Revoke access" overflows the right edge of the viewport. Fix: at phone width, drop the trailing button beneath the row text (or into the row's own sheet). Keep the full-width tap target. Bucket **code** (`CaregiverList.tsx`, the MenuRow trailing slot).

**M14 · Sign-in fails silently.** "123" plus Enter produces no message. Continue is disabled while the field is empty (disabled-until-valid). Fix: keep Continue enabled and validate on submit with a specific message ("الرقم المدني ١٢ رقم"), per UX §5 and §6. Also make the heading say where the user is ("سجّل دخولك بالرقم المدني"); today the `h1` is the wordmark and the visible heading is the landing tagline. Bucket **code + copy deck**.

**M15 · Side-stripe severity rows.** `components/ui/styles/AlertRow.css:11,29-31` gives C1, G1s and G2s rows a 2-line coloured inline-start stripe. That is Hallmark's side-stripe tell, and the brand book says a danger alert is "not a stripe, not a left border". The row already carries the icon and the severity word. Fix: a hairline all-round border, with severity from the icon and word. Bucket **code** (a pending component the team built).

**M16 · Danger covers 34–38% of the screen area.** Measured on B2, C2, F2 and G2s at 390; the brand book caps danger at 5–10% of a screen, and the same brand book mandates a full danger fill for the alert. Bucket **DECISIONS**. For example: a danger band carrying the title, with the body on `surface-card`.

**M17 · 200% text scale breaks navigation.** With every type token doubled at 390, which is a text-only proxy and not OS scaling: tab labels overlap into an unreadable strip, the AppBar title truncates to "آد…", and every shell screen scrolls sideways (29px patient, 12px caregiver, 21px setup). At 100% in English, "My Medicines" already wraps to two lines in the tab bar. Fix: let the TabBar label wrap or scale within its cell, and let the AppBar title wrap to two lines instead of ellipsis. Bucket **DECISIONS** (TabBar and AppBar are ported design-system components).

**M18 · In English, the activity feed and audit log show Arabic messages.** `AuditEvent.message` is a single-language seed string, so E2, F3 activity and X1 read "طلب تعبئة Metformin — يُوجَّه لصيدلية حكومية" under an English UI. Fix: render the sentence from `type` and its parameters through the copy catalogue, and keep `message` for the log. Bucket **DECISIONS** (contract).

**M19 · More than one primary action per screen** (UX §2). E5 has "Enable notifications" and "Open Telegram". D1 has one primary per prescription (3). The landing has 3 identical "Sign in with Hawiati" primaries, plus the launcher. Fix: E5's Telegram becomes secondary; D1's rows become secondary; the landing header CTA becomes secondary. Bucket **code**.

**M20 · The landing page is the AI template in structure.** It runs hero → 2 problem cards → 3 step cards → 6 equal feature cards → 2 audience cards → 3 safety cards → band → CTA → footer: about 20 near-identical bordered cards at an identical section rhythm (Hallmark gates 3, 8, 9). The section order is spec-bound (G11) and the boards draw the grids, so vary *within* sections. Features and safety statements become a typographic two-column list with no card borders. Cards stay only where they are actions (Audience). Bucket **DECISIONS** (the boards).

**M21 · Today gives no sign of the danger finding on the affected doses.** Warfarin and Ibuprofen appear four times on Hamad's home screen with no pointer to the pending danger finding, and the Safety tab carries no count. UX §14 names "the schedule" among the places an alert lives. Proposal: one line above the day list linking to C2. This is not a pill and not a dose status. Bucket **DECISIONS** (B1 scope).

**M22 · Heading structure.** On A1, A1b and F0 the `h1` is the wordmark "جرعة", not the screen's title. H1 (not found), H3 (offline) and F2 have no `h1`. Fix: one `h1` per screen, carrying the screen's title (UX §11). Bucket **code**.

---

## Minor

- **m1** The A1 countdown is a card inside a card (Hallmark card-in-card). Drop the outer frame.
- **m2** Four English strings use straight quotes: `i18n/copy/clinic.ts:87,103,109,185` ("missed", "reviewed", "dose status recorded"). Use curly quotes. The G2s sheet also shows the internal state word "reviewed"; say what happens instead.
- **m3** Icon semantics: "Turn on notifications" uses the `download` glyph, and More → Profile uses `home`. The 26-glyph set has no bell or person glyph. Report it to the design system (**DECISIONS**); never draw one inline.
- **m4** The B1 app-bar title stays "Today" while another day (26 September) is shown. The caregiver's return-to-today is icon-only while the patient's is a text button.
- **m5** Gender agreement: "فاطمة يطلب متابعة سجلك الطبي" should be "تطلب". The template has no gendered variant (**copy deck**).
- **m6** B3 shows 7–14 "— Not recorded" rows. Group them into one "Not recorded: …" line.
- **m7** B4 needs-review repeats "Unclear · Unclear in the photo" on every field.
- **m8** At 1440 the AppBar is capped at the content width and floats beside an empty gutter.
- **m9** X1 is 7,393px unpaginated at 390. Group by day, or load more.
- **m10** The clinic rail's "التبديل إلى تدقيق النظام" wraps to three lines (Hallmark gate 49).
- **m11** C2 (reviewed) shows "Reviewed by: A medical reviewer". §8 says "a resolved one never hides who resolved it" (**copy deck**; CR on reviewer identity).
- **m12** B2 and B3 show the literal seed value `(unreadable)`, in English inside the Arabic layout. CR-002 lets the name be absent while unread; propose absence plus localized copy (**DECISIONS**).
- **m13** The shell scrolls an inner `overflow-y-auto` pane inside `h-dvh`. That turns off iOS Safari's collapsing toolbar and tap-status-bar-to-top; consider scrolling the body.
- **m14** E3's frequency ChoiceGroup stays active (navy fill) while tracking is off, which reads like a second primary.

---

## What passed (measured, not assumed)

- **axe-core WCAG 2.0/2.1/2.2 A + AA: zero violations** on all 90 phone renders.
- **No interactive target under 44×44** on any route. Box size only; the 8px spacing rule was not measured.
- **No horizontal scroll at 100 %** on any route at 390 or 1440.
- **Rule 1:** no control on any rendered or driven screen offers to change a dose status.
- **Rule 3:** Hamad (tracking off) has no pills; Sara (tracked) shows `taken_on_time` and `upcoming`.
- **Rule 7:** no technical identifier leaked. A regex over every render found no `rx-/ia-/cg-/pt-` ids, no `undefined`, `NaN`, `Invalid Date`, `webcal://` or `mock-token`.
- Masked names in the activity feed and audit log are exact (`ناصر ح*** المطيري`).
- The failure states are explicit and honest: B4 unreadable, C3 could-not-identify, A1 unknown ID with the input kept. E3 "turn on tracking" with no channel routes to E5, as specced.
- Hallmark motion and typography hygiene: no `transition-all`, no italics, no runaway z-index. The landing hero uses a real screenshot in a `<figure>`, not re-drawn chrome (gate 47 passes).

## Not exercised (so nothing is claimed about them)

- **Loading skeletons, error and offline states.** The `jurah.dev` fault cookie had no effect on `/app`, `/app/medicines` or `/app/safety` (`lib/data/mock/faults.ts` says wiring was left to the screens). H2 was not triggered.
- **E5 `denied` / `granted` / `unsupported`.** Headless permission emulation left the copy unchanged, so the result is inconclusive.
- **B4 and C3 "analysing".** The mock resolves instantly.
- **F1 step 2 (masked-name confirmation).** Its Continue sits under the tab bar (C2).
- Also not covered: the Postgres backend, 834 tablet, 320px, real OS text scaling, keyboard focus order, and screen readers.

## Evidence

The capture scripts and outputs live in the session scratchpad and are not committed: `results.json` holds 135 renders with measured facts, `states.json` holds 40 driven states, `shots/` and `states/` hold 175 PNGs. Two findings were confirmed in the live browser:
- C3: computed `bottom: -44px` on the launcher, with no `.bottom-24` rule.
- C4: a `wsf-card flex flex-1 flex-col gap-2` element computed `display: block`.

**Summary: 9 critical · 22 major · 14 minor**
**Verdict:** the system underneath is sound: zero axe violations, no sub-44 targets, and the safety invariants hold on screen. What ships today reads as unfinished, though. There is a CSS cascade bug that garbles cards in 20 files, sheets hidden under the tab bar on phones, an assistant that isn't on screen on phones, and one privacy invariant broken in F1. C1–C7 and C9 are code fixes. C8 and M16–M18 need the owner.
