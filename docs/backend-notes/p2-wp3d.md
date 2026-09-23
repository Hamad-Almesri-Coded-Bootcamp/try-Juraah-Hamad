# P2-WP3d: patient, settings, caregivers, activity, audit log, notifications reads and snapshot, notes

Written by the WP3d implementer (brief: `docs/briefs/P2-WP3.md` §WP3d, `docs/briefs/P2-common.md`),
2026-09-22. `JURAH_DATABASE_URL` is still empty, so every proof below ran through the Supabase MCP
connector (project `frvubflbpujwuhsxweue`) with the very `PG_QUERIES_AMBIENT` text, under
`set local role jurah_app` and the `jurah.session`/`jurah.now` GUCs exactly as `withSession()` sets
them. The integration files are written and fail loudly without the URL.

## 1. What exists now

- **`lib/data/pg/reads-ambient.ts`** implements all eleven functions: `getPatient`, `getSettings`,
  `getInvitationForConsent` (WP1's, now owned here), `getActivity`, `getAuditLog`, `getCaregivers`,
  `getPendingInvitationsForSubject`, `getCaregiverLink`, `getPushCapability`, `getPushState`,
  `getMessagingLink` and `readLastKnownSnapshot`. None calls `notImplemented()` any more. Every
  query is in `PG_QUERIES_AMBIENT`, so the gate can run the same text through the connector.
- **`lib/data/shapes/reads-ambient.ts`** has one literal per shape, in the mock's key order:
  `toAuditEvent` (`id` last), `toAuditLogRow` (`patientMaskedName` last, only when present),
  `toCaregiverView`, `toCaregiverLink`, `toPushSubscription`, `toMessagingLink` and `toSnapshot`,
  plus WP1's three.
- **`lib/data/refusals/reads-ambient.ts`** has one function per refusal. Each returns a fresh value.
  `lib/data/mock-impl.ts` imports them on one `// WP3d` line and uses them in exactly the ten
  places where my functions returned an inline literal. The bytes are unchanged: the mock
  `print-shapes` run rewrites `tests/fixtures/shapes.json` with a zero-line git diff. On
  2026-09-22 `npm run verify` stopped at guards 4 and 8, whose only hits were WP4b's in-flight
  `lib/engine/**` and `tests/unit/engine/**` files; no WP3d file appeared. `startMessagingLink`'s identical `ml-default`
  literal is WP6's and was left alone.
- **Tests:** `tests/integration/roundtrip/ambient.test.ts` has 15 tests and
  `tests/integration/enforcement/read-ambient.test.ts` has 16 (E-21, E-22, E-23, E-24, E-31,
  E-35, E-36 and E-40, plus the reads-never-write count).

## 2. How the round trip is compared, and why four lines need a setup step

The rule is string equality against `tests/fixtures/shapes.json`. Four recorded lines hold state
that other packages create during the print-shapes run, so a freshly seeded database cannot
reproduce them on its own:

| Line | What else is in it | How it is compared |
|---|---|---|
| `getActivity(pt-01)` | 4 live rows (sign-in/out from WP2, `rx-draft-10` from WP3a, `rf-03` from WP5), all at `REFERENCE_NOW` | (a) the 24 seed rows, byte-exact; (b) the live rows re-created through `append()` in the recorded order, then the whole line compared under CR-041 (a created row's `id` is any string) |
| `getAuditLog (as م. دانة)` | 17 live rows, same second | the same two steps; (a) is 47 rows |
| `getCaregiverLink(cg-03)` | ناصر's acceptance (WP5) | the acceptance update runs first, under ناصر's own pending session, then the recorded line |
| `readLastKnownSnapshot(getPatient:pt-01)` | the mock's **aliasing bug**: `caregiverIds` gained `cg-09` after the snapshot was taken | expected = `{data: <getPatient(pt-01) line>, asOf}`, **and** asserted to DIFFER from the fixture's own line (D-5) |

`print-shapes.ts` calls `readLastKnownSnapshot` with a **null** session. Under E-40 that is always
`null`, so on the Postgres run that line will read DIFFERS for two reasons: no session, and D-5.
**Change request to the lead (the D-024 mirror):** run that call as حمد on the Postgres path.
`print-shapes.ts` is not my file, so I did not edit it.

## 3. Found out the hard way

- **RLS alone lets `getCaregivers` leak.** `caregivers_select` also shows any session the rows
  addressed to its own Civil ID. With only RLS, سارة (as patient `pt-03`, or as caregiver `cg-02`)
  calling `getCaregivers('pt-01')` gets her own `cg-02` row, where the mock returns `[]`. The
  proof: the raw count under her session is 1, and the function returns `[]`. The query therefore
  carries the mock's caller condition in its WHERE clause
  (`jurah_session_is('patient') and linked_patient_id = subjectId`). `getPushState`,
  `getMessagingLink` and `getCaregiverLink` do the same, because their policies also admit the
  `system` actor.
- **The tie order is `seq asc`, not `seq desc`.** The mock sorts with a stable
  `b.createdAt.localeCompare(a.createdAt)`, so rows with the same `createdAt` keep insertion
  order. Under the frozen clock every runtime event has the same `createdAt`, and the fixture
  records `ae-live-0001, 0002, 0003…` in ascending order. See divergence WP3d-1.
- **Audit filters are string comparisons in the mock.** X1 passes a bare `YYYY-MM-DD` as `from`
  (`features/clinic/format.ts`). `created_at >= '2026-09-14'::timestamptz` would mean 00:00 UTC,
  which is 03:00 in Kuwait, and it would drop events between midnight and 03:00. The query
  therefore compares `iso_kw(created_at) collate "C"` with the argument as text, the mock's exact
  semantics. The side effect is that `to: '2026-09-20'` excludes that whole day, as the mock does.
  Eight filter sets were compared by md5, database against mock, and all eight are identical
  (§5).
- **An MCP proof that mutates can be rolled back with `raise`.** A `DO` block does the write,
  reads the result, and ends in `raise exception 'WP3D_RESULT %', <json>`. The transaction rolls
  back and the error message carries the result. After the proofs: `snapshots` 0,
  `audit_events` 47, `cg-03` still `pending`.
- **Many sessions fit in one MCP call.** Wrap each query in a `pg_temp` SQL function. These are
  not SECURITY DEFINER, so they run as the current role, and RLS applies after
  `set local role jurah_app`. Between sessions use `reset role`, which is always permitted. The
  temp-schema grant is revoked and the functions are dropped before the last statement.
- **`row_to_json` concatenation matches `JSON.stringify` byte for byte** for these rows (no
  whitespace, raw UTF-8). The md5 of both can therefore be compared without copying 47 rows by
  hand.

## Divergences

| # | Function / place | Mock | Backend | Why | Could a screen notice? |
|---|---|---|---|---|---|
| WP3d-1 | `getActivity` / `getAuditLog` tie order | Stable sort: same `createdAt` → insertion order | `order by created_at desc, seq asc` — **API-SURFACE and the brief say `seq desc`; built `asc`** | `shapes.json` records the same-second live rows ascending. `seq desc` would reverse every runtime event in the demo (all share `REFERENCE_NOW`) and fail Gate 3's string compare. One token to flip if the lead prefers the documents. | E2/F3/X1 order within one second, same as the mock |
| WP3d-2 | `getCaregiverLink` | Checks role and id, **not** status: a forged session for a declined/revoked `cg-0x` gets the view | Own row **and** `status = 'active'`, else the empty-strings shape | API-SURFACE; E-21 | No — only an active caregiver reaches the caregiver shell |
| WP3d-3 | `getCaregivers` status | Stored status | Read-time expiry fold (`pending` and `expires_at <= now` reads `expired`), the rule `getInvitationForConsent` already uses | E-20 / G9 "enforced at read time". Same bytes for every seed row at `REFERENCE_NOW` | F1 shows `expired` a job-run earlier; that is the intent |
| WP3d-4 | `getMessagingLink` `linkToken` on non-pending rows | Returned whenever stored (ml-02 `expired` carries `mock-token-ml-02`) | Projected only while the row reads `pending` | CR-048 (brief) | No — ml-02 is never the current row, and no screen renders the token |
| WP3d-5 | `getAuditLog` filters | JS string `>=`/`<=` on `createdAt` | Same, in SQL (`collate "C"` on the Kuwait ISO text); an empty string means no filter, as `!filters.x` | Byte-identical results (8 filter sets, md5) | No |
| WP3d-6 | `readLastKnownSnapshot` / `print-shapes` | Called with no session; returns the aliased live object | Scoped to the caller (E-40); serialised copy (D-5) → `null` with no session | D-014, D-5 | No; the print-shapes call needs a session (§2, change request) |
| WP3d-7 | `getPendingInvitationsForSubject` with no session | `[]` | `[]` without opening a transaction (nothing to ask the database) | — | No |

## Change requests raised

1. **`scripts/print-shapes.ts` (lead's file):** on `--backend=postgres`, call
   `readLastKnownSnapshot('getPatient:pt-01')` as حمد, not with a null session, mirroring D-024.
   Even then the line differs by design (D-5, `cg-09`). Record it as an expected DIFFERS, or
   compare against `{data: getPatient(pt-01), asOf}`.
2. **Tie order, WP3d-1:** confirm `seq asc` and correct API-SURFACE's `getActivity`/`getAuditLog`
   rows and the brief, or tell me to flip it.
3. **A lapsed link token still reads `pending` with its token (proposal, NOT built).** Built as
   briefed: stored `status`, `linkToken` while `pending`. The MCP evidence is that at `jurah.now` =
   09:31 (16 minutes past ml-05's `token_expires_at`), فاطمة's read still returns `pending` +
   `mock-token-ml-05`. Proposal: fold a pending row whose `token_expires_at <= jurah_now()` to
   `expired` and drop the token, the same read-time rule invitations use (E-20). **Cost:** one
   CASE in `getMessagingLink`. It is never reached under the frozen clock, and E5 already renders
   `expired`. **If we don't:** the refusal lives only in WP6's webhook (E-43), and E5 keeps
   showing a dead token as pending until something rewrites the row. For WP6 and the lead to
   decide.

## 4. What I could not prove, and why

- **Nothing ran through `withSession()` itself.** The URL is empty, so the TypeScript functions
  (the driver's json parsing of `snapshots.data`, the `$3::json` text parameter, and the arrays
  coming back as JS arrays) were not exercised end to end. The SQL and the shapes were each
  proved (§5); the glue between them was not. The integration files cover it once the URL lands.
- **The live-row ordering proof inserts rows under their literal relatedIds** (`rx-draft-10`,
  `rf-03`). The real creators (WP3a/WP5) write opaque ids, and CR-041 then applies to `relatedId`
  as well. That is print-shapes' rule to widen at the gate.

## 5. Proof outputs (MCP, 2026-09-22)

Shown in the report back. In summary, every fixture line except `getAuditLog` was string-compared
directly: 13 IDENTICAL after the §2 steps, plus the one expected DIFFERS (the D-5 snapshot line).
**`getAuditLog` was proved by an md5 chain, not by a direct string compare.** (i) shape(inverted
mock rows) === the mock output, for 8 filter sets. (ii) mock(fresh store) === the fixture's 47 seed
rows. (iii) md5(the database's `row_to_json` rows) === md5(the inverted mock rows), for all 8 sets. The refusal matrix returns zero rows in every non-permitted cell for
`cg-03…cg-07` forged, ناصر pending-only, م. دانة, د. خالد and no session. The E-31 md5s for
حمد, عبدالله and سارة-as-cg-02 are identical. After all of it: `snapshots` 0 · `audit_events` 47 ·
`cg-03` pending · `settings(pt-04)` 0.
