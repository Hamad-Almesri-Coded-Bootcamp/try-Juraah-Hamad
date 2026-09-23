# P2-WP3a–d — Read paths · task brief (four subagents, one section each)

Read `docs/briefs/P2-common.md` first. Four subagents (Opus) in parallel after Gate 1; each owns exactly the functions and files of its own section. Depends on WP1's plumbing and on WP2's session helper for the integration tests (use the forged-session helper `tests/integration/setup.ts` exposes if WP2 has not landed; it sets the GUC directly).

Every read function: `withSession(session, sql => …)`; RLS does the refusing; map zero rows to the function's refusal literal in `lib/data/refusals.ts`; project through a literal in `lib/data/shapes.ts` in the mock's key order; compare against `tests/fixtures/shapes.json` as a string. Reads never write (E-48) — no `append()` in any read.

---

## WP3a — Prescriptions and doses (7 functions)

`getPrescriptions` · `getPrescription` · `getDosesForDay` · `getDoseHistory` · `getRecentDoses` (CR-046: served, no caller) · `submitPrescriptionImage` · `savePrescriptionDraft`.

Files: `lib/data/pg/reads-rx.ts`, `lib/data/refusals/reads-rx.ts`, `lib/data/shapes/reads-rx.ts` (yours — the barrels already re-export them), `tests/integration/enforcement/read-rx.test.ts` (E-41, E-49, the wrong-patient rows of E-21 for these functions), `tests/integration/roundtrip/rx.test.ts` (string-equal against `shapes.json` for each function under the seeded session), `docs/backend-notes/p2-wp3a.md`.

Specifics: `getDosesForDay` groups by the Kuwait calendar date (`(scheduled_at at time zone 'Asia/Kuwait')::date`) and orders `scheduled_at, id`; the `DoseWithPrescription` literal keeps the dose's keys then `drug`, `dosePerAdministration`, with `strengthUnit` **present only when stored** (rx-008) — check the bytes. `submitPrescriptionImage` is the CR-049 deterministic provider (0 bytes → unreadable · <100 → needs_review · else confident, the same drafts as the mock, `startDate: REFERENCE_DATE`), storing the image bytes and the draft in `prescription_drafts`. `savePrescriptionDraft`: draft must belong to `S.patient` (D-014 — refuse with the mock's shape for a missing session, recorded as D-3 in the divergence log: check what `mock-impl` returns for a non-owning caller and reproduce **that**, since the mock's own no-draft branch fabricates a record — you must **not** fabricate; document the chosen refusal shape), insert the prescription with CR-042's source, generate doses via `lib/schedule/generate.ts` with `tracked` from the patient's settings (default false when no row), delete the draft, `append('prescription_added')`, all in one transaction.

## WP3b — Alerts and review reads (6 functions)

`getAlerts` · `getAlert` · `checkDrugPhoto` · `getReviewQueue` · `getFieldConfirmationQueue` · `getAlertForReview` · `getFlaggedPrescription`.

Files: `lib/data/pg/reads-clinic.ts`, `lib/data/refusals/reads-clinic.ts`, `lib/data/shapes/reads-clinic.ts`, `tests/integration/enforcement/read-clinic.test.ts` (E-28, E-32, E-35 read half, E-36 read half, E-48), `tests/integration/roundtrip/clinic.test.ts`, `docs/backend-notes/p2-wp3b.md`.

Specifics: `getAlertForReview` returns the empty view unless `review_status = 'pending_medical_review'` **and** the reviewer's queue membership holds (D-014; divergence D-4); `waitedMinutes` from `jurah_now()`; `getFieldConfirmationQueue` derives `uncertainFields` from null columns excluding `brandName`, `hasSourceImage` from `prescription_drafts.image is not null` **or** true for seed rows `rx-006`/`rx-007` (the mock hard-codes `true` — match the bytes, record the rule in the divergence log); `checkDrugPhoto` is the CR-049 provider (first active prescription in `seq` order; danger alert lookup), read-only.

## WP3c — Refills and calendar reads (3 functions)

`getRefillOverview` · `getRefillRequests` · `getCalendarSubscription`.

Files: `lib/data/pg/reads-supply.ts`, `lib/data/refusals/reads-supply.ts`, `lib/data/shapes/reads-supply.ts`, `tests/integration/enforcement/read-supply.test.ts` (E-21 rows for these; the CR-040 inclusive behaviour asserted and flagged), `tests/integration/roundtrip/supply.test.ts`, `docs/backend-notes/p2-wp3c.md`.

Specifics: `getRefillOverview` calls `computeDepletion` from `lib/schedule/depletion.ts` **unedited** (it reads `REFERENCE_DATE`); `routedTo` derived in SQL from `sector`; flagged prescriptions included (CR-040 open). `getCalendarSubscription` is patient-self only (a caregiver gets `null`, as the mock).

## WP3d — Activity, audit, settings, patient, caregivers and notifications reads (11 functions)

`getPatient` and `getSettings` (WP1 built them — you own them from now; extend the tests) · `getActivity` · `getAuditLog` · `getCaregivers` · `getPendingInvitationsForSubject` · `getInvitationForConsent` (WP1 built it — yours now; the Postgres round trip calls it as سارة, D-024) · `getCaregiverLink` · `getPushCapability` · `getPushState` · `getMessagingLink` · `readLastKnownSnapshot`.

Files: `lib/data/pg/reads-ambient.ts`, `lib/data/refusals/reads-ambient.ts`, `lib/data/shapes/reads-ambient.ts` (WP1's four real functions already live there), `tests/integration/enforcement/read-ambient.test.ts` (E-23, E-24, E-31, E-35 audit half, E-40, the remaining E-21 rows, E-22 read half), `tests/integration/roundtrip/ambient.test.ts`, `docs/backend-notes/p2-wp3d.md`.

Specifics: `getAuditLog` reads the `audit_log_admin` view (CR-047) — never `patients` — and appends `patientMaskedName` **last** in the literal, only when present; `getActivity` orders `created_at desc, seq desc`; `getSettings` for a missing row returns `{...DEFAULT_SETTINGS, patientId}` with `patientId` **last** and writes nothing (prove with a count before/after); `getMessagingLink` = most recent row (`seq desc`), `chatId` never projected, `linkToken` projected only while `pending` (CR-048), none → the `ml-default` shape; `getPushState` never projects `endpoint`/`p256dh`/`auth`; `getCaregivers` orders by `seq`; `readLastKnownSnapshot` is per subject (D-014, D-5) and `getPatient` writes the snapshot as a serialised copy; `getCaregiverLink` returns the empty-strings shape unless the session is that active caregiver.

---

## ACCEPTANCE — Gate 3 (each section separately)

Paste: your round-trip test output (string-equal per function against `shapes.json`) · your enforcement rows by id · `npm run verify` exit 0 in mock · `npm run guards` · the frozen-set diff empty · every divergence appended. If `JURAH_DATABASE_URL` is still absent, the loud NOT-A-PASS output plus the same proofs by hand through MCP `execute_sql` — for the round trip, run the projection SQL through MCP and compare in TypeScript against `shapes.json`, pasting both strings on a mismatch.
