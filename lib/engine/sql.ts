/**
 * Every SQL statement the deterministic engine's database half runs (P2-WP4b), as text, so a gate
 * proof can run the very same statement through the Supabase MCP connector with the parameters
 * inlined (docs/backend-notes/p2-wp4b.md §4). The engine runs each with `sql.unsafe(TEXT, params)`
 * on the transaction handle its CALLER got from withSession()/withAgent()/withSystem() — the
 * engine never opens a transaction, never sets a role, and never connects.
 *
 * Lists travel as ONE jsonb parameter (`$n::jsonb`), never as a driver array, so the statement text
 * is identical from TypeScript and from a hand-run proof with the literal inlined. The caller passes
 * the array or object ITSELF, never `JSON.stringify(...)` of it: the server types `$n::jsonb` as
 * jsonb, and the `postgres` driver then runs its own JSON serializer on the value — a pre-stringified
 * value is encoded twice and lands as a jsonb STRING scalar ("cannot extract elements from a
 * scalar"). Found on the first run against the real database (VERIFICATION.md, integration run 1).
 *
 * What is deliberately NOT here (G1, rule 1, rule 4): no statement writes `doses.status`,
 * `recorded_at` or `source` of an existing row — the insert omits `status` altogether (the column
 * default is the generator's word), and every delete is restricted to rows still `upcoming`, on
 * top of the `doses_delete_upcoming` policy that refuses a recorded row to jurah_app anyway.
 */

/** A contract `Prescription`'s columns, projected exactly as lib/data/pg/reads-rx.ts projects them. */
export const PRESCRIPTION_COLUMNS = `
  id, patient_id, facility_name, sector::text as sector, generic_name, brand_name,
  strength_mg::float8 as strength_mg, strength_unit::text as strength_unit,
  dose_per_administration::float8 as dose_per_administration, frequency_per_day, duration_days,
  dosing_pattern::text as dosing_pattern, to_char(start_date, 'YYYY-MM-DD') as start_date, dose_times,
  iso_kw(prescribed_at) as prescribed_at, prescriber_name, timing_relative_to_food, route_of_administration,
  special_notes, indication, dispensing_units_per_package,
  dispensing_total_quantity_dispensed::float8 as dispensing_total_quantity_dispensed,
  to_char(dispensing_dispense_date, 'YYYY-MM-DD') as dispensing_dispense_date, dispensing_brand_actually_dispensed,
  needs_review, field_review_status::text as field_review_status, field_reviewed_by,
  iso_kw(field_reviewed_at) as field_reviewed_at, field_review_note, status::text as status,
  discontinued_reason, to_char(discontinued_at, 'YYYY-MM-DD') as discontinued_at`;

/** A contract `Dose`'s columns; timestamps through iso_kw() so they equal the generator's strings. */
export const DOSE_COLUMNS = `
  id, prescription_id, iso_kw(scheduled_at) as scheduled_at, status::text as status, tracked,
  iso_kw(recorded_at) as recorded_at, source::text as source`;

export const ENGINE_SQL = {
  /** $1 prescription id. */
  loadPrescription: `select ${PRESCRIPTION_COLUMNS} from prescriptions where id = $1`,

  /** $1 prescription id. Ordered as the generator orders (scheduledAt, then id). */
  loadDoses: `select ${DOSE_COLUMNS} from doses where prescription_id = $1 order by scheduled_at, id`,

  /** $1 prescription id → the ids of every dose of it that carries a recorded status. */
  recordedIds: `select id from doses where prescription_id = $1 and status <> 'upcoming' order by id`,

  /**
   * $1 jsonb array of {id, prescription_id, scheduled_at, tracked, source}. `status` is NOT a
   * column of this insert: the row takes the column default, 'upcoming' — the only word the
   * generator ever produces — so this statement cannot create a recorded dose whatever it is given.
   */
  insertDoses: `
    insert into doses (id, prescription_id, scheduled_at, tracked, source)
    select r.id, r.prescription_id, r.scheduled_at::timestamptz, r.tracked, r.source::dose_source_t
    from jsonb_to_recordset($1::jsonb) as r(id text, prescription_id text, scheduled_at text, tracked boolean, source text)
    returning id`,

  /** $1 prescription id → deletes that prescription's `upcoming` doses only. */
  deleteUpcoming: `delete from doses where prescription_id = $1 and status = 'upcoming' returning id`,

  /** $1 prescription id, $2 jsonb array of dose ids → deletes those that are still `upcoming`. */
  deleteUpcomingIds: `
    delete from doses
    where prescription_id = $1 and status = 'upcoming' and id in (select jsonb_array_elements_text($2::jsonb))
    returning id`,

  /**
   * $1 prescription id, $2 discontinued_at (YYYY-MM-DD), $3 reason. Runs only on the path the
   * `prescription_clinical_fields_locked` trigger admits (jurah_agent, or the system actor), and
   * only while the row is still active — a stale caller matches 0 rows instead of re-discontinuing.
   */
  discontinuePrescription: `
    update prescriptions set status = 'discontinued', discontinued_at = $2::date, discontinued_reason = $3
    where id = $1 and status = 'active'
    returning id`,

  /** Every stored-pending invitation, with only what the expiry selection reads. Never civil_id. */
  pendingInvitations: `
    select id, linked_patient_id, status::text as status, iso_kw(expires_at) as expires_at
    from caregivers where status = 'pending' order by seq`,

  /** $1 the job's "now" (ISO datetime) → the transaction-local clock every trigger and default reads. */
  setClock: `select set_config('jurah.now', $1, true) as now`,

  /**
   * $1 jsonb array of caregiver ids. The WHERE clause repeats the caregiver_transitions trigger's
   * own condition (`expires_at <= jurah_now()`), so the database stays the authority: a row the
   * TypeScript selection chose but the database clock disagrees about is not touched (and the
   * trigger, which would raise for it, never fires).
   */
  expireInvitations: `
    update caregivers set status = 'expired'
    where status = 'pending' and expires_at <= jurah_now() and id in (select jsonb_array_elements_text($1::jsonb))
    returning id, linked_patient_id`,

  /** $1 rows affected. `ran_at` defaults to jurah_now(). The job_runs_system policy admits the system actor only. */
  recordJobRun: `insert into job_runs (job, rows_affected) values ('expire_invitations', $1) returning id`,
} as const;

export type EngineStatement = keyof typeof ENGINE_SQL;
