# Schedule Modal Store Combobox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the overflowing store chip grid in the "Schedule a visit" modal with a searchable, brand-grouped combobox that scales to unbounded store counts.

**Architecture:** Pure filter/group logic lives in a testable module (`storePicker.ts`) with Vitest coverage; a presentational `StoreCombobox.tsx` component owns only local UI state (`query`, `open`) and consumes that logic. `ScheduleModal.tsx` swaps its inline chip grid for the new component. The staff field is untouched.

**Tech Stack:** React 18 + TypeScript + Vite, inline `style={}` objects driven by CSS variables, Vitest (node env, `src/**/*.test.ts`), React Query `DataSnapshot`.

## Global Constraints

- All styling is inline `style={}` objects using CSS variables (`var(--surface)`, `var(--border)`, `var(--accent)`, `var(--text)`, `var(--dim)`, `var(--surface2)`). No CSS framework, no `.module.css`.
- Tests run in the `node` environment and only match `src/**/*.test.ts`. No DOM/component tests — logic to be tested must be pure and React-free.
- Store key shape is `` `${brandId}|${outletId}` `` (matches existing `af.storeKey` usage).
- `brandById(data, id)` and `outletById(data, id)` return `Brand` / `Outlet` and assume the id exists (they use `!`). `Brand` has `{ id, name, color }`; `Outlet` has `{ id, name }`.
- Build fails on unused locals/params (`noUnusedLocals`/`noUnusedParameters`). `npm run build` runs `tsc -b` then `vite build`.
- Font family for inputs/buttons: `"'IBM Plex Sans'"`.

---

### Task 1: Pure store-picker logic module

**Files:**
- Create: `src/data/queries/storePicker.ts`
- Test: `src/data/queries/storePicker.test.ts`

**Interfaces:**
- Consumes: `DataSnapshot` (from `src/data/queries/useData`), `brandById` / `outletById` (from `src/data/derived`).
- Produces:
  - `export type StoreOption = { key: string; brandId: string; outletId: string; brandName: string; outletName: string; brandColor: string }`
  - `export function storeOptions(data: DataSnapshot): StoreOption[]`
  - `export function filterStores(options: StoreOption[], query: string): StoreOption[]`
  - `export type StoreGroup = { brandName: string; brandColor: string; options: StoreOption[] }`
  - `export function groupByBrand(options: StoreOption[]): StoreGroup[]`

- [ ] **Step 1: Write the failing test**

Create `src/data/queries/storePicker.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { storeOptions, filterStores, groupByBrand, type StoreOption } from './storePicker'
import type { DataSnapshot } from './useData'

// Minimal DataSnapshot with just the fields storeOptions reads.
const snapshot = {
  brands: [
    { id: 'b-nike', name: 'Nike', color: '#111' },
    { id: 'b-adidas', name: 'Adidas', color: '#222' },
  ],
  outlets: [
    { id: 'o-klcc', name: 'Suria KLCC' },
    { id: 'o-mv', name: 'Mid Valley' },
    { id: 'o-pav', name: 'Pavilion' },
  ],
  stores: [
    { brandId: 'b-nike', outletId: 'o-mv' },
    { brandId: 'b-nike', outletId: 'o-klcc' },
    { brandId: 'b-adidas', outletId: 'o-pav' },
  ],
} as unknown as DataSnapshot

const opts = (): StoreOption[] => storeOptions(snapshot)

describe('storeOptions', () => {
  it('builds one option per store, sorted by brand then outlet', () => {
    expect(opts().map((o) => `${o.brandName} · ${o.outletName}`)).toEqual([
      'Adidas · Pavilion',
      'Nike · Mid Valley',
      'Nike · Suria KLCC',
    ])
  })

  it('sets key, ids and brand color', () => {
    const nikeKlcc = opts().find((o) => o.key === 'b-nike|o-klcc')!
    expect(nikeKlcc).toMatchObject({
      brandId: 'b-nike',
      outletId: 'o-klcc',
      brandName: 'Nike',
      outletName: 'Suria KLCC',
      brandColor: '#111',
    })
  })
})

describe('filterStores', () => {
  it('matches on the brand token, case-insensitively', () => {
    expect(filterStores(opts(), 'nik').map((o) => o.key)).toEqual([
      'b-nike|o-mv',
      'b-nike|o-klcc',
    ])
  })

  it('matches on the outlet token', () => {
    expect(filterStores(opts(), 'pavilion').map((o) => o.key)).toEqual(['b-adidas|o-pav'])
  })

  it('matches the combined "brand · outlet" string', () => {
    expect(filterStores(opts(), 'nike · mid').map((o) => o.key)).toEqual(['b-nike|o-mv'])
  })

  it('returns all options for an empty or whitespace query', () => {
    expect(filterStores(opts(), '')).toHaveLength(3)
    expect(filterStores(opts(), '   ')).toHaveLength(3)
  })
})

describe('groupByBrand', () => {
  it('groups options into ordered brand groups', () => {
    const groups = groupByBrand(opts())
    expect(groups.map((g) => g.brandName)).toEqual(['Adidas', 'Nike'])
    expect(groups[1]).toMatchObject({ brandColor: '#111' })
    expect(groups[1].options.map((o) => o.outletName)).toEqual(['Mid Valley', 'Suria KLCC'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/queries/storePicker.test.ts`
Expected: FAIL — cannot resolve `./storePicker` / exports not defined.

- [ ] **Step 3: Write minimal implementation**

Create `src/data/queries/storePicker.ts`:

```ts
import type { DataSnapshot } from './useData'
import { brandById, outletById } from '../derived'

export type StoreOption = {
  key: string
  brandId: string
  outletId: string
  brandName: string
  outletName: string
  brandColor: string
}

export type StoreGroup = {
  brandName: string
  brandColor: string
  options: StoreOption[]
}

/** One option per store (brand+outlet), sorted by brand name then outlet name. */
export function storeOptions(data: DataSnapshot): StoreOption[] {
  return data.stores
    .map((s) => {
      const b = brandById(data, s.brandId)
      const o = outletById(data, s.outletId)
      return {
        key: `${s.brandId}|${s.outletId}`,
        brandId: s.brandId,
        outletId: s.outletId,
        brandName: b.name,
        outletName: o.name,
        brandColor: b.color,
      }
    })
    .sort((a, b) => a.brandName.localeCompare(b.brandName) || a.outletName.localeCompare(b.outletName))
}

/** Case-insensitive substring match over the "brand · outlet" label. */
export function filterStores(options: StoreOption[], query: string): StoreOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.filter((o) => `${o.brandName} · ${o.outletName}`.toLowerCase().includes(q))
}

/** Ordered brand groups, preserving the incoming (sorted) option order. */
export function groupByBrand(options: StoreOption[]): StoreGroup[] {
  const groups: StoreGroup[] = []
  for (const o of options) {
    let g = groups.find((x) => x.brandName === o.brandName)
    if (!g) {
      g = { brandName: o.brandName, brandColor: o.brandColor, options: [] }
      groups.push(g)
    }
    g.options.push(o)
  }
  return groups
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/queries/storePicker.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/data/queries/storePicker.ts src/data/queries/storePicker.test.ts
git commit -m "feat: pure store-picker logic (options, filter, group-by-brand)"
```

---

### Task 2: StoreCombobox component + wire into ScheduleModal

**Files:**
- Create: `src/components/StoreCombobox.tsx`
- Modify: `src/components/ScheduleModal.tsx` (replace the store chip grid at lines 141-157; add imports)

**Interfaces:**
- Consumes: `StoreOption`, `filterStores`, `groupByBrand` (from `src/data/queries/storePicker`); `storeOptions` (used by `ScheduleModal`); `chip` (from `src/theme`); `Icon` (from `./Icon`).
- Produces:
  - `export function StoreCombobox(props: { options: StoreOption[]; value: string; onChange: (key: string) => void }): JSX.Element`

- [ ] **Step 1: Create the StoreCombobox component**

Create `src/components/StoreCombobox.tsx`:

```tsx
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { chip } from '../theme'
import { Icon } from './Icon'
import { filterStores, groupByBrand, type StoreOption } from '../data/queries/storePicker'

const groupHeader: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: 'var(--dim)',
  padding: '8px 12px 4px',
}

const inputStyle: CSSProperties = {
  flex: 1,
  border: 'none',
  background: 'none',
  outline: 'none',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 13,
  color: 'var(--text)',
}

const dot = (color: string): CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: 2,
  background: color,
  flexShrink: 0,
})

export function StoreCombobox({
  options,
  value,
  onChange,
}: {
  options: StoreOption[]
  value: string
  onChange: (key: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.key === value) ?? null

  // Close the dropdown on any click outside this control.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const pick = (key: string) => {
    onChange(key)
    setQuery('')
    setOpen(false)
  }

  const matches = filterStores(options, query)
  const groups = groupByBrand(matches)

  // Collapsed state: a chip showing the selected store with a change/clear affordance.
  if (selected && !open) {
    return (
      <div ref={rootRef} style={{ display: 'flex' }}>
        <button
          onClick={() => setOpen(true)}
          style={{ ...chip(true), maxWidth: '100%' }}
          title="Change store"
        >
          <span style={dot(selected.brandColor)} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected.brandName} · {selected.outletName}
          </span>
          <Icon name="close" size={15} color="#fff" />
        </button>
      </div>
    )
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          background: 'var(--surface2)',
          borderRadius: 8,
          padding: '9px 12px',
        }}
      >
        <Icon name="search" size={16} color="var(--dim)" />
        <input
          autoFocus={open}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'Enter' && matches.length === 1) {
              e.preventDefault()
              pick(matches[0].key)
            }
          }}
          placeholder="Search brand or outlet…"
          style={inputStyle}
        />
      </div>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 5,
            maxHeight: 260,
            overflow: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            boxShadow: '0 12px 30px rgba(0,0,0,.18)',
          }}
        >
          {matches.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--dim)', padding: '12px 14px' }}>
              No stores match.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.brandName}>
                <div style={groupHeader}>{g.brandName}</div>
                {g.options.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => pick(o.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: o.key === value ? 'var(--surface2)' : 'none',
                      cursor: 'pointer',
                      padding: '9px 14px',
                      fontFamily: "'IBM Plex Sans'",
                      fontSize: 13,
                      color: 'var(--text)',
                    }}
                  >
                    <span style={dot(o.brandColor)} />
                    {o.brandName} · {o.outletName}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into ScheduleModal**

In `src/components/ScheduleModal.tsx`, add the imports near the existing imports (after the `scheduleTasks` import at line 9):

```tsx
import { StoreCombobox } from './StoreCombobox'
import { storeOptions } from '../data/queries/storePicker'
```

Then replace the store chip grid — the whole `<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>…</div>` block that maps `data.stores` (lines 141-157) — with:

```tsx
<StoreCombobox
  options={storeOptions(data)}
  value={af.storeKey}
  onChange={(key) => setAf('storeKey', key)}
/>
```

Leave the field label (line 124) and the empty-stores hint (lines 125-140) exactly as they are. Do not touch the "Assign staff" block or anything below it.

- [ ] **Step 3: (No icon work needed)**

`Icon` renders `name` directly as a Material Symbols ligature — there is no icon map. `<Icon name="search" />` and `<Icon name="close" />` both resolve to their Material Symbols glyphs with no extra work, and `color` accepts any string including CSS vars like `"var(--dim)"`. Nothing to do here; proceed to the build.

- [ ] **Step 4: Type-check and build**

Run: `npm run build`
Expected: PASS — `tsc -b` reports no errors (no unused locals; the old `brandById`/`outletById` calls inside the removed grid are gone, but they are still used elsewhere in the file — confirm the build passes) and `vite build` completes.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests green, including `storePicker.test.ts`.

- [ ] **Step 6: Manual smoke check**

Run: `npm run dev`, open the app, click "Schedule a visit". Confirm:
- The store field shows a search input, not a chip grid.
- Typing "nik" filters to Nike stores, grouped under a "NIKE" header.
- Clicking a store collapses the control to a single chip; the "Assign staff" list populates for that store.
- Clicking the chip's × reopens the search; Escape and click-outside close the dropdown.

- [ ] **Step 7: Commit**

```bash
git add src/components/StoreCombobox.tsx src/components/ScheduleModal.tsx
git commit -m "feat: searchable store combobox in schedule-a-visit modal"
```

---

## Self-Review

**Spec coverage:**
- Searchable combobox replacing chip grid → Task 2, Step 2.
- Pure `storePicker.ts` (`StoreOption`, `storeOptions`, `filterStores`, `groupByBrand`) + tests → Task 1.
- `StoreCombobox.tsx` presentational, local `query`/`open` state, reuses `chip()` + brand dot → Task 2, Step 1.
- Search over both brand and outlet tokens → `filterStores` matches the combined "brand · outlet" string; tested.
- Dropdown grouped by brand, ~260px scroll, "No stores match" empty line → Task 2, Step 1.
- Collapse to selected chip with change/× affordance → Task 2, Step 1.
- Close on pick / Escape / click-outside → Task 2, Step 1.
- Minimal keyboard (Escape closes, Enter selects sole match) → Task 2, Step 1.
- Staff field unchanged; empty-stores hint retained → Task 2, Step 2 (explicit "do not touch").
- Existing `staffId`-reset effect still works → unchanged (relies on `af.storeKey`, which the combobox still sets).

**Placeholder scan:** No TBD/TODO; all code shown in full. Icon fallback (Step 3) gives an explicit action rather than assuming.

**Type consistency:** `StoreOption`/`StoreGroup` fields (`key`, `brandId`, `outletId`, `brandName`, `outletName`, `brandColor`) are identical across `storePicker.ts`, its tests, and `StoreCombobox.tsx`. `onChange(key: string)` matches `setAf('storeKey', key)`. Store key format `` `${brandId}|${outletId}` `` matches `af.storeKey.split('|')` usage elsewhere in the modal.
