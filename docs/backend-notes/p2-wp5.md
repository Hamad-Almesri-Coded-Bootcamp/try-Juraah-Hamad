# P2-WP5: write paths and enforcement, notes

Written by the WP5 implementer (brief: `docs/briefs/P2-WP5.md`, `docs/briefs/P2-common.md`),
2026-09-22. `JURAH_DATABASE_URL` is still empty, so no integration file has run against the
database: each one fails loudly (NOT A PASS). Every ENFORCEMENT row this package owns was proved by
hand through the Supabase MCP connector (project `frvubflbpujwuhsxweue`) with the exact
`PG_QUERIES_WRITES` text, under `set local role jurah_app` and the `jurah.session` / `jurah.now`
GUCs set the way `withSession()` sets them. Each proof ends in a raise, so every mutation rolls back.
The SQL and the results are in §4 and in the Gate 5 report.

## 1. What exists now

| File | What |
|---|---|
| `lib/data/pg/writes.ts` | The 14 writes: `updatePatientPhone`, `completeOnboarding`, `updateSettings`, `requestRefill`, `lookupMaskedName`, `inviteCaregiver`, `cancelInvitation`, `revokeCaregiver`, `acceptInvitation`, `declineInvitation`, `selfUnlink`, `submitReviewDecision`, `confirmPrescriptionFields`, `returnPrescriptionToClinic`. No `notImplemented()` is left. Every statement is in `PG_QUERIES_WRITES` (or `settingsUpsert(keys)`), so a gate proof runs the same text. |
| `lib/data/refusals/writes.ts` | `voidRefusal`, `refillRequestRefusal`, `maskedNameRefusal`, `inviteRefusal`, `acceptRefusal`, `prescriptionWriteRefusal`. Each returns a fresh value. `lib/data/mock-impl.ts` imports four of them on one `// WP5` line and uses them in exactly six places (requestRefill, inviteCaregiver, acceptInvitation ×2, confirm, return). The bytes are unchanged: the mock print-shapes run leaves `tests/fixtures/shapes.json` byte-identical (`cmp`). |
| `lib/data/shapes/writes.ts` | `toSettingsWrite` (patientId first for an existing row, **last** for a row the write creates, which is the mock's `{...DEFAULT_SETTINGS, patientId}`), `toRefillRequestWrite`, `toInvitedCaregiver`, `inPlace` (the mock's in-place mutation order), `pickConfirmedFields` / `confirmedDrug` (the five-key whitelist), `firstName`. |
| `supabase/migrations/0009_masked_name_lookup.sql` | `lookup_masked_name(civil_id, session_id)` (and `invitation_masked_name(caregiver_id)`, dropped again by 0010), `SECURITY DEFINER`. `jurah_app` has no SELECT on `accounts` (p2-wp1 §3.15), and SCHEMA.md §3 already assumed "lookupMaskedName's definer function", which no earlier migration built. The file is numbered **0009** because WP7's brief reserves 0008. It was applied with `apply_migration` and recorded in `supabase/README.md`. |
| `supabase/migrations/0010_lookup_rate_limit_wall_clock.sql` | Gate 5 follow-up (D-037, D-036): `lookup_masked_name` re-created so `lookup_audit.at` is stamped with `clock_timestamp()` and the 60-second window counts against `clock_timestamp()`; drops `invitation_masked_name`. Applied with `apply_migration`; stored md5 = file md5 `a7f44a1e489f7321542c9faf8045041e`. `scripts/guards/no-clock.ts` (guard 6) now allows a SQL clock read inside exactly two function bodies, `jurah_now()` and `lookup_masked_name()`, and its notes line names both and counts each one's reads. |
| `scripts/print-shapes.ts` | Changes to the Postgres run only (the mock run is unchanged; the fixture is byte-identical): `lookupMaskedName` ×2 run as حمد, `getInvitationForConsent(cg-08)` as سارة (D-024), `readLastKnownSnapshot` as حمد (D-5). The comparison applies CR-041 to created ids at any depth (`id`, `relatedId`, `prescriptionId`, `draftId`), and D-15/W6-4 to minted tokens and URLs (`linkToken`, `token`, `icsUrl`). It counts every substitution on the line, and on a DIFFERS it prints the first differing character with context. |
| Tests | `tests/unit/data/refusals.test.ts` (9 tests: every refusal literal in the barrel against the mock with a null session, and every place the mock does NOT refuse, asserted explicitly) · `tests/unit/data/writes-projection.test.ts` (11 tests: the whitelists, the refusal classifier, and key order against the mock on the same arguments) · `tests/integration/enforcement/{settings,identity,invitation,role,client}.test.ts` · `tests/integration/roundtrip/writes.test.ts` · helper `tests/integration/enforcement/_wp5.ts`. |

**Which test proves which row.** `settings.test.ts` proves E-09, E-10, E-11 and E-12.
`identity.test.ts` proves E-13 (bytes and 200 timed samples each), E-14 and E-15.
`invitation.test.ts` proves E-16, E-17, E-19, E-20 (the read-time half) and E-22 (the write half),
plus the success paths of accept, decline, cancel, revoke and self-unlink. `role.test.ts` proves
E-29, E-30, E-33, E-34, E-35 (the write half) and E-42. `client.test.ts` proves E-39.

E-18, E-21, E-23 and E-24 have no write as their proving call. They are proved in WP2's
`auth.test.ts` and WP3's `read-*.test.ts`.

## 2. The Postgres print-shapes run: which lines differ, and why

This section applies only when `JURAH_DATABASE_URL` exists. Under CR-041 every WP5 write line is
expected to be IDENTICAL: `updatePatientPhone`, `completeOnboarding`, `updateSettings(pt-01)`,
`requestRefill` (1 opaque id), both `lookupMaskedName` lines (run as حمد), `inviteCaregiver`
(1 opaque id), `cancelInvitation`, `revokeCaregiver`, `acceptInvitation(cg-03, as ناصر)`,
`declineInvitation`, `selfUnlink`, `submitReviewDecision`, `confirmPrescriptionFields(rx-006)` and
`returnPrescriptionToClinic(new flagged prescription)` (1 opaque id).

**CR-060 (Gate 5 follow-up).** The two clinic calls the fixture first recorded were mock-only
acceptances. The confirm carried no `strengthMg`, which violates CR-002 invariant (1). The return
was a second return of the seeded, already-returned rx-007 (E-34). `scripts/print-shapes.ts` now
records:
- a five-value confirm of rx-006: `drug: { genericName: '(unreadable)', brandName: 'Panadol', strengthMg: 500 }`
  plus frequency, start date and times. The stored `genericName` is passed so that the mock's
  wholesale `drug` replacement and the backend's merge (D-8) agree byte for byte;
- a first return of a still-pending flagged record: فاطمة scans an unreadable image (50 bytes →
  `needs_review`) and saves it (setup calls, not recorded), and د. خالد returns it. The fixture
  key is renamed `returnPrescriptionToClinic(new flagged prescription, as د. خالد)`.

rx-006 could not simply be returned before it is confirmed: a returned record can no longer be
confirmed (`prescription_clinical_fields_locked` admits a decision only from `pending`).

The mock run re-recorded the fixture. Exactly three keys changed: the confirm line, the return
line (renamed), and `getAuditLog (as م. دانة)`, which necessarily records those two writes' audit
rows (`تأكيد بيانات وصفة (unreadable)`, the new draft's `أُضيفت وصفة (unreadable)`, and
`أُعيدت وصفة (unreadable) للعيادة`: 64 → 65 rows). Every other key is byte-identical, in the same
order. A second mock run reproduces the fixture byte for byte (`cmp`).

What still DIFFERS by construction: `readLastKnownSnapshot(getPatient:pt-01)` (D-5, WP3d: the
serialised copy without `cg-09`).

## 3. How each write works (decisions taken here)

1. **Refusal mapping (D-022).** `isRefusal(e)` treats four kinds of error as refusals, never as
   throws: `42501` (RLS or a missing grant), `P0001` with one of the guard prefixes
   (`caregiver_transitions:`, `refill_routing:`, `alert_review_once:`,
   `prescription_clinical_fields_locked:`, `link_caregiver_must_be_active:`), `23xxx` (a named
   check, a foreign key, not-null) and `22xxx` (a value the column cannot hold). Everything else is
   re-thrown: `EngineInvariantError`, a lost connection, and `audit_events is append-only`, because
   no WP5 statement updates audit rows, so that one is a bug. Zero rows from RLS is a refusal too
   (p2-wp1 §3.10).
2. **Where the refusal happens.** Wherever it can, the trigger or RLS refuses, not a TypeScript
   check. `acceptInvitation` and `declineInvitation` carry **no status filter**, so
   `caregiver_transitions` decides every edge: E-17 and E-19 raise, which is the proof. The WHERE
   clause carries the mock's caller condition only where a trigger edge would admit more than the
   mock does:
   - `revokeCaregiver` requires a patient session, because the active→revoked edge also admits the
     caregiver itself.
   - `cancelInvitation` requires `status='pending'`. Otherwise cancelling an active row would revoke
     it under the wrong audit type.
   - `selfUnlink` requires the caregiver's own active row.
   - A pending-only session may act only on its own invitation (the mock's `s.subjectId === invitationId`).
3. **updateSettings.** The seam whitelists the seven keys, in the patch's order; an `undefined`
   value is skipped. One `INSERT … SELECT … WHERE <owner> ON CONFLICT DO UPDATE SET <given keys only>`
   follows WP3a's quiet pattern, so a caregiver gets 0 rows and no raise. A patch with no permitted
   key runs the no-op `language = settings.language` so the owner's `RETURNING` is non-empty.
   `settings_tracking_requires_link` resets a refused `true` quietly. The audit row is written only
   on an **observed** flip (the row before ≠ the row after), never on what the patch asked.
4. **requestRefill.** `routed_to` is NOT NULL, so the insert carries a placeholder, and the
   `refill_routing` trigger overwrites it from the prescription's own sector (E-42: a
   client-chosen `private_pharmacy` for rx-003 is stored `public_pharmacy`).
5. **lookupMaskedName.** With no verified session the null shape comes back and no transaction is
   opened (E-14: nothing to audit an anonymous caller against). Otherwise one statement runs,
   `lookup_masked_name`, which does four things in order:
   - it inserts the `lookup_audit` row;
   - it counts this session's rows in the last 60 s;
   - it always runs the account query **and** `mask_name` (a four-part stand-in when there is no account);
   - it returns null when the count is over 10 or there is no account.

   The response is built by one expression on both branches. Since migration 0010 the window is
   measured on the wall clock (`clock_timestamp()`, D-037). The rate-limit key is the verified
   cookie's `sid` (`readSessionClaims()`). A trusted script session has no sid, so it is keyed
   `script:<subjectId>`, which is reachable only outside a request.
6. **inviteCaregiver.** The row is inserted `pending`, with `invited_at = jurah_now()`,
   `expires_at = jurah_now() + 14 days` (`2026-10-05T09:15:00+03:00`) and `newId('cg')`. The audit
   message is the mock's neutral `دعوة مقدّم رعاية أُرسلت` **in every case** (D-036). The first
   build named the invitee when an account existed, which made the patient's activity feed an
   account oracle with no rate limit. That was reverted.
7. **acceptInvitation.** One transaction under the caller's own session does four things: the
   transition (the trigger decides), the audit row, the caller's old `sessions` row revoked (when
   it has a sid), and the new caregiver row via WP2's `insertSessionRow`.
   `session_row_ok` admits the new row because the caregivers row is active inside the same
   transaction. The signed cookie is written after the commit, through `writeSessionCookie(next, issued)`.
   A refusal returns the caller's own session (`acceptRefusal`).
8. **declineInvitation** revokes the pending-only session row and clears the cookie, but only when
   the decline succeeded and the session is pending-only for **this** invitation. **selfUnlink** revokes all
   the caregiver's own session rows and clears the cookie. **revokeCaregiver** revokes every live
   session row of that caregiver; the 0007 policy admits the linked patient.
9. **confirmPrescriptionFields (D-033).** One transaction:
   1. `loadPrescription`: RLS lets a reviewer see a flagged record;
   2. check `jurah_session_is('reviewer')` in the database, so no dose is touched for anyone else;
   3. build the confirmed record in TypeScript from the five values only, with the reviewer fields;
   4. `regenerateUpcoming` **first**;
   5. one UPDATE carrying the five columns and the review fields. There is no status filter, so
      the trigger's one-shot refuses a second confirm.

   0 rows or a raise throws `Refused` or propagates, which **rolls the regeneration back with it**.
   Then the audit row is written. The returned record is built in TypeScript, in the mock's
   in-place key order, and never re-read: after the update the reviewer may no longer see the row
   (WP4b P8). Values the database or the generator cannot hold (a malformed date, a non-integer
   frequency) are refused before any statement runs, because the generator would throw a
   `RangeError` into `error.tsx`.
10. **returnPrescriptionToClinic.** `needs_review` is **not touched**, so it stays `true` and the
    returned row stays visible to the reviewer (D-39; the MCP control shows `true|returned`). There
    is no status filter, so the one-shot trigger refuses a second return.
11. **submitReviewDecision** uses no `RETURNING`. It reads `patient_id` first while the alert is
    visible, then updates. A decided alert is invisible to the reviewer, so a second call matches
    0 rows. Where it is still visible (the owner with a reviewer GUC), `alert_review_once` raises.

## 4. Hand proofs through the MCP connector (full SQL and output in the Gate 5 report)

| Row | Result |
|---|---|
| E-09 | حمد upsert `adherence=true` → returned `false`, re-read `false`; سارة control false→true accepted; tracking audit rows 3 → 3 |
| E-11 | `update settings set patient_id` → `42501 permission denied for table settings`; `set role` → `42703 column "role" … does not exist` |
| E-12 | columns = `patient_id,adherence_check_in_enabled,adherence_check_in_frequency,refill_alerts_enabled,calendar_sync_enabled,web_push_enabled,notification_channel,language` |
| E-13 | 200 interleaved samples each (server-side `clock_timestamp()`, fresh session id per sample). **First function text** (mask on the account branch only): account median 177.5 µs, p95 226.1; no account median 159.5, p95 196.1. That 18 µs gap is why 0009 now masks on both branches. **Current text**: account median **185.5 µs**, p95 **229.0**; no account median **183.5 µs**, p95 **227.2**; 93/200 and 106/200 samples fall below the other side's median |
| E-14 | no session → NULL, 0 audit rows; calls #1–#10 return the masked name, #11 → NULL; 11 `lookup_audit` rows; 0 civil columns; another session unaffected; `select accounts` → 42501 |
| E-15 | a message carrying a Civil ID → `23514 … audit_message_no_civil_id`; 8 live messages written in print-shapes' order, 0 with a 12-digit run |
| E-16/E-19/E-29/E-35 | عبدالله and م. دانة against 13 write statements → 0 rows or RLS / `refill_routing` raises; fingerprint of every touched table before = after; a forged caregiver session for a new pending row reads 0 prescriptions, 0 doses, `session_row_ok=false`; cg-04…07 accept → `<status> → active is not an allowed transition` |
| E-17 | حمد → `caregiver_transitions: only the invited civil id may accept`; م. دانة, عبدالله, د. خالد → 0 rows; owner+system → the same raise; cg-03 stays `pending`; control: ناصر → `active|2026-09-21T09:15:00+03:00`. SECURITY DEFINER writers of `caregivers`: **none** (10 definers in the catalog, and the file grep is empty) |
| E-20 (read-time) | at 2026-10-03, accept and decline → `caregiver_transitions: the invitation has expired`; the consent fold reads `expired` while stored `pending` |
| E-33/E-34 | strengthMg-only confirm → `23514 rx_cr002_invariant_1`; full confirm → recordedIds 0, deleteUpcoming 0, insertDoses 30, update 1, row `active|pt-02|عيادة الياسمين|private|(unreadable)|5|1|2026-09-20|09:00|false|confirmed|acc-10`; second confirm → `prescription_clinical_fields_locked`; return rx-007 again → `…decided once…`; confirm rx-009 → 0 rows; `generic_name` → `prescription_clinical_fields_locked`; `interaction_alerts.description` → 42501; ia-002 → 0 rows; ia-001 first → 1, second → 0; owner+reviewer second decision → `alert_review_once: this alert has already been decided`; **G1: recorded doses identical after the regeneration** (5 rows) |
| E-39 | no-session raw insert → RLS `42501`; `jurah_app` update/delete → 42501; owner update/delete → `audit_events is append-only` |
| E-42 | حمد rx-008 → `refill_routing: prescription not found for this patient`; rx-004 → `…is not active`; عبدالله → RLS 42501; client `private_pharmacy` for rx-003 → stored `public_pharmacy`; rx-002 → the fixture's row; refused rows present 0 |
| G1 delete policy | سارة `delete` of recorded `rx-008-20260921-0700` → 0 rows; `update doses set status` → 42501; the row is still `taken_on_time` |

## 5. Things found out the hard way

- **The fixture's own confirm call is an invalid record** under CR-002 invariant (1). So is the
  brief's literal E-33 call (`strengthMg: 5` alone), which the database refuses whole. It cannot
  "change strengthMg only". E-33 is proved with the four other values supplied, and the literal
  call is shown refused.
- **print-shapes' return call is a second return.** rx-007 is seeded `returned`.
- **The masked-name lookup was not constant-work until both branches masked.** The same query
  plan is not the same work: `mask_name` is a plpgsql loop that ran only for an account. The first
  timing run measured an 18 µs median gap. After the change the gap is 2 µs, with interleaved
  samples on either side. The migration was re-applied in place (create-or-replace), and the stored
  history text in `supabase_migrations.schema_migrations` was updated so that its md5 equals the
  file's (`a3be7c34862033e3d1e0c1e91990fde2`; the first text was `019b0b29…`).
- **The frozen clock made the rate limit permanent per session** (the first build): `jurah_now()`
  never advances (D-021), so the 60 s window never passed. D-037 resolved it with the wall clock in
  that one function (migration 0010). The re-proof ages the rows: after 59 s they are still counted
  (a 12th call is refused); after 61 s they are not (a 13th call is answered).
- **`RETURNING` after a write that ends the caller's read access** is avoided on the prescription
  and alert updates (WP4b P8's lesson), and the returned shape is built in TypeScript instead.
- **A 12-digit run in a name the patient typed** would make the cancel/revoke audit insert fail
  `audit_message_no_civil_id`. The whole write is then refused and rolled back, where the mock
  would write it. That is the safe side, and no seed name has digits.
- **The owner can TRUNCATE `audit_events`**: the statement trigger covers UPDATE and DELETE only,
  and the seed needs TRUNCATE. `jurah_app` has no TRUNCATE grant (asserted). See CR-WP5-5.
- **A raw audit insert by `jurah_app` WITH a session is accepted by the database**
  (`audit_insert_session` checks only that a session exists, not who the actor is). "Only
  `append()` writes an audit row" is guard 8's static rule (d). `client.test.ts` runs guard 8 as
  its runtime twin. See CR-WP5-4.
- `timeout(1)` does not exist on this machine (macOS), and a command wrapped in it exits 127.

## 6. What is not proven, and why

- Nothing in `tests/integration/**` has run against the database (no `JURAH_DATABASE_URL`). The
  loud NOT-A-PASS output is in the report. The same assertions were made by hand (§4), except
  those that need the seam's TypeScript around the SQL, which cannot run against the database
  from here:
  - the projections and key order (the unit tests prove these against the mock on the same arguments);
  - the cookie written after accept;
  - the end-to-end latency of `pg.lookupMaskedName` (only the SQL half was timed);
  - `isRefusal` on a real driver error (unit-tested on the error shapes Postgres returned in §4).
- `print-shapes --backend=postgres` exits 1 before calling anything (no URL). §2 is the expected table.
- The CR-041 comparator in print-shapes has not executed on real opaque ids.

## Divergences

Same columns as `docs/BACKEND-DIVERGENCES.md`, numbered `WP5-n` for the lead to renumber.

| # | Function / place | Mock | Backend | Why | Could a screen notice? |
|---|---|---|---|---|---|
| WP5-1 | `confirmPrescriptionFields` whose confirmed record lacks one of the four CR-002 clinical fields (print-shapes' own call) | Writes `needsReview:false`, `confirmed` with no `strengthMg`, and regenerates | Refused by `rx_cr002_invariant_1`; the regeneration rolls back; the unchanged record is returned | CR-002 invariant (1), owner-approved | Only if G3s submits without a strength. Its form carries all five, and CR-052 lists `strengthMg` as uncertain, so it is asked for |
| WP5-2 | `confirmPrescriptionFields` `drug` | `Object.assign` replaces `drug` wholesale (`{genericName:'Paracetamol'}`) | `brandName`/`strengthMg` merged into the stored drug; `genericName` never changes; the audit message names the stored generic name | D-8, E-33 | No: G3s never sends `genericName` |
| WP5-3 | `inviteCaregiver`'s `caregiver_invited` message | Always `دعوة مقدّم رعاية أُرسلت` | **The same neutral line in every case** (D-036, Gate 5 follow-up). The first build named the invitee (`دعوة مقدّم رعاية إلى <masked>`) when an account existed; that was reverted — see WP5-14 | — | No |
| WP5-4 | `updateSettings` refused (not the owner) | Returns the stored row to **any** caller, a null session included | Returns the row only when RLS lets the caller read it (an active caregiver, a reviewer with a queue item); otherwise the documented defaults | RLS; no read leak through a write | No: only E3 and A2 call it, under the owner's session |
| WP5-5 | `confirmPrescriptionFields` / `returnPrescriptionToClinic` refused | Returns the stored record to any caller | The unchanged record when the caller may read it, else `{ id }` (the mock's missing-row shape) | RLS | No: only G3s calls them, as a reviewer |
| WP5-6 | `lookupMaskedName` in the Postgres print-shapes run | Called with no session | Called as حمد: with no session the backend answers `{maskedName:null}` for both IDs (E-14) | D-9 / E-14, like D-024 | No |
| WP5-7 | `acceptInvitation` | Overwrites the cookie | Also revokes the caller's previous `sessions` row (the pending-only row, or the patient row of a role session) | D-018: a replaced cookie should not stay live | No: the browser holds only the new cookie |
| WP5-8 | `declineInvitation` cookie | Cleared whenever the caller is authorised, even if the decline itself failed | Cleared (and the row revoked) only when the decline succeeded | A failed decline leaves the invitation pending, so the session must stay | No |
| WP5-9 | `updateSettings` with a value the column cannot hold (`notificationChannel:'sms'`) or a permitted key set to `undefined` | Stores it (or deletes the key from the row) | Refused: the current row back / the key skipped | The column type; the contract | No: every screen sends contract values |
| WP5-10 | A settings row created by `updateSettings` (بدر) | `patientId` last in every later read | The write's own return has `patientId` last (as the mock); a later `getSettings` returns `patientId` first (WP3d's projection) | The mock's key order comes from its storage history | No: key order is not rendered |
| WP5-11 | `confirmPrescriptionFields` / `returnPrescriptionToClinic` key order on a later READ | The mutated object keeps the appended order | The write's return reproduces it; a later `getPrescription` / `getFlaggedPrescription` returns the canonical order | Storage | No |
| WP5-12 | The lookup rate limit's clock | No limit | 10 lookups per session in a 60-second window measured on the **wall clock** (`clock_timestamp()`, migration 0010, D-037 — the one sanctioned exception to D-021). The first build used `jurah_now()`, under which the eleventh lookup was refused for the session's whole life | Rate limiting is operational, not a domain time comparison | Only on an 11th lookup inside one real minute |
| WP5-14 | `inviteCaregiver`'s audit wording as an account oracle (G9) — **closed** | Neutral wording always | Neutral wording always (D-036). The masked wording of the first build let N invitations answer N "has an account?" questions in the activity feed with no rate limit; reverted, and 0010 drops the now-unused `invitation_masked_name()` | G9 | No |
| WP5-13 | Cancel/revoke/accept/decline/self-unlink audit messages for a typed name containing 12 digits | Written | The whole write refused (`audit_message_no_civil_id`) | E-15 | No seed or realistic name |

## Change requests

- **CR-WP5-1: print-shapes' recorded confirm and return calls.** **Resolved as CR-060** (Gate 5 follow-up): see §2.
- **CR-WP5-2: ENFORCEMENT E-33's rejected call.** Taken up in CR-060: the lead amends E-33 to carry all five values plus the foreign keys. `role.test.ts` proves that form, and keeps the literal strengthMg-only call as a second assertion (refused whole).
- **CR-WP5-3: carry the verified `sid` in `jurah.session`** (`lib/db/withSession.ts`, lead-owned),
  so that `lookup_masked_name` keys the rate limit from the GUC instead of a parameter the seam
  supplies.
- **CR-WP5-4 (now CR-061, OPEN): `audit_insert_session` accepts any actor from any session.** Tighten the WITH CHECK
  so the actor is the session's own subject/role or `system`. Today the only thing stopping
  seam code from writing `actor_role='admin'` is guard 8's static rule. A schema change.
- **CR-WP5-5 (closed by the lead: the sanctioned seed exception): TRUNCATE on `audit_events` by the owner.** Add a `before truncate` trigger that
  admits only the seed, for example behind a seed-only GUC. The seed needs TRUNCATE, so this is the
  lead's design.
- **CR-WP5-6: a second generator call site in `savePrescriptionDraft`.** **Fixed** (Gate 5 follow-up, lead's go-ahead): `lib/data/pg/reads-rx.ts` now calls `lib/engine`'s `insertGeneratedDoses(sql, rx, trackingOn)`. Only the import and the generation lines changed. The engine's payload is byte-identical to the old one (21 doses, tracking off and on; scratch comparison in the report), and `source` is still `'seed'`.
- **CR-WP5-7: migration numbering.** 0009 was taken because WP7's brief reserves 0008. WP7 has
  since added `0008_agent_grants.sql`, and `list_migrations` shows it applied **after** 0009
  (versions `20260922192705` for 0009, `20260922201849` for 0008). The two are independent: 0008
  revokes and re-grants `jurah_agent`'s column SELECTs on `patients`/`caregivers` and all of
  `accounts` from `jurah_agent`. It touches no `jurah_app` grant, no `lookup_audit`, and neither
  0009 function, so no WP5 hand proof (all run as `jurah_app` or the owner) depends on it. On a
  fresh database migrate.ts applies 0008 before 0009, which is equally safe.
- **CR-WP5-8: `supabase/README.md`'s "six migrations".** **Fixed**: the section now describes 0001–0010, and says that `list_migrations` shows the files in application order (0009 before 0008).

## Gate 5 follow-up (D-036, D-037, CR-060, CR-WP5-6)

- **D-036**: `inviteCaregiver` writes the neutral line always; `invitation_masked_name()` is dropped (0010). The E-15 and E-16 tests now assert the neutral line for an invitee WITH an account.
- **D-037**: migration 0010 (wall-clock window, see §1). E-14 was re-proved by hand, and the decay step is in `identity.test.ts`. E-13's timing was re-run on the new function text: account median 105.0 µs / p95 147.2; no account median 102.0 µs / p95 135.1; 83/200 and 109/200 samples below the other side's median.
- **One point for the lead.** D-037's text says the limit "stays keyed by `subject_id`". The build keys it by **session**: the verified cookie's `sid`, passed as `p_session_id`, or `script:<subjectId>` for a trusted script session with no sid. This is what the brief and ENFORCEMENT E-14 say ("rate-limited per session"). Two sessions of the same person are therefore limited separately. Keying by `subject_id` is a one-line change in 0010's WHERE clause if the lead prefers it.
- **CR-060**: §2. **CR-WP5-6**: fixed. **README**: fixed.
