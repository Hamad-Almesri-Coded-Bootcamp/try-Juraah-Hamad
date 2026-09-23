-- 0009 · the masked-name lookup and the invitation's masked audit name (P2-WP5, D-026). Adds, never
-- edits 0001–0007. Numbered 0009 because WP7's brief reserves 0008 (agent grants); the two are
-- independent, so either order of application is safe.
-- Idempotent: create-or-replace, revoke/grant repeat.
--
-- Why it exists: jurah_app holds NO select on `accounts` (p2-wp1 §3.15), and SCHEMA.md §3's grant
-- table already assumes "mask_name via lookupMaskedName's definer function" — which no earlier
-- migration built. Both functions below are SECURITY DEFINER, return a masked name (or null) and
-- nothing else, never return or store a Civil ID, and write nothing but `lookup_audit` rows.
-- Neither touches `caregivers` at all: G9's "no SECURITY DEFINER path to active" is unchanged.

-- ---------------------------------------------------------------------------------------------
-- lookup_masked_name(civil_id, session_id) — lookupMaskedName (F1/A2, G9, CR-043, E-13/E-14).
--   1. no session GUC → null, and nothing is written (there is no caller to audit, E-14);
--   2. ALWAYS insert one lookup_audit row (session id, subject id, jurah_now()) — no Civil ID column;
--   3. ALWAYS run the account query AND the masking, whether or not the rate limit has tripped and
--      whether or not an account exists — one plan, no early exit (E-13);
--   4. more than 10 rows for this session in the last 60 s (this call included) → null, the SAME
--      value "no account" returns (CR-043's trade-off, owner-approved).
-- `p_session_id` is the verified cookie's `sid`, supplied by the seam (lib/data/pg/writes.ts) from
-- lib/session/cookie.ts's readSessionClaims(); the GUC carries no sid (docs/backend-notes/p2-wp5.md).
-- ---------------------------------------------------------------------------------------------
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
  insert into lookup_audit (session_id, subject_id, at) values (p_session_id, s->>'subjectId', jurah_now());
  select count(*) into recent
    from lookup_audit la
   where la.session_id = p_session_id and la.at > jurah_now() - interval '60 seconds';
  select a.name into acct_name from accounts a where a.civil_id = p_civil_id;
  -- mask_name runs on BOTH branches (a four-part stand-in when there is no account), so the
  -- no-account path does the same work as the account path — not only the same query (E-13).
  masked := mask_name(coalesce(acct_name, 'اسم اسم اسم اسم'));
  return case when recent > 10 or acct_name is null then null else masked end;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- invitation_masked_name(caregiver_id) — the `caregiver_invited` audit message names the invitee
-- the way every seed row does ("دعوة مقدّم رعاية إلى <masked>") when the Civil ID has an account,
-- and the neutral wording otherwise. It answers ONLY for a caregivers row that is `pending` and
-- linked to the calling patient's own session — i.e. only for an invitation the caller has just
-- created (and which is itself visible to them, audited, and grants nothing). It is not a lookup
-- oracle: no row, no answer.
-- ---------------------------------------------------------------------------------------------
create or replace function invitation_masked_name(p_caregiver_id text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select mask_name(a.name)
  from caregivers c
  join accounts a on a.civil_id = c.civil_id
  where c.id = p_caregiver_id
    and c.status = 'pending'
    and jurah_session_is('patient')
    and c.linked_patient_id = jurah_session()->>'subjectId'
$$;

revoke all on function lookup_masked_name(text, text) from public, anon, authenticated, service_role;
revoke all on function invitation_masked_name(text) from public, anon, authenticated, service_role;
grant execute on function lookup_masked_name(text, text) to jurah_app;
grant execute on function invitation_masked_name(text) to jurah_app;
