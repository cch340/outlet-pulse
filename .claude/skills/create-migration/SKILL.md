---
name: create-migration
description: Scaffold the next numbered Supabase SQL migration in supabase/migrations/ with correct sequencing and per-user (owner_id) RLS conventions. Use when adding a table, column, index, or policy to the database.
disable-model-invocation: true
---

# create-migration

Create the next migration file in `supabase/migrations/`. These are applied
**manually, in numeric order, via the Supabase SQL editor** — so the number and
ordering matter, and every table must carry per-user row scoping.

## Steps

1. **Find the next number.** List `supabase/migrations/`, take the highest
   `NNNN_` prefix, add 1, zero-pad to 4 digits. Filename: `NNNN_<snake_case>.sql`.
2. **Write the migration** using the conventions below.
3. **Do NOT apply it.** Print the path and remind the user to paste it into the
   Supabase SQL editor after the previous migrations. Applying happens manually.
4. **If the change alters what the app reads/writes** (new/changed column that
   becomes a domain field), remind the user that the app side needs the paired
   update: `model.ts` type, `mappers.ts`, the `useData` query, and `keys.ts`
   (see the `add-entity-field` knowledge skill / CLAUDE.md).

## Conventions (match existing migrations)

- **Top comment**: what it does, whether it's destructive, and the run order.
- **Per-user scoping**: every new table needs an `owner_id` column and an
  `owner access` RLS policy. Copy the pattern from `0003_per_user_scoping.sql`:

  ```sql
  alter table <t> add column owner_id uuid not null
    references auth.users(id) on delete cascade default auth.uid();

  alter table <t> enable row level security;

  create policy "owner access" on <t>
    for all to authenticated
    using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  ```

- **FK deletes**: entities referenced by staff/stores use `on delete restrict`
  (surfaces a clear error); child rows (`staff_history`, `follow_up_tasks`) use
  `on delete cascade`.
- **Idempotency**: prefer `create table if not exists`, `drop policy if exists`,
  `add column if not exists` so a re-paste is safe.
- Lower-case SQL keywords, matching the existing files.

## New-table template

```sql
-- <NNNN>_<name>.sql
-- <one-line purpose>. Run in the Supabase SQL editor after <NNNN-1>.

create table if not exists <table> (
  id uuid primary key default gen_random_uuid(),
  -- ... columns ...
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

alter table <table> enable row level security;

create policy "owner access" on <table>
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```

After writing, hand the file back to the user and consider a `migration-reviewer`
subagent pass before they apply it.
