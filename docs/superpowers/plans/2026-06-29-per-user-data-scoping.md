# Per-User Data Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate Supabase data per user so each account sees and mutates only the rows it created.

**Architecture:** A single manually-applied SQL migration (`0003_per_user_scoping.sql`) wipes existing data, adds an `owner_id uuid` column (defaulting to `auth.uid()`) to all seven tables, drops the org-wide RLS policies from `0002`, and replaces them with per-user `owner_id = auth.uid()` policies. The DB column default supplies the owner on insert, so the React/TypeScript client needs no changes.

**Tech Stack:** Supabase (Postgres + RLS), PostgREST, React Query client (unchanged).

## Global Constraints

- Migrations are applied **manually** in the Supabase SQL editor, in filename order, after `0001_init.sql` and `0002_auth_rls.sql`. Do not add tooling to auto-apply them.
- The seven tables, in FK-dependency order: `brands`, `outlets`, `stores`, `staff`, `staff_history`, `follow_ups`, `follow_up_tasks`.
- Commit author email for this repo: `cch340@gmail.com`.
- `owner_id` is never surfaced in the domain model, mappers, or UI.
- No automated test covers RLS (Vitest runs in `node` over pure logic modules only); verification of this change is manual.

---

### Task 1: Write the `0003_per_user_scoping.sql` migration

**Files:**
- Create: `supabase/migrations/0003_per_user_scoping.sql`

**Interfaces:**
- Consumes: tables and the `"authenticated access"` policies created in `supabase/migrations/0001_init.sql` and `supabase/migrations/0002_auth_rls.sql`.
- Produces: an `owner_id uuid not null` column on all seven tables and a `"owner access"` RLS policy per table scoping rows to `owner_id = auth.uid()`. No client-visible interface.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/0003_per_user_scoping.sql` with exactly this content:

```sql
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
```

- [ ] **Step 2: Sanity-check the SQL statically**

There is no local Postgres to run against, so review by eye:
- Confirm all seven tables appear in each of the four sections (truncate, add column, drop policy, create policy) — 7 tables × (1 truncate entry + 3 statements) .
- Confirm every `add column` uses `default auth.uid()` and `not null`.
- Confirm every `create policy` has both `using` and `with check` set to `owner_id = auth.uid()`.

Expected: all four sections cover exactly the seven tables; no typos in table names.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_per_user_scoping.sql
git -c user.email=cch340@gmail.com commit -m "feat: per-user data scoping via owner_id + RLS

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Verify the client still builds and update docs

The client requires no functional change (inserts rely on the DB default; reads are RLS-filtered). This task confirms that nothing broke and documents the new migration.

**Files:**
- Modify: `CLAUDE.md` (the "Backend / migrations" paragraph)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

- [ ] **Step 1: Confirm no client code references org-wide sharing assumptions**

Run: `grep -rn "owner_id\|org-wide\|shared across" src/`
Expected: no matches in `src/` (owner_id is DB-only; the phrase lives only in docs/SQL). If a match appears in `src/`, stop and reassess — the design assumed zero client change.

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: PASS (no type errors; the client is unchanged so this should be green).

- [ ] **Step 3: Run the test suite**

Run: `npm test`
Expected: PASS — existing pure-logic tests are unaffected by the DB-level change.

- [ ] **Step 4: Update the migrations note in CLAUDE.md**

In `CLAUDE.md`, find the "Backend / migrations" paragraph that currently reads:

```
SQL migrations in `supabase/migrations/`, applied manually via the Supabase SQL editor (in order). `0001_init.sql` creates the schema with **permissive** RLS; `0002_auth_rls.sql` replaces those with authenticated-only policies. Data is org-wide shared across all signed-in users — there is no per-user row scoping.
```

Replace the last sentence so the paragraph ends:

```
SQL migrations in `supabase/migrations/`, applied manually via the Supabase SQL editor (in order). `0001_init.sql` creates the schema with **permissive** RLS; `0002_auth_rls.sql` replaces those with authenticated-only policies; `0003_per_user_scoping.sql` wipes existing data and adds per-user row scoping via an `owner_id` column (defaulting to `auth.uid()`) with RLS policies of `owner_id = auth.uid()` on every table. Each signed-in user sees and mutates only the rows it created.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git -c user.email=cch340@gmail.com commit -m "docs: note per-user scoping migration in CLAUDE.md

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Manual verification in Supabase (human-run)

This task is run by a human against the live Supabase project after applying the migration; it has no code deliverable. The implementing agent should present these steps and pause for the user to run them.

- [ ] **Step 1: Apply the migration**

In the Supabase SQL editor, run the full contents of `supabase/migrations/0003_per_user_scoping.sql`.
Expected: success; querying any table afterward returns 0 rows.

- [ ] **Step 2: Account A creates data**

Sign in to the app as account A. Create a brand, an outlet, a store (brand+outlet), a staff member, and a follow-up.
Expected: all created successfully and visible to A.

- [ ] **Step 3: Account B sees nothing**

Sign out, sign in as account B (a different account).
Expected: the dataset is empty — none of A's brands/outlets/staff/follow-ups appear.

- [ ] **Step 4: Account B's data is isolated**

As account B, create a brand and a staff member. Sign back in as A.
Expected: A sees only A's data; B's new rows do not appear for A.

- [ ] **Step 5: Confirm FK restrict still surfaces cleanly**

As account A, try to delete a brand that A's staff references.
Expected: the same clear FK-restrict error as before (unchanged behavior).

---

## Self-Review

**Spec coverage:**
- Wipe existing data → Task 1 Step 1 (`truncate ... cascade`). ✓
- `owner_id` on all seven tables with `default auth.uid()`, `not null`, `on delete cascade` → Task 1 Step 1. ✓
- Drop `0002` policies, add per-user `owner_id = auth.uid()` policies → Task 1 Step 1. ✓
- Uniform `owner_id` on children (not EXISTS-subquery scoping) → Task 1 Step 1 includes `stores`, `staff_history`, `follow_up_tasks`. ✓
- Near-zero client impact (inserts/reads/mappers unchanged) → Task 2 verifies build + tests + grep. ✓
- Manual verification (two accounts) → Task 3. ✓
- FK/delete safety unchanged → Task 3 Step 5. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; the full SQL and the exact CLAUDE.md text are inline. ✓

**Type consistency:** Policy name `"owner access"` and column `owner_id` used identically across all statements and tasks. ✓
