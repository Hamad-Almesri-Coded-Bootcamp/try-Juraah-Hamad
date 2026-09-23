-- 0010 · the masked-name rate-limit window reads the wall clock (P2-WP5 follow-up, D-037, D-036).
-- Adds, never edits 0001–0009. Idempotent: create-or-replace, drop-if-exists, revoke/grant repeat.
--
-- D-037: under the frozen clock (D-021, jurah_now() = REFERENCE_NOW) every lookup_audit row carried
-- the same instant, so the 60-second window never passed and the eleventh lookup in a session was
-- refused FOREVER (WP5-12). Rate limiting is an operational control, not a domain time comparison:
-- lookup_masked_name now stamps `lookup_audit.at` with clock_timestamp() and counts the window
-- against clock_timestamp(). This function is the ONE sanctioned SQL wall-clock read besides
-- jurah_now()'s own fallback; guard 6 (scripts/guards/no-clock.ts) allows exactly these two bodies.
-- Nothing else changes: the audit row per call, the account query and the masking on every branch
-- (E-13), null over 10 rows in the window (CR-043), no Civil ID stored. The column default of
-- lookup_audit.at stays jurah_now() — the function always writes the column itself, and keeping the
-- default untouched keeps the wall-clock read inside this one function body.
--
-- D-036: the invite audit line is neutral in every case, so invitation_masked_name() (0009) has no
-- caller any more. An unused SECURITY DEFINER function over `accounts` is surface with no purpose;
-- it is dropped here.

create or replace function lookup_masked_name(p_civil_id text, p_session_id text)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  s jsonb := jurah_session();
  recent int;
  acct_name text;
  masked text;
begin
  if s is null or coalesce(s->>'subjectId', '') = '' or coalesce(p_session_id, '') = '' then
    return null;
  end if;
  insert into lookup_audit (session_id, subject_id, at) values (p_session_id, s->>'subjectId', clock_timestamp());
  select count(*) into recent
    from lookup_audit la
   where la.session_id = p_session_id and la.at > clock_timestamp() - interval '60 seconds';
  select a.name into acct_name from accounts a where a.civil_id = p_civil_id;
  -- mask_name runs on BOTH branches (a four-part stand-in when there is no account), so the
  -- no-account path does the same work as the account path — not only the same query (E-13).
  masked := mask_name(coalesce(acct_name, 'اسم اسم اسم اسم'));
  return case when recent > 10 or acct_name is null then null else masked end;
end
$$;

revoke all on function lookup_masked_name(text, text) from public, anon, authenticated, service_role;
grant execute on function lookup_masked_name(text, text) to jurah_app;

drop function if exists invitation_masked_name(text);
