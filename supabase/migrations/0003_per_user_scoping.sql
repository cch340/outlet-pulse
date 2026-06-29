-- Per-user data scoping. Replaces the org-wide "authenticated access" policies
-- from 0002 with per-user row isolation via an owner_id column.
--
-- DESTRUCTIVE: wipes all existing rows (chosen clean-slate behavior).
-- Run AFTER 0001_init.sql and 0002_auth_rls.sql, in the Supabase SQL editor.

-- 1. Wipe existing data. cascade clears child tables (staff_history,
--    follow_up_tasks) too; makes adding a NOT NULL column trivial.
truncate brands, outlets, stores, staff, staff_history, follow_ups, follow_up_tasks cascade;

-- 2. Add owner_id to every table. default auth.uid() fills the owner on insert
--    (so the client need not pass it); on delete cascade removes a user's data
--    if their auth account is deleted.
alter table brands          add column owner_id uuid not null references auth.users(id) on delete cascade default auth.uid();
alter table outlets         add column owner_id uuid not null references auth.users(id) on delete cascade default auth.uid();
alter table stores          add column owner_id uuid not null references auth.users(id) on delete cascade default auth.uid();
alter table staff           add column owner_id uuid not null references auth.users(id) on delete cascade default auth.uid();
alter table staff_history   add column owner_id uuid not null references auth.users(id) on delete cascade default auth.uid();
alter table follow_ups      add column owner_id uuid not null references auth.users(id) on delete cascade default auth.uid();
alter table follow_up_tasks add column owner_id uuid not null references auth.users(id) on delete cascade default auth.uid();

-- 3. Drop the org-wide policies from 0002.
drop policy if exists "authenticated access" on brands;
drop policy if exists "authenticated access" on outlets;
drop policy if exists "authenticated access" on stores;
drop policy if exists "authenticated access" on staff;
drop policy if exists "authenticated access" on staff_history;
drop policy if exists "authenticated access" on follow_ups;
drop policy if exists "authenticated access" on follow_up_tasks;

-- 4. Per-user policies: a user can only see/mutate rows it owns.
create policy "owner access" on brands          for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner access" on outlets         for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner access" on stores          for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner access" on staff           for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner access" on staff_history   for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner access" on follow_ups      for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner access" on follow_up_tasks for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
