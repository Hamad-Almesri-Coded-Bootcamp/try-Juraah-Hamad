# P2-WP3c: refills and the calendar read, notes

Written by the WP3c implementer (brief: `docs/briefs/P2-WP3.md` § WP3c, `docs/briefs/P2-common.md`).
Three seam functions now have a Postgres body: `getRefillOverview`, `getRefillRequests` and
`getCalendarSubscription`.

| File | What it holds |
|---|---|
| `lib/data/pg/reads-supply.ts` | The three functions, each one `withSession()` call. `PG_QUERIES_SUPPLY` holds the exact SQL text, so a gate proof can run the same string through MCP. |
| `lib/data/refusals/reads-supply.ts` | `refillOverviewRefusal()` → `[]` · `refillRequestsRefusal()` → `[]` · `calendarSubscriptionRefusal()` → `null` |
| `lib/data/shapes/reads-supply.ts` | `toRefillLine` · `toRefillRequest` · `toCalendarSubscriptionRead`, each in the mock's key order |
| `lib/data/mock-impl.ts` | Only the three refusal returns of these functions now call the literals above, plus one new import line. The behaviour and the bytes are unchanged. |
| `tests/unit/data/supply-projection.test.ts` | 21 tests, part of `npm run verify`. The MCP rows go through the projection and are compared as strings with `shapes.json` and with the mock. |
| `tests/integration/roundtrip/supply.test.ts` | The round trip over the real `withSession()` path. It compares strings with `shapes.json`, first for the seeded part and then for the whole recorded shape. |
| `tests/integration/enforcement/read-supply.test.ts` | E-21 (5 × 3), the positive controls, reviewer gating, CR-040, and "reads never write" |

## 1. How each function is served

- **`getRefillOverview(patientId)`** selects the patient's `active` prescriptions in `seq` order.
  `seq` order is the seed's insertion order, which is the mock's store order. The query casts every
  numeric to `float8` and formats the dispense date with `to_char`. It derives `routed_to` in SQL
  from the prescription's own `sector`. Each row then goes through **`depletionFor(row)` from
  WP4b's `lib/engine/depletion.ts`**, which calls `computeDepletion` from `lib/schedule/depletion.ts`
  unedited. The brief says to prefer the WP4b module if it exists. It did not exist when this
  package started, so a local mapper was written first. That mapper was removed once
  `lib/engine/depletion.ts` appeared, so the refill screen and the engine map a row the same way.
  CR-040 is still `OPEN`, so flagged prescriptions are **included**, as the mock does (D-24).
- **`getRefillRequests(patientId)`** selects the patient's rows `order by seq`. The
  `refills_select` policy is exactly `can_read_patient(patient_id)`, the mock's gate.
- **`getCalendarSubscription(patientId)`** reads the patient's row. The `calendar_select` policy
  allows the owning patient and the `system` actor, and the seam never passes `system`. A caregiver,
  reviewer or admin therefore gets `null`, as the mock does.
- Reads never write: there is no `append()`, `insert`, `update` or `delete` in the file. The
  integration test `reads never write …` compares counts before and after the calls (§2.2).

## 2. The proofs, run by hand through MCP (`JURAH_DATABASE_URL` is empty in `.env.local`)

The integration suite fails loudly without the URL:

```
!! integration skipped — JURAH_DATABASE_URL not set — NOT A PASS
 ❯ tests/integration/roundtrip/supply.test.ts (5 tests | 5 skipped)
!! integration skipped — JURAH_DATABASE_URL not set — NOT A PASS
 ❯ tests/integration/enforcement/read-supply.test.ts (27 tests | 27 skipped)
 Test Files  2 failed (2)
      Tests  32 skipped (32)
```

### 2.1 Every probe in ONE MCP call, reproducing `withSession()` per probe

The call runs these steps inside one transaction:

1. As the owner, it resolves each session's Civil ID with `civil_id_for_session(...)`. No Civil ID
   is ever typed into the SQL or printed.
2. It runs `set local role jurah_app`.
3. For each probe, it sets `jurah.session` and `EXECUTE`s the exact `PG_QUERIES_SUPPLY` text with
   `using $1`. This is the same binding as the seam's `sql.unsafe(text, [patientId])`.

The SQL is generated from the module itself (`batch-sql.ts` imports `PG_QUERIES_SUPPLY`), so the
query text cannot drift from the code:

<details><summary>SQL (44 probes)</summary>

```sql
do $do$
declare
  sess jsonb := '{}'; q jsonb := '{}'; out jsonb := '{}'; r text; pr text[];
begin
  sess := sess || jsonb_build_object('none', '');
  sess := sess || jsonb_build_object('hamad', jsonb_strip_nulls(jsonb_build_object('subjectId','pt-01','role','patient','linkedPatientId',null,'pendingInvitationOnly',false,'civilId',civil_id_for_session('pt-01','patient'::role_t,false))));
  sess := sess || jsonb_build_object('fatima', jsonb_strip_nulls(jsonb_build_object('subjectId','pt-02','role','patient','linkedPatientId',null,'pendingInvitationOnly',false,'civilId',civil_id_for_session('pt-02','patient'::role_t,false))));
  sess := sess || jsonb_build_object('sara', jsonb_strip_nulls(jsonb_build_object('subjectId','pt-03','role','patient','linkedPatientId',null,'pendingInvitationOnly',false,'civilId',civil_id_for_session('pt-03','patient'::role_t,false))));
  sess := sess || jsonb_build_object('badr', jsonb_strip_nulls(jsonb_build_object('subjectId','pt-04','role','patient','linkedPatientId',null,'pendingInvitationOnly',false,'civilId',civil_id_for_session('pt-04','patient'::role_t,false))));
  sess := sess || jsonb_build_object('abdullah', jsonb_strip_nulls(jsonb_build_object('subjectId','cg-01','role','caregiver','linkedPatientId','pt-01','pendingInvitationOnly',false,'civilId',civil_id_for_session('cg-01','caregiver'::role_t,false))));
  sess := sess || jsonb_build_object('cg03', jsonb_strip_nulls(jsonb_build_object('subjectId','cg-03','role','caregiver','linkedPatientId','pt-01','pendingInvitationOnly',false,'civilId',civil_id_for_session('cg-03','caregiver'::role_t,false))));
  sess := sess || jsonb_build_object('cg04', jsonb_strip_nulls(jsonb_build_object('subjectId','cg-04','role','caregiver','linkedPatientId','pt-01','pendingInvitationOnly',false,'civilId',civil_id_for_session('cg-04','caregiver'::role_t,false))));
  sess := sess || jsonb_build_object('cg05', jsonb_strip_nulls(jsonb_build_object('subjectId','cg-05','role','caregiver','linkedPatientId','pt-01','pendingInvitationOnly',false,'civilId',civil_id_for_session('cg-05','caregiver'::role_t,false))));
  sess := sess || jsonb_build_object('cg06', jsonb_strip_nulls(jsonb_build_object('subjectId','cg-06','role','caregiver','linkedPatientId','pt-01','pendingInvitationOnly',false,'civilId',civil_id_for_session('cg-06','caregiver'::role_t,false))));
  sess := sess || jsonb_build_object('cg07', jsonb_strip_nulls(jsonb_build_object('subjectId','cg-07','role','caregiver','linkedPatientId','pt-01','pendingInvitationOnly',false,'civilId',civil_id_for_session('cg-07','caregiver'::role_t,false))));
  sess := sess || jsonb_build_object('naserPending', jsonb_strip_nulls(jsonb_build_object('subjectId','cg-03','role',null,'linkedPatientId',null,'pendingInvitationOnly',true,'civilId',civil_id_for_session('cg-03',null::role_t,true))));
  sess := sess || jsonb_build_object('khalid', jsonb_strip_nulls(jsonb_build_object('subjectId','acc-10','role','reviewer','linkedPatientId',null,'pendingInvitationOnly',false,'civilId',civil_id_for_session('acc-10','reviewer'::role_t,false))));
  sess := sess || jsonb_build_object('dana', jsonb_strip_nulls(jsonb_build_object('subjectId','acc-11','role','admin','linkedPatientId',null,'pendingInvitationOnly',false,'civilId',civil_id_for_session('acc-11','admin'::role_t,false))));
  q := q || jsonb_build_object('getRefillOverview', $q$
    select p.id, p.patient_id, p.facility_name, p.sector::text as sector, p.generic_name, p.brand_name,
           p.dose_per_administration::float8 as dose_per_administration, p.frequency_per_day,
           p.duration_days, p.dosing_pattern::text as dosing_pattern,
           p.dispensing_units_per_package,
           p.dispensing_total_quantity_dispensed::float8 as dispensing_total_quantity_dispensed,
           to_char(p.dispensing_dispense_date, 'YYYY-MM-DD') as dispensing_dispense_date,
           p.dispensing_brand_actually_dispensed,
           p.needs_review, p.status::text as status,
           case when p.sector = 'public' then 'public_pharmacy' else 'private_pharmacy' end as routed_to
    from prescriptions p
    where p.patient_id = $1 and p.status = 'active' and can_read_patient(p.patient_id)
    order by p.seq$q$);
  q := q || jsonb_build_object('getRefillRequests', $q$
    select r.id, r.patient_id, r.prescription_id, iso_kw(r.requested_at) as requested_at,
           r.routed_to::text as routed_to, r.status::text as status
    from refill_requests r
    where r.patient_id = $1
    order by r.seq$q$);
  q := q || jsonb_build_object('getCalendarSubscription', $q$
    select c.patient_id, c.ics_url, c.token
    from calendar_subscriptions c
    where c.patient_id = $1$q$);
  perform set_config('jurah.now', '2026-09-21T09:15:00+03:00', true);
  execute 'set local role jurah_app';
  foreach pr slice 1 in array array[
    array['hamad','getRefillOverview','pt-01'],
    array['hamad','getRefillRequests','pt-01'],
    array['hamad','getCalendarSubscription','pt-01'],
    array['sara','getCalendarSubscription','pt-03'],
    array['sara','getRefillOverview','pt-03'],
    array['sara','getRefillRequests','pt-03'],
    array['fatima','getRefillOverview','pt-02'],
    array['badr','getRefillOverview','pt-04'],
    array['badr','getRefillRequests','pt-04'],
    array['abdullah','getRefillOverview','pt-01'],
    array['abdullah','getRefillRequests','pt-01'],
    array['abdullah','getCalendarSubscription','pt-01'],
    array['khalid','getRefillOverview','pt-01'],
    array['khalid','getRefillOverview','pt-02'],
    array['khalid','getRefillOverview','pt-03'],
    array['khalid','getRefillRequests','pt-01'],
    array['khalid','getCalendarSubscription','pt-03'],
    array['hamad','getRefillOverview','pt-03'],
    array['hamad','getRefillRequests','pt-03'],
    array['hamad','getCalendarSubscription','pt-03'],
    array['cg03','getRefillOverview','pt-01'],
    array['cg03','getRefillRequests','pt-01'],
    array['cg03','getCalendarSubscription','pt-03'],
    array['cg04','getRefillOverview','pt-01'],
    array['cg04','getRefillRequests','pt-01'],
    array['cg04','getCalendarSubscription','pt-03'],
    array['cg05','getRefillOverview','pt-01'],
    array['cg05','getRefillRequests','pt-01'],
    array['cg05','getCalendarSubscription','pt-03'],
    array['cg06','getRefillOverview','pt-01'],
    array['cg06','getRefillRequests','pt-01'],
    array['cg06','getCalendarSubscription','pt-03'],
    array['cg07','getRefillOverview','pt-01'],
    array['cg07','getRefillRequests','pt-01'],
    array['cg07','getCalendarSubscription','pt-03'],
    array['naserPending','getRefillOverview','pt-01'],
    array['naserPending','getRefillRequests','pt-01'],
    array['naserPending','getCalendarSubscription','pt-03'],
    array['dana','getRefillOverview','pt-01'],
    array['dana','getRefillRequests','pt-01'],
    array['dana','getCalendarSubscription','pt-03'],
    array['none','getRefillOverview','pt-01'],
    array['none','getRefillRequests','pt-01'],
    array['none','getCalendarSubscription','pt-03']] loop
    perform set_config('jurah.session', case when jsonb_typeof(sess->pr[1]) = 'string' then sess->>pr[1] else (sess->pr[1])::text end, true);
    execute 'select coalesce(json_agg(t), ''[]''::json)::text from (' || (q->>pr[2]) || ') t' into r using pr[3];
    out := out || jsonb_build_object(pr[1] || '|' || pr[2] || '|' || pr[3], r::jsonb);
  end loop;
  perform set_config('wp3c.out', out::text, true);
  perform set_config('wp3c.user', current_user, true);
end
$do$;
select current_setting('wp3c.user') as ran_as, current_setting('wp3c.out') as out;
```
</details>

The result was `ran_as = jurah_app`. The rows it returned were fed through the same projection
the pg functions use, and the output was compared as strings with the mock implementation (called
under the same session) and with `tests/fixtures/shapes.json`:

```
IDENTICAL hamad|getRefillOverview|pt-01                [{"prescriptionId":"rx-001","genericName":"Warfarin","brandName":"Marevan","remaining":...
IDENTICAL hamad|getRefillRequests|pt-01                [{"id":"rf-01","patientId":"pt-01","prescriptionId":"rx-003","requestedAt":"2026-09-20T...
IDENTICAL hamad|getCalendarSubscription|pt-01          null
IDENTICAL sara|getCalendarSubscription|pt-03           {"patientId":"pt-03","icsUrl":"webcal://jurah.app/calendar/pt-03.ics","token":"mock-tok...
IDENTICAL sara|getRefillOverview|pt-03                 [{"prescriptionId":"rx-008","genericName":"Levothyroxine","brandName":"Eltroxin","remai...
IDENTICAL sara|getRefillRequests|pt-03                 []
IDENTICAL fatima|getRefillOverview|pt-02               [{"prescriptionId":"rx-005","genericName":"Prednisolone","remaining":null,"total":null,...
IDENTICAL badr|getRefillOverview|pt-04                 []
IDENTICAL badr|getRefillRequests|pt-04                 []
IDENTICAL abdullah|getRefillOverview|pt-01             [{"prescriptionId":"rx-001","genericName":"Warfarin","brandName":"Marevan","remaining":...
IDENTICAL abdullah|getRefillRequests|pt-01             [{"id":"rf-01","patientId":"pt-01","prescriptionId":"rx-003","requestedAt":"2026-09-20T...
IDENTICAL abdullah|getCalendarSubscription|pt-01       null
IDENTICAL khalid|getRefillOverview|pt-01               [{"prescriptionId":"rx-001","genericName":"Warfarin","brandName":"Marevan","remaining":...
IDENTICAL khalid|getRefillOverview|pt-02               [{"prescriptionId":"rx-005","genericName":"Prednisolone","remaining":null,"total":null,...
IDENTICAL khalid|getRefillOverview|pt-03               []
IDENTICAL khalid|getRefillRequests|pt-01               [{"id":"rf-01","patientId":"pt-01","prescriptionId":"rx-003","requestedAt":"2026-09-20T...
IDENTICAL khalid|getCalendarSubscription|pt-03         null
IDENTICAL hamad|getRefillOverview|pt-03                []
IDENTICAL hamad|getRefillRequests|pt-03                []
IDENTICAL hamad|getCalendarSubscription|pt-03          null
IDENTICAL cg03|getRefillOverview|pt-01                 []
IDENTICAL cg03|getRefillRequests|pt-01                 []
IDENTICAL cg03|getCalendarSubscription|pt-03           null
IDENTICAL cg04|getRefillOverview|pt-01                 []
IDENTICAL cg04|getRefillRequests|pt-01                 []
IDENTICAL cg04|getCalendarSubscription|pt-03           null
IDENTICAL cg05|getRefillOverview|pt-01                 []
IDENTICAL cg05|getRefillRequests|pt-01                 []
IDENTICAL cg05|getCalendarSubscription|pt-03           null
IDENTICAL cg06|getRefillOverview|pt-01                 []
IDENTICAL cg06|getRefillRequests|pt-01                 []
IDENTICAL cg06|getCalendarSubscription|pt-03           null
IDENTICAL cg07|getRefillOverview|pt-01                 []
IDENTICAL cg07|getRefillRequests|pt-01                 []
IDENTICAL cg07|getCalendarSubscription|pt-03           null
IDENTICAL naserPending|getRefillOverview|pt-01         []
IDENTICAL naserPending|getRefillRequests|pt-01         []
IDENTICAL naserPending|getCalendarSubscription|pt-03   null
IDENTICAL dana|getRefillOverview|pt-01                 []
IDENTICAL dana|getRefillRequests|pt-01                 []
IDENTICAL dana|getCalendarSubscription|pt-03           null
IDENTICAL none|getRefillOverview|pt-01                 []
IDENTICAL none|getRefillRequests|pt-01                 []
IDENTICAL none|getCalendarSubscription|pt-03           null

vs mock under the same session: 44 identical · 0 differ — of 44 probes

— string comparison with tests/fixtures/shapes.json —
IDENTICAL getCalendarSubscription(pt-03)  [whole]
   pg:      {"patientId":"pt-03","icsUrl":"webcal://jurah.app/calendar/pt-03.ics","token":"mock-token-cal-pt-03"}
   fixture: {"patientId":"pt-03","icsUrl":"webcal://jurah.app/calendar/pt-03.ics","token":"mock-token-cal-pt-03"}
IDENTICAL getRefillOverview(pt-01)  [seeded lines 0..2]
   pg:      [{"prescriptionId":"rx-001","genericName":"Warfarin","brandName":"Marevan","remaining":70,"total":90,"daysRemaining":70,"routedTo":"public_pharmacy"},{"prescriptionId":"rx-002","genericName":"Ibuprofen","brandName":"Brufen","remaining":15,"total":21,"daysRemaining":5,"routedTo":"private_pharmacy"},{"prescriptionId":"rx-003","genericName":"Metformin","brandName":"Glucophage","remaining":20,"total":60,"daysRemaining":10,"routedTo":"public_pharmacy"}]
   fixture: [{"prescriptionId":"rx-001","genericName":"Warfarin","brandName":"Marevan","remaining":70,"total":90,"daysRemaining":70,"routedTo":"public_pharmacy"},{"prescriptionId":"rx-002","genericName":"Ibuprofen","brandName":"Brufen","remaining":15,"total":21,"daysRemaining":5,"routedTo":"private_pharmacy"},{"prescriptionId":"rx-003","genericName":"Metformin","brandName":"Glucophage","remaining":20,"total":60,"daysRemaining":10,"routedTo":"public_pharmacy"}]
IDENTICAL getRefillRequests(pt-01)  [seeded rows 0..1]
   pg:      [{"id":"rf-01","patientId":"pt-01","prescriptionId":"rx-003","requestedAt":"2026-09-20T18:05:00+03:00","routedTo":"public_pharmacy","status":"requested"},{"id":"rf-02","patientId":"pt-01","prescriptionId":"rx-001","requestedAt":"2026-08-20T09:00:00+03:00","routedTo":"public_pharmacy","status":"approved"}]
   fixture: [{"id":"rf-01","patientId":"pt-01","prescriptionId":"rx-003","requestedAt":"2026-09-20T18:05:00+03:00","routedTo":"public_pharmacy","status":"requested"},{"id":"rf-02","patientId":"pt-01","prescriptionId":"rx-001","requestedAt":"2026-08-20T09:00:00+03:00","routedTo":"public_pharmacy","status":"approved"}]

12-digit scan over every projected shape: 0 matches
```

Every session got the same bytes as the mock: 44 of 44. They cover حمد, فاطمة, سارة, بدر (no
rows), عبدالله (active caregiver), د. خالد (reviewer), the five non-active caregivers, ناصر
(pending-only), م. دانة (admin), no session, and another patient's id.

### 2.2 The created rows, and derived routing: one MCP call, net zero

This call does the following:

1. As the `system` actor, it inserts `rx-draft-10` exactly as the mock's `savePrescriptionDraft`
   records it (the fixture `savePrescriptionDraft(pt-01)`).
2. It inserts `rf-03` with a **client-supplied `routed_to = 'public_pharmacy'` for the private
   `rx-002`**.
3. It inserts a probe prescription for pt-04 (`needs_review`, field review `confirmed`).
4. It drops to `jurah_app` and runs the two queries as حمد, then the RLS-only count and the
   overview query as د. خالد.
5. It deletes all three rows before commit, so no other package ever saw them.

Output, reordered by key:

```
ran_as: jurah_app
caregiver_statuses: cg-03 pending · cg-04 declined · cg-05 expired · cg-06 revoked · cg-07 revoked
hamad|getRefillRequests|pt-01 (+created): … {"id":"rf-03","status":"requested","routed_to":"private_pharmacy", …}
khalid|RLS alone: prescriptions of pt-04: 1
khalid|getRefillOverview query rows for pt-04: 0
counts_before = counts_after = {audit_events 47, snapshots 0, prescriptions 9, refill_requests 2, calendar_subscriptions 1}
```

The equal counts show only that this call was **net zero**: its own inserts and deletes ran inside
the same transaction. They do not show that the reads write nothing. That proof is the integration
test `reads never write …`, which counts before and after 20 seam calls and is pending the URL.
The code-level fact behind it: `lib/data/pg/reads-supply.ts` contains no `append()`, `insert`,
`update` or `delete`.

The `refill_routing` trigger overwrote the client's `public_pharmacy` with `private_pharmacy`
(E-42's routing half, observed on the read side). The returned rows, projected, match the
**whole** recorded shapes:

```
IDENTICAL getRefillOverview(pt-01) [whole]
   pg:      [{"prescriptionId":"rx-001","genericName":"Warfarin","brandName":"Marevan","remaining":70,"total":90,"daysRemaining":70,"routedTo":"public_pharmacy"},{"prescriptionId":"rx-002","genericName":"Ibuprofen","brandName":"Brufen","remaining":15,"total":21,"daysRemaining":5,"routedTo":"private_pharmacy"},{"prescriptionId":"rx-003","genericName":"Metformin","brandName":"Glucophage","remaining":20,"total":60,"daysRemaining":10,"routedTo":"public_pharmacy"},{"prescriptionId":"rx-draft-10","genericName":"Ibuprofen","brandName":"Brufen","remaining":null,"total":null,"daysRemaining":null,"routedTo":"public_pharmacy"}]
   fixture: [{"prescriptionId":"rx-001","genericName":"Warfarin","brandName":"Marevan","remaining":70,"total":90,"daysRemaining":70,"routedTo":"public_pharmacy"},{"prescriptionId":"rx-002","genericName":"Ibuprofen","brandName":"Brufen","remaining":15,"total":21,"daysRemaining":5,"routedTo":"private_pharmacy"},{"prescriptionId":"rx-003","genericName":"Metformin","brandName":"Glucophage","remaining":20,"total":60,"daysRemaining":10,"routedTo":"public_pharmacy"},{"prescriptionId":"rx-draft-10","genericName":"Ibuprofen","brandName":"Brufen","remaining":null,"total":null,"daysRemaining":null,"routedTo":"public_pharmacy"}]
IDENTICAL getRefillRequests(pt-01) [whole]
   pg:      [{"id":"rf-01","patientId":"pt-01","prescriptionId":"rx-003","requestedAt":"2026-09-20T18:05:00+03:00","routedTo":"public_pharmacy","status":"requested"},{"id":"rf-02","patientId":"pt-01","prescriptionId":"rx-001","requestedAt":"2026-08-20T09:00:00+03:00","routedTo":"public_pharmacy","status":"approved"},{"id":"rf-03","patientId":"pt-01","prescriptionId":"rx-002","requestedAt":"2026-09-21T09:15:00+03:00","routedTo":"private_pharmacy","status":"requested"}]
   fixture: [{"id":"rf-01","patientId":"pt-01","prescriptionId":"rx-003","requestedAt":"2026-09-20T18:05:00+03:00","routedTo":"public_pharmacy","status":"requested"},{"id":"rf-02","patientId":"pt-01","prescriptionId":"rx-001","requestedAt":"2026-08-20T09:00:00+03:00","routedTo":"public_pharmacy","status":"approved"},{"id":"rf-03","patientId":"pt-01","prescriptionId":"rx-002","requestedAt":"2026-09-21T09:15:00+03:00","routedTo":"private_pharmacy","status":"requested"}]
```

### 2.3 Red, then green (the unit suite does detect a wrong projection)

Two deliberate breaks were made in `shapes/reads-supply.ts`: the calendar keys in table order
(`token` before `icsUrl`), and `brandName: null` in place of an absent key. With those breaks, 3 of
the 21 unit tests fail. With the file restored, all 21 pass:

```
 ❯ tests/unit/data/supply-projection.test.ts (21 tests | 3 failed)
     × getCalendarSubscription(pt-03) — the whole recorded shape
     × فاطمة (pt-02): brandName absent (not null), depletion three nulls, rx-006 with no frequency
     × سارة (pt-03): rx-008 (mcg) and rx-009 (no dispensing) equal the mock
RESTORED
      Tests  21 passed (21)
```

## 3. ENFORCEMENT.md rows proved

| Row | Test title prefix | Result, by hand through MCP (§2) |
|---|---|---|
| E-21 (supply rows) | `E-21 · cg-0N (linked pt-01) · <fn>(…) → RLS 0 rows · seam …` | Each of cg-03 (pending), cg-04 (declined), cg-05 (expired), cg-06 (revoked) and cg-07 (revoked, cancelled before acceptance) gets 0 rows from all three queries, and the seam returns `[]`, `[]` and `null`. The control is عبدالله (active), who reads حمد's 3 lines and 2 requests, byte-identical to حمد. |
| E-22 read half (supply rows only; the row is WP3d's) | `ناصر, pending-only session …` | 0 rows for all three, giving `[]`, `[]` and `null` |
| CR-040 (flagged, `OPEN`) | `CR-040 · فاطمة’s getRefillOverview(pt-02) lists rx-006 …` | rx-005, rx-006 and rx-007 are all included, with no `brandName` key and three `null`s. This is asserted **and** flagged: it is the mock's inclusive behaviour, kept until the owner answers. |

## Divergences

None new. D-24 already covers CR-040.

## Change requests

None. No shape and no screen needs to change.

## Requests to the lead (files this package does not own)

1. **`lib/data/pg/index.ts`**: add `PG_QUERIES_SUPPLY` to the `PG_QUERIES` merge, as was done for
   `PG_QUERIES_RX` and `PG_QUERIES_AMBIENT`.
2. **Barrel name collisions (TS2308).** WP6's `shapes/channels.ts` exports a `toCalendarSubscription`
   byte-identical to this package's. The barrel `lib/data/shapes.ts` cannot re-export two members
   with one name, so this package's copy is named **`toCalendarSubscriptionRead`**. The lead may
   keep one of the two. The same barrels currently fail `tsc` on **WP3d × WP6** collisions that are
   not this package's: `messagingLinkRefusal`, `toMessagingLink` and `toPushSubscription`.
3. **`lib/data/pg/reads-supply.ts` imports `lib/engine/depletion.ts`** (WP4b's `depletionFor`), as
   the brief says to when that module exists. If WP4b moves or renames the module, for example to
   satisfy guard 8, which currently flags `lib/engine/*.ts`, this import has to follow.
4. **The file list goes beyond the brief:** `tests/unit/data/supply-projection.test.ts` is a unit
   test added so the projection proof also runs in mock `npm run verify`.

## Things found out the hard way

- **RLS alone is looser than the mock for a reviewer.** `prescriptions_select` lets a reviewer see
  *any* `needs_review` row. The mock's `canReadPatient` admits a reviewer only when there is an
  **open** queue item: a pending alert, or a flagged prescription whose field review is not
  `confirmed`. A patient whose only flagged row is already confirmed would therefore leak through
  RLS but not through the mock. The overview query adds `and can_read_patient(p.patient_id)`.
  §2.2 proves this: RLS alone returns 1 row, the query returns 0. `refills_select` is already
  exactly `can_read_patient`, so it needed nothing.
- **`compact()` cannot be used for `RefillLine`.** It drops `null`, but the fixture carries
  `"remaining":null,"total":null,"daysRemaining":null` for a prescription without dispensing.
  Only `brandName` is drop-when-absent: the mock writes `brandName: undefined`, which vanishes in
  JSON.
- **A NULL `frequency_per_day` must reach `computeDepletion` as `undefined`,** because it tests
  `=== undefined`. With `null` it would compute `null / 2`, and rx-006 would come out as
  `daysRemaining: 0` instead of `null`. WP4b's `prescriptionFromRow` does this correctly (`optNum`).
- **Casts matter for bytes, not only for arithmetic.** Without `::float8`, `numeric` arrives as a
  string, and `total` would serialise as `"90"`. `computeDepletion`'s arithmetic would coerce it and
  hide the problem everywhere except in the `total` field.
- **cg-07 is `revoked`, not `cancelled`.** A cancelled-before-acceptance invitation is stored as
  `revoked` without `acceptedAt` (CR-027). E-21's "cancelled" row is therefore cg-07.
- **An MCP proof can batch many sessions in one transaction.** Use a `DO` block that resolves every
  Civil ID as the owner first, then runs `execute 'set local role jurah_app'`, then re-sets
  `jurah.session` per probe and collects the results into a GUC read back by the final `select`.
  This takes one call instead of 44, and no Civil ID is ever typed or printed.
- **The session scratchpad directory is shared by the parallel packages.** A file this package
  wrote there (`compare.mts`) was overwritten by another package mid-run. Use a per-package
  subdirectory.

## What could not be proved

- **The integration suite has not run.** `JURAH_DATABASE_URL` is empty. Every assertion in it was
  made by hand above, over the same SQL text. The seam path itself (`withSession()` → `sessionOf()`
  → the function) has not executed against the database. What ran was the identical query text,
  under the identical GUC and role.
- **`print-shapes --backend=postgres` for `getRefillOverview(pt-01)` and
  `getRefillRequests(pt-01)`** depends on WP3a's `savePrescriptionDraft` and WP5's `requestRefill`
  running earlier in the same script. Under CR-041 their ids will be opaque (`rx-…`/`rf-…` ULIDs,
  not `rx-draft-10`/`rf-03`), so those two lines will read DIFFERS until the gate applies CR-041's
  id rule. Every non-id byte was proved identical in §2.2.
- **`npm run verify` is not exit 0 in the shared tree.** The failures are all in other packages'
  in-flight files: `tsc` on `lib/data/pg/channels.ts`, `lib/session/cookie.ts`,
  `lib/session/verify.ts` and the barrel collisions; guard 4 on `tests/unit/engine/boundaries.test.ts`;
  guard 8 on `lib/engine/*.ts`. None is in a WP3c file (see the report).
