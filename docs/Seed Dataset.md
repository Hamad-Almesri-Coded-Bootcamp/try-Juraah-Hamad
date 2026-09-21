# Jur'ah (جرعة) — Canonical Seed Dataset

**What this is.** One fixed cast of people and records that every track builds and demonstrates against. It is the **reference**, not the schema: `Acceptance Criteria and Test Plan.md` owns the shape of the data, and this file owns the *values*. Change a value here whenever the demo needs a different story; change a field only in the spec.

**Why it exists.** Three tracks read this data — the Phase 1 frontend from a mock layer, the Phase 2 backend from a seed script, the AI agents from whatever the backend serves. Without one written cast each of them invents its own patient, and then a screenshot, a test and a demo disagree about what Hamad is taking. Every "use the canonical seed dataset" line in the other documents points here.

**How it is used, per phase.**

- **Phase 1** — these values become `mock/seed.ts` (or equivalent), read through the one typed data-access layer. Nothing else in the frontend holds data.
- **Phase 2** — the same values become a seed script that populates the real database. A write-then-read round trip must return what Phase 1 returned, which is only checkable because both come from this file.
- **AI Agents** — the same patients are the test subjects, so an extraction or a check-in is tested against the story the panel will see.

**How to change it.** Edit this file first, then regenerate the mock file and the seed script from it. Never edit the mock data alone — a value that exists only in code is how the demo and the document drift apart. Adding a person or a prescription is cheap; **removing one is not**, because every path listed under "What each record is here to prove" is required by the spec's handoff checklist.

**The names, Civil IDs, facilities and clinics below are fictional and synthetic.** The Civil IDs follow Kuwait's twelve-digit shape so validation can be exercised, and belong to no real person. No real patient data is used anywhere in this project.

---

## The frozen clock

```
REFERENCE_NOW = "2026-09-21T09:15:00+03:00"     // Monday, Kuwait time (UTC+3)
```

Every "is this today / is this past / is this upcoming" decision in the product resolves against this constant and never against `Date.now()` (**G3**). It is chosen on purpose: **09:15 on a Monday** means the 08:00 doses are behind us and the 13:00, 14:00, 18:00 and 20:00 ones are still ahead, so a single screenshot shows both sides of "now" without anything depending on when the screenshot was taken.

Two consequences worth stating, because they are easy to get wrong:

- The 08:00 doses of an **untracked** patient are in the past and still carry **no status pill**. Nothing may turn them into `missed` (**G10**).
- The demo day, 2026-09-21, is a day on which one patient has **no dose at all** (an alternate-day cadence lands on the 20th and the 22nd), so the empty-day state is reachable without editing anything.

---

## The cast

Twelve people. Four patients, one caregiver who is also a patient, one invitation never answered, one declined, two revoked, one expired against a Civil ID with no account, one reviewer, one admin — and the reviewer also holds the admin role, which is what makes X0's role chooser reachable.

| # | Name | Civil ID | Role(s) | What they are for |
|---|---|---|---|---|
| 1 | حمد سالم المطيري | `255031200187` | patient | **The default patient.** 71. Chat off, notifications never asked, no dose statuses anywhere. Carries the danger interaction. This is the most-seen state in the product. |
| 2 | فاطمة سالم العجمي | `258071100342` | patient | 68. An **expired** chat link, browser notifications **denied**, an alternate-day medication, a prescription **awaiting field confirmation** and one **returned to the clinic**. |
| 3 | سارة يوسف العجمي | `290022500654` | patient **and** active caregiver | 36. **The opted-in patient**: chat connected, tracking on, real dose statuses including a late one and a reported miss. Also an **active caregiver** for حمد, so she exercises the role chooser and the in-shell switch. And she is **holding a pending invitation from فاطمة**, which exercises the in-app notice inside a patient shell. |
| 4 | عبدالله محمد عبدالعزيز المطيري | `285061400412` | caregiver (active) | حمد's son. **Active**, accepted. His chat is connected and receives **alerts only**. His masked form is the canonical example: `عبدالله م*** ع*** المطيري`. |
| 5 | ناصر حمد المطيري | `288110300229` | **pending invitation only** | حمد's other son, invited and **never answered**. Signing in with this ID must reach **F0 and nothing else**. Has a Jur'ah account, so the patient saw a masked name when inviting: `ناصر ح*** المطيري`. |
| 6 | منى خالد المطيري | `292043000517` | **declined invitation** | Invited by حمد and **declined**. Grants nothing, forever; cannot be re-accepted. |
| 7 | *(no account)* | `277091900873` | **expired invitation** | A valid-shaped Civil ID with **no Jur'ah account**. حمد invited it; **no masked name could be shown**, the flow said only that the invitation was created, and it has since expired. This is the record that proves the app never reveals whether a Civil ID exists. |
| 8 | د. خالد عبدالرحمن الرشيد | `280012000961` | reviewer **and** admin | Works both clinic queues, **and** reads the audit log. The one Civil ID holding two clinic roles, so **X0's role chooser is reachable from a seeded sign-in**. |
| 9 | م. دانة فهد السالم | `293080700148` | admin | Reads the audit log and nothing else. Signing in with this ID goes straight to X1 — no chooser, because there is nothing to choose. |
| 10 | بدر فهد العنزي | `268110500413` | patient | 58. **`onboardingCompleted: false`** — the never-onboarded patient, so **A2 is reachable**. No prescriptions, **no `Settings` row at all**, no `MessagingLink`, no `PushSubscription`. He is also the owner of the empty states: an empty medicine list, an empty day, an empty activity log. A patient with no `Settings` row is the case that proves the defaults apply instead of crashing. |
| 11 | طلال عبدالله المطيري | `298052000731` | **revoked — after acceptance** | حمد's grandson. Accepted, then حمد **withdrew his access**. Reads nothing now, forever. This is the record `caregiver_revoked` points at. |
| 12 | دلال عبدالرحمن المطيري | `285092200664` | **revoked — cancelled before any answer** | Invited by حمد, then حمد **cancelled the invitation the next day**, before دلال opened it. This is the record `caregiver_invite_cancelled` points at, and the reason `revoked` needs the rule below. |

**The masked-name examples, exactly as they must render** (first name in full · each middle name as its initial plus **exactly three** asterisks · family name in full):

| Real name | Masked | Note |
|---|---|---|
| عبدالله محمد عبدالعزيز المطيري | `عبدالله م*** ع*** المطيري` | two middle names |
| ناصر حمد المطيري | `ناصر ح*** المطيري` | one middle name |
| سارة يوسف العجمي | `سارة ي*** العجمي` | one middle name |
| منى خالد المطيري | `منى خ*** المطيري` | one middle name |
| بدر فهد العنزي | `بدر ف*** العنزي` | one middle name |
| طلال عبدالله المطيري | `طلال ع*** المطيري` | one middle name — `عبدالله` is seven letters and still masks to `***` |
| دلال عبدالرحمن المطيري | `دلال ع*** المطيري` | one middle name — masks identically to طلال's, which is the point |
| حمد المطيري *(two parts only)* | `حمد المطيري` | no middle name, nothing masked |
| `277091900873` | *(no name available)* | no account — the response is indistinguishable from the rows above |

Three asterisks in every case. `عبدالعزيز` is nine letters and `حمد` is three, and both mask to `***`, because the length of a name is itself information.

---

## Prescriptions

Nine records. The first two are the core scenario and every demo starts there.

| id | Patient | Drug | Source | Pattern | Times | Start | Duration | State |
|---|---|---|---|---|---|---|---|---|
| `rx-001` | حمد | **Warfarin** (Marevan) 5 mg — 1 tablet | **مستشفى الفروانية** · *public* | daily | `18:00` | 2026-09-01 | 90 | active |
| `rx-002` | حمد | **Ibuprofen** (Brufen) 400 mg — 1 tablet | **عيادة النخبة الطبية** · *private* | daily | `08:00 · 14:00 · 20:00` | 2026-09-19 | 7 | active |
| `rx-003` | حمد | **Metformin** (Glucophage) 500 mg — 1 tablet | **مستشفى الفروانية** · *public* | daily | `08:00 · 20:00` | 2026-06-15 | 180 | active |
| `rx-004` | حمد | **Atorvastatin** (Lipitor) 20 mg | **مستشفى الفروانية** · *public* | daily | `21:00` | 2026-04-02 | 90 | **discontinued** 2026-06-28 — "الطبيب أوقف الدواء بسبب آلام العضلات" |
| `rx-005` | فاطمة | **Prednisolone** 5 mg | **مركز الصباح للأمراض الروماتيزمية** · *public* | **alternate_day** | `09:00` | 2026-09-14 | 60 | active |
| `rx-006` | فاطمة | *(unreadable)* — handwritten | **عيادة الياسمين** · *private* | daily | — | — | 30 | **`needsReview: true`, `fieldReviewStatus: "pending"`** — strength and frequency could not be read |
| `rx-007` | فاطمة | **Ciprofloxacin** 500 mg | **عيادة الياسمين** · *private* | daily | `09:00 · 21:00` | — | 7 | **`fieldReviewStatus: "returned"`** — "الجرعة المكتوبة تتعارض مع المدة، يرجى مراجعة العيادة" |
| `rx-008` | سارة | **Levothyroxine** (Eltroxin) 50 mcg — `strengthMg: 50`, `strengthUnit: "mcg"` | **مستشفى العدان** · *public* | daily | `07:00` | 2026-08-10 | 180 | active |
| `rx-009` | سارة | **Calcium carbonate + vitamin D3** 500 mg | **عيادة النخبة الطبية** · *private* | daily | `13:00 · 21:00` | 2026-09-05 | 90 | active · **`fieldReviewStatus: "confirmed"`** (was flagged, the reviewer confirmed it) |

**Dispensing** is present on `rx-001` (90 tablets, dispensed 2026-09-01), `rx-002` (21 tablets, 2026-09-19), `rx-003` (60 tablets, 2026-09-01 — deliberately **short of the remaining duration**, so the depletion meter and the refill path have something real to say) and `rx-008` (180 tablets, 2026-08-10). It is **absent on `rx-005` and `rx-009`**, which is how the "no dispensing data means no depletion estimate" rule gets exercised instead of being assumed.

`doseTimes.length === frequencyPerDay` holds on every active record. `rx-006` has neither, which is exactly why it is flagged.

**On `strengthUnit` (v7.4, CR-003).** `rx-008` is the only record with a non-default unit; every other record omits `strengthUnit` and takes `"mg"`. The field `strengthMg` holds **the number as written on the prescription, in the unit `strengthUnit` names** — the field's name is historical and no longer describes its contents. `rx-008` is therefore `strengthMg: 50` with `strengthUnit: "mcg"`, **not** `0.05`. Nothing anywhere converts between units: a reader who trusts the field name and multiplies by a thousand produces a 1000× levothyroxine dose, which is the single most dangerous arithmetic error available in this dataset.

---

## Doses

**Doses are generated, never hand-written.** The deterministic engine produces them from `startDate`, `doseTimes`, `dosingPattern`, `frequencyPerDay` and `durationDays`, each carrying `tracked` from the patient's state at generation time, and `rx-006` and `rx-007` generate **nothing at all** because they are not confirmed. What follows is the expected output around `REFERENCE_NOW` — the table a unit test compares against, not a table to type into a fixture.

### حمد — 2026-09-21, tracking **off**

Every row `tracked: false`, `source: "seed"`, `status: "upcoming"` in the data and **no status pill on screen**. The pill is absent because `tracked` is false, not because the status happens to be `upcoming` — a renderer that keys off the status word will look correct here and be wrong the moment tracking is switched on.

| Time | Drug | Dose | Past `REFERENCE_NOW`? |
|---|---|---|---|
| 08:00 | Metformin (Glucophage) | 500 mg | yes — **and still no pill, and never `missed`** |
| 08:00 | Ibuprofen (Brufen) | 400 mg | yes — same |
| 14:00 | Ibuprofen (Brufen) | 400 mg | no |
| 18:00 | **Warfarin** (Marevan) | 5 mg | no |
| 20:00 | Metformin (Glucophage) | 500 mg | no |
| 20:00 | Ibuprofen (Brufen) | 400 mg | no |

Six rows, four time groups. `rx-002` ends 2026-09-25 (start + 7 days), so **2026-09-26 shows only Metformin and Warfarin** — one tap of day-forward navigation proves the duration boundary. `rx-004` is discontinued and generates nothing after 2026-06-28, which is the other boundary.

### سارة — the tracked patient

Every row `tracked: true`.

| Day | Time | Drug | Status | Recorded |
|---|---|---|---|---|
| 2026-09-19 | 07:00 | Levothyroxine | **`missed`** | `source: "adherence_agent"` — **she said so**; nothing inferred it |
| 2026-09-20 | 07:00 | Levothyroxine | `taken_on_time` | 07:05, `adherence_agent` |
| 2026-09-20 | 13:00 | Calcium + D3 | `taken_on_time` | 13:20, `adherence_agent` |
| 2026-09-20 | 21:00 | Calcium + D3 | **`taken_late`** | 22:40, `adherence_agent` |
| **2026-09-21** | 07:00 | Levothyroxine | `taken_on_time` | 07:12, `adherence_agent` |
| **2026-09-21** | 13:00 | Calcium + D3 | `upcoming` | — |
| **2026-09-21** | 21:00 | Calcium + D3 | `upcoming` | — |

No dose anywhere in this dataset has `source: "ui"`, and no dose of an untracked patient has a status. That is the claim the audit log exists to prove.

### فاطمة — the alternate-day cadence

`rx-005` from 2026-09-14 at 09:00, every other day: **14 · 16 · 18 · 20 · 22 · 24 …** — so **2026-09-21 has no dose at all** and renders the empty-day state, while 2026-09-20 has one and 2026-09-22 has the next. A reschedule that collapses this to daily is the single easiest bug to introduce in the scheduling engine, and this record is here to catch it.

---

## Interaction alerts

| id | Patient | Drugs | Severity | Review state |
|---|---|---|---|---|
| `ia-001` | حمد | **Warfarin × Ibuprofen** (`rx-001` × `rx-002`) | **`danger`** | **`pending_medical_review`** — raised 2026-09-19T11:04+03:00 |
| `ia-002` | سارة | **Levothyroxine × Calcium carbonate** (`rx-008` × `rx-009`) | `warning` | **`reviewed`** · `reviewerDecision: "confirmed"` · note: "تُؤخذ اللِفوثيروكسين على معدة فارغة وتُفصل عن الكالسيوم بأربع ساعات على الأقل" · by `280012000961`, 2026-09-08 |
| `ia-003` | فاطمة | Prednisolone × *(screened, nothing found)* | `info` | **`auto_cleared`** |

`ia-001` is the core of the demo and the reason the whole product exists: **one prescription from a public hospital and one from a private clinic, for the same patient, that nobody in either place could see together.** It appears on حمد's My Medicines in full `danger` fill, above every prescription card, **even though he opted into nothing** — and in عبدالله's caregiver view, read-only, and in the reviewer's queue. It never reads as final until the reviewer decides.

`sourceCitation` must be a real, checkable line from the drug database the screening agent actually queried — a NSAID/warfarin bleeding-risk record — and the screens display it **verbatim**. Leave it unwritten here rather than invent a citation: an invented one is worse than a missing one, and both the patient screen and the reviewer screen show whatever this field contains to a clinician who will recognise a fake.

---

## Everything else

**Settings** — one row per patient who has completed onboarding, no row for a caregiver, and **no row for بدر**.

| Patient | tracking | frequency | refill alerts | calendar | web push | chat channel | language |
|---|---|---|---|---|---|---|---|
| حمد | **false** | daily | true | false | **false** | **`"none"`** | `ar` |
| فاطمة | **false** (the link expired) | daily | true | false | false | `"none"` | `ar` |
| سارة | **true** | daily | true | **true** | true | `"telegram"` | `ar` |
| بدر | *— no row —* | — | — | — | — | — | — |

بدر's missing row is deliberate and is the third thing this table proves: reading settings for a patient who has no row returns the documented defaults — tracking **off**, channel **`"none"`**, push **off**, language `ar` — and never throws, and never writes a row as a side effect of being read.

**MessagingLink** — every state present, and **no row at all for بدر**, which resolves to `not_connected` the same way a missing `Settings` row resolves to the defaults: حمد `not_connected` (the default) · فاطمة `expired` with a dead token · سارة `connected`, linked 2026-08-11 · عبدالله `connected`, linked 2026-09-03 (**alerts only**) · one `pending` row with a live single-use token, belonging to فاطمة's retry. No `chatId` value appears on any screen or in any document, this one included.

**PushSubscription** — every permission present, and again **no row for بدر**: حمد `default` (never asked) · فاطمة **`denied`** · سارة `granted`, active · عبدالله **`unsupported`** — iPhone Safari with Jur'ah not added to the Home Screen, which is the state that must give install steps rather than a promise. Endpoints and keys are server-side only and appear nowhere.

**RefillRequest** — one: `rx-003` (Metformin, public) requested 2026-09-20, `routedTo: "public_pharmacy"`, status `requested`. The routing matches the prescription's own sector, which is the invariant this record exists to prove. A second, older one on `rx-001` sits at `approved`.

**CalendarSubscription** — one, for سارة, `webcal://` from her `patientId` plus a token. One-directional.

**Caregiver records** — eight, one per invitation, covering every state (seven on حمد, one on فاطمة):

| Caregiver | Patient | status | Timeline |
|---|---|---|---|
| عبدالله (`285061400412`) | حمد | **`active`** | invited 2026-09-02, **accepted 2026-09-03** |
| سارة (`290022500654`) | حمد | **`active`** | invited 2026-08-20, accepted 2026-08-20 |
| ناصر (`288110300229`) | حمد | **`pending`** | invited 2026-09-18, expires 2026-10-02 — **never answered, grants nothing** |
| منى (`292043000517`) | حمد | **`declined`** | invited 2026-09-10, **declined 2026-09-10** |
| *(no account)* `277091900873` | حمد | **`expired`** | invited 2026-08-01, expired 2026-08-15 |
| طلال (`298052000731`) | حمد | **`revoked`** | invited 2026-07-10, **accepted 2026-07-11**, **revoked 2026-08-28** — access was withdrawn *after* it had been granted |
| دلال (`285092200664`) | حمد | **`revoked`** | invited 2026-06-05, expires 2026-06-19, **cancelled 2026-06-06**, `acceptedAt` **unset** — a pending invitation withdrawn before any answer |
| سارة (`290022500654`) | **فاطمة** | **`pending`** | invited 2026-09-20 — this is the one **سارة sees as a notice inside her own patient shell**, and answers without signing out |

`name` on each of these is **the name the patient typed**, a claim and not a lookup. `relationship`, in table order, is "ابني" · "ابنتي" · "ابني" · "زوجة ابني" · "قريب" · "حفيدي" · "ابنة أخي" · "ابنة أختي".

**The rule that makes the two `revoked` rows legible, and it is a rule, not a note.** `Caregiver.status` has no `cancelled` value, and it does not need one: **`revoked` is the single end state for an invitation the patient took back**, and `acceptedAt` says which kind it was — set means access was withdrawn after acceptance (طلال), unset means a pending invitation was cancelled before any answer (دلال). Both grant **nothing**, forever, and neither can be re-accepted; the distinction exists for the audit log and for the wording on F1, not for permissions. `revokedAt` carries the date in both cases (CR-027) — until that field is approved, the date lives only in the audit row, which is a gap a reader should notice rather than paper over.

**Account** (v7.4, CR-008) — one row per Civil ID that **has a Jur'ah account**, patient or not. Eleven rows. `277091900873` has **no row at all**, and that absence is the whole reason the masked-name lookup can return nothing without the interface ever saying so.

| Civil ID | Name | `roles` |
|---|---|---|
| `255031200187` | حمد سالم المطيري | `["patient"]` |
| `258071100342` | فاطمة سالم العجمي | `["patient"]` |
| `290022500654` | سارة يوسف العجمي | `["patient", "caregiver"]` |
| `268110500413` | بدر فهد العنزي | `["patient"]` |
| `285061400412` | عبدالله محمد عبدالعزيز المطيري | `["caregiver"]` |
| `288110300229` | ناصر حمد المطيري | `[]` |
| `292043000517` | منى خالد المطيري | `[]` |
| `298052000731` | طلال عبدالله المطيري | `[]` |
| `285092200664` | دلال عبدالرحمن المطيري | `[]` |
| `280012000961` | د. خالد عبدالرحمن الرشيد | `["reviewer", "admin"]` |
| `293080700148` | م. دانة فهد السالم | `["admin"]` |

Two things in this table carry weight:

- **`roles: []` is a real, reachable state, not a broken row.** ناصر, منى, طلال and دلال all have accounts and can sign in successfully. ناصر reaches **F0 and nothing else**; the other three reach the "no one has invited you" message and nothing else. A sign-in that succeeds and grants nothing is a state the product must hold calmly, and four rows exist so it cannot be skipped.
- **`roles` is written out here for readability, but it is derived.** A `patient` role means a `Patient` row exists; a `caregiver` role means **at least one `Caregiver` row for that Civil ID is `active`** — which is why عبدالله has it and طلال does not, though both once did; `reviewer` and `admin` are assigned, not derived. `seed-invariants.ts` must recompute the whole column and assert it matches this table exactly. **If they ever disagree, the derivation is right and this table is stale.**

**AuditEvent** — append-only, newest first, at least one row of every type. The rows that matter most:

- every `dose_status_recorded` carries `actor.role: "agent"` (سارة's five — her other two rows on 2026-09-21 are still `upcoming` and carry no event) or `"system"`, and **not one carries `"patient"`, `"caregiver"`, `"reviewer"` or `"admin"`** — filtering the log to this one type is the demo's proof moment
- the full invitation lifecycle: `caregiver_invited` ×8, `caregiver_invite_accepted` ×3, `caregiver_invite_declined` ×1, `caregiver_invite_expired` ×1, `caregiver_revoked` ×1 (طلال, 2026-08-28) and `caregiver_invite_cancelled` ×1 (دلال, 2026-06-06) — every one of the eight `Caregiver` rows is reachable from the log, and no log row points at an invitation that has no record
- `alert_raised` by `agent`, `alert_reviewed` by `reviewer` (`ia-002`)
- `prescription_field_confirmed` by `reviewer` (`rx-009`) and `prescription_returned_to_clinic` by `reviewer` (`rx-007`)
- `schedule_recomputed` by `system` after سارة's reported miss on 2026-09-19
- `messaging_connected` ×3, `messaging_disconnected` ×1, `push_enabled`, `push_disabled`, `tracking_enabled` (سارة), `tracking_disabled` (فاطمة, when her link expired), `signed_in`, `signed_out`, `prescription_added` ×9, `refill_requested`, `refill_status_changed`

Every message is plain Arabic, and **no audit message anywhere contains a Civil ID** — a name in a message is masked.

---

## What each record is here to prove

A one-line reason per row of the spec's "Backend Foundations" list, so nothing gets removed as redundant:

| The path | The record |
|---|---|
| a patient with the chat off and no statuses — **the default** | حمد |
| an opted-in patient with real statuses | سارة |
| a Civil ID that is **both** a patient and an active caregiver | سارة |
| a `pending` invitation granting nothing | ناصر |
| a `declined` invitation | منى |
| an `expired` invitation | `277091900873` |
| a Civil ID with **no account**, so no masked name | `277091900873` |
| a patient **holding** a pending invitation from someone else | سارة ← فاطمة |
| a prescription with `needsReview: true` | `rx-006` |
| a prescription **returned** to the clinic | `rx-007` |
| a prescription **confirmed** by the reviewer | `rx-009` |
| a `MessagingLink` in each state | حمد · فاطمة · سارة · the pending token |
| a `PushSubscription` in each permission | حمد · فاطمة · سارة · عبدالله |
| `AuditEvent` rows of every type | the list above |
| a danger interaction across **public and private** sources | `ia-001` |
| a **reviewed** alert with a decision and a note | `ia-002` |
| an `auto_cleared` alert | `ia-003` |
| an **alternate-day** cadence, and an **empty day** | `rx-005` on 2026-09-21 |
| a **discontinued** medication in the past grouping | `rx-004` |
| a **duration boundary** one day-forward tap away | `rx-002` ending 2026-09-25 |
| **depletion and a refill** with real quantities | `rx-003` |
| **no dispensing data**, so no estimate | `rx-005` · `rx-009` |
| a **late** dose and a **reported** miss | سارة, 20 and 19 September |
| the **iOS-without-install** push case | عبدالله |
| a patient who has **not completed onboarding**, so A2 is reachable | بدر |
| a patient with **no `Settings`, `MessagingLink` or `PushSubscription` row**, so defaults are exercised | بدر |
| **empty** medicine list, empty day, empty activity log, with a real owner | بدر |
| access **revoked after acceptance** | طلال |
| an invitation **cancelled before any answer** | دلال |
| a Civil ID holding **two clinic roles**, so X0's chooser is reachable | د. خالد |
| an account that signs in and **grants nothing** | ناصر · منى · طلال · دلال |
| a **non-default strength unit** | `rx-008` |

---

## Still to be written by the project owner

This file fixes the data. Two things it deliberately does not contain:

- **`sourceCitation` for `ia-001`** — the real line from the drug database the screening agent queries. It must be genuine; the screens show it verbatim to a clinician.
- **The bilingual copy deck** — every string on every screen, including the fixed vocabulary of **G9**, the landing headline, F0's "what you will and will not be able to do" wording, the masked-name confirmation question, the "no one has invited you" message and the iOS install steps. The names and drugs are settled here; the sentences are not.
