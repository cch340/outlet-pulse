# Stores Browse & Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add discoverable store (brand↔outlet) management, a top-level Stores browse page grouped by an orderable brand list, and a per-store visit-history drawer.

**Architecture:** Reuse the existing React Query + inline-style + view-state-context patterns. A new `sort` column on `brands` (migration + reorder mutation, mirroring `task_templates`) drives brand order everywhere. A new Manage → Stores tab handles linking with live single-row insert/delete mutations. A new top-level Stores screen groups stores via a pure, unit-tested helper and reuses the existing `latest_failed_tasks` RPC for status and the paginated `visits_page` RPC for the drawer. No new backend RPCs.

**Tech Stack:** React 18 + TypeScript + Vite, `@tanstack/react-query`, Supabase (Postgres + RPC), Vitest (node env, `src/**/*.test.ts` only).

## Global Constraints

- **Styling:** inline `style={}` objects driven by CSS variables only. No CSS framework, no `.module.css`. Use the helpers in `src/theme.ts` (`card`, `chip`, `pill`, `cardSel`, `tint`, `mono`).
- **Build is strict:** `npm run build` runs `tsc -b` with `noUnusedLocals`/`noUnusedParameters` — remove every unused import/param or the build fails.
- **Tests:** run in `node` env, match only `src/**/*.test.ts`. No DOM/component tests — extract non-trivial logic into a pure module with a `.test.ts` (the `transferLogic.ts` model).
- **Mappers:** DB rows are snake_case; the domain model is camelCase. Go through mappers/`select` explicitly.
- **Migrations:** SQL files in `supabase/migrations/`, applied manually in the Supabase SQL editor in numeric order. FK deletes on `stores` are unrestricted (plain join rows).
- **Commit identity:** commits end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Use git email `cch340@gmail.com`.
- **Data-change convention:** when changing what's fetched, update `keys.ts`, the `useData` query, the mapper/select, and `model.ts` together.

---

## Task 1: Brand `sort` column — migration, model, ordered fetch

**Files:**
- Create: `supabase/migrations/0012_brand_sort.sql`
- Modify: `src/data/model.ts` (Brand interface)
- Modify: `src/data/queries/useData.ts` (`fetchBrands`)

**Interfaces:**
- Produces: `Brand.sort: number`; brands returned from `useData()` ordered by `sort` then `name`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0012_brand_sort.sql`:

```sql
-- 0012_brand_sort.sql
-- Adds a user-controllable display order to brands, mirroring task_templates.sort.
-- Every table is per-user scoped (owner_id) since 0003_per_user_scoping.sql.
-- Apply AFTER 0011_latest_failed_tasks_by_month.sql in the Supabase SQL editor.

alter table brands add column sort int not null default 0;

-- Backfill existing rows per owner using the current alphabetical (name) order.
update brands b
set sort = s.rn
from (
  select id, (row_number() over (partition by owner_id order by name) - 1) as rn
  from brands
) s
where b.id = s.id;
```

- [ ] **Step 2: Apply the migration in Supabase**

Paste the file contents into the Supabase SQL editor and run it (against the dev project). This must happen before Step 4's ordered fetch is exercised at runtime.

- [ ] **Step 3: Add `sort` to the Brand model**

In `src/data/model.ts`, add `sort` to the `Brand` interface:

```ts
export interface Brand {
  id: string
  name: string
  color: string // hex chip
  category: string
  sort: number
}
```

- [ ] **Step 4: Order the brand fetch by sort**

In `src/data/queries/useData.ts`, change `fetchBrands` to order by `sort` then `name`:

```ts
async function fetchBrands(): Promise<Brand[]> {
  const { data, error } = await supabase.from('brands').select('*').order('sort').order('name')
  if (error) throw error
  return data as Brand[]
}
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: PASS (no type errors; `sort` now part of `Brand`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0012_brand_sort.sql src/data/model.ts src/data/queries/useData.ts
git commit -m "feat(brands): add sort column and order brands by it"
```

---

## Task 2: Brand reorder mutation + create-with-sort + Brands tab arrows

**Files:**
- Modify: `src/data/queries/useBrandMutations.ts` (`useCreateBrand`, add `useReorderBrands`)
- Modify: `src/components/BrandModal.tsx` (pass `sort` on create)
- Modify: `src/screens/Brands.tsx` (up/down arrows)

**Interfaces:**
- Consumes: `Brand.sort` (Task 1).
- Produces: `useReorderBrands()` → mutation taking `{ ids: string[] }`; `useCreateBrand()` input now `{ name: string; color: string; category: string; sort: number }`.

- [ ] **Step 1: Update `useCreateBrand` to accept and insert `sort`**

In `src/data/queries/useBrandMutations.ts`, change `useCreateBrand`:

```ts
export function useCreateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; color: string; category: string; sort: number }) => {
      const { error } = await supabase.from('brands').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.brands }),
  })
}
```

- [ ] **Step 2: Add `useReorderBrands`**

Append to `src/data/queries/useBrandMutations.ts` (mirrors `useReorderTaskTemplates`):

```ts
export function useReorderBrands() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ids: string[] }) => {
      // Persist new order by writing each row's index as its sort value.
      for (let i = 0; i < input.ids.length; i++) {
        const { error } = await supabase.from('brands').update({ sort: i }).eq('id', input.ids[i])
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.brands }),
  })
}
```

- [ ] **Step 3: Pass `sort` when creating a brand**

In `src/components/BrandModal.tsx`, the `m.mode === 'add'` branch of `submit` currently calls `create.mutate({ name: name.trim(), color, category: category.trim() }, …)`. Add `sort` so new brands go last:

```ts
    if (m.mode === 'add') {
      create.mutate(
        { name: name.trim(), color, category: category.trim(), sort: data.brands.length },
        { onSuccess: () => closeBrandModal() },
      )
    } else {
```

(`data` is already available in `BrandModal` from `useData()`.)

- [ ] **Step 4: Import the reorder hook in the Brands tab**

In `src/screens/Brands.tsx`, extend the mutations import:

```ts
import { useDeleteBrand, useReorderBrands } from '../data/queries/useBrandMutations'
```

- [ ] **Step 5: Add reorder state + move handler**

In `src/screens/Brands.tsx`, inside `Brands()` after `const del = useDeleteBrand()`:

```ts
  const reorderB = useReorderBrands()
  const ids = data.brands.map((b) => b.id)
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    const next = ids.slice()
    ;[next[index], next[j]] = [next[j], next[index]]
    reorderB.mutate({ ids: next }, { onError: (e) => alert(e.message) })
  }
```

- [ ] **Step 6: Add the index param and up/down buttons**

In `src/screens/Brands.tsx`, change the brand list map to expose the index — `{data.brands.map((b) => {` becomes `{data.brands.map((b, i) => {`.

Then change the count block's `paddingRight` from `60` to `112` (to make room for four icon buttons):

```tsx
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0, paddingRight: 112 }}>
```

Then replace the absolute top-right button cluster with up/down + edit + delete:

```tsx
              <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); move(i, -1) }}
                  disabled={i === 0}
                  title="Move up"
                  style={{ border: 'none', background: 'transparent', cursor: i === 0 ? 'default' : 'pointer', color: 'var(--dim)', padding: 4, borderRadius: 6, opacity: i === 0 ? 0.3 : 1 }}
                >
                  <Icon name="arrow_upward" size={15} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); move(i, 1) }}
                  disabled={i === ids.length - 1}
                  title="Move down"
                  style={{ border: 'none', background: 'transparent', cursor: i === ids.length - 1 ? 'default' : 'pointer', color: 'var(--dim)', padding: 4, borderRadius: 6, opacity: i === ids.length - 1 ? 0.3 : 1 }}
                >
                  <Icon name="arrow_downward" size={15} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openBrandModal({ mode: 'edit', id: b.id }) }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dim)', padding: 4, borderRadius: 6 }}
                >
                  <Icon name="edit" size={15} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('Delete this brand?')) {
                      del.mutate(b.id, {
                        onError: () => alert('Cannot delete: this brand still has staff or store links.'),
                      })
                    }
                  }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dim)', padding: 4, borderRadius: 6 }}
                >
                  <Icon name="delete" size={15} />
                </button>
              </div>
```

- [ ] **Step 7: Verify the build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 8: Manual check**

Run `npm run dev`, open Manage → Brands, use the up/down arrows on a brand, confirm the order changes and persists after refresh, and that creating a new brand places it last.

- [ ] **Step 9: Commit**

```bash
git add src/data/queries/useBrandMutations.ts src/components/BrandModal.tsx src/screens/Brands.tsx
git commit -m "feat(brands): reorder arrows in Brands tab; new brands sort last"
```

---

## Task 3: Store link/unlink mutations + Manage → Stores tab

**Files:**
- Modify: `src/data/queries/useBrandMutations.ts` (`useLinkStore`, `useUnlinkStore`)
- Modify: `src/data/store.tsx` (`ManageTab` union)
- Modify: `src/screens/Manage.tsx` (Stores tab)
- Create: `src/components/StoresPanel.tsx`

**Interfaces:**
- Consumes: `Brand.sort`-ordered `data.brands` (Task 1); `linked(data, brandId, outletId)` from `src/data/derived.ts`.
- Produces: `useLinkStore()` / `useUnlinkStore()` → mutations taking `{ brandId: string; outletId: string }`; `ManageTab` includes `'stores'`; `StoresPanel` component.

- [ ] **Step 1: Add single-row store link/unlink mutations**

Append to `src/data/queries/useBrandMutations.ts`:

```ts
export function useLinkStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { brandId: string; outletId: string }) => {
      const { error } = await supabase
        .from('stores')
        .insert({ brand_id: input.brandId, outlet_id: input.outletId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.stores }),
  })
}

export function useUnlinkStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { brandId: string; outletId: string }) => {
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('brand_id', input.brandId)
        .eq('outlet_id', input.outletId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.stores }),
  })
}
```

- [ ] **Step 2: Add `'stores'` to the `ManageTab` union**

In `src/data/store.tsx`:

```ts
export type ManageTab = 'brands' | 'outlets' | 'stores' | 'staff' | 'tasks'
```

- [ ] **Step 3: Create the Stores management panel**

Create `src/components/StoresPanel.tsx`:

```tsx
import { useData } from '../data/queries/useData'
import { useStore } from '../data/store'
import { linked } from '../data/derived'
import { card, chip } from '../theme'
import { Icon } from './Icon'
import { useLinkStore, useUnlinkStore } from '../data/queries/useBrandMutations'

const emptyBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '8px 13px',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 13,
  fontWeight: 600,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
} as const

export function StoresPanel() {
  const { data } = useData()
  const { setManageTab } = useStore()
  const link = useLinkStore()
  const unlink = useUnlinkStore()

  const noBrands = data.brands.length === 0
  const noOutlets = data.outlets.length === 0

  if (noBrands || noOutlets) {
    return (
      <div style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Set up your first store</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
          A store is a brand linked to an outlet. Create{' '}
          {noBrands ? 'a brand' : ''}
          {noBrands && noOutlets ? ' and ' : ''}
          {noOutlets ? 'an outlet' : ''} first, then link them here.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {noBrands && (
            <button onClick={() => setManageTab('brands')} style={emptyBtn}>
              <Icon name="add" size={16} /> Add a brand
            </button>
          )}
          {noOutlets && (
            <button onClick={() => setManageTab('outlets')} style={emptyBtn}>
              <Icon name="add" size={16} /> Add an outlet
            </button>
          )}
        </div>
      </div>
    )
  }

  const toggle = (brandId: string, outletId: string, isLinked: boolean) => {
    if (isLinked) unlink.mutate({ brandId, outletId }, { onError: (e) => alert(e.message) })
    else link.mutate({ brandId, outletId }, { onError: (e) => alert(e.message) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
        Tap an outlet to link or unlink it from a brand. Highlighted = linked.
      </div>
      {data.brands.map((b) => {
        const linkedCount = data.stores.filter((s) => s.brandId === b.id).length
        return (
          <div key={b.id} style={{ ...card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: b.color }} />
              <span style={{ fontSize: 14.5, fontWeight: 700 }}>{b.name}</span>
              <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono'", fontSize: 12, color: 'var(--dim)' }}>
                {linkedCount} / {data.outlets.length} linked
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.outlets.map((o) => {
                const isLinked = linked(data, b.id, o.id)
                return (
                  <button key={o.id} onClick={() => toggle(b.id, o.id, isLinked)} style={chip(isLinked)}>
                    {isLinked && <Icon name="check" size={15} color="#fff" />}
                    {o.name}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Wire the Stores tab into Manage**

In `src/screens/Manage.tsx`, import the panel, add the tab, and render it:

```tsx
import { StoresPanel } from '../components/StoresPanel'
```

```tsx
const TABS: [ManageTab, string][] = [
  ['brands', 'Brands'],
  ['outlets', 'Outlets'],
  ['stores', 'Stores'],
  ['staff', 'Staff'],
  ['tasks', 'Tasks'],
]
```

Add the render line alongside the others:

```tsx
      {tab === 'stores' && <StoresPanel />}
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Manual check**

Run `npm run dev`, open Manage → Stores. With no brands/outlets confirm the "Set up your first store" hint and its buttons switch tabs. With brands+outlets, toggle outlet chips on a brand and confirm links appear/disappear (and the `N / M linked` count updates).

- [ ] **Step 7: Commit**

```bash
git add src/data/queries/useBrandMutations.ts src/data/store.tsx src/screens/Manage.tsx src/components/StoresPanel.tsx
git commit -m "feat(manage): Stores tab for linking brands to outlets with empty-state hints"
```

---

## Task 4: Remove outlet-linking from the Brand modal

**Files:**
- Modify: `src/components/BrandModal.tsx`

**Interfaces:**
- Consumes: the Stores tab (Task 3) is now the single home for linking.

- [ ] **Step 1: Remove the outlet-linking imports, state, handler, and JSX**

Replace the entire contents of `src/components/BrandModal.tsx` with (drops `useSetBrandStores`, `chip`, `outletIds` state, `toggleOutlet`, the `setStores` chain, and the "Operates in outlets" block; keeps `sort` on create from Task 2):

```tsx
import { useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useCreateBrand, useUpdateBrand } from '../data/queries/useBrandMutations'
import { EntityModal, modalFieldLabel, modalInput } from './EntityModal'

export function BrandModal() {
  const { state, closeBrandModal } = useStore()
  const { data } = useData()
  const m = state.brandModal
  const existing = m?.mode === 'edit' ? data.brands.find((b) => b.id === m.id) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState(existing?.color ?? '#0ea5e9')
  const [category, setCategory] = useState(existing?.category ?? '')

  const create = useCreateBrand()
  const update = useUpdateBrand()
  if (!m) return null

  const submit = () => {
    if (!name.trim()) return
    if (m.mode === 'add') {
      create.mutate(
        { name: name.trim(), color, category: category.trim(), sort: data.brands.length },
        { onSuccess: () => closeBrandModal(), onError: (e) => alert(e.message) },
      )
    } else {
      update.mutate(
        { id: m.id, name: name.trim(), color, category: category.trim() },
        { onSuccess: () => closeBrandModal(), onError: (e) => alert(e.message) },
      )
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
    </EntityModal>
  )
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: PASS (no unused `chip`/`useSetBrandStores`).

- [ ] **Step 3: Manual check**

Run `npm run dev`, edit a brand — confirm there is no longer an "Operates in outlets" section, and that adding/saving a brand still works. Linking is done only in Manage → Stores.

- [ ] **Step 4: Commit**

```bash
git add src/components/BrandModal.tsx
git commit -m "refactor(brand-modal): move outlet linking out to the Stores tab"
```

---

## Task 5: `storeRows` pure helper + tests (TDD)

**Files:**
- Create: `src/data/queries/storeRows.ts`
- Test: `src/data/queries/storeRows.test.ts`

**Interfaces:**
- Consumes: `DataSnapshot` from `src/data/queries/useData.ts`; `LatestFailedVisit` from `src/data/queries/dashboardSummary.ts`; `Brand` from `src/data/model.ts`.
- Produces:
  - `interface StoreRow { brandId: string; outletId: string; outletName: string; location: string; staffCount: number; latest: LatestFailedVisit | null }`
  - `interface StoreGroup { brand: Brand; rows: StoreRow[] }`
  - `buildStoreGroups(data: DataSnapshot, latest: LatestFailedVisit[]): StoreGroup[]`

- [ ] **Step 1: Write the failing test**

Create `src/data/queries/storeRows.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildStoreGroups } from './storeRows'
import type { DataSnapshot } from './useData'
import type { LatestFailedVisit } from './dashboardSummary'

const brand = (id: string, name: string, sort: number) => ({ id, name, color: '#000', category: '', sort })
const outlet = (id: string, name: string, location = '') => ({ id, name, location })
const staff = (id: string, brandId: string, outletId: string) => ({
  id, name: id, brandId, outletId, role: '', joined: '2026-01-01', history: [],
})

function snap(partial: Partial<DataSnapshot>): DataSnapshot {
  return { brands: [], outlets: [], stores: [], staff: [], taskTemplates: [], ...partial }
}

describe('buildStoreGroups', () => {
  it('groups by brand array order and sorts rows by outlet name', () => {
    const data = snap({
      brands: [brand('b1', 'Alpha', 0), brand('b2', 'Beta', 1)],
      outlets: [outlet('o1', 'Zeta'), outlet('o2', 'Aary'), outlet('o3', 'Mid')],
      stores: [
        { brandId: 'b1', outletId: 'o1' },
        { brandId: 'b1', outletId: 'o2' },
        { brandId: 'b2', outletId: 'o3' },
      ],
    })
    const groups = buildStoreGroups(data, [])
    expect(groups.map((g) => g.brand.id)).toEqual(['b1', 'b2'])
    expect(groups[0].rows.map((r) => r.outletName)).toEqual(['Aary', 'Zeta'])
  })

  it('joins latest failed status by brand:outlet and is null when absent', () => {
    const data = snap({
      brands: [brand('b1', 'Alpha', 0)],
      outlets: [outlet('o1', 'One'), outlet('o2', 'Two')],
      stores: [
        { brandId: 'b1', outletId: 'o1' },
        { brandId: 'b1', outletId: 'o2' },
      ],
    })
    const latest: LatestFailedVisit[] = [
      {
        brandId: 'b1', outletId: 'o1', visitId: 'v1', date: '2026-07-01',
        brandName: 'Alpha', outletName: 'One', staffName: null, status: 'attention',
        failed: [{ label: 'Fridge', remark: 'hot' }],
      },
    ]
    const groups = buildStoreGroups(data, latest)
    const rows = groups[0].rows
    expect(rows.find((r) => r.outletId === 'o1')!.latest?.visitId).toBe('v1')
    expect(rows.find((r) => r.outletId === 'o2')!.latest).toBeNull()
  })

  it('counts staff posted to the store', () => {
    const data = snap({
      brands: [brand('b1', 'Alpha', 0)],
      outlets: [outlet('o1', 'One')],
      stores: [{ brandId: 'b1', outletId: 'o1' }],
      staff: [staff('s1', 'b1', 'o1'), staff('s2', 'b1', 'o1'), staff('s3', 'b1', 'o2')],
    })
    const groups = buildStoreGroups(data, [])
    expect(groups[0].rows[0].staffCount).toBe(2)
  })

  it('omits brands with no linked stores', () => {
    const data = snap({
      brands: [brand('b1', 'Alpha', 0), brand('b2', 'Beta', 1)],
      outlets: [outlet('o1', 'One')],
      stores: [{ brandId: 'b1', outletId: 'o1' }],
    })
    const groups = buildStoreGroups(data, [])
    expect(groups.map((g) => g.brand.id)).toEqual(['b1'])
  })

  it('returns [] for empty data', () => {
    expect(buildStoreGroups(snap({}), [])).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/queries/storeRows.test.ts`
Expected: FAIL with a module-not-found / `buildStoreGroups is not a function` error.

- [ ] **Step 3: Implement `buildStoreGroups`**

Create `src/data/queries/storeRows.ts`:

```ts
import type { DataSnapshot } from './useData'
import type { Brand } from '../model'
import type { LatestFailedVisit } from './dashboardSummary'

export interface StoreRow {
  brandId: string
  outletId: string
  outletName: string
  location: string
  staffCount: number
  latest: LatestFailedVisit | null
}

export interface StoreGroup {
  brand: Brand
  rows: StoreRow[]
}

/**
 * Group stores by brand (in the brands array's existing sort order), with each
 * brand's rows sorted by outlet name and joined to its latest-failed status.
 * Brands with no linked stores are omitted.
 */
export function buildStoreGroups(data: DataSnapshot, latest: LatestFailedVisit[]): StoreGroup[] {
  const latestByKey = new Map<string, LatestFailedVisit>(
    latest.map((r) => [`${r.brandId}:${r.outletId}`, r]),
  )
  const groups: StoreGroup[] = []
  for (const brand of data.brands) {
    const rows: StoreRow[] = data.stores
      .filter((s) => s.brandId === brand.id)
      .map((s) => {
        const outlet = data.outlets.find((o) => o.id === s.outletId)
        return {
          brandId: brand.id,
          outletId: s.outletId,
          outletName: outlet?.name ?? '',
          location: outlet?.location ?? '',
          staffCount: data.staff.filter((x) => x.brandId === brand.id && x.outletId === s.outletId).length,
          latest: latestByKey.get(`${brand.id}:${s.outletId}`) ?? null,
        }
      })
      .sort((a, b) => a.outletName.localeCompare(b.outletName))
    if (rows.length > 0) groups.push({ brand, rows })
  }
  return groups
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/data/queries/storeRows.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite + build**

Run: `npm test` then `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/queries/storeRows.ts src/data/queries/storeRows.test.ts
git commit -m "feat(stores): buildStoreGroups helper with tests"
```

---

## Task 6: Stores browse page — nav, screen, view-state

**Files:**
- Modify: `src/data/store.tsx` (`Screen` union; `storeVisits` state + actions)
- Modify: `src/data/nav.ts` (nav entry + title)
- Modify: `src/App.tsx` (Shell screen switch)
- Create: `src/screens/Stores.tsx`

**Interfaces:**
- Consumes: `buildStoreGroups` + `StoreRow` (Task 5); `useLatestFailedTasks(month)` from `src/data/queries/useLatestFailedTasks.ts`; `periodParams`, `yearOptions`, `MONTH_NAMES` from `src/screens/dashboardPeriod.ts`; `today`, `fmt` from `src/data/derived.ts`.
- Produces: `Screen` includes `'stores'`; `state.storeVisits: { brandId: string; outletId: string } | null`; actions `openStoreVisits(brandId, outletId)` and `closeStoreVisits()`.

- [ ] **Step 1: Add the `stores` screen + `storeVisits` view-state**

In `src/data/store.tsx`:

Extend the `Screen` union:

```ts
export type Screen = 'dashboard' | 'stores' | 'visits' | 'manage'
```

Add to the `AppState` interface (in the overlays group):

```ts
  storeVisits: { brandId: string; outletId: string } | null
```

Add to `seed()`'s returned object:

```ts
    storeVisits: null,
```

Add to the `StoreActions` interface:

```ts
  openStoreVisits(brandId: string, outletId: string): void
  closeStoreVisits(): void
```

Add to the `actions` object (and also close the store drawer when navigating):

```ts
      openStoreVisits: (brandId, outletId) => patch({ storeVisits: { brandId, outletId } }),
      closeStoreVisits: () => patch({ storeVisits: null }),
```

Change the `go` action to also clear the store drawer:

```ts
      go: (activeScreen) => patch({ activeScreen, openVisitId: null, storeVisits: null }),
```

- [ ] **Step 2: Add the nav entry + title**

In `src/data/nav.ts`, insert the Stores entry between Dashboard and Visits and add its title:

```ts
export const NAV: NavDef[] = [
  { key: 'dashboard', label: 'Dashboard', short: 'Home', icon: 'space_dashboard' },
  { key: 'stores', label: 'Stores', short: 'Stores', icon: 'store' },
  { key: 'visits', label: 'Visits', short: 'Visits', icon: 'fact_check' },
  { key: 'manage', label: 'Manage', short: 'Manage', icon: 'tune' },
]

export const TITLES: Record<Screen, [string, string]> = {
  dashboard: ['Summary', 'Year & month visit overview'],
  stores: ['Stores', 'Brands & outlets, grouped by brand'],
  visits: ['Visits', 'Scheduled store visits & checks'],
  manage: ['Manage', 'Brands, outlets, staff & visit tasks'],
}
```

- [ ] **Step 3: Create the Stores screen**

Create `src/screens/Stores.tsx`:

```tsx
import { useState } from 'react'
import { useData } from '../data/queries/useData'
import { useStore } from '../data/store'
import { useLatestFailedTasks } from '../data/queries/useLatestFailedTasks'
import { buildStoreGroups, type StoreRow } from '../data/queries/storeRows'
import { today, fmt } from '../data/derived'
import { card, pill } from '../theme'
import { Icon } from '../components/Icon'
import { periodParams, yearOptions, MONTH_NAMES } from './dashboardPeriod'

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

export function Stores() {
  const { data } = useData()
  const { openStoreVisits } = useStore()
  const t = today()
  const [filterYear, setFilterYear] = useState(t.getFullYear())
  const [filterMonth, setFilterMonth] = useState(t.getMonth() + 1)
  const [showDetails, setShowDetails] = useState(false)
  const { month } = periodParams(filterYear, filterMonth)
  const years = yearOptions(t.getFullYear())
  const { rows: latestFailed, isError } = useLatestFailedTasks(month)

  const groups = buildStoreGroups(data, latestFailed)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Last visit</span>
        <select aria-label="Month" value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} style={selectStyle}>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
        <select aria-label="Year" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} style={selectStyle}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
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
          <input type="checkbox" checked={showDetails} onChange={(e) => setShowDetails(e.target.checked)} />
          Show failed task details
        </label>
      </div>

      {isError && <div style={{ fontSize: 12.5, color: '#dc2626' }}>Couldn't load latest visit status.</div>}

      {groups.length === 0 ? (
        <div style={{ ...card, padding: 22, fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
          No stores yet. Go to <strong style={{ color: 'var(--text)' }}>Manage → Stores</strong> to link a brand to an outlet.
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.brand.id} style={{ ...card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: g.brand.color }} />
              <span style={{ fontSize: 14.5, fontWeight: 700 }}>{g.brand.name}</span>
              <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono'", fontSize: 12, color: 'var(--dim)' }}>
                {g.rows.length} outlet{g.rows.length === 1 ? '' : 's'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {g.rows.map((row) => (
                <StoreRowItem
                  key={row.outletId}
                  row={row}
                  showDetails={showDetails}
                  onView={() => openStoreVisits(row.brandId, row.outletId)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function StoreRowItem({ row, showDetails, onView }: { row: StoreRow; showDetails: boolean; onView: () => void }) {
  const v = row.latest
  const statusPill = !v ? (
    <span style={pill('var(--dim)')}>No visit yet</span>
  ) : v.status === 'done' ? (
    <span style={pill('#16a34a')}>Success</span>
  ) : (
    <span style={pill('#dc2626')}>{v.failed.length} failed</span>
  )
  const hasFailures = !!v && v.status !== 'done' && v.failed.length > 0

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface2)', borderRadius: 9, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {row.outletName} <span style={{ color: 'var(--dim)', fontWeight: 400 }}>· {row.location}</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>
            {row.staffCount} staff{v ? ` · ${fmt(v.date)}` : ''}
          </div>
        </div>
        {statusPill}
        <button
          onClick={onView}
          title="View visits"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            borderRadius: 8,
            padding: '6px 10px',
            fontFamily: "'IBM Plex Sans'",
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="fact_check" size={16} /> Visits
        </button>
      </div>
      {showDetails && hasFailures && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 2 }}>
          {v!.failed.map((tk, i) => (
            <div key={i} style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>{tk.label}</span>
              {tk.remark && <span style={{ color: 'var(--dim)' }}> — {tk.remark}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Render the screen in the Shell**

In `src/App.tsx`, import the screen and add it to the switch:

```tsx
import { Stores } from './screens/Stores'
```

```tsx
              {state.activeScreen === 'dashboard' && <Dashboard />}
              {state.activeScreen === 'stores' && <Stores />}
              {state.activeScreen === 'visits' && <Visits />}
              {state.activeScreen === 'manage' && <Manage />}
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Manual check**

Run `npm run dev`. Confirm a **Stores** nav item appears between Dashboard and Visits (sidebar on desktop, bottom nav on mobile) and the page lists stores grouped by brand (in the order set on the Brands tab), outlets sorted by name, with a latest-status pill. Change the month/year filter and toggle "Show failed task details" to expand stores with failures. (The "Visits" button sets state but no drawer renders yet — that's Task 7.)

- [ ] **Step 7: Commit**

```bash
git add src/data/store.tsx src/data/nav.ts src/App.tsx src/screens/Stores.tsx
git commit -m "feat(stores): top-level Stores browse page grouped by brand"
```

---

## Task 7: Per-store visit drawer

**Files:**
- Create: `src/components/StoreVisitsDrawer.tsx`
- Modify: `src/App.tsx` (mount the drawer)

**Interfaces:**
- Consumes: `state.storeVisits` + `openStoreVisits`/`closeStoreVisits` (Task 6); `useVisitsPage` from `src/data/queries/useVisitsPage.ts`; `brandById`, `outletById`, `visitVM`, `today`, `localDateStr` from `src/data/derived.ts`; `openVisit` from the store.

- [ ] **Step 1: Create the drawer**

Create `src/components/StoreVisitsDrawer.tsx`:

```tsx
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useVisitsPage } from '../data/queries/useVisitsPage'
import { brandById, outletById, visitVM, today, localDateStr } from '../data/derived'
import { pill } from '../theme'
import { Icon } from './Icon'

export function StoreVisitsDrawer() {
  const { state, closeStoreVisits, openVisit } = useStore()
  const { data } = useData()
  const sv = state.storeVisits
  const ovPos = state.isMobile ? 'absolute' : 'fixed'
  const todayStr = localDateStr(today())

  // Full history for this store, most-recent-first (RPC orders by date desc).
  const { visits, isLoading } = useVisitsPage({
    today: todayStr,
    from: null,
    to: null,
    status: 'all',
    latest: false,
    search: '',
    brand: sv?.brandId ?? null,
    outlet: sv?.outletId ?? null,
    limit: 100,
    offset: 0,
  })

  if (!sv) return null
  const brand = brandById(data, sv.brandId)
  const outlet = outletById(data, sv.outletId)

  return (
    <div
      onClick={closeStoreVisits}
      style={{ position: ovPos, inset: 0, zIndex: 45, background: 'rgba(0,0,0,.42)', display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 430,
          maxWidth: '100%',
          height: '100%',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--border)',
          animation: 'slidein .22s ease',
        }}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: brand.color }} />
            {brand.name} · {outlet.name}
          </div>
          <button onClick={closeStoreVisits} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <Icon name="close" size={22} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isLoading ? (
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>Loading…</div>
          ) : visits.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>No visits scheduled for this store yet.</div>
          ) : (
            visits.map((visit) => {
              const vm = visitVM(data, visit)
              const failed = visit.tasks.filter((tk) => tk.status === 'failed')
              return (
                <button
                  key={visit.id}
                  onClick={() => openVisit(visit.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{vm.dateLabel}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>
                        {vm.staffName} · {vm.total} checks
                      </div>
                    </div>
                    <span style={pill(vm.statusColor)}>{vm.statusLabel}</span>
                  </div>
                  {failed.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {failed.map((tk) => (
                        <div key={tk.id ?? tk.label} style={{ fontSize: 12 }}>
                          <span style={{ fontWeight: 600 }}>{tk.label}</span>
                          {tk.remark && <span style={{ color: 'var(--dim)' }}> — {tk.remark}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount the drawer in the Shell**

In `src/App.tsx`, import and mount it (conditionally, so the visits query only runs when open). Mount it before `<VisitDrawer />` so the visit drawer's higher `zIndex` (50 vs 45) layers on top:

```tsx
import { StoreVisitsDrawer } from './components/StoreVisitsDrawer'
```

```tsx
        {state.storeVisits && <StoreVisitsDrawer />}
        <VisitDrawer key={state.openVisitId} />
        <TransferModal />
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Manual check**

Run `npm run dev`, open the Stores page, click **Visits** on a store. Confirm a right-side drawer lists that store's visits most-recent-first with status pills and failed-task breakdowns; clicking a visit opens the full visit drawer on top for editing; closing it returns to the store drawer; navigating away closes both. Check on mobile too.

- [ ] **Step 5: Commit**

```bash
git add src/components/StoreVisitsDrawer.tsx src/App.tsx
git commit -m "feat(stores): per-store visit history drawer"
```

---

## Final verification

- [ ] Run `npm test` — all suites pass (including `storeRows.test.ts`).
- [ ] Run `npm run build` — type-check + production build pass.
- [ ] Confirm migration `0012_brand_sort.sql` is applied in the target Supabase project before deploy.
- [ ] Dashboard's "Latest failed tasks by outlet" card is unchanged (intentionally kept; retire later if desired).

## Self-review notes (spec coverage)

- Spec Part 1 (brand ordering + granular links) → Tasks 1, 2, 3.
- Spec Part 2 (Manage → Stores tab, empty states, remove modal linking) → Tasks 3, 4.
- Spec Part 3 (browse page: nav, grouping, month/year filter, failed-detail checkbox) → Tasks 5, 6.
- Spec Part 4 (per-store visit drawer) → Task 7.
- Spec Part 5 (dashboard unchanged) → no task by design; verified in Final verification.
