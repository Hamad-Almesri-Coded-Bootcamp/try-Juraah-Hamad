-- 0004 · named constraints, guard triggers, and the helper functions the triggers and the RLS
-- policies of 0005 share (docs/SCHEMA.md §1, §3). Every constraint and trigger named in SCHEMA.md
-- exists here under that name; tests/integration/schema/*.test.ts rejects a row by each name.
-- Trigger errors are raised as '<trigger_name>: <reason>' so a test (and withSession()'s error
-- mapping) can identify the guard that refused.

-- =============================================================================================
-- Helper functions (need the tables, so they cannot live in 0001)
-- =============================================================================================

-- True when the session claims role `r` (a role_t value or 'system'/'agent') AND, for the two assigned clinic roles, the account named
-- by subjectId actually holds it (defence in depth: a forged {"role":"reviewer"} with a patient's
-- subjectId gets nothing). SECURITY DEFINER because jurah_app holds no grant on accounts; it
-- returns a boolean and reads nothing else.
create or replace function jurah_session_is(r text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jurah_session()->>'role' = r, false)
     and (r not in ('reviewer', 'admin')
          or exists (select 1 from accounts a
                     where a.id = jurah_session()->>'subjectId' and r = any (a.assigned_roles::text[])))
$$;

-- can_read_patient() — the mock's canReadPatient (lib/data/mock/access.ts) in SQL: patient self ·
-- caregiver whose row is ACTIVE (status alone — seed invariant 1) and linked, and whose civil id
-- is the session's own · reviewer with a queue item for that patient · the system actor (webhook,
-- job, ICS feed — API-SURFACE §B) · admin never. SECURITY DEFINER because it reads caregivers,
-- interaction_alerts and prescriptions, whose own policies call it (an invoker function would
-- recurse); it returns a boolean and nothing else.
create or replace function can_read_patient(patient_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  s jsonb := jurah_session();
  r text := s->>'role';
  subj text := s->>'subjectId';
begin
  if s is null or r is null or patient_id is null then
    return false;
  end if;
  if r = 'patient' then
    return subj = patient_id;
  elsif r = 'caregiver' then
    return exists (
      select 1 from caregivers c
      where c.id = subj and c.status = 'active' and c.linked_patient_id = can_read_patient.patient_id
        and c.civil_id = s->>'civilId');
  elsif r = 'reviewer' then
    return jurah_session_is('reviewer') and (
      exists (select 1 from interaction_alerts a
              where a.patient_id = can_read_patient.patient_id and a.review_status = 'pending_medical_review')
      or exists (select 1 from prescriptions p
                 where p.patient_id = can_read_patient.patient_id and p.needs_review
                   and p.field_review_status is distinct from 'confirmed'));
  elsif r = 'system' then
    return true;
  end if;
  return false; -- admin reads no clinical record (ROLES.md)
end
$$;

-- civil_id_for_session() — the ONE function withSession() calls to enrich the session GUC with
-- the caller's own Civil ID, inside the transaction, BEFORE it drops to jurah_app. Execute is
-- revoked from both application roles (0005), so no seam query can resolve anybody's Civil ID.
create or replace function civil_id_for_session(subject_id text, role role_t, pending boolean)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if subject_id is null then
    return null;
  end if;
  if pending then
    return (select c.civil_id from caregivers c where c.id = civil_id_for_session.subject_id);
  end if;
  if role = 'patient' then
    return (select p.civil_id from patients p where p.id = civil_id_for_session.subject_id);
  elsif role = 'caregiver' then
    return (select c.civil_id from caregivers c where c.id = civil_id_for_session.subject_id);
  elsif role in ('reviewer', 'admin') then
    return (select a.civil_id from accounts a where a.id = civil_id_for_session.subject_id);
  end if;
  return null;
end
$$;

-- account_roles() — seed rule 2: Account.roles is DERIVED. patient iff a patients row · caregiver
-- iff ≥ 1 ACTIVE caregivers row · plus the assigned clinic roles, in that order (the mock's
-- deriveRoles). Owner-only execute; WP2's sign-in resolver decides how the seam reaches it.
create or replace function account_roles(civil_id text)
returns role_t[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select array_remove(array[
      case when exists (select 1 from patients p where p.civil_id = account_roles.civil_id) then 'patient'::role_t end,
      case when exists (select 1 from caregivers c where c.civil_id = account_roles.civil_id and c.status = 'active') then 'caregiver'::role_t end
    ], null)
    || coalesce((select array(select x from unnest(a.assigned_roles) with ordinality as u(x, o)
                              where x in ('reviewer', 'admin') order by o)
                 from accounts a where a.civil_id = account_roles.civil_id), '{}'::role_t[])
$$;

-- caregiver_ids_for_patient() — Patient.caregiverIds, derived (D-21), in insertion order. A
-- definer read because a caregiver's own RLS shows it only its own caregivers row, yet the mock
-- returns the patient's full id list to every reader of the patient; ids only, and only when the
-- caller may read that patient at all.
create or replace function caregiver_ids_for_patient(patient_id text)
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when can_read_patient(caregiver_ids_for_patient.patient_id) then
    coalesce((select array_agg(c.id order by c.seq) from caregivers c
              where c.linked_patient_id = caregiver_ids_for_patient.patient_id), '{}'::text[])
  end
$$;

-- invitation_patient_first_name() — F0 shows the inviting patient's FIRST name to the invitee,
-- who may read no patients row. Returns the first whitespace token (the mock's
-- name.split(/\s+/)[0]) only to the invited Civil ID's own session or a reader of that patient.
create or replace function invitation_patient_first_name(caregiver_id text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (regexp_split_to_array(p.name, '\s+'))[1]
  from caregivers c join patients p on p.id = c.linked_patient_id
  where c.id = invitation_patient_first_name.caregiver_id
    and (c.civil_id = jurah_session()->>'civilId' or can_read_patient(c.linked_patient_id))
$$;

-- =============================================================================================
-- Named constraints
-- =============================================================================================
-- accounts
select jurah_ensure_constraint('accounts', 'accounts_civil_id_key', 'unique (civil_id)');
select jurah_ensure_constraint('accounts', 'accounts_civil_id_shape', $c$check (civil_id ~ '^[0-9]{12}$')$c$);
select jurah_ensure_constraint('accounts', 'accounts_assigned_roles_clinic_only', $c$check (assigned_roles <@ '{reviewer,admin}'::role_t[])$c$);

-- patients
select jurah_ensure_constraint('patients', 'patients_civil_id_key', 'unique (civil_id)');
select jurah_ensure_constraint('patients', 'patients_civil_id_fkey', 'foreign key (civil_id) references accounts (civil_id)');

-- caregivers
select jurah_ensure_constraint('caregivers', 'caregivers_civil_id_shape', $c$check (civil_id ~ '^[0-9]{12}$')$c$);
select jurah_ensure_constraint('caregivers', 'caregivers_linked_patient_id_fkey', 'foreign key (linked_patient_id) references patients (id)');
select jurah_ensure_constraint('caregivers', 'caregivers_access_level_read_only', $c$check (access_level = 'read_only')$c$);
select jurah_ensure_constraint('caregivers', 'caregivers_active_has_accepted', $c$check (status <> 'active' or accepted_at is not null)$c$);
select jurah_ensure_constraint('caregivers', 'caregivers_declined_has_declined_at', $c$check (status <> 'declined' or declined_at is not null)$c$);
select jurah_ensure_constraint('caregivers', 'caregivers_revoked_has_revoked_at', $c$check (status <> 'revoked' or revoked_at is not null)$c$);
select jurah_ensure_constraint('caregivers', 'caregivers_pending_is_clean', $c$check (status <> 'pending' or (accepted_at is null and declined_at is null and revoked_at is null))$c$);

-- prescriptions
select jurah_ensure_constraint('prescriptions', 'prescriptions_patient_id_fkey', 'foreign key (patient_id) references patients (id)');
select jurah_ensure_constraint('prescriptions', 'prescriptions_id_patient_id_key', 'unique (id, patient_id)');
select jurah_ensure_constraint('prescriptions', 'prescriptions_field_reviewed_by_fkey', 'foreign key (field_reviewed_by) references accounts (id)');
select jurah_ensure_constraint('prescriptions', 'rx_duration_days_positive', 'check (duration_days > 0)');
select jurah_ensure_constraint('prescriptions', 'rx_dose_times_shape', 'check (dose_times is null or jurah_hhmm_array_ok(dose_times))');
select jurah_ensure_constraint('prescriptions', 'rx_dose_times_match_frequency',
  'check (dose_times is null or frequency_per_day is null or cardinality(dose_times) = frequency_per_day)');
-- Null-safe form of SCHEMA.md's expression: `field_review_status in (...)` is NULL (not false) for
-- an unflagged record, and a NULL check passes — coalesce makes the missing-field case fail.
select jurah_ensure_constraint('prescriptions', 'rx_cr002_invariant_1', $c$check (
  needs_review
  or coalesce(field_review_status in ('pending', 'returned'), false)
  or (strength_mg is not null and frequency_per_day is not null and start_date is not null and dose_times is not null))$c$);
select jurah_ensure_constraint('prescriptions', 'rx_dispensing_all_or_none', 'check (
  (dispensing_units_per_package is null and dispensing_total_quantity_dispensed is null and dispensing_dispense_date is null)
  or (dispensing_units_per_package is not null and dispensing_total_quantity_dispensed is not null and dispensing_dispense_date is not null))');
select jurah_ensure_constraint('prescriptions', 'rx_discontinued_complete', $c$check (status <> 'discontinued' or (discontinued_reason is not null and discontinued_at is not null))$c$);
select jurah_ensure_constraint('prescriptions', 'rx_confirmed_has_reviewer', $c$check (field_review_status is distinct from 'confirmed' or field_reviewed_by is not null)$c$);

-- doses
select jurah_ensure_constraint('doses', 'doses_prescription_id_fkey', 'foreign key (prescription_id) references prescriptions (id) on delete cascade');
select jurah_ensure_constraint('doses', 'dose_taken_late_has_recorded_at', $c$check (status <> 'taken_late' or recorded_at is not null)$c$);
select jurah_ensure_constraint('doses', 'dose_untracked_has_no_status', $c$check (tracked or status = 'upcoming')$c$);

-- interaction_alerts
select jurah_ensure_constraint('interaction_alerts', 'interaction_alerts_patient_id_fkey', 'foreign key (patient_id) references patients (id)');
select jurah_ensure_constraint('interaction_alerts', 'interaction_alerts_reviewed_by_fkey', 'foreign key (reviewed_by) references accounts (id)');
select jurah_ensure_constraint('interaction_alerts', 'alert_reviewed_complete', $c$check (review_status <> 'reviewed' or (reviewer_decision is not null and reviewed_at is not null and reviewed_by is not null))$c$);
select jurah_ensure_constraint('interaction_alerts', 'alert_unreviewed_clean', $c$check (review_status = 'reviewed' or (reviewer_decision is null and reviewer_note is null and reviewed_at is null and reviewed_by is null))$c$);
select jurah_ensure_constraint('interaction_alerts', 'alert_involves_something', 'check (cardinality(involved_prescription_ids) >= 1)');

-- refill_requests
select jurah_ensure_constraint('refill_requests', 'refill_requests_patient_id_fkey', 'foreign key (patient_id) references patients (id)');
select jurah_ensure_constraint('refill_requests', 'refill_requests_prescription_id_fkey', 'foreign key (prescription_id) references prescriptions (id)');
-- Ownership, a second time, in the schema itself: the (prescription, patient) pair must exist.
select jurah_ensure_constraint('refill_requests', 'refill_requests_prescription_owner_fkey', 'foreign key (prescription_id, patient_id) references prescriptions (id, patient_id)');
select jurah_ensure_constraint('refill_requests', 'refill_routed_matches_sector', 'check (routed_to = routed_from_sector)');

-- calendar_subscriptions
select jurah_ensure_constraint('calendar_subscriptions', 'calendar_subscriptions_patient_id_fkey', 'foreign key (patient_id) references patients (id)');
select jurah_ensure_constraint('calendar_subscriptions', 'calendar_subscriptions_token_key', 'unique (token)');

-- messaging_links
select jurah_ensure_constraint('messaging_links', 'messaging_links_link_token_key', 'unique (link_token)');
select jurah_ensure_constraint('messaging_links', 'link_connected_has_chat', $c$check (status <> 'connected' or chat_id is not null)$c$);
select jurah_ensure_constraint('messaging_links', 'link_pending_has_token', $c$check (status <> 'pending' or (link_token is not null and token_expires_at is not null))$c$);

-- push_subscriptions
select jurah_ensure_constraint('push_subscriptions', 'push_subscriptions_subject_key', 'unique (subject_type, subject_id)');

-- audit_events
select jurah_ensure_constraint('audit_events', 'audit_events_patient_id_fkey', 'foreign key (patient_id) references patients (id)');
select jurah_ensure_constraint('audit_events', 'audit_patient_scope_has_patient', $c$check (scope <> 'patient' or patient_id is not null)$c$);
select jurah_ensure_constraint('audit_events', 'audit_message_no_civil_id', $c$check (message !~ '[0-9]{12}')$c$);
select jurah_ensure_constraint('audit_events', 'audit_dose_status_actor', $c$check (type <> 'dose_status_recorded' or actor_role in ('agent', 'system'))$c$);

-- settings
select jurah_ensure_constraint('settings', 'settings_patient_id_fkey', 'foreign key (patient_id) references patients (id)');

-- server-side tables
select jurah_ensure_constraint('sessions', 'sessions_role_or_pending', 'check (pending_invitation_only or role is not null)');
select jurah_ensure_constraint('prescription_drafts', 'prescription_drafts_patient_id_fkey', 'foreign key (patient_id) references patients (id)');
select jurah_ensure_constraint('civil_id_test_list', 'civil_id_test_list_shape', $c$check (civil_id ~ '^[0-9]{12}$')$c$);

-- =============================================================================================
-- Guard triggers
-- =============================================================================================

-- caregiver_transitions — the invitation gate (G9). Allowed edges only, each with its one caller.
-- pending→active is possible for exactly one caller: a session whose server-resolved civilId is
-- this row's civil_id, before expires_at. No SECURITY DEFINER function, no policy and no role
-- bypasses this: the owner with a 'system' session is refused like everyone else.
create or replace function caregiver_transitions()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  s jsonb := jurah_session();
  r text := s->>'role';
  subj text := s->>'subjectId';
  cid text := s->>'civilId';
  invitee boolean := cid is not null and cid = old.civil_id;
  owner_patient boolean := r = 'patient' and subj = old.linked_patient_id;
begin
  if new.id is distinct from old.id or new.civil_id is distinct from old.civil_id
     or new.linked_patient_id is distinct from old.linked_patient_id then
    raise exception 'caregiver_transitions: id, civil_id and linked_patient_id never change';
  end if;
  if new.invited_at is distinct from old.invited_at or new.expires_at is distinct from old.expires_at
     or new.access_level is distinct from old.access_level then
    raise exception 'caregiver_transitions: invited_at, expires_at and access_level never change';
  end if;

  if new.status = old.status then
    if (new.accepted_at, new.declined_at, new.revoked_at) is distinct from (old.accepted_at, old.declined_at, old.revoked_at) then
      raise exception 'caregiver_transitions: lifecycle timestamps change only with a transition';
    end if;
    return new;
  end if;

  if old.status = 'pending' and new.status = 'active' then
    if not invitee then
      raise exception 'caregiver_transitions: only the invited civil id may accept';
    end if;
    if old.expires_at <= jurah_now() then
      raise exception 'caregiver_transitions: the invitation has expired';
    end if;
    if new.accepted_at is null then
      raise exception 'caregiver_transitions: acceptance must set accepted_at';
    end if;
    return new;
  elsif old.status = 'pending' and new.status = 'declined' then
    if not invitee then
      raise exception 'caregiver_transitions: only the invited civil id may decline';
    end if;
    if old.expires_at <= jurah_now() then
      raise exception 'caregiver_transitions: the invitation has expired';
    end if;
    return new;
  elsif old.status = 'pending' and new.status = 'revoked' then
    if not owner_patient then
      raise exception 'caregiver_transitions: only the inviting patient may cancel an invitation';
    end if;
    if new.accepted_at is not null then
      raise exception 'caregiver_transitions: a cancelled invitation was never accepted';
    end if;
    return new;
  elsif old.status = 'pending' and new.status = 'expired' then
    if r is distinct from 'system' then
      raise exception 'caregiver_transitions: only the system expires an invitation';
    end if;
    if old.expires_at > jurah_now() then
      raise exception 'caregiver_transitions: the invitation has not expired yet';
    end if;
    return new;
  elsif old.status = 'active' and new.status = 'revoked' then
    if not (owner_patient or (r = 'caregiver' and subj = old.id and invitee)) then
      raise exception 'caregiver_transitions: only the linked patient or the caregiver may end access';
    end if;
    if new.accepted_at is distinct from old.accepted_at then
      raise exception 'caregiver_transitions: accepted_at is kept on revocation';
    end if;
    return new;
  end if;

  raise exception 'caregiver_transitions: % → % is not an allowed transition', old.status, new.status;
end
$$;

create or replace trigger caregiver_transitions
  before update on caregivers
  for each row execute function caregiver_transitions();

-- prescription_clinical_fields_locked — the clinical fields change only on the audited reviewer
-- confirm path (field_review_status pending → confirmed in the same statement); the review
-- decision itself is one-shot (pending → confirmed | returned, never again); status and the
-- discontinuation fields change only on the agent/system discontinuation path; id and patient_id never.
create or replace function prescription_clinical_fields_locked()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  reviewer boolean := jurah_session_is('reviewer');
  confirming boolean := reviewer and old.field_review_status = 'pending' and new.field_review_status = 'confirmed';
  deciding boolean := reviewer and old.field_review_status = 'pending' and new.field_review_status in ('confirmed', 'returned');
  engine boolean := current_user = 'jurah_agent' or coalesce(jurah_session()->>'role', '') = 'system';
begin
  if new.id is distinct from old.id or new.patient_id is distinct from old.patient_id then
    raise exception 'prescription_clinical_fields_locked: id and patient_id never change';
  end if;
  if (new.generic_name, new.brand_name, new.strength_mg, new.strength_unit, new.dose_per_administration,
      new.frequency_per_day, new.duration_days, new.dosing_pattern, new.start_date, new.dose_times,
      new.sector, new.facility_name)
     is distinct from
     (old.generic_name, old.brand_name, old.strength_mg, old.strength_unit, old.dose_per_administration,
      old.frequency_per_day, old.duration_days, old.dosing_pattern, old.start_date, old.dose_times,
      old.sector, old.facility_name)
     and not confirming then
    raise exception 'prescription_clinical_fields_locked: clinical fields change only when a reviewer confirms a pending record';
  end if;
  if (new.field_review_status, new.needs_review, new.field_reviewed_by, new.field_reviewed_at, new.field_review_note)
     is distinct from
     (old.field_review_status, old.needs_review, old.field_reviewed_by, old.field_reviewed_at, old.field_review_note)
     and not deciding then
    raise exception 'prescription_clinical_fields_locked: a field review is decided once, by a reviewer, from pending';
  end if;
  if (new.status, new.discontinued_reason, new.discontinued_at)
     is distinct from (old.status, old.discontinued_reason, old.discontinued_at)
     and not engine then
    raise exception 'prescription_clinical_fields_locked: status changes only on the agent/system discontinuation path';
  end if;
  return new;
end
$$;

create or replace trigger prescription_clinical_fields_locked
  before update on prescriptions
  for each row execute function prescription_clinical_fields_locked();

-- doses_status_write — G1. A dose status is written only by jurah_agent (which alone holds the
-- column grant) or by the system actor (the seed, and the WP4 engine as owner). An INSERT that
-- carries a status other than 'upcoming' is a status write too and is held to the same rule, so
-- the generation grant jurah_app holds cannot be used to create a recorded dose.
create or replace function doses_status_write()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user = 'jurah_agent' or coalesce(jurah_session()->>'role', '') = 'system' then
    return new;
  end if;
  if tg_op = 'INSERT' and new.status = 'upcoming' then
    return new;
  end if;
  raise exception 'doses_status_write: a dose status is written only by the adherence agent or the system';
end
$$;

create or replace trigger doses_status_write
  before insert or update of status on doses
  for each row execute function doses_status_write();

-- doses_status_recorded_audit — every status write appends dose_status_recorded naming its actor,
-- by construction (E-04). The actor is 'agent' for jurah_agent and 'system' otherwise; the check
-- audit_dose_status_actor makes any other actor impossible.
create or replace function doses_status_recorded_audit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  rx record;
  word text;
begin
  select p.patient_id, p.generic_name into rx from prescriptions p where p.id = new.prescription_id;
  if not found then
    raise exception 'doses_status_recorded_audit: the dose''s prescription is not visible to the writer';
  end if;
  word := case new.status::text
            when 'taken_on_time' then 'في وقتها'
            when 'taken_late' then 'متأخرة'
            when 'missed' then 'فائتة'
            else 'قادمة'
          end;
  insert into audit_events (id, scope, patient_id, actor_role, actor_id, type, message, created_at, related_id)
  values (jurah_new_id('ae'), 'patient', rx.patient_id,
          case when current_user = 'jurah_agent' then 'agent'::actor_role_t else 'system'::actor_role_t end,
          null, 'dose_status_recorded', 'تسجيل حالة جرعة — ' || word || ': ' || rx.generic_name,
          jurah_now(), new.id);
  return new;
end
$$;

create or replace trigger doses_status_recorded_audit
  after update of status on doses
  for each row execute function doses_status_recorded_audit();

-- alert_review_once — the five review fields change only while pending_medical_review and only by
-- a reviewer; everything else is immutable after insert; a second decision raises (tightened from
-- the mock, which overwrites — BACKEND-NOTES §3 wp4i).
create or replace function alert_review_once()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (new.id, new.patient_id, new.involved_prescription_ids, new.severity, new.description, new.source_citation, new.created_at)
     is distinct from
     (old.id, old.patient_id, old.involved_prescription_ids, old.severity, old.description, old.source_citation, old.created_at) then
    raise exception 'alert_review_once: only the five review fields may ever change';
  end if;
  if (new.review_status, new.reviewer_decision, new.reviewer_note, new.reviewed_at, new.reviewed_by)
     is distinct from
     (old.review_status, old.reviewer_decision, old.reviewer_note, old.reviewed_at, old.reviewed_by) then
    if old.review_status <> 'pending_medical_review' then
      raise exception 'alert_review_once: this alert has already been decided';
    end if;
    if not jurah_session_is('reviewer') then
      raise exception 'alert_review_once: only a reviewer may decide';
    end if;
  end if;
  return new;
end
$$;

create or replace trigger alert_review_once
  before update on interaction_alerts
  for each row execute function alert_review_once();

-- refill_routing — ownership and active status (D-014), and routed_to OVERWRITTEN from the
-- prescription's own sector: a client-supplied value can never survive.
create or replace function refill_routing()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  rx record;
begin
  if tg_op = 'UPDATE' then
    if (new.patient_id, new.prescription_id, new.routed_to, new.sector, new.requested_at)
       is distinct from (old.patient_id, old.prescription_id, old.routed_to, old.sector, old.requested_at) then
      raise exception 'refill_routing: only a refill''s status may change';
    end if;
    return new;
  end if;
  select p.patient_id, p.status, p.sector into rx from prescriptions p where p.id = new.prescription_id;
  if not found then
    raise exception 'refill_routing: prescription not found for this patient';
  end if;
  if rx.patient_id <> new.patient_id then
    raise exception 'refill_routing: prescription does not belong to this patient';
  end if;
  if rx.status <> 'active' then
    raise exception 'refill_routing: prescription is not active';
  end if;
  new.sector := rx.sector;
  new.routed_to := case when rx.sector = 'public' then 'public_pharmacy'::routed_to_t else 'private_pharmacy'::routed_to_t end;
  return new;
end
$$;

create or replace trigger refill_routing
  before insert or update on refill_requests
  for each row execute function refill_routing();

-- settings_tracking_requires_link — G10: tracking on without a connected chat is refused QUIETLY:
-- the flag is reset (to the old value on update, false on insert), never an error. "Connected"
-- reads the subject's most recent link row (order by seq desc), the same row getMessagingLink shows.
create or replace function settings_tracking_requires_link()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.adherence_check_in_enabled and not exists (
    select 1 from (
      select l.status from messaging_links l
      where l.subject_type = 'patient' and l.subject_id = new.patient_id
      order by l.seq desc limit 1
    ) latest where latest.status = 'connected'
  ) then
    new.adherence_check_in_enabled := case when tg_op = 'UPDATE' then old.adherence_check_in_enabled else false end;
  end if;
  return new;
end
$$;

create or replace trigger settings_tracking_requires_link
  before insert or update of adherence_check_in_enabled on settings
  for each row execute function settings_tracking_requires_link();

-- link_chat_id_server_only — a chat_id is set only by the system actor (the webhook path, or the
-- owner-run seed), never from a user session and never by the agent role. Clearing it is allowed.
create or replace function link_chat_id_server_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.chat_id is not null and (tg_op = 'INSERT' or new.chat_id is distinct from old.chat_id) then
    if current_user = 'jurah_agent' or coalesce(jurah_session()->>'role', '') <> 'system' then
      raise exception 'link_chat_id_server_only: a chat id is set only by the messaging webhook';
    end if;
  end if;
  return new;
end
$$;

create or replace trigger link_chat_id_server_only
  before insert or update of chat_id on messaging_links
  for each row execute function link_chat_id_server_only();

-- link_caregiver_must_be_active — a caregiver subject's link row exists only while it is active.
create or replace function link_caregiver_must_be_active()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.subject_type = 'caregiver' and not exists (
    select 1 from caregivers c where c.id = new.subject_id and c.status = 'active'
  ) then
    raise exception 'link_caregiver_must_be_active: a caregiver can link a chat only while active';
  end if;
  return new;
end
$$;

create or replace trigger link_caregiver_must_be_active
  before insert on messaging_links
  for each row execute function link_caregiver_must_be_active();

-- audit_events_immutable — append-only, binding the table owner too (grants do not). Statement
-- level, so even an UPDATE or DELETE that matches no row raises.
create or replace function audit_events_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'audit_events is append-only';
end
$$;

create or replace trigger audit_events_immutable
  before update or delete on audit_events
  for each statement execute function audit_events_immutable();
