-- 0014_recurring_schedules.sql
-- Recurring visit schedules: "visit this store weekly/monthly" automation.
-- A schedule describes a store (brand + outlet), an optional assigned staff, a
-- frequency and a start date. Occurrences are NOT stored here — instead the
-- client materializes each due occurrence into a real `visits` row (plus its
-- `visit_tasks` from task_labels) when the app loads. `last_generated` records
-- the most recent occurrence date already materialized, so occurrences are never
-- duplicated: generation only ever creates occurrences strictly after it.
-- Per-user scoped (owner_id defaults to auth.uid()), matching every other table
-- after 0003_per_user_scoping.sql. Apply AFTER 0013_staff_phone.sql.

create table recurring_schedules (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references brands(id) on delete restrict,
  outlet_id      uuid not null references outlets(id) on delete restrict,
  staff_id       uuid references staff(id) on delete set null,
  frequency      text not null check (frequency in ('weekly','monthly')),
  start_date     date not null,
  task_labels    text[] not null default '{}',
  active         boolean not null default true,
  last_generated date,          -- last occurrence date materialized into visits
  created_at     timestamptz not null default now(),
  owner_id       uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table recurring_schedules enable row level security;
create policy "owner access" on recurring_schedules
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
