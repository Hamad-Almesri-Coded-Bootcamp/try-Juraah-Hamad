# WP4 bundle i — Clinic (X0, G1s, G2s, G3s, X1): notes

## §2. Where the mock cheated

- **CR-036, CR-037 and CR-038 (below) were raised against the wave-1 shapes and are now RESOLVED —
  the lead landed all three data-layer changes at the wave-2 gate, and this bundle consumes them.**
  Kept here, past tense, because the shapes themselves are still worth a Phase 2 reader's attention.
- **The reviewer queue's waiting time is now precomputed, not derived in the screen.**
  `ReviewQueueItem.waitedMinutes` (`types/views.ts`) is computed inside `getReviewQueue`
  (`lib/data/index.ts`) against `REFERENCE_NOW` — `features/clinic/format.ts`'s `waitedLabel` only
  formats the number into words (three buckets: minutes/hours/days), never reads any clock itself
  (guard 6). Same function also does the severity ordering (`SEVERITY_RANK`). CR-036.
- **`getFieldConfirmationQueue` now returns a reviewer's already-*returned* history alongside the
  pending queue**, each row's own `fieldReviewStatus: 'pending' | 'returned'` telling the two apart
  (`lib/data/index.ts`) — `rx-007` (فاطمة, `returned`) is visible again, without a free patient
  lookup. `features/clinic/FieldQueueList.tsx` splits the one array into a pending section and a
  quiet "returned to clinic" section underneath, both linking to the same detail route (which already
  rendered an already-returned record read-only). CR-037.
- **`getAuditLog` now returns `AuditLogRow` (`AuditEvent & { patientMaskedName?: string }`)** — the
  masked name computed server-side by the same rule F1's own masked-name step uses (CR-010's owner
  answer), inside `getAuditLog` itself (`lib/data/index.ts`), so the admin session still reads no
  clinical record and no Civil ID. `features/clinic/AuditLogView.tsx` renders it in the patient
  -reference slot, falling back to the honest "not recorded" mark only for a system-scoped row that
  carries no `patientId` at all. CR-038.
- **The three-way period filter (`all` / `last7` / `last30`) is a client-chosen `from` bound derived
  from `REFERENCE_DATE`** (`features/clinic/format.ts`'s `auditPeriodFrom`), passed as `getAuditLog`'s
  existing `from` string parameter — never a new filter shape. The real backend should keep accepting
  an ISO date `from`/`to` pair exactly as `DataApi['getAuditLog']` already types it; nothing here
  needs a contract change.
- **`confirmPrescriptionFields`'s regeneration of doses is synchronous and unconditional** — it wipes
  every existing `Dose` row for the prescription and regenerates from the new values in one call
  (`lib/data/index.ts`, not this bundle's file). Fine for a single mock process; the backend's
  equivalent should be transactional (write the corrected fields, THEN regenerate doses, atomically)
  so a mid-write failure never leaves a prescription with stale or missing doses.

## §3. Rules that are currently absences, and must become refusals

| Invariant | How Phase 1 satisfies it | What the backend must reject | Proving request |
|---|---|---|---|
| The reviewer reaches no patient except through a queue item — no free patient lookup | Every G1s/G2s/G3s module (page + feature component) imports only `getReviewQueue`, `getFieldConfirmationQueue`, `getAlertForReview`, `submitReviewDecision`, `getFlaggedPrescription`, `confirmPrescriptionFields`, `returnPrescriptionToClinic` — statically asserted in `tests/unit/clinic/module-graph.test.ts`; `getAlertForReview`/`getFlaggedPrescription` themselves gate on the alert/prescription actually being in that reviewer's queue (`lib/data/index.ts`, not this bundle's file) | A request for `getAlertForReview`/patient-context data using an alert id that exists but is not `pending_medical_review` (already reviewed, or another patient's), or a prescription id not `needsReview` for the calling reviewer | Sign in as a reviewer, call whatever endpoint backs `getAlertForReview('ia-002')` (سارة's already-`reviewed` alert) or a fabricated/other-patient alert id — must 404/403, never the patient's context |
| The admin reads no clinical record and opens no clinical body from X1 | `getAuditLog` returns `AuditEvent` rows only (event/actor/time/patientId/message) — no medication list, alert text or dose detail; `X1`'s own module graph imports only `getAuditLog` (same test file) | Any endpoint reachable from an admin session that returns a `Prescription`, `Dose` or `InteractionAlert` body, or that accepts a `patientId` and returns anything beyond audit metadata | Sign in as م. دانة (admin only), call whatever endpoint would back `getPrescriptions('pt-01')` or `getPatient('pt-01')` — must be refused, exactly as the current mock's `canReadPatient` already refuses it |
| `submitReviewDecision` is a one-shot commit, not idempotently re-appliable | The mock happily re-sets `reviewStatus`/`reviewerDecision`/`reviewedAt`/`reviewedBy` and re-appends an `alert_reviewed` audit row on a SECOND call against an already-`reviewed` alert (`lib/data/index.ts` has no guard) — this bundle's own e2e test never exercises a second commit, by design (it checks `reviewStatus` first and skips the click if already reviewed), so the gap was never triggered in Phase 1 but is real | A second `submitReviewDecision`/`confirmPrescriptionFields`/`returnPrescriptionToClinic` call against a record already in its terminal state (`reviewed` / `confirmed` / `returned`) | Call the review-decision endpoint twice in a row for the same `alertId` with different decisions — the second call must be refused (409, or a no-op), never silently overwrite the first reviewer's decision and never append a second `alert_reviewed` row |
| A flagged prescription's field values are correctable only through this one audited path | `confirmPrescriptionFields` is the only writer of `Prescription.drug`/`frequencyPerDay`/`startDate`/`doseTimes` after creation anywhere in the product (guard-scriptable: no other exported data function assigns those keys) | Any other endpoint (including a generic "update prescription" one, if Phase 2 ever adds one for another reason) accepting a write to those five fields | Attempt to PATCH those fields through any endpoint other than the dedicated confirm action — must be refused regardless of role |

**Not an absence — a demonstrated bug in the frontend's own routing (CR-039), recorded here because it changes what Phase 2 can assume about X0.** A patient/caregiver-only or pending-invitation-only Civil ID typed at `/clinic` is SPECIFIED to be refused with `no_claims` wording, but `proxy.ts`'s and the clinic layout's existing redirects (both outside this bundle) act on the session `signIn` just wrote before the sign-in screen's own client code runs, routing that person into their own shell instead. Not a security gap (nobody reaches clinic data who should not) — see CR-039 in `docs/DECISIONS.md` for the full reproduction and the two places (outside this bundle) a real fix would land.

## §4. Fields the five screens blank without

- **X0** depends on `SignInOutcome` distinguishing `single_role`/`multiple_roles` by role (`reviewer`/
  `admin`) — nothing renders without that; the refusal path needs no additional field (it renders the
  identical no-claims copy regardless of which non-clinic outcome produced it, by construction).
- **G1s** depends on `ReviewQueueItem.severity`, `.drugNames`, `.patientFirstName`, and now
  `.waitedMinutes` (CR-036, §2) for the waiting-time text; `.createdAt` itself is no longer read by
  this bundle now that the data layer precomputes the derived value.
- **G2s** depends on `AlertReviewView.alert.{severity,description,sourceCitation,reviewStatus}`,
  `.involvedPrescriptions[].{drug,dosingPattern,doseTimes,source}`, and
  `.patientContext.{activePrescriptions,recentDoses,trackingOn}`. `trackingOn` is load-bearing: it,
  not any dose's own status word, decides whether `DoseTimeline` renders a pill at all (rule 3).
  `sourceCitation` renders verbatim, including the `TO_BE_SUPPLIED` marker (CR-014) — the honest
  "unverified" line is this bundle's own fallback, reusing `copy.safety.c2SourceUnverified` rather
  than redefining it.
- **G3s** depends on `FieldQueueItem.uncertainFields` (which `TextField`s the detail screen treats as
  needing correction), `.fieldReviewStatus` (CR-037, §2 — which of the two sections a row renders in)
  and `Prescription.drug.genericName` (rendered even when it is literally the string `"(unreadable)"`
  — never replaced with invented text). A prescription lacking `dispensing`/`prescriberName`/etc. is
  fine; the five CR-002 fields are the only ones this screen's form ever touches.
- **X1** depends on `AuditEvent.{type,actor.role,createdAt,message}` for every row, and `.patientId`
  plus (now, CR-038 §2) `.patientMaskedName` for the patient-reference slot — the mark falls back to
  the honest "not recorded" text only when `patientId` itself is absent (a system-scoped row). Every
  event has `message`, so the description column never blanks.

## §7. Things this work found out the hard way

1. **The G1s/G3s "segmented switch in place" is two routes, not one screen with local state.**
   `/clinic/review` and `/clinic/review/fields` are independently gated, testable and linkable
   (`requireRole` per route, D-006's wrong-role redirect), and `features/clinic/ReviewerQueueShell.tsx`
   is the one header both pages mount, navigating between them with `router.push` rather than local
   `useState`. This reads as "in place" to a user (same header, same segmented control, one click) but
   is two page loads under the hood — worth knowing before Phase 2 assumes a single client-side view
   model for this pair.
2. **The X1 filter model lives entirely in the URL** (`?actor=&type=&period=`), read by the page's own
   `searchParams` prop and never `useSearchParams()` (D-008). `AuditLogView.tsx`'s three `Select`s
   each trigger a `router.push` to a freshly built querystring; the period filter is the one case
   where a UI choice becomes a computed `from` bound (`auditPeriodFrom`, `features/clinic/format.ts`)
   rather than a literal value `getAuditLog` receives — worth carrying the three-way `all`/`last7`/
   `last30` choice itself into Phase 2's API shape (or keep converting client-side; either works,
   nothing here couples to the client computation being real).
3. **D-007's phone-width sign-out placement was not revisited.** This bundle's five screens use
   `AppBar` for their own titles/back controls, but none needed the AppBar's trailing `action` slot
   for anything else, so `ClinicNav`'s existing sign-out placement (beside the simulated-role banner
   at phone width) was left exactly as WP3 built it — no AppBar action-slot migration happened here,
   and D-007 stays open for whichever bundle next touches a clinic AppBar with something to put in
   that slot.
4. **Superseded by CR-039 (see §3): `ClinicSignInForm` (X0) no longer calls `signOut()` after a
   non-clinic outcome.** An earlier version did, on the theory that `signIn` writing a session for a
   `single_role`/`pending_invitation_only` outcome regardless of which door called it
   (`lib/session/index.ts`'s own doc comment) would otherwise quietly leave a patient/caregiver Civil
   ID typed at the clinic door signed into their own shell. In practice, by the time that `signOut()`
   call ran, the browser had ALREADY been redirected there by `proxy.ts`/the clinic layout (CR-039),
   so the call fired against that page instead and signed the person back OUT of the shell they had
   just, correctly, landed in — an active regression, not a safe no-op. Removed; see CR-039 for the
   full mechanism and the real fix, which sits outside this bundle's files.
5. **No image asset exists anywhere in the data layer for G3s's "source image."**
   `FieldQueueItem.hasSourceImage` is a boolean, not a URL, and `Prescription` carries no image field.
   `FlaggedPrescriptionDetail.tsx` renders an honest placeholder (`role="img"` with the accessible
   description SCREENS.md asks for) rather than fabricate a picture. **Phase 2 needs an actual image
   field/URL on `Prescription`** (or a dedicated extraction-image entity) if the real product is to
   show one — a genuine contract gap, not a build shortcut.
6. **رx-007's `fieldReviewedBy: 'acc-10'` is an attribution the seed itself flags as not explicitly
   stated** (`lib/data/mock/seed.ts`'s own comment: "the seed names only one reviewer … so he is the
   only self-consistent attribution"). This bundle did not add to that; it is read verbatim wherever
   the already-`returned` `rx-007` is rendered — now also linked from G3s's own "returned to clinic"
   history section (CR-037, §2), not only reachable by typing the URL directly.
7. **The shared dev-server store makes ia-001 and rx-006 one-shot fixtures for e2e.** Both are the
   seed's ONLY item in their respective queue, so `tests/e2e/clinic.spec.ts`'s G2s and G3s commit
   tests are each written idempotently (check current state, click through only if still actionable),
   the same pattern `tests/e2e/caregiving.spec.ts` uses for cg-03/cg-08. Once a gate runs the full e2e
   suite together, ia-001 will read `reviewed` and rx-006 `returned` for the rest of that process's
   life — expected from exercising this bundle's own actions, not a bug, but any later suite that
   assumes either stays in its seeded state for a *content* assertion should run before this bundle's
   e2e file, or the dev server should restart between bundles.
8. **G7's loading/error states, added at the lead's request after the gate.** Every clinic route now
   has its own `loading.tsx` (a real Suspense fallback Next renders while that route's Server
   Component awaits its data — no dev flag involved) shaped to its content (`list` for the two
   queues and X1, `detail` for G2s and G3s's detail screen, `lines` for X0/the chooser). X0, G1s, G3s
   and X1 additionally read a `?view=loading|error` flag from their own `searchParams`, gated to
   `process.env.NODE_ENV !== 'production'` exactly like `app/[locale]/app/page.tsx` (B1) and
   `app/[locale]/app/safety/page.tsx` (C1) — the same dev-only, no-seed-data pattern, reused rather
   than reinvented. `features/clinic/ClinicErrorState.tsx` reuses `copy.shell.errorTitle`/`errorBody`/
   `retry` rather than defining new copy, matching `features/day/DayErrorState.tsx`'s own precedent.
