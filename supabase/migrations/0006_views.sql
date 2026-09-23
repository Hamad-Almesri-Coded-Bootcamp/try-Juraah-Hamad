-- 0006 · views (docs/SCHEMA.md §1 push_subscriptions, §3 "What the admin role can reach"; CR-047).

-- push_subscriptions_view — the seam's projection of a PushSubscription: the three key columns
-- (endpoint, p256dh, auth) do not exist in it. security_invoker, so the table's RLS applies.
create or replace view push_subscriptions_view
with (security_invoker = true) as
  select id, subject_type, subject_id, status, permission, created_at
  from push_subscriptions;

-- audit_log_admin — the admin's ONE window (CR-047): every AuditEvent column plus the patient's
-- MASKED name, computed here where the admin session cannot reach patients.name. A security
-- definer view (owned by postgres, security_invoker off), so it reads audit_events and patients
-- past RLS — which is why it filters on the admin session itself: any other caller gets no row.
-- No Civil ID column, no clinical column.
create or replace view audit_log_admin
with (security_invoker = false) as
  select e.id, e.seq, e.scope, e.patient_id, e.actor_role, e.actor_id, e.type, e.message,
         e.created_at, e.related_id,
         case when p.name is not null then mask_name(p.name) end as patient_masked_name
  from audit_events e
  left join patients p on p.id = e.patient_id
  where jurah_session_is('admin');

revoke all on push_subscriptions_view, audit_log_admin from public, anon, authenticated, service_role;
grant select on push_subscriptions_view to jurah_app;
grant select on audit_log_admin to jurah_app;
