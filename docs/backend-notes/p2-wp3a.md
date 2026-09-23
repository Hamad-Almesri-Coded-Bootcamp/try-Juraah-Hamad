# P2-WP3a: prescriptions and doses, notes

Written by the WP3a implementer (brief: `docs/briefs/P2-WP3.md` → WP3a, with `docs/briefs/P2-common.md`),
2026-09-22. Seven functions are real behind the seam: `getPrescriptions` (WP1's, its column list
hoisted into one `RX_COLUMNS` constant), `getPrescription`, `getDosesForDay`, `getDoseHistory`,
`getRecentDoses` (CR-046: served, no caller), `submitPrescriptionImage` and `savePrescriptionDraft`.
`JURAH_DATABASE_URL` is still empty in `.env.local`, so the two integration files fail loudly (NOT A
PASS). Every DB-level claim below was also proved by hand through the Supabase MCP connector
(project `frvubflbpujwuhsxweue`), as `jurah_app`, with the same session GUC `withSession()` sets.

## 1. Files

| File | What |
|---|---|
| `lib/data/pg/reads-rx.ts` | The seven functions. Every statement is a parameterised text in `PG_QUERIES_RX`, so a proof can run the same text through the MCP connector. Arrays and the image travel as JSON / base64 **text** parameters and are decoded in SQL (`jsonb_to_record[set]`, `decode(…,'base64')`). No driver-specific array or bytea serialisation is relied on. |
| `lib/data/shapes/reads-rx.ts` | `toPrescription` (WP1's), `toDose`, `toDoseWithPrescription` (WP3b's `getAlertForReview` imports it too, so the review context and B1 share one literal), the CR-049 draft literals `confidentDraft` / `needsReviewDraft` / `NEEDS_REVIEW_UNCERTAIN_FIELDS`, and `prescriptionFromDraft` (the mock's save record). |
| `lib/data/refusals/reads-rx.ts` | `prescriptionsRefusal`, `prescriptionRefusal`, `dosesWithPrescriptionRefusal`, `doseHistoryRefusal`, `extractionRefusal`, `draftSaveRefusal`. |
| `lib/data/mock-impl.ts` | Only the lines of my five read functions and `submitPrescriptionImage`'s session refusal. The inline `[]` / `null` / `{kind:'unreadable'}` became the imports, through one added import line of my own. The bytes are unchanged: a mock `print-shapes` run left `tests/fixtures/shapes.json` byte-identical (`cmp`). `savePrescriptionDraft` was **not** touched. Its D-014 permissiveness is the approved default. |
| `tests/unit/data/rx-projection.test.ts` | Runs in `npm run verify` (mock). It puts the MCP rows through the seam literals and string-compares against `shapes.json`. It proves the pg literals equal the mock's bytes and that the refusal literals equal the mock's refusals, and it scans for Civil IDs. 15 tests. It was shown red, by swapping `recordedAt`/`source` in `toDose` (2 failures), and then green. |
| `tests/integration/enforcement/read-rx.test.ts` | E-21 (the five reads for cg-03…cg-07, the pending-only session and the admin), E-49 and E-41, each with DB-level and seam-level proofs and a positive control. |
| `tests/integration/roundtrip/rx.test.ts` | Each function string-equal against `shapes.json` under the seeded session, plus the save transaction's side effects. |

## 2. SQL decisions

- **`getDosesForDay`** groups on the Kuwait calendar date, `(scheduled_at at time zone 'Asia/Kuwait')::date = $2::date`, and orders by `scheduled_at, id`, as the brief says. A malformed or impossible date returns `[]` in TypeScript before any SQL runs. That covers `2026-02-30`, `2026-13-01`, `2026-00-10` and `not-a-date`, each checked. Otherwise `$2::date` would raise and reach `error.tsx`, while the mock simply matches nothing. The guard calls `Date.parse` BEFORE the `addDays` round trip, because `addDays` on month 13 throws `RangeError: Invalid time value`, which a review caught.
- **`getRecentDoses`** keeps the mock's inclusive window: `0 <= REFERENCE_DATE − kuwait_date(dose) <= days`. `REFERENCE_DATE` reaches SQL as `jurah_now()` (D-021). A `NaN` `days` returns `[]`, because in SQL `NaN` compares true against every bound while the mock matches nothing.
- **`getDoseHistory`** orders by `scheduled_at, id`. The ids are unique per time, so this is the mock's order.
- **`submitPrescriptionImage`** refuses quietly. Its insert is `insert … select … where jurah_session_is('patient') and jurah_session()->>'subjectId' = $2 returning draft_id`: 0 rows maps to `{kind:'unreadable'}` and nothing is raised. RLS `drafts_own`'s with-check stands behind it. With a bare `insert … values`, RLS would raise, and the throw would reach `error.tsx`. A 0-byte image stores nothing, as the mock does.
- **`savePrescriptionDraft`** runs as one `withSession` transaction:
  1. `select prescription from prescription_drafts where draft_id=$1 and patient_id=$2`. RLS shows a draft only to its own patient's session, so 0 rows returns `draftSaveRefusal(patientId)` before any write. This covers a foreign draft, a foreign `patientId`, a caregiver and no session.
  2. Insert the prescription, built by `prescriptionFromDraft` from the draft.
  3. Read `tracked` from `settings` (no row → `false`).
  4. Insert `generateDoses(rx, tracked)` with no `status` column, so the column default `upcoming` applies (G1). If fewer rows are inserted than were generated, the function throws and the whole save rolls back.
  5. Delete the draft.
  6. `append('prescription_added')` with the mock's actor, message and `relatedId`.
  7. Re-select the row through `RX_COLUMNS` → `toPrescription`, which fixes the key order.

## 3. Proofs run by hand through the MCP connector (JURAH_DATABASE_URL absent)

**Round trip.** The exact `PG_QUERIES_RX` text ran as `jurah_app` under the seeded session. For
the two large results (180 and 24 rows) the database returned
`md5(string_agg(row_to_json(q)::text, E'\n'))`, and TypeScript rebuilt the rows the fixture implies,
checked the same md5, and projected them. Output of the compare script:

```
EQUAL  getPrescription(rx-001)          [MCP rows verbatim] (434 bytes)
EQUAL  getDosesForDay(pt-01, 2026-09-21) [MCP rows verbatim] (1501 bytes)
EQUAL  getDoseHistory(rx-008) DB md5 (n=180) vs fixture-implied rows (n=180) (36 bytes)   ← DB 44298a2bf5344600c81bad0d95fb61c6
EQUAL  getDoseHistory(rx-008) projection of those rows (26985 bytes)
EQUAL  getRecentDoses(pt-03, 7) DB md5 (n=24) vs fixture-implied rows (n=24) (35 bytes)   ← DB 999d8c93ab8ec2a1118b1ce4c69baadd
EQUAL  getRecentDoses(pt-03, 7) projection of those rows (6436 bytes)
ALL EQUAL
savePrescriptionDraft(pt-01): id present & string: true; rest EQUAL (376 bytes)
```

`getPrescriptions(pt-01)` was re-proved on the refactored text (the column list is now
`RX_COLUMNS`) the same way: DB `n=4 md5 6f3d79f1e70416ccc179dd975ba5c510` equals the md5 of the rows
the fixture implies, and those rows project to the fixture's exact string. That is test
`getPrescriptions(pt-01) — the database returned exactly…` in `tests/unit/data/rx-projection.test.ts`
(15/15).

**Write paths.** A single `DO` block ran as `jurah_app` and ended in `raise exception`, so the
whole transaction rolled back. `audit_events` is append-only for the owner too, so a committed
proof would have drifted the seed. The raised text:

```
current_user jurah_app · 1_submit_confident_rows 1 · 2_submit_needs_review_rows 1 ·
3a_submit_as_caregiver_rows 0 · 3b_submit_hamad_for_pt02_rows 0 ·
4a_hamad_select_fatima_draft_as_pt01 0 · 4b_hamad_select_fatima_draft_as_pt02 0 · 4c_caregiver_select_hamad_draft 0 ·
5a_draft_jsonb {"drug":{"brandName":…,"strengthMg":400,"genericName":…},…}   ← jsonb RE-ORDERS keys (see §5)
5b_rx_inserted 1 · 5c_tracking false · 5d_doses_inserted 21 / generated 21 · 5e_draft_deleted 1 · 5f_audit_appended 1 ·
5h_doses 21 × [id, 2026-09-21T08:00…09-27T20:00, "upcoming", false, "seed"] ·
5i_audit_row {type prescription_added, actor_role patient, actor_id pt-01, message "أُضيفت وصفة Ibuprofen",
              created_at 2026-09-21T09:15:00+03:00, related_id rx_MCPPROOF} ·
6_resave_select 0 · 7_fatima_draft {image_bytes 50, confident false, uncertain_fields [strengthMg,frequencyPerDay,startDate,doseTimes]}
```

Counts afterwards: `rx 9 · doses 949 · drafts 0 · audit 47 · proof rows 0`, which is the seed,
unchanged.

**Refusals (E-21, E-49).** One `DO` block. Each session's own civil id was resolved as the owner,
before the role drop, exactly as `withSession()` resolves it:

```
current_user=jurah_app
hamad(control):         getPrescriptions=4 getPrescription=1 getDosesForDay=6 getDoseHistory=90 getRecentDoses=33
cg-01 active(control):  getPrescriptions=4 getPrescription=1 getDosesForDay=6 getDoseHistory=90 getRecentDoses=33
cg-03 forged caregiver: getPrescriptions=0 getPrescription=0 getDosesForDay=0 getDoseHistory=0 getRecentDoses=0
cg-04 forged caregiver: … all 0      cg-05 … all 0      cg-06 … all 0      cg-07 … all 0
cg-03 pending-only:     … all 0      acc-11 admin: … all 0
E-49 getPrescription(rx-006) as hamad=0 | getPrescription(rx-999) as hamad=0 | getDoseHistory(rx-006) as hamad=0 | getPrescription(rx-006) as fatima(control)=1
```

The mock gives the same control counts: `mock hamad: 4 6 90 33`.

## Divergences

| # | Function / place | Mock | Backend | Why | Could a screen notice? |
|---|---|---|---|---|---|
| WP3a-1 | `savePrescriptionDraft` for a draft the session's patient does not own, a `patientId` that is not the session's, a caregiver, or no session (D-2/D-3, E-41) | Fabricates `{id:'rx-draft-<n>', …, drug:{genericName:'(unreadable)'}, …}` and **saves** it, with doses and an audit row | Returns the same skeleton's bytes with **`id: ''`** (`draftSaveRefusal`), the `{id:''…}` convention of the other write refusals, and writes nothing (counts before = after) | D-014 · D-022 | No. B4 only ever saves its own draft. |
| WP3a-2 | Ties at one `scheduledAt` across prescriptions (`getDosesForDay`, `getRecentDoses`) | Stable sort, so the store's insertion order | `order by scheduled_at, id`, as the brief says | Brief | Not for any seed row: `rx-00N` id order is insertion order. Two **runtime** prescriptions (`rx_<ULID>`, all sharing REFERENCE_NOW's time prefix) with doses at the same minute tie-break by their random id part, not by save order. WP3b's `getAlertForReview` uses `scheduled_at, p.seq, d.seq`, which reproduces the mock exactly. **Lead: pick one of the two.** Mine is a one-word change. |
| WP3a-3 | `submitPrescriptionImage` / `savePrescriptionDraft` ids | `draft-<n>`, `rx-draft-<n>` | `draft_<ULID>`, `rx_<ULID>` (`newId`) | CR-041 · D-1 | No |
| WP3a-4 | `getDosesForDay` with an impossible date, `getRecentDoses` with `NaN` | Matches nothing → `[]` | `[]` from a TypeScript guard, no SQL | A `::date` cast would raise into `error.tsx` | No |
| WP3a-5 | Doses generated on save | `source: 'seed'` (the generator's value) | `source: 'seed'`, kept, as the WP4b brief fixes for creation-time rows (only recompute-added rows are `system`, D-28) | Byte parity with every later read | No. No screen renders `source`. |

## Change requests

- **CR (WP3a → WP5/WP3b, CR-050).** Following the brief, the save deletes the draft, and with it
  `prescription_drafts.image`. A saved prescription therefore keeps no source image. WP1 §4
  flagged this already. If a saved record ever enters the field-confirmation queue, as the
  `needs_review` branch does, `hasSourceImage` can no longer be derived from the draft. I propose
  either keeping the image in a `prescription_images(prescription_id, image)` table, written in
  this same transaction before the draft is deleted, or keeping the draft row with a
  `saved_prescription_id` column. Either is a `0007+` migration (D-026) and one statement here. I
  did not build it: it is a schema change outside this package.
- **The mock's confident save stores `fieldReviewStatus: 'pending'` on a `needsReview: false` record**
  (`draft?.prescription.fieldReviewStatus ?? 'pending'`). §5's bytes carry it, so the backend
  reproduces it. No queue shows such a row: the field queue needs `needs_review` or `returned`. It
  is semantically odd, and the owner may want `fieldReviewStatus` absent for a confident save,
  which would change §5's `savePrescriptionDraft` shape (a contract-visible change). Not changed.

## Found out the hard way

- **`prescription_drafts.prescription` is `jsonb`, and jsonb re-orders keys**: `{genericName, brandName, strengthMg}`
  comes back as `{brandName, strengthMg, genericName}` (MCP output 5a). The save therefore never returns
  the draft's objects. It inserts columns and re-selects the row through the literal.
- **An RLS with-check on an INSERT raises; it does not return 0 rows.** For a function whose refusal
  must be a quiet shape, the insert is written as `insert … select … where <session is the owner>`.
  The DB still refuses, but as 0 rows.
- **`do $$ … raise exception $$` is the only honest way to prove a write path through the MCP
  connector.** The connector commits at the end and returns only the last statement's rows, and the
  owner cannot delete an audit row. The exception message carries the proof, and the rollback is
  verified by the counts.
- **`set local role jurah_app` works inside a `DO` block**, and the `declare` section's expressions
  run before it, as the owner. That is where `civil_id_for_session()` must run, because
  `jurah_app` has no EXECUTE on it.
- **Two packages named the same export.** WP3b first had its own `toDoseWithPrescription` in
  `shapes/reads-clinic.ts`, so the barrel `lib/data/shapes.ts` failed `tsc` with TS2308. WP3b then
  moved to importing this package's. Package-owned files still share one barrel namespace, so
  export names need a package prefix or a registry.
- **`npm run verify` is exit 1 today because of another package's files.** Guard 8 flags twelve
  `sql.unsafe` lines in `lib/engine/{doses,expiry,rows}.ts`, all WP4b's. Guard 4 also flagged
  `tests/unit/engine/boundaries.test.ts:29` on the first run, and that is fixed since. The other
  steps pass when run on their own: tsc 0, 754 unit tests passed, seed:diff 0, notes:check 0 and
  next build 0. Guard 8's rule (c) allows SQL only under
  `lib/{data,session}/pg/**`, and `lib/engine/**` is a library that receives the `withSession`
  callback's handle. **Lead's call:** either the engine moves under an allow-listed path, or rule
  (c) gains `lib/engine/**`. None of this package's files appears in any guard output.

## Could not prove, and why

- **The seam functions themselves against the database** (`npm run test:integration` for
  `read-rx`/`rx`, and `print-shapes --backend=postgres`). `JURAH_DATABASE_URL` is empty, so both
  fail loudly. What ran instead was the same SQL text through MCP, with the rows mapped by the same
  TypeScript.
- **The `postgres` driver's parameter handling for these statements.** `unsafe(text, params)` sends
  a JS `boolean` for `$4::boolean`, a `number` for `$2::float8`, and `null` for `$5::jsonb`. The
  base64 image is a text parameter. These are simple scalar types, but they have never been
  executed from Node here.
- **E-49's timing class.** The test measures 20 calls each and asserts that the medians differ by
  less than 3×. Only a URL run produces the numbers.
