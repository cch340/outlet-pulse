# Supabase Backend & Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory `useState` store with a persistent Supabase Postgres backend, accessed directly from React via TanStack Query, and add full CRUD UI for brands, outlets, and staff.

**Architecture:** The React app talks directly to Supabase (`@supabase/supabase-js`) — no separate backend server. TanStack Query owns all server state (caching, loading/error, invalidation). The existing context store (`src/data/store.tsx`) shrinks to client-only UI state (navigation, filters, theme, form drafts). Domain collections move to query hooks aggregated by a single `useData()` hook that returns a `DataSnapshot` matching the old collection field names, so `derived.ts` and screens change minimally.

**Tech Stack:** React 18, Vite, TypeScript, `@supabase/supabase-js` v2, `@tanstack/react-query` v5, Vitest (pure-logic tests).

## Global Constraints

- Package manager: npm (a `package-lock.json` exists). Use `npm install`, `npm run`.
- Module type is ESM (`"type": "module"`); all new files use ESM imports.
- DB column convention: `snake_case`. TS model convention: `camelCase`. All translation happens in `src/data/queries/mappers.ts` — query hooks and components only ever see camelCase model types from `src/data/model.ts`.
- Primary keys are Postgres-generated UUIDs (`gen_random_uuid()`). The app never invents ids for new rows.
- No auth in this project. RLS is left permissive (`allow all`) with comments marking where per-user policies attach later.
- Secrets live in `.env.local` (gitignored). Vite exposes only `VITE_`-prefixed vars to the client.
- Follow existing styling: inline `CSSProperties`, theme CSS vars (`var(--accent)`, etc.), helpers from `src/theme.ts`. Do not add a CSS framework.

## Testing Strategy

- **Pure logic** (row mappers, the transfer history-stamp helper) is developed test-first with Vitest. These are the highest-risk, highest-value units.
- **Query/mutation hooks and UI wiring** are verified by `npm run build` (typecheck) plus a manual run against a real Supabase project. Unit-testing modal chrome against a mocked Supabase client adds little value at this scale; do not invest there.
- Every task ends with `npm run build` passing (TypeScript has zero errors) as a baseline gate, plus its own specific check.

---

## Phase 1 — Schema & Project Setup

### Task 1: Database schema migration, env scaffolding, and Supabase client

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `.env.example`
- Create: `src/lib/supabase.ts`
- Create: `src/vite-env.d.ts`
- Modify: `.gitignore` (already ignores `.env.local`; verify)

**Interfaces:**
- Produces: `supabase` client export from `src/lib/supabase.ts` typed as `SupabaseClient`. Used by every query/mutation hook in later tasks.

- [ ] **Step 1: Write the SQL migration**

Create `supabase/migrations/0001_init.sql`:

```sql
-- Staff Monitor schema. No auth yet: RLS is permissive.
-- When auth lands, replace each "allow all" policy with per-user policies
-- (e.g. using auth.uid() and an owner/membership column).

create extension if not exists "pgcrypto";

create table brands (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  color     text not null,
  category  text not null
);

create table outlets (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  location  text not null
);

create table stores (
  brand_id  uuid not null references brands(id) on delete restrict,
  outlet_id uuid not null references outlets(id) on delete restrict,
  primary key (brand_id, outlet_id)
);

create table staff (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  brand_id  uuid not null references brands(id) on delete restrict,
  outlet_id uuid not null references outlets(id) on delete restrict,
  role      text not null,
  joined    date not null
);

create table staff_history (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references staff(id) on delete cascade,
  brand_id   uuid not null references brands(id) on delete restrict,
  outlet_id  uuid not null references outlets(id) on delete restrict,
  from_label text not null,
  to_label   text,
  reason     text,
  created_at timestamptz not null default now()
);

create table follow_ups (
  id        uuid primary key default gen_random_uuid(),
  date      date not null,
  staff_id  uuid references staff(id) on delete set null,
  brand_id  uuid not null references brands(id) on delete restrict,
  outlet_id uuid not null references outlets(id) on delete restrict,
  status    text not null default 'pending' check (status in ('done','pending'))
);

create table follow_up_tasks (
  id           uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references follow_ups(id) on delete cascade,
  label        text not null,
  done         boolean not null default false,
  sort         int not null default 0
);

-- Permissive RLS for the no-auth phase. REPLACE before any real launch.
alter table brands           enable row level security;
alter table outlets          enable row level security;
alter table stores           enable row level security;
alter table staff            enable row level security;
alter table staff_history    enable row level security;
alter table follow_ups       enable row level security;
alter table follow_up_tasks  enable row level security;

create policy "allow all" on brands          for all using (true) with check (true);
create policy "allow all" on outlets         for all using (true) with check (true);
create policy "allow all" on stores          for all using (true) with check (true);
create policy "allow all" on staff           for all using (true) with check (true);
create policy "allow all" on staff_history   for all using (true) with check (true);
create policy "allow all" on follow_ups      for all using (true) with check (true);
create policy "allow all" on follow_up_tasks for all using (true) with check (true);
```

- [ ] **Step 2: Write `.env.example`**

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 3: Write Vite env typings**

Create `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 4: Install the Supabase client and write `src/lib/supabase.ts`**

Run: `npm install @supabase/supabase-js`

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient(url, anonKey)
```

- [ ] **Step 5: Manual setup (the user performs these; document in commit body)**

1. Create a free project at supabase.com.
2. Open SQL Editor, paste `supabase/migrations/0001_init.sql`, run it.
3. Copy Project URL + anon key (Settings → API) into `.env.local`.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: PASS (zero TypeScript errors). The `supabase.ts` import resolves; env typings present.

- [ ] **Step 7: Commit**

```bash
git add supabase/ .env.example src/lib/supabase.ts src/vite-env.d.ts package.json package-lock.json
git commit -m "feat: add Supabase schema migration and client"
```

---

## Phase 2 — Data Layer

### Task 2: Install TanStack Query + Vitest, add QueryClientProvider

**Files:**
- Modify: `package.json` (deps + test script)
- Create: `vitest.config.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: a `QueryClient` available to the whole tree; `npm test` runs Vitest.

- [ ] **Step 1: Install dependencies**

Run: `npm install @tanstack/react-query`
Run: `npm install -D vitest`

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Wrap the app in QueryClientProvider**

Rewrite `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { App } from './App'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/main.tsx
git commit -m "chore: add TanStack Query provider and Vitest"
```

---

### Task 3: Row mappers (DB rows ↔ model types) — TDD

**Files:**
- Create: `src/data/queries/mappers.ts`
- Test: `src/data/queries/mappers.test.ts`
- Modify: `src/data/model.ts` (add optional `id` to `Task`)

**Interfaces:**
- Consumes: model types `Brand`, `Outlet`, `Store`, `Staff`, `FollowUp`, `Task`, `HistoryEntry` from `src/data/model.ts`.
- Produces:
  - `rowToStaff(row: StaffRow): Staff` where `StaffRow = { id, name, brand_id, outlet_id, role, joined, staff_history: StaffHistoryRow[] }`
  - `rowToFollowUp(row: FollowUpRow): FollowUp` where `FollowUpRow = { id, date, staff_id, brand_id, outlet_id, status, follow_up_tasks: TaskRow[] }`
  - `rowToStore(row: { brand_id: string; outlet_id: string }): Store`
  - Types `StaffRow`, `StaffHistoryRow`, `FollowUpRow`, `TaskRow` exported for hooks.

- [ ] **Step 1: Add `id` to the Task type**

In `src/data/model.ts`, change the `Task` interface:

```ts
export interface Task {
  id?: string // present once persisted; absent for default checklist templates
  label: string
  done: boolean
}
```

- [ ] **Step 2: Write the failing test**

Create `src/data/queries/mappers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rowToStaff, rowToFollowUp, rowToStore } from './mappers'

describe('rowToStore', () => {
  it('maps snake_case to camelCase', () => {
    expect(rowToStore({ brand_id: 'b', outlet_id: 'o' })).toEqual({ brandId: 'b', outletId: 'o' })
  })
})

describe('rowToStaff', () => {
  it('maps fields and orders history by created_at', () => {
    const staff = rowToStaff({
      id: 's1',
      name: 'John',
      brand_id: 'b1',
      outlet_id: 'o1',
      role: 'Supervisor',
      joined: '2023-03-01',
      staff_history: [
        { id: 'h2', staff_id: 's1', brand_id: 'b1', outlet_id: 'o2', from_label: 'Feb 2025', to_label: null, reason: null, created_at: '2025-02-01T00:00:00Z' },
        { id: 'h1', staff_id: 's1', brand_id: 'b1', outlet_id: 'o1', from_label: 'Mar 2023', to_label: 'Feb 2025', reason: 'x', created_at: '2023-03-01T00:00:00Z' },
      ],
    })
    expect(staff.id).toBe('s1')
    expect(staff.brandId).toBe('b1')
    expect(staff.history.map((h) => h.from)).toEqual(['Mar 2023', 'Feb 2025'])
    expect(staff.history[0].to).toBe('Feb 2025')
    expect(staff.history[1].to).toBeUndefined()
  })
})

describe('rowToFollowUp', () => {
  it('maps fields and orders tasks by sort', () => {
    const fu = rowToFollowUp({
      id: 'f1',
      date: '2026-06-25',
      staff_id: null,
      brand_id: 'b1',
      outlet_id: 'o1',
      status: 'pending',
      follow_up_tasks: [
        { id: 't2', follow_up_id: 'f1', label: 'B', done: true, sort: 1 },
        { id: 't1', follow_up_id: 'f1', label: 'A', done: false, sort: 0 },
      ],
    })
    expect(fu.staffId).toBeNull()
    expect(fu.tasks.map((t) => t.label)).toEqual(['A', 'B'])
    expect(fu.tasks[0].id).toBe('t1')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL ("Cannot find module './mappers'" or undefined functions).

- [ ] **Step 4: Write `src/data/queries/mappers.ts`**

```ts
import type { FollowUp, HistoryEntry, Staff, Store, Task } from '../model'

export interface StaffHistoryRow {
  id: string
  staff_id: string
  brand_id: string
  outlet_id: string
  from_label: string
  to_label: string | null
  reason: string | null
  created_at: string
}

export interface StaffRow {
  id: string
  name: string
  brand_id: string
  outlet_id: string
  role: string
  joined: string
  staff_history: StaffHistoryRow[]
}

export interface TaskRow {
  id: string
  follow_up_id: string
  label: string
  done: boolean
  sort: number
}

export interface FollowUpRow {
  id: string
  date: string
  staff_id: string | null
  brand_id: string
  outlet_id: string
  status: 'done' | 'pending'
  follow_up_tasks: TaskRow[]
}

export const rowToStore = (r: { brand_id: string; outlet_id: string }): Store => ({
  brandId: r.brand_id,
  outletId: r.outlet_id,
})

const rowToHistory = (r: StaffHistoryRow): HistoryEntry => ({
  brandId: r.brand_id,
  outletId: r.outlet_id,
  from: r.from_label,
  to: r.to_label ?? undefined,
  reason: r.reason ?? undefined,
})

export const rowToStaff = (r: StaffRow): Staff => ({
  id: r.id,
  name: r.name,
  brandId: r.brand_id,
  outletId: r.outlet_id,
  role: r.role,
  joined: r.joined,
  history: [...r.staff_history]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(rowToHistory),
})

const rowToTask = (r: TaskRow): Task => ({ id: r.id, label: r.label, done: r.done })

export const rowToFollowUp = (r: FollowUpRow): FollowUp => ({
  id: r.id,
  date: r.date,
  staffId: r.staff_id,
  brandId: r.brand_id,
  outletId: r.outlet_id,
  status: r.status,
  tasks: [...r.follow_up_tasks].sort((a, b) => a.sort - b.sort).map(rowToTask),
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all 4 tests).

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data/model.ts src/data/queries/mappers.ts src/data/queries/mappers.test.ts
git commit -m "feat: add DB row to model mappers with tests"
```

---

### Task 4: Transfer history-stamp helper — TDD

The transfer flow must (a) stamp the staff's currently-open history entry with a `to` label and (b) produce a new open entry. Extract this pure logic so it is testable independently of Supabase.

**Files:**
- Create: `src/data/queries/transferLogic.ts`
- Test: `src/data/queries/transferLogic.test.ts`

**Interfaces:**
- Produces:
  - `monthYear(iso: string): string` — formats an ISO date as e.g. `"Jul 2026"`.
  - `planTransfer(input: { historyIdsToClose: { id: string }[]; toLabel: string }): { closeIds: string[]; toLabel: string }` — given the open history rows, returns the ids to stamp closed and the label to stamp them with. (Kept small and pure; the hook in Task 7 fetches open rows and applies the result.)

- [ ] **Step 1: Write the failing test**

Create `src/data/queries/transferLogic.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { monthYear, planTransfer } from './transferLogic'

describe('monthYear', () => {
  it('formats ISO date as "Mon YYYY"', () => {
    expect(monthYear('2026-07-01')).toBe('Jul 2026')
  })
})

describe('planTransfer', () => {
  it('returns ids to close and the stamp label', () => {
    const out = planTransfer({ historyIdsToClose: [{ id: 'h1' }, { id: 'h2' }], toLabel: 'Jul 2026' })
    expect(out.closeIds).toEqual(['h1', 'h2'])
    expect(out.toLabel).toBe('Jul 2026')
  })

  it('handles no open rows', () => {
    expect(planTransfer({ historyIdsToClose: [], toLabel: 'Jul 2026' }).closeIds).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL ("Cannot find module './transferLogic'").

- [ ] **Step 3: Write `src/data/queries/transferLogic.ts`**

```ts
export const monthYear = (iso: string): string =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

export const planTransfer = (input: {
  historyIdsToClose: { id: string }[]
  toLabel: string
}): { closeIds: string[]; toLabel: string } => ({
  closeIds: input.historyIdsToClose.map((h) => h.id),
  toLabel: input.toLabel,
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/queries/transferLogic.ts src/data/queries/transferLogic.test.ts
git commit -m "feat: add transfer history-stamp helper with tests"
```

---

### Task 5: Read query hooks + useData aggregate

**Files:**
- Create: `src/data/queries/keys.ts`
- Create: `src/data/queries/useData.ts`

**Interfaces:**
- Consumes: `supabase` (Task 1), mappers (Task 3), model types.
- Produces:
  - `queryKeys` object: `{ brands: ['brands'], outlets: ['outlets'], stores: ['stores'], staff: ['staff'], followups: ['followups'] }`.
  - `DataSnapshot` type: `{ brands: Brand[]; outlets: Outlet[]; stores: Store[]; staff: Staff[]; followups: FollowUp[] }` (field names match the old `AppState` collections).
  - `useData(): { data: DataSnapshot; isLoading: boolean; isError: boolean }`.

- [ ] **Step 1: Write the query keys**

Create `src/data/queries/keys.ts`:

```ts
export const queryKeys = {
  brands: ['brands'] as const,
  outlets: ['outlets'] as const,
  stores: ['stores'] as const,
  staff: ['staff'] as const,
  followups: ['followups'] as const,
}
```

- [ ] **Step 2: Write the aggregate hook**

Create `src/data/queries/useData.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Brand, FollowUp, Outlet, Staff, Store } from '../model'
import { rowToFollowUp, rowToStaff, rowToStore } from './mappers'
import { queryKeys } from './keys'

export interface DataSnapshot {
  brands: Brand[]
  outlets: Outlet[]
  stores: Store[]
  staff: Staff[]
  followups: FollowUp[]
}

async function fetchBrands(): Promise<Brand[]> {
  const { data, error } = await supabase.from('brands').select('*').order('name')
  if (error) throw error
  return data as Brand[]
}

async function fetchOutlets(): Promise<Outlet[]> {
  const { data, error } = await supabase.from('outlets').select('*').order('name')
  if (error) throw error
  return data as Outlet[]
}

async function fetchStores(): Promise<Store[]> {
  const { data, error } = await supabase.from('stores').select('brand_id, outlet_id')
  if (error) throw error
  return data.map(rowToStore)
}

async function fetchStaff(): Promise<Staff[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('*, staff_history(*)')
    .order('name')
  if (error) throw error
  return data.map(rowToStaff)
}

async function fetchFollowups(): Promise<FollowUp[]> {
  const { data, error } = await supabase
    .from('follow_ups')
    .select('*, follow_up_tasks(*)')
    .order('date')
  if (error) throw error
  return data.map(rowToFollowUp)
}

export function useData(): { data: DataSnapshot; isLoading: boolean; isError: boolean } {
  const brands = useQuery({ queryKey: queryKeys.brands, queryFn: fetchBrands })
  const outlets = useQuery({ queryKey: queryKeys.outlets, queryFn: fetchOutlets })
  const stores = useQuery({ queryKey: queryKeys.stores, queryFn: fetchStores })
  const staff = useQuery({ queryKey: queryKeys.staff, queryFn: fetchStaff })
  const followups = useQuery({ queryKey: queryKeys.followups, queryFn: fetchFollowups })

  const queries = [brands, outlets, stores, staff, followups]
  return {
    data: {
      brands: brands.data ?? [],
      outlets: outlets.data ?? [],
      stores: stores.data ?? [],
      staff: staff.data ?? [],
      followups: followups.data ?? [],
    },
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/queries/keys.ts src/data/queries/useData.ts
git commit -m "feat: add read query hooks and useData aggregate"
```

---

### Task 6: Refactor derived.ts to DataSnapshot + rewire read path in screens

`derived.ts` functions currently take `AppState` but only read its collections. Re-type them to take `DataSnapshot`. Then each screen/component reads collections from `useData()` and UI state from `useStore()`.

**Files:**
- Modify: `src/data/derived.ts`
- Modify: `src/App.tsx` (loading gate)
- Modify: `src/screens/Dashboard.tsx`, `src/screens/Brands.tsx`, `src/screens/Outlets.tsx`, `src/screens/Staff.tsx`, `src/screens/Followups.tsx`
- Modify: `src/components/TransferModal.tsx`, `src/components/ScheduleModal.tsx`, `src/components/FollowUpDrawer.tsx`

**Interfaces:**
- Consumes: `useData` / `DataSnapshot` (Task 5).
- Produces: `derived.ts` functions keyed off `DataSnapshot` instead of `AppState`.

- [ ] **Step 1: Re-type derived.ts**

In `src/data/derived.ts`, change the import and every `s: AppState` parameter to `s: DataSnapshot`. Replace line 1:

```ts
import type { DataSnapshot } from './queries/useData'
```

Then update signatures (bodies unchanged — they only touch collection fields):

```ts
export const brandById = (s: DataSnapshot, id: string): Brand => s.brands.find((b) => b.id === id)!
export const outletById = (s: DataSnapshot, id: string): Outlet => s.outlets.find((o) => o.id === id)!
export const staffById = (s: DataSnapshot, id: string): Staff => s.staff.find((x) => x.id === id)!
// ...
export const linked = (s: DataSnapshot, bId: string, oId: string) =>
  s.stores.some((st) => st.brandId === bId && st.outletId === oId)

export const staffCount = (s: DataSnapshot, bId: string | null, oId: string | null) =>
  s.staff.filter((x) => (!bId || x.brandId === bId) && (!oId || x.outletId === oId)).length

export function fuVM(s: DataSnapshot, f: FollowUp): FollowUpVM { /* unchanged body */ }
```

Remove the now-unused `import type { AppState } from './store'`. Keep the `Brand, FollowUp, Outlet, Staff` import from `./model`.

- [ ] **Step 2: Add a loading gate in App.tsx**

In `src/App.tsx`, inside `Shell`, after `const isMobile = ...`, gate on data load so screens never render against half-loaded collections:

```tsx
import { useData } from './data/queries/useData'
// ...
function Shell() {
  const { state } = useStore()
  const { isLoading, isError } = useData()
  const isMobile = state.isMobile

  if (isLoading) return <div style={{ padding: 40 }}>Loading…</div>
  if (isError) return <div style={{ padding: 40 }}>Failed to load data. Check your Supabase connection.</div>
  // ...rest unchanged
```

(`useData` is cached by TanStack Query, so calling it here and in screens hits the same cache — no duplicate fetches.)

- [ ] **Step 3: Rewire each screen to read collections from useData**

In every screen and component that currently does `const { state } = useStore(); const S = state` **and reads collections** (`S.brands`, `S.outlets`, `S.stores`, `S.staff`, `S.followups`) or passes `S` to a `derived.ts` function: introduce `const { data } = useData()` and pass `data` to derived functions / read collections from `data`. Keep `useStore()` for UI state (filters, selection, overlays).

Example — `src/components/TransferModal.tsx` (lines 28–37 region):

```tsx
import { useData } from '../data/queries/useData'
// ...
export function TransferModal() {
  const { state, closeTransfer, setTf, confirmTransfer } = useStore()
  const { data } = useData()
  const S = state
  if (!S.transferStaffId || !S.transferForm) return null

  const st = data.staff.find((x) => x.id === S.transferStaffId)!
  const tf = S.transferForm
  const curB = brandById(data, st.brandId)
  const curO = outletById(data, st.outletId)
  const nb = brandById(data, tf.brandId)
  const no = outletById(data, tf.outletId)
  // ...JSX: replace S.brands.map -> data.brands.map, S.outlets.map -> data.outlets.map
```

Apply the same substitution pattern in `ScheduleModal.tsx` (`S.stores` → `data.stores`, `brandById(S,…)` → `brandById(data,…)`), `FollowUpDrawer.tsx` (`S.followups.find` → `data.followups.find`, `fuVM(S, openF)` → `fuVM(data, openF)`), and each screen (`Dashboard`, `Brands`, `Outlets`, `Staff`, `Followups`) wherever collections or derived calls appear. Leave `confirmTransfer` / `confirmAdd` / `toggleTask` etc. as store calls for now — they are replaced in Task 7.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS. (TypeScript will flag any screen still passing `state`/`S` to a `DataSnapshot` parameter — fix each until zero errors. This is the checklist for full coverage of Step 3.)

- [ ] **Step 5: Manual check**

Run: `npm run dev`. With an empty DB, the app loads (no crash), screens render empty lists, dashboard shows zero counts. With a couple of rows added via the Supabase dashboard, they appear.

- [ ] **Step 6: Commit**

```bash
git add src/data/derived.ts src/App.tsx src/screens src/components
git commit -m "refactor: read domain data from useData instead of store"
```

---

### Task 7: Mutation hooks for existing write flows + rewire modals/drawer

**Files:**
- Create: `src/data/queries/useFollowUpMutations.ts`
- Create: `src/data/queries/useStaffMutations.ts`
- Modify: `src/components/TransferModal.tsx`, `src/components/ScheduleModal.tsx`, `src/components/FollowUpDrawer.tsx`

**Interfaces:**
- Consumes: `supabase`, `queryKeys`, `monthYear`/`planTransfer` (Task 4), `DEFAULT_TASKS`.
- Produces:
  - `useTransferStaff()` → mutation taking `{ staffId, brandId, outletId, reason, date }`.
  - `useCreateFollowUp()` → mutation taking `{ brandId, outletId, staffId, date, taskLabels: string[] }`.
  - `useToggleTask()` → mutation taking `{ taskId, done }`.
  - `useMarkFollowUpDone()` → mutation taking `{ followUpId }`.
  - `useToggleFollowUpStatus()` → mutation taking `{ followUpId, status }`.

- [ ] **Step 1: Write follow-up mutations**

Create `src/data/queries/useFollowUpMutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'

export function useCreateFollowUp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      brandId: string
      outletId: string
      staffId: string | null
      date: string
      taskLabels: string[]
    }) => {
      const { data: fu, error } = await supabase
        .from('follow_ups')
        .insert({
          brand_id: input.brandId,
          outlet_id: input.outletId,
          staff_id: input.staffId,
          date: input.date,
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw error
      if (input.taskLabels.length) {
        const rows = input.taskLabels.map((label, i) => ({
          follow_up_id: fu.id,
          label,
          done: false,
          sort: i,
        }))
        const { error: tErr } = await supabase.from('follow_up_tasks').insert(rows)
        if (tErr) throw tErr
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.followups }),
  })
}

export function useToggleTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; done: boolean }) => {
      const { error } = await supabase
        .from('follow_up_tasks')
        .update({ done: input.done })
        .eq('id', input.taskId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.followups }),
  })
}

export function useMarkFollowUpDone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { followUpId: string }) => {
      const { error } = await supabase
        .from('follow_up_tasks')
        .update({ done: true })
        .eq('follow_up_id', input.followUpId)
      if (error) throw error
      const { error: fErr } = await supabase
        .from('follow_ups')
        .update({ status: 'done' })
        .eq('id', input.followUpId)
      if (fErr) throw fErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.followups }),
  })
}

export function useToggleFollowUpStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { followUpId: string; status: 'done' | 'pending' }) => {
      const next = input.status === 'done' ? 'pending' : 'done'
      const { error } = await supabase
        .from('follow_ups')
        .update({ status: next })
        .eq('id', input.followUpId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.followups }),
  })
}
```

- [ ] **Step 2: Write staff transfer mutation**

Create `src/data/queries/useStaffMutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import { monthYear, planTransfer } from './transferLogic'

export function useTransferStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      staffId: string
      brandId: string
      outletId: string
      reason: string
      date: string
    }) => {
      const stamp = monthYear(input.date)

      // Close any currently-open history rows (to_label is null).
      const { data: open, error: openErr } = await supabase
        .from('staff_history')
        .select('id')
        .eq('staff_id', input.staffId)
        .is('to_label', null)
      if (openErr) throw openErr

      const { closeIds, toLabel } = planTransfer({ historyIdsToClose: open ?? [], toLabel: stamp })
      if (closeIds.length) {
        const { error: closeErr } = await supabase
          .from('staff_history')
          .update({ to_label: toLabel })
          .in('id', closeIds)
        if (closeErr) throw closeErr
      }

      // Move the staff member.
      const { error: moveErr } = await supabase
        .from('staff')
        .update({ brand_id: input.brandId, outlet_id: input.outletId })
        .eq('id', input.staffId)
      if (moveErr) throw moveErr

      // Open a new history row.
      const { error: insErr } = await supabase.from('staff_history').insert({
        staff_id: input.staffId,
        brand_id: input.brandId,
        outlet_id: input.outletId,
        from_label: stamp,
        reason: input.reason || null,
      })
      if (insErr) throw insErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staff }),
  })
}
```

- [ ] **Step 3: Rewire TransferModal**

In `src/components/TransferModal.tsx`, replace the `confirmTransfer` store call. Remove `confirmTransfer` from the `useStore()` destructure and add:

```tsx
import { useTransferStaff } from '../data/queries/useStaffMutations'
// ...
const transfer = useTransferStaff()
// ...
// onClick handler for the Confirm button:
onClick={() => {
  transfer.mutate(
    { staffId: S.transferStaffId!, brandId: tf.brandId, outletId: tf.outletId, reason: tf.reason, date: tf.date },
    { onSuccess: () => closeTransfer() },
  )
}}
```

- [ ] **Step 4: Rewire ScheduleModal**

In `src/components/ScheduleModal.tsx`, replace `confirmAdd`. The form holds `tasks: boolean[]` aligned to `DEFAULT_TASKS`; convert to selected labels:

```tsx
import { useCreateFollowUp } from '../data/queries/useFollowUpMutations'
import { DEFAULT_TASKS } from '../data/model'
// ...
const create = useCreateFollowUp()
// ...
// onClick handler for Schedule button:
onClick={() => {
  const [sb, so] = af.storeKey.split('|')
  const taskLabels = DEFAULT_TASKS.filter((_, i) => af.tasks[i])
  create.mutate(
    { brandId: sb, outletId: so, staffId: af.staffId || null, date: af.date, taskLabels },
    { onSuccess: () => closeAdd() },
  )
}}
```

- [ ] **Step 5: Rewire FollowUpDrawer**

In `src/components/FollowUpDrawer.tsx`, replace `toggleTask`, `markDone`, `toggleStatus` store calls:

```tsx
import { useToggleTask, useMarkFollowUpDone, useToggleFollowUpStatus } from '../data/queries/useFollowUpMutations'
// ...
const toggleTask = useToggleTask()
const markDone = useMarkFollowUpDone()
const toggleStatus = useToggleFollowUpStatus()
// ...
// checklist item onClick (note: task now carries an id from the DB):
onClick={() => toggleTask.mutate({ taskId: t.id!, done: !t.done })}
// Mark complete button:
onClick={() => markDone.mutate({ followUpId: openF.id })}
// Reopen button:
onClick={() => toggleStatus.mutate({ followUpId: openF.id, status: openF.status })}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Manual check**

Run `npm run dev`. With a brand+outlet+staff seeded via the dashboard: transfer a staff member (history grows, staff list reflects new brand/outlet after refetch); schedule a follow-up (appears in list); toggle tasks and mark complete (status updates). Reload the page — all changes persisted.

- [ ] **Step 8: Commit**

```bash
git add src/data/queries src/components
git commit -m "feat: persist transfer and follow-up writes to Supabase"
```

---

### Task 8: Shrink store.tsx to UI-only state

Remove the domain collections and server-write actions from the store. Keep navigation, filters, theme, and form-draft state.

**Files:**
- Modify: `src/data/store.tsx`
- Delete: `src/data/seed.ts`

**Interfaces:**
- Produces: a trimmed `AppState` with **no** `brands/outlets/stores/staff/followups`; trimmed `StoreActions` with no `confirmTransfer/confirmAdd/toggleTask/markDone/toggleStatus`.

- [ ] **Step 1: Remove collections from AppState**

In `src/data/store.tsx`, delete the `brands/outlets/stores/staff/followups` fields from `AppState` and remove the seed import. The `seed()` initializer drops those fields. `openTransfer` currently reads `s.staff.find(...)` to prefill the form — change it to accept the staff's current brand/outlet from the caller:

```ts
openTransfer(staffId: string, brandId: string, outletId: string): void
```

and its implementation:

```ts
openTransfer: (id, brandId, outletId) =>
  patch({
    transferStaffId: id,
    transferForm: { brandId, outletId, reason: '', date: todayISO() },
  }),
```

Update the call site in `src/screens/Staff.tsx` (the `openTransfer(r.id)` buttons) to pass the row's brand/outlet: `openTransfer(r.id, r.brandId, r.outletId)`.

- [ ] **Step 2: Remove server-write actions**

Delete `confirmTransfer`, `confirmAdd`, `toggleTask`, `markDone`, `toggleStatus` from both the `StoreActions` interface and the `actions` object. Keep `openTransfer/closeTransfer/setTf`, `openAdd/closeAdd/setAf/toggleAfTask`, `openFu/closeFu`, all filters, and theme actions. Keep the `monthYear` import removal if now unused.

- [ ] **Step 3: Delete the seed file**

Run: `git rm src/data/seed.ts`

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS. (TypeScript flags any remaining reference to a removed field/action — fix each. This is the completeness checklist.)

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS (mapper + transfer-logic tests unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/data/store.tsx src/screens/Staff.tsx
git commit -m "refactor: reduce store to client-only UI state"
```

---

## Phase 3 — CRUD UI

### Task 9: Brand CRUD (mutations + modal + screen wiring + store links)

**Files:**
- Create: `src/data/queries/useBrandMutations.ts`
- Create: `src/components/EntityModal.tsx` (reusable modal shell)
- Create: `src/components/BrandModal.tsx`
- Modify: `src/screens/Brands.tsx`
- Modify: `src/data/store.tsx` (add brand-modal overlay state)

**Interfaces:**
- Produces:
  - `useCreateBrand()`, `useUpdateBrand()`, `useDeleteBrand()` mutations.
  - `useSetBrandStores()` mutation taking `{ brandId, outletIds }` that replaces the brand's `stores` rows.
  - `EntityModal` component: props `{ title: string; onClose: () => void; onSubmit: () => void; submitLabel: string; isMobile: boolean; children: ReactNode }`.

- [ ] **Step 1: Write brand mutations**

Create `src/data/queries/useBrandMutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'

export function useCreateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; color: string; category: string }) => {
      const { error } = await supabase.from('brands').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.brands }),
  })
}

export function useUpdateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; color: string; category: string }) => {
      const { id, ...fields } = input
      const { error } = await supabase.from('brands').update(fields).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.brands }),
  })
}

export function useDeleteBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('brands').delete().eq('id', id)
      if (error) throw error // FK restrict surfaces a clear message if staff/stores reference it
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brands })
      qc.invalidateQueries({ queryKey: queryKeys.stores })
    },
  })
}

export function useSetBrandStores() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { brandId: string; outletIds: string[] }) => {
      const { error: delErr } = await supabase.from('stores').delete().eq('brand_id', input.brandId)
      if (delErr) throw delErr
      if (input.outletIds.length) {
        const rows = input.outletIds.map((outlet_id) => ({ brand_id: input.brandId, outlet_id }))
        const { error: insErr } = await supabase.from('stores').insert(rows)
        if (insErr) throw insErr
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.stores }),
  })
}
```

- [ ] **Step 2: Write the reusable EntityModal shell**

Create `src/components/EntityModal.tsx` (chrome extracted from TransferModal's overlay):

```tsx
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'

const btnBase: CSSProperties = {
  borderRadius: 9,
  padding: '10px 18px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
}

export function EntityModal({
  title,
  onClose,
  onSubmit,
  submitLabel,
  isMobile,
  children,
}: {
  title: string
  onClose: () => void
  onSubmit: () => void
  submitLabel: string
  isMobile: boolean
  children: ReactNode
}) {
  const ovPos = isMobile ? 'absolute' : 'fixed'
  return (
    <div
      onClick={onClose}
      style={{ position: ovPos, inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 500, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', background: 'var(--surface)', borderRadius: 14, boxShadow: '0 30px 80px rgba(0,0,0,.3)', animation: 'pop .18s ease' }}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <Icon name="close" size={22} />
          </button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>{children}</div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnBase, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
            Cancel
          </button>
          <button onClick={onSubmit} style={{ ...btnBase, border: 'none', background: 'var(--accent)', color: '#fff' }}>
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export const modalFieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: 'var(--dim)',
  marginBottom: 9,
}

export const modalInput: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  borderRadius: 8,
  padding: '10px 12px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 13,
  color: 'var(--text)',
}
```

- [ ] **Step 3: Add brand-modal overlay state to the store**

In `src/data/store.tsx`, add to `AppState`:

```ts
brandModal: { mode: 'add' } | { mode: 'edit'; id: string } | null
```

initialize to `null` in `seed()`, and add actions:

```ts
openBrandModal(payload: { mode: 'add' } | { mode: 'edit'; id: string }): void
closeBrandModal(): void
```

```ts
openBrandModal: (brandModal) => patch({ brandModal }),
closeBrandModal: () => patch({ brandModal: null }),
```

- [ ] **Step 4: Write BrandModal**

Create `src/components/BrandModal.tsx`:

```tsx
import { useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useCreateBrand, useUpdateBrand, useSetBrandStores } from '../data/queries/useBrandMutations'
import { EntityModal, modalFieldLabel, modalInput } from './EntityModal'
import { chip } from '../theme'

export function BrandModal() {
  const { state, closeBrandModal } = useStore()
  const { data } = useData()
  const m = state.brandModal
  const existing = m?.mode === 'edit' ? data.brands.find((b) => b.id === m.id) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState(existing?.color ?? '#0ea5e9')
  const [category, setCategory] = useState(existing?.category ?? '')
  const [outletIds, setOutletIds] = useState<string[]>(
    existing ? data.stores.filter((s) => s.brandId === existing.id).map((s) => s.outletId) : [],
  )

  const create = useCreateBrand()
  const update = useUpdateBrand()
  const setStores = useSetBrandStores()
  if (!m) return null

  const toggleOutlet = (id: string) =>
    setOutletIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const submit = () => {
    if (!name.trim()) return
    if (m.mode === 'add') {
      create.mutate(
        { name: name.trim(), color, category: category.trim() },
        { onSuccess: () => closeBrandModal() },
      )
    } else {
      update.mutate({ id: m.id, name: name.trim(), color, category: category.trim() })
      setStores.mutate({ brandId: m.id, outletIds }, { onSuccess: () => closeBrandModal() })
    }
  }

  return (
    <EntityModal
      title={m.mode === 'add' ? 'Add brand' : 'Edit brand'}
      onClose={closeBrandModal}
      onSubmit={submit}
      submitLabel={m.mode === 'add' ? 'Create' : 'Save'}
      isMobile={state.isMobile}
    >
      <div>
        <div style={modalFieldLabel}>Name</div>
        <input value={name} onChange={(e) => setName(e.target.value)} style={modalInput} />
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={modalFieldLabel}>Category</div>
          <input value={category} onChange={(e) => setCategory(e.target.value)} style={modalInput} />
        </div>
        <div>
          <div style={modalFieldLabel}>Color</div>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ ...modalInput, padding: 4, width: 60 }} />
        </div>
      </div>
      {m.mode === 'edit' && (
        <div>
          <div style={modalFieldLabel}>Operates in outlets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.outlets.map((o) => (
              <button key={o.id} onClick={() => toggleOutlet(o.id)} style={chip(outletIds.includes(o.id))}>
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </EntityModal>
  )
}
```

- [ ] **Step 5: Wire Brands screen + mount modal**

In `src/screens/Brands.tsx`: add an **Add brand** button (calling `openBrandModal({ mode: 'add' })`) and per-card **Edit** (`openBrandModal({ mode: 'edit', id: b.id })`) / **Delete** (`useDeleteBrand`) actions. On delete error, alert the FK message:

```tsx
import { useDeleteBrand } from '../data/queries/useBrandMutations'
// ...
const del = useDeleteBrand()
// Delete button onClick:
onClick={() => {
  if (confirm('Delete this brand?')) {
    del.mutate(b.id, {
      onError: () => alert('Cannot delete: this brand still has staff or store links.'),
    })
  }
}}
```

Mount the modal in `src/App.tsx` alongside the others: `<BrandModal />`.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Manual check**

Run `npm run dev`. Add a brand → appears in list and is usable as a transfer/follow-up target. Edit it, toggle outlet links → follow-up "Store" chips reflect the links. Delete an unreferenced brand → removed; delete a referenced one → friendly error.

- [ ] **Step 8: Commit**

```bash
git add src/data/queries/useBrandMutations.ts src/components/EntityModal.tsx src/components/BrandModal.tsx src/screens/Brands.tsx src/data/store.tsx src/App.tsx
git commit -m "feat: add brand CRUD UI"
```

---

### Task 10: Outlet CRUD

**Files:**
- Create: `src/data/queries/useOutletMutations.ts`
- Create: `src/components/OutletModal.tsx`
- Modify: `src/screens/Outlets.tsx`, `src/data/store.tsx`, `src/App.tsx`

**Interfaces:**
- Produces: `useCreateOutlet()`, `useUpdateOutlet()`, `useDeleteOutlet()`.

- [ ] **Step 1: Write outlet mutations**

Create `src/data/queries/useOutletMutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'

export function useCreateOutlet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; location: string }) => {
      const { error } = await supabase.from('outlets').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.outlets }),
  })
}

export function useUpdateOutlet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; location: string }) => {
      const { id, ...fields } = input
      const { error } = await supabase.from('outlets').update(fields).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.outlets }),
  })
}

export function useDeleteOutlet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('outlets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.outlets })
      qc.invalidateQueries({ queryKey: queryKeys.stores })
    },
  })
}
```

- [ ] **Step 2: Add outlet-modal state to store**

In `src/data/store.tsx`, add `outletModal: { mode: 'add' } | { mode: 'edit'; id: string } | null` (init `null`) plus `openOutletModal` / `closeOutletModal` actions, mirroring the brand-modal pattern from Task 9 Step 3.

- [ ] **Step 3: Write OutletModal**

Create `src/components/OutletModal.tsx`:

```tsx
import { useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useCreateOutlet, useUpdateOutlet } from '../data/queries/useOutletMutations'
import { EntityModal, modalFieldLabel, modalInput } from './EntityModal'

export function OutletModal() {
  const { state, closeOutletModal } = useStore()
  const { data } = useData()
  const m = state.outletModal
  const existing = m?.mode === 'edit' ? data.outlets.find((o) => o.id === m.id) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [location, setLocation] = useState(existing?.location ?? '')

  const create = useCreateOutlet()
  const update = useUpdateOutlet()
  if (!m) return null

  const submit = () => {
    if (!name.trim()) return
    if (m.mode === 'add') {
      create.mutate({ name: name.trim(), location: location.trim() }, { onSuccess: () => closeOutletModal() })
    } else {
      update.mutate({ id: m.id, name: name.trim(), location: location.trim() }, { onSuccess: () => closeOutletModal() })
    }
  }

  return (
    <EntityModal
      title={m.mode === 'add' ? 'Add outlet' : 'Edit outlet'}
      onClose={closeOutletModal}
      onSubmit={submit}
      submitLabel={m.mode === 'add' ? 'Create' : 'Save'}
      isMobile={state.isMobile}
    >
      <div>
        <div style={modalFieldLabel}>Name</div>
        <input value={name} onChange={(e) => setName(e.target.value)} style={modalInput} />
      </div>
      <div>
        <div style={modalFieldLabel}>Location</div>
        <input value={location} onChange={(e) => setLocation(e.target.value)} style={modalInput} />
      </div>
    </EntityModal>
  )
}
```

- [ ] **Step 4: Wire Outlets screen + mount modal**

In `src/screens/Outlets.tsx`: add an **Add outlet** button (`openOutletModal({ mode: 'add' })`) and per-card **Edit** (`openOutletModal({ mode: 'edit', id: o.id })`) / **Delete** actions:

```tsx
import { useDeleteOutlet } from '../data/queries/useOutletMutations'
// ...
const del = useDeleteOutlet()
onClick={() => {
  if (confirm('Delete this outlet?')) {
    del.mutate(o.id, { onError: () => alert('Cannot delete: this outlet still has staff or store links.') })
  }
}}
```

Mount `<OutletModal />` in `src/App.tsx`.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Manual check**

Run `npm run dev`. Add/edit/delete an outlet; verify it appears in transfer and brand-link choices; deleting a referenced outlet shows the friendly error.

- [ ] **Step 7: Commit**

```bash
git add src/data/queries/useOutletMutations.ts src/components/OutletModal.tsx src/screens/Outlets.tsx src/data/store.tsx src/App.tsx
git commit -m "feat: add outlet CRUD UI"
```

---

### Task 11: Staff CRUD

**Files:**
- Create: `src/data/queries/useStaffCrudMutations.ts`
- Create: `src/components/StaffModal.tsx`
- Modify: `src/screens/Staff.tsx`, `src/data/store.tsx`, `src/App.tsx`

**Interfaces:**
- Produces: `useCreateStaff()`, `useUpdateStaff()`, `useDeleteStaff()`. Creating staff also opens the first `staff_history` row.

- [ ] **Step 1: Write staff CRUD mutations**

Create `src/data/queries/useStaffCrudMutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import { monthYear } from './transferLogic'

export function useCreateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      brandId: string
      outletId: string
      role: string
      joined: string
    }) => {
      const { data: st, error } = await supabase
        .from('staff')
        .insert({
          name: input.name,
          brand_id: input.brandId,
          outlet_id: input.outletId,
          role: input.role,
          joined: input.joined,
        })
        .select('id')
        .single()
      if (error) throw error
      const { error: hErr } = await supabase.from('staff_history').insert({
        staff_id: st.id,
        brand_id: input.brandId,
        outlet_id: input.outletId,
        from_label: monthYear(input.joined),
      })
      if (hErr) throw hErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staff }),
  })
}

export function useUpdateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; role: string; joined: string }) => {
      const { error } = await supabase
        .from('staff')
        .update({ name: input.name, role: input.role, joined: input.joined })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staff }),
  })
}

export function useDeleteStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff').delete().eq('id', id)
      if (error) throw error // staff_history cascades; follow_ups.staff_id set null
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff })
      qc.invalidateQueries({ queryKey: queryKeys.followups })
    },
  })
}
```

Note: editing a staff member's brand/outlet is intentionally **not** part of update — that is what the existing Transfer flow is for (it maintains history). Edit covers name/role/joined only.

- [ ] **Step 2: Add staff-modal state to store**

In `src/data/store.tsx`, add `staffModal: { mode: 'add' } | { mode: 'edit'; id: string } | null` (init `null`) plus `openStaffModal` / `closeStaffModal`, mirroring Task 9 Step 3.

- [ ] **Step 3: Write StaffModal**

Create `src/components/StaffModal.tsx`:

```tsx
import { useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useCreateStaff, useUpdateStaff } from '../data/queries/useStaffCrudMutations'
import { EntityModal, modalFieldLabel, modalInput } from './EntityModal'
import { chip } from '../theme'

export function StaffModal() {
  const { state, closeStaffModal } = useStore()
  const { data } = useData()
  const m = state.staffModal
  const existing = m?.mode === 'edit' ? data.staff.find((s) => s.id === m.id) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [role, setRole] = useState(existing?.role ?? '')
  const [joined, setJoined] = useState(existing?.joined ?? '')
  const [brandId, setBrandId] = useState(existing?.brandId ?? data.brands[0]?.id ?? '')
  const [outletId, setOutletId] = useState(existing?.outletId ?? data.outlets[0]?.id ?? '')

  const create = useCreateStaff()
  const update = useUpdateStaff()
  if (!m) return null

  const submit = () => {
    if (!name.trim() || !joined) return
    if (m.mode === 'add') {
      if (!brandId || !outletId) return
      create.mutate(
        { name: name.trim(), role: role.trim(), joined, brandId, outletId },
        { onSuccess: () => closeStaffModal() },
      )
    } else {
      update.mutate(
        { id: m.id, name: name.trim(), role: role.trim(), joined },
        { onSuccess: () => closeStaffModal() },
      )
    }
  }

  return (
    <EntityModal
      title={m.mode === 'add' ? 'Add staff' : 'Edit staff'}
      onClose={closeStaffModal}
      onSubmit={submit}
      submitLabel={m.mode === 'add' ? 'Create' : 'Save'}
      isMobile={state.isMobile}
    >
      <div>
        <div style={modalFieldLabel}>Name</div>
        <input value={name} onChange={(e) => setName(e.target.value)} style={modalInput} />
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={modalFieldLabel}>Role</div>
          <input value={role} onChange={(e) => setRole(e.target.value)} style={modalInput} />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={modalFieldLabel}>Joined</div>
          <input type="date" value={joined} onChange={(e) => setJoined(e.target.value)} style={modalInput} />
        </div>
      </div>
      {m.mode === 'add' && (
        <>
          <div>
            <div style={modalFieldLabel}>Brand</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.brands.map((b) => (
                <button key={b.id} onClick={() => setBrandId(b.id)} style={chip(brandId === b.id)}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: b.color }} />
                  {b.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={modalFieldLabel}>Outlet</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.outlets.map((o) => (
                <button key={o.id} onClick={() => setOutletId(o.id)} style={chip(outletId === o.id)}>
                  {o.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </EntityModal>
  )
}
```

- [ ] **Step 4: Wire Staff screen + mount modal**

In `src/screens/Staff.tsx`: add an **Add staff** button (`openStaffModal({ mode: 'add' })`) and per-row **Edit** (`openStaffModal({ mode: 'edit', id: r.id })`) / **Delete** actions, beside the existing Transfer button:

```tsx
import { useDeleteStaff } from '../data/queries/useStaffCrudMutations'
// ...
const del = useDeleteStaff()
onClick={() => {
  if (confirm('Delete this staff member?')) del.mutate(r.id)
}}
```

Mount `<StaffModal />` in `src/App.tsx`.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Manual end-to-end check**

Run `npm run dev` against an empty DB: add a brand, an outlet, link them (brand edit), add a staff member (history row auto-created), schedule a follow-up, toggle tasks/mark done, transfer the staff member (history grows), edit and delete entities. Reload — everything persists.

- [ ] **Step 8: Commit**

```bash
git add src/data/queries/useStaffCrudMutations.ts src/components/StaffModal.tsx src/screens/Staff.tsx src/data/store.tsx src/App.tsx
git commit -m "feat: add staff CRUD UI"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Schema (Task 1) ✓; direct-to-Supabase client (Task 1) ✓; TanStack Query (Tasks 2,5) ✓; existing write flows migrated (Task 7) ✓; store reduced to UI state (Task 8) ✓; full CRUD for brands/outlets/staff (Tasks 9–11) ✓; UUID PKs + child tables (Task 1) ✓; delete guards (Tasks 9–11 via FK restrict + UI confirm/alert) ✓; RLS permissive with comment (Task 1) ✓.
- **Store-link management** (the `stores` join) was not in the spec's CRUD list but is required for follow-up scheduling to work; folded into brand edit (Task 9) and flagged here as a deliberate, in-scope addition.
- **Type consistency:** `DataSnapshot` field names match old `AppState` collections so `derived.ts` bodies are unchanged. `Task.id` added in Task 3 is consumed by `useToggleTask` in Task 7. Mutation input shapes are defined where produced and matched at call sites.
