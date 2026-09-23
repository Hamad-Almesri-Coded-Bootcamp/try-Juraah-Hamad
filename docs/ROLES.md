# Jur'ah (جرعة) — Roles, access and Civil ID resolution

**Status:** approved at Gate 0; seed values landed at Gate 0b (twelve people). The role model is owned by `Acceptance Criteria and Test Plan.md`; this file restates it operationally for the build and adds the resolution rules the session module implements.

## The four roles

| Role | How it is obtained | Shell | Reads | Writes | Routes reachable |
|---|---|---|---|---|---|
| `patient` | A `Patient` record exists for the Civil ID | patient · 4 tabs (Today · My Medicines · Safety · More) | own Patient, Settings, Prescriptions, Doses, Alerts, RefillRequests, CalendarSubscription, own MessagingLink and PushSubscription, own Caregiver records (all states), patient-scoped AuditEvents, own pending invitations (summary only) | `Settings` (permitted keys only), own phone, refill requests, prescription intake (image → extraction → confirm, never hand-typed clinical fields), own MessagingLink and PushSubscription, caregiver invitations (create, cancel, revoke), `onboardingCompleted`. **Never a `Dose.status`.** | `/[locale]/app/**`, `/[locale]/invitation` (to answer a notice), `/[locale]/gate`, `/[locale]/signin/choose` (if dual-role) |
| `caregiver` | A `Caregiver` record with **`status: "active"`** for the Civil ID. Nothing else counts — not `pending`, not `declined`, not `expired`, not `revoked`. | caregiver · 3 tabs (Today · Medicines · More) + persistent whose-data banner | the linked patient's Prescriptions, Doses (exactly as the patient sees them, incl. no statuses when tracking is off), Alerts, patient-scoped AuditEvents, the patient's first name; own Caregiver record, own MessagingLink and PushSubscription | only their own: MessagingLink (alerts only), PushSubscription, accept/decline of their own invitation, self-unlink. **Nothing on the patient's behalf. Nothing on any Dose.** | `/[locale]/care/**`, `/[locale]/gate`, `/[locale]/signin/choose` (if dual-role) |
| `reviewer` | `Account.roles` contains `reviewer` | clinic · 2 tabs (Review · Audit), labelled simulated | `InteractionAlert`s that are `pending_medical_review` (queue) and, for a patient **with an item in one of the two queues**, that patient's active prescriptions and recent dose history (read-only context); flagged prescriptions (`needsReview`) with source image | the five review fields on an alert (`reviewStatus`, `reviewerDecision`, `reviewerNote`, `reviewedAt`, `reviewedBy`); the field-confirmation fields on a flagged prescription (`fieldReviewStatus`, `fieldReviewedBy`, `fieldReviewedAt`, `fieldReviewNote`) and the corrected clinical values **only** inside that audited operation. **Nothing on any Dose.** | `/[locale]/clinic`, `/[locale]/clinic/review/**`; `/[locale]/clinic/audit` is **not** reachable unless the same ID also holds `admin` |
| `admin` | `Account.roles` contains `admin` | clinic · 2 tabs, labelled simulated | `AuditEvent` **metadata only**: type, time, actor label, patient reference (masked name). No medication list, alert text, dose detail, prescription, or patient screen. | nothing — may not create, accept, cancel or revoke an invitation, may not touch any clinical record | `/[locale]/clinic`, `/[locale]/clinic/audit`; `/[locale]/clinic/review/**` is **not** reachable unless the same ID also holds `reviewer` |

Rules that hold across all four: the language switch is available in every shell's app bar and on the landing page · sign out exists in every shell (A3, F4, the clinic side navigation — see DECISIONS CR-020) and returns to L1 with no way back · no shell renders a control that writes `Dose.status` · no shell renders a technical identifier or a Civil ID (see CR-001) · no notification carries a clinical action.

## What is not a role

- **A pending invitation.** A Civil ID whose only claim is a `Caregiver` row with `status: "pending"` has **no role**. Its session carries `pendingInvitationOnly: true` and can reach exactly one route, `/[locale]/invitation`, which shows the consent summary (`patientFirstName`, `relationship`, `status`, `expiresAt`) and nothing else. Every other route redirects there. Signing in changes nothing about the invitation. Only `acceptInvitation` on F0 creates the `caregiver` role; `declineInvitation` leaves a `declined` row that can never be accepted later.
- **A declined, expired, revoked or cancelled invitation.** Grants nothing, forever. The Civil ID is treated as having no claim from it.
- **An account.** Having a Jur'ah account (an `Account` row) is not a role. It only means a masked name can be shown to a patient who invites that Civil ID — and nothing in the interface ever reveals whether an account exists.

## How a Civil ID resolves

`signIn(civilId)` in the session module runs these steps, in order, against the mock store (Phase 2 runs the same steps server-side):

1. **Shape.** Twelve digits, else the field error (input kept). This is format validation only.
2. **Test list.** The ID must be one of the **twelve** Civil IDs in `Seed Dataset.md` (the eleven `Account` rows plus `277091900873`, which has no account). Any other value → `not_in_test_list`, with the spec's plain error ("this number is not in the demo list for this version"), input kept. This is the **only** rejection A1 makes, and it reveals nothing about accounts because every account-holding ID in the demo is on the list by construction.
3. **Collect claims** for the ID: `patient` if a `Patient` row exists · `caregiver` once per `Caregiver` row with `status: "active"` (each carries its `linkedPatientId`) · `reviewer` / `admin` from `Account.roles` (Gate 0 decision 7) · `pendingInvitations` = `Caregiver` rows with `status: "pending"` whose `expiresAt` is after `REFERENCE_NOW` (a stale pending row is treated as expired at read time and never offered for acceptance).
4. **Decide the outcome:**
   - no role and no pending invitation → `no_claims`. A1 shows the invitation-path message. **The wording is identical whether or not the ID has an account.**
   - no role, one or more pending invitations → `pending_invitation_only`. Session `{ pendingInvitationOnly: true }`. A0 routes to F0 and nowhere else.
   - exactly one role → `single_role`. Session created; A0 routes to that shell's home (or to A2 first when the patient's `onboardingCompleted` is `false`). Any pending invitation is **not** a role: it appears as the quiet notice on B1 / More.
   - two or more roles → `multiple_roles`. A1b (patient/caregiver) or X0's chooser (reviewer/admin) is shown; the last choice is remembered as the default; each shell offers the in-shell switch from More, which calls `chooseRole` and **never signs out**.
5. **Hawiati simulation.** Steps 2–4 decide the destination; the countdown then runs, and only on "approved" is the session cookie written. A lapsed countdown is retryable and writes nothing.

The clinic entry (X0) runs the same function; a Civil ID that resolves to `patient` or `caregiver` only, or to `no_claims`, is refused there with the same neutral wording as A1's `no_claims` state — it is never told "wrong number".

## The seed, resolved

| Civil ID | Person | Claims found | Outcome | Lands on |
|---|---|---|---|---|
| `255031200187` | حمد سالم المطيري | patient | `single_role` | B1 Today, tracking off (the default state) |
| `258071100342` | فاطمة سالم العجمي | patient | `single_role` | B1 Today — empty day on 2026-09-21 (alternate-day rx-005) |
| `290022500654` | سارة يوسف العجمي | patient **+** caregiver (active, for حمد) **+** a pending invitation from فاطمة | `multiple_roles` | A1b chooser → either shell; the pending invitation is the quiet notice in her patient shell → F0 without signing out |
| `285061400412` | عبدالله محمد عبدالعزيز المطيري | caregiver (active, for حمد) | `single_role` | F2 caregiver Today under the banner |
| `288110300229` | ناصر حمد المطيري | pending invitation only (expires 2026-10-02) | `pending_invitation_only` | **F0 and nothing else** |
| `292043000517` | منى خالد المطيري | none (her invitation is `declined`) | `no_claims` | A1's invitation-path message |
| `277091900873` | *(no account)* | none (its invitation is `expired`) | `no_claims` | A1's invitation-path message — **byte-identical to منى's** |
| `280012000961` | د. خالد عبدالرحمن الرشيد | reviewer **+** admin (Gate 0 decision 5) | `multiple_roles` (clinic) | X0's chooser → either clinic destination; the in-shell switch moves between them |
| `293080700148` | م. دانة فهد السالم | admin | `single_role` (clinic) | X1 audit log; `/clinic/review` unreachable |
| `268110500413` | بدر فهد العنزي | patient (`onboardingCompleted: false`, no Settings/MessagingLink/PushSubscription row) | `single_role` | A2 first-run setup, then B1 empty day and B2 empty; every settings/link/push read returns the documented defaults without writing a row |
| `298052000731` | طلال عبدالله المطيري | none (his `Caregiver` row is `revoked`, `acceptedAt` set — access withdrawn after acceptance) | `no_claims` | A1's invitation-path message — identical wording |
| `285092200664` | دلال عبدالرحمن المطيري | none (her `Caregiver` row is `revoked`, `acceptedAt` unset — cancelled before any answer) | `no_claims` | A1's invitation-path message — identical wording |
| any other 12 digits | — | — | `not_in_test_list` | stays on A1 with the field error |

With the Gate 0 decisions, every screen is reachable from a seeded sign-in: د. خالد exercises X0's chooser and بدر exercises A2. The test list is therefore **twelve** Civil IDs. Four accounts (ناصر, منى, طلال, دلال) sign in successfully and hold no role: `roles: []` is a passing state the product holds calmly, never an error. **The `revoked` distinction (acceptedAt set or unset) is never read by any access decision** — both rows resolve to `no_claims` by the same branch.

**Two demo patients outside the seed (D-041).** Production also accepts `294061800352` (هيثم حمد العجمي, `pt-05`) and `297112300461` (حمد المسري, `pt-06`). Each resolves to `single_role` patient and starts like بدر: A2 first-run setup, then an empty day and an empty medicine list. They are not part of the seed's twelve and the mock store does not hold them. They are listed in `lib/data/mock/demo-patients.ts`, and `scripts/db/add-demo-patients.ts` adds their rows.

## Enforcement in Phase 1, and what it is not

Phase 1 has no server. Every rule above is enforced in three places that Phase 2 will replace with real refusals:

1. **Middleware** on `/[locale]/app`, `/care`, `/clinic`, `/invitation`, `/gate`: reads the mock session cookie and redirects a session that lacks the route's role (a pending-only session to `/invitation`; no session to `/signin`).
2. **Shell layouts**: re-check the role and render nothing for the wrong one (no flash of the wrong shell).
3. **The mock data layer**: every patient-scoped function takes the session into account and returns nothing for a session that is not the patient, the patient's active caregiver, or a reviewer with a queue item for that patient. `getInvitationForConsent` returns only the five summary fields. `updateSettings` accepts only the permitted keys.

None of this is security; it models the shape of the server-side checks. Every such rule is listed in `BACKEND-NOTES.md` §3 as an absence the backend must turn into a refusal.
