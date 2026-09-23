-- 0002 · enum types, one per contract union (docs/SCHEMA.md "Conventions"). Values verbatim from
-- types/contracts.ts. `dose_source_t` has no 'ui' value, so the database cannot store one (G1).
-- Postgres has no `create type if not exists`; each is created only when absent.

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('role_t',              array['patient','caregiver','reviewer','admin']),
      ('actor_role_t',        array['patient','caregiver','reviewer','admin','agent','system']),
      ('caregiver_status_t',  array['pending','active','declined','expired','revoked']),
      ('sector_t',            array['public','private']),
      ('strength_unit_t',     array['mg','mcg','g','ml','IU']),
      ('dosing_pattern_t',    array['daily','alternate_day','other']),
      ('field_review_t',      array['pending','confirmed','returned']),
      ('rx_status_t',         array['active','completed','discontinued']),
      ('dose_status_t',       array['upcoming','taken_on_time','taken_late','missed']),
      ('dose_source_t',       array['adherence_agent','system','seed']),
      ('severity_t',          array['info','warning','danger']),
      ('review_status_t',     array['auto_cleared','pending_medical_review','reviewed']),
      ('reviewer_decision_t', array['confirmed','cleared']),
      ('routed_to_t',         array['public_pharmacy','private_pharmacy']),
      ('refill_status_t',     array['requested','approved','denied']),
      ('subject_type_t',      array['patient','caregiver']),
      ('link_status_t',       array['not_connected','pending','connected','expired']),
      ('push_status_t',       array['active','revoked']),
      ('push_permission_t',   array['default','granted','denied','unsupported']),
      ('audit_scope_t',       array['patient','system']),
      ('audit_type_t',        array[
        'prescription_added','prescription_discontinued','prescription_field_confirmed',
        'prescription_returned_to_clinic','alert_raised','alert_reviewed','dose_status_recorded',
        'schedule_recomputed','refill_requested','refill_status_changed','caregiver_invited',
        'caregiver_invite_accepted','caregiver_invite_declined','caregiver_invite_expired',
        'caregiver_invite_cancelled','caregiver_revoked','caregiver_self_unlinked',
        'messaging_connected','messaging_disconnected','push_enabled','push_disabled',
        'tracking_enabled','tracking_disabled','signed_in','signed_out']),
      ('language_t',          array['ar','en']),
      ('checkin_freq_t',      array['daily','every_other_day']),
      ('channel_t',           array['none','telegram','whatsapp','email'])
    ) as v(name, labels)
  loop
    if not exists (
      select 1 from pg_type ty join pg_namespace ns on ns.oid = ty.typnamespace
      where ns.nspname = 'public' and ty.typname = t.name
    ) then
      execute format('create type public.%I as enum (%s)', t.name,
        (select string_agg(quote_literal(l), ', ' order by ord) from unnest(t.labels) with ordinality as u(l, ord)));
    end if;
  end loop;
end
$$;
