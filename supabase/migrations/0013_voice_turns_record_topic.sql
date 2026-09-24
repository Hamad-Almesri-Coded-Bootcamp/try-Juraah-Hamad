-- 0013 · voice_turns accepts the topic 'record' — CR-070 (AI-agents track, 2026-09-24). Adds, never
-- edits 0001–0012. Idempotent: drop-if-exists then add. Only the topic list changes: a voice turn in
-- which the patient named doses to record (read back, or confirmed) is shown on the Activity screen.
-- Who may read or write the table is unchanged (0012).

alter table voice_turns drop constraint if exists voice_turns_topic_check;
alter table voice_turns add constraint voice_turns_topic_check
  check (topic in ('launch', 'next_dose', 'dose_amount', 'today', 'forgot', 'record', 'unclear', 'bye'));
