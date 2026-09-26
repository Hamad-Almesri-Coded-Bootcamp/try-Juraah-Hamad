-- 0015 · the clinician's own profile for the clinic dashboard (DECISIONS CR-115). Adds, never edits
-- 0001-0014. Idempotent: `create or replace`, and the grants are re-stated.
--
-- Why a definer function. The session carries no name, and jurah_app never selects `accounts`
-- directly (0005: only through the definer helpers). A reviewer also cannot count their own past
-- decisions through RLS, because a decided alert leaves the reviewer's view (D-014, divergence D-4).
-- So one helper answers, for the signed-in reviewer or admin only:
--
--   name       the account's own full name (a person's own name is never masked)
--   roles      the account's clinic roles, reviewer and admin only, in assigned order
--   decisions  counts of interaction_alerts.reviewed_by and prescriptions.field_reviewed_by that
--              name this account id
--
-- It never returns the Civil ID or any other account's row. Any session that is not a reviewer or
-- an admin holding that assigned role (jurah_session_is re-checks the account) gets null, which the
-- seam maps to the mock's refusal shape (clinicianProfileRefusal → null).

create or replace function clinician_profile()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when not (jurah_session_is('reviewer') or jurah_session_is('admin')) then null
    else (
      select jsonb_build_object(
        'name', a.name,
        'roles', to_jsonb(array(select x::text
                                  from unnest(a.assigned_roles) with ordinality as u(x, o)
                                 where x in ('reviewer', 'admin') order by o)),
        'decisions', jsonb_build_object(
          'confirmed', (select count(*) from interaction_alerts ia
                         where ia.review_status = 'reviewed' and ia.reviewed_by = a.id and ia.reviewer_decision = 'confirmed'),
          'cleared', (select count(*) from interaction_alerts ia
                       where ia.review_status = 'reviewed' and ia.reviewed_by = a.id and ia.reviewer_decision = 'cleared'),
          'fieldsConfirmed', (select count(*) from prescriptions p
                               where p.field_reviewed_by = a.id and p.field_review_status = 'confirmed'),
          'fieldsReturned', (select count(*) from prescriptions p
                              where p.field_reviewed_by = a.id and p.field_review_status = 'returned')
        )
      )
      from accounts a
      where a.id = jurah_session()->>'subjectId'
    )
  end
$$;

revoke all on function clinician_profile() from public, anon, authenticated, service_role;
grant execute on function clinician_profile() to jurah_app;
