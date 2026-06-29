-- 0005_task_templates.sql
-- Reusable visit-task templates shown in the schedule modal. Per-user scoped
-- (owner_id defaults to auth.uid()), matching every other table after
-- 0003_per_user_scoping.sql. Starts empty (no seed rows).
-- Apply AFTER 0004_rename_visits.sql in the Supabase SQL editor.

create table task_templates (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  sort       int  not null default 0,
  created_at timestamptz not null default now(),
  owner_id   uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table task_templates enable row level security;
create policy "owner access" on task_templates
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
