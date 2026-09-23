# Jur'ah (جرعة) — Phase 2 API Surface

**This table is the contract between the two phases.** Nothing on it may change shape, and nothing may be added that no screen calls. Every function below is verbatim from `lib/session/api.ts` (5) and `lib/data/api.ts` (50) — the same 55 `docs/BACKEND-NOTES.md` §1 lists. The **Serves it** column names the query or transaction behind the function; **Roles** are the sessions the database lets through (everything else gets the mock's refusal shape, D-022, and the row in `ENFORCEMENT.md`); **Tables** are what it touches; **Audit** is the `AuditEvent.type` the backend writes, or `—`.

Conventions used in every row:
- `S` = the verified session set by `withSession()` into `jurah.session` (D-017). `S.patient` = a patient session for that patient; `S.cg(active)` = a caregiver session whose row is `active` and linked to that patient; `S.reviewer(queue)` = a reviewer with an item in one of the two queues for that patient; `S.self` = the subject named in the argument.
- "RLS" means the row filter does the refusing and the seam sees zero rows; "guard" means a trigger raises and the seam maps the error to the refusal shape.
- Timestamps come back through `iso_kw()` → `YYYY-MM-DDTHH:mm:ss+03:00`; dates through `to_char(d, 'YYYY-MM-DD')`.

---

## A. The seam — 55 server functions (unchanged signatures)

### Session module (`lib/session/api.ts`) — 5

| Function | Serves it | Roles | Tables | Audit |
|---|---|---|---|---|
| `signIn(civilId)` | Test-list membership (constant list, no table); then one query collecting claims: `patients` by civil id · `caregivers` where `status='active'` · `accounts.assigned_roles` · `caregivers` where `status='pending' and expires_at > now`; outcome decided as `docs/ROLES.md` steps 3–4; on `single_role`/`multiple_roles`/`pending_invitation_only` insert into `sessions` and set the signed cookie (D-018). Both `no_claims` branches run the identical query plan and write no session. `multiple_roles` defaults to `accounts.last_chosen_role` when set. | none (this **is** the sign-in) | `accounts`, `patients`, `caregivers`, `sessions` | `signed_in` (single_role only, as the mock) |
| `getSession()` | Verify cookie signature; `select … from sessions where id = sid and revoked_at is null and expires_at > now`. | any | `sessions` | — |
| `getRoleOptions()` | Civil id resolved server-side from `S` (`civil_id_for_session()`), then the same claims query as `signIn`. | any signed-in | `accounts`, `patients`, `caregivers` | — |
| `chooseRole(option)` | Verify `option` is one of the caller's own current options (never trust the body); update `sessions` row's subject/role/linked patient; `accounts.last_chosen_role = option.role`; re-sign cookie. | any signed-in whose civil id holds that role | `sessions`, `accounts` | — |
| `signOut()` | `update sessions set revoked_at = now where id = sid`; clear cookie. | any signed-in | `sessions` | `signed_out` |

### Patient and settings — 5

| Function | Serves it | Roles | Tables | Audit |
|---|---|---|---|---|
| `getPatient(patientId)` | `select` from `patients` (RLS `can_read_patient`); Civil ID never selected; `caregiverIds` = `array_agg(caregivers.id order by seq)`; snapshot written to `snapshots` keyed `(S.subject, 'getPatient:<id>')`. | `S.patient`, `S.cg(active)`, `S.reviewer(queue)` | `patients`, `caregivers`, `snapshots` | — |
| `updatePatientPhone(patientId, phone)` | `update patients set phone` (RLS: own row only). | `S.patient` | `patients` | — (CR-045) |
| `completeOnboarding(patientId)` | `update patients set onboarding_completed = true` (RLS: own row). | `S.patient` | `patients` | — (CR-045) |
| `getSettings(patientId)` | `select` from `settings`; **no row → the documented defaults, no write** (بدر). | `S.patient`, `S.cg(active)`, `S.reviewer(queue)`; others get defaults | `settings` | — |
| `updateSettings(patientId, patch)` | Guard `settings_permitted_keys` — the seam whitelists the seven keys and the trigger `settings_tracking_requires_link` refuses `adherence_check_in_enabled = true` unless `messaging_links` has a `connected` row for the patient (G10: dropped silently, as the mock); upsert. | `S.patient` | `settings`, `messaging_links` | `tracking_enabled` / `tracking_disabled` when the flag flips |

### Prescriptions and doses — 7

| Function | Serves it | Roles | Tables | Audit |
|---|---|---|---|---|
| `getPrescriptions(patientId)` | `select … order by seq` (RLS). | `S.patient`, `S.cg(active)`, `S.reviewer(queue)` | `prescriptions` | — |
| `getPrescription(prescriptionId)` | `select` by id (RLS on the owning patient); missing and forbidden are the same `null`. | same | `prescriptions` | — |
| `getDosesForDay(patientId, isoDate)` | `select doses join prescriptions where patient_id and scheduled_at::date at Kuwait = isoDate order by scheduled_at, id`; projected to `DoseWithPrescription` in SQL. | same | `doses`, `prescriptions` | — |
| `getDoseHistory(prescriptionId)` | `select doses where prescription_id order by scheduled_at` (RLS via prescription). | same | `doses`, `prescriptions` | — |
| `getRecentDoses(patientId, days)` | Doses whose Kuwait date is within `[REFERENCE_DATE − days, REFERENCE_DATE]`, ordered. **No screen calls this (CR-046); served because the seam is fixed.** | same | `doses`, `prescriptions` | — |
| `submitPrescriptionImage(patientId, image)` | Store the image bytes and the outcome in `prescription_drafts` (CR-049: the deterministic byte-size provider, labelled simulated, until the agents track's extraction lands through WP7). | `S.patient` | `prescription_drafts` | — |
| `savePrescriptionDraft(patientId, draftId)` | Transaction: draft must belong to `S.patient` (**D-014 — refused otherwise; the mock substitutes a placeholder**); insert `prescriptions` (CR-042 source); insert generated `doses` with `tracked` from the patient's settings; delete draft. | `S.patient` | `prescription_drafts`, `prescriptions`, `doses`, `settings` | `prescription_added` |

### Safety — 3

| Function | Serves it | Roles | Tables | Audit |
|---|---|---|---|---|
| `getAlerts(patientId)` | `select … order by severity rank, created_at desc` (RLS). | `S.patient`, `S.cg(active)`, `S.reviewer(queue)` | `interaction_alerts` | — |
| `getAlert(alertId)` | `select` by id (RLS via patient); a read never writes (trigger-free path, asserted by test). | same | `interaction_alerts` | — |
| `checkDrugPhoto(patientId, image)` | CR-049 provider: identifies against the patient's first active prescription, then the same screening query (`interaction_alerts` where `severity='danger'` and the prescription is involved). Read-only; nothing stored. | `S.patient` | `prescriptions`, `interaction_alerts` | — |

### Supply — 3

| Function | Serves it | Roles | Tables | Audit |
|---|---|---|---|---|
| `getRefillOverview(patientId)` | Active prescriptions (RLS) → `computeDepletion` (unedited `lib/schedule/depletion.ts`) → `routedTo` derived from `sector` in SQL. CR-040 open: flagged prescriptions are **included**, as the mock. | `S.patient`, `S.cg(active)`, `S.reviewer(queue)` | `prescriptions` | — |
| `requestRefill(patientId, prescriptionId)` | Insert `refill_requests`; trigger `refill_routing` sets `routed_to` from the prescription's own sector and **raises** if the prescription is not the patient's or not `active` (**D-014**). | `S.patient` | `refill_requests`, `prescriptions` | `refill_requested` |
| `getRefillRequests(patientId)` | `select … order by seq` (RLS). | same as overview | `refill_requests` | — |

### Calendar — 2

| Function | Serves it | Roles | Tables | Audit |
|---|---|---|---|---|
| `getCalendarSubscription(patientId)` | `select` own row (RLS: patient only — the mock gives a caregiver `null`, kept). | `S.patient` | `calendar_subscriptions` | — |
| `enableCalendarSync(patientId)` | Idempotent: insert on first call with a server-generated random token and `ics_url = <APP_ORIGIN as webcal>/api/calendar/<token>.ics`; set `settings.calendar_sync_enabled = true`. | `S.patient` | `calendar_subscriptions`, `settings` | — (CR-045) |

### Activity — 1

| Function | Serves it | Roles | Tables | Audit |
|---|---|---|---|---|
| `getActivity(patientId)` | `select from audit_events where scope='patient' and patient_id order by created_at desc, seq asc` (RLS: patient-scoped events readable by the patient and their active caregiver). | `S.patient`, `S.cg(active)`, `S.reviewer(queue)` | `audit_events` | — |

### Notifications — 9

| Function | Serves it | Roles | Tables | Audit |
|---|---|---|---|---|
| `getPushCapability()` | Constant `{ supported: true, iosNeedsInstall: false }` — real detection is client-side and the frontend is frozen. | any | — | — |
| `getPushState(subject)` | `select` own row; endpoint/keys never projected. | `S.self` | `push_subscriptions` | — |
| `requestPushPermission(subject)` | Upsert own row to `status='active', permission='granted'` (the row the real browser subscription then attaches to via `POST /api/push/subscription`, §B). | `S.self` | `push_subscriptions` | `push_enabled` (patient only, as the mock) |
| `disablePush(subject)` | `update … set status='revoked'`; the endpoint is deleted server-side. | `S.self` | `push_subscriptions` | `push_disabled` (patient only) |
| `sendTestNotification(subject)` | Send one payload `{title, body, url}` — **no `actions`** — to the subject's active endpoint via VAPID; no-op when none. | `S.self` | `push_subscriptions` | — |
| `getMessagingLink(subject)` | Most recently created row for the subject; none → the `ml-default`/`not_connected` shape (never null, G10). `chat_id` never projected; `linkToken` projected only while `pending` (CR-048). | `S.self` | `messaging_links` | — |
| `startMessagingLink(subject)` | Guard: a caregiver subject must be `active`; insert `pending` row with a random 32-byte single-use token, `expires_at = now + 15 min`. Confirmation comes only from the webhook (§B). | `S.self` | `messaging_links`, `caregivers` | — (the webhook writes `messaging_connected`) |
| `disconnectMessaging(subject)` | `update` latest row to `not_connected`, clear `chat_id`/`link_token`; for a patient also `settings.adherence_check_in_enabled = false` when it was on. **Touches no `doses` row.** | `S.self` | `messaging_links`, `settings` | `messaging_disconnected`; `tracking_disabled` (actor `system`) when the flag flips |
| `sendTestMessage(subject)` | Send one message through the bot to the subject's `chat_id` when `connected`; no-op otherwise (while the bot is `[TO BE SUPPLIED]`, always a no-op, labelled). | `S.self` | `messaging_links` | — (CR-045) |

### Caregivers, patient side — 5

| Function | Serves it | Roles | Tables | Audit |
|---|---|---|---|---|
| `getCaregivers(patientId)` | `select … where linked_patient_id order by seq`, Civil ID never selected. | `S.patient` | `caregivers` | — |
| `lookupMaskedName(civilId)` | **Session required.** Insert `lookup_audit(session_id, subject_id, at)`; refuse when > 10 rows in the last 60 s for this session (**rate limit — same response shape as "no name", CR-043**); `select mask_name(name) from accounts where civil_id = $1` — the two branches share one query plan and one constant-time response path; `{ maskedName: string \| null }`. | any signed-in role | `accounts`, `lookup_audit` | — (server-side table) |
| `inviteCaregiver(patientId, input)` | Insert `caregivers` with `status='pending'`, `invited_at = now`, `expires_at = now + 14 d`, `access_level='read_only'`, opaque id; returns the row minus `civilId`. **Grants nothing.** | `S.patient` | `caregivers` | `caregiver_invited` (masked name in the message, or the neutral wording when no account) |
| `cancelInvitation(caregiverId)` | Guard `caregiver_transitions`: `pending → revoked`, `revoked_at = now`, `accepted_at` stays null (CR-027); only the linked patient's session. | `S.patient` (owner of the row) | `caregivers` | `caregiver_invite_cancelled` |
| `revokeCaregiver(caregiverId)` | Guard: `active → revoked`, `revoked_at = now`; the caregiver's sessions revoked. | `S.patient` (owner) | `caregivers`, `sessions` | `caregiver_revoked` |

### Consent, invited side — 4

| Function | Serves it | Roles | Tables | Audit |
|---|---|---|---|---|
| `getPendingInvitationsForSubject()` | Pending-only session: its one row if still `pending` and unexpired; a role session: `caregivers where civil_id = civil_id_for_session(S) and status='pending' and expires_at > now`; projected to the five-key `InvitationSummary`. | any signed-in | `caregivers`, `patients` | — |
| `getInvitationForConsent(invitationId)` | Five keys and nothing else; `status` folds read-time expiry (`expired` when `expires_at <= now`); **session must be the invited Civil ID's** (the mock has no session check — tightened, see `ENFORCEMENT.md` E-24). Unknown or foreign id → the mock's `expired` placeholder shape. | pending-only session for that row, or a role session whose civil id matches | `caregivers`, `patients` | — |
| `acceptInvitation(invitationId)` | Guard `caregiver_transitions`: `pending → active` **only** when `jurah.session`'s civil id equals the row's `civil_id` and `expires_at > now`; sets `accepted_at`; then a new `sessions` row `{caregiver, linkedPatientId}` and cookie. **The only path to `active` in the whole system** (no other function, job, migration or admin action may perform this transition — the trigger refuses it for every other caller). | the invited Civil ID's own session | `caregivers`, `sessions` | `caregiver_invite_accepted`; raises the patient's in-app notice (E2 row) |
| `declineInvitation(invitationId)` | Guard: `pending → declined`, `declined_at = now`, same caller rule; a pending-only session is revoked afterwards (the mock clears the cookie). | same | `caregivers`, `sessions` | `caregiver_invite_declined` |

### Caregiver shell — 2

| Function | Serves it | Roles | Tables | Audit |
|---|---|---|---|---|
| `getCaregiverLink(caregiverId)` | Own row only, `active`: `{ patientId, patientFirstName, acceptedAt }`; anything else the mock's empty-strings shape. | `S.cg(active)` = that row | `caregivers`, `patients` | — |
| `selfUnlink(caregiverId)` | Guard: `active → revoked` by the caregiver's own session; `revoked_at = now`; own sessions revoked. | `S.cg(active)` = that row | `caregivers`, `sessions` | `caregiver_self_unlinked` |

### Clinic — 8

| Function | Serves it | Roles | Tables | Audit |
|---|---|---|---|---|
| `getReviewQueue()` | `select … where review_status='pending_medical_review' order by severity rank, created_at`, joined to `patients.name` (first token) and `prescriptions.generic_name`; `waitedMinutes` computed in SQL from `REFERENCE_NOW` (passed in). | `S.reviewer` | `interaction_alerts`, `patients`, `prescriptions` | — |
| `getFieldConfirmationQueue()` | `(needs_review and field_review_status='pending') or field_review_status='returned'`; `uncertainFields` derived from null columns (never `brandName`, as the mock); `hasSourceImage` from `prescription_drafts.image is not null` (CR-050). | `S.reviewer` | `prescriptions`, `patients`, `prescription_drafts` | — |
| `getAlertForReview(alertId)` | **Only** when `review_status='pending_medical_review'` (**D-014 — the mock returns سارة's context for the reviewed `ia-002`; the backend returns the empty view**); alert + involved prescriptions + `PatientContext` (active prescriptions, 14-day doses, `trackingOn`). | `S.reviewer(queue)` | `interaction_alerts`, `prescriptions`, `doses`, `settings` | — |
| `submitReviewDecision(alertId, decision, note)` | Guard `alert_review_once`: the five review fields writable only while `pending_medical_review`; a second call **raises** (the mock overwrites — tightened); `reviewed_by = S.subjectId` (Account id, CR-028). | `S.reviewer` | `interaction_alerts` | `alert_reviewed` |
| `getFlaggedPrescription(prescriptionId)` | `select … where id and needs_review`. | `S.reviewer` | `prescriptions` | — |
| `confirmPrescriptionFields(prescriptionId, values, note)` | Transaction: **only** `drug.brandName`, `drug.strengthMg`, `frequencyPerDay`, `startDate`, `doseTimes` accepted from `values` (the seam whitelists; the guard `prescription_clinical_fields_locked` raises on any other clinical column change outside this path); set `needs_review=false`, `field_review_status='confirmed'`, reviewer fields; delete the prescription's `upcoming` doses and regenerate — atomically. Refused if not `pending`. | `S.reviewer` | `prescriptions`, `doses`, `settings` | `prescription_field_confirmed` |
| `returnPrescriptionToClinic(prescriptionId, reason)` | `field_review_status='returned'`, note, reviewer fields; refused if not `pending` (one-shot). | `S.reviewer` | `prescriptions` | `prescription_returned_to_clinic` |
| `getAuditLog(filters)` | `select` from the view `audit_log_admin` (`SECURITY DEFINER`, CR-047): every `AuditEvent` column plus `patient_masked_name = mask_name(patients.name)`; filters `actor_role`, `type`, `created_at >= from`, `<= to`; order `created_at desc, seq asc`. The admin role has **no** grant on `patients`, `prescriptions`, `doses`, `interaction_alerts`. | `S.admin` | `audit_events` (+ `patients.name` through the view only) | — |

### Resilience — 1

| Function | Serves it | Roles | Tables | Audit |
|---|---|---|---|---|
| `readLastKnownSnapshot(key)` | `select data, as_of from snapshots where subject = S.subject and key = $1` — **scoped to the caller (D-014; the mock returns any subject's cache)**; the stored `data` is a serialised copy (no aliasing, BACKEND-NOTES §2). | any signed-in | `snapshots` | — |

---

## B. The HTTP surface — route handlers (new, `app/api/**`)

These exist because a bot, a calendar client, a browser push service, a cron and the agents track cannot call a server function. **No route handler is reachable from a screen**, and **no route handler accepts a dose status from a patient, caregiver, reviewer or admin session — there is no such route at all.**

| Route | Method | Auth | Does | DB role | Audit | Refusal |
|---|---|---|---|---|---|---|
| `/api/agent/doses/{doseId}/status` | `POST` `{ status, recordedAt, source: 'adherence_agent' }` | `Authorization: Bearer JURAH_AGENT_TOKEN` | Writes `Dose.status` + `recorded_at` + `source`; the trigger `doses_status_write` refuses `tracked=false`, refuses any status on a non-agent/system session, and **appends** `dose_status_recorded` with `actor.role='agent'`. `taken_late` requires `recordedAt`. | `jurah_agent` | `dose_status_recorded` | 401 no/bad token · 403 any user session cookie · 409 `tracked:false` · 422 bad body |
| `/api/agent/schedule/recompute` | `POST` `{ prescriptionId, reason: 'reported_miss' \| 'discontinued', missedDoseId?, discontinuedAt?, discontinuedReason }` — `discontinuedReason` **required** for a discontinuation (the column is `NOT NULL` when `discontinued`) | agent token | WP4 engine: regenerate remaining `upcoming` doses from the prescription's own fields (cadence cannot collapse), or cancel remaining doses and set `status='discontinued'`. | `jurah_app` as `system` (D-025 — `jurah_agent` holds no `DELETE` on `doses`) | `schedule_recomputed` (actor `system`) · `prescription_discontinued` (actor `agent`, D-032) | 401 · 403 · 404 · 409 (already discontinued / not a recorded miss) · 422 (bad body, missing reason) |
| `/api/agent/alerts` | `POST` `InteractionAlert` minus `id`, `reviewStatus` forced to `pending_medical_review` or `auto_cleared` (never `reviewed`), `sourceCitation` required (empty string allowed, `[TO BE SUPPLIED]` allowed) | agent token | Inserts the alert; notifies recipients (§B `alert-recipients` rule) — payloads carry no `actions`. | `jurah_agent` | `alert_raised` (actor `agent`) | 401 · 403 · 422 (`reviewStatus: 'reviewed'` or any reviewer field) |
| `/api/agent/prescriptions` | `POST` extraction result `{ patientId, prescription: Prescription minus id, needsReview, uncertainFields?, source }` | agent token | Inserts the prescription (CR-042: this is where a real `source` finally arrives) and its doses when confirmed. | `jurah_agent` | `prescription_added` (actor `agent`) | 401 · 403 · 422 (constraint violations, e.g. `doseTimes.length !== frequencyPerDay`) |
| `/api/agent/check-in-eligibility` | `GET` | agent token | `patientId`s (and `chatId`s — the agents read them, the app never shows them) where `settings.adherence_check_in_enabled` **and** the latest `messaging_links` row is `connected`. | `jurah_agent` | — | 401 · 403 |
| `/api/agent/alert-recipients?patientId=` | `GET` | agent token | The patient's own `chatId`/push endpoint if connected, plus **`active` caregivers only** — never a pending/declined/expired/revoked row. | `jurah_agent` | — | 401 · 403 · 404 |
| `/api/messaging/telegram/webhook/{secret}` | `POST` Telegram update | path secret derived from `JURAH_BOT_TOKEN` (never in the repo) | `/start <token>` → find the `pending`, unexpired, unused `messaging_links` row by token; set `connected`, `chat_id`, `connected_at`; consume the token. A used/expired/unknown token → a neutral reply, no write. A token can only ever link *its own* row. | `jurah_app` as `system` | `messaging_connected` | 404 wrong secret · 200 always to Telegram (never leaks) |
| `/api/calendar/{token}.ics` | `GET` | the token in the path (`calendar_subscriptions.token`) | Spec-valid `text/calendar` for the patient's `upcoming` and recorded doses, regenerated on every read (so "regenerated when doses change" is true by construction); `ETag` from the doses' max `seq`. | `jurah_app` as `system` (read-only) | — | 404 unknown token · **405 for `PUT`/`POST`/`PATCH`/`DELETE`** (no write-back) |
| `/api/push/subscription` | `POST` `{ endpoint, keys }` · `DELETE` | the signed session cookie (D-018), subject = the session's own | Stores the browser subscription **server-side only** against the subject's `push_subscriptions` row; `DELETE` removes it and sets `revoked`. | `jurah_app` as `S.self` | — (the seam's `requestPushPermission`/`disablePush` write the audit rows) | 401 · 403 (subject ≠ session) · 422 |
| `/api/jobs/expire-invitations` | `POST` | `Authorization: Bearer JURAH_JOB_TOKEN` | `update caregivers set status='expired' where status='pending' and expires_at <= now` (now = `REFERENCE_NOW`, D-021); one audit row per row flipped. Read paths already treat a stale `pending` as expired, so the job is the second enforcement, never the only one. **This job never touches `doses`** — there is no "overdue → missed" job anywhere, and `scripts/guards/no-dose-write.ts` keeps scanning for one. | `jurah_app` as `system` | `caregiver_invite_expired` (actor `system`) | 401 |

**Deliberately absent, and asserted absent by a test that enumerates `app/api/**`:** any route under `/api/doses/**` for a user session; any route that accepts an `AuditEvent`, an `actor`, a `role`, a `chatId`, a `routedTo`, or a `Settings` key outside the seven; any route serving the landing page (G11).

---

## C. The four sessions the round trip and refusal matrix run under

Exactly the seeded sessions `scripts/print-shapes.ts` uses today, minted as signed cookies (D-018) by the test helper:

| Person | Session | Proves |
|---|---|---|
| حمد `pt-01` | `{ subjectId:'pt-01', role:'patient' }` | the default patient, tracking off |
| سارة `pt-03` / `cg-02` | patient **and** caregiver options | dual role, the in-shell switch, a pending invitation held inside a patient shell |
| عبدالله `cg-01` | `{ role:'caregiver', linkedPatientId:'pt-01' }` | the active caregiver reads exactly what the patient reads |
| ناصر `cg-03` | `{ subjectId:'cg-03', pendingInvitationOnly:true }` | the pending-only session reaches F0's data and nothing else |
| منى `cg-04` (declined), طلال `cg-06` (revoked), `277091900873`/`cg-05` (expired) | forged caregiver sessions | every non-`active` state reads nothing |
| د. خالد `acc-10` | reviewer **and** admin | the two clinic roles, one-shot decisions, the admin's metadata-only view |
| م. دانة `acc-11` | admin only | `/clinic/review` data refused |
