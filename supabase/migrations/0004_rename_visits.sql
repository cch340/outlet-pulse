-- 0004_rename_visits.sql
-- Rename the "follow-up" domain to "visits".
-- A table rename carries its rows, owner_id column, "owner access" RLS policy,
-- indexes, and FK constraints with it, so nothing needs re-creating.
-- Apply AFTER 0003_per_user_scoping.sql in the Supabase SQL editor.

alter table follow_ups       rename to visits;
alter table follow_up_tasks  rename to visit_tasks;
alter table visit_tasks      rename column follow_up_id to visit_id;
