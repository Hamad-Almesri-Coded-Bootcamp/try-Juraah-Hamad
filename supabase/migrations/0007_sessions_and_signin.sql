-- 0007 · sessions and sign-in (P2-WP2, D-018, D-026). Adds, never edits 0001–0006.
-- Idempotent: functions are create-or-replace, policies drop-if-exists then create, grants repeat.
--
-- What it adds:
--   signin_claims(civil_id, at)  — the ONE claims query behind signIn/getRoleOptions (ROLES.md step 3)
--   session_row_ok(...)          — the WITH CHECK of every sessions insert: the subject resolves to
--                                  the session GUC's own Civil ID AND still holds that role
--   the real sessions policies   — replacing 0005's placeholders (sessions_own / _insert_own / _update_own)

-- ---------------------------------------------------------------------------------------------
-- signin_claims() — ROLES.md "How a Civil ID resolves", step 2 (test list) and step 3 (claims),
-- in ONE statement. SECURITY DEFINER because jurah_app holds no grant on accounts or
-- civil_id_test_list and no SELECT on patients.civil_id (p2-wp1 §3.15).
--
-- G9 / E-27: every sub-select below runs for EVERY listed Civil ID, whether or not an account, a
-- patient row or any caregiver row exists — one query plan, no early exit. For the two no_claims
-- IDs (منى has an account, 277091900873 has none) the returned jsonb is byte-identical:
--   {"inList":true,"patient":null,"caregiver":null,"accountId":null,"clinicRoles":[],
--    "lastChosenRole":null,"pending":[]}
-- because accountId is returned only when the account holds a clinic role, and lastChosenRole is
-- null for any account that never chose (neither can: they hold no role).
-- The Civil ID itself is never returned. A Civil ID outside the test list returns only
-- {"inList":false} (that is the only rejection A1 makes, and it reveals nothing about accounts).
-- `p_at` is the caller's clock (D-021: the seam passes REFERENCE_NOW; a test passes a later one to
-- prove read-time expiry, E-20), never the wall clock.
-- ---------------------------------------------------------------------------------------------
create or replace function signin_claims(p_civil_id text, p_at timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with listed as (
    select exists (select 1 from civil_id_test_list t where t.civil_id = p_civil_id) as in_list
  ), claims as (
    select
      (select jsonb_build_object('id', p.id)
         from patients p where p.civil_id = p_civil_id) as patient,
      -- ROLES.md: at most one active caregiver row per Civil ID is in scope; the first by seq,
      -- exactly as roleOptionsFor's activeCaregiversFor(...)[0].
      (select jsonb_build_object(
                'id', c.id,
                'linkedPatientId', c.linked_patient_id,
                'relationship', c.relationship,
                'patientFirstName', coalesce((regexp_split_to_array(lp.name, '\s+'))[1], ''))
         from caregivers c left join patients lp on lp.id = c.linked_patient_id
        where c.civil_id = p_civil_id and c.status = 'active'
        order by c.seq limit 1) as caregiver,
      (select a.id from accounts a
        where a.civil_id = p_civil_id and cardinality(a.assigned_roles) > 0) as account_id,
      coalesce((select to_jsonb(array(select x::text
                                        from unnest(a.assigned_roles) with ordinality as u(x, o)
                                       where x in ('reviewer', 'admin') order by o))
                  from accounts a where a.civil_id = p_civil_id), '[]'::jsonb) as clinic_roles,
      (select a.last_chosen_role::text from accounts a where a.civil_id = p_civil_id) as last_chosen_role,
      -- step 3's pendingInvitations: status pending AND expires_at after the caller's clock (a
      -- stale pending row is expired at read time and never offered, E-20).
      coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'expiresAt', iso_kw(c.expires_at)) order by c.seq)
                  from caregivers c
                 where c.civil_id = p_civil_id and c.status = 'pending' and c.expires_at > p_at),
               '[]'::jsonb) as pending
  )
  select case when listed.in_list then
    jsonb_build_object(
      'inList', true,
      'patient', claims.patient,
      'caregiver', claims.caregiver,
      'accountId', claims.account_id,
      'clinicRoles', claims.clinic_roles,
      'lastChosenRole', claims.last_chosen_role,
      'pending', claims.pending)
  else jsonb_build_object('inList', false) end
  from listed, claims
$$;

-- ---------------------------------------------------------------------------------------------
-- session_row_ok() — may a sessions row with this (subject, role, pending, linked) be created by
-- the transaction's own session? True only when the subject resolves (civil_id_for_session, the
-- owner-only resolver) to the SAME Civil ID the GUC carries, AND the subject still holds the role:
--   pending-only → a caregivers row that is pending and unexpired (jurah_now())
--   patient      → the patients row
--   caregiver    → an ACTIVE caregivers row linked to exactly linked_patient_id (status alone, G9)
--   reviewer/admin → the account holds that assigned role
-- Returns a boolean and nothing else, so no Civil ID leaves it. Used by the sessions insert policy:
-- signIn, chooseRole and acceptInvitation (WP5) all insert under a session of the same person.
-- ---------------------------------------------------------------------------------------------
create or replace function session_row_ok(p_subject text, p_role role_t, p_pending boolean, p_linked text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  me text := jurah_session()->>'civilId';
begin
  if me is null or p_subject is null then
    return false;
  end if;
  if coalesce(civil_id_for_session(p_subject, p_role, coalesce(p_pending, false)), '') <> me then
    return false;
  end if;
  if p_pending then
    return p_role is null and p_linked is null and exists (
      select 1 from caregivers c
      where c.id = p_subject and c.status = 'pending' and c.expires_at > jurah_now());
  elsif p_role = 'patient' then
    return p_linked is null and exists (select 1 from patients p where p.id = p_subject);
  elsif p_role = 'caregiver' then
    return exists (
      select 1 from caregivers c
      where c.id = p_subject and c.status = 'active' and c.linked_patient_id = p_linked);
  elsif p_role in ('reviewer', 'admin') then
    return p_linked is null and exists (
      select 1 from accounts a where a.id = p_subject and p_role = any (a.assigned_roles));
  end if;
  return false;
end
$$;

revoke all on function signin_claims(text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function session_row_ok(text, role_t, boolean, text) from public, anon, authenticated, service_role;
grant execute on function signin_claims(text, timestamptz) to jurah_app;
grant execute on function session_row_ok(text, role_t, boolean, text) to jurah_app;

-- ---------------------------------------------------------------------------------------------
-- sessions — the real policies (D-018). Grants are unchanged from 0005: jurah_app may SELECT and
-- INSERT, and UPDATE only (revoked_at). Nothing may DELETE a session row; nothing may un-revoke one.
-- ---------------------------------------------------------------------------------------------
drop policy if exists sessions_own on sessions;
create policy sessions_own on sessions for select to jurah_app using (
  subject_id = jurah_session()->>'subjectId'
  -- revokeCaregiver (WP5) revokes the caregiver's own sessions: the linked patient sees them.
  or (jurah_session_is('patient') and exists (
        select 1 from caregivers c
        where c.id = sessions.subject_id and c.linked_patient_id = jurah_session()->>'subjectId'))
  or jurah_session_is('system'));

drop policy if exists sessions_insert_own on sessions;
create policy sessions_insert_own on sessions for insert to jurah_app with check (
  revoked_at is null
  and expires_at > created_at
  and (session_row_ok(subject_id, role, pending_invitation_only, linked_patient_id)
       or jurah_session_is('system')));

drop policy if exists sessions_update_own on sessions;
create policy sessions_update_own on sessions for update to jurah_app
  using (
    subject_id = jurah_session()->>'subjectId'
    or (jurah_session_is('patient') and exists (
          select 1 from caregivers c
          where c.id = sessions.subject_id and c.linked_patient_id = jurah_session()->>'subjectId'))
    or jurah_session_is('system'))
  with check (revoked_at is not null);
