# Jur'ah (جرعة) — Build Prompts

Prompts in build order. The design system artifact must be attached to prompts 1 and 2. It is titled **Jur'ah — جرعة**; its JavaScript namespace is still `Wasfa`, the earlier working name, kept so the component previews and the wireframe canvas keep working.

**Revision note (v7.3).**

- The product name is **جرعة / Jur'ah**.
- The chat channel (Telegram) and **browser notifications** are both **optional, off by default**. The app must be complete and honest without either (**G10**), and notifications **alert but never collect** (**G12**).
- The product has **four surfaces**: a public landing page, the patient shell, the caregiver shell, and an unadvertised clinic shell holding two roles (medical reviewer, system admin).
- **Caregiver access is granted by acceptance, never by a Civil ID alone.** A patient's invitation is *addressed* by Civil ID and confirmed against a **masked name**; the invited person must explicitly **accept** on a consent screen before any read is granted. Signing in is never acceptance. Nothing ever discloses whether a Civil ID has an account (**G9**).
- `Acceptance Criteria and Test Plan.md` owns the **screen inventory, the role model and the routes**; these prompts point at it rather than repeating them. **The count is thirty screens plus three system pages** — v7 to v7.2 quoted 27 and then 28 while the inventory listed 30, because `A0`, `A1b` and `X0` were never counted. The inventory never changed; count it against the per-group tally rather than trusting any number, this one included.
- **The seed data is written**: `Seed Dataset.md` fixes the cast, the Civil IDs, the prescriptions, the doses around the frozen `REFERENCE_NOW`, the alerts, the invitations in every state and the audit rows. Nothing invents seed values any more.
- **The wireframes are complete and current**: the *Jur'ah Wireframes* canvas holds **48 artboards** covering every screen in the inventory, drawn from this design system's real components and filled with the seed data. It is the approved visual reference for Phase 1.
- **`navigation.md` inside the design system is current**, describing the four surfaces, the consent gate and a full entry/exit table. The warnings about that conflict in earlier copies of these prompts no longer apply.
- **The messaging bot handle is the placeholder `@jurah_bot`** — no such bot exists yet. It is read from configuration and labelled simulated wherever it appears.
- **Prompt 3 is superseded** by `Master Prompt — Phase 1.md`. **Prompt 4 is superseded** by `Phase 2 — Backend Handoff.md`, which holds the one master prompt for the backend; prompt 4 below is kept as the scope reference it is built from.

---

## Prompt 1 — Component library (into the Jur'ah design system)

```
ROLE
You are extending an existing design system, not starting a new one. The attached design system
(titled "Jur'ah — جرعة") already holds its tokens, a brand-book README, navigation.md, a cover
and twenty components. Add the eleven remaining components, publishing into that same artifact.
Never create a second design system.

READ FIRST
1. The artifact's SKILL.md and artifact-type/reference/format.md. The component file contract is
   strict: components/bundle.js is one classic script assigning window.Wasfa — the earlier working
   name, kept as the namespace on purpose; every component has components/<Name>/preview.html
   whose first line is the @dsCard marker; components/<Name>/README.md holds its guidelines.
2. project/README.md — the binding usage rules for this brand.
3. project/tokens.json — the only values you are allowed to use.
4. project/navigation.md — how the screens these components serve connect to each other.
5. Acceptance Criteria and Test Plan.md — the Screen Inventory these components serve across four
   surfaces, and the Global UI Invariants (G1–G12).
6. UX Principles.md — binding. In particular: every action has a visible control; no gesture-only
   or hover-only affordance; 44×44 minimum with clear space; colour is never the only signal; no
   technical identifier is ever shown; nothing may offer to change a dose status; §13 (an optional
   feature that is off reads as a choice, never a fault — no warning colour, dot or badge); §14
   (notifications alert, they never collect); §15 (a consent screen tells the whole truth before it
   asks, and accept and decline carry equal weight).
7. Seed Dataset.md — for the real content your previews show: real patients, real drug names,
   real masked names. No invented data, no lorem ipsum.
8. The Jur'ah Wireframes canvas — every one of these components appears on a board there, in the
   context it has to work in. Check the board before you decide an anatomy.

ALREADY BUILT — do not rebuild, do not restyle
Button, IconButton, TextField, Select, Toggle, ChoiceGroup, Card, PrescriptionCard, StatusPill,
SectorChip, DetailRow, DepletionMeter, InteractionAlert, InlineNotice, EmptyState, LoadingState,
ErrorState, AppBar, TabBar, Sheet.

COMPONENTS TO ADD (eleven) — the group name goes in each card's @dsCard marker

Data display
- DoseRow — one scheduled dose: drug generic and brand in body-strong, the dose amount with its
  unit, and its StatusPill. READ-ONLY: no checkbox, no "taken" button, no swipe, nothing that
  would log adherence. Tappable only to open the prescription detail. It must ALSO render
  correctly with NO status — the untracked case, where the row is a plan entry rather than a log
  entry — and that variant must look deliberate and calm, not broken. The no-status variant is
  chosen by the `tracked` flag, never by the status word: in the real data an untracked dose also
  reads "upcoming", so a component that switches on the word is wrong and will look right.
- ScheduleGroup — the clock-time header grouping the DoseRows of one time, correct with one row
  and with several.
- DoseTimeline — a compact vertical history of a prescription's doses with their statuses, for
  the prescription detail and the reviewer's patient-context panel. Read-only, and also correct
  with no statuses.
- AlertRow — one interaction finding in a list, for the patient's safety list and for both
  reviewer queues: severity, the drugs involved, and the review state, legible without opening it.
- ActivityRow — one logged event. It serves TWO consumers: the patient's activity feed (what
  happened, when, and a link to the thing it happened to) and the admin audit log, which also
  needs an optional ACTOR slot (who caused it — patient, caregiver, reviewer, admin, agent or
  system) and an optional patient reference. Read-only by contract.
- MenuRow — one destination or setting in a list: label, optional value or description, chevron
  that mirrors in RTL. Used for the More tab, profile, help, settings rows, the clinic lists and
  the patient's caregiver list. Its value slot must read well holding a RELATIONSHIP STATE —
  "awaiting acceptance", "declined", "expired" — in ink-muted, with no badge, dot or alert icon.

Forms
- PhotoInput — capture-or-upload for prescription intake and the drug check: idle offering both
  affordances, a chosen-image preview with a remove action, and a disabled state while analysing.
- CopyField — a read-only value with a copy action and a copied confirmation, for the per-patient
  webcal:// calendar link. Never for an identifier.

Feedback
- Countdown — the "open the Hawiati app and approve" countdown: remaining time, determinate
  progress, a completed state, and a lapsed state that can be retried. Announces progress to
  assistive technology.
- StepIndicator — progress through a short multi-step flow (first-run setup). Never more than four.
- ContextBanner — a persistent, non-dismissable strip naming the context of the session: whose
  data a caregiver is viewing, the simulated-role label in the clinic shell, or that data shown is
  the last known copy with an "as of" time. Information, never an alert; never the danger token.

MASKED NAMES — a rule, not a component
The caregiver-invitation screens display a person's name in a masked form: first name in full,
each middle name as its initial followed by EXACTLY three asterisks, last name in full —
عبدالله م*** ع*** المطيري. Three asterisks always, whatever the real length. There is no
component for this: it is body-strong text, with no chip, no mono font and no "masked"
annotation, because the reader's task is to recognise a name. Do NOT add a MaskedName component,
and do not let any component render a Civil ID back to the screen. If DetailRow's README implies
it may show an identifier, correct that line.

RULES FOR EVERY COMPONENT
- Works at 390, 834 and 1440px, in both dir="rtl" and dir="ltr". CSS logical properties only.
- Holds at 200% text scale without clipping or overlap.
- Keyboard focus always visible; the focus ring holds at least 3:1 against every surface.
- Minimum 44×44px hit area, 48 for a primary action, at least 8px between adjacent targets.
- No state or meaning carried by colour alone.
- Text meets 4.5:1 (3:1 at 24px+ or bold 19px+).
- Arabic text is never uppercased and never letter-spaced as if it were Latin.
- Every value resolves to a token custom property — var(--navy), var(--space-3), var(--radius-md).
  No hard-coded hex, px font size or radius. bundle.css carries only what tokens cannot express.
- components/index.d.ts documents every new component's props.
- Update project/design-system.json last, with lastChange filled, keeping its title and namespace.

PREVIEWS
Real states together, real Arabic and English content, real drug names from the seed dataset.
DoseRow shows all four statuses AND the no-status variant; AlertRow shows all three severities and
all three review states; ActivityRow shows a patient-feed row and an audit row with an actor;
MenuRow shows a plain destination, a settings row with a value, and a caregiver row awaiting
acceptance; Countdown shows running, completed and lapsed; PhotoInput shows idle, preview and
analysing; StepIndicator shows first, middle and last; ContextBanner shows the caregiver case, the
simulated-role case and the last-known-data case.

GUIDELINES
Each README opens with a one-sentence summary, then what the consumer provides, when to use it and
when not to, and the do/don'ts that matter here — naming the tokens. DoseRow's, ScheduleGroup's,
DoseTimeline's and ActivityRow's READMEs state the read-only rule explicitly, and DoseRow's also
states the no-status case and that it keys off `tracked`. MenuRow's states that a relationship
state is ink-muted and never badged.

ORDER OF WORK
Build DoseRow, ScheduleGroup and MenuRow first and show me those, then continue.

PROHIBITIONS
- Do not change the tokens, the README's rules, navigation.md, the cover, or any existing
  component.
- Do not add a component that is not on this list. If a screen needs one that is missing, tell me
  rather than inventing it.
- Do not create a new design system artifact — publish into the attached one.
```

---

## Prompt 2 — Screen design (Claude Design)

**Status: largely satisfied.** The *Jur'ah Wireframes* canvas now covers every screen in the inventory at wireframe fidelity, with the seed data and the real components. Use this prompt only for a **polish pass** — raising specific boards to finished visual quality — and when you do, name the boards and keep everything below as the ruleset.

```
ROLE
You are a senior product designer working on Jur'ah (جرعة), a medication-safety platform for
patients in Kuwait, the family caregivers who look after them, and the clinicians who review
safety findings. It is a university capstone project.

READ FIRST — before you design anything
1. The attached design system (titled "Jur'ah — جرعة"). project/README.md first, then
   project/tokens.json, then project/navigation.md — which is current and describes the four
   surfaces, the consent gate and the full entry/exit table — then the component cards.
2. The attached Jur'ah Wireframes canvas — 48 boards, CURRENT, and the approved layout for every
   screen. You are raising fidelity, not re-deciding structure. A structural change to a board is
   a proposal you bring to me, not something you do.
3. Project Brief.md — full context, including that the chat channel and browser notifications are
   both optional and off by default, that the product serves three audiences, and how caregiver
   access is granted.
4. Acceptance Criteria and Test Plan.md — the authoritative Screen Inventory, role model and
   routes, each screen's required states and pass criteria, and the Global UI Invariants G1–G12.
   Nothing outside it; nothing dropped from it.
5. UX Principles.md — binding: one primary action per screen, never-lost navigation, plain
   language, imperfect hands and eyes, empty states that teach, the fixed three-part shape for
   safety copy, §13 (off is a choice, not a fault), §14 (notifications alert, never collect) and
   §15 (a consent screen tells the whole truth before it asks). Run its twelve-point checklist
   against every screen you produce.
6. Seed Dataset.md — the content of every screen. The patients, Civil IDs, drugs, facilities,
   doses, statuses, alerts and masked names are all fixed there, and the wireframes already use
   them.

Build every screen from the system's existing components. Never invent a colour, font size,
spacing value, corner radius or shadow. If you need something the system lacks, stop and tell me.

FOUR SURFACES, NOT ONE
- The public landing page — outside every shell, no tab bar, one way in.
- The patient shell — four destinations: Today · My Medicines · Safety · More.
- The caregiver shell — three: Today · Medicines · More, under a persistent banner naming the
  patient, with write controls ABSENT rather than disabled.
- The clinic shell — two: Review · Audit, unadvertised, visibly labelled a simulated role.
Each shell looks like the same product and behaves like its own place.
The invitation-consent screen belongs to NO shell: no tab bar, no More menu, no way to wander
into a product the person has not yet agreed to enter.

THE FIVE STATES THAT CARRY THE MOST WEIGHT
- **Today with adherence tracking off** — the DEFAULT for a new patient and probably the
  most-seen screen in the product. This is حمد's screen in the seed data: a clean plan, times,
  drugs, doses, no status pills anywhere — including on the 08:00 doses that are already in the
  past at the frozen reference time. One plain line says adherence isn't being followed and
  offers to turn it on — neutral, not a warning, not competing with the safety alert, never a
  modal. It must look finished, not like a screen missing its data. (Board: TodayPlan.)
- **The caregiver-invitation consent screen (F0)** — what a person sees when someone has named
  their Civil ID. It states, before it asks: who is inviting them (first name and the claimed
  relationship), exactly what they will be able to see, what they will NOT be able to do, and
  that the patient will be told. Then two full-width buttons of equal size and weight: accept,
  and decline. No medication data, no alert, no dose, no count of anything appears on this
  screen — nothing of the patient's record is visible until the moment after acceptance. Decline
  is never a link, never smaller, never grey, never below the fold. (Boards: InviteConsent,
  InviteStates.)
- **The first-run offer** — three legible choices: browser notifications, the chat, or later.
  "Later" is an ordinary button of the same size and weight, never a grey link in a corner.
  (Board: Setup.)
- **The notification permission states** — all four: not asked, granted, denied, unsupported. The
  denied state is neutral with plain re-enable instructions and no nag. The unsupported state
  includes the iOS Safari case, where the honest answer is install-to-Home-Screen steps rather
  than a promise of delivery. (Board: NotifyStates.)
- **The caregiver's view of a patient with tracking off** — عبدالله looking at حمد: the same
  plan, the same explanation, and no more than the patient sees. A caregiver must never get a
  fuller picture, and never a screen that shows alarm without a way to open the detail.
  (Board: CaregiverPlan.)

NON-NEGOTIABLE RULES
- No screen — and no notification — contains any affordance that records or changes a dose status.
  Adherence is recorded only in the patient's chat with the agent. The tracking-off Today screen
  is where breaking this is most tempting.
- "Not connected", "permission denied" and "unsupported" are drawn neutrally everywhere — no
  danger token, no alert icon, no red dot, no badge. The danger token belongs to drug safety only.
  A caregiver invitation that is pending, declined or expired is drawn the same neutral way: a
  person's choice and the passing of time are not faults.
- IDENTITY DISCLOSURE. A name the reader has not been granted in full is masked: first name,
  each middle name as its initial plus EXACTLY three asterisks, last name — عبدالله م*** ع***
  المطيري. No screen ever prints a Civil ID back to the reader, whole or masked. No screen,
  message, error or empty state distinguishes "this Civil ID has an account" from "this Civil ID
  does not": a patient who types a Civil ID sees the same confirmation step and the same wording
  either way, and the same is true of a mistyped one. Design the confirmation step so that this is
  structurally true, not merely worded carefully.
- SIGNING IN IS NEVER ACCEPTANCE. A person with a pending invitation who signs in lands on the
  consent screen, and a person who holds no other role and declines lands back outside the app
  with a plain page — never inside a shell, never on a half-populated Today. A pending invitation
  shows zero of the patient's data anywhere, on any surface, including notifications.
- A danger-severity interaction alert is the single most prominent element on My Medicines: full
  danger fill (never a stripe or left border), on-fill text at h2 and body-strong, radius-lg with
  shadow-md, above every prescription card. It appears for every patient, whatever they opted into.
- The settings screen contains no control — not even disabled — for turning off the dashboard,
  interaction screening or the schedule engine. Its adherence control explains in one line that it
  needs a connected chat channel and links to the notifications screen.
- Connecting a channel and granting a permission are flows with their own screen and states, never
  bare switches. Nobody ever sees or types a chat id, a link token or a push endpoint. The bot
  handle shown is the placeholder @jurah_bot, and the copy around it says the chat is simulated in
  this phase.
- Write controls are absent, not disabled, in the caregiver shell.
- The clinic shell is labelled a simulated role, and the landing page never links or names its URL.
- The reviewer's decision screen carries a read-only patient-context panel — the full active
  medication list, each prescription's facility and sector, and recent dose history — because a
  clinician cannot judge an interaction from two records alone.
- The admin audit log shows events, actors, timestamps and a patient reference — never medication
  lists, alert text or dose detail. An invitation's lifecycle — sent, accepted, declined, expired,
  revoked — appears there as metadata, and the names it shows are masked.
- A refill's routing destination always matches the originating prescription's sector.
- A pending_medical_review alert never reads as final, and offers no action that implies closure.
- navy carries 70–80% of the visual identity; danger never exceeds 5–10% of any screen.
- Every status carries an icon or a word alongside its colour; every tappable target is at least
  44×44px; every action is a visible control.
- Arabic layouts mirror through logical properties: directional chevrons flip; capsules, syringes,
  clocks, checkmarks, numerals and masked-name asterisk runs never do.

THE LANDING PAGE — one bounded exception
It may use the display type style, a wider vertical rhythm and its own layout markup for its ten
sections. It may NOT introduce a colour, font family, radius or shadow outside the tokens, restyle
a component, or use the danger token decoratively. Its content obeys G11: no third-party marks, no
unsourced statistic, no testimonials, no outcome or certification claims, the simulation disclosed
on the page in both languages, and every screenshot a screen that exists. Its two entry buttons —
patient and caregiver — lead to the same one Civil ID sign-in; the clinic route is never named.

CONTENT
Real copy in both languages and real drug names, taken from Seed Dataset.md and the copy deck.
The core scenario is already fixed there: حمد, 71, with Warfarin from a public hospital and
Ibuprofen from a private clinic — the danger interaction nobody in either place could see. No
lorem ipsum, no invented patients.

OUT OF SCOPE
Do not change the data contracts, the seed values, or a wireframe board's structure. Do not design
anything belonging to the six AI agents — the chat conversation itself is that track's design.
```

---

## Prompt 3 — Phase 1 frontend — **SUPERSEDED**

Replaced by **`Master Prompt — Phase 1.md`**: the lead model plans and reviews, Sonnet subagents implement in parallel, with review gates, a change-request protocol, and `/docs/BACKEND-NOTES.md` as a running deliverable for Phase 2. Do not use an older copy — it predates the landing page, the role model, the optional-messaging rule, browser notifications, the invitation consent gate, the seed dataset and the completed wireframes.

---

## Prompt 4 — Phase 2 backend — **SUPERSEDED as a prompt, kept as the scope reference**

The prompt to paste for Phase 2 lives in **`Phase 2 — Backend Handoff.md`** §5, which also carries the seam model, the notes contract and the refusal matrix. What follows is the scope this is built from; read it as the checklist behind that prompt, not as a second prompt to run.

```
SCOPE — PHASE 2 BACKEND (excludes the six AI agents)

- Database schema: one table per contract entity (Patient, Caregiver, Prescription, Dose,
  InteractionAlert, RefillRequest, CalendarSubscription, MessagingLink, PushSubscription,
  AuditEvent, Settings) with foreign keys matching the ...Id references. A write-then-read round
  trip must return exactly the shape the Phase 1 mock layer returned. Enforce doseTimes.length ===
  frequencyPerDay as a write-time constraint. AuditEvent is append-only at the database level.
- Seed script: generated from Seed Dataset.md, not hand-written. Re-running it produces identical
  records, and the doses come from the schedule generator rather than from a literal list.
- Civil ID mock auth AND ROLE RESOLUTION, server-side: validate against the pre-seeded test-ID
  list, resolve which roles that Civil ID holds (patient, ACTIVE caregiver, reviewer, admin), and
  issue a session carrying subject id, role and — for a caregiver — the linked patient id. An ID
  outside the list is rejected server-side even if a client skips the frontend check; a Civil ID
  with no invitation NEVER receives a caregiver session; a Civil ID whose only invitation is
  pending, declined, expired or revoked NEVER receives one either; a session's role is never
  taken from a client-supplied value.
- CAREGIVER INVITATION PATH — the security-critical part.
  * The masked-name lookup returns ONLY a masked name — first name, each middle name as its
    initial plus exactly three asterisks, last name — and only for a Civil ID with an account.
    Unit-test the masking function against the worked examples in Seed Dataset.md: three asterisks
    per middle name whatever the real length, with none, one and several.
  * Its response is INDISTINGUISHABLE for a Civil ID that has an account and one that does not:
    same status code, same shape, same latency class. Verify byte for byte apart from the name.
    Rate-limited per session and audited — it is an identity oracle otherwise.
  * Creating an invitation sets status "pending" with invitedAt and expiresAt, and grants ZERO
    READ: prove it against every patient-scoped read endpoint.
  * The ONLY transition to "active" is the invited person's own authenticated acceptance. No
    endpoint, job, migration or admin action activates one on their behalf; signing in does not
    accept. Attempt it and show the refusal.
  * Decline sets "declined"; expiry is enforced by the clock and at read time; revoke and
    self-unlink end reads immediately, mid-session. Every transition appends an AuditEvent
    carrying the masked name and never a Civil ID.
- Messaging link path: a single-use, expiring linkToken per subject; the bot's /start confirmation
  stores the chatId; disconnect clears it, sets adherenceCheckInEnabled false for a patient, and
  touches no Dose. A used or expired token cannot link a second chat; a token for one subject can
  never link to another's record; no endpoint accepts a client-supplied chatId; the bot token is a
  server-side secret and the handle comes from configuration. A caregiver's link cannot be created
  while their invitation is anything but active. NO ENDPOINT MAY REQUIRE A MESSAGING LINK TO SERVE
  ANY OTHER FEATURE.
- Web push: a service worker and a VAPID keypair — the public key reaches the client, the private
  key never does. NO PUSH PAYLOAD CARRIES AN ACTION THAT WRITES CLINICAL DATA; safety-critical
  content is never only in a payload; a denied or revoked subscription blocks no feature; nothing
  is ever sent to a caregiver whose invitation is not active.
- Deterministic scheduling and depletion, in plain code and never a model call: generate Dose
  records from startDate, doseTimes, dosingPattern, frequencyPerDay and durationDays, each
  carrying `tracked` from the patient's state at generation time; SKIP any prescription whose
  needsReview is true and whose fieldReviewStatus is not "confirmed"; recompute on a REPORTED
  missed dose without collapsing an alternate-day cadence; cancel remaining doses on
  discontinuation while leaving past logs untouched; never extend past startDate + durationDays;
  compute depletion from dispensing.totalQuantityDispensed and the consumption rate, and produce
  no estimate at all where dispensing is absent. Unit-test against the hand-computed tables in
  Seed Dataset.md and its frozen REFERENCE_NOW — including the alternate-day cadence that lands on
  20 and 22 September but not the 21st, and the prescription whose duration ends 25 September.
- Dose status write path: the only writers are the deterministic schedule logic and the
  authenticated AI-agent write path. No endpoint reachable by a patient, caregiver, reviewer or
  admin session may set a dose status — prove it by attempting the call. No scheduled job, cron,
  migration or cleanup task may transition a dose to `missed` for going unanswered, and a dose
  with tracked: false is never given a status. Every write appends an audit event naming its
  actor. Do not write a "mark overdue as missed" job.
- Field confirmation: a reviewer session may set fieldReviewStatus to confirmed or returned with
  fieldReviewedBy, fieldReviewedAt and, when returned, fieldReviewNote — and may correct the
  uncertain values ONLY in that same audited operation. No other endpoint, session or job may
  modify a Prescription's clinical fields after creation.
- Audit events: written by the backend as a side effect of the changes they describe, never
  authored by a client, append-only. A patient-scoped event is readable by that patient and their
  ACTIVE caregiver; an admin session reads all events but ONLY their metadata, and no endpoint
  returns a clinical body to an admin session. No audit body contains a Civil ID.
- Refill routing: routedTo always matches the originating prescription's source.sector.
- Calendar feed: a spec-valid ICS feed per patient at the icsUrl including its token, regenerated
  when doses change, verified in a real calendar client. No write-back into Dose or adherence data.
- Settings: the permitted keys only, and adherenceCheckInEnabled: true rejected without a
  connected MessagingLink. No endpoint, field or code path may disable the dashboard, interaction
  screening or the schedule engine — verify by direct API call.
- Caregiver enforcement: only an ACTIVE caregiver session reads its linked patient's data; every
  write on the patient's behalf is rejected; pending, declined, expired and revoked read nothing;
  a caregiver writes only their own profile, subscriptions, self-unlink and their own
  accept/decline.
- Reviewer and admin enforcement: a reviewer updates only the five review fields and the
  field-confirmation fields, and reads only patients with an item in one of their queues. An admin
  reads audit metadata and nothing else — no power to create, accept or revoke an invitation.
  Neither may touch a Dose.
- Security hygiene: no secret or API key — bot token, VAPID private key — in the repository or the
  frontend bundle; every mutating endpoint requires a valid session tied to that subject; the agent
  write path authenticates with its own credential.
- Integration point for the AI agents track: the write path for extracted prescriptions (with
  needsReview, startDate and doseTimes), dose status updates (with recordedAt and source) and
  interaction alerts (with sourceCitation). Also CHECK-IN ELIGIBILITY — patients with tracking
  enabled and a connected link — and ALERT RECIPIENTS, which returns active caregivers only. The
  agents read the chat id and the tracking state and never write either; the backend writes their
  audit events with actor.role "agent". Agree with that track who resolves the /start token. Do
  not build the agents.

PROHIBITIONS
Do not change the frontend, the Data Contracts or the seed values. Do not implement the six AI
agents, their prompts, RAG setup or n8n workflows. Do not adjust a test threshold to make it
pass — report the failure.
```
