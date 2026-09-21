# Jur'ah (جرعة) — Acceptance Criteria & Test Plan (Frontend + Backend)

**Audience:** this document is written for the AI coding agent building the **frontend and backend** of this system. It is the functional specification to build against and validate against. Treat every "Pass criteria" and "Non-negotiable invariant" as a hard requirement, not a suggestion.

**Project name:** the product is **جرعة / Jur'ah**. The published design system artifact is titled **Jur'ah — جرعة**; its JavaScript namespace is still `Wasfa`, the earlier working name, because `bundle.js`, every component preview and the wireframe canvas import from that global. Read "Wasfa" as a module name, never as the product.

**Companion documents, all binding:** `Project Brief.md` (product context and safety principles — read first) · `UX Principles.md` (the interface ruleset; a screen that meets its functional criteria but breaks a rule there is **not** finished) · `Master Prompt — Phase 1.md` (how the build is planned and delegated) · `Design System Foundations.md` (tokens, built and pending components, and the wireframe canvas's coverage) · `Seed Dataset.md` (the one canonical cast of people and records every track builds and demonstrates against) · `Phase 2 — Backend Handoff.md` (the seam between the phases, what Phase 1 must hand over, and the single prompt that starts the backend) · `AI Agents Acceptance Criteria.md` (the other track; the only shared surfaces are the Data Contracts and the seed data).

**Approved visual reference:** the *Jur'ah Wireframes* canvas — 48 artboards covering every screen below, built from the design system's real components and filled with the seed data. Where a board and this file disagree, this file wins and the board is corrected.

**This file owns the screen count, the role model and the route structure.** Other documents point here rather than repeating them. Invariants are numbered **G1–G12** in this file only; rules referenced as **§n** belong to `UX Principles.md`.

**Revision history.**
*v2* — the Dose Schedule and Medical Reviewer screens, the Global UI Invariants, `startDate` / `doseTimes`.
*v3* — completeness pass: eight missing screens plus the system pages; navigation specified; `onboardingCompleted`, `Caregiver.status`.
*v4* — the chat channel became Telegram; the messaging-connection screen; `telegramChatId`, `MessagingLink`.
*v5* — **the chat became optional and off by default** (**G10**). `Dose.tracked`; `notificationChannel` default `"none"`; `adherenceCheckInEnabled` default `false`.
*v6* — the public **landing page (L1)**, the route structure, and the honesty invariants for a public page (**G11**).
*v7* — the caregiver and clinician audiences got a real plan: one sign-in resolving the role from the Civil ID with a chooser for a dual-role person; the caregiver shell gained depth, its own notifications, a profile and its own help; a separate unadvertised clinic shell holds the medical reviewer (with patient context and a field-confirmation queue) and a system admin with the audit log; **browser notifications** joined under **G12**.
*v7.1* — consistency pass: a dangling "G13" reference corrected, `MessagingLink` cleaned to one subject reference, the PWA shell stated as Phase 1 scope, and a caregiver confirmed to have no `Settings` row.
*v7.2* — **the caregiver invitation is now safe against a mistyped Civil ID.** A single digit wrong previously handed a stranger read access to a full medication history, because signing in *was* the acceptance. Now: the patient confirms a **masked name** before the invitation is created, and **the invited person must explicitly accept** — signing in is never acceptance, and a `pending` invitation grants nothing. One screen was added (**F0**, the consent screen) and **G9** extended to cover identity disclosure. Deliberately kept simple: no double entry of the Civil ID, no phone field, no OTP.
*v7.3* — pre-handoff audit. **(a) The screen count was wrong.** Every version from v7 onwards under-counted: the inventory below has always listed **thirty** screens, not twenty-seven or twenty-eight, because `A0`, `A1b` and `X0` were never added to the running total. The inventory itself never changed — only the number quoted in front of it, which is now stated per group so it can be audited rather than trusted. **(b) F0 had no route**; it is now `/[locale]/invitation`. **(c) The seed dataset exists** — `Seed Dataset.md` — so "use the canonical seed dataset" now points somewhere, and the messaging bot handle is a stated placeholder rather than an open question. **(d) The two stale references are gone:** the design system's `navigation.md` now describes the four surfaces and the consent gate, and the wireframe canvas covers all thirty screens. **(e) Phase 1 now owes Phase 2 a written handover**, `/docs/BACKEND-NOTES.md`, specified in `Phase 2 — Backend Handoff.md` §3.
*v7.4 (current, Gate 0 of Phase 1)* — three Data Contract changes approved by the owner and applied per the change-request protocol: `Account` added (CR-008); `Prescription.drug.strengthUnit` added (CR-003); five `Prescription` fields made optional **only while unread**, with two stated invariants (CR-002); `strengthMg` documented as holding the number in `strengthUnit`'s unit; `Caregiver.revokedAt` added (CR-027). `docs/DECISIONS.md` holds the reasoning. The A3/F4 "Civil ID (masked)" wording is superseded by the strict rule (CR-001) and awaits the owner's text (CR-026).

**Team ownership.** Two parallel tracks: **Frontend + Backend** (this document, the project owner's track) and **AI Agents** (six agents, n8n workflows, prompts, RAG — owned independently). The only requirement across the boundary is that whatever the agents produce conforms to the Data Contracts.

## Build Phases

- **Phase 1 — Frontend.** The complete UI against a mock data layer only. No real database, no live backend, no live agent output, no real Telegram bot, **no real web push**. A **PWA shell is in scope** — a web app manifest and a registered service worker — because iOS delivers notifications only to an installed app and the install instructions have to be truthful; the push subscription itself, the VAPID keys and delivery are Phase 2, and the permission flow is simulated here.
- **Phase 2 — Backend.** The real database, API layer, deterministic logic, calendar feed, the messaging link path, real web push, and the integration points the AI Agents track plugs into. Not the agents themselves. **The frontend does not change in Phase 2** — see `Phase 2 — Backend Handoff.md`.

Do not begin Phase 2, and do not let any Phase 1 screen make a real network call, until Phase 1's acceptance criteria are met.

## The role model (decided)

Four roles, three shells, one sign-in:

| Role | Reached by | Shell | Can write |
|---|---|---|---|
| `patient` | Civil ID sign-in | patient shell (4 tabs) | settings, refill requests, prescription intake, their own links and subscriptions, caregiver invitations |
| `caregiver` | Civil ID sign-in **after accepting** an invitation addressed to that Civil ID | caregiver shell (read-only + own profile) | nothing on the patient's behalf; only their own profile, their own notifications and their own self-unlink |
| `reviewer` | the clinic route, unadvertised | clinic shell | review state on alerts; field confirmation on flagged prescriptions |
| `admin` | the clinic route, unadvertised | clinic shell | nothing clinical; reads audit metadata |

**One Civil ID may hold two roles** (a patient who also cares for a parent — common in Kuwait). Sign-in then presents a chooser (A1b), and inside either shell a switch moves between them **without signing out**.

**A caregiver cannot self-register, and an invitation alone grants nothing.** The role exists only after the invited person accepts (F0). A Civil ID with no invitation and no patient record is told plainly — "no one has linked you to their record; ask your relative to invite you from the app" — never "wrong number".

**"Unadvertised" is not security.** The clinic route is not linked from the landing page and not discoverable in the patient app, but it is protected by a **server-side role check**, exactly like every other route. Obscurity is organisation, not protection, and no document or presentation may claim otherwise.

## Route structure (decided)

- `/[locale]` — the public landing page (L1). No tab bar, no session.
- `/[locale]/signin` — Civil ID / Hawiati mock flow (A1), then the role chooser (A1b) where it applies.
- `/[locale]/invitation` — the caregiver invitation consent screen (F0). **Outside every shell**, reachable by a session whose only claim is a pending invitation, and by an existing patient answering the notice in their own shell. No tab bar; the only ways out are its own two buttons.
- `/[locale]/app/...` — the patient shell.
- `/[locale]/care/...` — the caregiver shell.
- `/[locale]/clinic/...` — the clinic shell. Reached by direct URL only.

`[locale]` is `ar` or `en` and sets `dir` on `<html>`.

---

## GLOBAL UI INVARIANTS (every screen, both phases)

**G1 — The app never records adherence.**
No control anywhere — no button, checkbox, swipe, long-press, context menu **or notification action** — may create or change a `Dose.status`. Adherence is recorded **only** through the Adherence Agent's conversation on the patient's connected chat channel, which passes deterministic validation. The frontend displays dose status; it never authors it. The external calendar feed is one-directional for the same reason.

**G10 — The chat channel is optional, and the app is complete without it.**
Adherence tracking is an opt-in layer. A new patient is **not connected, tracking off**, and that is normal — never an error, a warning or a blocked screen. Everything else works.

Because of **G1**:

- With tracking off, doses are still generated and shown, but carry **no status**. The schedule is a plan, not a log; no status pill renders on an untracked dose.
- **No dose is ever marked `missed` because its time passed unanswered.** Silence is not evidence. Nothing in the UI, and nothing in the backend, may infer a status from the clock.
- The schedule says this in one plain line with a way to turn tracking on. It never nags.
- Turning tracking off stops check-ins and new statuses; it never deletes recorded history, and the UI says both.

**G12 — Notifications alert. They never collect.**
Three delivery tiers: **in-app, always on** (and nothing is ever delivered only by a notification — a denied permission or an unlinked chat may never be why someone fails to learn about a danger finding) · **browser notifications, opt-in, alerts only** (a danger interaction, a reviewer decision, a refill warning, a new prescription, a caregiver invitation, a dose reminder) · **chat, opt-in, the only tier that can record adherence.**

Non-negotiable rules for any notification: **no notification carries an action that writes clinical data** — tapping it opens the relevant screen, and a notification action that sets a dose status is **G1** broken through a side door · **capability is stated, never assumed** (web push needs HTTPS, a service worker and a subscription; it works in Chrome, Edge and Firefox, and on iOS **only when the app has been added to the Home Screen**, 16.4+ — so all four permission states are designed and the iOS case gives install steps rather than a promise) · **a denied or unsupported permission is a neutral state** (see `UX Principles.md` §13) and never blocks anything · safety-critical content is never only in a payload · **no notification reaches a caregiver whose invitation is not `active`.**

**G11 — A public page claims nothing that is not true.** (governs L1)
No third-party marks · no invented evidence (no statistic without a real named source, no testimonials, no reviews, no "trusted by N", no awards, no press logos) · the simulation disclosed on the page itself in ordinary type in both languages · no medical advice, no outcome promises, no claim of certification or approval · every product claim traces to a feature in this inventory, and every screenshot shown is a screen that exists.

**G2 — Language switch lives in the app bar, not in Settings.** Reachable from every screen, persisted as `Settings.language`. On the landing page it sits in the page header and changes the locale segment.

**G3 — Deterministic reference time.** A single `REFERENCE_NOW` constant drives every "is this past / is this today" decision. Never `Date.now()` in component code. Its value is fixed in `Seed Dataset.md`.

**G4 — Status is read from data, never inferred by the UI.** The UI renders `Dose.status` as given, and renders nothing where there is nothing.

**G5 — Missing component → stop and ask.** Build from the Jur'ah design system's components; never improvise one inline. L1 is the one screen expected to need layout markup of its own.

**G6 — Responsive, bidirectional, accessible.** 390 / 834 / 1440px, both directions, logical properties only, up to 200% text scale, 44×44px minimum targets, never colour alone.

**G7 — Four states minimum per screen.** Content, loading, empty and error.

**G8 — Navigation is fixed and shallow.** Patient shell: four destinations — **Today · My Medicines · Safety · More**; nothing a patient needs deeper than two taps; `More` holds Refill, Calendar sync, Notifications, Caregivers, Activity, Settings, Profile, Help. Caregiver shell: three — **Today · Medicines · More**. Clinic shell: two — **Review · Audit**. No hamburger, no hidden drawer, no gesture-only navigation anywhere. The landing page and the invitation consent screen sit outside every shell.

**G9 — Fixed vocabulary, and minimum identity disclosure.**
Four dose-status words, two sector words, three review-state words, identical everywhere. No technical identifier — a chat id, a link token, a push endpoint, a role string — is ever shown to a user.

And, added in v7.2, because the app handles other people's Civil IDs:

- **A name is never shown in full to someone who was not already entitled to it.** Where a name must be confirmed, it is **masked**: the first name in full, each middle name as its initial followed by a fixed three asterisks, and the family name in full — `عبدالله م*** ع*** المطيري`. The asterisk count is **always three**, never the real length, since the length of a name is itself information.
- **The app never confirms or denies whether a Civil ID exists in the system.** A masked name is returned only for a Civil ID that already has a Jur'ah account; for any other value the flow proceeds identically and says only that the invitation was created. Nothing anywhere lets a user enumerate Civil IDs, and no error message distinguishes "not a user" from "not invited".
- **A masked name is a confirmation aid, never an authorisation.** It reduces a mistyped digit; it does not authorise access. Access comes only from the invited person's explicit acceptance (F0).

---

## PHASE 1 — FRONTEND

### Scope

Every screen below, working, backed by a single isolated mock-data layer conforming exactly to the Data Contracts. No real API, database or external service; the chat link and the push permission are both simulated. The PWA manifest and service worker exist but subscribe to nothing.

### Backend Foundations to Design For While Building Phase 1

Phase 2 replaces what sits behind the data layer without touching a screen. That only works if the seam below is real — `Phase 2 — Backend Handoff.md` §1 explains the model and §3 specifies the written handover.

- **All data access behind one typed layer** of async functions returning Promises. No component imports mock data, and no component contains a fetch. L1 needs no data layer and must not call it. Treat the function signatures and return shapes as a published interface, because Phase 2 is built against them.
- **One place for backend configuration**: API base URL, auth token, the messaging bot handle, the push public-key placeholder, and `REFERENCE_NOW`.
  - **The messaging bot handle is a placeholder in Phase 1**: `@jurah_bot` (no such bot exists yet). It is read from configuration, never hard-coded into a screen, and wherever it appears the surrounding copy says the chat is simulated in this phase. Replacing it with the real handle in Phase 2 must be a one-line change in one file. **No screenshot, slide or document may present the placeholder as a live bot.**
- **Session modelled as if real**: subject id **and role** (`patient` / `caregiver` / `reviewer` / `admin`), plus, for a caregiver, the linked patient id, plus the case where the only claim is a pending invitation.
- **Referentially consistent mock data** — **take it from `Seed Dataset.md`, do not invent it.** That file fixes the cast, the Civil IDs, the prescriptions, the generated doses around `REFERENCE_NOW`, the alerts, the settings, the links, the subscriptions, the invitations in every state and the audit rows, and it states which path each record exists to prove. The paths it must cover: a patient with **the chat off and no dose statuses** (the default) · an **opted-in** patient · a Civil ID that is **both** a patient and an active caregiver · a caregiver invitation in **`pending`** (never accepted, granting nothing) · one in **`declined`** · one **`expired`** · a Civil ID with **no account** (so no masked name can be shown) · a patient who is **also holding a pending invitation from someone else**, so the in-app notice path is exercised · a prescription with `needsReview: true`, one **returned**, one **confirmed** · a `MessagingLink` and a `PushSubscription` in each state · `AuditEvent` rows of every type.
- **A written handover to Phase 2**: `/docs/BACKEND-NOTES.md`, appended to as the build proceeds, with the seven sections specified in `Phase 2 — Backend Handoff.md` §3. It is a Phase 1 deliverable; Phase 1 is not finished without it.

### Screen Inventory

**Thirty screens plus three system pages** — counted per group so the total can be audited rather than trusted: **L** 1 · **A** 5 (A0, A1, A1b, A2, A3) · **B** 4 · **C** 3 · **D** 1 · **E** 5 · **F** 6 (F0–F5) · **G** 3 · **X** 2 = **30**, then **H** 3 system pages. A0 is a routing state rather than a designed screen but it is built, tested and listed, so it is counted.

Tiers set polish effort, not whether a screen ships: **[T1]** demo-critical · **[T2]** complete and correct · **[T3]** minimal but present.

#### L. Public entry (outside every shell) — 1 screen

**L1. Landing page** — [T1]
Sections, in order: **(1)** persistent header — wordmark, language switch, and one persistent **"الدخول عن طريق هويّاتي" / "Sign in with Hawiati"** button; **(2)** hero — one sentence of value, one supporting line, two actions, and a real mockup of the Today screen; **(3)** the problem in two parts (instruction loss; fragmented records); **(4)** the solution in three steps; **(5)** six feature cards, each naming a feature that exists here; **(6)** adherence follow-up, marked optional, stating that everything above works without it; **(7)** who it is for — **two cards: the patient, and the family caregiver (who enters with the same Civil ID after being invited and accepting)** — plus one plain line that clinical reviewers use a separate address, **without linking it**; **(8)** safety and privacy — the app never records a dose by itself, a danger finding stops at a human reviewer, screening is grounded in published drug data; **(9)** academic transparency — capstone prototype, simulated identity flow, synthetic data; **(10)** closing call to action and footer.
- **Bounded visual exception (owner-approved):** L1 may use the `display` type style, wider vertical rhythm, and its own layout markup. It may **not** introduce a colour, font family, radius or shadow outside the tokens, restyle a component, or use the `danger` token decoratively.
- **Required states:** 390 / 834 / 1440 in both directions; images unavailable (every mockup has a text alternative and the layout holds); signed-in (the primary button continues into the right shell instead of signing in).
- **Pass criteria:** sign-in is reachable from the top and from the closing section; nothing on the page fails **G11**; the clinic route is not linked or named; the page makes no data-layer call and collects nothing.

#### A. Sign-in and identity — 5 screens

**A0. Session gate** *(routing state)* — [T3] — route by session: none → `/signin`; **a session whose only claim is a `pending` invitation → `/invitation` (F0)**; `onboardingCompleted: false` → A2; patient → Today; caregiver → caregiver Today; reviewer → review queue; admin → audit log. A skeleton, never a blank screen or a flash of the wrong shell.

**A1. Sign-in / identity verification (mock)** — [T1]
- One Civil ID field. Only IDs in the fixed test list are accepted; anything else is rejected with a specific, plain error that does not clear the input.
- On a valid ID: the "open the Hawiati app and approve" countdown, auto-resolving, then into the right destination. Retryable if it lapses. A visible way back to the landing page.
- **Required states:** empty · invalid ID · **valid ID with no role and no invitation** (the message names the invitation path, never implying the number is wrong, and never revealing whether that ID has an account) · **valid ID with a pending invitation only** → F0 · countdown · lapsed · approved.
- Pass criteria: an invalid or unrecognised Civil ID never reaches any shell; a valid one always reaches its correct destination, no flaky failure.
- Non-negotiable invariants: nothing in the code or copy suggests a real identity service is called — it is labelled a simulation. **Signing in is never acceptance of an invitation** (see F0).

**A1b. Role chooser** — [T2]
Shown only when the signed-in Civil ID holds more than one **active** role: two large, equally weighted choices — "my medicines" and "<patient first name>'s medicines" — with the relationship named. Remembers the last choice as the default, and each shell offers a switch back **without signing out**. Pass criteria: a single-role ID never sees this screen; a dual-role ID reaches both shells without signing out; a pending invitation does **not** create a second role here — it appears as the notice described in F0.

**A2. First-run setup** — [T2]
- Runs once while `onboardingCompleted` is false. **Only the language step is required.**
- Order: language → **offer notifications** → optionally invite a caregiver → a closing explainer.
- **The notification offer is a question with two levels and a decline**, all three legible: **browser notifications** (no other app needed), **Telegram** (adds daily check-ins and adherence follow-up), or **later** — one line each, and "later" an ordinary choice of the same weight.
- Pass criteria: completing setup sets `onboardingCompleted: true` and it never runs again; **declining everything lands on Today with a fully working app and no error or warning**; abandoning setup returns to the same step.

**A3. Profile / account (patient)** — [T2] — name, Civil ID (masked), notification status (browser: on/off/blocked; chat: connected/not connected — both neutral, each linking to E5), optional contact phone, language, linked-caregiver count with a link to manage, and **sign out**, which exists nowhere else. Sign out clears the session and returns to the landing page with no way back into patient data.

#### B. The day and the medications (patient shell) — 4 screens

**B1. Dose Schedule — "Today"** — [T1] — *home*
Every `Dose` of the selected day across all active prescriptions, in time order, grouped under time headers. Each row: drug generic + brand, dose amount with unit, and — **only when that dose is tracked** — its status pill. Tapping a row opens the prescription detail; that is its only action. Day navigation both ways, an always-available return to today, the date shown prominently.
- **Required states:** **tracking off** (the default — a clean plan, no status pills, one plain line offering to turn tracking on); a tracked day with mixed statuses; a tracked day with a **missed** dose; a **future** day; an empty day; **a pending caregiver invitation addressed to this user** (one quiet line — "<name> asks to follow their medication · review the request" — opening F0, never a modal and never blocking the schedule); loading; error.
- Pass criteria: every dose of the day appears exactly once, ascending; none leaks from another day; none after `discontinuedAt` or beyond `startDate + durationDays`; **a dose with `tracked: false` renders no status pill, and no dose renders as `missed` unless the data says so.** The pill's absence must key off `tracked`, not off the status word — with the seed data every untracked dose also reads `upcoming`, so a renderer keyed to the word looks right here and breaks the moment tracking is switched on.
- Non-negotiable invariant: read-only per **G1** — most of all in the tracking-off state.

**B2. My Medicines** — [T1] — active prescriptions as cards (generic + brand, facility with its sector chip, and the next/most-recent dose status **when tracked**, otherwise the next dose time). A danger-severity `InteractionAlert` renders at the top as the most prominent element on the screen, for every patient regardless of channels. A second grouping for **past** medications (`completed`, `discontinued`), de-emphasised, with the discontinuation reason and date and no refill action. States: normal; empty; multiple alerts; tracking off; loading; error.

**B3. Prescription detail** — [T1] — every field of the `Prescription` contract including the dispensing section, plus a read-only **dose-history timeline**; with tracking off it shows planned doses without statuses and says why. If `needsReview` is true it says plainly that some fields await confirmation. A record with only core fields renders with no broken layout and no "undefined"; a record with no `dispensing` shows no depletion estimate rather than a fabricated one.

**B4. Add / scan prescription** — [T2] — capture or upload → analysing → review-and-confirm with uncertain fields marked → saved. States: idle; analysing; confident; `needsReview`; could-not-read (explicit failure, never a fabricated record). Non-negotiable invariant: it submits an image for extraction and never lets the patient hand-type a clinical field the prescriber owns.

#### C. Safety (patient shell) — 3 screens

**C1. Safety alerts list** — [T2] — the `Safety` tab: findings most severe and most recent first, including `reviewed` and `auto_cleared` history. States: has alerts; none (reassuring, not alarming); loading; error.

**C2. Interaction alert detail** — [T1] — names the interacting prescriptions and explains the risk in the three-part shape from `UX Principles.md` §8; displays `sourceCitation` verbatim (a finding without one is shown as unverified); visually distinct `pending_medical_review` and `reviewed` states, the latter showing `reviewerDecision` and the note. Non-negotiable invariant: a pending finding never reads as final.

**C3. Travel / photo drug check** — [T2] — capture or upload → analysing → a result naming the drug and a verdict screened against the full profile → or an explicit "could not identify" state, which at least one test image must produce.

#### D. Supply (patient shell) — 1 screen

**D1. Refill request** — [T2] — per prescription: remaining quantity, depletion estimate, a request action, and on request a confirmation naming the routing destination from that prescription's own `source.sector`. A **my requests** section lists `RefillRequest` records with their status. Routing always matches the originating sector; no `dispensing` data means no depletion estimate rather than a fabricated one.

#### E. Ambient, records and preferences (patient shell) — 5 screens

**E1. Calendar sync** — [T2] — a subscribe action producing the per-patient `webcal://` link (from `patientId` + `token`), short instructions, and a line stating the sync is one-directional. Reachable in one tap from the Today notice as well as from More.

**E2. Activity feed** — [T3] — the patient-scoped `AuditEvent` rows in reverse chronological order: what happened, when, and a link to the thing it happened to. Read-only.

**E3. Settings** — [T2] — exactly: adherence tracking and its check-ins (on/off plus frequency), refill alerts, calendar sync, and an optional contact phone. The adherence control **requires a connected chat channel**: with none it reads as off, explains why in one line, and links to E5; switching it on with no channel goes to E5 rather than failing. Turning it off states the consequence (check-ins stop, new statuses stop, history is kept). Dashboard, interaction screening and the schedule/extraction engine appear in no form. No language control (**G2**).

**E4. Help & support (patient)** — [T3] — how the app works in a few plain sentences; that check-ins are optional and answered in the chat rather than in the app; what to do if a dose instruction looks wrong; what to do if a safety alert appears; how to contact the issuing clinic or pharmacy. No clinical advice.

**E5. Notifications & messaging** — [T2]
Two clearly separated sections. **Browser notifications:** what they cover in one line and a single enable control, with all four permission states designed — `default` (the control explains what the browser will ask), `granted` (on, alert types listed, a **send a test notification** action), `denied` (neutral, plain re-enable instructions, never a nag), `unsupported` (including the **iOS Safari case, where the honest instruction is to add Jur'ah to the Home Screen first**, with the steps). **Chat (Telegram), optional:** one line on what it adds beyond notifications, then **Open Telegram** with a one-time link token → waiting → connected, with **send a test message** and **disconnect** (confirming, naming the consequence). States: not connected (neutral); waiting; connected; expired/failed with retry; loading; error.
- Pass criteria: `telegramChatId` is never typed by hand and never displayed; the link token is per-subject, single-use, never shown as a value; no push endpoint or key is ever displayed; the bot handle comes from configuration and is labelled simulated in Phase 1; neither section blocks navigation; a patient with everything off sees a complete, calm screen.

#### F. Caregiver — 6 screens

**F0. Caregiver invitation — consent** — [T1] · route `/[locale]/invitation`
**The gate that makes a mistyped Civil ID harmless.** One screen, no shell, reached two ways: as the first thing after sign-in for someone whose only claim is a pending invitation, or from the quiet notice in the patient shell (B1 / More) for someone who already uses Jur'ah as a patient — **who never has to sign out to answer it.**

It shows, and nothing more:

- who is asking — the patient's **first name** and the relationship they claimed ("حمد · يقول إنك ابنه")
- **exactly what accepting lets them see**: the medication list, the dose schedule, safety alerts and the activity log — in plain words
- **exactly what it does not let them do**: record a dose, change a prescription, change a setting, or act for the patient in any way
- that the patient will be told if they accept
- two actions of equal weight: **قبول** and **رفض**

- **Required states:** pending (the decision); accepted (a short confirmation, then into the caregiver shell — or, for a dual-role user, the role chooser); declined (a plain acknowledgement and a way out of the flow, with nothing revealed); expired or already cancelled by the patient (says so, offers no action); loading; error.
- **Pass criteria:** before acceptance, this screen and the session behind it expose **no** prescription, dose, alert, or activity data of any kind · declining leaves the invitation `declined` and grants nothing, ever · an existing patient answers it **without signing out** and returns to exactly where they were · a dual-role user who accepts reaches both shells through the role chooser and the in-shell switch · the screen carries no tab bar and no route out except its own two buttons.
- **Non-negotiable invariants:** **signing in is never acceptance** — only the action on this screen moves an invitation from `pending` to `active` · a `pending`, `declined`, `expired` or `revoked` caregiver record grants zero read access, enforced server-side · this screen never displays the patient's full name, Civil ID, phone or any clinical field.

**F1. Caregiver management (patient side)** — [T2]
- **Inviting, in two steps and nothing more.** The patient enters the caregiver's **Civil ID once**, plus the name they know them by and the relationship. The app then shows a **masked name** for confirmation — `عبدالله م*** ع*** المطيري`, per **G9** — and asks "is this them?" with نعم / لا. On نعم the invitation is created; on لا the patient corrects the number. There is no second entry of the Civil ID, no phone field and no code.
- **When the Civil ID has no Jur'ah account**, no name can be shown; the flow proceeds identically and says only that the invitation was created. Nothing distinguishes the two cases to the user (**G9**).
- **The list** shows each caregiver with their state: **pending** (awaiting their answer, with a cancel action), **active** (with the date they accepted), **declined**, **expired**, and revoke for an active one — each with a confirmation naming the consequence. Every one of those states is drawn neutrally: a declined invitation is a person's choice and an expired one is time passing, so neither gets a warning colour, an alert icon, a dot or a badge.
- **Pass criteria:** a mistyped Civil ID that is corrected at the masked-name step never creates an invitation · an invitation that is never accepted grants nothing and eventually expires · the patient is told when an invitation is accepted (in-app always, plus a notification if any channel is on) so an unexpected name can be revoked · cancelling a pending invitation makes it unacceptable.
- **Non-negotiable invariants:** the masked-name step is a confirmation aid, never an authorisation (**G9**) · nothing here reveals whether a Civil ID has an account · a full name, a Civil ID or a phone number of the invited person is never displayed back to the patient.

**F2. Caregiver home** — [T2] — after accepting: a read-only view of the patient's Today and My Medicines, reusing B1 and B2's data rather than a redesigned view, under a persistent banner naming whose data is shown (`UX Principles.md` §10). Three destinations: Today · Medicines · More, plus a switch to their own patient shell when they have one. If the patient has tracking off, the caregiver sees the same plan and the same explanation — **never a fuller picture than the patient's own**. Pass criteria: no route reachable in this role exposes any write control on patient data.

**F3. Caregiver detail access** — [T2] — the caregiver can open, read-only: **prescription detail** (B3's content), **interaction alert detail** (C2's content) and the **activity feed** (E2's content). Pass criteria: each renders identically to the patient's own view minus every action; opening an alert does not change its state.

**F4. Caregiver profile & notifications** — [T2] — their own name and Civil ID (masked), the patient they are linked to and since when, **their own notification setup** (browser notifications with the same four states; optionally their own chat link, delivering **alerts only** — never adherence check-ins), **unlink myself from this patient** (confirming, and saying the patient can re-invite), and **sign out**. A caregiver has **no `Settings` row**: their preferences are exactly their own `PushSubscription` and `MessagingLink`, and nothing they change alters the patient's settings, schedule or statuses.

**F5. Caregiver help** — [T3] — written for the relative: what they can and cannot see, that they cannot record doses or change anything, what to do when a danger alert appears (contact the clinic; do not change medication themselves), and how to ask the patient to re-invite them if access ends.

#### G. Clinic shell — medical reviewer — 3 screens

**G1s. Reviewer queue — interaction findings** — [T2] — every `InteractionAlert` with `reviewStatus: "pending_medical_review"`, most severe first, with the patient, the drugs involved and how long it has waited. Labelled clearly as a simulated clinical role in Phase 1.

**G2s. Reviewer decision** — [T2] — the alert description, `sourceCitation` verbatim, the involved prescriptions with their clinical fields, **and a patient-context panel: the full active medication list, each prescription's facility and sector, and the recent dose history — read-only.** Then **confirm the risk** or **clear it**, each with an optional note, each confirming before it commits, setting `reviewStatus: "reviewed"` plus `reviewerDecision`, `reviewerNote`, `reviewedAt`, `reviewedBy`, and writing an audit event the patient and caregiver can see.
- Non-negotiable invariants: review state only — no `Prescription` clinical field and no `Dose` is editable here; no patient- or caregiver-role session can reach this screen; the reviewer cannot see any patient who has no item in one of their queues.

**G3s. Reviewer queue — prescriptions awaiting field confirmation** — [T2] — the prescriptions flagged `needsReview: true`, with the uncertain fields marked and the source image available, and two actions: **confirm the field values** (`fieldReviewStatus: "confirmed"`, clearing `needsReview`) or **return it to the issuing clinic** (`"returned"`, with a reason, leaving it out of the schedule).
- Pass criteria: a flagged prescription never feeds the schedule engine or interaction screening until confirmed here.
- Non-negotiable invariant: the reviewer may correct a field **only** through this audited flow. There is no silent edit path to a prescription's clinical fields anywhere in the product.

#### X. Clinic shell — system admin — 2 screens

**X0. Clinic entry & role chooser** — [T2] — the unadvertised entry: Civil ID sign-in (same simulation), then a chooser between **medical review** and **system administration** for an ID holding both. Visibly labelled a simulated clinical/ops role, and stating plainly that access is enforced server-side by role rather than by the address being unlisted.

**X1. System audit log** — [T1 for the demo]
Every recorded event, newest first: what happened, when, **which actor caused it**, and which patient it refers to. Filters by actor type, event type and date. Read-only.
- **Why this is demo-critical:** filtering to dose-status writes shows every one came from `adherence_agent` or `system` and **none from the UI**.
- **Data scope (owner-decided):** events, actors, timestamps and a patient reference — **not** medication lists, alert text or dose details. An invitation's lifecycle appears here as metadata, with any name masked and no Civil ID anywhere.
- Required states: full log; filtered; empty; loading; error.
- Non-negotiable invariants: the admin role can read no clinical record, open no patient screen and take no clinical action; the log is append-only.

#### H. System pages — 3 pages

**H1. Not found** · **H2. Application error** · **H3. Offline / failed refresh** — [T3] — each says what happened in one plain sentence and offers a way back. H3 shows the last known data with an "as of" line.

### Data Contracts

Fields added in v7.2 are marked. `Settings` belongs to a patient only. The values that fill these shapes live in `Seed Dataset.md`.

```
Account {                              // v7.4 (Gate 0, CR-008) — one row per Civil ID that has a Jur'ah account,
                                       // patient or not. Role resolution reads it; the masked-name lookup reads
                                       // `name` and returns a masked form ONLY when a row exists (G9).
  id: string
  civilId: string                      // never displayed, never returned to a client
  name: string                         // full name; shown in full only to its own holder
  roles: ("patient" | "caregiver" | "reviewer" | "admin")[]   // caregiver counts only while a Caregiver row is active
}

Patient {
  id: string
  civilId: string                      // demo: must belong to the pre-seeded test-ID list
  name: string
  telegramChatId?: string              // v4 — null until opt-in. Null is NORMAL (G10).
  telegramLinkedAt?: string            // v4
  phone?: string                       // v4 — optional contact number. Not a messaging address.
  language: "ar" | "en"                // v2
  onboardingCompleted: boolean         // v3
  caregiverIds: string[]
}

Caregiver {                            // one record per invitation; the role exists only once accepted
  id: string
  civilId: string                      // v7 — REQUIRED. Entered once by the patient and confirmed
                                       //      against a MASKED name (G9). It addresses the invitation;
                                       //      it does not authorise anything by itself.
  name: string                         // the name the PATIENT knows them by — a claim, not a lookup
  relationship: string
  phone?: string
  telegramChatId?: string              // v4 — optional, alerts only, never check-ins, only while active
  linkedPatientId: string
  status: "pending" | "active" | "declined" | "expired" | "revoked"   // v7.2 — declined/expired added
  invitedAt: string                    // v7.2
  expiresAt: string                    // v7.2 — a pending invitation stops being acceptable after this
  acceptedAt?: string                  // v7.2 — set ONLY by the F0 accept action
  declinedAt?: string                  // v7.2
  revokedAt?: string                   // v7.4 (CR-027) — when access ended. Set by BOTH kinds of withdrawal:
                                       //      after acceptance (caregiver_revoked) and before any answer
                                       //      (caregiver_invite_cancelled). `acceptedAt` set/unset tells them apart.
  accessLevel: "read_only"
  // Only `active` grants any read access. pending / declined / expired / revoked grant NOTHING.
  // `revoked` is the single end state for an invitation the patient took back; the acceptedAt
  // distinction exists for the audit log and F1's wording ONLY — no code path branches on it for access.
}

Prescription {
  id: string
  patientId: string
  source: { facilityName: string, sector: "public" | "private" }
  drug: {
    genericName: string
    brandName?: string                 // v7.4 — optional: absent for a generic-only record, or while unread (see below)
    strengthMg?: number                // v7.4 — optional only while unread (see below).
                                       // HOLDS THE NUMBER IN THE UNIT `strengthUnit` NAMES — the field name is
                                       // historical. rx-008 is `strengthMg: 50, strengthUnit: "mcg"`, never 0.05.
                                       // Nothing anywhere multiplies or divides this value (guard-scripted); a
                                       // reader who trusts the name produces a 1000× levothyroxine dose.
    strengthUnit?: "mg" | "mcg" | "g" | "ml" | "IU"   // v7.4 (Gate 0, CR-003) — default "mg"; rx-008 is the one non-default
  }
  dosePerAdministration: number
  frequencyPerDay?: number             // v7.4 — optional only while unread (see below)
  durationDays: number
  dosingPattern: "daily" | "alternate_day" | "other"
  startDate?: string                   // v2 REQUIRED, v7.4 optional only while unread. ISO date. The schedule anchor.
  doseTimes?: string[]                 // v2 REQUIRED, v7.4 optional only while unread. "HH:mm". Length MUST equal frequencyPerDay.
  // v7.4 (Gate 0, CR-002) — the five fields above (brandName, strengthMg, frequencyPerDay, startDate,
  // doseTimes) may be absent ONLY while `needsReview` is true or `fieldReviewStatus` is "pending" or
  // "returned". Two INVARIANTS, guard-scripted in Phase 1 and enforced at write time in Phase 2:
  //   (1) a prescription with status "active" and needsReview false carries all five;
  //   (2) the dose generator returns an EMPTY array unless startDate is present and
  //       doseTimes.length === frequencyPerDay. "Optional" never means an active prescription may
  //       have no schedule.
  prescribedAt?: string                // v2
  prescriberName?: string              // v2
  timingRelativeToFood?: string
  routeOfAdministration?: string
  specialNotes?: string
  indication?: string
  dispensing?: {
    unitsPerPackage: number
    totalQuantityDispensed: number
    dispenseDate: string
    brandActuallyDispensed?: string
  }
  needsReview: boolean                 // v2
  fieldReviewStatus?: "pending" | "confirmed" | "returned"   // v7
  fieldReviewedBy?: string             // v7
  fieldReviewedAt?: string             // v7
  fieldReviewNote?: string             // v7
  status: "active" | "completed" | "discontinued"
  discontinuedReason?: string
  discontinuedAt?: string
}

Dose {
  id: string
  prescriptionId: string
  scheduledAt: string
  status: "upcoming" | "taken_on_time" | "taken_late" | "missed"
  tracked?: boolean                    // v5 — false when generated while tracking was off: no pill,
                                       //      and no process may ever transition it to missed. Default true.
  recordedAt?: string                  // v2 — required for taken_late
  source?: "adherence_agent" | "system" | "seed"   // v2 — never "ui"
}

InteractionAlert {
  id: string
  patientId: string
  involvedPrescriptionIds: string[]
  severity: "info" | "warning" | "danger"
  description: string
  sourceCitation: string               // v2
  createdAt: string                    // v2
  reviewStatus: "auto_cleared" | "pending_medical_review" | "reviewed"
  reviewerDecision?: "confirmed" | "cleared"   // v2
  reviewerNote?: string                // v2
  reviewedAt?: string                  // v2
  reviewedBy?: string                  // v2
}

RefillRequest {
  id: string
  patientId: string                    // v2
  prescriptionId: string
  requestedAt: string
  routedTo: "public_pharmacy" | "private_pharmacy"   // must match prescription.source.sector
  status: "requested" | "approved" | "denied"
}

CalendarSubscription { patientId: string, icsUrl: string, token: string }

MessagingLink {                        // v4, subject-scoped in v7
  id: string
  subjectType: "patient" | "caregiver"
  subjectId: string                    // the subject is identified once, here; a caregiver's patient is
                                       // found through Caregiver.linkedPatientId
  channel: "telegram"
  status: "not_connected" | "pending" | "connected" | "expired"   // not_connected is the DEFAULT
  linkToken?: string
  chatId?: string
  connectedAt?: string
}

PushSubscription {                     // v7
  id: string
  subjectType: "patient" | "caregiver"
  subjectId: string
  status: "active" | "revoked"
  permission: "default" | "granted" | "denied" | "unsupported"
  createdAt: string
  // The endpoint and its keys live SERVER-SIDE ONLY and never appear in a client payload,
  // in this contract, or on any screen.
}

AuditEvent {                           // v7 — the single event log
  id: string
  scope: "patient" | "system"
  patientId?: string
  actor: {
    role: "patient" | "caregiver" | "reviewer" | "admin" | "agent" | "system"
    id?: string
  }
  type: "prescription_added" | "prescription_discontinued" | "prescription_field_confirmed"
      | "prescription_returned_to_clinic" | "alert_raised" | "alert_reviewed"
      | "dose_status_recorded" | "schedule_recomputed" | "refill_requested"
      | "refill_status_changed" | "caregiver_invited" | "caregiver_invite_accepted"
      | "caregiver_invite_declined" | "caregiver_invite_expired"
      | "caregiver_invite_cancelled" | "caregiver_revoked" | "caregiver_self_unlinked"
      | "messaging_connected" | "messaging_disconnected" | "push_enabled" | "push_disabled"
      | "tracking_enabled" | "tracking_disabled" | "signed_in" | "signed_out"
                                       // v7.2 added the four invite lifecycle types
  message: string                      // plain language; a name in it is MASKED, and it never
                                       // contains a Civil ID
  createdAt: string
  relatedId?: string
  // Append-only. Nothing in the product edits or deletes an AuditEvent.
}

Settings {                             // one row per PATIENT. A caregiver has no Settings row.
  patientId: string                    // v2
  adherenceCheckInEnabled: boolean     // v5 — DEFAULT false. Requires a connected chat channel.
  adherenceCheckInFrequency: "daily" | "every_other_day"
  refillAlertsEnabled: boolean
  calendarSyncEnabled: boolean
  webPushEnabled: boolean              // v7 — DEFAULT false. Alerts only; never a clinical action.
  notificationChannel: "none" | "telegram" | "whatsapp" | "email"   // v5 — the CHAT channel. DEFAULT "none"
  language: "ar" | "en"                // v2
  // No field here may ever represent disabling the dashboard, interaction
  // screening, or the schedule/extraction engine.
}
```

### Explicitly Out of Scope for Phase 1

Any real backend call, database or persistence beyond local/mock state · the six AI agents · a real Telegram bot (**the handle is the placeholder `@jurah_bot`**) · **real web push** (the manifest and service-worker shell ARE in scope) · PRN medication UI · real SFDA/RxNorm/DrugBank lookups, real ICS generation, real Civil ID integration · real authentication for the caregiver, reviewer and admin roles · **an OTP or phone-delivered invitation code** (deliberately cut for simplicity; the acceptance step is the gate) · **a caregiver linked to more than one patient** · **prescriber and pharmacist portals** · any lead capture, contact form, analytics or tracking script on the landing page.

### Phase 1 → Phase 2 Handoff Checklist

- All **thirty** screens and three system pages are implemented, each with its required states. Count them against the per-group tally at the head of the inventory.
- Mock data comes from `Seed Dataset.md` unchanged, conforms exactly to the Data Contracts, and covers every path that file lists — including a `pending`, a `declined` and an `expired` invitation, a Civil ID with no account, and a patient holding a pending invitation from someone else.
- **The seam holds:** all data access goes through the one typed layer, no component imports mock data, no component contains a fetch, and every configurable value lives in the config module. Phase 2 must be able to replace the implementation behind that layer without touching a screen.
- **`/docs/BACKEND-NOTES.md` is complete** against the seven sections in `Phase 2 — Backend Handoff.md` §3 — above all section 3, the list of invariants the frontend currently satisfies by leaving a control out, which the backend has to turn into server-side refusals.
- **G1 verified by search:** no code path writes `Dose.status`; no dose-logging control exists; **no notification payload or action writes clinical data.**
- **G10 verified:** with tracking off, no status pill renders, no dose is `missed`, no screen warns about it, and every feature except adherence tracking works. The pill's absence keys off `tracked`, not off the status word.
- **G12 verified:** all four push permission states render; the iOS-without-install case gives install instructions; nothing is delivered only by notification; no notification path exists for a non-`active` caregiver.
- **G9 verified:** every name shown for confirmation is masked with exactly three asterisks per middle name, whatever the real length; no screen or error message reveals whether a Civil ID has an account; no full name, Civil ID or phone of an invited person is displayed back; no audit message contains a Civil ID.
- **The invitation gate verified:** signing in with a Civil ID that has a pending invitation reaches **F0 and nothing else** — no prescription, dose, alert or activity data is reachable before acceptance; declining grants nothing; an existing patient answers without signing out; accept and decline are the same size and weight.
- **G11 verified on L1 item by item**, and the clinic route is not linked or named there.
- **G3 verified:** statuses render identically regardless of the real system date.
- **G8 verified:** four tab destinations in the patient shell, three in the caregiver shell, two in the clinic shell; nothing a patient needs deeper than two taps; L1 and F0 carry no tab bar.
- Role resolution verified: a single-role ID skips A1b; a dual-role ID reaches both shells without signing out; an unrecognised ID gets the invitation message.
- The caregiver shell exposes no write control on patient data, and shows no more than the patient sees.
- The reviewer cannot edit a clinical field except through G3s; the admin can open no clinical record.
- Sign out exists in every shell and returns to the landing page with no way back.
- The bot handle is read from configuration in exactly one place, and nothing presents it as a live bot.
- No hard-coded hex colour, font size, spacing value or radius in component code — verified by repository-wide search.
- Every screen passes the twelve-point checklist at the end of `UX Principles.md`.

---

## PHASE 2 — BACKEND (excludes AI agents)

### Scope

The real database, API layer and deterministic logic behind Phase 1's screens. Not the six agents. The landing page needs no backend and must not gain one.

**`Phase 2 — Backend Handoff.md` is the operational companion to this section**: it holds the seam model, the `/docs/BACKEND-NOTES.md` contract, the refusal matrix, the single master prompt to paste, and the five failure modes to expect. This section remains the binding criteria.

**The frontend does not change.** Not a component, not a screen, not a data-layer signature, not a return shape — only the implementation behind the seam, and the values in the config module. A required interface change is a change request, not an edit.

### Components & Acceptance Criteria

**Database schema.** One table per contract entity (`Patient`, `Caregiver`, `Prescription`, `Dose`, `InteractionAlert`, `RefillRequest`, `CalendarSubscription`, `MessagingLink`, `PushSubscription`, `AuditEvent`, `Settings`), foreign keys matching the `...Id` references. A write-then-read round trip returns exactly the shape the Phase 1 mock layer returned — checkable because both are generated from `Seed Dataset.md` and because `BACKEND-NOTES` recorded the shapes verbatim. `doseTimes.length === frequencyPerDay` is a write-time constraint. `AuditEvent` is append-only **at the database level**, not by application discipline.

**Civil ID mock auth and role resolution (server side).** Validates against the pre-seeded test-ID list, resolves the roles that Civil ID holds — counting a caregiver record only when its `status` is `active` — and issues a session carrying subject id, role and, for a caregiver, the linked patient id. Non-negotiable invariants: an ID outside the list is rejected server-side even if a client skips the frontend check; **a Civil ID whose only claim is a `pending` invitation receives a session that can reach F0's data and nothing else**; a session's role is never taken from a client-supplied value.

**Caregiver invitation path.** *(new in v7.2)*

- **Masked-name lookup.** One endpoint takes a Civil ID and returns a masked name — first name in full, each middle name as its initial plus exactly three asterisks, family name in full — **only** when that Civil ID has a Jur'ah account, and returns an indistinguishable "no name available" otherwise. The two responses must match in status code, shape and latency class; compare them byte for byte apart from the name itself. It is **rate-limited per session** and every call is audited, because it is the one endpoint that could be abused to enumerate Civil IDs. It returns nothing else: no id, no phone, no clinical data, no account-existence flag. Unit-test the masking function directly against the worked examples in `Seed Dataset.md`: three asterisks per middle name whatever the real length, correct with none, one and several.
- **Creating an invitation** writes a `Caregiver` row with `status: "pending"`, `invitedAt` and `expiresAt`, and grants nothing.
- **Acceptance** is the only transition to `active`, and it can be performed only by a session whose Civil ID matches that invitation's `civilId`. Non-negotiable invariants: **no endpoint, job, migration or admin action moves an invitation to `active`** — signing in least of all; a `pending`, `declined`, `expired`, `revoked` or cancelled invitation can never be accepted afterwards; a declined invitation cannot be re-accepted.
- **Expiry** is enforced server-side at read time as well as by a job, so a stale `pending` row is never treated as acceptable.
- Every transition writes an `AuditEvent` carrying the masked name and no Civil ID, and acceptance also raises the patient's in-app notice (and a push/chat alert if they have one).

**Messaging link path.** A single-use, expiring `linkToken` per subject; the bot's confirmation stores the `chatId`; disconnect clears it, sets `adherenceCheckInEnabled: false` for a patient, and touches no `Dose`. A used or expired token cannot link a second chat; a token for one subject can never link to another's record; no endpoint accepts a client-supplied `chatId`; a caregiver's link cannot be created unless their invitation is `active`; the bot token is a server-side secret. **No endpoint may require a messaging link in order to serve any other feature.**

**Web push.** A service worker and VAPID keypair; the public key reaches the client, the private key never does. Non-negotiable invariants: **no push payload carries an action that writes clinical data**; safety-critical content is never only in a payload; a revoked or denied subscription never blocks any feature; nothing is ever sent to a non-`active` caregiver.

**Schedule & depletion logic (deterministic, never a model call).** Generates `Dose` records from `startDate`, `doseTimes`, `dosingPattern`, `frequencyPerDay` and `durationDays`, each carrying `tracked` from the patient's state at generation time; **skips any prescription whose `needsReview` is true and whose `fieldReviewStatus` is not `confirmed`**; recomputes on a *reported* missed dose without collapsing an alternate-day cadence; cancels remaining doses on discontinuation; depletion from `dispensing.totalQuantityDispensed` and the consumption rate, and no estimate at all where `dispensing` is absent. 100% correctness against the hand-computed tables in `Seed Dataset.md`, unit-tested against its frozen `REFERENCE_NOW` — including the alternate-day cadence that lands on 20 and 22 September but not the 21st, and the prescription whose duration ends 25 September.

**Dose status write path.** Non-negotiable invariants: the only writers are the deterministic schedule logic and the authenticated agent write path — no endpoint reachable by a patient, caregiver, reviewer or admin session may set a dose status (prove it by attempting the call); **no scheduled job, cron, migration or cleanup task may transition a dose to `missed` for going unanswered**; a dose with `tracked: false` is never given a status. Every write appends a `dose_status_recorded` audit event naming its actor.

**Field confirmation path (G3s).** A reviewer session may set `fieldReviewStatus` to `confirmed` or `returned` with the reviewer fields, and may correct the uncertain values **only** in that same audited operation. Non-negotiable invariant: no other endpoint, session or job may modify a `Prescription`'s clinical fields after creation.

**Refill routing.** `routedTo` always matches the originating prescription's `source.sector`.

**Calendar feed.** A spec-valid ICS feed per patient at the `icsUrl` including its `token`, regenerated when doses change. No endpoint accepts a write back from an external calendar.

**Audit events.** Written by the backend as a side effect of the changes they describe, never authored by a client, append-only, and scoped: a patient-scoped event is readable by that patient and their `active` caregiver; an admin session reads all events but **only their metadata**, and no endpoint returns a clinical body to an admin session.

**Feature Toggle Policy (server-side).** `Settings` updates accepted only for `adherenceCheckInEnabled`, `adherenceCheckInFrequency`, `refillAlertsEnabled`, `calendarSyncEnabled`, `webPushEnabled`, `notificationChannel` and `language`, plus the patient's optional contact phone on `Patient`. `adherenceCheckInEnabled: true` is rejected unless that patient has a `connected` `MessagingLink`. Non-negotiable invariant: no endpoint, field or code path disables the dashboard, interaction screening or the schedule/extraction engine.

**Caregiver access enforcement.** Only an `active` caregiver session may read its linked patient's prescriptions, doses, alerts and patient-scoped audit events. Non-negotiable invariants: **`pending`, `declined`, `expired` and `revoked` all read nothing** · every write on the patient's behalf is rejected server-side · a caregiver may write only their own `Caregiver` profile fields, their own `MessagingLink` and `PushSubscription`, their own acceptance or decline, and their own self-unlink.

**Reviewer and admin enforcement.** A reviewer may update only the five review fields on an `InteractionAlert` and the field-confirmation fields on a flagged `Prescription`, and may read only patients with an item in one of their queues. An admin may read `AuditEvent` metadata and nothing else — including no power to create, accept or revoke an invitation. Neither may touch a `Dose`.

**Security hygiene.** No secret or API key — bot token, VAPID private key — in the repository or the frontend bundle; every mutating endpoint requires a valid session tied to that subject; the agent write path authenticates with its own credential.

### Integration Point With the AI Agents Track

Expose one documented way for the agents to write results conforming to the Data Contracts, decide it early, and record it here. The shape written must not change: `Dose.status` with `recordedAt` and `source`; `InteractionAlert` with `sourceCitation`; `Prescription` from extraction with `needsReview`, `startDate` and `doseTimes`. Also expose **check-in eligibility** — patients with tracking enabled and a `connected` link — and **alert recipients**, which returns `active` caregivers only, so no workflow filters invitation states itself. The agents read `Patient.telegramChatId` and the tracking state; they never write either, and never write an `AuditEvent` directly — the backend does, naming `actor.role: "agent"`.

---

## Notes for the Implementing Agent

- A "Pass criteria" that is not met is reported as failing. Never adjust the threshold.
- Do not redesign the Data Contracts. Raise a change request instead (see `Master Prompt — Phase 1.md`).
- Do not invent seed values. They are in `Seed Dataset.md`; a value that exists only in code is how the demo and the documents drift apart.
- Do not implement or reason at length about the six AI agents from this file.
- The Global UI Invariants are not stylistic preferences: **G1** is the core safety principle, **G10** keeps it honest now that the chat is optional, **G12** keeps it honest now that notifications exist, **G11** keeps the public page honest, and **G9** keeps other people's identities out of the interface. A build that violates any of them is wrong even if every screen looks right.
- Preserve the structure (phase → screen → states → pass criteria → invariant) when updating this file, and if you add or remove a screen, **update the per-group tally at the head of the inventory in the same edit** — the count was wrong for three revisions because nobody did.

## Still Required From the Project Owner (not for a coding agent to invent)

- ~~One canonical seed dataset~~ — **done: `Seed Dataset.md`.** Two gaps remain inside it, both below.
- ~~A complete wireframe reference~~ — **done: the *Jur'ah Wireframes* canvas, 48 boards, every screen covered.**
- **A real `sourceCitation`** for the Warfarin × Ibuprofen finding — the actual line from the drug database the screening agent queries. The screens display it verbatim to a clinician; an invented citation is worse than a missing one.
- **A bilingual copy deck** covering every screen plus the fixed vocabulary of **G9** — including the landing headline and its three safety statements, the setup offer's three choices, the tracking-off line, the masked-name confirmation question, **F0's "what you will and will not be able to do" wording**, the "no one has invited you" message, and the iOS install instructions.
- **A demo script** covering the app-only patient, the opted-in patient, the caregiver invitation and acceptance, the reviewer, and the audit-log proof moment.
- **The real Telegram bot handle** when one exists (and, for Phase 2 only, its token and the VAPID keypair — kept out of the repository). Until then the placeholder `@jurah_bot` stands, and nothing may present it as live.
- **Any real, citable statistic** for the landing page. Without a source, nothing goes on it (**G11**).
- **Two Phase 2 decisions** (see `Phase 2 — Backend Handoff.md` §4): Supabase or plain Postgres, and whether the backend runs as Next.js route handlers in the same deployment or as a separate service.
