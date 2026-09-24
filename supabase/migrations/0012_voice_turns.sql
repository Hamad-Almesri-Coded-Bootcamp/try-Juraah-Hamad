-- 0012 · voice_turns — CR-069, the screen follows the voice (AI-agents track, 2026-09-23). Adds,
-- never edits 0001–0011. Idempotent: if-not-exists / drop-then-create only.
--
-- One row per turn the patient has with the Alexa skill, written by agent-alexa (role jurah_agent,
-- POST /api/agent/patients/{id}/voice-turns) AFTER Alexa has already answered. The patient's open
-- web app polls its own rows and follows: it shows the turn in the assistant panel and opens the
-- screen the topic belongs to. NOT clinical data and NOT a dose write: `topic` is one of a fixed
-- list, `reply` is the sentence Alexa just spoke (built from the patient's own read-only doses).
--
-- Who may do what:
--   read   — the PATIENT the row belongs to, and nobody else: not a caregiver, not a reviewer, not
--            the agent (it never reads a turn back). Stricter than can_read_patient on purpose: a
--            turn is the patient's own conversation.
--   insert — jurah_agent only, for a patient that exists (FK). No UPDATE, no DELETE for anyone.

create table if not exists voice_turns (
  id         text primary key,
  seq        bigint generated always as identity,
  patient_id text not null references patients(id) on delete cascade,
  topic      text not null check (topic in ('launch', 'next_dose', 'dose_amount', 'today', 'forgot', 'unclear', 'bye')),
  language   text not null check (language in ('ar', 'en')),
  reply      text not null check (char_length(reply) between 1 and 2000),
  created_at timestamptz not null default jurah_now()
);

-- The policy filters on patient_id; the poll reads "after seq N" for one patient.
create index if not exists voice_turns_patient_seq on voice_turns (patient_id, seq);

alter table voice_turns enable row level security;

revoke all on voice_turns from public, jurah_app, jurah_agent;
grant select on voice_turns to jurah_app;
grant insert (id, patient_id, topic, language, reply) on voice_turns to jurah_agent;

drop policy if exists voice_turns_patient_select on voice_turns;
create policy voice_turns_patient_select on voice_turns for select to jurah_app using (
  jurah_session_is('patient') and patient_id = (jurah_session()->>'subjectId'));

drop policy if exists voice_turns_agent_insert on voice_turns;
create policy voice_turns_agent_insert on voice_turns for insert to jurah_agent with check (
  jurah_session_is('agent'));
