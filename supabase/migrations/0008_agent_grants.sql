-- 0008_agent_grants — P2-WP7 (D-026): jurah_agent keeps only the columns the six agent routes (and
-- WP6's agent-role target reads) need. Never edits 0001–0007.
--
-- Before: 0005 granted jurah_agent full SELECT on `patients` and `caregivers` (p2-wp1 §3.25), so an
-- agent statement could read any patient's or invitee's Civil ID. After:
--   patients   — SELECT (id) only: the alert-recipients / alert 404 check. No civil_id, name,
--                telegram_chat_id or phone.
--   caregivers — SELECT (id, seq, linked_patient_id, status) only: the ACTIVE-caregiver recipient
--                rule (E-07) and WP6's `pushTarget`/`chatTarget`/`activeCaregivers`. No civil_id,
--                name, phone or telegram_chat_id.
--   accounts   — nothing (0005 already grants jurah_agent nothing; re-asserted here).
-- Every other jurah_agent grant is unchanged (doses: SELECT, INSERT, UPDATE (status, recorded_at,
-- source) and no DELETE — D-025; prescriptions: SELECT, INSERT, UPDATE (status, discontinued_*);
-- interaction_alerts: SELECT, INSERT; settings, messaging_links, push_subscriptions, refill_requests,
-- audit_events: as 0005).
--
-- Idempotent: a revoke then a column grant, repeated, changes nothing. ORDER: 0005's blanket
-- `revoke all … grant` runs before this file; re-applying 0005 on its own would restore the wide
-- grants, so a re-apply always runs 0005 → 0006 → 0007 → 0008 → 0009 in order.

revoke select on patients from jurah_agent;
revoke select (civil_id, name, telegram_chat_id, telegram_linked_at, phone, language, onboarding_completed) on patients from jurah_agent;
grant select (id) on patients to jurah_agent;

revoke select on caregivers from jurah_agent;
revoke select (civil_id, name, relationship, phone, telegram_chat_id, invited_at, expires_at, accepted_at, declined_at,
               revoked_at, access_level) on caregivers from jurah_agent;
grant select (id, seq, linked_patient_id, status) on caregivers to jurah_agent;

revoke all on accounts from jurah_agent;
