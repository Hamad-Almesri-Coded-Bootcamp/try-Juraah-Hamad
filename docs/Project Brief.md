# Jur'ah (جرعة) — Project Brief

**The product is جرعة / Jur'ah**: an AI-powered medication management and safety platform. (The published design system artifact is titled **Jur'ah — جرعة**; its JavaScript namespace is still `Wasfa`, the earlier working name, kept so the component previews and the wireframe canvas keep working. Read "Wasfa" as a module name, never as the product.)

**Context:** Capstone project for the SACGC AI for Coding course. Team of 3. Target region: Kuwait (public + private healthcare mix).

**Revision note (v6.1).**

- *v2* — the dose schedule became a patient-facing screen, the medical reviewer got a view, the core safety principle was made explicit, and the data model gained a start date and dose times.
- *v3* — the channel became Telegram; the project name was confirmed as Jur'ah.
- *v4* — **Telegram became optional and off by default.** The platform's core works entirely without it.
- *v5* — the caregiver and clinician audiences got a real plan; delivery became a three-tier model with browser notifications as an opt-in alert layer.
- *v6* — **the caregiver invitation became safe against a mistyped Civil ID.** A masked-name confirmation on the patient's side, and an explicit acceptance on the invited person's side — because a single wrong digit previously handed a stranger a full medication history.
- *v6.1* — pre-handoff pass: the canonical seed dataset now exists as `Seed Dataset.md`, the design system was renamed, and the messaging bot handle is a stated placeholder (`@jurah_bot`) until a real bot exists.

## Problem Statement

Two failure points in the patient medication journey:

1. **Instruction loss after the consultation.** Patients leave the doctor's office unsure how to take their medication — dosage, frequency, duration, and patterns like alternate-day dosing. Elderly patients are especially affected. Compounding this, the dispensing pharmacist sometimes gives instructions that contradict the prescriber's ("every other day" becoming "once every two days"). The patient ends up home with two conflicting memories and no authoritative reference.

2. **Fragmented health records.** Clinics and hospitals in Kuwait run on separate systems — surgery vs. internal medicine, public vs. private. Even within one system, a physician often can't easily pull a patient's full active medication list from another clinic. Result: a doctor prescribes something that interacts with an existing medication, with no automated check catching it. A human-error gap created by system fragmentation.

## Solution Overview

A patient-side platform that aggregates all of a patient's prescriptions into a single source of truth, regardless of which clinic, hospital or sector issued them. From that unified profile it generates a dose schedule, runs continuous interaction screening, and — for patients who opt in — uses conversational AI agents to track adherence and adapt the schedule in real time.

The key insight: the patient is the only party who sees all their prescriptions. So the patient layer is where reconciliation can actually happen, without waiting for national systems to integrate.

## Who the product serves — and what each one gets

Three audiences, all three with a designed path.

**The patient.** The full app: the unified record, the day's schedule, interaction screening, prescription intake, the drug check, refills, the calendar feed, caregiver management, and — optionally — conversational adherence follow-up.

**The family caregiver.** Usually a son or daughter, and the platform's real route to the people it is meant to serve, since the primary group often cannot manage a chat flow or a standalone app alone. They sign in with **their own Civil ID** — but only after the patient invites that Civil ID **and they accept the invitation**. A caregiver cannot self-register, and an uninvited ID is told to ask their relative for an invitation rather than being told the number is wrong. Once accepted, they get a read-only view of the patient's day and medications, plus the depth that makes the feature work: **the prescription detail, the interaction-alert detail and the activity feed**, so they can see not only that something is wrong but what. They get **their own notifications**, their own profile with sign-out and self-unlink, and help written for them. They never see more than the patient sees, and they hold no write access to the patient's data.

**The clinician.** Two distinct jobs, deliberately kept apart:

- The **medical reviewer** (doctor or pharmacist) decides on danger-severity findings and on prescriptions whose critical fields the extraction agent could not read confidently. They see the patient context a real decision needs — the full active medication list, each prescription's issuing facility and sector, and recent dose history — read-only.
- The **system admin** reads the audit log and nothing else. No clinical record, no patient screen, no clinical action.

They are separate roles because merging them would mean anyone who reviews one alert can read every patient's history — the widest privacy surface in the product, opened by an architecture decision rather than a need. Both reach the product through a single unadvertised clinic address.

**A note worth keeping honest:** the clinic address being unlisted is **organisation, not protection**. Access is enforced by a server-side role check like every other route. No document or presentation claims the URL itself is a security measure, because it isn't.

**What the product deliberately does not have:** a prescriber portal and a pharmacist portal. The platform is patient-side by design; prescription and dispensing data are assumed to arrive from the government e-health platform (mocked for this phase). The reviewer is a safety reviewer, not the patient's own prescriber. A scope decision, stated so it is not mistaken for an oversight.

## Granting caregiver access — the part that had to be got right

A patient types another person's Civil ID. One wrong digit, and a stranger would be reading a full medication history. Two steps make that harmless, and nothing more was added, because a flow an elderly patient cannot complete protects nobody.

**1. The patient confirms a masked name.** They enter the Civil ID once, with the name they know the person by and the relationship. The app then shows a masked name — `عبدالله م*** ع*** المطيري`: first and family names in full, middle names as initials, and **always three asterisks** rather than the real length, since a name's length is itself information. "Is this them?" — نعم / لا.

Two rules keep that step from becoming its own leak: the masked name is shown **only** for a Civil ID that already has a Jur'ah account, and the flow reads identically either way, so **nothing in the product ever reveals whether a Civil ID has an account**. Otherwise the app becomes a directory: type numbers, learn names.

**2. The invited person accepts.** One screen: who is asking, exactly what accepting lets them see, exactly what it never lets them do, that the patient will be told — then accept or decline, two buttons of equal size and weight.

**The load-bearing rule: signing in is never acceptance.** A `pending` invitation grants zero read access. Only the action on that screen moves it to active. So a mistyped Civil ID ends in a decline, not a disclosure — and the person who taps the extra button is the tech-comfortable son or daughter, not the elderly patient, whose side of the flow got *simpler* (one confirmation, no retyping).

**And the patient always finds out.** Acceptance writes an audit event and raises an in-app notice (plus a notification if they have a channel on), so an unexpected name can be revoked immediately. Invitations expire, and the patient can cancel a pending one at any time.

**What we deliberately left out, and why it is honest to say so.** No second entry of the Civil ID, no phone field, no one-time code. A Civil ID is a weak identifier — people write it on forms constantly — so it is not treated as a credential here: it only *addresses* an invitation. In a real deployment the acceptance would be proved by the national identity app approving it, which is exactly what the simulated Hawiati flow stands in for. The prototype models the right shape, with the identity proof simulated, rather than pretending a typed number is secure.

**A caregiver also learns about an invitation without signing out.** Someone already using Jur'ah as a patient sees a quiet notice inside their own app, answers it there, and afterwards switches between "my medicines" and their relative's with an in-app switch. That is why one Civil ID holding two roles is a first-class case rather than an edge case.

## Core Safety Principle (applies to every part of the system)

**Adherence is recorded only through the Adherence Agent's conversational flow.** No screen, button, checkbox, swipe **or notification action** may mark a dose as taken, late or missed, and nothing done inside an external calendar app is read back as an adherence signal. Dose status is clinically meaningful data and may only enter the system through a path that passes deterministic validation. The application displays dose status; it never authors it.

**The consequence of making the chat optional.** If the conversation is the only writer of dose status, and the conversation is opt-in, then **a patient who has not opted in has no adherence record at all** — and that is correct behaviour, not a gap to patch. For such a patient the schedule is a **plan**, not a log: what to take and when, with no status on any dose. No dose is ever marked missed because its time passed unanswered; silence is not evidence. The app says so in one plain line and offers to turn tracking on.

**The consequence of adding notifications.** A browser notification can *tell* someone a dose is due or a risk was found; it cannot *collect* an answer, because a notification action button that records "taken" is exactly the unvalidated path the architecture exists to prevent. So notifications open the relevant screen and do nothing else. The resulting division is cleaner than what came before: **reminders anywhere, recording through one validated path only.**

*A clarification about the chat itself:* quick-reply buttons inside Telegram are the **agent's** interface, not the app's. A tap on "أخذته" there is a reply to the agent, interpreted and validated like any other reply, and is therefore allowed — indeed preferred, since it is far easier for an elderly patient than typing.

## Delivery: three tiers

1. **In-app — always on, no permission, no third party.** The Safety tab, the schedule and the activity feed always carry everything. **Nothing is ever delivered only by a notification**, so a blocked browser or an unlinked chat can never be why someone fails to learn about a danger-severity finding.
2. **Browser notifications — opt-in, alerts only.** For the patient or caregiver who does not want another app: a danger interaction, a reviewer decision, a refill warning, a new prescription, a caregiver invitation, and dose reminders. Honest about its limits: it needs the browser's permission, and **on iOS it only works once the site has been added to the Home Screen** (16.4+) — so the interface gives the install steps rather than promising delivery it cannot make. A small PWA layer (manifest + service worker) is therefore in scope, with the side benefit that the app feels installed.
3. **Chat (Telegram) — opt-in, and the only tier that can also record adherence.** Daily check-ins, missed-dose rescheduling, and reporting that a doctor stopped a medication.

Every tier is offered once, during setup, as three legible choices — browser notifications, the chat, or later — with "later" weighted as an ordinary option rather than a skip link.

## Data Model

**Physician-entered (core):** drug name (generic + brand) · strength (mg) · dose per administration · frequency per day · duration (days) · dosing pattern · **start date** (the schedule anchor) · **dose times** (one per daily administration).

**Physician-entered (secondary):** timing relative to food · route of administration · special notes · indication.

**Pharmacist-entered:** units per package · total quantity dispensed · dispense date · brand actually dispensed.

Strength, frequency, dispense date, start date and dose times are non-negotiable — the schedule engine and depletion forecasting depend on them. Frequency without dose times is not a schedule: "three times a day" cannot be placed on a clock without knowing which three times.

**Field confirmation.** When extraction cannot read a critical field confidently, the prescription is flagged and **excluded from the schedule engine and interaction screening** until a human reviewer confirms the values or returns the prescription to the issuing clinic. That confirmation is the only path by which a prescription's clinical fields can change after creation, and it records who confirmed it and when.

**Identity and delivery.** A caregiver record carries the caregiver's **Civil ID** — which addresses the invitation, and authorises nothing until accepted — plus the invitation's own lifecycle (invited, expires, accepted or declined). A patient or caregiver may have a Telegram `chat_id` (obtained when they press Start on the bot — never typed by hand) and a push subscription. Most records will have neither, and every part of the system treats that as normal.

## Core Features

The first six serve every patient, whatever they opted into.

**Unified medication dashboard.** All active and past prescriptions in one view.

**Automated dose scheduling, surfaced as the patient's day.** A calendar-based schedule handling non-trivial patterns like alternate-day dosing, and the patient's home screen: a time-ordered view of today's doses across every prescription. Read-only. With tracking on, each dose carries a status; with tracking off, the same screen is a clean plan.

**Drug interaction screening.** Across the complete profile, cross-clinic and cross-sector. Never optional, never dependent on a channel.

**In-app refill requests and depletion forecasting.** Constrained to the authorized duration, routed by source — public to public pharmacy, private to private.

**Photo-based drug check.** The patient photographs a medication; the system identifies it, resolves the active ingredient, and screens it against the profile. Especially valuable while travelling.

**Caregiver mode.** Described above.

**Medical reviewer view.** A queue of danger-severity findings and a queue of prescriptions awaiting field confirmation, the patient context a decision needs, and a confirm-or-clear action with a note. Without this the human-review gate is a claim; with it, it is demonstrable.

**System audit log.** Every recorded event with its actor and timestamp, append-only, read by the admin role. Beyond operations it has a specific purpose here: filtering it to dose-status writes shows that **every one came from the agent or the deterministic layer and none from the interface** — the core safety rule turned from a claim into displayed evidence, and the strongest single moment available in the presentation.

**Calendar integration** — below. For someone who declines both notification tiers, the calendar feed is the reminder layer.

## Additional Feature: External Calendar Integration

The dose schedule is exposed as a subscribable feed (ICS / `webcal://`) that appears inside whatever calendar app the patient already uses; they subscribe once and it refreshes when the schedule changes. Patients won't open a new app every day, but they already check their calendar.

**One direction only.** The system pushes the schedule out; nothing done inside the calendar app is read back as an adherence signal. Treating a calendar edit as a source of truth would create exactly the untracked path into clinical data the architecture prevents.

**Implementation.** A per-patient ICS URL regenerated by the scheduling logic whenever the schedule changes; no OAuth; works across providers. Optional stretch: direct Google Calendar API push via n8n's native node, still one-way.

## Feature Toggle Policy

**Always on — never a toggle:** the unified dashboard and prescription aggregation (the product itself) · drug interaction screening (the highest-risk feature and the one carrying the most liability) · the dose schedule engine and extraction pipeline (infrastructure).

**Legitimate toggles:** adherence tracking and its check-ins (off by default; needs a connected chat channel) · browser notifications (off by default) · refill/depletion alerts · calendar sync · the chat channel preference.

**Not a toggle but a flow:** connecting a channel, granting a browser permission, and inviting or accepting caregiver access. Each has its own states and its own screen — never a bare switch.

**Contact information, not a toggle:** an optional phone number, for a clinic or pharmacy to reach the patient. It is not a messaging address.

**Display preference, deliberately not on the settings screen:** the Arabic/English switch, in the app bar, reachable from anywhere.

**No toggle needed:** the photo drug check and in-app refill requests — both patient-initiated.

## AI Agent Architecture

Six agents. **Two depend on the chat** (Adherence, and Rescheduling insofar as it is triggered by a reported miss or stop); **four serve every patient through the app** (Extraction, Interaction Screening, Travel Check, Orchestrator).

1. **Prescription Extraction Agent.** Unstructured input (image, PDF, text) into the structured model, with a vision-capable model — justified because prescription formats vary widely and aren't standardized. Uncertain critical fields are flagged rather than guessed, and go to the reviewer's confirmation queue.
2. **Adherence Agent.** The conversational heart for patients who use it, and the **only** writer of dose status. Contacts the patient on their connected channel, interprets free-form replies and quick-reply taps, decides what to do. **Language priority:** Kuwaiti colloquial Arabic first (e.g. "أخذيته بس متأخر شوي"), ahead of MSA or English.
3. **Rescheduling Agent.** Recomputes the schedule on a reported miss or discontinuation. The medical logic is deterministic code; the agent only decides when to invoke it. The LLM never computes dosing times.
4. **Interaction Screening Agent.** Screens the full profile via RAG over an authoritative drug database (RxNorm / DrugBank), never from parametric knowledge, and every positive finding carries the source record it matched. **Brand-name resolution:** a small manual mapping table from the Saudi FDA's public registered-drug list (free public pages on sfda.gov.sa), since RxNorm/DrugBank don't reliably cover Gulf trade names and Kuwait shares the GCC-DR framework; the resolved generic name then goes into RxNorm/DrugBank for the lookup.
5. **Travel Check Agent.** Identifies a photographed foreign medication, resolves brand to active ingredient, hands it to the screening agent.
6. **Orchestrator Agent.** Routes work between the specialists — what makes the system genuinely multi-agent rather than one chatbot with tools.

**Safety principle throughout:** agents handle language, interpretation and decision-making. Anything requiring absolute precision — dose arithmetic, schedule computation, interaction lookups — runs on deterministic code or validated data. Every clinically meaningful output passes a deterministic validation layer before reaching the patient.

### Escalation Policy (Risk-Tiered)

- **Low-stakes ambiguity** (a non-critical detail, a vague reply): resolved by the system — a clarifying question in the chat, or a conservative default logged for review.
- **Genuine danger** (a real interaction, contradictory dosing instructions, or a missing critical field the schedule or screening depends on): escalates to a human reviewer before anything is presented to the patient as final. Never skipped, whatever the model's confidence. **This path is independent of any channel** — the alert, its pending state and the reviewer's decision all live in the app — and the flagged-field case has a queue of its own rather than sitting unresolvable.

## Scheduling Edge Cases — Scope Decisions

- **Mid-course discontinuation (in scope).** The patient reports it in the chat ("دكتوري قال أوقف الدواء"); the Adherence Agent recognises the intent and the Rescheduling Agent cancels the remaining doses. For a patient without the chat this path doesn't exist, so the prescription runs to the end of its authorized duration and completes — the app never invents a discontinuation.
- **"As-needed" (PRN) medication (documented, not built).** Doesn't fit the fixed-time dose model; needs a separate UI and a different depletion approach.
- **Hospitalization-wide pause (not built).** The per-drug mechanism covers it if it comes up.

## Messaging: Telegram (opt-in), WhatsApp (documented alternative)

**Why Telegram for this build.** A BotFather token issues instantly; no recipient cap, no message templates, no 24-hour session window, no per-message cost; photos, documents and inline quick-reply keyboards are native; anyone on the panel can test it by opening the bot. WhatsApp's free developer number caps at 5 test recipients and full verification takes days to weeks.

**The trade-off, stated honestly.** WhatsApp penetration among elderly Kuwaitis is far higher than Telegram's; asking a 70-year-old patient to install Telegram is a real adoption barrier. So Telegram is the **prototype and demo channel**, chosen for velocity and cost; WhatsApp is the **production target**; and the agent logic stays channel-agnostic so switching is a transport change, not a rewrite. Browser notifications exist precisely so the no-extra-app path is a real one.

**The mechanism, since it shapes the product.** Telegram is not addressed by phone number: a bot can only message someone who has opened it and pressed Start, which produces the `chat_id`. So opting in is a short flow — the app issues a single-use token, the person opens `t.me/<bot>?start=<token>`, the bot's webhook confirms, the backend stores the chat id. Nobody types or sees a chat id or a token, and a record without one is normal.

**No bot exists yet.** Phase 1 uses the placeholder handle **`@jurah_bot`**, read from the configuration module and labelled as simulated wherever it appears; the whole chat-linking flow in Phase 1 is a simulation with no network call. Creating the real bot is a Phase 2 step, and swapping in its handle must be a one-line change in one file. Nothing — no screenshot, no slide, no document — presents the placeholder as a live bot.

**Secrets.** The bot token and the push private key are server-side only — never in the repository, never in the frontend bundle.

## Demo & Prototype Strategy

- **Data: written, not improvised — `Seed Dataset.md`.** One canonical cast of nine people and nine prescriptions, built around the cross-clinic conflict scenario, reused by the frontend's mocks, the backend's seed script and the AI Agents track's fixtures. It covers the paths that are easy to forget: a patient with everything off, an opted-in patient, a Civil ID that is both patient and caregiver, a pending invitation, a declined one, an expired one, a Civil ID with no account at all (so no masked name can be shown), a flagged prescription awaiting field confirmation, one returned to the clinic, one confirmed, and audit events of every type. It also states, record by record, which requirement each one exists to prove — so nothing gets deleted later as redundant.
- **A fixed reference time**, `2026-09-21T09:15:00+03:00`, so the schedule's mix of past and upcoming doses is identical on presentation day to what it was in testing. It is chosen so one screenshot shows both sides of "now".
- **Simulated identity verification:** entering a Civil ID from a fixed test list starts a countdown representing "open the Hawiati app and approve", compressed to a few seconds. Presented explicitly as a simulation of the national pattern, not a real integration — and the same simulation is what stands in for identity-proofed approval of a caregiver invitation.
- **Live where it counts.** In Phase 2 the bot is real for the opted-in patient: the panel watches a check-in arrive and a reply be interpreted. In Phase 1 that flow is simulated and said to be. And the audit log is opened at the end, filtered to dose-status writes, to show that none came from the interface.
- **The demo runs all three audiences** — the app-only patient, the caregiver (invitation through acceptance), and the reviewer — which is a stronger story than the patient alone.
- **Still to write:** the bilingual copy deck, the demo script itself, and the real `sourceCitation` for the Warfarin × Ibuprofen finding, which the screens display verbatim to a clinician and must therefore be genuine.

## Deferred / Out of Scope for This Phase

- **Data privacy & security hardening** (encryption specifics, consent flows, access-control policy for health data moving through a third-party platform and external AI models) — deprioritized for the capstone. Note that opt-in channels materially reduce this surface, that caregiver access is now consent-gated rather than address-gated, and that the admin role was deliberately scoped to metadata for the same reason.
- **WhatsApp as the production channel** — documented, not built.
- **Real authentication** for the caregiver, reviewer and admin roles — the shells are built and gated by role server-side; the roles come from seeded demo data.
- **An OTP or phone-delivered invitation code** — deliberately cut; the acceptance step is the gate.
- **A caregiver linked to more than one patient** — one caregiver record links to one patient; a person caring for two relatives needs two invitations and cannot switch between them in one session.
- **Prescriber and pharmacist portals** — see *Who the product serves*.
- **PRN medication scheduling** and **hospitalization-wide pause**.

## Technical Implementation (n8n)

**Platform:** n8n for agent orchestration, using its native AI Agent node (LangChain-based).

**Workflow structure — one workflow per agent:**

- **Adherence Agent:** Schedule Trigger (daily) → query the DB for unlogged doses belonging to **patients with tracking enabled and a connected chat** → Telegram node sends the check-in with quick-reply buttons. Replies arrive via Telegram Trigger → AI Agent node interprets → invokes the rescheduling sub-workflow if needed. A patient with tracking off is skipped cleanly and never counted as unanswered.
- **Extraction Agent:** receives an image (a webhook from the app, or the chat) → vision model → structured JSON → DB write, flagging uncertain critical fields.
- **Interaction Agent:** a Sub-workflow Tool; queries the drug database and returns findings with their source records. Runs for every patient.
- **Travel Check Agent:** as extraction, plus an external lookup for brand-to-ingredient resolution.
- **Orchestrator:** calls the others as Sub-workflow Tools.
- **Link confirmation:** the bot's `/start` payload carries the app's single-use token; the workflow, or the backend endpoint it calls, stores the chat id.

**Key technical decisions:**

- Sub-workflow Tools are what make this multi-agent — the orchestrator calls other workflows as callable tools rather than running one linear chain.
- Code nodes (JavaScript) handle all schedule math and dose arithmetic. Never the LLM.
- External database required (Supabase or Postgres) — n8n doesn't persist state between runs. Stores prescriptions, dose logs, patient and caregiver records, invitations, links, subscriptions and the audit log.
- Decompose early into small linked workflows.
- Keep the transport at the edges: intent recognition, validation and tool invocation must not be Telegram-specific.
- The agents are the only external writers of dose status, through one documented authenticated path. They **read** the chat id, the tracking preference and the invitation state; they never write any of them, and the backend writes their audit events on their behalf.

## Impact

Serves elderly patients, people managing chronic conditions, and anyone on multiple concurrent medications — together with the relatives who look after them and the clinicians who have to catch what fragmented systems miss. Converts a patient who is lost between disconnected records into one with a complete, verified picture of their treatment, with automated protection against human error and drug interactions, whether or not they ever install a chat app.
