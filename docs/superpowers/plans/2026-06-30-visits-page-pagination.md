# Visits Page Server-Side Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Visits screen to server-side pagination with a date-range filter, an expandable read-only checklist per visit (expand-all toggle), and a "latest visit per store" toggle.

**Architecture:** A new Postgres `security_invoker` view computes each visit's status and task counts; two RPCs (`visits_page`, `visit_status_counts`) do the filtering/distinct/pagination/counting in SQL. New React Query hooks call those RPCs (hydrating page rows with the existing `rowToVisit` mapper). The Visits screen reads from these hooks instead of the global `useData().visits`. Pure logic (date-range presets, id re-ordering, count folding, page math) is extracted into a tested module.

**Tech Stack:** React 18, TypeScript, Vite, Supabase (PostgREST + RPC), @tanstack/react-query v5, Vitest (node env, `src/**/*.test.ts`).

## Global Constraints

- All styling is inline `style={}` objects driven by CSS variables (`src/theme.ts`); no CSS framework.
- Build fails on unused locals/params (`noUnusedLocals`/`noUnusedParameters`) — remove every import/var you stop using.
- DB rows (snake_case) → domain (camelCase) only through mappers in `src/data/queries/mappers.ts`.
- Non-trivial pure logic goes in a `.ts` module with a co-located `.test.ts` (node env).
- Visit mutations already invalidate `['visits']`; keep new query keys nested under `['visits']` so that invalidation cascades — do NOT change the mutations.
- Migrations are plain SQL files in `supabase/migrations/`, applied manually in the Supabase SQL editor; functions/views must stay `SECURITY INVOKER` so `owner_id = auth.uid()` RLS is preserved.
- Commit message trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Database migration (view + RPCs)

**Files:**
- Create: `supabase/migrations/0007_visit_pagination.sql`

**Interfaces:**
- Produces (consumed by Task 3 hooks):
  - `visits_page(p_today date, p_from date, p_to date, p_status text, p_latest boolean, p_search text, p_limit int, p_offset int)` → `table(id uuid, total_count bigint)`
  - `visit_status_counts(p_today date, p_from date, p_to date, p_latest boolean, p_search text)` → `table(status text, n bigint)`

This task ships SQL applied manually in the Supabase SQL editor; there is no automated test (consistent with how every migration in this repo is verified). Verification is manual via the SQL editor.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0007_visit_pagination.sql`:

```sql
-- 0007_visit_pagination.sql
-- Server-side pagination + filtering for the Visits screen.
-- A security_invoker view computes per-visit status & task counts; two RPCs
-- do date-range / status / search / latest-per-store filtering, distinct,
-- counting and pagination in SQL. security_invoker (the default for functions)
-- keeps the existing owner_id = auth.uid() RLS in force.
-- Apply AFTER 0006_task_status_remark.sql in the Supabase SQL editor.

-- One row per visit, with derived base status, task counts, and joined names
-- for search. base_status is the three-way status; "overdue" is derived in the
-- RPCs from the caller's p_today (so it matches the browser's local "today").
create or replace view visit_with_status
with (security_invoker = true) as
select
  v.id,
  v.date,
  v.staff_id,
  v.brand_id,
  v.outlet_id,
  v.owner_id,
  b.name as brand_name,
  o.name as outlet_name,
  s.name as staff_name,
  count(t.id) as total,
  count(t.id) filter (where t.status = 'success') as success_t,
  count(t.id) filter (where t.status = 'failed')  as failed_t,
  count(t.id) filter (where t.status = 'pending') as pending_t,
  case
    when count(t.id) = 0 then 'pending'
    when count(t.id) filter (where t.status = 'pending') > 0 then 'pending'
    when count(t.id) filter (where t.status = 'failed') > 0 then 'attention'
    else 'done'
  end as base_status
from visits v
join brands  b on b.id = v.brand_id
join outlets o on o.id = v.outlet_id
left join staff s on s.id = v.staff_id
left join visit_tasks t on t.visit_id = v.id
group by v.id, v.date, v.staff_id, v.brand_id, v.outlet_id, v.owner_id,
         b.name, o.name, s.name;

grant select on visit_with_status to authenticated;

-- Page of visit ids (in display order) + the full filtered count.
create or replace function visits_page(
  p_today  date,
  p_from   date,
  p_to     date,
  p_status text,
  p_latest boolean,
  p_search text,
  p_limit  int,
  p_offset int
) returns table (id uuid, total_count bigint)
language sql stable as $$
  with ranged as (
    select w.*
    from visit_with_status w
    where (p_from is null or w.date >= p_from)
      and (p_to   is null or w.date <= p_to)
      and (
        coalesce(p_search, '') = ''
        or w.brand_name  ilike '%' || p_search || '%'
        or w.outlet_name ilike '%' || p_search || '%'
        or coalesce(w.staff_name, '') ilike '%' || p_search || '%'
      )
  ),
  scoped as (
    select x.*
    from (
      select r.*,
        case when p_latest
          then row_number() over (
                 partition by r.brand_id, r.outlet_id
                 order by r.date desc, r.id desc)
          else 1
        end as rn
      from ranged r
    ) x
    where x.rn = 1
  ),
  statused as (
    select s.id, s.date,
      case
        when s.base_status = 'pending' and s.date < p_today then 'overdue'
        else s.base_status
      end as status
    from scoped s
  ),
  filtered as (
    select * from statused
    where p_status = 'all' or status = p_status
  )
  select f.id, count(*) over () as total_count
  from filtered f
  order by f.date desc, f.id desc
  limit p_limit offset p_offset;
$$;

grant execute on function visits_page(date, date, date, text, boolean, text, int, int) to authenticated;

-- The five status-chip counts for the current date-range / latest / search
-- context (no status filter, no pagination).
create or replace function visit_status_counts(
  p_today  date,
  p_from   date,
  p_to     date,
  p_latest boolean,
  p_search text
) returns table (status text, n bigint)
language sql stable as $$
  with ranged as (
    select w.*
    from visit_with_status w
    where (p_from is null or w.date >= p_from)
      and (p_to   is null or w.date <= p_to)
      and (
        coalesce(p_search, '') = ''
        or w.brand_name  ilike '%' || p_search || '%'
        or w.outlet_name ilike '%' || p_search || '%'
        or coalesce(w.staff_name, '') ilike '%' || p_search || '%'
      )
  ),
  scoped as (
    select x.*
    from (
      select r.*,
        case when p_latest
          then row_number() over (
                 partition by r.brand_id, r.outlet_id
                 order by r.date desc, r.id desc)
          else 1
        end as rn
      from ranged r
    ) x
    where x.rn = 1
  ),
  statused as (
    select
      case
        when s.base_status = 'pending' and s.date < p_today then 'overdue'
        else s.base_status
      end as status
    from scoped s
  )
  select status, count(*) as n
  from statused
  group by status;
$$;

grant execute on function visit_status_counts(date, date, date, boolean, text) to authenticated;
```

- [ ] **Step 2: Verify the build still type-checks (no app code changed yet)**

Run: `npm run build`
Expected: PASS (SQL file is not compiled; this just confirms nothing else broke).

- [ ] **Step 3: Apply & verify in Supabase SQL editor (manual)**

Paste the migration into the Supabase SQL editor and run it. Then, signed in as a normal user, verify:
- `select * from visit_with_status limit 5;` returns only your rows with a `base_status` column.
- `select * from visits_page(current_date, null, null, 'all', false, '', 25, 0);` returns up to 25 `(id, total_count)` rows, `total_count` equal to your total visit count.
- `select * from visit_status_counts(current_date, null, null, false, '');` returns one row per present status.
- With `p_latest := true`, the row count never exceeds the number of distinct `(brand_id, outlet_id)` stores in range.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0007_visit_pagination.sql
git commit -m "feat(db): visit_with_status view + visits_page/visit_status_counts RPCs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Pure query helpers (date range, id order, count fold, page math)

**Files:**
- Create: `src/data/queries/visitsQuery.ts`
- Test: `src/data/queries/visitsQuery.test.ts`

**Interfaces:**
- Produces (consumed by Task 3 & Task 5):
  - `type DatePreset = 'all' | 'month' | 'last30' | 'last90' | 'year' | 'custom'`
  - `resolveDateRange(preset: DatePreset, customFrom: string, customTo: string, today: string): { from: string | null; to: string | null }`
  - `orderByIds<T extends { id: string }>(items: T[], ids: string[]): T[]`
  - `foldStatusCounts(rows: { status: string; n: number }[]): { all: number; pending: number; attention: number; overdue: number; done: number }`
  - `pageCount(total: number, pageSize: number): number`

- [ ] **Step 1: Write the failing tests**

Create `src/data/queries/visitsQuery.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveDateRange, orderByIds, foldStatusCounts, pageCount } from './visitsQuery'

describe('resolveDateRange', () => {
  const today = '2026-06-30'
  it('all → open range', () => {
    expect(resolveDateRange('all', '', '', today)).toEqual({ from: null, to: null })
  })
  it('month → first..last day of current month', () => {
    expect(resolveDateRange('month', '', '', today)).toEqual({ from: '2026-06-01', to: '2026-06-30' })
  })
  it('year → Jan 1..Dec 31', () => {
    expect(resolveDateRange('year', '', '', today)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })
  it('last30 → today-29..today inclusive', () => {
    expect(resolveDateRange('last30', '', '', today)).toEqual({ from: '2026-06-01', to: '2026-06-30' })
  })
  it('last90 → today-89..today inclusive', () => {
    expect(resolveDateRange('last90', '', '', today)).toEqual({ from: '2026-04-02', to: '2026-06-30' })
  })
  it('custom → passes through, empty sides become null', () => {
    expect(resolveDateRange('custom', '2026-01-15', '2026-02-20', today)).toEqual({ from: '2026-01-15', to: '2026-02-20' })
    expect(resolveDateRange('custom', '', '', today)).toEqual({ from: null, to: null })
  })
})

describe('orderByIds', () => {
  it('reorders items to match the id sequence', () => {
    const items = [{ id: 'b' }, { id: 'a' }, { id: 'c' }]
    expect(orderByIds(items, ['a', 'b', 'c']).map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
  it('drops ids with no matching item', () => {
    const items = [{ id: 'a' }]
    expect(orderByIds(items, ['a', 'missing']).map((x) => x.id)).toEqual(['a'])
  })
})

describe('foldStatusCounts', () => {
  it('fills missing statuses with 0 and sums into all', () => {
    expect(foldStatusCounts([{ status: 'pending', n: 2 }, { status: 'done', n: 3 }])).toEqual({
      all: 5, pending: 2, attention: 0, overdue: 0, done: 3,
    })
  })
  it('ignores unknown statuses', () => {
    expect(foldStatusCounts([{ status: 'weird', n: 9 }])).toEqual({
      all: 0, pending: 0, attention: 0, overdue: 0, done: 0,
    })
  })
})

describe('pageCount', () => {
  it('is at least 1 even when empty', () => {
    expect(pageCount(0, 25)).toBe(1)
  })
  it('rounds up', () => {
    expect(pageCount(26, 25)).toBe(2)
    expect(pageCount(50, 25)).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/queries/visitsQuery.test.ts`
Expected: FAIL — cannot find module `./visitsQuery`.

- [ ] **Step 3: Write the implementation**

Create `src/data/queries/visitsQuery.ts`:

```ts
export type DatePreset = 'all' | 'month' | 'last30' | 'last90' | 'year' | 'custom'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

// Shift an ISO date (YYYY-MM-DD) by a number of days, in local calendar terms.
function shiftDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

export function resolveDateRange(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
  today: string,
): { from: string | null; to: string | null } {
  const [y, m] = today.split('-').map(Number)
  switch (preset) {
    case 'all':
      return { from: null, to: null }
    case 'month': {
      const lastDay = new Date(y, m, 0).getDate() // day 0 of next month = last of this month
      return { from: iso(y, m, 1), to: iso(y, m, lastDay) }
    }
    case 'year':
      return { from: iso(y, 1, 1), to: iso(y, 12, 31) }
    case 'last30':
      return { from: shiftDays(today, -29), to: today }
    case 'last90':
      return { from: shiftDays(today, -89), to: today }
    case 'custom':
      return { from: customFrom || null, to: customTo || null }
  }
}

export function orderByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  return ids.map((id) => byId.get(id)).filter((x): x is T => x != null)
}

export interface StatusCounts {
  all: number
  pending: number
  attention: number
  overdue: number
  done: number
}

export function foldStatusCounts(rows: { status: string; n: number }[]): StatusCounts {
  const out: StatusCounts = { all: 0, pending: 0, attention: 0, overdue: 0, done: 0 }
  for (const r of rows) {
    if (r.status === 'pending' || r.status === 'attention' || r.status === 'overdue' || r.status === 'done') {
      out[r.status] = Number(r.n)
    }
  }
  out.all = out.pending + out.attention + out.overdue + out.done
  return out
}

export const pageCount = (total: number, pageSize: number): number =>
  Math.max(1, Math.ceil(total / pageSize))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/queries/visitsQuery.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/data/queries/visitsQuery.ts src/data/queries/visitsQuery.test.ts
git commit -m "feat: pure helpers for visits pagination (date range, ordering, counts)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Query keys + paginated hooks

**Files:**
- Modify: `src/data/queries/keys.ts`
- Create: `src/data/queries/useVisitsPage.ts`

**Interfaces:**
- Consumes (from Task 1): RPCs `visits_page`, `visit_status_counts`.
- Consumes (from Task 2): `orderByIds`, `foldStatusCounts`, `StatusCounts`.
- Consumes (existing): `rowToVisit` from `./mappers`, `supabase` from `../../lib/supabase`.
- Produces (consumed by Task 5):
  - `interface VisitsPageParams { today: string; from: string | null; to: string | null; status: string; latest: boolean; search: string; limit: number; offset: number }`
  - `useVisitsPage(p: VisitsPageParams): { visits: Visit[]; total: number; isLoading: boolean; isError: boolean }`
  - `interface CountsParams { today: string; from: string | null; to: string | null; latest: boolean; search: string }`
  - `useVisitStatusCounts(p: CountsParams): StatusCounts`

These hooks call the network and are not unit-tested (matches the repo: no DOM/integration tests). Verification is `npm run build` here and manual use in Task 5.

- [ ] **Step 1: Add parameterised child keys**

Modify `src/data/queries/keys.ts` to:

```ts
export const queryKeys = {
  brands: ['brands'] as const,
  outlets: ['outlets'] as const,
  stores: ['stores'] as const,
  staff: ['staff'] as const,
  visits: ['visits'] as const,
  visitsPage: (params: unknown) => ['visits', 'page', params] as const,
  visitStatusCounts: (params: unknown) => ['visits', 'counts', params] as const,
  taskTemplates: ['taskTemplates'] as const,
}
```

- [ ] **Step 2: Write the hooks**

Create `src/data/queries/useVisitsPage.ts`:

```ts
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Visit } from '../model'
import { rowToVisit } from './mappers'
import { queryKeys } from './keys'
import { orderByIds, foldStatusCounts, type StatusCounts } from './visitsQuery'

export interface VisitsPageParams {
  today: string
  from: string | null
  to: string | null
  status: string
  latest: boolean
  search: string
  limit: number
  offset: number
}

export function useVisitsPage(p: VisitsPageParams): {
  visits: Visit[]
  total: number
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: queryKeys.visitsPage(p),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data: pageRows, error } = await supabase.rpc('visits_page', {
        p_today: p.today,
        p_from: p.from,
        p_to: p.to,
        p_status: p.status,
        p_latest: p.latest,
        p_search: p.search,
        p_limit: p.limit,
        p_offset: p.offset,
      })
      if (error) throw error
      const rows = (pageRows ?? []) as { id: string; total_count: number }[]
      if (rows.length === 0) return { visits: [] as Visit[], total: 0 }
      const ids = rows.map((r) => r.id)
      const total = Number(rows[0].total_count)
      const { data: vRows, error: vErr } = await supabase
        .from('visits')
        .select('*, visit_tasks(*)')
        .in('id', ids)
      if (vErr) throw vErr
      const visits = orderByIds((vRows ?? []).map(rowToVisit), ids)
      return { visits, total }
    },
  })
  return {
    visits: query.data?.visits ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export interface CountsParams {
  today: string
  from: string | null
  to: string | null
  latest: boolean
  search: string
}

const ZERO_COUNTS: StatusCounts = { all: 0, pending: 0, attention: 0, overdue: 0, done: 0 }

export function useVisitStatusCounts(p: CountsParams): StatusCounts {
  const query = useQuery({
    queryKey: queryKeys.visitStatusCounts(p),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visit_status_counts', {
        p_today: p.today,
        p_from: p.from,
        p_to: p.to,
        p_latest: p.latest,
        p_search: p.search,
      })
      if (error) throw error
      return foldStatusCounts((data ?? []) as { status: string; n: number }[])
    },
  })
  return query.data ?? ZERO_COUNTS
}
```

- [ ] **Step 3: Verify the build type-checks**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/queries/keys.ts src/data/queries/useVisitsPage.ts
git commit -m "feat: paginated visits query hooks (useVisitsPage, useVisitStatusCounts)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Task-status color helper

**Files:**
- Modify: `src/data/derived.ts`

**Interfaces:**
- Produces (consumed by Task 5): `TASK_STATUS_COLOR: Record<TaskStatus, string>`

Trivial constant map; no separate test (`derived.ts` has none).

- [ ] **Step 1: Add the import and constant**

In `src/data/derived.ts`, extend the model import on line 2 to include `TaskStatus`:

```ts
import type { Brand, Visit, Outlet, Staff, Task, TaskStatus } from './model'
```

Then add, directly below the existing `STATUS_LABEL` block (after line 81):

```ts
// Per-task dot color for read-only checklist displays (mirrors the drawer's segments).
export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  pending: '#6b7280',
  failed: '#dc2626',
  success: '#16a34a',
}
```

- [ ] **Step 2: Verify the build type-checks**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/data/derived.ts
git commit -m "feat: TASK_STATUS_COLOR helper for read-only checklist dots

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Rebuild the Visits screen

**Files:**
- Modify (full rewrite): `src/screens/Visits.tsx`

**Interfaces:**
- Consumes (Task 2): `resolveDateRange`, `pageCount`, `DatePreset`.
- Consumes (Task 3): `useVisitsPage`, `useVisitStatusCounts`.
- Consumes (Task 4): `TASK_STATUS_COLOR`.
- Consumes (existing): `visitVM`, `today` from `derived`; `useMarkAllSuccess`; `useStore`; `useData`; `card`, `chip`, `pill` from `theme`; `Icon`.

This screen has no automated test (no DOM tests in repo). Verify via `npm run build` and manual run.

- [ ] **Step 1: Replace the file contents**

Overwrite `src/screens/Visits.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useMarkAllSuccess } from '../data/queries/useVisitMutations'
import { useVisitsPage, useVisitStatusCounts } from '../data/queries/useVisitsPage'
import { visitVM, today, TASK_STATUS_COLOR } from '../data/derived'
import { resolveDateRange, pageCount, type DatePreset } from '../data/queries/visitsQuery'
import type { VisitFilter } from '../data/store'
import type { Task } from '../data/model'
import { card, chip, pill } from '../theme'
import { Icon } from '../components/Icon'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PAGE_SIZE = 25
const PRESETS: [DatePreset, string][] = [
  ['all', 'All time'],
  ['month', 'This month'],
  ['last30', 'Last 30 days'],
  ['last90', 'Last 90 days'],
  ['year', 'This year'],
  ['custom', 'Custom'],
]
const pad = (n: number) => String(n).padStart(2, '0')

const pagerBtn = (disabled: boolean) => ({
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  borderRadius: 7,
  padding: '5px 12px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
})

const dateInput = {
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  borderRadius: 8,
  padding: '6px 9px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 12.5,
  color: 'var(--text)',
} as const

export function Visits() {
  const { state, setVisitFilter, openVisit } = useStore()
  const { data } = useData()
  const markAllMutation = useMarkAllSuccess()
  const S = state
  const isMobile = S.isMobile

  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [latestPerStore, setLatestPerStore] = useState(false)
  const [page, setPage] = useState(0)
  const [allExpanded, setAllExpanded] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const t = today()
  const todayStr = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
  const { from, to } = resolveDateRange(datePreset, customFrom, customTo, todayStr)
  const search = S.q.trim()

  // Any filter change returns to the first page.
  useEffect(() => {
    setPage(0)
  }, [S.visitFilter, datePreset, customFrom, customTo, latestPerStore, search])

  // Collapse all detail views when the page or any filter changes.
  useEffect(() => {
    setAllExpanded(false)
    setExpandedIds(new Set())
  }, [page, S.visitFilter, datePreset, customFrom, customTo, latestPerStore, search])

  const counts = useVisitStatusCounts({ today: todayStr, from, to, latest: latestPerStore, search })
  const { visits, total } = useVisitsPage({
    today: todayStr,
    from,
    to,
    status: S.visitFilter,
    latest: latestPerStore,
    search,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })

  const totalPages = pageCount(total, PAGE_SIZE)
  const filterDefs: [VisitFilter, string][] = [
    ['all', 'All'],
    ['pending', 'Pending'],
    ['attention', 'Attention'],
    ['overdue', 'Overdue'],
    ['done', 'Completed'],
  ]

  const rows = visits.map((f) => {
    const vm = visitVM(data, f)
    const d = new Date(f.date + 'T00:00:00')
    return { vm, tasks: f.tasks, day: pad(d.getDate()), mon: MON[d.getMonth()], canComplete: vm.pendingT > 0 }
  })

  const toggleExpand = (id: string) =>
    setExpandedIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () => {
    if (allExpanded) {
      setAllExpanded(false)
      setExpandedIds(new Set())
    } else {
      setAllExpanded(true)
      setExpandedIds(new Set(visits.map((v) => v.id)))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* status chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
        {filterDefs.map(([k, label]) => (
          <button key={k} onClick={() => setVisitFilter(k)} style={chip(S.visitFilter === k)}>
            {label} <span style={{ fontFamily: "'IBM Plex Mono'", opacity: 0.7 }}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {/* filter toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {PRESETS.map(([k, label]) => (
            <button key={k} onClick={() => setDatePreset(k)} style={chip(datePreset === k)}>
              {label}
            </button>
          ))}
        </div>
        {datePreset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" aria-label="From date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={dateInput} />
            <span style={{ color: 'var(--dim)', fontSize: 12 }}>→</span>
            <input type="date" aria-label="To date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={dateInput} />
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={latestPerStore} onChange={(e) => setLatestPerStore(e.target.checked)} />
          Latest per store
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={allExpanded} onChange={toggleAll} />
          Expand all
        </label>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {rows.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>No visits match this filter.</div>
        )}

        {!isMobile && rows.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '9px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface2)',
              fontSize: 10.5,
              fontWeight: 600,
              color: 'var(--dim)',
              textTransform: 'uppercase',
              letterSpacing: '.05em',
            }}
          >
            <div style={{ width: 22, flexShrink: 0 }} />
            <div style={{ width: 46, textAlign: 'center', flexShrink: 0 }}>Date</div>
            <div style={{ width: 1, flexShrink: 0 }} />
            <div style={{ flex: 1.6, minWidth: 0 }}>Brand · Outlet</div>
            <div style={{ flex: 1, minWidth: 90 }}>Tasks</div>
            <div style={{ width: 116, textAlign: 'right', flexShrink: 0 }}>Action</div>
            <div style={{ width: 132, textAlign: 'right', flexShrink: 0 }}>Status</div>
          </div>
        )}

        {rows.map((f) => {
          const expanded = expandedIds.has(f.vm.id)
          const chevron = (
            <button
              type="button"
              aria-label={expanded ? 'Collapse checklist' : 'Expand checklist'}
              aria-expanded={expanded}
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(f.vm.id)
              }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
              <Icon name={expanded ? 'expand_less' : 'expand_more'} size={20} />
            </button>
          )

          return (
            <div key={f.vm.id}>
              {!isMobile ? (
                <div
                  onClick={() => openVisit(f.vm.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderBottom: expanded ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <div style={{ width: 22, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{chevron}</div>
                  <div style={{ width: 46, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 17, fontWeight: 600, lineHeight: 1 }}>{f.day}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{f.mon}</div>
                  </div>
                  <div style={{ width: 1, height: 34, background: 'var(--border)', flexShrink: 0 }} />
                  <div style={{ flex: 1.6, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: f.vm.brandColor, flexShrink: 0 }} />
                      {f.vm.brandName} · {f.vm.outletName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>{f.vm.staffName}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 90 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden', maxWidth: 90, display: 'flex' }}>
                        {f.vm.successT > 0 && <div style={{ width: `${(f.vm.successT / f.vm.total) * 100}%`, background: '#16a34a' }} />}
                        {f.vm.failedT > 0 && <div style={{ width: `${(f.vm.failedT / f.vm.total) * 100}%`, background: '#dc2626' }} />}
                      </div>
                      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: 'var(--dim)' }}>
                        {f.vm.resolvedT}/{f.vm.total}
                      </span>
                    </div>
                  </div>
                  <div style={{ width: 116, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                    {f.canComplete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          markAllMutation.mutate({ visitId: f.vm.id })
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          border: '1px solid #16a34a',
                          background: 'color-mix(in srgb, #16a34a 8%, transparent)',
                          color: '#16a34a',
                          borderRadius: 7,
                          padding: '6px 10px',
                          fontFamily: "'IBM Plex Sans'",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <Icon name="check" size={16} />
                        Pass pending
                      </button>
                    )}
                  </div>
                  <div style={{ width: 132, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <span style={pill(f.vm.statusColor)}>{f.vm.statusLabel}</span>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => openVisit(f.vm.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderBottom: expanded ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}
                >
                  {chevron}
                  <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, fontWeight: 600, lineHeight: 1 }}>{f.day}</div>
                    <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{f.mon}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: f.vm.brandColor, flexShrink: 0 }} />
                      {f.vm.brandName} · {f.vm.outletName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.vm.staffName}
                    </div>
                  </div>
                  <span style={pill(f.vm.statusColor)}>{f.vm.statusLabel}</span>
                </div>
              )}

              {expanded && <ChecklistDetail tasks={f.tasks} />}
            </div>
          )
        })}

        {rows.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--dim)' }}>
            <span style={{ fontFamily: "'IBM Plex Mono'" }}>
              {total} visit{total === 1 ? '' : 's'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={pagerBtn(page <= 0)}>
                Prev
              </button>
              <span style={{ fontFamily: "'IBM Plex Mono'" }}>
                Page {page + 1} / {totalPages}
              </span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} style={pagerBtn(page >= totalPages - 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChecklistDetail({ tasks }: { tasks: Task[] }) {
  return (
    <div style={{ padding: '4px 16px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tasks.map((tk) => (
          <div
            key={tk.id ?? tk.label}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
          >
            <span title={tk.status} style={{ width: 9, height: 9, borderRadius: '50%', background: TASK_STATUS_COLOR[tk.status], flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{tk.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>{tk.remark || '—'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build type-checks (catches unused imports)**

Run: `npm run build`
Expected: PASS — no unused-locals errors, no type errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS (existing suite + `visitsQuery.test.ts`).

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open the Visits screen, and confirm:
- Status chips show counts; clicking filters the list and resets to page 1.
- Date presets change the list; "Custom" reveals from/to inputs.
- "Latest per store" reduces the list to the newest visit per store within the range.
- The chevron expands a read-only checklist (task · colored dot · remark); "Expand all" toggles every row on the page; both collapse on page/filter change.
- Prev/Next paginate; "Page X / Y" and the total are correct; marking pending success still updates the row (mutation invalidation cascades).

- [ ] **Step 5: Commit**

```bash
git add src/screens/Visits.tsx
git commit -m "feat: server-side paginated Visits screen with date range, detail expand, latest-per-store

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Pagination → Task 1 (RPC) + Task 3 (hook) + Task 5 (footer, page state). ✓
- Date-range filter (presets + custom) → Task 2 (`resolveDateRange`) + Task 5 (toolbar). ✓
- Expandable read-only detail + expand-all → Task 4 (colors) + Task 5 (`ChecklistDetail`, `expandedIds`, `toggleAll`). ✓
- Latest-per-store within date range → Task 1 (`p_latest` distinct-on over ranged set) + Task 5 (checkbox). ✓
- Status chips with counts → Task 1 (`visit_status_counts`) + Task 3 (`useVisitStatusCounts`) + Task 5. ✓
- Overdue/JS parity via `p_today` → Task 1 + Task 5 (`todayStr`). ✓
- RLS preserved (`security_invoker`) → Task 1. ✓
- Keys nested under `['visits']` so mutations still invalidate → Task 3. ✓
- Pure-logic-in-tested-module convention → Task 2. ✓
- Out of scope (Dashboard, badges, drawer, modal, global fetch) → untouched, deferred to Spec 2. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full code. ✓

**Type consistency:** `VisitsPageParams`/`CountsParams` fields match the `useVisitsPage`/`useVisitStatusCounts` call sites in Task 5; `StatusCounts` keys (`all/pending/attention/overdue/done`) match `filterDefs` keys and `counts[k]`; RPC parameter names (`p_*`) match the `.rpc()` argument objects; `TASK_STATUS_COLOR` keyed by `TaskStatus` (`pending/failed/success`) matches `tk.status`. ✓
