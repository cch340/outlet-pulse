# Dashboard Collapsible Cards + Latest Failed Tasks Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Dashboard's large cards individually collapsible (default collapsed, "Expand all" toggle, state persisted), and add a new full-width "Latest failed tasks" card summarizing each brand×outlet's most recent completed visit.

**Architecture:** A pure `localStorage`-backed collapse-state module (`cardCollapse.ts`) plus a thin React hook (`useCardCollapse`) drive a presentational `CollapsibleCard` wrapper. The new card is fed by a `security_invoker` SQL RPC `latest_failed_tasks()` (migration `0009`), surfaced through the established `keys → mapper → hook` pattern; "No visit yet" rows are computed client-side by merging the RPC result against `data.stores`.

**Tech Stack:** React 18 + TypeScript + Vite, React Query (`@tanstack/react-query`), Supabase RPC, Vitest (node env), inline styles via CSS variables (`src/theme.ts`).

## Global Constraints

- All styling is inline `style={}` objects driven by CSS variables / `src/theme.ts` tokens (`card`, `mono`, `tint`, `pill`). No CSS framework, no `.module.css`.
- DB rows are snake_case; convert to camelCase domain model via mappers in `src/data/queries/`. Never pass raw rows around.
- Build fails on unused locals/params (`noUnusedLocals`/`noUnusedParameters`). Remove anything unused.
- Tests run in `node` env and match only `src/**/*.test.ts`. No DOM/component tests — extract logic into pure modules and test those.
- When changing what's fetched, update `keys.ts`, the query hook, the mapper, and the model type together.
- SQL migrations are applied manually in order via the Supabase SQL editor; new migration must note "Apply AFTER 0008".
- Run the full check with `npm test` (vitest) and `npm run build` (tsc + vite build). Run a single test file with `npx vitest run <path>`.
- Git commit author email: cch340@gmail.com. End commit messages with the Co-Authored-By trailer used in this repo.

---

### Task 1: `latest_failed_tasks()` SQL migration

**Files:**
- Create: `supabase/migrations/0009_latest_failed_tasks.sql`

**Interfaces:**
- Consumes: existing `visit_with_status` view (from `0007`) and `visit_tasks` table (columns `visit_id`, `label`, `status`, `remark`, `sort`).
- Produces: SQL function `latest_failed_tasks()` returning a JSON array; each element is
  `{ brand_id, outlet_id, id, date, brand_name, outlet_name, staff_name, base_status, failed: [{ label, remark }] }`
  where `base_status` is `'attention'` or `'done'`. Consumed by Task 3's hook/mapper.

This task has no automated test (SQL migrations in this repo are applied manually and are not unit-tested). The deliverable is the migration file; it is verified by code review and by Task 3's mapper tests exercising the shape it documents.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0009_latest_failed_tasks.sql`:

```sql
-- 0009_latest_failed_tasks.sql
-- Dashboard "Latest failed tasks" card. A security_invoker function returning,
-- per brand×outlet, that pair's most recent COMPLETED visit (base_status
-- 'attention' or 'done' — i.e. has tasks and no pending ones) together with the
-- failed tasks (label + remark) on that visit. Brand×outlets with no completed
-- visit are omitted here; the client fills them in as "No visit yet".
-- Builds on the 0007 visit_with_status view; security_invoker keeps the
-- owner_id = auth.uid() RLS in force.
-- Apply AFTER 0008_dashboard_and_lookups.sql in the Supabase SQL editor.

create or replace function latest_failed_tasks()
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

grant execute on function latest_failed_tasks() to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0009_latest_failed_tasks.sql
git commit -m "feat(db): latest_failed_tasks RPC for dashboard card

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Model + mapper for latest failed tasks

**Files:**
- Modify: `src/data/queries/dashboardSummary.ts`
- Test: `src/data/queries/dashboardSummary.test.ts`

**Interfaces:**
- Consumes: the JSON array shape produced by Task 1.
- Produces:
  - `interface FailedTask { label: string; remark: string }`
  - `interface LatestFailedVisit { brandId: string; outletId: string; visitId: string; date: string; brandName: string; outletName: string; staffName: string | null; status: 'attention' | 'done'; failed: FailedTask[] }`
  - `function mapLatestFailedTasks(raw: unknown): LatestFailedVisit[]`
  Consumed by Task 3 (hook) and Task 5 (card).

- [ ] **Step 1: Write the failing tests**

Append to `src/data/queries/dashboardSummary.test.ts`:

```ts
import { mapLatestFailedTasks } from './dashboardSummary'

describe('mapLatestFailedTasks', () => {
  it('maps an attention visit with failed tasks (remarks preserved)', () => {
    const raw = [
      {
        brand_id: 'b1', outlet_id: 'o1', id: 'v1', date: '2026-06-01',
        brand_name: 'Acme', outlet_name: 'Mall', staff_name: 'Sam',
        base_status: 'attention',
        failed: [
          { label: 'Fridge temp', remark: 'too warm' },
          { label: 'Shelf tidy', remark: '' },
        ],
      },
    ]
    expect(mapLatestFailedTasks(raw)).toEqual([
      {
        brandId: 'b1', outletId: 'o1', visitId: 'v1', date: '2026-06-01',
        brandName: 'Acme', outletName: 'Mall', staffName: 'Sam',
        status: 'attention',
        failed: [
          { label: 'Fridge temp', remark: 'too warm' },
          { label: 'Shelf tidy', remark: '' },
        ],
      },
    ])
  })

  it('maps an all-success (done) visit with empty failed list and null staff', () => {
    const raw = [
      {
        brand_id: 'b2', outlet_id: 'o2', id: 'v2', date: '2026-06-02',
        brand_name: 'Beta', outlet_name: 'Plaza', staff_name: null,
        base_status: 'done', failed: [],
      },
    ]
    expect(mapLatestFailedTasks(raw)).toEqual([
      {
        brandId: 'b2', outletId: 'o2', visitId: 'v2', date: '2026-06-02',
        brandName: 'Beta', outletName: 'Plaza', staffName: null,
        status: 'done', failed: [],
      },
    ])
  })

  it('coerces missing remark/failed/staff to defaults and non-array input to []', () => {
    expect(mapLatestFailedTasks(null)).toEqual([])
    expect(mapLatestFailedTasks(undefined)).toEqual([])
    const r = mapLatestFailedTasks([
      { brand_id: 'b', outlet_id: 'o', id: 'v', date: '2026-06-03',
        brand_name: 'B', outlet_name: 'O', base_status: 'attention',
        failed: [{ label: 'X' }] },
    ])
    expect(r[0].staffName).toBeNull()
    expect(r[0].failed).toEqual([{ label: 'X', remark: '' }])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/queries/dashboardSummary.test.ts`
Expected: FAIL — `mapLatestFailedTasks is not a function` (not exported yet).

- [ ] **Step 3: Implement the model + mapper**

Append to `src/data/queries/dashboardSummary.ts` (the file already declares `type Raw = any` and `const num`; reuse them — do NOT redeclare):

```ts
export interface FailedTask {
  label: string
  remark: string
}
export interface LatestFailedVisit {
  brandId: string
  outletId: string
  visitId: string
  date: string
  brandName: string
  outletName: string
  staffName: string | null
  status: 'attention' | 'done'
  failed: FailedTask[]
}

export function mapLatestFailedTasks(raw: Raw): LatestFailedVisit[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x: Raw) => ({
    brandId: x.brand_id,
    outletId: x.outlet_id,
    visitId: x.id,
    date: x.date,
    brandName: x.brand_name,
    outletName: x.outlet_name,
    staffName: x.staff_name ?? null,
    status: x.base_status,
    failed: Array.isArray(x.failed)
      ? x.failed.map((t: Raw) => ({ label: t.label, remark: t.remark ?? '' }))
      : [],
  }))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/data/queries/dashboardSummary.test.ts`
Expected: PASS (all `mapLatestFailedTasks` cases plus the pre-existing `mapDashboardSummary` tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/queries/dashboardSummary.ts src/data/queries/dashboardSummary.test.ts
git commit -m "feat: LatestFailedVisit model + mapLatestFailedTasks mapper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `useLatestFailedTasks` query hook + query key

**Files:**
- Modify: `src/data/queries/keys.ts`
- Create: `src/data/queries/useLatestFailedTasks.ts`

**Interfaces:**
- Consumes: `mapLatestFailedTasks` / `LatestFailedVisit` (Task 2); Supabase `rpc('latest_failed_tasks')` (Task 1).
- Produces: `function useLatestFailedTasks(): { rows: LatestFailedVisit[]; isLoading: boolean; isError: boolean }`. Consumed by Task 5.

No dedicated test — this hook is a thin React Query wrapper around the already-tested mapper (mirrors `useDashboardSummary`, which has no test). Verified by `npm run build` and by Task 5 wiring.

- [ ] **Step 1: Add the query key**

In `src/data/queries/keys.ts`, add a line inside the `queryKeys` object (after `visitsMissingLabel`):

```ts
  latestFailedTasks: ['visits', 'latestFailed'] as const,
```

- [ ] **Step 2: Create the hook**

Create `src/data/queries/useLatestFailedTasks.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import { mapLatestFailedTasks, type LatestFailedVisit } from './dashboardSummary'

export function useLatestFailedTasks(): {
  rows: LatestFailedVisit[]
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: queryKeys.latestFailedTasks,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('latest_failed_tasks')
      if (error) throw error
      return mapLatestFailedTasks(data)
    },
  })
  return { rows: query.data ?? [], isLoading: query.isLoading, isError: query.isError }
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc -b`
Expected: PASS (no type errors).

- [ ] **Step 4: Commit**

```bash
git add src/data/queries/keys.ts src/data/queries/useLatestFailedTasks.ts
git commit -m "feat: useLatestFailedTasks query hook + query key

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Collapse-state module + `useCardCollapse` hook

**Files:**
- Create: `src/data/cardCollapse.ts`
- Create: `src/data/useCardCollapse.ts`
- Test: `src/data/cardCollapse.test.ts`

**Interfaces:**
- Produces (pure module `cardCollapse.ts`):
  - `type CollapseState = Record<string, boolean>`
  - `function isOpen(state: CollapseState, id: string): boolean` — absent key ⇒ `false` (collapsed default).
  - `function toggle(state: CollapseState, id: string): CollapseState` — returns a new map with `id` flipped (absent ⇒ becomes `true`).
  - `function setAll(ids: string[], open: boolean): CollapseState` — every id mapped to `open`.
  - `function allOpen(state: CollapseState, ids: string[]): boolean` — true iff every id in `ids` is open.
  - `function parseState(raw: string | null): CollapseState` — JSON-parse localStorage value, `{}` on null/invalid.
  - `const STORAGE_KEY = 'dashboard.cardCollapse'`
- Produces (hook `useCardCollapse.ts`):
  - `function useCardCollapse(ids: string[]): { isOpen(id: string): boolean; toggle(id: string): void; setAll(open: boolean): void; allOpen: boolean }`
  Consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

Create `src/data/cardCollapse.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isOpen, toggle, setAll, allOpen, parseState } from './cardCollapse'

describe('cardCollapse', () => {
  it('treats an absent id as collapsed by default', () => {
    expect(isOpen({}, 'a')).toBe(false)
    expect(isOpen({ a: true }, 'a')).toBe(true)
    expect(isOpen({ a: false }, 'a')).toBe(false)
  })

  it('toggle flips a key and defaults absent keys to open', () => {
    expect(toggle({}, 'a')).toEqual({ a: true })
    expect(toggle({ a: true }, 'a')).toEqual({ a: false })
    expect(toggle({ a: false }, 'a')).toEqual({ a: true })
  })

  it('toggle does not mutate the input', () => {
    const s = { a: true }
    const next = toggle(s, 'a')
    expect(s).toEqual({ a: true })
    expect(next).toEqual({ a: false })
  })

  it('setAll maps every id to the given open value', () => {
    expect(setAll(['a', 'b'], true)).toEqual({ a: true, b: true })
    expect(setAll(['a', 'b'], false)).toEqual({ a: false, b: false })
  })

  it('allOpen is true only when every id is open', () => {
    expect(allOpen({ a: true, b: true }, ['a', 'b'])).toBe(true)
    expect(allOpen({ a: true, b: false }, ['a', 'b'])).toBe(false)
    expect(allOpen({ a: true }, ['a', 'b'])).toBe(false)
    expect(allOpen({}, [])).toBe(true)
  })

  it('parseState returns {} for null or invalid JSON, and the object otherwise', () => {
    expect(parseState(null)).toEqual({})
    expect(parseState('not json')).toEqual({})
    expect(parseState('{"a":true}')).toEqual({ a: true })
    expect(parseState('[1,2]')).toEqual({})
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/cardCollapse.test.ts`
Expected: FAIL — cannot find module `./cardCollapse`.

- [ ] **Step 3: Implement the pure module**

Create `src/data/cardCollapse.ts`:

```ts
export type CollapseState = Record<string, boolean>

export const STORAGE_KEY = 'dashboard.cardCollapse'

export function isOpen(state: CollapseState, id: string): boolean {
  return state[id] === true
}

export function toggle(state: CollapseState, id: string): CollapseState {
  return { ...state, [id]: !isOpen(state, id) }
}

export function setAll(ids: string[], open: boolean): CollapseState {
  const next: CollapseState = {}
  for (const id of ids) next[id] = open
  return next
}

export function allOpen(state: CollapseState, ids: string[]): boolean {
  return ids.every((id) => isOpen(state, id))
}

export function parseState(raw: string | null): CollapseState {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CollapseState
    }
    return {}
  } catch {
    return {}
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/data/cardCollapse.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Implement the React hook**

Create `src/data/useCardCollapse.ts`:

```ts
import { useState, useCallback } from 'react'
import {
  STORAGE_KEY,
  parseState,
  isOpen as isOpenPure,
  toggle as togglePure,
  setAll as setAllPure,
  allOpen as allOpenPure,
  type CollapseState,
} from './cardCollapse'

function read(): CollapseState {
  if (typeof localStorage === 'undefined') return {}
  return parseState(localStorage.getItem(STORAGE_KEY))
}

function persist(state: CollapseState): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useCardCollapse(ids: string[]): {
  isOpen: (id: string) => boolean
  toggle: (id: string) => void
  setAll: (open: boolean) => void
  allOpen: boolean
} {
  const [state, setState] = useState<CollapseState>(read)

  const update = useCallback((next: CollapseState) => {
    setState(next)
    persist(next)
  }, [])

  const toggle = useCallback((id: string) => update(togglePure(read(), id)), [update])
  const setAll = useCallback((open: boolean) => update(setAllPure(ids, open)), [ids, update])

  return {
    isOpen: (id: string) => isOpenPure(state, id),
    toggle,
    setAll,
    allOpen: allOpenPure(state, ids),
  }
}
```

Note: `toggle` reads fresh from storage before flipping so concurrent card toggles don't clobber each other's keys.

- [ ] **Step 6: Verify type-check and tests still pass**

Run: `npx tsc -b && npx vitest run src/data/cardCollapse.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data/cardCollapse.ts src/data/cardCollapse.test.ts src/data/useCardCollapse.ts
git commit -m "feat: card collapse state module + useCardCollapse hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `CollapsibleCard` component

**Files:**
- Create: `src/components/CollapsibleCard.tsx`

**Interfaces:**
- Consumes: `card`, `tint` from `src/theme.ts`; `Icon` from `src/components/Icon.tsx`.
- Produces: default-exported-as-named component
  `function CollapsibleCard(props: { id: string; title: string; open: boolean; onToggle: (id: string) => void; icon?: string; iconColor?: string; accessory?: ReactNode; children: ReactNode }): JSX.Element`
  Consumed by Task 6.

No dedicated test (presentational component; repo has no DOM tests). Verified by `npm run build` and Task 6 wiring.

- [ ] **Step 1: Create the component**

Create `src/components/CollapsibleCard.tsx`:

```tsx
import type { ReactNode } from 'react'
import { card } from '../theme'
import { Icon } from './Icon'

export function CollapsibleCard({
  id,
  title,
  open,
  onToggle,
  icon,
  iconColor,
  accessory,
  children,
}: {
  id: string
  title: string
  open: boolean
  onToggle: (id: string) => void
  icon?: string
  iconColor?: string
  accessory?: ReactNode
  children: ReactNode
}) {
  return (
    <div style={{ ...card, padding: '16px 18px' }}>
      <button
        onClick={() => onToggle(id)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        {icon && <Icon name={icon} size={19} color={iconColor} />}
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        {accessory}
        <Icon
          name={open ? 'expand_less' : 'expand_more'}
          size={20}
          color="var(--dim)"
          style={{ marginLeft: 'auto' }}
        />
      </button>
      {open && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  )
}
```

Note: `accessory` (e.g. the trend legend or the overdue count badge) sits between the title and the chevron; the chevron is pushed right with `marginLeft: 'auto'`.

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/CollapsibleCard.tsx
git commit -m "feat: CollapsibleCard wrapper component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Wire collapse + new card into Dashboard

**Files:**
- Modify: `src/screens/Dashboard.tsx`

**Interfaces:**
- Consumes: `useCardCollapse` (Task 4), `CollapsibleCard` (Task 5), `useLatestFailedTasks` + `LatestFailedVisit` (Tasks 2–3), `brandById`/`outletById`/`fmt` from `derived`, `pill`/`mono`/`tint` from `theme`, `openVisit` from `useStore`.
- Produces: the finished Dashboard screen. Terminal task.

This task changes a React screen with no unit test; verification is `npm run build` + `npm test` green, plus a manual dev-server check. Make the edits, then verify.

- [ ] **Step 1: Add imports**

In `src/screens/Dashboard.tsx`, update the import block at the top. Change line 4–5 region and add new imports so the head reads:

```tsx
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useDashboardSummary } from '../data/queries/useDashboardSummary'
import { useLatestFailedTasks } from '../data/queries/useLatestFailedTasks'
import type { LatestFailedVisit } from '../data/queries/dashboardSummary'
import { linked, staffCount, today, fmt, localDateStr, brandById, outletById } from '../data/derived'
import { card, mono, periodBtn, pill, tint } from '../theme'
import { useCardCollapse } from '../data/useCardCollapse'
import { CollapsibleCard } from '../components/CollapsibleCard'
import { Icon } from '../components/Icon'
```

- [ ] **Step 2: Declare card ids and collapse hook + fetch latest failed tasks**

Inside `Dashboard()`, after the existing `const { summary, ... } = useDashboardSummary(...)` block (around line 27), add:

```tsx
  const { rows: latestFailed } = useLatestFailedTasks()

  const CARD_IDS = [
    'latestFailedTasks',
    'overdue',
    'upcoming',
    'trend',
    'matrix',
    'visitsByBrand',
    'staffByOutlet',
  ]
  const collapse = useCardCollapse(CARD_IDS)
```

- [ ] **Step 3: Build the merged "latest failed" list (brand×outlet, sorted by brand)**

Still inside `Dashboard()`, after the existing `outletBreakdown` block (around line 66), add:

```tsx
  const latestByStore = new Map<string, LatestFailedVisit>(
    latestFailed.map((r) => [`${r.brandId}:${r.outletId}`, r]),
  )
  const failedRows = data.stores
    .map((s) => {
      const brand = brandById(data, s.brandId)
      const outlet = outletById(data, s.outletId)
      return {
        key: `${s.brandId}:${s.outletId}`,
        brandName: brand.name,
        brandColor: brand.color,
        outletName: outlet.name,
        visit: latestByStore.get(`${s.brandId}:${s.outletId}`) ?? null,
      }
    })
    .sort((a, b) => a.brandName.localeCompare(b.brandName) || a.outletName.localeCompare(b.outletName))
```

- [ ] **Step 4: Add the "Expand all" checkbox to the period-toggle header row**

Replace the `<div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)' }}>…</div>` block (currently lines ~104–108, the "Visit performance — …" label) so the label and an Expand-all checkbox sit together. Change that left-hand `<div>` to:

```tsx
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)' }}>
            Visit performance — {periodLabel}
            {sumLoading && <span style={{ marginLeft: 8, fontWeight: 500 }}>· loading…</span>}
            {sumError && <span style={{ marginLeft: 8, fontWeight: 500, color: '#dc2626' }}>· couldn't load metrics</span>}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={collapse.allOpen}
              onChange={(e) => collapse.setAll(e.target.checked)}
            />
            Expand all
          </label>
        </div>
```

- [ ] **Step 5: Insert the new "Latest failed tasks" card above the attention lists**

Immediately BEFORE the `{/* attention lists */}` comment/block (currently line ~140), insert:

```tsx
      {/* latest failed tasks */}
      <CollapsibleCard
        id="latestFailedTasks"
        title="Latest failed tasks by outlet"
        icon="rule"
        iconColor="#dc2626"
        open={collapse.isOpen('latestFailedTasks')}
        onToggle={collapse.toggle}
      >
        {failedRows.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>No brand × outlet pairs yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {failedRows.map((row) => (
              <FailedRow key={row.key} row={row} onOpen={openVisit} />
            ))}
          </div>
        )}
      </CollapsibleCard>
```

- [ ] **Step 6: Convert each existing large card to `CollapsibleCard`**

Replace each large card's outer `<div style={{ ...card, padding: '16px 18px' }}>` with a `CollapsibleCard`, moving its title/legend into the header and leaving the body as children. Make these six edits:

**(a) Overdue visits** — replace the block currently at lines ~144–157. The title row had an icon, title, and a count badge; the badge becomes the `accessory`:

```tsx
            <CollapsibleCard
              id="overdue"
              title="Overdue visits"
              icon="warning"
              iconColor="#dc2626"
              accessory={
                <span style={{ ...mono, fontSize: 12, fontWeight: 600, background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '1px 8px' }}>
                  {summary.overdueTotal}
                </span>
              }
              open={collapse.isOpen('overdue')}
              onToggle={collapse.toggle}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {overdueList.map((f) => (
                  <AttentionRow key={f.id} dot="#dc2626" title={`${f.brandName} · ${f.outletName}`} sub={f.staffName ?? 'Unassigned'} date={fmt(f.date)} dateColor="#dc2626" onClick={() => openVisit(f.id)} />
                ))}
              </div>
            </CollapsibleCard>
```

**(b) Upcoming visits** — replace the block currently at lines ~160–170:

```tsx
            <CollapsibleCard
              id="upcoming"
              title="Upcoming visits"
              icon="event_upcoming"
              iconColor="#2563eb"
              open={collapse.isOpen('upcoming')}
              onToggle={collapse.toggle}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingList.map((f) => (
                  <AttentionRow key={f.id} dot="#2563eb" title={`${f.brandName} · ${f.outletName}`} sub={f.staffName ?? 'Unassigned'} date={fmt(f.date)} dateColor="var(--dim)" onClick={() => openVisit(f.id)} />
                ))}
              </div>
            </CollapsibleCard>
```

**(c) Visits by month (trend)** — replace the opening `<div style={{ ...card, padding: '16px 18px' }}>` and its title/legend header (lines ~178–189) with a `CollapsibleCard` open tag whose `accessory` is the Done/Open legend; keep the bar-chart body unchanged; close with `</CollapsibleCard>`:

```tsx
        <CollapsibleCard
          id="trend"
          title="Visits by month"
          open={collapse.isOpen('trend')}
          onToggle={collapse.toggle}
          accessory={
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--dim)', marginLeft: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--accent)' }} />Done
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: tint('var(--accent)', 22) }} />Open
              </span>
            </div>
          }
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 158, paddingTop: 18 }}>
            {/* ...existing mdata.map(...) bar chart, UNCHANGED... */}
          </div>
        </CollapsibleCard>
```

**(d) Brand × Outlet coverage (matrix)** — replace the opening card `<div>` and its title+subtitle (lines ~222–224). The subtitle stays as the first child inside the body:

```tsx
        <CollapsibleCard
          id="matrix"
          title="Brand × Outlet coverage"
          open={collapse.isOpen('matrix')}
          onToggle={collapse.toggle}
        >
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 12 }}>Stores per location · number = staff on site</div>
          <div style={{ overflowX: 'auto' }}>
            {/* ...existing <table>...</table>, UNCHANGED... */}
          </div>
        </CollapsibleCard>
```

**(e) Visits by brand** — replace the opening card `<div>` and its title (lines ~281–282):

```tsx
        <CollapsibleCard
          id="visitsByBrand"
          title="Visits by brand"
          open={collapse.isOpen('visitsByBrand')}
          onToggle={collapse.toggle}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {/* ...existing brandBreakdown.map(...), UNCHANGED... */}
          </div>
        </CollapsibleCard>
```

**(f) Staff distribution by outlet** — replace the opening card `<div>` and its title (lines ~302–303):

```tsx
        <CollapsibleCard
          id="staffByOutlet"
          title="Staff distribution by outlet"
          open={collapse.isOpen('staffByOutlet')}
          onToggle={collapse.toggle}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {/* ...existing outletBreakdown.map(...), UNCHANGED... */}
          </div>
        </CollapsibleCard>
```

For each of (c)–(f), ensure the original card's CLOSING `</div>` is replaced by `</CollapsibleCard>` and any inner `</div>`s remain balanced. The `sectionTitle` constant (line ~71) is now only used inside bodies that no longer have titles — if it becomes unused, remove it to satisfy `noUnusedLocals`. (The matrix subtitle and breakdown bodies do not use `sectionTitle`, so after these edits `sectionTitle` is unused — delete its declaration.)

- [ ] **Step 7: Add the `FailedRow` presentational component**

At the bottom of `src/screens/Dashboard.tsx`, after the existing `AttentionRow` function, add:

```tsx
function FailedRow({
  row,
  onOpen,
}: {
  row: {
    key: string
    brandName: string
    brandColor: string
    outletName: string
    visit: LatestFailedVisit | null
  }
  onOpen: (id: string) => void
}) {
  const v = row.visit
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: row.brandColor, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {row.brandName} · {row.outletName}
      </span>
    </div>
  )

  // No completed visit yet
  if (!v) {
    return (
      <div style={rowShell(false)}>
        {header}
        <span style={{ ...pill('var(--dim)'), marginLeft: 'auto' }}>No visit yet</span>
      </div>
    )
  }

  const meta = (
    <span style={{ fontSize: 11.5, color: 'var(--dim)', whiteSpace: 'nowrap' }}>
      {(v.staffName ?? 'Unassigned')} · {fmt(v.date)}
    </span>
  )

  // All success
  if (v.status === 'done') {
    return (
      <button onClick={() => onOpen(v.visitId)} style={rowShell(true)}>
        {header}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {meta}
          <span style={pill('#16a34a')}>Success</span>
        </span>
      </button>
    )
  }

  // Has failures
  return (
    <button onClick={() => onOpen(v.visitId)} style={{ ...rowShell(true), flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {header}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {meta}
          <span style={pill('#dc2626')}>{v.failed.length} failed</span>
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 18 }}>
        {v.failed.map((t, i) => (
          <div key={i} style={{ fontSize: 12 }}>
            <span style={{ fontWeight: 600 }}>{t.label}</span>
            {t.remark && <span style={{ color: 'var(--dim)' }}> — {t.remark}</span>}
          </div>
        ))}
      </div>
    </button>
  )
}

function rowShell(clickable: boolean) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    width: '100%',
    textAlign: 'left' as const,
    color: 'var(--text)',
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    borderRadius: 9,
    padding: '10px 12px',
    cursor: clickable ? 'pointer' : 'default',
  }
}
```

- [ ] **Step 8: Type-check, build, and run tests**

Run: `npm run build`
Expected: PASS — `tsc -b` reports no unused locals (confirm `sectionTitle` removal if it went unused) and `vite build` succeeds.

Run: `npm test`
Expected: PASS — full vitest suite green (including the Task 2 and Task 4 tests).

- [ ] **Step 9: Manual smoke check**

Run: `npm run dev`, open the app, go to the Dashboard.
Confirm: all large cards start collapsed (thin header bars with chevrons); clicking a header expands/collapses it; "Expand all" opens all and reflects state; reload preserves open/closed per card; the "Latest failed tasks by outlet" card lists brand×outlet rows sorted by brand, showing failed tasks+remarks / green "Success" / muted "No visit yet"; clicking a row with a visit opens the visit drawer.

- [ ] **Step 10: Commit**

```bash
git add src/screens/Dashboard.tsx
git commit -m "feat: collapsible dashboard cards + latest failed tasks card

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- `rowShell(clickable: boolean)` is called directly with `true`/`false` at each branch — there is no `clickable` local to leave dangling. Don't reintroduce one (the build fails on unused locals).
- Keep all existing chart/table/breakdown JSX byte-for-byte inside the new `CollapsibleCard` bodies — only the wrapper element and the title/legend headers change. Do not restyle the inner content.
- `data.stores` is the authoritative brand×outlet pair list (the Store join row). `brandById`/`outletById` use `!` and assume the id exists — that holds because the ids come from `data.stores`.
