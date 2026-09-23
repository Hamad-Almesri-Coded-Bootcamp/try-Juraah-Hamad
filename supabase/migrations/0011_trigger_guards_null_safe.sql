-- 0011 · two trigger guards that three-valued logic let through (found on the first integration run
-- against the real database, 2026-09-23 — docs/VERIFICATION.md). Adds, never edits 0001–0010.
-- Idempotent: create-or-replace only. The bodies are 0004's, byte for byte, except that each
-- boolean guard is wrapped in coalesce(…, false). Nothing else changes.
--
-- In PL/pgSQL `if <cond> and not x then raise` does NOT raise when x is NULL, and a guard built as
-- `a = b and c = d` is NULL — not false — whenever one side is NULL:
--
--   prescription_clinical_fields_locked: `confirming`/`deciding` compare old.field_review_status,
--   which is NULL on every never-flagged prescription (rx-001 …). A reviewer-session UPDATE of a
--   clinical field, or of the review columns, on such a row was ACCEPTED (tests/integration/schema/
--   prescriptions.test.ts; E-34 was caught only later by the rx_confirmed_has_reviewer CHECK).
--
--   caregiver_transitions: `owner_patient` (and the caregiver half of active→revoked) compare the
--   session's role, which is NULL with no session. The owner connection with no session could
--   cancel a pending invitation or end an active link (probe: cg-03 pending→revoked, 1 row). The
--   header promises "no policy and no role bypasses this"; jurah_app was still stopped by RLS.
--
-- `invitee` already guarded `cid is not null`; it is wrapped too, for uniformity.

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
  invitee boolean := coalesce(cid is not null and cid = old.civil_id, false);
  owner_patient boolean := coalesce(r = 'patient' and subj = old.linked_patient_id, false);
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
    if not (owner_patient or coalesce(r = 'caregiver' and subj = old.id and invitee, false)) then
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

create or replace function prescription_clinical_fields_locked()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  reviewer boolean := jurah_session_is('reviewer');
  confirming boolean := coalesce(reviewer and old.field_review_status = 'pending' and new.field_review_status = 'confirmed', false);
  deciding boolean := coalesce(reviewer and old.field_review_status = 'pending' and new.field_review_status in ('confirmed', 'returned'), false);
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
