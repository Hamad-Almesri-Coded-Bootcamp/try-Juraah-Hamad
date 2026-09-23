-- 0001 · roles and table-independent functions (docs/SCHEMA.md §3 "Roles", "Functions").
-- Idempotent: every statement is create-if-absent or create-or-replace, so a re-apply is a no-op.
-- Functions that read tables (can_read_patient, civil_id_for_session, account_roles …) need the
-- enum types and tables, so they live at the top of 0004 beside the triggers that call them.

-- ---------------------------------------------------------------------------------------------
-- Roles. NOLOGIN, no BYPASSRLS. Both granted to postgres so the one pooled connection can
-- `set local role` into them inside withSession()/withAgent() (D-017).
-- ---------------------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'jurah_app') then
    create role jurah_app nologin nobypassrls noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'jurah_agent') then
    create role jurah_agent nologin nobypassrls noinherit;
  end if;
end
$$;

grant jurah_app to postgres;
grant jurah_agent to postgres;
grant usage on schema public to jurah_app, jurah_agent;

-- Supabase's default privileges hand every new table, sequence and function in `public` to the
-- PostgREST roles. The Data API is not the transport (docs/SCHEMA.md §3): switch that off for
-- everything created from here on. 0005 also revokes explicitly on what exists.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role, public;

-- ---------------------------------------------------------------------------------------------
-- Migration helper: add a named constraint only when it is absent (Postgres has no
-- `add constraint if not exists`). Used by 0004 so the file re-applies as a no-op.
-- ---------------------------------------------------------------------------------------------
create or replace function jurah_ensure_constraint(tbl regclass, cname text, ddl text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from pg_constraint where conrelid = tbl and conname = cname) then
    execute format('alter table %s add constraint %I %s', tbl, cname, ddl);
  end if;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- jurah_session() — the verified session plus its server-resolved civilId, set by withSession()
-- with set_config(..., true). `current_setting(..., true)` returns '' (not NULL) once the
-- placeholder has existed on a pooled connection, hence the nullif: no session → NULL → every
-- policy reads nothing.
-- ---------------------------------------------------------------------------------------------
create or replace function jurah_session()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select nullif(current_setting('jurah.session', true), '')::jsonb
$$;

-- jurah_now() — the frozen clock (D-021). withSession() sets `jurah.now` from REFERENCE_NOW in
-- lib/config.ts on every transaction; the wall-clock fallback below is the ONE place any SQL in
-- this repository may call the clock (guard 6 exempts exactly this function's body).
create or replace function jurah_now()
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(nullif(current_setting('jurah.now', true), '')::timestamptz, now())
$$;

-- iso_kw() — every timestamp leaves the database as YYYY-MM-DDTHH:mm:ss+03:00 (risk 1, D-26).
create or replace function iso_kw(t timestamptz)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select to_char(t at time zone 'Asia/Kuwait', 'YYYY-MM-DD"T"HH24:MI:SS"+03:00"')
$$;

-- mask_name() — CR-047, G9, CLAUDE.md rule 6: first and family name in full, each middle name as
-- its first letter plus EXACTLY three asterisks whatever its length, honorifics د./م. stripped,
-- two-part names unchanged. The SQL twin of maskName() in lib/format/maskedName.tsx; the
-- integration suite asserts the two agree on the seed's eight examples.
create or replace function mask_name(full_name text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  parts text[];
  n int;
  result text;
  i int;
begin
  if full_name is null then
    return null;
  end if;
  parts := array_remove(regexp_split_to_array(btrim(full_name), '\s+'), '');
  if coalesce(array_length(parts, 1), 0) > 0 and parts[1] in ('د.', 'م.') then
    parts := parts[2:];
  end if;
  n := coalesce(array_length(parts, 1), 0);
  if n = 0 then
    return '';
  end if;
  if n <= 2 then
    return array_to_string(parts, ' ');
  end if;
  result := parts[1];
  for i in 2 .. n - 1 loop
    result := result || ' ' || left(parts[i], 1) || '***';
  end loop;
  return result || ' ' || parts[n];
end
$$;

-- jurah_new_id() — the SQL-side opaque id for rows a trigger creates (CR-041): '<prefix>_<32 hex>'.
-- Application-created rows use lib/db/ids.ts's '<prefix>_<ULID>'; both are opaque, neither is a counter.
create or replace function jurah_new_id(prefix text)
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  select prefix || '_' || replace(gen_random_uuid()::text, '-', '')
$$;

-- jurah_hhmm_array_ok() — every element of a dose_times array is "HH:mm" (rx_dose_times_shape).
create or replace function jurah_hhmm_array_ok(a text[])
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(bool_and(x ~ '^[0-2][0-9]:[0-5][0-9]$'), true) from unnest(a) as x
$$;
