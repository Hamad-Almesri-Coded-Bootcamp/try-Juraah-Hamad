# Jur'ah (جرعة) — Decisions and change requests

**How this file works.** Every proposal to change, reinterpret or fill a gap in a binding document is logged here in the protocol's shape: what the document says · why it is a problem · what is proposed · what it costs · what breaks if we don't. The build continues **as written** until the owner answers, except where two binding documents contradict each other or a document cannot be built as written; in those cases the default taken is stated and marked. Answers are recorded under each item; a resolved item also names the project document that must be updated to match.

**Status legend:** `OPEN` awaiting the owner · `DEFAULT` the build proceeds on the stated default until answered · `BLOCKS` must be answered before the named work package starts · `RESOLVED`.

**Numbering.** CR numbers were assigned as findings were logged during the read; CR-013, CR-015, CR-023 and CR-024 were folded into CR-012, D-001, D-002 and D-004 respectively and their numbers retired, so the sequence has gaps.

---

## Gate 0 — needs an answer before WP1 (contracts, data layer, seed)

### CR-002 · Required contract fields that the seed's flagged and returned prescriptions do not have — `RESOLVED`
- **Owner's answer (Gate 0).** Approved with a tightening: the five fields are optional **only** while `needsReview: true` or `fieldReviewStatus` is `pending` or `returned`. Two stated invariants, guard-scripted (`scripts/guards/seed-invariants.ts`): an `active` prescription with `needsReview: false` carries all five; the dose generator returns an empty array unless `startDate` is present and `doseTimes.length === frequencyPerDay`. "Optional" never means an active prescription may have no schedule. **Doc to update:** Data Contracts → `Prescription`.
- **Document says.** Data Contracts: `Prescription.startDate` REQUIRED, `doseTimes` REQUIRED with `length === frequencyPerDay`, `frequencyPerDay: number`, `drug.strengthMg: number`, `drug.brandName: string`. `Seed Dataset.md`: `rx-006` (handwritten, `needsReview: true`) has no strength, no frequency, no times, no start date; `rx-007` (returned) has times but no start date; `rx-005`, `rx-007`, `rx-009` have no brand name.
- **Why it is a problem.** WP1 must transcribe the contracts exactly *and* the seed exactly. Both cannot be true. Filling the gaps with placeholder values invents seed data; leaving them out fails the type.
- **Proposal.** Amend the contract: `startDate?`, `doseTimes?`, `frequencyPerDay?`, `drug.strengthMg?` and `drug.brandName?` become optional, each with the comment "absent only while `needsReview` is true and `fieldReviewStatus` is not `confirmed`" (brand name may also be absent for a generic-only dispensing). The schedule engine already skips such records, so nothing downstream changes. `PrescriptionCard` already treats `brandName` and `strengthMg` as optional.
- **Cost.** Five `?` marks and a comment in `types/contracts.ts` and in the spec's Data Contracts; a `DetailRow` renders its empty mark where a value is absent (it already does).
- **If we don't.** WP1 cannot start; or the seed grows invented strengths and dates for a prescription whose whole point is that they could not be read.
- **Default until answered.** WP1 transcribes the contract with the five fields optional and marks the deviation with a `// CR-002` comment.
- **Doc to update on approval.** `Acceptance Criteria and Test Plan.md` → Data Contracts → `Prescription`; `Seed Dataset.md` unchanged.
- **Spec updated (v7.4):** `Prescription` fields and the two invariants written into the Data Contracts. `Seed Dataset.md` unchanged.
- **Interpretation recorded at Gate 0b (owner to confirm).** Invariant (1) as phrased says "all five", but `rx-005` and `rx-009` are `active`, `needsReview: false`, and have no `brandName` — the seed's own generic-only dispensings, which the approved proposal already allowed ("brand name may also be absent for a generic-only dispensing"). Guard S asserts the four clinical fields (`strengthMg`, `frequencyPerDay`, `startDate`, `doseTimes`) on every active unflagged prescription and treats `brandName` as optional throughout. If the owner wants `brandName` mandatory instead, the seed needs brands for `rx-005` and `rx-009`.


### CR-003 · Levothyroxine is 50 mcg; the contract has `strengthMg: number` — `RESOLVED`
- **Owner's answer (Gate 0).** Approved: add `strengthUnit?: "mg" | "mcg" | "g" | "ml" | "IU"` (default `"mg"`) to `Prescription.drug`. `rx-008` is the only record with a non-default unit; `PrescriptionCard` already takes a `strengthUnit` prop. **Doc to update:** Data Contracts; `Seed Dataset.md` rx-008.
- **Document says.** `rx-008` "Levothyroxine (Eltroxin) 50 mcg"; contract `drug.strengthMg: number`.
- **Why it is a problem.** The value is `0.05` in milligrams. Shown raw to an elderly patient that is unreadable; shown as "50 mcg" it needs a unit the contract does not carry.
- **Proposal.** Add `drug.strengthUnit?: "mg" | "mcg"` (default `"mg"`) to the contract, seed `rx-008` with `strengthMg: 0.05, strengthUnit: "mcg"`... or, simpler, keep the contract and let the formatter render any strength below 1 mg in micrograms (deterministic arithmetic, unit-tested).
- **Cost.** One optional field, or one formatter rule.
- **If we don't.** Either "0.05 mg" on screen or an invented unit field.
- **Default until answered.** Contract unchanged; seed stores `strengthMg: 0.05`; the formatter renders sub-milligram strengths as micrograms (`0.05 mg → 50 mcg`), with a unit test.
- **Signal from the owner's Phase 0 edits.** The repository boards' shared `renderVals` now carry `strengthDisplay: '50 mcg'` on Levothyroxine, which suggests a display field is the owner's preference; that would be a contract addition (`drug.strengthDisplay?: string`) and is offered here as the alternative to the formatter.
- **Doc to update on approval.** Data Contracts if the field is added.
- **Spec updated (v7.4):** `drug.strengthUnit` added to the Data Contracts. Seed value landed at Gate 0b (`rx-008`: `strengthMg: 50, strengthUnit: "mcg"`).


### CR-004 · No seed patient has `onboardingCompleted: false`, so A2 is unreachable from a seeded sign-in — `RESOLVED`
- **Landed (Gate 0b).** The tenth person is بدر فهد العنزي `268110500413`, 58, `onboardingCompleted: false`, no prescriptions, no `Settings`, `MessagingLink` or `PushSubscription` row. WP1 transcribes from `Seed Dataset.md`.
- **Owner's answer (Gate 0).** Add a **tenth seed person**: a new patient with `onboardingCompleted: false`, no prescriptions, no Settings row, tracking off. A2 becomes reachable and the empty-day / empty-list states get a real owner. Civil ID and name to be fixed by the owner in `Seed Dataset.md` (WP1 uses the marker `[TO BE SUPPLIED]` for both until then, and the sign-in test list carries the row as soon as the values land).
- **Document says.** `Patient.onboardingCompleted: boolean` is required; A2 "runs once while `onboardingCompleted` is false"; `Seed Dataset.md` never states the value for any patient, and all three patients are established users.
- **Why it is a problem.** A2 is in the inventory and must be built, tested and walked, but the demo has no door into it. Setting a patient to `false` is inventing a seed value.
- **Proposal.** Owner adds `onboardingCompleted` to the cast table (حمد, فاطمة, سارة = `true`) and decides how A2 is demonstrated: (a) a fourth patient with `false` and no prescriptions yet — also gives B1/B2 a natural empty state — or (b) accept that A2 is reached only through the test harness.
- **Cost.** One row in the seed table (option a), or nothing (option b).
- **If we don't.** A2 is walked only through a fixture and the demo script cannot show first-run.
- **Default until answered.** All three patients `true`; A2 is exercised in tests and in the states gallery through the mock's fault/fixture switch (which lives inside the mock implementation only).
- **Doc to update on approval.** `Seed Dataset.md` cast table.

### CR-005 · No seed Civil ID holds both `reviewer` and `admin`, so X0's chooser is unreachable — `RESOLVED`
- **Landed (Gate 0b).** `280012000961` (د. خالد) holds `["reviewer", "admin"]` in the seed's `Account` table.
- **Owner's answer (Gate 0).** Give `280012000961` (د. خالد) the `admin` role in addition to `reviewer`; `293080700148` (م. دانة) stays admin-only so the "admin reads the audit log and nothing else" case stays intact. X0's chooser becomes reachable. **Doc to update:** `Seed Dataset.md` cast.
- **Document says.** X0: "a chooser between medical review and system administration for an ID holding both". Seed: خالد is reviewer only, دانة is admin only.
- **Proposal.** Owner either adds a dual-role staff member to the cast, or grants one of the two both roles, or accepts that the chooser is reached only through the harness.
- **Cost.** One line in the seed.
- **If we don't.** The chooser exists, renders in the gallery, is unit-tested, but the demo cannot show it.
- **Default until answered.** Built and tested via fixture; not reachable from seeded sign-in.
- **Doc to update on approval.** `Seed Dataset.md` cast table.

### CR-006 · Audit rows `caregiver_invite_cancelled` and `caregiver_revoked` reference an older invitation that has no `Caregiver` record — `RESOLVED`
- **Landed (Gate 0b).** The owner added **two** revoked rows, not one, because the two audit types are different lifecycles: طلال `298052000731` (accepted 2026-07-11, revoked 2026-08-28) and دلال `285092200664` (invited 2026-06-05, cancelled 2026-06-06, `acceptedAt` unset). Caregiver rows are eight; the cast is twelve; `caregiver_invited` ×8, `caregiver_invite_accepted` ×3.
- **Owner's answer (Gate 0).** Add a seventh `Caregiver` record with `status: "revoked"` on حمد so `caregiver_revoked` and `caregiver_invite_cancelled` point at a row that exists (name, relationship and dates to be fixed by the owner; `[TO BE SUPPLIED]` until then). **Doc to update:** `Seed Dataset.md` caregiver table.
- **Document says.** "plus a `caregiver_invite_cancelled` and a `caregiver_revoked` from an older invitation kept for the log's sake"; the caregiver table has no such row.
- **Why it is a problem.** An event's message normally names the invited person (masked); there is no person to name without inventing one.
- **Proposal.** Owner either adds the older invitation as a seventh `Caregiver` row (`revoked`) or accepts events whose messages name no person.
- **Default until answered.** Both events exist on حمد's timeline with `relatedId` absent and messages that name no person ("دعوة سابقة أُلغيت" / "صلاحية سابقة سُحبت").
- **Doc to update on approval.** `Seed Dataset.md` caregiver table.

### CR-007 · Two counts in the seed text disagreed with their own tables — `RESOLVED`
- **Was.** "Eight records" above nine prescription rows; "five" caregiver records above six rows.
- **Resolved.** The owner corrected both words in `Seed Dataset.md` during Phase 0 ("Nine records"; "six, one per invitation … five on حمد, one on فاطمة") and also corrected سارة's `dose_status_recorded` count to five (her two 2026-09-21 `upcoming` doses carry no event). WP1 builds to the corrected text.

### CR-008 · Identity for account holders who are not patients (and for staff) has no contract entity — `RESOLVED`
- **Owner's answer (Gate 0).** Approved as a contract addition: `Account { id, civilId, name, roles: ("patient" | "caregiver" | "reviewer" | "admin")[] }`. Role resolution reads it; `Patient` and `Caregiver` are unchanged. **Doc to update:** Data Contracts.
- **Document says.** The masked-name lookup shows a name "only when that Civil ID has a Jur'ah account"; عبدالله, ناصر, منى have accounts and names; the reviewer and admin have names; F4 shows the caregiver's own name. No contract entity holds a non-patient person's name or a staff member's role.
- **Proposal.** No contract change. WP1 adds a **mock-internal identity directory** (`Civil ID → full name, roles held`) inside the mock implementation, never exported through the data layer except as the masked name or the session's own display name. Recorded in `BACKEND-NOTES.md` §2 as a shortcut the backend must implement as an identity/accounts table with the byte-identical masked-lookup response.
- **Cost.** One internal table.
- **If we don't.** The masked-name step, the role chooser labels and the caregiver profile have no source of names.
- **Status.** `DEFAULT` as proposed; informing the owner.
- **Spec updated (v7.4):** `Account` added to the Data Contracts, before `Patient`. The eleven-row table landed at Gate 0b; `roles` is derived and asserted (seed rule 2).


### CR-017 · `Patient.caregiverIds` semantics — `RESOLVED`
- **Owner's answer (Gate 0).** Not answered at Gate 0; default stands (all linked rows).
- **Document says.** `caregiverIds: string[]` with no rule on which states are included.
- **Proposal.** All `Caregiver` rows linked to the patient, in any state (it is the F1 list); active-only would be derivable anyway.
- **Default.** All linked rows.
- **Doc to update on approval.** Data Contracts comment.

### CR-018 · Most audit rows have no stated timestamp or message — `RESOLVED`
- **Owner's answer (Gate 0).** Not answered at Gate 0; default stands (derived deterministically, listed in BACKEND-NOTES §2).
- **Document says.** The audit section names types and counts and a handful of times; most rows have no time and no message text.
- **Proposal.** WP1 derives every unstated timestamp deterministically from the related record (e.g. `prescription_added` at the prescription's `startDate` 09:00, `caregiver_invited` at `invitedAt`, `signed_in` at 2026-09-21 06:02 as on the board) and writes plain Arabic messages with masked names and no Civil ID; every derived value is listed in `BACKEND-NOTES.md` §2 for the owner to accept or correct.
- **Default.** As proposed.
- **Doc to update on approval.** `Seed Dataset.md` if the owner wants the derived times canonical.

### CR-025 · The "fixed test list" for A1 — `RESOLVED`
- **Landed (Gate 0b).** The test list is the seed's **twelve** Civil IDs (eleven `Account` rows plus `277091900873`, which has none).
- **Owner's answer (Gate 0).** Confirmed in effect by decisions 4 and 5: the test list is the seed's Civil IDs, now ten.
- **Document says.** "Only IDs in the fixed test list are accepted"; the list is not enumerated.
- **Proposal.** The list is exactly the nine Civil IDs in the seed cast, including `277091900873` (which has no account). Anything else is the only case A1 rejects.
- **Default.** As proposed (see `ROLES.md`).
- **Doc to update on approval.** `Seed Dataset.md` — one sentence naming the nine as the test list.

---

## Gate 0 — conflicts between binding documents (default taken, answer wanted before the named bundle)

### CR-001 · A3 and F4 say "Civil ID (masked)"; CLAUDE.md rule 6 and the design-system book say no Civil ID is ever printed — `RESOLVED`
- **Owner's answer (Gate 0).** Approved, strict rule wins: no Civil ID is ever printed, anywhere, in any role. The spec text of A3 and F4 is to be corrected so the contradiction does not return — see CR-026.
- **Documents say.** Spec A3: "name, Civil ID (masked)"; F4: "their own name and Civil ID (masked)". CLAUDE.md rule 6: "No Civil ID is ever printed back to a reader." Design System README: "No component ever prints a Civil ID back to the screen, whole or masked." Board `CaregiverProfile` renders `٢٨٥****٠٤١٢`.
- **Why it is a problem.** Two binding sources contradict each other on two screens.
- **Proposal.** Amend A3 and F4 to "name · signed in with Hawiati (simulated)" and drop the Civil ID row; a person knows their own number and the screen gains nothing by echoing it. If the owner prefers the spec's reading, the stricter rule in CLAUDE.md and the design system must be relaxed to "another person's Civil ID" instead.
- **Cost.** One `DetailRow` fewer on two screens.
- **If we don't.** A guard that greps for Civil IDs on screen cannot be written cleanly, and the design-system rule is broken on two screens.
- **Default until answered.** The stricter reading: no Civil ID, masked or whole, anywhere on screen.
- **Doc to update on approval.** `Acceptance Criteria and Test Plan.md` A3 and F4 (or CLAUDE.md rule 6 and the DS README).

### CR-021 · The masked name's accessibility behaviour — resolved by an existing owner rule, recorded for the record
- **Documents say.** Foundations: the masked name is "ordinary `body-strong` text" **and** "the asterisks are decorative to assistive technology: the accessible name reads the first and last name with the middle names announced as hidden"; "masked names never mirror". `Build Prompts.md` prompt 1: "There is no component for this … **Do NOT add a MaskedName component**".
- **Why it matters.** The `aria` behaviour and the bidi isolation of the asterisk runs need markup, and four screens plus every audit message render masked names.
- **Decision (no owner answer needed).** Not a component. One formatter, `lib/format/maskedName.tsx`, returns the marked-up `body-strong` text with exactly that behaviour, and every masked name renders through it. Unit-tested with none, one and several middle names, always three asterisks.
- **Status.** `RESOLVED` by the owner's own prompt text.

### CR-022 · Where the eleven pending components get built — `RESOLVED`
- **Owner's answer (Gate 0).** Approved: build the eleven in the repository to `Build Prompts.md` prompt 1. CR-021 noted: the masked name is a formatter, not a component.
- **Documents say.** G5: a component the system lacks is reported, never invented inline. Foundations and `docs/design-system/README.md`: eleven components are pending; `Build Prompts.md` **prompt 1 is their full specification** (anatomy, states, read-only rules, previews, READMEs) and is written to be run *inside the design-system artifact*. `navigation.md`: "build them before designing the screens that stand on them".
- **Why it is a decision.** Either the owner runs prompt 1 in the artifact first and the repository ports the results (WP2 groups b and c, and therefore every screen bundle, wait for that), or WP2 builds the eleven directly in the repository to prompt 1's specification.
- **Proposal.** WP2 builds them in `components/ui/` **to prompt 1's specification verbatim** (it is the owner's brief, so nothing is invented), each with a README under `components/ui/README/` written to prompt 1's GUIDELINES section, reviewed at Gate 2 as system components. The READMEs and previews can be published back into the artifact afterwards so the two stay in step. Nothing beyond the eleven is built.
- **Cost.** None to the schedule; a later back-port to the artifact if the owner wants the system complete there too.
- **If we don't.** Phase 1 waits on a design-system session before any screen can start.
- **Default until answered.** As proposed.

### CR-020 · Sign out must exist in every shell, but the clinic shell has no profile screen — `RESOLVED`
- **Owner's answer (Gate 0).** Not answered at Gate 0; default stands.
- **Documents say.** Handoff checklist: "Sign out exists in every shell". Inventory: the clinic shell's screens are G1s, G2s, G3s, X0, X1 — no profile.
- **Proposal.** Sign out is a labelled control in the clinic shell's side navigation (bottom of the rail; a quiet Button in the app bar's action slot at phone width). No new screen.
- **Default.** As proposed.
- **Doc to update on approval.** Spec, one sentence under the clinic shell.

### CR-019 · L1's "real mockup of the Today screen" with no data-layer call — `RESOLVED`
- **Owner's answer (Gate 0).** Not answered at Gate 0; default stands.
- **Documents say.** L1 hero has "a real mockup of the Today screen"; L1 "makes no data-layer call"; G11: "every screenshot shown is a screen that exists"; required state: images unavailable.
- **Proposal.** The mockup is a static image exported from the built B1 (tracking-off, حمد, 2026-09-21) after bundle (c) passes its gate, stored under `public/`, with a full text alternative. Bundle (a) ships with a placeholder image of the right dimensions and swaps in the export at bundle (c)'s gate. No seed values live in L1's code.
- **Default.** As proposed.

### CR-026 · Correct the spec text of A3 and F4 so the Civil ID contradiction cannot return — `OPEN` (owner-requested)
- **Document says.** A3: "name, Civil ID (masked), …"; F4: "their own name and Civil ID (masked), …".
- **Why it is a problem.** CR-001 was decided the strict way; the sentences that caused the contradiction still stand.
- **Proposal.** A3: "name · a line stating the identity was verified through the simulated Hawiati flow · notification status …". F4: "their own name · the patient they are linked to and since when · …". Add to G9: "No Civil ID — the user's own included — is ever printed back to a reader, masked or whole."
- **Cost.** Three sentences in the spec.
- **If we don't.** A later revision re-introduces the row.
- **Doc to update.** `Acceptance Criteria and Test Plan.md` A3, F4, G9.

---

## Board-versus-spec disagreements (spec wins; recorded so the boards can be corrected)

### CR-010 · The audit log board shows what X1 and G9 forbid
- **Board `AuditLog1440`.** Actor and type columns render raw enums as pills (`adherence_agent`, `patient`, `dose_status_recorded`); the description column shows dose detail (`taken_on_time · Levothyroxine`); an "Export CSV" button; patient column with first names and a stray "حمد ← لا".
- **Spec.** G9: no role string ever shown. X1 data scope: "events, actors, timestamps and a patient reference — not medication lists, alert text or dose details". Read-only; no export named.
- **Build.** Actor and type render as human labels from the copy catalogue (with the filter values also labelled); the description shows the event's plain-language `message` (which by seed rule carries masked names and no Civil ID, and by X1's scope no clinical body); the patient reference is the patient's **masked name**; no export control. **Owner to confirm the masked-name choice for the patient reference** (alternative: first name only).
- **Owner's answer (Gate 0).** Masked name for the patient reference, as proposed. And the **G9 exception, stated and bounded:** the admin audit log (X1) is the **only** surface in the product where a literal `actor.role` or `AuditEvent.type` string may be displayed, because it is a forensic tool read by one role. Every other screen — the reviewer's included, and the patient's activity feed — shows human labels only. X1 shows the literal string beside its human label, never instead of it. `RESOLVED`.

### CR-009 · Reviewer boards show the patient's age; the contract has no such field
- Boards `ReviewerDesktop` / `ReviewerQueue` show "٧١ سنة". `Patient` has no age or date of birth. **Build:** no age. If the owner wants it, that is a contract addition (`dateOfBirth`) and a seed addition.
- **Owner (Gate 0).** Seed and spec win over any board, always; build from the seed and leave the board to the owner. `RESOLVED` as built-from-spec.


### CR-011 · The Settings board has a channel `Select` that E3's "exactly" list excludes
- Board `Settings` shows "قناة التواصل" (Telegram / WhatsApp / email). E3: "exactly: adherence tracking and its check-ins, refill alerts, calendar sync, and an optional contact phone". `notificationChannel` is set by connecting in E5. **Build:** no channel control on E3.
- **Owner (Gate 0).** Seed and spec win over any board, always; build from the seed and leave the board to the owner. `RESOLVED` as built-from-spec.


### CR-012 · Boards that break §13 or the seed on caregiver and messaging screens
- `Messaging`: not-connected rendered as `InlineNotice tone="warning"` — §13 says off is neutral. **Build:** `info` tone, gain-framed copy.
- `Settings`: the tracking toggle's description is deficiency-framed ("تقل دقة المتابعة"). **Build:** gain-framed, per §13, pending the copy deck.
- `CaregiverHome`: shows a `missed` pill on Metformin for حمد, who is untracked, and the surname "المصري". **Build:** حمد's caregiver view has no pills (as `CaregiverPlan` shows); the banner uses the patient's first name per §10 and F2.
- `Setup`: three steps; A2 specifies four (language → offer → optional caregiver invite → closing explainer). **Build:** four.
- **Owner (Gate 0).** Seed and spec win over any board, always; build from the seed and leave the board to the owner. `RESOLVED` as built-from-spec.


### CR-014 · Board values that differ from the seed — `RE-DERIVED at Gate 0b` (owner to correct the boards; the build follows the seed)
- **Owner's correction (Gate 0).** The first list (the brand "Ostocal", the surname, the `CaregiverHome` pills, the audit actor column) was fixed before Phase 0 closed. Re-derived here from `docs/wireframes/` and `docs/Seed Dataset.md` as they stand at Gate 0b (all 48 boards swept by a read-only subagent; every row below spot-checked by the lead with `sed -n` on the board file). **Nothing here changes what is built: seed and spec win; the boards are not edited in the repository.**
- **Reading the list.** Several boards are *state boards* that borrow حمد's cast for a state حمد is never in (tracking on, a missed dose, a reviewed alert, a connected chat). Under the owner's rule the build renders each state with the seed person who **is** in it (tracking on / late / missed / reviewed → سارة; empty day → فاطمة; first run → بدر) and never shows a status pill on حمد. Input fields on sign-in boards that echo the digits the user is typing are listed for completeness and are **not** printing a Civil ID back; the two profile rows are (CR-001, strict rule).

| Board · line | Board shows | Seed / spec says | Kind |
|---|---|---|---|
| `AlertDanger.dc.html:56`, `ReviewerDecision.dc.html:55` | `DrugBank · DB00682 — Warfarin / NSAID interaction, major severity` | `sourceCitation` is deliberately unwritten; an invented one is worse than a missing one. Build shows `[TO BE SUPPLIED]`. (`CaregiverDetail:72`, `ReviewerDesktop:82` carry the placeholder correctly.) | **invented value** |
| `AlertReviewed.dc.html:46,52–54` | `ia-001` as `reviewed`; reviewer `د. نورة العبدالله · صيدلة إكلينيكية`; 21 Sept 09:40; a note about stopping Ibuprofen | `ia-001` is `pending_medical_review`; the only reviewer is د. خالد; the only reviewed alert is `ia-002` (2026-09-08) with the Levothyroxine/Calcium note. Build renders C2-reviewed from `ia-002`. | invented person · state board |
| `Main.dc.html:49,56,59,66,71,74,82,84` · `TodayMissed.dc.html:56,59,64,67,69–71,78` | Today *with tracking* / *with a missed dose* on حمد: `٤ جرعات اليوم`, Warfarin at 08:00, Metformin at 14:00, pills `taken_on_time`/`taken_late`/`missed`, a Telegram line, a recompute notice | حمد has six doses (08 ×2 · 14 · 18 · 20 ×2), Warfarin 18:00, Metformin 08:00/20:00, `tracked:false`, chat `none`. The tracked, late, missed and recomputed states are **سارة's** (19–21 Sept). Build renders those states from سارة. | **status pill on untracked** · times · counts (state board) |
| `Medicines.dc.html:51–56` · `MedicinesDesktop.dc.html:55–62` | dose objects (`dOn`/`dUp`/`dLate`) on حمد's cards; Warfarin "اليوم ٨:٠٠ ص", Metformin "٢:٠٠ م"; a fourth active card `Amoxicillin (Amoxil) 500 mg` | no dose status reaches an untracked patient's card; times as above; حمد has exactly three active prescriptions; no Amoxicillin/Amoxil anywhere | pill on untracked · invented record · count |
| `MedicinesPast.dc.html:49–53` | past list: `Amoxicillin (Amoxil)`; `Prednisolone` brand `Deltacortril`, الفروانية, stopped 14 Sept, "الدكتور قال أوقف الدواء" | حمد's only past record is `rx-004` Atorvastatin (Lipitor) 20 mg, discontinued 2026-06-28, "الطبيب أوقف الدواء بسبب آلام العضلات"; Prednisolone is فاطمة's, active, مركز الصباح, no brand | **invented values** |
| `Prescription.dc.html:56–58,60,64–65,69–71` | Warfarin 08:00 · start 12 Sept · 30 days · note "راجع تحليل INR كل أسبوع" · dispensed 30 on 12 Sept · a dose history with pills | `rx-001`: 18:00 · 2026-09-01 · 90 days · no note · 90 tablets 2026-09-01 · حمد untracked, so B3's history has rows without pills (the pill variant is proven on سارة's `rx-008`) | value deviations · invented note · pills on untracked |
| `Refill.dc.html:50–51,59–60,65–67,91` | Warfarin 6/30 left, 6 days; Metformin 22/60, 22 days; "طلباتي": Warfarin requested 20 Sept, pending | `rx-001` 90 dispensed 2026-09-01 at 1/day → ≈70/90, ≈70 days; `rx-003` 60 dispensed 2026-09-01 at 2/day → ≈20/60, ≈10 days; the 20 Sept `requested` refill is **`rx-003` Metformin**; `rx-001`'s is older and `approved` (`AuditLog1440:80` has it right). Build computes from dispensing. | value deviations |
| `Settings.dc.html:45,50,51,54,79` | tracking toggle on, calendar on, channel `telegram` (the options offer no `none`) | حمد: tracking false, calendar false, channel `"none"`; `none` is the contract's default and must be an option (see CR-011) | value deviations |
| `More.dc.html:45–48` · `Profile.dc.html:54,57` | one refill pending; calendar on; Telegram connected; caregivers `١` | two refill rows (one `requested`, one `approved`); calendar off; `not_connected`; two `active` caregivers | counts · values |
| `Profile.dc.html:53` · `CaregiverProfile.dc.html:55–56` | `الرقم المدني: •••• •••• 0123`; `عبدالله المطيري` + `٢٨٥****٠٤١٢` | **No Civil ID is ever printed** (CR-001, strict); the row is dropped. His own name is `عبدالله محمد عبدالعزيز المطيري` in full (no masking on one's own profile). | **Civil ID printed** (also the wrong digits) |
| `Caregivers.dc.html:54–60` | five rows; the expired row has no relationship | seven rows on حمد: **طلال** (`revoked` after acceptance, `حفيدي`) and **دلال** (`revoked`, cancelled before any answer, `ابنة أخي`) are missing; the expired row's relationship is `قريب`. F1's wording for the two `revoked` kinds keys off `acceptedAt` (seed rule 1), never access. | **missing seed records** ×2 |
| `Activity.dc.html:46–47,50,58,62` | alert raised "today 09:02"; "Metformin schedule recomputed after a missed dose"; Telegram linked 20 Sept; Prednisolone stopped 14 Sept | `ia-001` raised 2026-09-19 11:04; `schedule_recomputed` is سارة's; حمد never connected; حمد's discontinued drug is Atorvastatin, 2026-06-28 | value deviations |
| `AuditLog.dc.html:62–67` · `AuditLog1440.dc.html:63,77–88` | filter "dose-status writes" but rows of other types and actors (`patient`, `caregiver`, `reviewer`) shown; notice says 5 results, 3 rendered; `caregiver_invite_declined` with actor pill `caregiver` for منى | filtered to `dose_status_recorded` the log shows exactly سارة's five rows, all `agent`/`system`; منى never held `caregiver` — the actor role WP1 records for a decline is listed in BACKEND-NOTES §2 as a CR-018 derivation for the owner to confirm | count · self-contradiction |
| `CaregiverHome.dc.html:68` | `PrescriptionCard … dose="{{dUp}}"` on حمد's card in عبدالله's view | the caregiver sees exactly what the patient sees — no pill (G10, UX §10) | pill on untracked |
| `CaregiverPlan.dc.html:57–88` · `Today834.dc.html:65–98` · `TodayLTR.dc.html:58–92` | "6 doses" but four rows rendered; the 20:00 group missing | six rows in four groups; 20:00 = Metformin + Ibuprofen | count |
| `TodayPlan.dc.html:62` | "حمد يطلب ربطك بملفه" on حمد's own Today | the pending-invitation-inside-a-patient-shell case is **سارة ← فاطمة**; B1 shows the notice only to سارة | wrong person (state board) |
| `Safety.dc.html:54–56,61–63` · `ReviewerQueue.dc.html:48,52,62–63,70–71` | alerts `Metformin + Prednisolone` (reviewed 15 Sept), `Amoxicillin + Warfarin` (auto-cleared 10 Sept); a queue of 3 with `سارة الفهد`; "waiting 4 hours"; field item `Amoxicillin` for حمد | the three alerts are `ia-001` (حمد, danger, pending), `ia-002` (سارة, warning, reviewed 8 Sept), `ia-003` (فاطمة, info, auto-cleared); the queue holds one; waiting ≈46 h (`ReviewerDesktop:68` "منذ يومين" is right); the field item is `rx-006`, فاطمة, unreadable handwritten | **invented values** · counts |
| `AddPrescription.dc.html:58–59` | extraction result `Amoxicillin 500 mg · ٣ مرات يوميًا` | no Amoxicillin in the seed; the flagged extraction is `rx-006` with strength and frequency unreadable. B4's outcomes are *simulated*: WP1 returns outcomes built from seed prescriptions, never a new drug | invented value |
| `DrugCheck.dc.html:53` | `الاسم التجاري: Nurofen` | Ibuprofen's brand is Brufen; C3's identified box comes from the seed's drugs | invented value (minor) |
| `Messaging.dc.html:54` | "مربوط · ٢٠ سبتمبر ٢٠٢٦" | no link dated 20 Sept; حمد `not_connected`; the connected state is سارة's (2026-08-11) | state board |
| `RoleChooser.dc.html:58` | `سارة العجمي` | `سارة يوسف العجمي` — one's own name is never shortened or masked | minor |
| `Login:49`, `ClinicEntry:56`, `InviteMasked:53`, `SignInStates:53` | a TextField whose `value` is a full Civil ID | the digits the user types are the input's own value, not the app printing an ID back. `SignInStates:53` uses `299999900000`, which is not on the test list — the `not_in_test_list` state, correct. | input echo — no action |
| every board's `renderVals()` (~20 files) | `rxLev: { strengthMg: 0.05, strengthDisplay: '50 mcg' }`; `rxPre.facilityName: 'مركز الصباح'` | `rx-008` is `strengthMg: 50, strengthUnit: "mcg"`, never `0.05` (the exact 1000× hazard the seed names); the facility is `مركز الصباح للأمراض الروماتيزمية`. Never displayed by a board, but a copy-paste trap. | shared block — flagged to every WP4 brief |

- **Clean boards (data-wise).** `ReviewerDesktop` (the reference board), `FieldQueue`, `InviteConsent`, `InviteStates`, `NotifyStates`, `CaregiverDetail`, `CaregiverHelp`, `Help`, `Setup`, `SessionGate`, `States`, `SystemPages`, `Landing`, `Landing1440`, `Calendar`; masked names are correct everywhere they appear.
- **Build rule for WP4.** Layout, component order and copy come from the board; every value comes from the seed through the data layer; a state the board demonstrates on the wrong person is rendered with the seed person who is in that state. Each WP4 brief cites this table for its boards.
- **Doc to update.** The boards — owner only.

### CR-028 · `ia-002.reviewedBy` and `rx-009.fieldReviewedBy` are given in the seed as a Civil ID — `DEFAULT TAKEN` (lead, Gate 0b)
- **Document says.** `Seed Dataset.md`: `ia-002` … "by `280012000961`, 2026-09-08". Contract: `reviewedBy?: string`. G9 / CR-001: no Civil ID leaves the seam or reaches a screen.
- **Why it is a problem.** A Civil ID stored in an alert record rides into `getAlert`, `getAlertForReview` and the caregiver's read of the alert.
- **Default.** WP1 stores both as د. خالد's `Account.id` (`acc-10`, D-005), and the seam returns view shapes with every `civilId` stripped (`Patient`, `Caregiver`, `Account` never cross it whole). The seed row is read as "the account holding that Civil ID".
- **Doc to update on approval.** `Seed Dataset.md`, one phrase each: "by د. خالد's account".

### CR-027 · `Caregiver` has no field for when access ended — `RESOLVED` (raised and approved by the owner at Gate 0b)
- **Document says.** `Caregiver` carries `invitedAt`, `expiresAt`, `acceptedAt`, `declinedAt`; `caregiver_revoked` and `caregiver_invite_cancelled` audit rows carry a timestamp the record itself cannot hold. `Seed Dataset.md` notes the gap rather than working around it.
- **Owner's decision.** Add `revokedAt?: string`; one field serves both kinds of withdrawal (after acceptance — طلال 2026-08-28; before any answer — دلال 2026-06-06). `acceptedAt` set/unset distinguishes them, for the audit log and F1's wording only, never for permissions.
- **Spec updated (v7.4):** `Caregiver.revokedAt` added to the Data Contracts. `Seed Dataset.md` already states the two dates; its sentence "until that field is approved" is the owner's to retire.
- **Build.** WP1 sets `revokedAt` on both `revoked` rows, `revokeCaregiver` and `cancelInvitation` both write it, and `seed-invariants.ts` asserts every `revoked` row carries it.

### CR-016 · Stale text in the design system — `RESOLVED`
- **Was.** The artifact's `TabBar/README.md` described five destinations.
- **Resolved.** The repository copy `docs/design-system/components/TabBar.md` was rewritten by the owner during Phase 0 to the G8 item sets (4 / 3 / 2, a table per shell, "built from the signed-in role's shell, never filtered down"). `Button.md` gained an explicit G1 note (no dose-status button in any variant). The repository copies under `docs/design-system/` and `docs/wireframes/` are therefore **newer than the published artifacts** and are the reference every brief cites; the artifacts are not read again.

---

## Standing rules from Gate 0

- **Owed values are loud placeholders.** The real `sourceCitation`, the bilingual copy deck and the real bot handle are the owner's (three items: the demo script is the owner's own deliverable and not a code artifact, so it is never counted or placeholdered — Gate 0b). Wherever one is needed the code carries the visible marker `[TO BE SUPPLIED]` (constant `TO_BE_SUPPLIED` in `lib/config.ts`); `scripts/guards/placeholders.ts` counts and lists every occurrence at every gate. Never an invented value, never a plausible-looking one.
- **Boards are never edited in the repository.** Seed and spec win; deviations are logged here; the owner corrects the boards.

## Architecture decisions taken in Phase 0 (approved at Gate 0)

### D-001 · `tokens.css` does not exist in the artifact; WP0 compiles it — approved at Gate 0
The artifact serves `tokens.json` and `bundle.css`; `bundle.css` reads `--navy`, `--space-3`, `--radius-md`, `--shadow-sm`, `--font-sans` and its own structural `--wsf-*` variables. WP0 generates `styles/tokens.css` from the repository copy `docs/design-system/tokens.json` (colour, spacing, radius, shadow custom properties, one utility class per type style, **and `--font-sans`**, the one variable `bundle.css` reads that neither file defines — `docs/design-system/README.md` now says so explicitly; the stack's first family name must stay `"IBM Plex Sans Arabic"` whether loaded from Google Fonts or self-hosted) with a script, so the token file remains the single source. Tailwind's theme maps to those custom properties; no hex, px size or px radius appears in `components/` or `app/`.

### D-002 (approved at Gate 0 with two conditions) · The data layer is a set of server actions over an in-memory mock store; the session is a cookie
`lib/session/api.ts` declares the 5 session signatures and `lib/data/api.ts` the 50 data-access signatures (SCREENS.md appendix). `lib/data/index.ts` and `lib/session/index.ts` (`'use server'`) implement them by delegating to `lib/data/mock/*`, which holds the seed transcription, the schedule generator output and the mutable in-memory state (accepting an invitation, requesting a refill, connecting a chat). The session is an httpOnly cookie carrying subject id, role and linked patient id, read by middleware and shell layouts. Screens — server or client components — call the data functions and nothing else; no component contains `fetch` or imports from `lib/data/mock`. Phase 2 replaces `lib/data/mock/*` behind the same `index.ts`. Mutations survive for the life of the dev server process only, which is within "no persistence beyond local/mock state". **Owner's conditions (Gate 0, approved):** the mock store is a module-level singleton with an explicit `reset()` used by the tests, and **no client component reads it** — every read crosses the seam as a server action. The store's volatility is acceptable; the shape of the seam is not negotiable. Dev-only fault injection (loading delay, error, offline, fixture states such as `onboardingCompleted:false`) is a cookie read **only inside the mock implementation**, so no screen branches on it.

### D-003 (approved at Gate 0) · Copy catalogue and BACKEND-NOTES are split per bundle to honour "two subagents never own the same file"
`i18n/copy/<bundle>.ts` per work package, merged by `i18n/index.ts` (owned by WP1); `docs/backend-notes/<bundle>.md` fragments per bundle, merged into `docs/BACKEND-NOTES.md` by the lead at each gate. Every catalogue key is marked `placeholder: true` until the owner's copy deck replaces it; Arabic placeholders start from the wireframe boards' text where it does not break §13, English is drafted by the build.

### D-004 (approved at Gate 0) · Multi-line reviewer input uses `TextField`
The reviewer's optional note and the return-to-clinic reason are single-line `TextField`s; the system has no textarea and none is invented. Reported as a minor gap, not a blocker.

### D-005 (lead decision, Gate 0b) · Record ids and the mock session cookie are deterministic conventions, never displayed
The seed fixes ids for prescriptions (`rx-001`…) and alerts (`ia-001`…) and none for people or the other records. Ids are technical identifiers (G9: never shown), so assigning them is a build convention, not a seed value; it is fixed here so tests, the e2e helper and the round-trip fixture agree: `Patient.id` `pt-01…pt-04` in cast order (حمد · فاطمة · سارة · بدر) · `Account.id` `acc-01…acc-11` in the seed table's order · `Caregiver.id` `cg-01…cg-08` in the seed table's order · `MessagingLink.id` `ml-01…ml-05`, `PushSubscription.id` `ps-01…ps-04`, `RefillRequest.id` `rf-01` (rx-003, requested) and `rf-02` (rx-001, approved), `CalendarSubscription` keyed by `pt-03` · `Dose.id` = `<prescriptionId>-<YYYYMMDD>-<HHmm>` (deterministic from the generator) · `AuditEvent.id` `ae-001…` in `createdAt` order. The mock session is the httpOnly cookie `jurah.session` holding URI-encoded JSON `{ subjectId, role, linkedPatientId?, pendingInvitationOnly? }` — never a Civil ID — written by `signIn`/`chooseRole`/`acceptInvitation`, read by `getSession`, `proxy.ts` and the shell layouts. `tests/e2e/helpers/session.ts` mints it for the role walks. Listed in BACKEND-NOTES §2 (a client-readable role is a mock shortcut the backend must refuse).
