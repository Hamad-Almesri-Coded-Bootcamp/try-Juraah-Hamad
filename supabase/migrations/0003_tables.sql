-- 0003 · tables (docs/SCHEMA.md §1 contract entities, §2 server-side tables). Columns, types,
-- nullability and defaults only; every named constraint, foreign key and trigger is in 0004 so its
-- name is visible in one place. Ids are text (CR-041). `seq` reproduces the mock's insertion order
-- and is never projected.

-- ---------------------------------------------------------------------------------------------
-- §1 Contract entities
-- ---------------------------------------------------------------------------------------------
create table if not exists accounts (
  id               text primary key,
  civil_id         text not null,
  name             text not null,
  assigned_roles   role_t[] not null default '{}',
  last_chosen_role role_t
);

create table if not exists patients (
  id                   text primary key,
  civil_id             text not null,
  name                 text not null,
  telegram_chat_id     text,
  telegram_linked_at   timestamptz,
  phone                text,
  language             language_t not null,
  onboarding_completed boolean not null
);

create table if not exists caregivers (
  id                text primary key,
  seq               bigint generated always as identity,
  civil_id          text not null,
  name              text not null,
  relationship      text not null,
  phone             text,
  telegram_chat_id  text,
  linked_patient_id text not null,
  status            caregiver_status_t not null,
  invited_at        timestamptz not null,
  expires_at        timestamptz not null,
  accepted_at       timestamptz,
  declined_at       timestamptz,
  revoked_at        timestamptz,
  access_level      text not null default 'read_only'
);

create table if not exists prescriptions (
  id                                   text primary key,
  seq                                  bigint generated always as identity,
  patient_id                           text not null,
  facility_name                        text not null,
  sector                               sector_t not null,
  generic_name                         text not null,
  brand_name                           text,
  strength_mg                          numeric,
  strength_unit                        strength_unit_t,
  dose_per_administration              numeric not null,
  frequency_per_day                    int,
  duration_days                        int not null,
  dosing_pattern                       dosing_pattern_t not null,
  start_date                           date,
  dose_times                           text[],
  prescribed_at                        timestamptz,
  prescriber_name                      text,
  timing_relative_to_food              text,
  route_of_administration              text,
  special_notes                        text,
  indication                           text,
  dispensing_units_per_package         int,
  dispensing_total_quantity_dispensed  numeric,
  dispensing_dispense_date             date,
  dispensing_brand_actually_dispensed  text,
  needs_review                         boolean not null,
  field_review_status                  field_review_t,
  field_reviewed_by                    text,
  field_reviewed_at                    timestamptz,
  field_review_note                    text,
  status                               rx_status_t not null,
  discontinued_reason                  text,
  discontinued_at                      date
);

create table if not exists doses (
  id              text primary key,
  -- Not in SCHEMA.md's doses table; API-SURFACE §B's ICS ETag is "from the doses' max seq". Never projected.
  seq             bigint generated always as identity,
  prescription_id text not null,
  scheduled_at    timestamptz not null,
  status          dose_status_t not null default 'upcoming',
  tracked         boolean not null default true,
  recorded_at     timestamptz,
  source          dose_source_t
);

create table if not exists interaction_alerts (
  id                       text primary key,
  patient_id               text not null,
  involved_prescription_ids text[] not null,
  severity                 severity_t not null,
  description              text not null,
  source_citation          text not null,
  created_at               timestamptz not null,
  review_status            review_status_t not null,
  reviewer_decision        reviewer_decision_t,
  reviewer_note            text,
  reviewed_at              timestamptz,
  reviewed_by              text
);

create table if not exists refill_requests (
  id              text primary key,
  seq             bigint generated always as identity,
  patient_id      text not null,
  prescription_id text not null,
  requested_at    timestamptz not null,
  routed_to       routed_to_t not null,
  status          refill_status_t not null,
  -- Not in SCHEMA.md: the prescription's sector, copied by trigger refill_routing, so the check
  -- refill_routed_matches_sector can compare same-row values (a generated column cannot read
  -- another table). routed_from_sector is the generated column SCHEMA.md asks for.
  sector          sector_t not null,
  routed_from_sector routed_to_t generated always as (
    case when sector = 'public'::sector_t then 'public_pharmacy'::routed_to_t else 'private_pharmacy'::routed_to_t end
  ) stored
);

create table if not exists calendar_subscriptions (
  patient_id text primary key,
  token      text not null,
  ics_url    text not null,
  created_at timestamptz not null default jurah_now()
);

create table if not exists messaging_links (
  id               text primary key,
  seq              bigint generated always as identity,
  subject_type     subject_type_t not null,
  subject_id       text not null,
  channel          channel_t not null default 'telegram',
  status           link_status_t not null default 'not_connected',
  link_token       text,
  token_expires_at timestamptz,
  chat_id          text,
  connected_at     timestamptz,
  created_at       timestamptz not null default jurah_now()
);

create table if not exists push_subscriptions (
  id                  text primary key,
  subject_type        subject_type_t not null,
  subject_id          text not null,
  status              push_status_t not null,
  permission          push_permission_t not null,
  created_at          timestamptz not null,
  endpoint            text,
  p256dh              text,
  auth                text,
  endpoint_updated_at timestamptz
);

create table if not exists audit_events (
  id         text primary key,
  seq        bigint generated always as identity,
  scope      audit_scope_t not null,
  patient_id text,
  actor_role actor_role_t not null,
  actor_id   text,
  type       audit_type_t not null,
  message    text not null,
  created_at timestamptz not null,
  related_id text
);

create table if not exists settings (
  patient_id                   text primary key,
  adherence_check_in_enabled   boolean not null default false,
  adherence_check_in_frequency checkin_freq_t not null default 'daily',
  refill_alerts_enabled        boolean not null default false,
  calendar_sync_enabled        boolean not null default false,
  web_push_enabled             boolean not null default false,
  notification_channel         channel_t not null default 'none',
  language                     language_t not null default 'ar'
);

-- ---------------------------------------------------------------------------------------------
-- §2 Server-side tables — no contract, no screen
-- ---------------------------------------------------------------------------------------------
create table if not exists sessions (
  id                      text primary key,
  subject_id              text not null,
  role                    role_t,
  linked_patient_id       text,
  pending_invitation_only boolean not null default false,
  created_at              timestamptz not null default jurah_now(),
  expires_at              timestamptz not null,
  revoked_at              timestamptz
);

create table if not exists prescription_drafts (
  draft_id         text primary key,
  patient_id       text not null,
  prescription     jsonb not null,
  confident        boolean not null,
  uncertain_fields text[],
  image            bytea,
  created_at       timestamptz not null default jurah_now()
);

create table if not exists lookup_audit (
  id         bigint generated always as identity primary key,
  session_id text not null,
  subject_id text not null,
  at         timestamptz not null default jurah_now()
);

create table if not exists snapshots (
  subject_id text not null,
  key        text not null,
  -- json, not jsonb: jsonb re-sorts object keys, and a snapshot must come back byte-identical to
  -- the shape that was cached (key order included — BACKEND-PLAN §6). Deviation logged.
  data       json not null,
  as_of      timestamptz not null,
  primary key (subject_id, key)
);

create table if not exists civil_id_test_list (
  civil_id text primary key
);

create table if not exists job_runs (
  id            bigint generated always as identity primary key,
  job           text not null,
  ran_at        timestamptz not null default jurah_now(),
  rows_affected int not null
);
