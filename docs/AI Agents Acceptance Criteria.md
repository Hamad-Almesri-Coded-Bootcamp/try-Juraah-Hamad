# Jur'ah (جرعة) — AI Agents Acceptance Criteria & Test Plan

**Audience:** whoever builds the six AI agents and their n8n workflows — a separate track from the Frontend + Backend work in `Acceptance Criteria and Test Plan.md`. Read `Project Brief.md` first for architectural context on each agent.

**Project name:** the product is **جرعة / Jur'ah**. (The design system artifact is titled Jur'ah — جرعة; the name "Wasfa" survives only as its JavaScript namespace, which this track never touches.)

**Why this is a separate file:** this track runs in parallel with, not after, the Frontend + Backend track. The only thing the two must agree on is the **Data Contracts** defined in the other document — and the test data, which is `Seed Dataset.md`.

---

## Four decisions that shape this track

**1. The chat channel is Telegram**, through n8n's native Telegram node and Telegram Trigger; WhatsApp Cloud API stays documented as the production alternative. Reasoning in `Project Brief.md` → *Messaging*. **No bot exists yet** — the placeholder handle in the documents is `@jurah_bot`, and creating the real one via BotFather is this track's first setup step, since Phase 1 of the app simulates the link entirely.

**2. The chat is OPTIONAL and off by default.**

- **Most patient records will have no `telegramChatId`, and that is normal.** The daily check-in workflow selects only patients with **adherence tracking enabled and a `connected` messaging link**, skips everyone else cleanly, and logs the skip. No link is never an error, never a retry, never "unanswered". In the seed data only one of the three patients is eligible.
- **A dose generated while tracking was off carries `tracked: false`.** Never write a status onto such a dose, in any workflow, for any reason.
- **Silence is never a status.** No workflow, scheduled job or cleanup step may mark a dose `missed` because its time passed and nobody replied. `missed` exists only when a patient reported it.
- **You never write the tracking state or the chat id.** Both belong to the backend's link path; you read them.
- Keep the transport at the edges: intent recognition, validation and tool invocation must not depend on Telegram-specific payload shapes beyond a thin adapter.
- **Quick-reply buttons are yours and they are allowed.** Inline keyboard taps arrive as ordinary replies and pass through the same intent classification and validation as typed text. For an elderly patient they are far easier than typing, so prefer offering them while still handling free text. The prohibition on recording adherence applies to the **application's screens and to notifications**, not to your conversation.

**3. Browser notifications exist, and they are not yours.** The app now offers push notifications as an opt-in alert channel for people who decline the chat. They are owned by the backend, not by this track, and they are **alerts only**: a notification never carries an action that writes clinical data, so a patient on notifications alone produces **no adherence record at all**. Do not design around an expectation that a push can collect an answer, and do not treat a patient with notifications but no chat as trackable.

**4. There are now four roles, and two of them matter to you.**

- The **caregiver** may connect their own chat, **but only once their invitation is `active`** — that is, only after the invited person has explicitly accepted it. A `pending`, `declined`, `expired` or `revoked` caregiver has **no messaging link and no chat at all**, so there is nothing for you to send to and no message that could arrive from one; if a chat id for such a caregiver ever appears in your data, treat it as a bug in the backend and send nothing. An active caregiver's chat receives **alerts only** — a danger finding, a refill warning. **Never send a dose check-in to a caregiver's chat, and never accept an adherence reply from one.** A caregiver cannot report a dose on the patient's behalf; if one replies with something that looks like an adherence answer, the correct behaviour is a short reply explaining that only the patient can confirm a dose, and no status written.
- The **medical reviewer** owns the human gate, including a **new queue for prescriptions whose critical fields extraction could not read confidently**. Your job is to flag; theirs is to confirm or return. **No agent ever confirms a flagged field or edits a `Prescription`'s clinical values.**
- **Audit events are written by the backend on your behalf**, naming `actor.role: "agent"`. Do not write `AuditEvent` rows directly.

## Contract fields you rely on

- `Patient.telegramChatId`, `Patient.telegramLinkedAt` — read-only here; often null.
- `Patient.phone` — optional contact information, **not** a messaging address. Never send to it.
- `Caregiver.telegramChatId` — alerts only, per decision 4.
- `Caregiver.status` (`pending` | `active` | `declined` | `expired` | `revoked`) — **only `active` may be messaged at all.** Read-only here; you never advance an invitation, and no agent action of any kind accepts one on someone's behalf.
- `Caregiver.civilId` — an addressing field for the invitation, never an identity you display, quote in a message or write anywhere. Nothing you send ever contains a Civil ID.
- `MessagingLink` (`subjectType`, `subjectId`, `status`, `linkToken`, `chatId`) — `not_connected` is the default.
- `Settings.adherenceCheckInEnabled` (default **false**), `adherenceCheckInFrequency`, `notificationChannel` (default **`"none"`**), `webPushEnabled`. Respect them; never hardcode a channel.
- `Prescription.startDate` and `Prescription.doseTimes` (`["08:00","14:00","20:00"]`, length must equal `frequencyPerDay`) — **required**. Extraction produces them or flags the record.
- `Prescription.needsReview` — this exact name — plus `fieldReviewStatus` / `fieldReviewedBy` / `fieldReviewedAt`, which only the reviewer writes.
- `InteractionAlert.sourceCitation` (the grounded record matched), `createdAt` (yours), and the reviewer's five fields (never yours).
- `Dose.recordedAt`, `Dose.source` (`"adherence_agent"`), `Dose.tracked` — set the first two on every status you write; never write a status to a dose whose `tracked` is false.

---

## 1. Prescription Extraction Agent

**Function:** converts unstructured prescription input (image, PDF, text) into a record matching the `Prescription` contract. Input arrives from the app's intake screen for every patient, and from the chat for opted-in patients.

**Test cases:**

- TC-EX-01 — A clear typed prescription (English or Arabic). Expected: all core fields exactly matching ground truth.
- TC-EX-02 — A messy or handwritten image. Expected: confident fields populated; anything below threshold is NOT guessed — `needsReview: true` with the uncertain field(s) null or flagged, which routes it to the reviewer's confirmation queue. This is the case the seed data's unreadable prescription stands for.
- TC-EX-03 — Alternate-day language ("every other day", "يوم بعد يوم"). Expected: `dosingPattern: alternate_day`, not defaulted to daily.
- TC-EX-04 — An image with no readable prescription content. Expected: an explicit extraction failure. Never a fabricated record.
- TC-EX-05 — A frequency with no stated times ("three times daily"). Expected: `frequencyPerDay: 3` with `doseTimes` either from a documented default convention or unset with `needsReview: true` — never three invented clock times presented as prescribed.
- TC-EX-06 — A chat photo with a caption. Expected: the caption never overrides the image; a conflict sets `needsReview: true`.
- TC-EX-07 — An intake from the **app** for a patient with no chat link. Expected: identical behaviour; no step requires a chat.
- TC-EX-08 — A flagged record after the reviewer confirms it. Expected: the agent never revisits or overwrites confirmed values; a later re-extraction of the same document does not silently replace them.

**Pass criteria:** ≥90% field-level accuracy on core fields across ≥10 representative synthetic prescriptions (typed/handwritten, English/Arabic).

**Non-negotiable invariant:** strength, frequency, dispense date, start date and dose times are non-negotiable. If any cannot be extracted with reasonable confidence, the record is flagged `needsReview: true` and must NOT be auto-committed as an active prescription feeding the schedule engine or interaction screening. Only the reviewer's audited confirmation clears that flag.

**Requires human-supplied input:** ≥10 sample prescription images/PDFs with ground-truth values.

---

## 2. Adherence Agent

**Function:** the daily check-in on the patient's connected chat; interprets free-form replies and quick-reply taps, prioritizing Kuwaiti colloquial Arabic; decides the action; produces `Dose.status` updates. **Runs only for patients with tracking enabled and a connected link.**

**Required intent classes:** `taken_on_time`, `taken_late`, `missed`, `ran_out`, `discontinued_by_doctor`, `unclear`.

**Language test set:**

| Example reply | Expected intent |
|---|---|
| "خذيته" / "أخذته" | `taken_on_time` |
| "خذيته بس متأخر شوي" | `taken_late` |
| "ما خذيته" / "نسيت أخذه" | `missed` |
| "خلص الدوا" / "ما بقى عندي" | `ran_out` |
| "دكتوري قال أوقف الدواء" | `discontinued_by_doctor` |
| Ambiguous / off-topic | `unclear` → clarifying question, no status recorded |

**Eligibility, silence and role test cases:**

- TC-AD-07 — A quick-reply tap. Expected: classified identically to the typed phrase, same validation path.
- TC-AD-08 — A patient with `telegramChatId` null. Expected: **skipped and logged**; no message, no error, no dose touched.
- TC-AD-09 — A patient with `adherenceCheckInEnabled: false` but a connected link. Expected: skipped; no message, no inferred status.
- TC-AD-10 — A check-in sent and never answered. Expected: **nothing recorded.** No `missed`, no retry that eventually assumes one.
- TC-AD-11 — A dose with `tracked: false`. Expected: never included in a check-in and never given a status.
- TC-AD-12 — A reply arriving hours late, out of order with a newer one. Expected: attributed to the dose it refers to, or `unclear` — never to the wrong dose.
- TC-AD-13 — A patient disconnects mid-course. Expected: future check-ins stop; recorded statuses untouched.
- TC-AD-14 — **A message from a caregiver's chat that looks like an adherence reply** ("أبوي خذ الدوا"). Expected: **no status written**, and a short reply explaining that only the patient can confirm a dose. This is the role boundary and it is not negotiable.
- TC-AD-15 — A patient who has browser notifications on but no chat. Expected: not eligible; never treated as trackable, and no attempt to collect an answer through any non-chat channel.
- TC-AD-16 — **A caregiver whose invitation is not `active`** (pending, declined, expired or revoked) appearing anywhere in the run's data. Expected: nothing sent to them and nothing accepted from them, on any topic; the case is logged as a data anomaly rather than handled conversationally.

**Pass criteria:** ≥90% correct intent classification on ≥20 Kuwaiti-dialect phrases.

**Non-negotiable invariants:**

- Never records `taken_on_time` or `taken_late` without an explicit affirmative reply **from the patient's own chat**. Silence, an unrelated reply, a delivery receipt or a caregiver's message is never "taken".
- **Never records `missed` without the patient saying so.**
- Every status carries `recordedAt` and `source: "adherence_agent"`.
- This agent is the sole writer of dose status for the patients who use it; the app has no dose-logging control and notifications cannot collect — so an uncertain reply goes to `unclear` and asks, never to a best guess.

**Requires human-supplied input:** ≥20 Kuwaiti-dialect test phrases with correct expected intents, native-speaker-verified.

---

## 3. Rescheduling Agent

**Function:** recomputes the schedule when a dose is **reported** missed or a medication is **reported** discontinued. The agent decides *when* to invoke deterministic scheduling logic; it never computes dose times itself.

**Test cases:**

- TC-RS-01 — Reported miss on a daily medication. Expected: next dose recalculated from `doseTimes`; the missed dose stays logged, not deleted. The seed data's reported miss on 2026-09-19 is this case.
- TC-RS-02 — Reported miss on an alternate-day medication. Expected: the cadence preserved, not collapsed to daily. The seed data's alternate-day prescription lands on the 20th and the 22nd but not the 21st; a reschedule that changes that is a failure.
- TC-RS-03 — Reported discontinuation. Expected: remaining future doses cancelled; `status: discontinued` with reason and timestamp; past logs untouched.
- TC-RS-04 — A reschedule attempt after the duration elapsed. Expected: reject / no-op — never extend past `startDate + durationDays`.
- TC-RS-05 — A three-times-daily prescription. Expected: doses land on all three `doseTimes`.
- TC-RS-06 — A patient with tracking off. Expected: this agent never runs for them; their schedule is generated once by the deterministic layer and not recomputed by any agent.
- TC-RS-07 — A prescription still flagged `needsReview`. Expected: no schedule generated or recomputed for it at all until the reviewer confirms the fields.

**Pass criteria:** 100% correctness on all schedule-math cases, verified by unit tests on the scheduling function directly against the frozen `REFERENCE_NOW` in `Seed Dataset.md`, not only end-to-end.

**Non-negotiable invariant:** dose-time arithmetic is traceable to a deterministic code path (an n8n Code node) in every case. Any case where the LLM's own output is the source of a computed date/time is a failure of the architecture.

---

## 4. Interaction Screening Agent

**Function:** screens the full profile via RAG over an authoritative drug database (RxNorm/DrugBank), using the SFDA-derived brand-to-generic mapping for Gulf trade names. Produces `InteractionAlert` records. **Runs for every patient, whatever they opted into** — the core safety promise has no channel dependency.

**Test cases:**

- TC-IX-01 — A known dangerous pair. Expected: an alert with `severity: "danger"`, `reviewStatus: "pending_medical_review"`, `createdAt`, and `sourceCitation` naming the matched record. The product's core scenario is this case: Warfarin from a public hospital against Ibuprofen from a private clinic, for the same patient.
- TC-IX-02 — Medications with no known interaction. Expected: no alert.
- TC-IX-03 — A drug unresolvable via the mapping or the databases. Expected: an explicit "cannot verify this drug" output — never silently "no interaction found".
- TC-IX-04 — Grounding check with a nonsense drug name. Expected: "not found". A fabricated interaction is an automatic failure.
- TC-IX-05 — A patient with no chat and no notifications. Expected: the alert is still created and still reaches the app, the caregiver's view and the reviewer queue.
- TC-IX-06 — A profile containing a prescription still flagged `needsReview`. Expected: that prescription is excluded from screening until confirmed, and its exclusion is visible rather than silent.

**Pass criteria:** 100% recall on the known-interaction test set. Every positive result populates `sourceCitation` with the specific matched record, which both the patient screen and the reviewer screen display verbatim — so a vague citation is visible to the panel.

**Non-negotiable invariant:** no code path allows a prescription, refill or travel-check result to reach the patient without passing through this agent first.

**Requires human-supplied input:** ≥3 verified interacting pairs (with citations) and ≥3 verified non-interacting pairs — including the real citation for the Warfarin/NSAID finding, which `Seed Dataset.md` deliberately leaves blank rather than invent.

---

## 5. Travel Check Agent

**Function:** identifies a photographed foreign medication, resolves brand to active ingredient, and passes the result into the Interaction Screening Agent against the full profile.

**Test cases:** a clear photo of a recognizable package → correct identification and resolution · an unclear photo → an explicit "cannot identify", never a guess · a resolved drug screened against the full profile, not in isolation · a photo submitted from the **app** by a patient with no chat → identical behaviour.

**Pass criteria:** ≥80% correct identification across ≥5 sample foreign medication photos.

**Requires human-supplied input:** ≥5 photos of real foreign packaging with ground-truth brand/ingredient.

---

## 6. Orchestrator Agent

**Function:** routes incoming input to the correct specialist — from the chat and from the app's entry points.

**Test cases:** an adherence-style reply or quick-reply tap → Adherence Agent · a photo of a medication package → Travel Check · a photo or PDF of a prescription → Extraction · `/start` with a link token → the link-confirmation path, never an agent · a message from an **active caregiver's** chat → never the adherence path · a message from a chat belonging to a caregiver whose invitation is **not active** → no agent, no patient data, no reply that reveals a patient exists · a message from a patient whose tracking is off → no adherence path; either the fitting on-demand agent or a short reply explaining check-ins aren't switched on · an ambiguous message → a clarifying question, not a silent guess.

**Pass criteria:** ≥95% correct routing across ≥15 varied inputs, including at least three ambiguous between extraction and travel check (a photo of a medicine box versus a photo of a prescription is the realistic confusion) and at least one from a caregiver.

---

## Escalation Policy (Risk-Tiered)

Low-stakes ambiguity is resolved conversationally or with a logged conservative default. Genuine danger — a real interaction, contradictory dosing instructions, or a missing critical field — must reach a human reviewer before the patient sees a final result. **This path is independent of every channel:** the alert, its pending state, the flagged-field queue and the reviewer's decision all live in the app, so it works for every patient.

**Two queues, one gate.** Interaction findings go to the reviewer as `pending_medical_review`. Prescriptions with unreadable critical fields go to the reviewer's **field-confirmation queue** via `needsReview: true`. This track fills both queues and resolves neither.

**Test cases:** a vague adherence reply resolves with no reviewer-facing flow · a real flagged interaction is written as `pending_medical_review`, never delivered as final · an agent never writes `reviewStatus: "reviewed"`, any reviewer field, or any `fieldReview*` field · a danger finding for a patient with no chat still reaches the queue.

**Non-negotiable invariant:** no configuration or code path lets a genuine-danger case bypass the human gate — including in the chat, where the temptation to answer immediately is highest.

---

## Channel: Telegram (opt-in), WhatsApp (documented fallback)

**Setup:** a bot created via BotFather — **not yet done**; until then the documents carry the placeholder handle `@jurah_bot`. The token is server-side only. n8n's Telegram node sends; the Telegram Trigger receives. Only the bot handle is public, and the app reads it from configuration rather than hard-coding it.

**Test cases:** a send/receive round trip for every opted-in test recipient, including photos and documents inbound · the destination comes from the subject's `telegramChatId` and the language from `Patient.language`, neither hardcoded · `Settings.notificationChannel` respected, `"none"` meaning send nothing · `/start` with a valid single-use token links the chat, and a reused, expired or mismatched token is rejected with a plain "ask for a new link" · **a `/start` token belonging to a caregiver whose invitation is not `active` is rejected like any other invalid token, with no hint that an invitation exists** · a patient who blocks the bot or deletes the chat: the send fails gracefully, the failure is logged, no dose is treated as answered and nobody is marked non-adherent · an active caregiver's chat receives alerts and never a check-in · a caregiver revoked mid-course stops receiving anything from the next send onward · if the WhatsApp fallback is used, behaviour is functionally equivalent because the transport sits behind a thin adapter.

**Nothing you send ever contains a Civil ID**, and a person's name appears in a message only to the person entitled to it — never a patient's name in a message to a caregiver whose invitation is not active.

---

## Interface With the Frontend + Backend Track

This track does not build the database, the API layer, the notifications, the caregiver invitation path or the audit log. It writes results conforming exactly to the Data Contracts, and reads — never writes — the subjects' messaging identities, tracking preferences, invitation states and field-review states.

**Decide early, not at integration time:** (a) the write mechanism — direct database write from n8n, or a backend endpoint with its own credential, authenticating as the agent path rather than as a patient session; (b) who resolves the `/start` token; (c) **how this track queries check-in eligibility** — the backend must expose the set of patients with tracking enabled and a `connected` link, so the daily run never guesses; (d) **how this track queries alert recipients** — the backend must expose only `active` caregivers, so no workflow ever has to filter invitation states itself; and (e) confirmation that the backend writes the `AuditEvent` for every agent write, naming `actor.role: "agent"`, since that log is what the project uses to demonstrate that no dose status ever came from the interface. Confirm all five with whoever owns `Acceptance Criteria and Test Plan.md`, and test as soon as the first agent is ready.

---

## Notes for the Implementing Agent

- A "Pass criteria" that is not met is reported as failing. Never adjust the threshold.
- Where a test case is marked "Requires human-supplied input," do not fabricate that data and proceed as if it were validated. Stop and request it.
- **Use `Seed Dataset.md` as the fixture** — the project's single canonical dataset, shared with the frontend's mocks and the backend's seed script. It holds the frozen `REFERENCE_NOW`, a patient with everything off, an opted-in patient with real statuses, an active caregiver, a pending invitation, a declined and an expired one, a flagged prescription, one returned and one confirmed, and audit rows of every type. Do not author your own patients: this track must be tested against the same scenario the panel will see.
- Do not redesign the Data Contracts. If a real constraint requires a change, propose it back explicitly.
