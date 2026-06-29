-- Auth hardening: replace the no-auth permissive policies with
-- authenticated-only access. Data stays shared across all signed-in users
-- (no per-user scoping) — brands/outlets/staff are org-wide.
--
-- After running this, the anon key can no longer read or write any table;
-- a valid Supabase Auth session (authenticated role) is required.
-- Run AFTER 0001_init.sql, in the Supabase SQL editor.

-- Drop the permissive no-auth policies.
drop policy if exists "allow all" on brands;
drop policy if exists "allow all" on outlets;
drop policy if exists "allow all" on stores;
drop policy if exists "allow all" on staff;
drop policy if exists "allow all" on staff_history;
drop policy if exists "allow all" on follow_ups;
drop policy if exists "allow all" on follow_up_tasks;

-- Authenticated users get full access; anon (and the public role) get none.
create policy "authenticated access" on brands          for all to authenticated using (true) with check (true);
create policy "authenticated access" on outlets         for all to authenticated using (true) with check (true);
create policy "authenticated access" on stores          for all to authenticated using (true) with check (true);
create policy "authenticated access" on staff           for all to authenticated using (true) with check (true);
create policy "authenticated access" on staff_history   for all to authenticated using (true) with check (true);
create policy "authenticated access" on follow_ups      for all to authenticated using (true) with check (true);
create policy "authenticated access" on follow_up_tasks for all to authenticated using (true) with check (true);
