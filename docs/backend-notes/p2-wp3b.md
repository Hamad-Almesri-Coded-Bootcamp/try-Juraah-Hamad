# P2-WP3b — alerts and the clinic read paths (fragment)

Package WP3b of Phase 2, brief `docs/briefs/P2-WP3.md` §WP3b (+ `P2-common.md`). Seven functions —
the brief's heading says six, its list names seven, and seven were built:
`getAlerts` · `getAlert` · `checkDrugPhoto` · `getReviewQueue` · `getFieldConfirmationQueue` ·
`getAlertForReview` · `getFlaggedPrescription`.

## 1. Files

| File | What |
|---|---|
| `lib/data/pg/reads-clinic.ts` | the seven functions; `PG_QUERIES_CLINIC` (every SQL text, exported so a gate proof runs the same text) |
| `lib/data/refusals/reads-clinic.ts` | seven refusal literals (`alertsRefusal`, `alertRefusal`, `drugCheckRefusal`, `reviewQueueRefusal`, `fieldQueueRefusal`, `alertReviewRefusal(alertId)`, `flaggedPrescriptionRefusal`) |
| `lib/data/shapes/reads-clinic.ts` | `toAlert`, `toReviewQueueItem`, `toFieldQueueItem` (Prescription and DoseWithPrescription are WP3a's `toPrescription` / `toDoseWithPrescription` in `shapes/reads-rx.ts`, imported, not duplicated) |
| `lib/data/mock-impl.ts` | **only my seven functions' refusal lines** now call the literals above, plus one new import line (`// WP3b`). Behaviour identical — proved by `tests/unit/data/clinic-projection.test.ts` |
| `tests/integration/roundtrip/clinic.test.ts` | string-equal against `shapes.json`, per function |
| `tests/integration/enforcement/read-clinic.test.ts` | E-28, E-32, E-35 (read half), E-36 (read half), E-48, plus the E-21 and E-31 columns for these functions |
| `tests/unit/data/clinic-projection.test.ts` | offline (runs in `npm run verify`): the rows the database returned through MCP → the same shape functions → the fixture bytes; each refusal literal equals the mock's own refusal |

## 2. How each function is served

- **`getAlerts` / `getAlert`** — `interaction_alerts` under RLS (`alerts_select` → `can_read_patient`). Order: severity rank (danger, warning, info), `created_at desc`, then `id` (the table has no `seq`; the seed has no tie). Zero rows → `[]` / `null`.
- **`checkDrugPhoto`** — CR-049's deterministic provider, read-only: the patient's first active prescription in `seq` order, verdict = whether it is one side of the patient's own `danger` alert. **Refused at the seam and in SQL**: RLS lets an active caregiver read the patient's prescriptions, the mock does not, so the seam checks `role='patient' && subjectId=patientId` before querying and the query carries `jurah_session_is('patient') and subjectId = $1`. A 0-byte image → `could_not_identify` without a query.
- **`getReviewQueue`** — every `pending_medical_review` alert, rank then `created_at` **ascending**; `patientFirstName` = first whitespace token of `patients.name`; `drugNames` in `involved_prescription_ids` order (an id with no readable row is dropped, the mock's `filter(Boolean)`); `waitedMinutes = greatest(0, floor((jurah_now() − created_at)/60 s))` — `jurah_now()` is `REFERENCE_NOW` (D-021) → 2771.
- **`getFieldConfirmationQueue`** — `(needs_review and field_review_status='pending') or field_review_status='returned'`, `seq` order (CR-037).
- **`getAlertForReview`** — the alert **only** when `review_status='pending_medical_review'` **and** the session is a reviewer (D-014, divergence D-4). The queue has no per-reviewer assignment, so "queue membership" is exactly those two conditions. Then, in the same transaction: involved prescriptions (store/`seq` order, as the mock's `filter`, not the id array's order) · active prescriptions (`seq`) · the mock's own 14-day dose window (Kuwait calendar date in `[REFERENCE_DATE − 14, REFERENCE_DATE]`, active prescriptions only, every status) ordered `scheduled_at, p.seq, d.seq` — the mock's stable sort over store order · `trackingOn` = the settings flag, `false` with no row, nothing written.
- **`getFlaggedPrescription`** — `id = $1 and needs_review and reviewer`.

**Why the clinic queries carry `jurah_session_is('reviewer')` themselves.** RLS alone does not refuse a patient here: `alerts_select` and `prescriptions_select` admit a patient to their own rows, so without the gate حمد's `getReviewQueue()` returns `ia-001` and his `getAlertForReview('ia-001')` returns his own context, and فاطمة's `getFlaggedPrescription('rx-006')` returns her own record — all refused by the mock (E-28). The control rows in §3 show RLS alone admitting them.

## 3. Proof by hand through the MCP connector (`JURAH_DATABASE_URL` is still empty)

Project `frvubflbpujwuhsxweue`, freshly seeded state (`prescriptions 9 · doses 949 · audit 47 · ia-001 pending · ia-002 reviewed · ia-003 auto_cleared · drafts 0`). Every call is one transaction: `set local role jurah_app; select set_config('jurah.session', <the session withSession() builds, civilId as civil_id_for_session resolves it>, true), set_config('jurah.now', '2026-09-21T09:15:00+03:00', true);` then the exact `PG_QUERIES_CLINIC` text, parameters inlined as literals, wrapped as `json_agg(row_to_json(t)) from (<query>) t` (the round-trip calls also `json_strip_nulls`, which the projections treat exactly like null). The generator is a scratch script that prints that text from `PG_QUERIES_CLINIC`; nothing in these calls mutates (the E-21 loop uses a `temp … on commit drop` table).

**Round trip** — rows run through the same shape functions, `JSON.stringify` compared with `tests/fixtures/shapes.json`:

```
IDENTICAL  getAlerts(pt-01)  (283 bytes)
IDENTICAL  getAlert(ia-001)  (281 bytes)
IDENTICAL  checkDrugPhoto(pt-01)  (92 bytes)
IDENTICAL  getReviewQueue (as د. خالد)  (185 bytes)
IDENTICAL  getFieldConfirmationQueue (as د. خالد)  (435 bytes)
IDENTICAL  getFlaggedPrescription(rx-006, as د. خالد)  (270 bytes)
DIFFERS    getAlertForReview(ia-001) — whole fixture  (16163 bytes)
IDENTICAL  getAlertForReview(ia-001) — fixture minus created rx-draft-10*  (16163 bytes)
no 12-digit run in any shape
```

**How the 54 `recentDoses` rows were checked.** They were not pasted raw: the compare script rebuilt them from the returned id sequence plus the per-prescription columns (constant per prescription in the output — every row `upcoming · tracked false · source seed`, no `recordedAt`, no `strengthUnit`). To close that gap, one more call as د. خالد hashed the database's own rows over the same FROM/WHERE/ORDER as `alertReviewRecentDoses` — `md5(string_agg(id|prescription_id|iso_kw(scheduled_at)|status|tracked|recorded_at|source|generic_name|brand_name|strength_mg::float8|strength_unit|dose_per_administration::float8, E'\n' order by d.scheduled_at, p.seq, d.seq))` → `n 54 · d1ead36486803af9ed2f1c62c9b0eace` — and the script computed the same canonical string over its rebuilt rows → `n=54 md5=d1ead36486803af9ed2f1c62c9b0eace`. Identical.

The `DIFFERS` line is by construction, not a defect: `print-shapes` recorded `getAlertForReview(ia-001)` **after** WP3a's `savePrescriptionDraft` created `rx-draft-10`, so the fixture lists it among the active prescriptions and its three doses among the 57 recent doses; a fresh seed has 3 and 54. `tests/integration/roundtrip/clinic.test.ts` inserts that created row under the fixture's own id and compares the **whole** shape byte for byte (it also proves the tie-break: `rx-draft-10-20260921-0800` sorts after `rx-003-20260921-0800`). Round-trip rule for the lead's Gate 3 table: CR-041's opaque-id rule applies **nested** here too (`activePrescriptions[].id`, `recentDoses[].id`, `recentDoses[].prescriptionId`).

The first MCP run of the involved-prescriptions query **failed** (`operator does not exist: text = text[]` — `p.id = any ((select array))` treats a parenthesised subquery as a set). Rewritten as `exists (select 1 from interaction_alerts a where a.id = $1 and p.id = any (a.involved_prescription_ids))`; the rerun is the one above.

**Refusals** (the gate clauses exactly as in `PG_QUERIES_CLINIC`; the counts are rows returned):

| Session | Result |
|---|---|
| حمد (patient) | `getReviewQueue` **0** · `getAlertForReview(ia-001)` **0** · control, pending alerts visible under RLS alone **1** · `getAlerts(pt-01)` 1 (positive) · `checkDrugPhoto(pt-01)` 1 (positive) |
| فاطمة (patient) | `getFieldConfirmationQueue` **0** · `getFlaggedPrescription(rx-006)` **0** · controls under RLS alone: rx-006 visible to its owner **1**, flagged rows visible **2** |
| د. خالد (reviewer) | `getAlertForReview(ia-002)` (reviewed) **0** · `ia-002` visible at all **0** · `ia-999` **0** · `getFlaggedPrescription(rx-001)` **0** (control: rx-001 visible 1) · pt-04 prescriptions **0** · pt-03 prescriptions **0**, doses **0** |
| م. دانة (admin) | `getAlert(ia-001)` **0** · `getAlerts(pt-01)` **0** · `getReviewQueue` **0** · `getFieldConfirmationQueue` **0** · `getAlertForReview(ia-001)` **0** · any alert **0** · any prescription **0** |
| forged `{acc-11, role:reviewer}` | `jurah_session_is('reviewer')` **false** · `getReviewQueue` **0** · any alert **0** |
| عبدالله (active caregiver) | `getAlerts(pt-01)` `["ia-001"]` · `getAlert(ia-001)` md5 `d2e3cd08863b1d32a24cea01ec8b7bce` · `checkDrugPhoto` SQL gate **0** (control: active rx visible 3) · `getReviewQueue` **0** |
| حمد, same projection | `getAlert(ia-001)` md5 `d2e3cd08863b1d32a24cea01ec8b7bce` (read 1) = `d2e3cd08863b1d32a24cea01ec8b7bce` (read 2) — **E-31** equal to عبدالله's |
| cg-03 pending · cg-04 declined · cg-05 expired · cg-06, cg-07 revoked | alerts 0 · ia-001 0 · queue 0 · field queue 0 · alert-for-review 0 · flagged 0 · drug check 0, for each (cg-01 active: alerts 1, ia-001 1, the rest 0) |
| **E-48** (owner, before/after two reads as حمد in separate transactions) | BEFORE `audit_rows 47 · ia-001 row md5 925e004cdac41f5beab37dca22ac7437 · pending_medical_review` → AFTER `47 · 925e004cdac41f5beab37dca22ac7437 · pending_medical_review` |

**Columns of these E-rows that belong to other packages** (not proven here): E-28's `getCaregiverLink('cg-01')`, `getAuditLog({})` (WP3d) and `GET /ar/clinic/audit` (the proxy route, WP2); E-32's `getPrescriptions('pt-04')` (WP3a — the raw row count as د. خالد is 0 in the table above, a bonus, not the proof); E-35's `getPrescriptions`, `getPatient`, `getDosesForDay` (WP3a/WP3d) and every write call (WP5); E-36's reviewer-only `getAuditLog` and the body-role route (WP3d, WP2).

## Divergences

| # | Function / place | Mock | Backend | Why | Could a screen notice? |
|---|---|---|---|---|---|
| D-4 (built) | `getAlertForReview` for an alert that is not `pending_medical_review` (`ia-002`) | Returns سارة's full patient context | The empty `AlertReviewView` (`alertReviewRefusal(alertId)`) | D-014 · a reviewer reads only through a queue item | No — the queue links only to pending alerts |
| WP3b-1 | `getFieldConfirmationQueue().hasSourceImage` | `true` for every row (hard-coded) | `true` for the seed rows `rx-006`/`rx-007` (the only flagged rows that exist); **`false` for any other flagged row** | CR-050's rule cannot be built as written: `prescription_drafts` has no link to the saved prescription, is deleted on save (WP1 §4), and its RLS (`drafts_own`) is patient-only, so a reviewer reads no draft at all | Only for a runtime-flagged prescription — none exists until WP7's extraction path. **WP5/WP7 must store the image keyed by prescription with a reviewer-readable path**; this column then becomes `exists(…)` |
| WP3b-2 | `getReviewQueue` / `getFieldConfirmationQueue` / `getAlertForReview` / `getFlaggedPrescription` under a patient or caregiver session | Refused by the role check in TS | Refused by `jurah_session_is('reviewer')` **inside the query** — RLS alone would admit the patient to their own rows | Defence where RLS is per-patient, not per-role | No — same shapes |
| WP3b-3 | `checkDrugPhoto` for a non-self session | Refused by the role check | Refused at the seam **and** by the SQL gate (RLS alone lets an active caregiver read the prescriptions) | — | No |
| WP3b-4 | Tie-breaks the mock gets from array order | `Array.sort` is stable over store (insertion) order | `getAlerts`/`getReviewQueue`: `id` (the table has no `seq`); `recentDoses`: `p.seq, d.seq`; `checkDrugPhoto`'s alert: `created_at, id` | `interaction_alerts` has no `seq` column | No — the seed has no tie; an agent-inserted alert with an identical `created_at` and severity would order by id rather than insertion |
| WP3b-5 | `getFieldConfirmationQueue` for a `returned` row with `needs_review = false` | Listed | Not visible to the reviewer (`prescriptions_select` admits a reviewer via `needs_review` or a queue patient) unless the patient has another queue item | RLS | No — the only returned row (rx-007) is `needs_review: true`; WP5's `returnPrescriptionToClinic` must keep `needs_review` true on return |

## Change requests

- **CR (WP3b) · `getFieldConfirmationQueue().uncertainFields` always lists `strengthMg` — a mock bug the bytes lock in.** *What the code does:* the mock filters `(p as Record)[k] === undefined` for `k = 'strengthMg'`, but `strengthMg` lives under `p.drug`, so it is undefined for every row and always listed; `rx-007` (Ciprofloxacin **500 mg**, seed row 83) therefore reads `["strengthMg","startDate"]`. *Why it matters:* G3s marks rx-007's strength as unclear when the seed states it — the reviewer is told a known value is uncertain. *What I did:* reproduced the mock byte for byte (`strengthMg` unconditionally, then `frequencyPerDay`/`startDate`/`doseTimes` from their null columns, `brandName` never), because Gate 3 compares the string and the frontend is frozen; a unit test pins it (and goes red if the literal changes). *Proposal:* derive `strengthMg` from `drug.strengthMg` in **both** the mock (`p.drug.strengthMg === undefined`) and `toFieldQueueItem` (`strength_mg is null`), and re-record `shapes.json` (rx-007 → `["startDate"]`). *Cost:* two lines and one fixture line. *If we don't:* every flagged record with a legible strength shows it as unclear.
- **Barrel (lead-owned).** Please add `PG_QUERIES_CLINIC` to `lib/data/pg/index.ts`'s `PG_QUERIES` (`import { PG_QUERIES_CLINIC } from './reads-clinic'`), as for RX and AMBIENT.
- **Consolidation note.** `toDoseWithPrescription` is WP3a's; I import it instead of keeping a copy (an early copy of mine collided in the `shapes.ts` barrel — removed).

## Found out the hard way

- **RLS is per-patient, the clinic reads are per-role.** `can_read_patient` admits the patient to their own alert and flagged prescription, so a query that relies on RLS alone leaks the reviewer view to the patient. Gate the role in the query; show the RLS-alone control in the test so the gate's necessity is visible.
- **`x = any ((select array_col …))` is a set comparison**, not an array one — it fails with `text = text[]`. Use `exists (… and x = any (array_col))`.
- **A fixture recorded mid-sequence carries other packages' created rows** (`rx-draft-10` inside `getAlertForReview`). A fresh-seed round trip must either strip them or insert them under the fixture id; say which, per function.
- **The barrel re-exports every package's shapes**, so two packages defining the same helper name breaks `tsc` for everyone (`TS2308`). Import the other package's helper rather than keeping a copy with the same name.
- `hasSourceImage` from drafts is unreachable three ways at once (no link, deleted on save, patient-only RLS) — check the policy, not only the schema, before promising a derivation.

## Not proven, and why

- The integration files (`roundtrip/clinic.test.ts`, `enforcement/read-clinic.test.ts`) have **not run against the database**: `JURAH_DATABASE_URL` is empty, so both fail loudly (NOT A PASS, pasted in the report). §3's MCP proofs stand in for them; in particular the **whole-shape** `getAlertForReview(ia-001)` compare (with `rx-draft-10` inserted) exists only as a test, since doing it through MCP would commit a row to the shared database.
- The seam path itself (`sessionOf()` → `withSession()` → `sql.unsafe` with bound `$1`) is exercised only by those integration tests; the MCP runs inline the parameters as literals.
