# Remove Global Visits Fetch — Implementation Plan (Spec 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `fetchVisits` / `data.visits` from the app so the Dashboard, overdue badge, visit drawer, and add-task modal each load only what they need via targeted queries.

**Architecture:** A new SQL migration adds `dashboard_summary` (one JSON RPC for all Dashboard visit metrics) and `visits_missing_label`. New React Query hooks back each consumer; a pure `mapDashboardSummary` is the typed boundary. Consumers are migrated off `data.visits` first (build stays green because the field still exists), then the `visits` query is deleted from `useData` last.

**Tech Stack:** React 18, TypeScript, Vite, Supabase (PostgREST + RPC), @tanstack/react-query v5, Vitest (node env, `src/**/*.test.ts`).

## Global Constraints

- All styling is inline `style={}` objects driven by CSS variables (`src/theme.ts`); no CSS framework.
- Build is strict: `tsc -b` fails on unused locals/params (`noUnusedLocals`/`noUnusedParameters`). Removing `data.visits` from a file means removing every now-dead import too.
- DB rows (snake_case) → domain (camelCase) only through mappers; the JSON RPC's typed boundary is `mapDashboardSummary`.
- New query keys MUST nest under the `['visits']` prefix so existing mutations' `invalidateQueries({ queryKey: ['visits'] })` cascades to them. Do NOT change mutations.
- Migrations are plain SQL in `supabase/migrations/`, applied manually in the Supabase SQL editor; functions stay `SECURITY INVOKER` (the default) so `owner_id = auth.uid()` RLS holds.
- "done"/"complete" semantics = `base_status != 'pending'` (both `done` and `attention` count); "pending" = `base_status = 'pending'` (includes overdue); "overdue" = `base_status = 'pending' AND date < p_today`.
- Commit message trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Database migration (dashboard_summary + visits_missing_label)

**Files:**
- Create: `supabase/migrations/0008_dashboard_and_lookups.sql`

**Interfaces:**
- Produces (consumed by Task 3):
  - `dashboard_summary(p_today date, p_year text, p_month text, p_list_limit int) returns json`
  - `visits_missing_label(p_label text, p_limit int) returns table (id uuid, date date, brand_name text, outlet_name text, staff_name text)`

Applied manually in the Supabase SQL editor; no automated test (consistent with every migration in this repo). The implementer has no DB access — create the file, run `npm run build` (confirms nothing else broke), commit. Manual SQL-editor application is deferred to the human.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0008_dashboard_and_lookups.sql`:

```sql
-- 0008_dashboard_and_lookups.sql
-- Spec 2: remove the global visits fetch. Two security_invoker functions:
--   dashboard_summary  — one JSON blob with all Dashboard visit metrics
--   visits_missing_label — visits lacking a given task label (add-task modal)
-- Both build on the 0007 visit_with_status view and keep owner_id RLS in force.
-- Apply AFTER 0007_visit_pagination.sql in the Supabase SQL editor.

create or replace function dashboard_summary(
  p_today      date,
  p_year       text,
  p_month      text,
  p_list_limit int
) returns json
language sql stable as $$
  with v as (
    select w.*,
      (w.base_status = 'pending' and w.date < p_today) as is_overdue,
      (w.base_status <> 'pending') as is_done
    from visit_with_status w
  ),
  month_v as (select * from v where to_char(date, 'YYYY-MM') = p_month),
  year_v  as (select * from v where to_char(date, 'YYYY')    = p_year),
  km as (
    select json_build_object(
      'total',   count(*),
      'done',    count(*) filter (where is_done),
      'pending', count(*) filter (where base_status = 'pending'),
      'overdue', count(*) filter (where is_overdue)
    ) as j from month_v
  ),
  ky as (
    select json_build_object(
      'total',   count(*),
      'done',    count(*) filter (where is_done),
      'pending', count(*) filter (where base_status = 'pending'),
      'overdue', count(*) filter (where is_overdue)
    ) as j from year_v
  ),
  months as (
    select to_char(make_date(p_year::int, m, 1), 'YYYY-MM') as month
    from generate_series(1, 12) as m
  ),
  trend as (
    select coalesce(json_agg(
      json_build_object('month', months.month,
        'done',  coalesce(t.done, 0),
        'total', coalesce(t.total, 0))
      order by months.month), '[]'::json) as j
    from months
    left join (
      select to_char(date, 'YYYY-MM') as month,
             count(*) as total,
             count(*) filter (where is_done) as done
      from year_v group by 1
    ) t on t.month = months.month
  ),
  bb as (
    select coalesce(json_agg(
      json_build_object('brand_id', brand_id, 'done', done, 'total', total)
    ), '[]'::json) as j
    from (
      select brand_id, count(*) as total, count(*) filter (where is_done) as done
      from year_v group by brand_id
    ) b
  ),
  od as (
    select coalesce(json_agg(x.j order by x.date asc), '[]'::json) as j
    from (
      select json_build_object('id', id, 'date', date, 'brand_name', brand_name,
               'outlet_name', outlet_name, 'staff_name', staff_name) as j, date
      from v where is_overdue order by date asc limit p_list_limit
    ) x
  ),
  up as (
    select coalesce(json_agg(x.j order by x.date asc), '[]'::json) as j
    from (
      select json_build_object('id', id, 'date', date, 'brand_name', brand_name,
               'outlet_name', outlet_name, 'staff_name', staff_name) as j, date
      from v where base_status = 'pending' and date >= p_today
      order by date asc limit p_list_limit
    ) x
  )
  select json_build_object(
    'kpis_month',     (select j from km),
    'kpis_year',      (select j from ky),
    'trend',          (select j from trend),
    'brand_breakdown',(select j from bb),
    'overdue',        (select j from od),
    'upcoming',       (select j from up),
    'overdue_total',  (select count(*) from v where is_overdue),
    'upcoming_total', (select count(*) from v where base_status = 'pending' and date >= p_today)
  );
$$;

grant execute on function dashboard_summary(date, text, text, int) to authenticated;

create or replace function visits_missing_label(p_label text, p_limit int)
returns table (id uuid, date date, brand_name text, outlet_name text, staff_name text)
language sql stable as $$
  select v.id, v.date, b.name, o.name, s.name
  from visits v
  join brands  b on b.id = v.brand_id
  join outlets o on o.id = v.outlet_id
  left join staff s on s.id = v.staff_id
  where not exists (
    select 1 from visit_tasks t
    where t.visit_id = v.id
      and lower(trim(t.label)) = lower(trim(p_label))
  )
  order by v.date desc, v.id desc
  limit p_limit;
$$;

grant execute on function visits_missing_label(text, int) to authenticated;
```

- [ ] **Step 2: Verify the build still type-checks**

Run: `npm run build`
Expected: PASS (SQL file is not compiled).

- [ ] **Step 3: Apply & verify in Supabase SQL editor (manual, deferred to human)**

After applying, signed in as a normal user:
- `select dashboard_summary(current_date, '2026', '2026-06', 20);` returns one JSON object with `kpis_month`, `kpis_year`, `trend` (12 entries), `brand_breakdown`, `overdue`, `upcoming`, `overdue_total`, `upcoming_total`.
- `select * from visits_missing_label('Restock shelves', 200);` returns visits lacking that task, newest first.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_dashboard_and_lookups.sql
git commit -m "feat(db): dashboard_summary + visits_missing_label RPCs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Dashboard summary mapper + types

**Files:**
- Create: `src/data/queries/dashboardSummary.ts`
- Test: `src/data/queries/dashboardSummary.test.ts`

**Interfaces:**
- Produces (consumed by Task 3 & 4):
  - Types `DashboardKpis`, `TrendPoint`, `BrandStat`, `AttentionItem`, `DashboardSummary`, `MissingLabelVisit`.
  - `EMPTY_SUMMARY: DashboardSummary`
  - `mapDashboardSummary(raw: any): DashboardSummary`
  - `mapMissingLabelVisit(raw: any): MissingLabelVisit`

`DashboardSummary` shape: `{ kpisMonth, kpisYear: DashboardKpis; trend: TrendPoint[]; brandBreakdown: BrandStat[]; overdue, upcoming: AttentionItem[]; overdueTotal, upcomingTotal: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/data/queries/dashboardSummary.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapDashboardSummary, mapMissingLabelVisit, EMPTY_SUMMARY } from './dashboardSummary'

describe('mapDashboardSummary', () => {
  it('maps a full snake_case payload to the camelCase domain shape', () => {
    const raw = {
      kpis_month: { total: 5, done: 3, pending: 2, overdue: 1 },
      kpis_year: { total: 40, done: 30, pending: 10, overdue: 4 },
      trend: [{ month: '2026-01', done: 2, total: 3 }],
      brand_breakdown: [{ brand_id: 'b1', done: 4, total: 6 }],
      overdue: [{ id: 'v1', date: '2026-05-01', brand_name: 'B', outlet_name: 'O', staff_name: 'S' }],
      upcoming: [{ id: 'v2', date: '2026-07-01', brand_name: 'B', outlet_name: 'O', staff_name: null }],
      overdue_total: 12,
      upcoming_total: 7,
    }
    expect(mapDashboardSummary(raw)).toEqual({
      kpisMonth: { total: 5, done: 3, pending: 2, overdue: 1 },
      kpisYear: { total: 40, done: 30, pending: 10, overdue: 4 },
      trend: [{ month: '2026-01', done: 2, total: 3 }],
      brandBreakdown: [{ brandId: 'b1', done: 4, total: 6 }],
      overdue: [{ id: 'v1', date: '2026-05-01', brandName: 'B', outletName: 'O', staffName: 'S' }],
      upcoming: [{ id: 'v2', date: '2026-07-01', brandName: 'B', outletName: 'O', staffName: null }],
      overdueTotal: 12,
      upcomingTotal: 7,
    })
  })

  it('defaults missing arrays to [] and missing kpi fields to 0', () => {
    expect(mapDashboardSummary({})).toEqual(EMPTY_SUMMARY)
    expect(mapDashboardSummary({ kpis_month: { total: 3 } }).kpisMonth).toEqual({
      total: 3, done: 0, pending: 0, overdue: 0,
    })
  })

  it('coerces numeric strings (bigint-as-string) to numbers', () => {
    const r = mapDashboardSummary({ overdue_total: '9', kpis_year: { total: '40' } })
    expect(r.overdueTotal).toBe(9)
    expect(r.kpisYear.total).toBe(40)
  })
})

describe('mapMissingLabelVisit', () => {
  it('maps a row to camelCase with null staff fallback', () => {
    expect(mapMissingLabelVisit({ id: 'v1', date: '2026-06-30', brand_name: 'B', outlet_name: 'O', staff_name: null }))
      .toEqual({ id: 'v1', date: '2026-06-30', brandName: 'B', outletName: 'O', staffName: null })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/queries/dashboardSummary.test.ts`
Expected: FAIL — cannot find module `./dashboardSummary`.

- [ ] **Step 3: Write the implementation**

Create `src/data/queries/dashboardSummary.ts`:

```ts
export interface DashboardKpis {
  total: number
  done: number
  pending: number
  overdue: number
}
export interface TrendPoint {
  month: string // 'YYYY-MM'
  done: number
  total: number
}
export interface BrandStat {
  brandId: string
  done: number
  total: number
}
export interface AttentionItem {
  id: string
  date: string
  brandName: string
  outletName: string
  staffName: string | null
}
export interface DashboardSummary {
  kpisMonth: DashboardKpis
  kpisYear: DashboardKpis
  trend: TrendPoint[]
  brandBreakdown: BrandStat[]
  overdue: AttentionItem[]
  upcoming: AttentionItem[]
  overdueTotal: number
  upcomingTotal: number
}
export interface MissingLabelVisit {
  id: string
  date: string
  brandName: string
  outletName: string
  staffName: string | null
}

const ZERO_KPIS: DashboardKpis = { total: 0, done: 0, pending: 0, overdue: 0 }

export const EMPTY_SUMMARY: DashboardSummary = {
  kpisMonth: ZERO_KPIS,
  kpisYear: ZERO_KPIS,
  trend: [],
  brandBreakdown: [],
  overdue: [],
  upcoming: [],
  overdueTotal: 0,
  upcomingTotal: 0,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any

const num = (x: unknown): number => Number(x ?? 0)

function kpis(raw: Raw): DashboardKpis {
  const r = raw ?? {}
  return { total: num(r.total), done: num(r.done), pending: num(r.pending), overdue: num(r.overdue) }
}

function attentionList(raw: Raw): AttentionItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x: Raw) => ({
    id: x.id,
    date: x.date,
    brandName: x.brand_name,
    outletName: x.outlet_name,
    staffName: x.staff_name ?? null,
  }))
}

export function mapDashboardSummary(raw: Raw): DashboardSummary {
  const r = raw ?? {}
  return {
    kpisMonth: kpis(r.kpis_month),
    kpisYear: kpis(r.kpis_year),
    trend: Array.isArray(r.trend)
      ? r.trend.map((t: Raw) => ({ month: t.month, done: num(t.done), total: num(t.total) }))
      : [],
    brandBreakdown: Array.isArray(r.brand_breakdown)
      ? r.brand_breakdown.map((b: Raw) => ({ brandId: b.brand_id, done: num(b.done), total: num(b.total) }))
      : [],
    overdue: attentionList(r.overdue),
    upcoming: attentionList(r.upcoming),
    overdueTotal: num(r.overdue_total),
    upcomingTotal: num(r.upcoming_total),
  }
}

export function mapMissingLabelVisit(raw: Raw): MissingLabelVisit {
  return {
    id: raw.id,
    date: raw.date,
    brandName: raw.brand_name,
    outletName: raw.outlet_name,
    staffName: raw.staff_name ?? null,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/queries/dashboardSummary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/queries/dashboardSummary.ts src/data/queries/dashboardSummary.test.ts
git commit -m "feat: dashboard summary mapper + domain types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Query keys + the four hooks

**Files:**
- Modify: `src/data/queries/keys.ts`
- Create: `src/data/queries/useDashboardSummary.ts`
- Create: `src/data/queries/useVisit.ts`
- Create: `src/data/queries/useOverdueCount.ts`
- Create: `src/data/queries/useVisitsMissingLabel.ts`

**Interfaces:**
- Consumes: Task 1 RPCs; Task 2 (`mapDashboardSummary`, `EMPTY_SUMMARY`, `DashboardSummary`, `mapMissingLabelVisit`, `MissingLabelVisit`); existing `rowToVisit`, `supabase`, `today`, and `useVisitStatusCounts` (from `useVisitsPage.ts`, Spec 1).
- Produces (consumed by Tasks 4–7):
  - `useDashboardSummary(p: { today, year, month, listLimit }): { summary: DashboardSummary; isLoading: boolean; isError: boolean }`
  - `useVisit(id: string | null): { visit: Visit | null; isLoading: boolean; isError: boolean }`
  - `useOverdueCount(): number`
  - `useVisitsMissingLabel(label: string): { visits: MissingLabelVisit[]; isLoading: boolean; isError: boolean }`

Network hooks; not unit-tested. Verification is `npm run build`.

- [ ] **Step 1: Add the keys**

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
  visit: (id: string | null) => ['visits', 'one', id] as const,
  dashboardSummary: (params: unknown) => ['visits', 'dashboard', params] as const,
  visitsMissingLabel: (params: unknown) => ['visits', 'missing', params] as const,
  taskTemplates: ['taskTemplates'] as const,
}
```

- [ ] **Step 2: Write `useDashboardSummary.ts`**

Create `src/data/queries/useDashboardSummary.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import { mapDashboardSummary, EMPTY_SUMMARY, type DashboardSummary } from './dashboardSummary'

export interface DashboardParams {
  today: string
  year: string
  month: string
  listLimit: number
}

export function useDashboardSummary(p: DashboardParams): {
  summary: DashboardSummary
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: queryKeys.dashboardSummary(p),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_summary', {
        p_today: p.today,
        p_year: p.year,
        p_month: p.month,
        p_list_limit: p.listLimit,
      })
      if (error) throw error
      return mapDashboardSummary(data)
    },
  })
  return { summary: query.data ?? EMPTY_SUMMARY, isLoading: query.isLoading, isError: query.isError }
}
```

- [ ] **Step 3: Write `useVisit.ts`**

Create `src/data/queries/useVisit.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Visit } from '../model'
import { rowToVisit } from './mappers'
import { queryKeys } from './keys'

export function useVisit(id: string | null): {
  visit: Visit | null
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: queryKeys.visit(id),
    enabled: id != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*, visit_tasks(*)')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data ? rowToVisit(data) : null
    },
  })
  return { visit: query.data ?? null, isLoading: query.isLoading, isError: query.isError }
}
```

- [ ] **Step 4: Write `useOverdueCount.ts`**

Create `src/data/queries/useOverdueCount.ts`:

```ts
import { useVisitStatusCounts } from './useVisitsPage'
import { today } from '../derived'

const pad = (n: number) => String(n).padStart(2, '0')

/** Total overdue visits across all time — backs the nav badge. */
export function useOverdueCount(): number {
  const t = today()
  const todayStr = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
  const counts = useVisitStatusCounts({ today: todayStr, from: null, to: null, latest: false, search: '' })
  return counts.overdue
}
```

- [ ] **Step 5: Write `useVisitsMissingLabel.ts`**

Create `src/data/queries/useVisitsMissingLabel.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import { mapMissingLabelVisit, type MissingLabelVisit } from './dashboardSummary'

const MISSING_LABEL_LIMIT = 200

export function useVisitsMissingLabel(label: string): {
  visits: MissingLabelVisit[]
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: queryKeys.visitsMissingLabel({ label, limit: MISSING_LABEL_LIMIT }),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visits_missing_label', {
        p_label: label,
        p_limit: MISSING_LABEL_LIMIT,
      })
      if (error) throw error
      return ((data ?? []) as unknown[]).map(mapMissingLabelVisit)
    },
  })
  return { visits: query.data ?? [], isLoading: query.isLoading, isError: query.isError }
}
```

- [ ] **Step 6: Verify the build type-checks**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data/queries/keys.ts src/data/queries/useDashboardSummary.ts src/data/queries/useVisit.ts src/data/queries/useOverdueCount.ts src/data/queries/useVisitsMissingLabel.ts
git commit -m "feat: hooks for dashboard summary, single visit, overdue count, missing-label visits

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Migrate Dashboard to the summary RPC

**Files:**
- Modify (full rewrite): `src/screens/Dashboard.tsx`

**Interfaces:**
- Consumes (Task 3): `useDashboardSummary`.
- Consumes (existing): `useData` (reference data only), `brandById`, `linked`, `staffCount`, `today`, `fmt` from `derived`; `card`, `mono`, `periodBtn`, `tint` from `theme`; `Icon`.

After this task `Dashboard.tsx` no longer reads `data.visits` (the field still exists on `data`, unused here — that is fine and removed in Task 8). No automated test for the screen; verify with `npm run build` + `npm test`.

- [ ] **Step 1: Replace the file contents**

Overwrite `src/screens/Dashboard.tsx` with:

```tsx
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useDashboardSummary } from '../data/queries/useDashboardSummary'
import { brandById, linked, staffCount, today, fmt } from '../data/derived'
import { card, mono, periodBtn, tint } from '../theme'
import { Icon } from '../components/Icon'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

export function Dashboard() {
  const { state, setPeriod, openVisit } = useStore()
  const { data } = useData()
  const S = state

  const t = today()
  const yr = String(t.getFullYear())
  const mo = `${yr}-${pad(t.getMonth() + 1)}`
  const todayStr = `${yr}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
  const monthLabel = t.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const yearLabel = `Year ${yr}`

  const { summary, isLoading: sumLoading, isError: sumError } = useDashboardSummary({
    today: todayStr,
    year: yr,
    month: mo,
    listLimit: 20,
  })

  const kpiSrc = S.period === 'month' ? summary.kpisMonth : summary.kpisYear
  const periodLabel = S.period === 'month' ? monthLabel : yearLabel
  const compRate = kpiSrc.total ? Math.round((kpiSrc.done / kpiSrc.total) * 100) : 0

  const stats = [
    { icon: 'sell', label: 'Brands', value: data.brands.length },
    { icon: 'storefront', label: 'Outlets', value: data.outlets.length },
    { icon: 'store', label: 'Active stores', value: data.stores.length },
    { icon: 'groups', label: 'Staff monitored', value: data.staff.length },
  ]

  const kpis = [
    { label: 'Visits', value: kpiSrc.total, sub: periodLabel, icon: 'fact_check', tone: 'var(--text)' },
    { label: 'Completion', value: `${compRate}%`, sub: `${kpiSrc.done} completed`, icon: 'task_alt', tone: '#16a34a' },
    { label: 'Pending', value: kpiSrc.pending, sub: 'awaiting completion', icon: 'pending', tone: '#d97706' },
    { label: 'Overdue', value: kpiSrc.overdue, sub: 'past scheduled date', icon: 'event_busy', tone: '#ea580c' },
  ]

  const mdata = summary.trend.map((pt) => {
    const idx = Number(pt.month.slice(5, 7)) - 1
    return { label: MONTHS[idx] ?? pt.month, done: pt.done, notDone: pt.total - pt.done }
  })
  const tmax = Math.max(1, ...mdata.map((m) => m.done + m.notDone))
  const H = 108

  const brandBreakdown = data.brands.map((b) => {
    const st = summary.brandBreakdown.find((x) => x.brandId === b.id)
    const done = st?.done ?? 0
    const total = st?.total ?? 0
    return { name: b.name, color: b.color, done, total, pct: total ? Math.round((done / total) * 100) : 0 }
  })

  const omax = Math.max(1, ...data.outlets.map((o) => staffCount(data, null, o.id)))
  const outletBreakdown = data.outlets.map((o) => {
    const staff = staffCount(data, null, o.id)
    const brands = data.stores.filter((s) => s.outletId === o.id).length
    return { name: o.name, location: o.location, staff, brands, pct: Math.round((staff / omax) * 100) }
  })

  const overdueList = summary.overdue
  const upcomingList = summary.upcoming

  const sectionTitle = { fontSize: 14, fontWeight: 700 } as const
  const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14 } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                background: tint('var(--accent)', 12),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name={s.icon} size={21} color="var(--accent)" />
            </div>
            <div>
              <div style={{ ...mono, fontSize: 23, fontWeight: 600, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', fontWeight: 500, marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* period toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)' }}>
          Visit performance — {periodLabel}
          {sumLoading && <span style={{ marginLeft: 8, fontWeight: 500 }}>· loading…</span>}
          {sumError && <span style={{ marginLeft: 8, fontWeight: 500, color: '#dc2626' }}>· couldn’t load metrics</span>}
        </div>
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 3,
            gap: 2,
          }}
        >
          <button onClick={() => setPeriod('month')} style={periodBtn(S.period === 'month')}>This month</button>
          <button onClick={() => setPeriod('year')} style={periodBtn(S.period === 'year')}>{yearLabel}</button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: '15px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--dim)' }}>
                {k.label}
              </div>
              <Icon name={k.icon} size={18} color={k.tone} />
            </div>
            <div style={{ ...mono, fontSize: 30, fontWeight: 600, lineHeight: 1, marginTop: 10, color: k.tone }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 5 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* attention lists */}
      {(overdueList.length > 0 || upcomingList.length > 0) && (
        <div style={grid2}>
          {overdueList.length > 0 && (
            <div style={{ ...card, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name="warning" size={19} color="#dc2626" />
                <div style={sectionTitle}>Overdue visits</div>
                <span style={{ ...mono, fontSize: 12, fontWeight: 600, background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '1px 8px' }}>
                  {summary.overdueTotal}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {overdueList.map((f) => (
                  <AttentionRow key={f.id} dot="#dc2626" title={`${f.brandName} · ${f.outletName}`} sub={f.staffName ?? 'Unassigned'} date={fmt(f.date)} dateColor="#dc2626" onClick={() => openVisit(f.id)} />
                ))}
              </div>
            </div>
          )}
          {upcomingList.length > 0 && (
            <div style={{ ...card, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name="event_upcoming" size={19} color="#2563eb" />
                <div style={sectionTitle}>Upcoming visits</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingList.map((f) => (
                  <AttentionRow key={f.id} dot="#2563eb" title={`${f.brandName} · ${f.outletName}`} sub={f.staffName ?? 'Unassigned'} date={fmt(f.date)} dateColor="var(--dim)" onClick={() => openVisit(f.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* trend + matrix */}
      <div style={grid2}>
        {/* trend */}
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={sectionTitle}>Visits by month</div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--dim)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--accent)' }} />Done
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: tint('var(--accent)', 22) }} />Open
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 158, paddingTop: 18 }}>
            {mdata.map((m) => {
              const total = m.done + m.notDone
              return (
                <div
                  key={m.label}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}
                >
                  <div style={{ ...mono, fontSize: 11, fontWeight: 600, color: 'var(--dim)' }}>{total}</div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 30,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      borderRadius: 5,
                      overflow: 'hidden',
                      background: 'var(--surface2)',
                    }}
                  >
                    <div style={{ height: Math.round((m.notDone / tmax) * H), background: tint('var(--accent)', 22) }} />
                    <div style={{ height: Math.round((m.done / tmax) * H), background: 'var(--accent)' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 500 }}>{m.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* matrix */}
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={{ ...sectionTitle, marginBottom: 3 }}>Brand × Outlet coverage</div>
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 12 }}>Stores per location · number = staff on site</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 6, width: '100%' }}>
              <thead>
                <tr>
                  <th />
                  {data.outlets.map((o) => (
                    <th key={o.id} style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim)', textAlign: 'center', paddingBottom: 2 }}>
                      {o.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.brands.map((b) => (
                  <tr key={b.id}>
                    <td style={{ paddingRight: 8 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: b.color }} />
                        {b.name}
                      </span>
                    </td>
                    {data.outlets.map((o) => {
                      const isLinked = linked(data, b.id, o.id)
                      const cnt = staffCount(data, b.id, o.id)
                      return (
                        <td key={o.id}>
                          <div
                            style={{
                              height: 34,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 7,
                              ...mono,
                              fontSize: 13,
                              fontWeight: 600,
                              ...(isLinked
                                ? { background: tint(b.color, 14), color: b.color }
                                : { background: 'var(--surface2)', color: 'var(--border)' }),
                            }}
                          >
                            {isLinked ? String(cnt) : '–'}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* breakdowns */}
      <div style={grid2}>
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={{ ...sectionTitle, marginBottom: 14 }}>Visits by brand</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {brandBreakdown.map((b) => (
              <div key={b.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: b.color }} />
                    {b.name}
                  </span>
                  <span style={{ ...mono, color: 'var(--dim)', fontSize: 12 }}>
                    {b.done}/{b.total} done
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 5, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${b.pct}%`, background: b.color, borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={{ ...sectionTitle, marginBottom: 14 }}>Staff distribution by outlet</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {outletBreakdown.map((o) => (
              <div key={o.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>
                    {o.name} <span style={{ color: 'var(--dim)', fontWeight: 400 }}>· {o.location}</span>
                  </span>
                  <span style={{ ...mono, color: 'var(--dim)', fontSize: 12 }}>
                    {o.staff} staff · {o.brands} brands
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 5, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${o.pct}%`, background: 'var(--accent)', borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AttentionRow({
  dot,
  title,
  sub,
  date,
  dateColor,
  onClick,
}: {
  dot: string
  title: string
  sub: string
  date: string
  dateColor: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        width: '100%',
        textAlign: 'left',
        color: 'var(--text)',
        border: '1px solid var(--border)',
        background: 'var(--surface2)',
        borderRadius: 9,
        padding: '10px 12px',
        cursor: 'pointer',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{sub}</div>
      </div>
      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, fontWeight: 600, color: dateColor, whiteSpace: 'nowrap' }}>{date}</span>
    </button>
  )
}
```

- [ ] **Step 2: Verify the build type-checks**

Run: `npm run build`
Expected: PASS (no unused imports — `isOverdue`/`visitStatus`/`visitComplete`/`visitVM` are gone; `fmt`/`brandById`/`useDashboardSummary` are used).

- [ ] **Step 3: Run the test suite**

Run: `npm test`
Expected: PASS (58 + dashboardSummary tests).

- [ ] **Step 4: Commit**

```bash
git add src/screens/Dashboard.tsx
git commit -m "feat: Dashboard reads dashboard_summary RPC instead of data.visits

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Migrate the overdue badge (Sidebar + BottomNav)

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/BottomNav.tsx`

**Interfaces:**
- Consumes (Task 3): `useOverdueCount`.

Both currently compute `data.visits.filter(isOverdue).length`. After this task neither imports `useData` or `isOverdue`. Verify with `npm run build`.

- [ ] **Step 1: Edit `Sidebar.tsx`**

In `src/components/Sidebar.tsx`, replace the top imports:

```ts
import { useStore } from '../data/store'
import { useSession } from '../auth/AuthProvider'
import { useOverdueCount } from '../data/queries/useOverdueCount'
import { NAV } from '../data/nav'
import { Icon } from './Icon'
```

(removed `useData` and `isOverdue`). Then replace the body's data line:

```ts
  const { state, go } = useStore()
  const { session, signOut } = useSession()
  const overdueCount = useOverdueCount()
```

(removed `const { data } = useData()` and the `data.visits.filter(isOverdue)` line).

- [ ] **Step 2: Edit `BottomNav.tsx`**

In `src/components/BottomNav.tsx`, replace the top imports:

```ts
import { useStore } from '../data/store'
import { useOverdueCount } from '../data/queries/useOverdueCount'
import { NAV } from '../data/nav'
import { Icon } from './Icon'
```

Then replace the body's first lines:

```ts
  const { state, go } = useStore()
  const overdueCount = useOverdueCount()
```

(removed `const { data } = useData()` and the `data.visits.filter(isOverdue)` line).

- [ ] **Step 3: Verify the build type-checks**

Run: `npm run build`
Expected: PASS (no unused `useData`/`isOverdue`).

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/components/BottomNav.tsx
git commit -m "feat: nav overdue badge uses useOverdueCount RPC

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Migrate the visit drawer to a single-visit fetch

**Files:**
- Modify: `src/components/VisitDrawer.tsx:30-33`

**Interfaces:**
- Consumes (Task 3): `useVisit`.

The drawer currently does `const openF = S.openVisitId ? data.visits.find((f) => f.id === S.openVisitId) : null`. It still needs `useData()` for `data.brands/outlets/stores/staff` lookups — keep that. Verify with `npm run build`.

- [ ] **Step 1: Add the import**

In `src/components/VisitDrawer.tsx`, add to the imports (after the `useData` import line):

```ts
import { useVisit } from '../data/queries/useVisit'
```

- [ ] **Step 2: Replace the open-visit lookup**

Find (around lines 30–33):

```ts
  const { data } = useData()
  const S = state
  const openF = S.openVisitId ? data.visits.find((f) => f.id === S.openVisitId) : null
  if (!openF) return null
```

Replace with:

```ts
  const { data } = useData()
  const { visit: openF } = useVisit(state.openVisitId)
  const S = state
  if (!openF) return null
```

(The drawer is mounted with `key={state.openVisitId}` in `App.tsx`, so the hook re-mounts per opened visit. While loading, `openF` is null and the drawer renders nothing — same as today when no visit is open.)

- [ ] **Step 3: Verify the build type-checks**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/VisitDrawer.tsx
git commit -m "feat: VisitDrawer fetches the open visit by id

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Migrate the add-task modal + drop eligibleVisitsForLabel

**Files:**
- Modify: `src/components/AddTaskToVisitsModal.tsx`
- Modify: `src/data/queries/visitEdit.ts`
- Modify: `src/data/queries/visitEdit.test.ts`

**Interfaces:**
- Consumes (Task 3): `useVisitsMissingLabel`.

The modal currently builds `eligible` from `eligibleVisitsForLabel(data.visits, label)` and renders each via `visitVM(data, v)`. Replace with the RPC-backed hook returning light rows, and delete the now-dead helper + its tests.

- [ ] **Step 1: Remove `eligibleVisitsForLabel` from `visitEdit.ts`**

In `src/data/queries/visitEdit.ts`, change the import on line 1 to (drop the unused `Visit`):

```ts
import type { TaskStatus } from '../model'
```

Then delete the entire `eligibleVisitsForLabel` function (the block starting `/** Visits whose checklist…` through its closing brace). Keep `taskHasResult` and `importableTemplates`.

- [ ] **Step 2: Remove its tests from `visitEdit.test.ts`**

In `src/data/queries/visitEdit.test.ts`, change the import on line 2 to:

```ts
import { taskHasResult, importableTemplates } from './visitEdit'
```

Remove the now-unused `import type { Visit } from '../model'` line (line 3) and delete the entire `describe('eligibleVisitsForLabel', …)` block (lines 50–78).

- [ ] **Step 3: Run the trimmed test file to confirm it passes**

Run: `npx vitest run src/data/queries/visitEdit.test.ts`
Expected: PASS (`taskHasResult` + `importableTemplates` only).

- [ ] **Step 4: Rewrite the modal to use the hook**

Overwrite `src/components/AddTaskToVisitsModal.tsx` with:

```tsx
import { useState } from 'react'
import { useStore } from '../data/store'
import { fmt } from '../data/derived'
import { useVisitsMissingLabel } from '../data/queries/useVisitsMissingLabel'
import { useAddTaskToVisits } from '../data/queries/useVisitMutations'
import { Icon } from './Icon'

/** Adds a single task template into multiple existing visits that don't have it yet. */
export function AddTaskToVisitsModal({ label, onClose }: { label: string; onClose: () => void }) {
  const { state } = useStore()
  const { visits: eligible, isLoading } = useVisitsMissingLabel(label)
  const addToVisits = useAddTaskToVisits()
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const allSelected = eligible.length > 0 && eligible.every((v) => selectedIds.includes(v.id))
  const toggle = (id: string) =>
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const toggleAll = () => setSelectedIds(allSelected ? [] : eligible.map((v) => v.id))

  const submit = () => {
    if (!selectedIds.length) return
    addToVisits.mutate(
      { label, visitIds: selectedIds },
      { onSuccess: onClose, onError: (e) => alert(e.message) },
    )
  }

  const ovPos = state.isMobile ? 'absolute' : 'fixed'

  const checkbox = (checked: boolean) => (
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: 5,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
        background: checked ? 'var(--accent)' : 'transparent',
      }}
    >
      {checked && <Icon name="check" size={14} color="#fff" />}
    </span>
  )

  return (
    <div
      onClick={onClose}
      style={{ position: ovPos, inset: 0, zIndex: 70, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          borderRadius: 14,
          boxShadow: '0 30px 80px rgba(0,0,0,.3)',
          animation: 'pop .18s ease',
        }}
      >
        {/* header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Add task to visits</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
              Add “{label}” to existing visits that don’t have it yet
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <Icon name="close" size={22} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '16px 22px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isLoading ? (
            <div style={{ fontSize: 13.5, color: 'var(--dim)', padding: '6px 2px' }}>Loading…</div>
          ) : eligible.length === 0 ? (
            <div style={{ fontSize: 13.5, color: 'var(--dim)', padding: '6px 2px', lineHeight: 1.5 }}>
              All visits already have this task — nothing to add.
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleAll}
                style={{ display: 'flex', alignItems: 'center', gap: 12, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}
              >
                {checkbox(allSelected)}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Select all ({eligible.length})
                </span>
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {eligible.map((v) => {
                  const checked = selectedIds.includes(v.id)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggle(v.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        border: '1px solid var(--border)',
                        background: 'var(--surface2)',
                        borderRadius: 9,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {checkbox(checked)}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                          {v.brandName} · {v.outletName}
                        </span>
                        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>
                          {fmt(v.date)} · {v.staffName ?? 'Unassigned'}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={submit}
            disabled={selectedIds.length === 0 || addToVisits.isPending}
            style={{
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 8,
              padding: '9px 18px',
              fontFamily: "'IBM Plex Sans'",
              fontSize: 13,
              fontWeight: 600,
              cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedIds.length === 0 ? 0.5 : 1,
            }}
          >
            Add to {selectedIds.length || ''} visit{selectedIds.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify the build type-checks**

Run: `npm run build`
Expected: PASS (no unused `useData`/`visitVM`/`eligibleVisitsForLabel`).

- [ ] **Step 6: Run the test suite**

Run: `npm test`
Expected: PASS (the `eligibleVisitsForLabel` block is gone; everything else passes).

- [ ] **Step 7: Commit**

```bash
git add src/components/AddTaskToVisitsModal.tsx src/data/queries/visitEdit.ts src/data/queries/visitEdit.test.ts
git commit -m "feat: add-task modal uses visits_missing_label RPC; drop eligibleVisitsForLabel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Remove the global visits fetch from useData

**Files:**
- Modify: `src/data/queries/useData.ts`

**Interfaces:**
- Produces: `DataSnapshot` no longer has a `visits` field; `fetchVisits` is deleted.

By now nothing references `data.visits`. This task removes the query, the fetch, the `Visit` import, and the `visits` field. The strict build is the safety net — if any reference remains, it fails here.

- [ ] **Step 1: Edit `useData.ts`**

In `src/data/queries/useData.ts`:

1. Change the model import (line 3) to drop `Visit`:

```ts
import type { Brand, Outlet, Staff, Store, TaskTemplate } from '../model'
```

2. Change the mappers import (line 4) to drop `rowToVisit`:

```ts
import { rowToStaff, rowToStore, rowToTaskTemplate } from './mappers'
```

3. Remove `visits: Visit[]` from the `DataSnapshot` interface.

4. Delete the entire `fetchVisits` function (lines 43–50).

5. In `useData()`, delete the `visits` `useQuery` line, remove `visits` from the `queries` array, and remove `visits: visits.data ?? []` from the returned `data` object.

The result:

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Brand, Outlet, Staff, Store, TaskTemplate } from '../model'
import { rowToStaff, rowToStore, rowToTaskTemplate } from './mappers'
import { queryKeys } from './keys'

export interface DataSnapshot {
  brands: Brand[]
  outlets: Outlet[]
  stores: Store[]
  staff: Staff[]
  taskTemplates: TaskTemplate[]
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

async function fetchTaskTemplates(): Promise<TaskTemplate[]> {
  const { data, error } = await supabase.from('task_templates').select('*').order('sort')
  if (error) throw error
  return data.map(rowToTaskTemplate)
}

export function useData(): { data: DataSnapshot; isLoading: boolean; isError: boolean } {
  const brands = useQuery({ queryKey: queryKeys.brands, queryFn: fetchBrands })
  const outlets = useQuery({ queryKey: queryKeys.outlets, queryFn: fetchOutlets })
  const stores = useQuery({ queryKey: queryKeys.stores, queryFn: fetchStores })
  const staff = useQuery({ queryKey: queryKeys.staff, queryFn: fetchStaff })
  const taskTemplates = useQuery({ queryKey: queryKeys.taskTemplates, queryFn: fetchTaskTemplates })

  const queries = [brands, outlets, stores, staff, taskTemplates]
  return {
    data: {
      brands: brands.data ?? [],
      outlets: outlets.data ?? [],
      stores: stores.data ?? [],
      staff: staff.data ?? [],
      taskTemplates: taskTemplates.data ?? [],
    },
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
  }
}
```

- [ ] **Step 2: Verify the build type-checks**

Run: `npm run build`
Expected: PASS — if any file still reads `data.visits`, this fails with a type error naming it. Fix that file (it should already be migrated) before proceeding.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/queries/useData.ts
git commit -m "refactor: remove global visits fetch from useData

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- `dashboard_summary` + `visits_missing_label` RPCs → Task 1. ✓
- Mapper/types (`mapDashboardSummary`, `mapMissingLabelVisit`) → Task 2. ✓
- Keys + hooks (`useDashboardSummary`, `useVisit`, `useOverdueCount`, `useVisitsMissingLabel`) → Task 3. ✓
- Dashboard migration (KPIs/12-month trend/brand breakdown/attention lists, loading+error) → Task 4. ✓
- Overdue badge → Task 5. ✓
- Visit drawer single-fetch → Task 6. ✓
- Add-task modal + remove `eligibleVisitsForLabel` (+ tests) → Task 7. ✓
- Remove `visits` from `useData`/`DataSnapshot`/`fetchVisits` → Task 8. ✓
- RLS preserved via SECURITY INVOKER → Task 1. ✓
- New keys nested under `['visits']` → Task 3. ✓
- "done = base_status != pending" semantics → Task 1 SQL (`is_done`). ✓
- 12-month trend → Task 1 (`generate_series`) + Task 4 (`MONTHS`). ✓
- Attention lists capped + true totals (`overdue_total`) → Task 1 + Task 4 (badge uses `summary.overdueTotal`). ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step is complete. ✓

**Type consistency:** `DashboardSummary` fields (camelCase incl. `overdueTotal`/`upcomingTotal`) match Task 2 types and Task 4 usage; `DashboardParams` `{today,year,month,listLimit}` matches the Task 4 call and the `.rpc` arg names (`p_today/p_year/p_month/p_list_limit`); `visits_missing_label` columns (`id,date,brand_name,outlet_name,staff_name`) match `mapMissingLabelVisit`; `MissingLabelVisit` fields match the modal's `v.brandName/outletName/date/staffName` usage; `useVisit` returns `{ visit }` matching the drawer's `openF`. ✓

**Ordering safety:** Tasks 4–7 stop using `data.visits` while the field still exists (no build break); Task 8 removes it last, with the strict build as the catch-all. ✓
