/**
 * CR-109 — the only SQL this reset runs, kept out of lib/data/pg/agent.ts so that file's G1 sentence
 * ("the only statement that writes doses.status is recordDoseStatus") stays literally true: every
 * statement here either un-records (the opposite direction) or touches scheduled_at only.
 *
 * Two transactions, not one (D-025's grant split, supabase/migrations/0005_rls.sql:118-121):
 * jurah_app holds UPDATE (scheduled_at, tracked) on doses and no column of status/recorded_at/source;
 * jurah_agent holds UPDATE (status, recorded_at, source) and no scheduled_at. So the un-record runs
 * under withAgent(), then the move under withSystem() — the same split recomputeSchedule lives with
 * (lib/data/pg/agent.ts). Un-recording first is what makes one press enough: it frees a recorded
 * rx-009 21:00 dose so the SAME press can also move it, because the move step re-reads the doses
 * only after the un-record has committed.
 *
 * Every un-recorded row also gets one audit_events row, appended by the existing trigger
 * doses_status_recorded_audit (`after update of status on doses`) — this file inserts nothing there
 * itself (guard 8 rule d). The move touches only scheduled_at, which fires no dose trigger (both
 * doses_status_write and doses_status_recorded_audit are declared `... of status`), so it leaves no
 * audit row of its own.
 */
import { withAgent, withSystem } from '@/lib/db/withSession';
import type { JsonValue } from '@/lib/db/client';
import { DEMO_RESET, planDemoReset, type DemoDose, type DemoResetResult } from '@/lib/agent/demo-reset';

/** Parameterised ($n). PG_QUERIES_DEMO's text is asserted directly in tests/unit/agent/demo-reset.test.ts. */
export const PG_QUERIES_DEMO = {
  // Both roles. $1 patient id, $2 jsonb array of two YYYY-MM-DD Kuwait dates.
  dosesOfDays: `
    select d.id, d.prescription_id, p.patient_id, iso_kw(d.scheduled_at) as scheduled_at, d.status::text as status
      from doses d
      join prescriptions p on p.id = d.prescription_id
     where p.patient_id = $1
       and to_char(d.scheduled_at at time zone 'Asia/Kuwait', 'YYYY-MM-DD') in (select jsonb_array_elements_text($2::jsonb))
     order by d.scheduled_at, d.id`,
  // withAgent only (its column grant). $1 patient id, $2 jsonb array of dose ids, $3 jsonb array of
  // dates (defence in depth, on top of the ids already being scoped to those dates).
  unrecord: `
    update doses d
       set status = 'upcoming'::dose_status_t, recorded_at = null, source = 'seed'::dose_source_t
      from prescriptions p
     where p.id = d.prescription_id and p.patient_id = $1
       and d.id in (select jsonb_array_elements_text($2::jsonb))
       and to_char(d.scheduled_at at time zone 'Asia/Kuwait', 'YYYY-MM-DD') in (select jsonb_array_elements_text($3::jsonb))
       and d.status <> 'upcoming'
    returning d.id`,
  // withSystem only. $1 patient id, $2 jsonb array of {id, from_at, to_at}, $3 the evening prescription id.
  moveEvening: `
    update doses d
       set scheduled_at = m.to_at::timestamptz
      from jsonb_to_recordset($2::jsonb) as m(id text, from_at text, to_at text), prescriptions p
     where d.id = m.id and p.id = d.prescription_id and p.patient_id = $1 and d.prescription_id = $3
       and iso_kw(d.scheduled_at) = m.from_at and 'upcoming' = d.status
    returning d.id`,
} as const;

function toDemoDose(r: Record<string, unknown>): DemoDose {
  return {
    id: String(r.id),
    prescriptionId: String(r.prescription_id),
    patientId: String(r.patient_id),
    scheduledAt: String(r.scheduled_at),
    status: String(r.status),
  };
}

/**
 * CR-109. `dates` is always demoResetDates(kuwaitToday()) — nothing else calls this function. The
 * result lists exactly the rows the database changed; a second press on an already-reset day answers
 * both arrays empty.
 */
export async function resetDemoDoses(dates: readonly [string, string]): Promise<DemoResetResult> {
  const patientId = DEMO_RESET.patientId;
  const days = [...dates];

  const reset = await withAgent(async (sql) => {
    const rows = (await sql.unsafe(PG_QUERIES_DEMO.dosesOfDays, [patientId, days])).map(toDemoDose);
    const planned = planDemoReset(rows, days).reset;
    if (planned.length === 0) return [];
    const doneRows = await sql.unsafe(PG_QUERIES_DEMO.unrecord, [patientId, planned.map((r) => r.id), days]);
    const done = new Set(doneRows.map((r) => String(r.id)));
    return planned.filter((r) => done.has(r.id));
  });

  const moved = await withSystem(async (sql) => {
    const rows = (await sql.unsafe(PG_QUERIES_DEMO.dosesOfDays, [patientId, days])).map(toDemoDose);
    const planned = planDemoReset(rows, days).moved;
    if (planned.length === 0) return [];
    const payload = planned.map((m) => ({ id: m.id, from_at: m.fromAt, to_at: m.toAt })) as JsonValue;
    const doneRows = await sql.unsafe(PG_QUERIES_DEMO.moveEvening, [patientId, payload, DEMO_RESET.evening.prescriptionId]);
    const done = new Set(doneRows.map((r) => String(r.id)));
    return planned.filter((m) => done.has(m.id)).map(({ id, from, to }) => ({ id, from, to }));
  });

  return { patientId, dates: days, moved, reset };
}
