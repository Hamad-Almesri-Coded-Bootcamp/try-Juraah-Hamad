-- 0005 · row-level security, grants and revokes (docs/SCHEMA.md §3 "RLS policies").
-- RLS is ENABLED, deliberately not FORCED: policies bind jurah_app and jurah_agent; the owner
-- (postgres) is used only by migrations and the seed. What stops a seam query from running as the
-- owner is withSession() being the only way to run SQL (guard 8) and the smoke test asserting
-- current_user = 'jurah_app' inside it (risk 3).
-- Idempotent: grants/revokes are naturally so; each policy is dropped-if-exists then created.
-- Every policy names its role (`to jurah_app` / `to jurah_agent`); nothing is granted to PUBLIC,
-- anon, authenticated or service_role.

-- ---------------------------------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------------------------------
alter table accounts               enable row level security;
alter table patients               enable row level security;
alter table caregivers             enable row level security;
alter table prescriptions          enable row level security;
alter table doses                  enable row level security;
alter table interaction_alerts     enable row level security;
alter table refill_requests        enable row level security;
alter table calendar_subscriptions enable row level security;
alter table messaging_links        enable row level security;
alter table push_subscriptions     enable row level security;
alter table audit_events           enable row level security;
alter table settings               enable row level security;
alter table sessions               enable row level security;
alter table prescription_drafts    enable row level security;
alter table lookup_audit           enable row level security;
alter table snapshots              enable row level security;
alter table civil_id_test_list     enable row level security;
alter table job_runs               enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Revoke everything first (Supabase's defaults and PUBLIC), then grant exactly what §3 says.
-- ---------------------------------------------------------------------------------------------
revoke all on all tables    in schema public from public, anon, authenticated, service_role, jurah_app, jurah_agent;
revoke all on all sequences in schema public from public, anon, authenticated, service_role, jurah_app, jurah_agent;
revoke all on all functions in schema public from public, anon, authenticated, service_role, jurah_app, jurah_agent;

-- Functions the policies, triggers and seam queries call as the application roles.
grant execute on function jurah_session(), jurah_now(), iso_kw(timestamptz), mask_name(text),
  jurah_new_id(text), jurah_hhmm_array_ok(text[]), jurah_session_is(text), can_read_patient(text),
  caregiver_ids_for_patient(text), invitation_patient_first_name(text)
  to jurah_app, jurah_agent;
grant execute on function caregiver_transitions(), prescription_clinical_fields_locked(), doses_status_write(),
  doses_status_recorded_audit(), alert_review_once(), refill_routing(), settings_tracking_requires_link(),
  link_chat_id_server_only(), link_caregiver_must_be_active(), audit_events_immutable()
  to jurah_app, jurah_agent;
-- civil_id_for_session() and account_roles() stay owner-only: withSession() resolves the caller's
-- own Civil ID as the owner, before `set local role jurah_app`, so no seam query can resolve anyone's.

-- accounts — never selected by jurah_app directly (only through the definer helpers).
grant update (last_chosen_role) on accounts to jurah_app;
drop policy if exists accounts_update_own on accounts;
create policy accounts_update_own on accounts for update to jurah_app
  using (civil_id = jurah_session()->>'civilId')
  with check (civil_id = jurah_session()->>'civilId');

-- patients — civil_id and telegram_chat_id are not in the column grant: no seam projection can select them.
grant select (id, name, telegram_linked_at, phone, language, onboarding_completed) on patients to jurah_app;
grant update (phone, onboarding_completed, language) on patients to jurah_app;
grant select on patients to jurah_agent;
drop policy if exists patients_select on patients;
create policy patients_select on patients for select to jurah_app using (can_read_patient(id));
drop policy if exists patients_update_own on patients;
create policy patients_update_own on patients for update to jurah_app
  using (jurah_session_is('patient') and id = jurah_session()->>'subjectId')
  with check (jurah_session_is('patient') and id = jurah_session()->>'subjectId');
drop policy if exists patients_agent on patients;
create policy patients_agent on patients for select to jurah_agent using (true);

-- caregivers — the linked patient reads all its invitations; a Civil ID reads its own rows; the
-- system reads all (expiry job). Transitions are the trigger's (caregiver_transitions).
grant select on caregivers to jurah_app, jurah_agent;
grant insert (id, civil_id, name, relationship, phone, linked_patient_id, status, invited_at, expires_at, access_level) on caregivers to jurah_app;
grant update (status, accepted_at, declined_at, revoked_at) on caregivers to jurah_app;
drop policy if exists caregivers_select on caregivers;
create policy caregivers_select on caregivers for select to jurah_app using (
  (jurah_session_is('patient') and linked_patient_id = jurah_session()->>'subjectId')
  or civil_id = jurah_session()->>'civilId'
  or jurah_session_is('system'));
drop policy if exists caregivers_insert_by_patient on caregivers;
create policy caregivers_insert_by_patient on caregivers for insert to jurah_app with check (
  jurah_session_is('patient') and linked_patient_id = jurah_session()->>'subjectId'
  and status = 'pending' and accepted_at is null and declined_at is null and revoked_at is null);
drop policy if exists caregivers_update on caregivers;
create policy caregivers_update on caregivers for update to jurah_app using (
  (jurah_session_is('patient') and linked_patient_id = jurah_session()->>'subjectId')
  or civil_id = jurah_session()->>'civilId'
  or jurah_session_is('system'));
drop policy if exists caregivers_agent on caregivers;
create policy caregivers_agent on caregivers for select to jurah_agent using (true);

-- prescriptions
grant select, insert on prescriptions to jurah_app;
grant update (facility_name, sector, generic_name, brand_name, strength_mg, strength_unit, dose_per_administration,
  frequency_per_day, duration_days, dosing_pattern, start_date, dose_times, needs_review, field_review_status,
  field_reviewed_by, field_reviewed_at, field_review_note, status, discontinued_reason, discontinued_at) on prescriptions to jurah_app;
grant select, insert on prescriptions to jurah_agent;
grant update (status, discontinued_reason, discontinued_at) on prescriptions to jurah_agent;
drop policy if exists prescriptions_select on prescriptions;
create policy prescriptions_select on prescriptions for select to jurah_app using (
  can_read_patient(patient_id) or (jurah_session_is('reviewer') and needs_review));
drop policy if exists prescriptions_insert_own on prescriptions;
create policy prescriptions_insert_own on prescriptions for insert to jurah_app with check (
  jurah_session_is('patient') and patient_id = jurah_session()->>'subjectId');
drop policy if exists prescriptions_update on prescriptions;
create policy prescriptions_update on prescriptions for update to jurah_app using (
  (jurah_session_is('reviewer') and (needs_review or field_review_status is not null)) or jurah_session_is('system'));
drop policy if exists prescriptions_agent_select on prescriptions;
create policy prescriptions_agent_select on prescriptions for select to jurah_agent using (true);
drop policy if exists prescriptions_agent_insert on prescriptions;
create policy prescriptions_agent_insert on prescriptions for insert to jurah_agent with check (true);
drop policy if exists prescriptions_agent_update on prescriptions;
create policy prescriptions_agent_update on prescriptions for update to jurah_agent using (true);

-- doses — G1 in grants: jurah_app generates (insert/delete upcoming, update scheduled_at/tracked)
-- and holds NO update on status/recorded_at/source; jurah_agent alone holds that column grant.
grant select, insert, delete on doses to jurah_app;
grant update (scheduled_at, tracked) on doses to jurah_app;
grant select, insert on doses to jurah_agent;
grant update (status, recorded_at, source) on doses to jurah_agent;
drop policy if exists doses_select on doses;
create policy doses_select on doses for select to jurah_app using (
  exists (select 1 from prescriptions p where p.id = prescription_id and can_read_patient(p.patient_id)));
drop policy if exists doses_insert on doses;
create policy doses_insert on doses for insert to jurah_app with check (
  (jurah_session_is('patient') or jurah_session_is('reviewer') or jurah_session_is('system'))
  and exists (select 1 from prescriptions p where p.id = prescription_id and can_read_patient(p.patient_id)));
drop policy if exists doses_update on doses;
create policy doses_update on doses for update to jurah_app using (
  (jurah_session_is('patient') or jurah_session_is('reviewer') or jurah_session_is('system'))
  and exists (select 1 from prescriptions p where p.id = prescription_id and can_read_patient(p.patient_id)));
-- A recorded dose is never deleted: only 'upcoming' rows (regeneration).
drop policy if exists doses_delete_upcoming on doses;
create policy doses_delete_upcoming on doses for delete to jurah_app using (
  status = 'upcoming'
  and (jurah_session_is('patient') or jurah_session_is('reviewer') or jurah_session_is('system'))
  and exists (select 1 from prescriptions p where p.id = prescription_id and can_read_patient(p.patient_id)));
drop policy if exists doses_agent_select on doses;
create policy doses_agent_select on doses for select to jurah_agent using (true);
drop policy if exists doses_agent_insert on doses;
create policy doses_agent_insert on doses for insert to jurah_agent with check (true);
drop policy if exists doses_agent_update on doses;
create policy doses_agent_update on doses for update to jurah_agent using (true);

-- interaction_alerts — inserts by jurah_agent only; the reviewer's decision is trigger-governed
-- (the update policy is deliberately wider than "pending" so a second decision reaches
-- alert_review_once and RAISES instead of silently matching zero rows).
grant select on interaction_alerts to jurah_app, jurah_agent;
grant update (review_status, reviewer_decision, reviewer_note, reviewed_at, reviewed_by) on interaction_alerts to jurah_app;
grant insert on interaction_alerts to jurah_agent;
drop policy if exists alerts_select on interaction_alerts;
create policy alerts_select on interaction_alerts for select to jurah_app using (
  can_read_patient(patient_id) or (jurah_session_is('reviewer') and review_status = 'pending_medical_review'));
drop policy if exists alerts_update_reviewer on interaction_alerts;
create policy alerts_update_reviewer on interaction_alerts for update to jurah_app using (jurah_session_is('reviewer'));
drop policy if exists alerts_agent_select on interaction_alerts;
create policy alerts_agent_select on interaction_alerts for select to jurah_agent using (true);
drop policy if exists alerts_agent_insert on interaction_alerts;
create policy alerts_agent_insert on interaction_alerts for insert to jurah_agent with check (true);

-- refill_requests
grant select on refill_requests to jurah_app, jurah_agent;
grant insert (id, patient_id, prescription_id, requested_at, routed_to, status) on refill_requests to jurah_app;
grant update (status) on refill_requests to jurah_app;
drop policy if exists refills_select on refill_requests;
create policy refills_select on refill_requests for select to jurah_app using (can_read_patient(patient_id));
drop policy if exists refills_insert_own on refill_requests;
create policy refills_insert_own on refill_requests for insert to jurah_app with check (
  jurah_session_is('patient') and patient_id = jurah_session()->>'subjectId');
drop policy if exists refills_update_system on refill_requests;
create policy refills_update_system on refill_requests for update to jurah_app using (jurah_session_is('system'));
drop policy if exists refills_agent on refill_requests;
create policy refills_agent on refill_requests for select to jurah_agent using (true);

-- calendar_subscriptions — the owning patient only (and the system, for the ICS feed by token).
grant select, insert on calendar_subscriptions to jurah_app;
grant update (token, ics_url) on calendar_subscriptions to jurah_app;
drop policy if exists calendar_select on calendar_subscriptions;
create policy calendar_select on calendar_subscriptions for select to jurah_app using (
  (jurah_session_is('patient') and patient_id = jurah_session()->>'subjectId') or jurah_session_is('system'));
drop policy if exists calendar_insert_own on calendar_subscriptions;
create policy calendar_insert_own on calendar_subscriptions for insert to jurah_app with check (
  jurah_session_is('patient') and patient_id = jurah_session()->>'subjectId');
drop policy if exists calendar_update_own on calendar_subscriptions;
create policy calendar_update_own on calendar_subscriptions for update to jurah_app using (
  jurah_session_is('patient') and patient_id = jurah_session()->>'subjectId');

-- messaging_links — chat_id is outside jurah_app's SELECT grant (never projected); setting it is
-- trigger-governed (link_chat_id_server_only), so the column is in the insert/update grants only
-- so that the named trigger, not a bare permission error, is what refuses a user session.
grant select (id, seq, subject_type, subject_id, channel, status, link_token, token_expires_at, connected_at, created_at)
  on messaging_links to jurah_app;
grant insert (id, subject_type, subject_id, channel, status, link_token, token_expires_at, chat_id, connected_at)
  on messaging_links to jurah_app;
grant update (status, link_token, token_expires_at, chat_id, connected_at) on messaging_links to jurah_app;
grant select on messaging_links to jurah_agent;
drop policy if exists links_select on messaging_links;
create policy links_select on messaging_links for select to jurah_app using (
  (subject_type::text = jurah_session()->>'role' and subject_id = jurah_session()->>'subjectId')
  or jurah_session_is('system'));
drop policy if exists links_insert_self on messaging_links;
create policy links_insert_self on messaging_links for insert to jurah_app with check (
  subject_type::text = jurah_session()->>'role' and subject_id = jurah_session()->>'subjectId');
drop policy if exists links_update on messaging_links;
create policy links_update on messaging_links for update to jurah_app using (
  (subject_type::text = jurah_session()->>'role' and subject_id = jurah_session()->>'subjectId')
  or jurah_session_is('system'));
drop policy if exists links_agent on messaging_links;
create policy links_agent on messaging_links for select to jurah_agent using (true);

-- push_subscriptions — endpoint and keys are outside jurah_app's SELECT grant; the seam reads the
-- view push_subscriptions_view (0006).
grant select (id, subject_type, subject_id, status, permission, created_at) on push_subscriptions to jurah_app;
grant insert, delete on push_subscriptions to jurah_app;
grant update (status, permission, endpoint, p256dh, auth, endpoint_updated_at) on push_subscriptions to jurah_app;
grant select on push_subscriptions to jurah_agent;
drop policy if exists push_select on push_subscriptions;
create policy push_select on push_subscriptions for select to jurah_app using (
  (subject_type::text = jurah_session()->>'role' and subject_id = jurah_session()->>'subjectId')
  or jurah_session_is('system'));
drop policy if exists push_insert_self on push_subscriptions;
create policy push_insert_self on push_subscriptions for insert to jurah_app with check (
  subject_type::text = jurah_session()->>'role' and subject_id = jurah_session()->>'subjectId');
drop policy if exists push_update_self on push_subscriptions;
create policy push_update_self on push_subscriptions for update to jurah_app using (
  subject_type::text = jurah_session()->>'role' and subject_id = jurah_session()->>'subjectId');
drop policy if exists push_delete_self on push_subscriptions;
create policy push_delete_self on push_subscriptions for delete to jurah_app using (
  subject_type::text = jurah_session()->>'role' and subject_id = jurah_session()->>'subjectId');
drop policy if exists push_agent on push_subscriptions;
create policy push_agent on push_subscriptions for select to jurah_agent using (true);

-- audit_events — append-only three ways: no UPDATE/DELETE/TRUNCATE grant to anyone, the
-- statement trigger audit_events_immutable (binds the owner), and no policy for update/delete.
grant select, insert on audit_events to jurah_app, jurah_agent;
revoke update, delete, truncate on audit_events from public, jurah_app, jurah_agent;
drop policy if exists audit_select on audit_events;
create policy audit_select on audit_events for select to jurah_app using (
  scope = 'patient' and can_read_patient(patient_id));
drop policy if exists audit_insert_session on audit_events;
create policy audit_insert_session on audit_events for insert to jurah_app with check (jurah_session() is not null);
drop policy if exists audit_agent_select on audit_events;
create policy audit_agent_select on audit_events for select to jurah_agent using (true);
drop policy if exists audit_agent_insert on audit_events;
create policy audit_agent_insert on audit_events for insert to jurah_agent with check (true);

-- settings — exactly patient_id + the seven keys exist; the seven are the update grant.
grant select on settings to jurah_app, jurah_agent;
grant insert (patient_id, adherence_check_in_enabled, adherence_check_in_frequency, refill_alerts_enabled,
  calendar_sync_enabled, web_push_enabled, notification_channel, language) on settings to jurah_app;
grant update (adherence_check_in_enabled, adherence_check_in_frequency, refill_alerts_enabled,
  calendar_sync_enabled, web_push_enabled, notification_channel, language) on settings to jurah_app;
drop policy if exists settings_select on settings;
create policy settings_select on settings for select to jurah_app using (can_read_patient(patient_id));
drop policy if exists settings_insert_own on settings;
create policy settings_insert_own on settings for insert to jurah_app with check (
  jurah_session_is('patient') and patient_id = jurah_session()->>'subjectId');
drop policy if exists settings_update_own on settings;
create policy settings_update_own on settings for update to jurah_app using (
  (jurah_session_is('patient') and patient_id = jurah_session()->>'subjectId') or jurah_session_is('system'));
drop policy if exists settings_agent on settings;
create policy settings_agent on settings for select to jurah_agent using (true);

-- sessions — own rows only (WP2 owns the sign-in path that creates them).
grant select, insert on sessions to jurah_app;
grant update (revoked_at) on sessions to jurah_app;
drop policy if exists sessions_own on sessions;
create policy sessions_own on sessions for select to jurah_app using (
  subject_id = jurah_session()->>'subjectId' or jurah_session_is('system'));
drop policy if exists sessions_insert_own on sessions;
create policy sessions_insert_own on sessions for insert to jurah_app with check (
  subject_id = jurah_session()->>'subjectId' or jurah_session_is('system'));
drop policy if exists sessions_update_own on sessions;
create policy sessions_update_own on sessions for update to jurah_app using (
  subject_id = jurah_session()->>'subjectId' or jurah_session_is('system'));

-- prescription_drafts — the owning patient.
grant select, insert, update, delete on prescription_drafts to jurah_app;
drop policy if exists drafts_own on prescription_drafts;
create policy drafts_own on prescription_drafts for all to jurah_app
  using (jurah_session_is('patient') and patient_id = jurah_session()->>'subjectId')
  with check (jurah_session_is('patient') and patient_id = jurah_session()->>'subjectId');

-- lookup_audit — no Civil ID column exists (CR-043); own rows.
grant select, insert on lookup_audit to jurah_app;
drop policy if exists lookup_audit_own on lookup_audit;
create policy lookup_audit_own on lookup_audit for all to jurah_app
  using (subject_id = jurah_session()->>'subjectId')
  with check (subject_id = jurah_session()->>'subjectId');

-- snapshots — scoped to the caller (D-014).
grant select, insert, update, delete on snapshots to jurah_app;
drop policy if exists snapshots_own on snapshots;
create policy snapshots_own on snapshots for all to jurah_app
  using (subject_id = jurah_session()->>'subjectId')
  with check (subject_id = jurah_session()->>'subjectId');

-- job_runs — the system actor only.
grant select, insert on job_runs to jurah_app;
drop policy if exists job_runs_system on job_runs;
create policy job_runs_system on job_runs for all to jurah_app
  using (jurah_session_is('system')) with check (jurah_session_is('system'));

-- civil_id_test_list — no grant at all (WP2's definer resolver reads it).
