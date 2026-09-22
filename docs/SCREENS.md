# Jur'ah (جرعة) — Phase 1 Screen Table (the completeness contract)

**Status:** Phase 0 deliverable, awaiting owner approval at Gate 0. Nothing on this table may be dropped, deferred or merged away without the owner's written approval.

**Sources.** Screen codes, routes, shells, states and pass criteria come from `Acceptance Criteria and Test Plan.md` (the binding spec). Board names are the `.dc.html` files in `docs/wireframes/` (48 boards, indexed by `docs/wireframes/canvas.json` and its README). Components are the design system's twenty built ones (`docs/design-system/index.d.ts`, `docs/design-system/components/<Name>.md`) plus the eleven pending ones specified in `docs/Build Prompts.md` prompt 1; pending ones are marked `†`. Data-layer functions are the published surface listed in the appendix; they are the contract WP1 implements.

**Route conventions.** `[locale]` is `ar` or `en`. `?day=YYYY-MM-DD` on Today selects a day; absent means the day of `REFERENCE_NOW`. Sheets (invite, confirm, revoke, refill confirm, reviewer commit) are overlays on the screen named, not routes. Every shell screen also renders the four G7 states (content · loading · empty · error); the **States** column lists only the states the spec names beyond those four.

**Shared shell chrome (built in WP3, not counted as screens).** The patient **More** menu at `/[locale]/app/more` and the caregiver **More** menu at `/[locale]/care/more` are tab destinations whose content is a `MenuRow†` list (board `More.dc.html` for the patient; the caregiver one follows `navigation.md`). They exist so the tab bar has somewhere to land; they are not inventory screens and are not counted below.

---

## L — Public entry · 1 screen

| Code | Screen | Route | Shell / tab | States (beyond G7) | Components | Data functions | Boards |
|---|---|---|---|---|---|---|---|
| L1 | Landing page | `/[locale]` | none · no tab bar | 390/834/1440 × rtl/ltr · images unavailable (text alternatives, layout holds) · signed-in (primary button continues into the right shell) · ten sections in spec order · clinic route never linked or named | own layout markup (owner-approved exception) · Button · language switch in page header · static Today mockup image with alt text | **none** — L1 makes no data-layer call. Its signed-in state reads only the **session module** (`getSession()`, which is not part of the data-access layer) to point the primary button at the right shell | `Landing`, `Landing1440` |

## A — Sign-in and identity · 5 screens

| Code | Screen | Route | Shell / tab | States (beyond G7) | Components | Data functions | Boards |
|---|---|---|---|---|---|---|---|
| A0 | Session gate (routing state) | `/[locale]/gate` (also enforced by every shell layout and by middleware) | none | none → `/signin` · pending-invitation-only → `/invitation` · `onboardingCompleted:false` → A2 · patient → B1 · caregiver → F2 · reviewer → G1s · admin → X1 · always a skeleton, never blank, never a flash of the wrong shell | LoadingState | `getSession`, `getRoleOptions` | `SessionGate` |
| A1 | Sign-in / identity verification (mock) | `/[locale]/signin` | none · no tab bar · visible way back to L1 | empty · invalid ID (not in the test list; specific error, input kept) · valid ID with no role and no invitation (invitation-path message, identical wording whether or not the ID has an account) · valid ID with pending invitation only → F0 · countdown (seconds visible, cancel visible) · lapsed (retry) · approved → destination | TextField (dir=ltr, numeric) · Button · Countdown† · InlineNotice · Card | `signIn` | `Login`, `SignInStates` (4 panels: not-in-list · no-role-no-invitation · lapsed · pending-only) |
| A1b | Role chooser | `/[locale]/signin/choose` | none | shown only for two **active** roles · two equal Cards ("my medicines" / "<first name>'s medicines" with relationship) · remembers last choice · single-role ID never sees it · pending invitation is a notice, not a role | Card · Button (equal weight) | `getRoleOptions`, `chooseRole` | `RoleChooser` |
| A2 | First-run setup | `/[locale]/app/setup` | patient · **no tab bar during the flow** (build interpretation: §2 says a flow the user must complete shows steps, and A0 routes here before Today; the spec does not say either way) · reached by the tenth seed person (Gate 0 decision 4) | four steps: language (required) → notification offer (browser / Telegram / later, three equal options) → optionally invite a caregiver → closing explainer · abandon returns to the same step · completing sets `onboardingCompleted:true` · declining everything lands on B1 with no warning | StepIndicator† · ChoiceGroup (language) · Card + Button ×3 (offer) · the F1 invite sheet reused · InlineNotice | `getPatient`, `updateSettings` (language), `completeOnboarding`; offer routes into E5's functions; invite step reuses F1's | `Setup` (step 2 shown; steps 1, 3, 4 follow the same frame) |
| A3 | Profile / account (patient) | `/[locale]/app/more/profile` | patient · More | name · identity line (see DECISIONS CR-001: Civil ID **not** printed) · browser notifications on/off/blocked and chat connected/not connected, both neutral, each linking to E5 · optional contact phone · language (display only; the switch is in the app bar) · linked-caregiver count with link to F1 · **sign out** (exists nowhere else in this shell) → L1 with no way back | DetailRow · MenuRow† · TextField (phone) · Button (sign out, secondary) | `getPatient`, `updatePatientPhone`, `getSettings`, `getPushState`, `getMessagingLink`, `getCaregivers`, `signOut` | `Profile` |

## B — The day and the medications (patient shell) · 4 screens

| Code | Screen | Route | Shell / tab | States (beyond G7) | Components | Data functions | Boards |
|---|---|---|---|---|---|---|---|
| B1 | Dose Schedule — Today (home) | `/[locale]/app` (+ `?day=`) | patient · Today | **tracking off** (default: no pills, one plain line offering to turn tracking on) · tracked day with mixed statuses · tracked day with a `missed` dose · future day · empty day (فاطمة on 2026-09-21) · pending caregiver invitation addressed to this user (one quiet line → F0, never a modal) · day navigation both ways + return to today · date shown prominently · duration boundary visible one day forward (rx-002 ends 2026-09-25) · row tap → B3 and nothing else | AppBar (language switch) · IconButton ×2 (day nav, mirrored chevrons) · ScheduleGroup† · DoseRow† (**no-status variant keyed on `tracked`**) · InlineNotice (tracking-off line, invitation notice) · Button (turn tracking on → E3/E5) · EmptyState · TabBar | `getDosesForDay`, `getPendingInvitationsForSubject`, `getSettings`, `getPrescriptions` (for names) | `TodayPlan` (tracking off, default) · `Main` (tracked) · `TodayMissed` · `Today834` · `TodayLTR` · `States` (empty · loading · error panels) |
| B2 | My Medicines | `/[locale]/app/medicines` | patient · My Medicines | normal · empty (offers add/scan) · **danger alert at top, most prominent, for every patient** · multiple alerts (lead with most severe, link the rest) · tracking off (next dose time instead of status) · **past** grouping (`completed`, `discontinued` with reason and date, no refill action) · 834 two-pane allowed, alert stays full width · 1280 board | InteractionAlert · PrescriptionCard (dose only when tracked) · SectorChip · Card · EmptyState · Button (add) · TabBar | `getPrescriptions`, `getAlerts`, `getDosesForDay` (next/most-recent dose per rx), `getSettings` | `Medicines`, `MedicinesPast`, `MedicinesDesktop`, `States` |
| B3 | Prescription detail | `/[locale]/app/medicines/[prescriptionId]` | patient · push from B1/B2 | every contract field incl. dispensing · read-only dose-history timeline · tracking off: planned doses without statuses and one line why · `needsReview`: plain line that fields await confirmation · core-fields-only record renders with no "undefined" · no `dispensing` → no depletion estimate · link to D1 for this rx | AppBar (back) · DetailRow · SectorChip · DoseTimeline† (with/without statuses) · DepletionMeter (only with dispensing) · InlineNotice · Button (refill, secondary) | `getPrescription`, `getDoseHistory`, `getSettings`, `getRefillOverview` | `Prescription` |
| B4 | Add / scan prescription | `/[locale]/app/medicines/add` | patient · push from B2 / B1 empty state | idle · analysing (what is happening, roughly how long) · confident (review-and-confirm) · `needsReview` (uncertain fields marked) · could-not-read (explicit failure, never a fabricated record) · saved → back to B2 with the record listed · **no hand-typing of prescriber-owned clinical fields** | AppBar (back) · PhotoInput† · LoadingState · DetailRow (read-only review) · InlineNotice · Button · ErrorState | `submitPrescriptionImage`, `savePrescriptionDraft` | `AddPrescription` |

## C — Safety (patient shell) · 3 screens

| Code | Screen | Route | Shell / tab | States (beyond G7) | Components | Data functions | Boards |
|---|---|---|---|---|---|---|---|
| C1 | Safety alerts list | `/[locale]/app/safety` | patient · Safety | has alerts (most severe, most recent first; `reviewed` and `auto_cleared` history included) · none (reassuring, not alarming) · entry to C3 | AppBar · AlertRow† · EmptyState · Button (drug check) · TabBar | `getAlerts` | `Safety`, `States` |
| C2 | Interaction alert detail | `/[locale]/app/safety/[alertId]` | patient · push from B2 / C1 / C3 result | `pending_medical_review` (three-part safety copy §8; never reads as final; no OK/dismiss) · `reviewed` (decision + note + who) · `auto_cleared` · `sourceCitation` verbatim; empty citation shown as **unverified** (owner still owes the real one) · opening never changes state | AppBar (back) · InteractionAlert · Card · DetailRow · PrescriptionCard ×n (involved rx) | `getAlert`, `getPrescription` ×n | `AlertDanger`, `AlertReviewed` |
| C3 | Travel / photo drug check | `/[locale]/app/safety/check` | patient · in place on C1's push | idle · analysing · result (drug named, verdict screened against the full profile) → an interaction hands off to C2 · **could not identify** (at least one test image produces it) | AppBar (back) · PhotoInput† · LoadingState · Card · InteractionAlert (result) · ErrorState · Button | `checkDrugPhoto` | `DrugCheck` |

## D — Supply (patient shell) · 1 screen

| Code | Screen | Route | Shell / tab | States (beyond G7) | Components | Data functions | Boards |
|---|---|---|---|---|---|---|---|
| D1 | Refill request | `/[locale]/app/more/refill` (also pushed from B3) | patient · More | per rx: remaining, depletion estimate (none without `dispensing`), request action · confirm sheet naming the routing destination from **that rx's own `source.sector`** · after request: same list, that rx now "requested" + destination, InlineNotice · **my requests** section (`RefillRequest` rows with status) | AppBar · Card · DepletionMeter · SectorChip · Button · Sheet · InlineNotice · MenuRow† (requests) · TabBar | `getRefillOverview`, `requestRefill`, `getRefillRequests` | `Refill` |

## E — Ambient, records and preferences (patient shell) · 5 screens

| Code | Screen | Route | Shell / tab | States (beyond G7) | Components | Data functions | Boards |
|---|---|---|---|---|---|---|---|
| E1 | Calendar sync | `/[locale]/app/more/calendar` (one tap from B1's notice too) | patient · More | off (subscribe action) · on (per-patient `webcal://` link from `patientId` + `token`, short instructions, one-directional line) | AppBar · CopyField† · Button · InlineNotice · Toggle | `getCalendarSubscription`, `enableCalendarSync`, `updateSettings` (`calendarSyncEnabled`) | `Calendar` |
| E2 | Activity feed | `/[locale]/app/more/activity` | patient · More | patient-scoped `AuditEvent` rows, reverse chronological · each links to the thing it happened to · read-only · masked names, no Civil ID | AppBar · ActivityRow† · EmptyState | `getActivity` | `Activity` |
| E3 | Settings | `/[locale]/app/more/settings` | patient · More | **exactly**: adherence tracking on/off + frequency · refill alerts · calendar sync · optional contact phone · adherence control with no connected chat reads off, explains in one line, links to E5; switching on with no channel goes to E5 rather than failing · turning off names the consequence (check-ins stop, new statuses stop, history kept) · **no language control**, no engine toggles anywhere | AppBar · Toggle · ChoiceGroup (frequency) · TextField (phone) · InlineNotice · Sheet (turn-off confirmation) | `getSettings`, `updateSettings`, `getMessagingLink`, `updatePatientPhone` | `Settings` (see CR-011: board's channel Select is omitted) |
| E4 | Help & support (patient) | `/[locale]/app/more/help` | patient · More | static copy: how the app works · check-ins optional and answered in the chat · a dose instruction looks wrong · a safety alert appears · contacting the issuing clinic or pharmacy · no clinical advice | AppBar · Card · MenuRow† | none (copy catalogue only) | `Help` |
| E5 | Notifications & messaging | `/[locale]/app/more/notifications` | patient · More (also from A2's offer, A3, E3's adherence row) | **Browser section:** `default` (explains what the browser will ask) · `granted` (on, alert types listed, send test) · `denied` (neutral, re-enable steps, never a nag) · `unsupported` incl. **iOS Safari not installed → Home Screen steps** · **Chat section (optional):** not connected (neutral) · waiting (one-time token, never shown) · connected (test message · disconnect with consequence) · expired/failed with retry · bot handle from config, labelled simulated · neither section blocks navigation | AppBar · InlineNotice (never warning tone for off) · Button · MenuRow† · Card · Sheet (disconnect) | `getPushCapability`, `getPushState`, `requestPushPermission`, `disablePush`, `sendTestNotification`, `getMessagingLink`, `startMessagingLink`, `disconnectMessaging`, `sendTestMessage`; bot handle from `config` | `Messaging`, `NotifyStates` (4 panels) |

## F — Caregiver · 6 screens

| Code | Screen | Route | Shell / tab | States (beyond G7) | Components | Data functions | Boards |
|---|---|---|---|---|---|---|---|
| F0 | Caregiver invitation — consent | `/[locale]/invitation` (+ `?id=` when a patient answers a notice) | **none** · no tab bar · only exits are its two buttons | pending (who asks: patient **first name** + claimed relationship · exactly what accepting shows · exactly what it never allows · patient will be told · **accept / decline equal size and weight**) · accepted (short confirmation → caregiver shell, or A1b for a dual-role user) · declined (plain acknowledgement, way out, nothing revealed) · expired / cancelled (says so, no action) · before acceptance **no** prescription, dose, alert or activity data is loaded or loadable · existing patient answers without signing out and returns where they were | Card · DetailRow · InlineNotice · Button ×2 (`size=lg`, `fullWidth`, primary + secondary) · language switch in a minimal header | `getInvitationForConsent`, `acceptInvitation`, `declineInvitation`, `getSession` | `InviteConsent`, `InviteStates` (accepted · declined · expired panels) |
| F1 | Caregiver management (patient side) | `/[locale]/app/more/caregivers` | patient · More | list with **pending** (cancel) · **active** (accepted date, revoke) · **declined** · **expired** — all neutral, no badge/dot/warning colour · invite sheet step 1: Civil ID once + name known by + relationship · step 2: **masked name** confirmation (نعم / لا) — or, for a Civil ID with no account, the identical "invitation created" outcome · cancel and revoke each confirm naming the consequence · after invite: back on the list with "awaiting acceptance" · patient is told in-app when someone accepts | AppBar (back) · Button (invite, primary) · MenuRow† (relationship states) · Sheet ×2 (invite, masked-name confirm) · TextField ×3 · InlineNotice · masked name as `body-strong` text (see CR-021) | `getCaregivers`, `lookupMaskedName`, `inviteCaregiver`, `cancelInvitation`, `revokeCaregiver` | `Caregivers`, `InviteMasked` (3 panels: entry · masked confirm · no-account twin) |
| F2 | Caregiver home | `/[locale]/care` (Today) and `/[locale]/care/medicines` | caregiver · Today, Medicines | **persistent ContextBanner naming whose data**, every screen · reuses B1 and B2 renderers in read-only mode · patient tracking off → same plan, same one-line explanation, never more · danger alert shown, opens C2 content read-only · switch to own patient shell when they have one · **zero write controls, absent not disabled** | ContextBanner† · the B1/B2 components · TabBar (3) · MenuRow† (switch role, in More) | `getCaregiverLink`, `getDosesForDay`, `getPrescriptions`, `getAlerts`, `getSettings` (patient's, read-only), `getRoleOptions` | `CaregiverHome`, `CaregiverPlan` (patient tracking off) |
| F3 | Caregiver detail access | `/[locale]/care/medicines/[prescriptionId]` · `/[locale]/care/alerts/[alertId]` · `/[locale]/care/more/activity` | caregiver · push from F2 / More | prescription detail (B3 content minus every action) · alert detail (C2 content; opening never changes state) · activity feed (E2 content) · each identical to the patient's view minus actions | B3 / C2 / E2 components under ContextBanner† | `getPrescription`, `getDoseHistory`, `getAlert`, `getActivity` | `CaregiverDetail` |
| F4 | Caregiver profile & notifications | `/[locale]/care/more/profile` | caregiver · More | own name · identity line (CR-001: no Civil ID) · linked patient (first name) and since when · **own notification setup**: browser (four states) · own chat link, **alerts only, never check-ins** · **unlink myself** (confirm; says the patient can re-invite) · **sign out** · no `Settings` row: nothing here touches the patient | DetailRow · MenuRow† · Button (unlink, secondary; sign out) · Sheet · InlineNotice · the E5 section components scoped to `subjectType: "caregiver"` | `getCaregiverLink`, `getPushCapability`, `getPushState`, `requestPushPermission`, `disablePush`, `getMessagingLink`, `startMessagingLink`, `disconnectMessaging`, `selfUnlink`, `signOut` | `CaregiverProfile` |
| F5 | Caregiver help | `/[locale]/care/more/help` | caregiver · More | static copy for the relative: what they can and cannot see · cannot record doses or change anything · a danger alert appears (contact the clinic; do not change medication) · how to be re-invited if access ends | Card · MenuRow† | none (copy catalogue only) | `CaregiverHelp` |

## G — Clinic shell, medical reviewer · 3 screens

| Code | Screen | Route | Shell / tab | States (beyond G7) | Components | Data functions | Boards |
|---|---|---|---|---|---|---|---|
| G1s | Reviewer queue — interaction findings | `/[locale]/clinic/review` | clinic · Review · ContextBanner "simulated clinical role" | every `pending_medical_review` alert, most severe first, with patient (first name), drugs, waiting time from `createdAt` vs `REFERENCE_NOW` · empty queue · segmented switch to G3s in place | ContextBanner† · AlertRow† · ChoiceGroup (segmented: findings / field confirmation) · EmptyState · TabBar (2, side rail ≥ 834) | `getReviewQueue` | `ReviewerQueue` |
| G2s | Reviewer decision | `/[locale]/clinic/review/[alertId]` | clinic · push from G1s | description · `sourceCitation` verbatim (or "to be supplied") · involved prescriptions with clinical fields · **patient-context panel, read-only**: full active list with facility + sector, recent dose history (DoseTimeline, with or without statuses) · **confirm the risk / clear it**, optional note, each confirms in a Sheet before committing · writes review fields + audit event · back to G1s with the item gone · no Prescription field, no Dose editable · reviewer sees no patient without a queue item | AppBar (back) · InteractionAlert · Card · DetailRow · PrescriptionCard · SectorChip · DoseTimeline† · TextField (note) · Button ×2 · Sheet · InlineNotice · AlertRow† (the queue pane from ~1000px of content width, D-009 — read-only rows, the open item marked) | `getAlertForReview`, `submitReviewDecision`, `getReviewQueue` (the queue pane) | `ReviewerDecision`, `ReviewerDesktop` (1280 with context panel and queue pane) |
| G3s | Reviewer queue — field confirmation | `/[locale]/clinic/review/fields` (rendered in place beside G1s) · detail `/[locale]/clinic/review/fields/[prescriptionId]` | clinic · Review | flagged `needsReview` prescriptions with uncertain fields marked and the source image available · **confirm the field values** (`confirmed`, `needsReview` cleared) · **return to the issuing clinic** (`returned`, reason) · returned history rows · a flagged rx never feeds schedule or screening until confirmed | AlertRow† · Card · DetailRow · TextField (values, reason) · Button ×2 · Sheet · InlineNotice · image with alt | `getFieldConfirmationQueue`, `getFlaggedPrescription`, `confirmPrescriptionFields`, `returnPrescriptionToClinic` | `FieldQueue` |

## X — Clinic shell, system admin · 2 screens

| Code | Screen | Route | Shell / tab | States (beyond G7) | Components | Data functions | Boards |
|---|---|---|---|---|---|---|---|
| X0 | Clinic entry & role chooser | `/[locale]/clinic` (sign-in) · `/[locale]/clinic/choose` | none until a role resolves · labelled simulated · states that access is enforced server-side by role, not by the address being unlisted | Civil ID sign-in (same simulation, same states as A1) · chooser between **medical review** and **system administration** for an ID holding both (د. خالد, per Gate 0 decision 5) · a non-clinic ID is refused here with the same neutral wording · never linked from L1 or the patient app | TextField · Button · Countdown† · Card ×2 (equal) · InlineNotice | `signIn`, `getRoleOptions`, `chooseRole` | `ClinicEntry` |
| X1 | System audit log | `/[locale]/clinic/audit` | clinic · Audit | full log newest first: what happened · when · **which actor** (human label, never the role string) · which patient (masked name) · filters by actor type, event type, date (in place) · **filtered to dose-status writes → every actor is the agent or the system, none the interface** (the demo's proof moment, called out in an InlineNotice) · empty (no rows match) · metadata only: no medication list, alert text or dose detail · append-only · admin opens no clinical record | ContextBanner† ("simulated ops role") · Select ×3 (filters) · ActivityRow† (actor slot + patient reference; table layout at 1440) · InlineNotice · EmptyState · TabBar | `getAuditLog` | `AuditLog`, `AuditLog1440` (see CR-010 for what the board shows that the spec forbids) |

## H — System pages · 3 pages

| Code | Page | Route / mechanism | States | Components | Data functions | Boards |
|---|---|---|---|---|---|---|
| H1 | Not found | `app/[locale]/not-found.tsx` (+ root `not-found.tsx`) | one plain sentence · one way back (home of the current shell, else L1) | EmptyState · Button | `getSession` (to pick the way back) | `SystemPages` panel 1 |
| H2 | Application error | `app/[locale]/error.tsx` + `app/global-error.tsx` | one plain sentence · retry · way back · no error code, no blame | ErrorState · Button | none | `SystemPages` panel 2 |
| H3 | Offline / failed refresh | `/[locale]/offline` (service-worker fallback) **and** the failed-refresh state inside every list screen | last known data with an **"as of"** line · refresh action · never an empty screen | InlineNotice · the screen's own rows · Button (refresh) · ContextBanner† (last-known notice variant) | `readLastKnownSnapshot` (data-layer cache read; the mock keeps the last successful read per function) | `SystemPages` panel 3 |

---

## Count, per group, against the spec's tally

| Group | Spec says | This table lists | Codes |
|---|---|---|---|
| L | 1 | 1 | L1 |
| A | 5 | 5 | A0, A1, A1b, A2, A3 |
| B | 4 | 4 | B1, B2, B3, B4 |
| C | 3 | 3 | C1, C2, C3 |
| D | 1 | 1 | D1 |
| E | 5 | 5 | E1, E2, E3, E4, E5 |
| F | 6 | 6 | F0, F1, F2, F3, F4, F5 |
| G | 3 | 3 | G1s, G2s, G3s |
| X | 2 | 2 | X0, X1 |
| **Screens** | **30** | **30** | |
| H | 3 | 3 | H1, H2, H3 |
| **Total** | **30 + 3** | **30 + 3** | |

Uncounted shell chrome built alongside (WP3): patient More menu · caregiver More menu · the in-shell role switch row · the clinic side navigation with its sign-out (see DECISIONS CR-020).

## Board coverage check (48 boards → this table)

Every board is referenced above. Boards that serve more than one row: `States` (G7 panels for B1/B2/C1) · `SignInStates` (A1's four states) · `NotifyStates` (E5 and F4's four permission states) · `InviteStates` (F0 outcomes) · `InviteMasked` (F1's two steps and the no-account twin) · `SystemPages` (H1–H3) · `More` (shell chrome). Wider boards: `Landing1440`, `Today834`, `MedicinesDesktop` (1280), `ReviewerDesktop` (1280), `AuditLog1440`. Direction proof: `TodayLTR`.

---

## Appendix — the published interface (v0, for WP1)

Two modules, both typed, both `async`, both implemented by WP1. `Phase 2 — Backend Handoff.md` §2 lists them as separate artefacts (the session module and the data-access layer), so they are counted separately here and in `BACKEND-NOTES.md` §1 and §5. Types come from `types/contracts.ts` (the spec's Data Contracts, transcribed, plus the Gate 0 additions `Account` and `Prescription.drug.strengthUnit`) plus the view types named here, which WP1 defines in `lib/data/api.ts` and `lib/session/api.ts`. **No screen may add a function; a missing one is a request to the lead, who serialises a WP1 follow-up.**

### Session module (`lib/session`) — 5 functions
- `signIn(civilId: string): Promise<SignInOutcome>` — `{ kind: 'not_in_test_list' } | { kind: 'no_claims' } | { kind: 'pending_invitation_only', invitationId } | { kind: 'single_role', session } | { kind: 'multiple_roles', options }`. The `no_claims` wording is identical for an ID with and without an account.
- `getSession(): Promise<Session | null>` — `{ subjectId, role: 'patient'|'caregiver'|'reviewer'|'admin', linkedPatientId?, pendingInvitationOnly?: true }`; never carries the Civil ID.
- `getRoleOptions(): Promise<RoleOption[]>` — the active roles the signed-in Civil ID holds, for A1b, X0's chooser and the in-shell switch.
- `chooseRole(option: RoleOption): Promise<Session>` · `signOut(): Promise<void>`

### Data-access layer (`lib/data`) — 50 functions

**Patient and settings** — `getPatient(patientId)` · `updatePatientPhone(patientId, phone | null)` · `completeOnboarding(patientId)` · `getSettings(patientId)` · `updateSettings(patientId, patch: PermittedSettingsPatch)` (only the seven permitted keys; `adherenceCheckInEnabled: true` refused without a `connected` link).

**Prescriptions and doses** — `getPrescriptions(patientId): Promise<Prescription[]>` (active and past) · `getPrescription(prescriptionId)` · `getDosesForDay(patientId, isoDate): Promise<DoseWithPrescription[]>` · `getDoseHistory(prescriptionId): Promise<Dose[]>` · `getRecentDoses(patientId, days): Promise<DoseWithPrescription[]>` · `submitPrescriptionImage(patientId, image: Blob): Promise<ExtractionOutcome>` (`confident` · `needs_review` · `unreadable`) · `savePrescriptionDraft(patientId, draftId): Promise<Prescription>`.

**Safety** — `getAlerts(patientId): Promise<InteractionAlert[]>` · `getAlert(alertId)` · `checkDrugPhoto(patientId, image: Blob): Promise<DrugCheckOutcome>` (`identified` with verdict and optional alertId · `could_not_identify`).

**Supply** — `getRefillOverview(patientId): Promise<RefillLine[]>` (per active rx: remaining, total, `daysRemaining | null`, `routedTo`) · `requestRefill(patientId, prescriptionId): Promise<RefillRequest>` · `getRefillRequests(patientId)`.

**Calendar** — `getCalendarSubscription(patientId): Promise<CalendarSubscription | null>` · `enableCalendarSync(patientId): Promise<CalendarSubscription>`.

**Activity** — `getActivity(patientId): Promise<AuditEvent[]>` (patient-scoped).

**Notifications** — `getPushCapability(): Promise<{ supported: boolean; iosNeedsInstall: boolean }>` · `getPushState(subject): Promise<PushSubscription | null>` · `requestPushPermission(subject): Promise<PushSubscription>` (simulated) · `disablePush(subject)` · `sendTestNotification(subject)` · `getMessagingLink(subject): Promise<MessagingLink>` (`not_connected` when none) · `startMessagingLink(subject): Promise<MessagingLink>` (pending; the mock confirms after a delay) · `disconnectMessaging(subject)` · `sendTestMessage(subject)`. `subject = { subjectType: 'patient' | 'caregiver', subjectId }`.

**Caregivers, patient side** — `getCaregivers(patientId): Promise<Caregiver[]>` · `lookupMaskedName(civilId): Promise<{ maskedName: string | null }>` (same shape and timing either way) · `inviteCaregiver(patientId, { civilId, name, relationship }): Promise<Caregiver>` · `cancelInvitation(caregiverId)` · `revokeCaregiver(caregiverId)`.

**Consent, invited side** — `getPendingInvitationsForSubject(): Promise<InvitationSummary[]>` (session-scoped) · `getInvitationForConsent(invitationId): Promise<InvitationSummary>` — `{ id, patientFirstName, relationship, status, expiresAt }` **and nothing else** · `acceptInvitation(invitationId): Promise<Session>` · `declineInvitation(invitationId): Promise<void>`.

**Caregiver shell** — `getCaregiverLink(caregiverId): Promise<{ patientId, patientFirstName, acceptedAt }>` · `selfUnlink(caregiverId)`.

**Clinic** — `getReviewQueue(): Promise<ReviewQueueItem[]>` · `getFieldConfirmationQueue(): Promise<FieldQueueItem[]>` · `getAlertForReview(alertId): Promise<AlertReviewView>` (alert + involved prescriptions + `PatientContext { activePrescriptions, recentDoses, trackingOn }`) · `submitReviewDecision(alertId, decision: 'confirmed' | 'cleared', note?)` · `getFlaggedPrescription(prescriptionId)` · `confirmPrescriptionFields(prescriptionId, values, note?)` · `returnPrescriptionToClinic(prescriptionId, reason)` · `getAuditLog(filters: { actorRole?, type?, from?, to? }): Promise<AuditEvent[]>`.

**Resilience** — `readLastKnownSnapshot(key): Promise<{ data, asOf } | null>` used by H3 and the failed-refresh state.

Count: 5 session functions + 50 data-access functions = 55. Functions not listed here do not exist.
