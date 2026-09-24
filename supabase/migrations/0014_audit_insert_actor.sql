-- 0014 · the audit insert policy checks the actor a row names (CR-061; AP-12 of
-- docs/AGENTS-POLISH-PLAN.md; DECISIONS CR-091). Adds, never edits 0001-0013. Idempotent: the
-- policy is dropped if it exists, then created, so a re-apply changes nothing.
--
-- Before. 0005's audit_insert_session admits a row from ANY jurah_app session, naming ANY actor.
-- So a patient session could write a row with actor_role = 'agent', or a dose_status_recorded row
-- naming 'system' (the check audit_dose_status_actor admits both actors). Either one forges the
-- audit log's proof that no dose status came from the interface. Only append() writes rows today
-- (guard 8), so no product path does this; after 0014 the database refuses it as well.
--
-- After. One RESTRICTIVE insert policy for jurah_app. Postgres ANDs it with the permissive
-- audit_insert_session (which still requires a session), so a row must pass both. For jurah_app:
--
--   type = 'dose_status_recorded'  refused from every jurah_app session, the system session
--                                  included. No jurah_app writer produces this row: its one writer
--                                  is the trigger doses_status_recorded_audit (after update of
--                                  status on doses, 0004), and jurah_app holds no UPDATE on
--                                  doses.status (0005 grants it update (scheduled_at, tracked)
--                                  only; the status grant is jurah_agent's alone). So under
--                                  jurah_app the trigger never fires, and a system session could
--                                  write this row only as a forgery: jurah.session is a setting
--                                  any role can set, so "the system session" is not proof of the
--                                  server.
--   actor_role = 'agent'           only from the system session (withSystem), and only for
--                                  prescription_discontinued. That is D-025: the discontinuation the
--                                  agent asks for is bearer-checked as the agent, executed as
--                                  system, and names the agent (lib/data/pg/agent.ts,
--                                  recomputeSchedule). No cookie can claim 'system':
--                                  lib/session/verify.ts admits only the four user roles.
--   anything else                  as before. A patient session still writes 'system' for
--                                  tracking_disabled on disconnect, a pending-only session still
--                                  writes 'caregiver' on decline and 'system' on sign-out, and the
--                                  system session still writes 'patient' or 'caregiver' for
--                                  messaging_connected.
--
-- jurah_agent keeps 0005's audit_agent_insert unchanged. The agent role is where rows naming the
-- agent come from: alert_raised, prescription_added, and the trigger's dose_status_recorded.
--
-- The trigger doses_status_recorded_audit is SECURITY INVOKER, so its row is checked as its
-- caller's. Its callers are jurah_agent (actor 'agent'), checked by audit_agent_insert alone, and
-- the owner (actor 'system'), which RLS does not bind (enabled, not forced, 0005). The seed also
-- writes its dose_status_recorded rows as the owner, by a direct insert. This policy admits no
-- dose_status_recorded row from jurah_app because no jurah_app writer produces one.
--
-- Why restrictive and not a replacement of audit_insert_session: a re-apply of 0005 drops and
-- recreates its own policies by name, and would silently restore the old rule. A separate
-- restrictive policy survives that re-apply.

drop policy if exists audit_insert_actor on audit_events;
create policy audit_insert_actor on audit_events as restrictive for insert to jurah_app with check (
  jurah_session() is not null
  and type <> 'dose_status_recorded'
  and (actor_role <> 'agent' or (jurah_session_is('system') and type = 'prescription_discontinued'))
);
