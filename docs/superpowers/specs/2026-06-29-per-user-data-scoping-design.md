# Per-User Data Scoping (Row-Level Isolation)

**Date:** 2026-06-29
**Status:** Approved design

## Problem

Authentication exists (email/password + Google OAuth via Supabase Auth), but data
is **org-wide shared across all signed-in users** — there is no per-user row scoping.
Migration `0002_auth_rls.sql` grants every authenticated user full access to every
table (`using (true) with check (true)`). This makes auth pointless: anyone can
create an account and read/write all existing data.

## Goal

Each user sees and mutates **only the data they created**. Full isolation — no
sharing or collaboration between accounts.

## Decisions

- **Access model:** Per-user private. Each row is owned by its creator; users never
  see other users' rows.
- **Existing data:** Deleted as part of the migration. Clean slate for everyone.
- **Isolation model:** Row-level security (RLS) with an `owner_id` discriminator
  column — **not** schema-per-tenant or database-per-tenant.

### Why RLS, not separate schemas/databases

Schema-per-tenant and database-per-tenant suit B2B with a small number of large
tenants and carry heavy operational cost (DDL on every signup, every migration
applied to every schema). They are also impractical on Supabase for a per-user app:
PostgREST only serves a fixed list of exposed schemas configured at the project
level (can't route a logged-in user to "their" schema dynamically), and one Supabase
project = one database with the free tier capped at ~2 projects total. RLS is the
documented, idiomatic Supabase pattern for tenant isolation, enforced by Postgres on
every query, works on the free tier, and scales to many users.

## Approach

Implement isolation almost entirely at the database level via a single new manually-
applied migration. Because each table's `owner_id` defaults to `auth.uid()`, Postgres
fills the owner on insert and RLS filters reads — so the React/TypeScript client needs
no changes.

### Migration: `supabase/migrations/0003_per_user_scoping.sql`

Applied manually in the Supabase SQL editor, after `0001` and `0002`, in order
(consistent with the existing convention).

Steps:

1. **Wipe existing data** — `truncate brands, outlets, stores, staff, staff_history,
   follow_ups, follow_up_tasks cascade;` (the "delete it" choice; also makes adding a
   `not null` column trivial on now-empty tables).

2. **Add `owner_id` to every table** — on all seven tables
   (`brands`, `outlets`, `stores`, `staff`, `staff_history`, `follow_ups`,
   `follow_up_tasks`):

   ```sql
   add column owner_id uuid not null
     references auth.users(id) on delete cascade
     default auth.uid();
   ```

   `default auth.uid()` supplies the owner on insert (so the client need not pass it);
   `on delete cascade` removes a user's data if their auth account is deleted.

3. **Drop the `0002` org-wide policies** — `drop policy if exists "authenticated
   access" on <table>;` for each table.

4. **Create per-user policies** — on each table:

   ```sql
   create policy "owner access" on <table>
     for all to authenticated
     using (owner_id = auth.uid())
     with check (owner_id = auth.uid());
   ```

### Why `owner_id` on all seven tables (uniform)

The child tables (`stores`, `staff_history`, `follow_up_tasks`) could instead be
scoped indirectly through their parent via an `EXISTS (...)` subquery in the policy,
avoiding the extra column. We reject that: subquery checks run per row and the
policies get more complex. Since the same user creates parent and child anyway, a
uniform `owner_id` column with a default is simpler, faster, and consistent. Every
table carries its own `owner_id`.

## Client impact

Near zero:

- **Inserts** (`useBrandMutations.ts`, `useOutletMutations.ts`,
  `useStaffCrudMutations.ts`, `useStaffMutations.ts`, `useFollowUpMutations.ts`) do
  not send `owner_id`; the DB default supplies it. No code change.
- **Reads** (`useData.ts`) are filtered by RLS; queries unchanged.
- **Mappers / model** (`mappers.ts`, `model.ts`) are unchanged — `owner_id` is not
  surfaced in the UI.

## FK / delete safety

Foreign keys are unaffected. A user's `staff` / `stores` / `follow_ups` rows
reference brands and outlets that the same user owns, so existing `on delete restrict`
behavior is unchanged (e.g. a brand referenced by the user's staff still can't be
deleted, surfacing the same clear error).

## Testing & verification

- No automated test covers RLS: it is database-level, and the Vitest suite runs in the
  `node` environment over pure logic modules only (no DB). No new unit tests apply.
- **Manual verification** after applying the migration:
  1. Sign in as account A; create a brand, outlet, staff, follow-up.
  2. Sign in as account B; confirm the dataset is empty.
  3. As account B, create data; confirm A does not see it and B does not see A's.
  4. Confirm A still sees only its own data.

## Out of scope

- Sharing / collaboration between users.
- Per-user roles or admin views.
- Backfilling or preserving existing data (explicitly deleted).
