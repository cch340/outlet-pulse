-- 0016_task_photos.sql
-- Photo evidence attached to checklist tasks.
-- Photos live in the PRIVATE storage bucket 'task-photos' at the path
--   <owner_id>/<task_id>/<uuid>.jpg
-- Storage RLS scopes objects per-user by the first path segment (the uid), so a
-- user can only read/write objects under their own <uid>/ prefix. Each object is
-- mirrored by a task_photos row that records its path.
--
-- IMPORTANT: task_photos rows CASCADE when their visit_task (and hence visit) is
-- deleted, but Postgres cannot delete storage objects. The client is therefore
-- responsible for removing the underlying storage objects before deleting a task
-- or visit (see useTaskPhotos / useVisitMutations). Orphaned storage objects are
-- an acceptable worst case; blocked deletes are not.
-- Per-user scoped (owner_id defaults to auth.uid()), matching every other table
-- after 0003_per_user_scoping.sql. Apply AFTER 0015_recurring_lead_days.sql.

-- Private bucket for task photos.
insert into storage.buckets (id, name, public) values ('task-photos', 'task-photos', false);

-- Storage RLS: authenticated users may read/write/delete only objects stored
-- under their own uid prefix (foldername[1] = auth.uid()).
create policy "task-photos select own"
  on storage.objects for select to authenticated
  using (bucket_id = 'task-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "task-photos insert own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'task-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "task-photos delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'task-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Row per stored photo, mirroring the storage object at `path`.
create table task_photos (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references visit_tasks(id) on delete cascade,
  path       text not null,
  created_at timestamptz not null default now(),
  owner_id   uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table task_photos enable row level security;
create policy "owner access" on task_photos
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
