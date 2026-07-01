# Dashboard Month + Year Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Dashboard's This-month/This-year toggle with Month + Year dropdowns (2026→current), regroup the cards into scope-labelled sections, and make the "Latest failed tasks" card respect the selected month.

**Architecture:** Filter state (`filterMonth`, `filterYear`) lives in local `useState` in `Dashboard.tsx`. A new pure helper `dashboardPeriod.ts` derives the RPC params and dropdown options. The existing `dashboard_summary` RPC is unchanged (it already accepts `p_month`/`p_year`); a new migration `0011` adds a `p_month` argument to `latest_failed_tasks`. Cards are grouped into four sections (Monthly / Current status / Yearly / Structure) each led by an accent-bar `SectionHeader`.

**Tech Stack:** React 18 + TypeScript + Vite, TanStack Query, Supabase (Postgres RPC), Vitest (node env, `src/**/*.test.ts`). All styling is inline `style={}` objects driven by CSS variables — no CSS framework.

## Global Constraints

- Build fails on unused locals/params (`tsconfig` `noUnusedLocals`/`noUnusedParameters`) — remove every symbol you orphan.
- Tests run in the `node` environment and only match `src/**/*.test.ts`; there are NO DOM/component tests. Only extract pure logic into `.test.ts`.
- All styling is inline `style={}` objects using CSS variables (`var(--accent)`, `var(--border)`, `var(--surface2)`, `var(--text)`, `var(--dim)`); no `.css`/`.module.css`.
- Year floor is **2026** (the app launched in 2026); no earlier year is selectable.
- Supabase migrations are applied **manually** in the Supabase SQL editor, in filename order. Ship migration `0011` **with or before** the frontend, or the Latest-failed-tasks card will error against the old zero-arg function.
- Commit message trailer for every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Work happens on branch `feat/dashboard-month-year-filter` (already created).

---

## File Structure

- **Create** `src/screens/dashboardPeriod.ts` — pure period helper: `periodParams()`, `yearOptions()`, `MONTH_NAMES`.
- **Create** `src/screens/dashboardPeriod.test.ts` — unit tests for the helper.
- **Create** `supabase/migrations/0011_latest_failed_tasks_by_month.sql` — adds `p_month` to `latest_failed_tasks`.
- **Modify** `src/data/queries/keys.ts` — `latestFailedTasks` becomes a function of `month`.
- **Modify** `src/data/queries/useLatestFailedTasks.ts` — accept `month`, pass `p_month`, key by month.
- **Modify** `src/screens/Dashboard.tsx` — filter state + dropdowns (Task 3), then scoped-section layout + `SectionHeader` (Task 4).
- **Modify** `src/data/store.tsx` — remove `period` / `setPeriod` / `Period` (Task 5).

---

## Task 1: Pure period helper (`dashboardPeriod.ts`)

**Files:**
- Create: `src/screens/dashboardPeriod.ts`
- Test: `src/screens/dashboardPeriod.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MONTH_NAMES: readonly string[]` — 12 full English month names, index 0 = January.
  - `periodParams(year: number, month: number): { month: string; year: string; label: string }` — `month` arg is 1–12; returns `{ month: 'YYYY-MM', year: 'YYYY', label: 'Month YYYY' }`.
  - `yearOptions(currentYear: number): number[]` — descending list from `currentYear` down to `2026` inclusive.

- [ ] **Step 1: Write the failing test**

Create `src/screens/dashboardPeriod.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { periodParams, yearOptions, MONTH_NAMES } from './dashboardPeriod'

describe('periodParams', () => {
  it('zero-pads the month and builds the label', () => {
    expect(periodParams(2026, 3)).toEqual({ month: '2026-03', year: '2026', label: 'March 2026' })
  })
  it('handles a two-digit month', () => {
    expect(periodParams(2026, 11)).toEqual({ month: '2026-11', year: '2026', label: 'November 2026' })
  })
  it('handles December (index boundary)', () => {
    expect(periodParams(2027, 12)).toEqual({ month: '2027-12', year: '2027', label: 'December 2027' })
  })
})

describe('yearOptions', () => {
  it('returns just 2026 in the launch year', () => {
    expect(yearOptions(2026)).toEqual([2026])
  })
  it('returns newest-first down to 2026', () => {
    expect(yearOptions(2028)).toEqual([2028, 2027, 2026])
  })
})

describe('MONTH_NAMES', () => {
  it('has 12 names starting at January', () => {
    expect(MONTH_NAMES).toHaveLength(12)
    expect(MONTH_NAMES[0]).toBe('January')
    expect(MONTH_NAMES[11]).toBe('December')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/dashboardPeriod.test.ts`
Expected: FAIL — cannot resolve `./dashboardPeriod` / functions not defined.

- [ ] **Step 3: Write minimal implementation**

Create `src/screens/dashboardPeriod.ts`:

```ts
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/** Lowest selectable year — the app launched in 2026. */
const START_YEAR = 2026

export interface PeriodParams {
  /** 'YYYY-MM' for the dashboard_summary p_month / latest_failed_tasks p_month args. */
  month: string
  /** 'YYYY' for the dashboard_summary p_year arg. */
  year: string
  /** Display label, e.g. 'March 2026'. */
  label: string
}

/** Build the RPC params + display label for a 1-based month within a year. */
export function periodParams(year: number, month: number): PeriodParams {
  const mm = String(month).padStart(2, '0')
  return {
    month: `${year}-${mm}`,
    year: String(year),
    label: `${MONTH_NAMES[month - 1]} ${year}`,
  }
}

/** Selectable years, newest first, from currentYear down to START_YEAR. */
export function yearOptions(currentYear: number): number[] {
  const out: number[] = []
  for (let y = currentYear; y >= START_YEAR; y--) out.push(y)
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/dashboardPeriod.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/screens/dashboardPeriod.ts src/screens/dashboardPeriod.test.ts
git commit -m "feat(dashboard): pure period helper (periodParams, yearOptions)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Migration — month-filtered `latest_failed_tasks`

**Files:**
- Create: `supabase/migrations/0011_latest_failed_tasks_by_month.sql`

**Interfaces:**
- Consumes: the `visit_with_status` view (from `0007`) and `visit_tasks` table.
- Produces: SQL function `latest_failed_tasks(p_month text) returns json`, granted to `authenticated`. Consumed by Task 3's `useLatestFailedTasks`.

**Note:** No automated test (SQL, applied manually). Verification is review of the SQL + manual apply in the Supabase SQL editor.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/0011_latest_failed_tasks_by_month.sql`:

```sql
-- 0011_latest_failed_tasks_by_month.sql
-- Adds a month filter to latest_failed_tasks so the Dashboard "Latest failed
-- tasks" card reflects the selected month + year. Per brand×outlet, returns
-- that pair's most recent COMPLETED visit (base_status 'attention' or 'done')
-- WITHIN p_month ('YYYY-MM'), together with that visit's failed tasks.
-- The signature changes (adds p_month), so drop the old zero-arg function first.
-- Builds on the 0007 visit_with_status view; security_invoker keeps the
-- owner_id = auth.uid() RLS in force.
-- Apply AFTER 0010_visit_brand_outlet_filter.sql in the Supabase SQL editor.

drop function if exists latest_failed_tasks();

create or replace function latest_failed_tasks(p_month text)
returns json
language sql stable as $$
  with completed as (
    select w.*,
      row_number() over (
        partition by w.brand_id, w.outlet_id
        order by w.date desc, w.id desc
      ) as rn
    from visit_with_status w
    where w.base_status in ('attention', 'done')
      and to_char(w.date, 'YYYY-MM') = p_month
  ),
  latest as (
    select * from completed where rn = 1
  ),
  with_tasks as (
    select
      l.brand_id,
      l.outlet_id,
      l.id,
      l.date,
      l.brand_name,
      l.outlet_name,
      l.staff_name,
      l.base_status,
      coalesce(
        (
          select json_agg(
            json_build_object('label', t.label, 'remark', t.remark)
            order by t.sort, t.label
          )
          from visit_tasks t
          where t.visit_id = l.id and t.status = 'failed'
        ),
        '[]'::json
      ) as failed
    from latest l
  )
  select coalesce(
    json_agg(
      json_build_object(
        'brand_id',    brand_id,
        'outlet_id',   outlet_id,
        'id',          id,
        'date',        date,
        'brand_name',  brand_name,
        'outlet_name', outlet_name,
        'staff_name',  staff_name,
        'base_status', base_status,
        'failed',      failed
      )
      order by brand_name, outlet_name
    ),
    '[]'::json
  )
  from with_tasks;
$$;

grant execute on function latest_failed_tasks(text) to authenticated;
```

- [ ] **Step 2: Apply the migration in Supabase**

Open the Supabase SQL editor and run the full contents of `0011_latest_failed_tasks_by_month.sql`.
Expected: `DROP FUNCTION` (or "does not exist, skipping"), `CREATE FUNCTION`, `GRANT` all succeed.

Sanity check (replace with a month that has data):
Run: `select latest_failed_tasks('2026-03');`
Expected: a JSON array (possibly `[]`), no error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_latest_failed_tasks_by_month.sql
git commit -m "feat(db): month filter for latest_failed_tasks (migration 0011)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Frontend data wiring — dropdowns + month-filtered failed tasks

Delivers working arbitrary-month filtering. Layout regrouping is Task 4.

**Files:**
- Modify: `src/data/queries/keys.ts:12`
- Modify: `src/data/queries/useLatestFailedTasks.ts:6-19`
- Modify: `src/screens/Dashboard.tsx` (imports; component top `25-49`; toggle block `152-164`)

**Interfaces:**
- Consumes: `periodParams`, `yearOptions`, `MONTH_NAMES` from `./dashboardPeriod` (Task 1); `latest_failed_tasks(p_month)` RPC (Task 2).
- Produces: `useLatestFailedTasks(month: string)` and `queryKeys.latestFailedTasks(month: string)` — both now require a month argument.

- [ ] **Step 1: Key `latestFailedTasks` by month**

In `src/data/queries/keys.ts`, replace line 12:

```ts
  latestFailedTasks: ['visits', 'latestFailed'] as const,
```

with:

```ts
  latestFailedTasks: (month: string) => ['visits', 'latestFailed', month] as const,
```

- [ ] **Step 2: Make `useLatestFailedTasks` take a month**

Replace the body of `src/data/queries/useLatestFailedTasks.ts` (lines 6-19) with:

```ts
export function useLatestFailedTasks(month: string): {
  rows: LatestFailedVisit[]
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: queryKeys.latestFailedTasks(month),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('latest_failed_tasks', { p_month: month })
      if (error) throw error
      return mapLatestFailedTasks(data)
    },
  })
  return { rows: query.data ?? [], isLoading: query.isLoading, isError: query.isError }
}
```

- [ ] **Step 3: Update Dashboard imports**

In `src/screens/Dashboard.tsx`:

Add a React import at the top of the file (above the existing `import { useStore }` line):

```ts
import { useState } from 'react'
```

Add the helper import (below the existing `import { Icon }` line at line 10):

```ts
import { periodParams, yearOptions, MONTH_NAMES } from './dashboardPeriod'
```

Remove `periodBtn` from the theme import (line 7). Change:

```ts
import { card, mono, periodBtn, pill, tint } from '../theme'
```

to:

```ts
import { card, mono, pill, tint } from '../theme'
```

- [ ] **Step 4: Add the module-scope select style**

In `src/screens/Dashboard.tsx`, immediately after the `CARD_IDS` array (ends line 22), add:

```ts
const selectStyle = {
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  borderRadius: 8,
  padding: '6px 9px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--text)',
  cursor: 'pointer',
} as const
```

- [ ] **Step 5: Rework the component's derived state**

In `src/screens/Dashboard.tsx`, change the destructure on line 25 from:

```ts
  const { state, setPeriod, openVisit } = useStore()
  const { data } = useData()
  const S = state
```

to:

```ts
  const { state, openVisit } = useStore()
  const { data } = useData()
```

Then replace lines 29-49 (from `const t = today()` through the `compRate` line) with:

```ts
  const t = today()
  const todayStr = localDateStr(t)
  const [filterYear, setFilterYear] = useState(t.getFullYear())
  const [filterMonth, setFilterMonth] = useState(t.getMonth() + 1)
  const { month: mo, year: yr, label: periodLabel } = periodParams(filterYear, filterMonth)
  const years = yearOptions(t.getFullYear())

  const { summary, isLoading: sumLoading, isError: sumError } = useDashboardSummary({
    today: todayStr,
    year: yr,
    month: mo,
    listLimit: 20,
  })

  const { rows: latestFailed, isError: failedError } = useLatestFailedTasks(mo)

  const collapse = useCardCollapse(CARD_IDS)

  const kpiSrc = summary.kpisMonth
  const compRate = kpiSrc.total ? Math.round((kpiSrc.done / kpiSrc.total) * 100) : 0
```

(This removes `monthLabel`, `yearLabel`, `S`, and the `S.period` branch — all now unused.)

- [ ] **Step 6: Replace the toggle buttons with dropdowns**

In `src/screens/Dashboard.tsx`, replace the segmented-toggle `<div>` (lines 152-164, the block starting `<div style={{ display: 'inline-flex', ...` and ending after the two `<button>` lines) with:

```tsx
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <select
              aria-label="Month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              style={selectStyle}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              aria-label="Year"
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              style={selectStyle}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
```

The surrounding toolbar text (`Visit performance — {periodLabel}`) now reads e.g. "Visit performance — March 2026"; leave it for now (Task 4 restructures it).

- [ ] **Step 7: Type-check, build, and run tests**

Run: `npm run build`
Expected: PASS — no `noUnusedLocals` errors (confirms `periodBtn`, `monthLabel`, `yearLabel`, `S`, `setPeriod` are all gone from Dashboard).

Run: `npm test`
Expected: PASS (existing suites + Task 1's helper test).

- [ ] **Step 8: Manual smoke check**

Run: `npm run dev`, open the Dashboard.
Expected: Month + Year dropdowns render in place of the toggle; the Year dropdown lists 2026→current (newest first); changing Month/Year updates the KPI row and the "Latest failed tasks" card (they refetch); overdue/upcoming lists stay unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/data/queries/keys.ts src/data/queries/useLatestFailedTasks.ts src/screens/Dashboard.tsx
git commit -m "feat(dashboard): month+year dropdowns; filter latest failed tasks by month

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Frontend layout — scoped sections + `SectionHeader`

Regroups the cards into four scope-labelled sections. No data changes.

**Files:**
- Modify: `src/screens/Dashboard.tsx` (add `SectionHeader`; rewrite the `return (...)` structure)

**Interfaces:**
- Consumes: `periodLabel`, `yr`, `sumLoading`, `sumError`, `filterMonth`, `filterYear`, `setFilterMonth`, `setFilterYear`, `years`, `collapse`, `grid2` (all already in scope from Task 3); `MONTH_NAMES`, `selectStyle`.
- Produces: none (internal layout only).

- [ ] **Step 1: Add the `SectionHeader` component + scope colors**

In `src/screens/Dashboard.tsx`, add at module scope (e.g. directly below the `selectStyle` const from Task 3):

```tsx
type Scope = 'filtered' | 'live' | 'all'

const SCOPE_COLOR: Record<Scope, string> = {
  filtered: 'var(--accent)', // follows the filter
  live: '#2563eb',           // live / today (never red — red reads as an error)
  all: 'var(--border)',      // all-time
}

function SectionHeader({ scope, label, title }: { scope: Scope; label: string; title: string }) {
  const color = SCOPE_COLOR[scope]
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 11, margin: '10px 0 2px' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '.05em',
          textTransform: 'uppercase',
          color: scope === 'all' ? 'var(--dim)' : color,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite the return structure into four sections**

In `src/screens/Dashboard.tsx`, replace the entire `return (...)` JSX of the `Dashboard` component (the outer `<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>` … its matching close, currently lines 108-422) with the structure below.

**The card bodies are unchanged** — relocate each existing `CollapsibleCard`/grid block verbatim into its new slot (identify each by its `id=`). Only the wrapping order, the new filter bar, and the `SectionHeader`s change:

```tsx
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* masthead — existing stat strip, verbatim (current lines 111-134) */}
      {/* <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}> ... </div> */}

      {/* filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Filter</span>
        <select
          aria-label="Month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(Number(e.target.value))}
          style={selectStyle}
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          aria-label="Year"
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value))}
          style={selectStyle}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {sumLoading && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--dim)' }}>· loading…</span>}
        {sumError && <span style={{ fontSize: 12, fontWeight: 500, color: '#dc2626' }}>· couldn't load metrics</span>}
        <label
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--dim)',
            cursor: 'pointer',
          }}
        >
          <input type="checkbox" checked={collapse.allOpen} onChange={(e) => collapse.setAll(e.target.checked)} />
          Expand all
        </label>
      </div>

      {/* ── Monthly performance (month + year) ── */}
      <SectionHeader scope="filtered" label={`Filtered · ${periodLabel}`} title="Monthly performance" />
      {/* KPI row — existing block, verbatim (current lines 169-182) */}
      {/* Latest failed tasks — existing CollapsibleCard id="latestFailedTasks", verbatim (current lines 185-204) */}

      {/* ── Current status (live, today) ── */}
      <SectionHeader scope="live" label="Live · today" title="Current status" />
      {/* Overdue + Upcoming attention lists — existing block, verbatim (current lines 207-249) */}

      {/* ── Yearly overview (year only) ── */}
      <SectionHeader scope="filtered" label={`Filtered · year ${yr}`} title="Yearly overview" />
      <div style={grid2}>
        {/* Visits by month — existing CollapsibleCard id="trend", verbatim (current lines 254-300) */}
        {/* Visits by brand — existing CollapsibleCard id="visitsByBrand", verbatim (current lines 367-392) */}
      </div>

      {/* ── Structure (all-time) ── */}
      <SectionHeader scope="all" label="All-time" title="Structure" />
      <div style={grid2}>
        {/* Brand × Outlet coverage — existing CollapsibleCard id="matrix", verbatim (current lines 303-362) */}
        {/* Staff by outlet — existing CollapsibleCard id="staffByOutlet", verbatim (current lines 394-419) */}
      </div>
    </div>
  )
```

Notes for the move:
- The old toolbar (current lines 137-166 — the "Visit performance — …" text, Expand-all label, and the dropdown block from Task 3) is fully replaced by the new **filter bar** above; do not keep the old `Visit performance —` header line.
- The two old `grid2` wrappers (current 252 and 366) are reused, but the cards are **re-paired**: `trend` now sits with `visitsByBrand`, and `matrix` now sits with `staffByOutlet`.
- All cards keep `gridItem` and their existing `collapse` props unchanged.

- [ ] **Step 3: Type-check and build**

Run: `npm run build`
Expected: PASS — no unused-symbol errors, no missing references.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS (unchanged from Task 3).

- [ ] **Step 5: Manual layout check**

Run: `npm run dev`, open the Dashboard.
Expected, top-to-bottom: stat strip → filter bar (Month/Year + Expand all) → **FILTERED · {Month Year}** (accent bar) over KPI row + Latest failed tasks → **LIVE · TODAY** (blue bar) over Overdue + Upcoming → **FILTERED · YEAR {year}** (accent bar) over trend + Visits-by-brand → **ALL-TIME** (grey bar) over coverage matrix + Staff-by-outlet. Changing Month updates only the two "Filtered · month" cards; changing Year updates those plus the Yearly section; the Live and All-time sections never move.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Dashboard.tsx
git commit -m "feat(dashboard): group cards into scoped sections with accent-bar headers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Remove dead `period` state from the store

**Files:**
- Modify: `src/data/store.tsx` (lines 14, 39, 65, 87, 124)

**Interfaces:**
- Consumes: nothing.
- Produces: none — pure cleanup. No consumer of `period`/`setPeriod` remains after Task 3.

- [ ] **Step 1: Delete the `Period` type**

In `src/data/store.tsx`, delete line 14:

```ts
export type Period = 'month' | 'year'
```

- [ ] **Step 2: Delete the `period` field from `AppState`**

Delete line 39 inside the `AppState` interface:

```ts
  period: Period
```

- [ ] **Step 3: Delete the `period` default from `seed()`**

Delete line 65 inside `seed()`:

```ts
    period: 'month',
```

- [ ] **Step 4: Delete the `setPeriod` action declaration**

Delete line 87 inside `StoreActions`:

```ts
  setPeriod(p: Period): void
```

- [ ] **Step 5: Delete the `setPeriod` action implementation**

Delete line 124 inside the actions object:

```ts
      setPeriod: (period) => patch({ period }),
```

- [ ] **Step 6: Type-check, build, and test**

Run: `npm run build`
Expected: PASS — confirms no remaining references to `period` / `setPeriod` / `Period` anywhere.

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data/store.tsx
git commit -m "refactor(store): drop unused period/setPeriod view state

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Month + Year dropdowns, floor 2026, newest-first → Task 1 (`yearOptions`) + Task 3 (dropdowns). ✅
- State moved to local `useState`; `period`/`setPeriod`/`Period` removed → Task 3 (add local state) + Task 5 (remove store). ✅
- Two filter tiers (KPI + failed tasks = month; trend + brand = year) → Task 3 wiring (`kpisMonth`, `mo` to failed tasks; `yr`/`mo` to summary) + Task 4 grouping. ✅
- Four labelled sections, Style D headers, indigo/blue/grey, no red → Task 4 (`SectionHeader`, `SCOPE_COLOR`). ✅
- `dashboard_summary` unchanged, fed selected values; `p_today` stays real today → Task 3 Step 5 (keeps `todayStr` from `today()`). ✅
- New migration `0011` adds `p_month` to `latest_failed_tasks` (drop+recreate, re-grant) → Task 2. ✅
- Pure helper with `.test.ts` (`periodParams`, `yearOptions`) → Task 1. ✅
- Migration ships with/before frontend → Global Constraints + Task 2 ordering. ✅
- Trend "selected month outlined" was a spec *nice-to-have*; intentionally omitted to keep scope tight (YAGNI). Not a gap.

**2. Placeholder scan:** No "TBD/TODO/handle edge cases". The `{/* … verbatim (current lines X-Y) */}` markers in Task 4 point to concrete existing code in the file being edited (identified by `id=`), not to unwritten code — acceptable, since reproducing ~150 lines of unchanged card markup verbatim would add transcription risk without adding information.

**3. Type consistency:** `periodParams` returns `{ month, year, label }` — consumed as `{ month: mo, year: yr, label: periodLabel }` in Task 3. `useLatestFailedTasks(month: string)` (Task 3 Step 2) matches its call `useLatestFailedTasks(mo)` (Task 3 Step 5). `queryKeys.latestFailedTasks(month)` function form (Task 3 Step 1) matches its use in the hook. `latest_failed_tasks(p_month text)` (Task 2) matches the `{ p_month: month }` RPC arg (Task 3 Step 2). `Scope`/`SCOPE_COLOR` keys (`filtered`/`live`/`all`) match every `SectionHeader` `scope=` usage (Task 4 Step 2). Consistent. ✅
