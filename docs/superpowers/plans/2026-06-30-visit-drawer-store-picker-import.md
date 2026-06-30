# Visit Drawer: Collapsed Store Picker + Import Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the visit drawer's store selector to a single current-store button that expands on click, and add an "Import" button that bulk-adds saved task templates (not already in the checklist) to the visit.

**Architecture:** One new pure helper (`importableTemplates`) with tests, one new batched mutation (`useImportVisitTasks`), and presentational changes to `VisitDrawer.tsx` driven by three new local state flags. No schema change.

**Tech Stack:** React 18 + TypeScript + Vite, React Query, Supabase JS client, Vitest (node env).

## Global Constraints

- All styling is inline `style={}` objects driven by CSS variables (`src/theme.ts`, `src/index.css`). No CSS framework, no className.
- DB rows are snake_case; the domain model is camelCase. Mutations write snake_case columns directly.
- Mutations invalidate `queryKeys.visits` on success.
- Build fails on unused locals/params (`noUnusedLocals`/`noUnusedParameters`). `npm run build` is the gate for UI/mutation tasks.
- Tests only match `src/**/*.test.ts`, node environment — pure logic only, no React/DOM tests.
- Extract non-trivial pure logic into a `.test.ts`-covered module.
- Errors surface via the existing `alert(e.message)` pattern.
- Duplicate matching for the import filter is case-insensitive + trimmed.

---

### Task 1: `importableTemplates` pure helper

**Files:**
- Modify: `src/data/queries/visitEdit.ts` (append one function)
- Test: `src/data/queries/visitEdit.test.ts` (append one describe block)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `importableTemplates(templates: { id: string; label: string }[], tasks: { label: string }[]): { id: string; label: string }[]` — returns, in input order, the templates whose normalized label (`label.trim().toLowerCase()`) does not equal any task's normalized label.

- [ ] **Step 1: Write the failing test**

Append to `src/data/queries/visitEdit.test.ts`. Also add `importableTemplates` to the existing import line at the top so it reads:
`import { taskHasResult, importableTemplates } from './visitEdit'`

Then append this describe block at the end of the file:

```typescript
describe('importableTemplates', () => {
  const tpl = (id: string, label: string) => ({ id, label })

  it('returns all templates when the checklist is empty', () => {
    const templates = [tpl('t1', 'Stock'), tpl('t2', 'Cleanliness')]
    expect(importableTemplates(templates, [])).toEqual(templates)
  })

  it('returns an empty array when there are no templates', () => {
    expect(importableTemplates([], [{ label: 'Stock' }])).toEqual([])
  })

  it('excludes a template whose label exactly matches a task', () => {
    const templates = [tpl('t1', 'Stock'), tpl('t2', 'Cleanliness')]
    expect(importableTemplates(templates, [{ label: 'Stock' }])).toEqual([tpl('t2', 'Cleanliness')])
  })

  it('excludes a template that differs only by case or surrounding whitespace', () => {
    const templates = [tpl('t1', 'Stock Check'), tpl('t2', 'Cleanliness')]
    const tasks = [{ label: '  stock check ' }]
    expect(importableTemplates(templates, tasks)).toEqual([tpl('t2', 'Cleanliness')])
  })

  it('preserves input order of the surviving templates', () => {
    const templates = [tpl('t1', 'A'), tpl('t2', 'B'), tpl('t3', 'C')]
    expect(importableTemplates(templates, [{ label: 'B' }])).toEqual([tpl('t1', 'A'), tpl('t3', 'C')])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/queries/visitEdit.test.ts`
Expected: FAIL — `importableTemplates` is not exported / not a function.

- [ ] **Step 3: Write minimal implementation**

Append to `src/data/queries/visitEdit.ts`:

```typescript
/** Templates whose label is not already present in the visit's checklist (case-insensitive, trimmed). */
export function importableTemplates(
  templates: { id: string; label: string }[],
  tasks: { label: string }[],
): { id: string; label: string }[] {
  const present = new Set(tasks.map((t) => t.label.trim().toLowerCase()))
  return templates.filter((tpl) => !present.has(tpl.label.trim().toLowerCase()))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/queries/visitEdit.test.ts`
Expected: PASS (taskHasResult's 4 tests + importableTemplates' 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/queries/visitEdit.ts src/data/queries/visitEdit.test.ts
git commit -m "feat: importableTemplates helper for visit task import"
```

---

### Task 2: `useImportVisitTasks` batched mutation

**Files:**
- Modify: `src/data/queries/useVisitMutations.ts` (append one hook)

**Interfaces:**
- Consumes: `supabase`, `queryKeys` (already imported in the file).
- Produces: `useImportVisitTasks()` → mutation accepting `{ visitId: string; labels: string[] }`. No-op when `labels` is empty. Otherwise reads the visit's current max `sort` once, then inserts all labels in a single `visit_tasks` insert with consecutive sorts starting at `max+1` (or `0` when the visit has no tasks), each `status: 'pending'`, `remark: ''`. Invalidates `queryKeys.visits` on success.

  > No unit test: thin Supabase wiring, mirrors `useAddVisitTask`. Gate is `npm run build`.

- [ ] **Step 1: Append the mutation hook**

Add at the end of `src/data/queries/useVisitMutations.ts`:

```typescript
export function useImportVisitTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { visitId: string; labels: string[] }) => {
      if (!input.labels.length) return
      const { data: rows, error: qErr } = await supabase
        .from('visit_tasks')
        .select('sort')
        .eq('visit_id', input.visitId)
        .order('sort', { ascending: false })
        .limit(1)
      if (qErr) throw qErr
      const base = rows && rows.length ? rows[0].sort + 1 : 0
      const inserts = input.labels.map((label, i) => ({
        visit_id: input.visitId,
        label,
        status: 'pending',
        remark: '',
        sort: base + i,
      }))
      const { error } = await supabase.from('visit_tasks').insert(inserts)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS (tsc + vite build; no unused-locals errors).

- [ ] **Step 3: Commit**

```bash
git add src/data/queries/useVisitMutations.ts
git commit -m "feat: useImportVisitTasks batched mutation"
```

---

### Task 3: Collapse the store selector to a click-to-expand picker

**Files:**
- Modify: `src/components/VisitDrawer.tsx`

**Interfaces:**
- Consumes: existing `useUpdateVisit`, `staffForStore`, `brandById`, `outletById`, `chip`, `Icon`, `useState`.
- Produces: a collapsed current-store button that toggles the store chip list; no change to the mutation behavior.

- [ ] **Step 1: Add the `storePickerOpen` state**

In `src/components/VisitDrawer.tsx`, alongside the existing `const [newTaskLabel, setNewTaskLabel] = useState('')` (around line 25), add:

```typescript
  const [storePickerOpen, setStorePickerOpen] = useState(false)
```

- [ ] **Step 2: Replace the always-visible store chip row with a collapsed button + expandable list**

Replace the entire current Store block — the `{/* Store (brand · outlet) */}` comment and the `<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>…</div>` that maps `data.stores` (lines 70–94) — with:

```tsx
            {/* Store (brand · outlet) — collapsed, click to choose */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                onClick={() => setStorePickerOpen((o) => !o)}
                aria-expanded={storePickerOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: 'fit-content',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  borderRadius: 8,
                  padding: '7px 11px',
                  fontFamily: "'IBM Plex Sans'",
                  fontSize: 13,
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, background: brandById(data, openF.brandId).color }} />
                {brandById(data, openF.brandId).name} · {outletById(data, openF.outletId).name}
                <Icon name={storePickerOpen ? 'expand_less' : 'expand_more'} size={18} />
              </button>
              {storePickerOpen && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {data.stores.map((s) => {
                    const b = brandById(data, s.brandId)
                    const o = outletById(data, s.outletId)
                    const active = s.brandId === openF.brandId && s.outletId === openF.outletId
                    return (
                      <button
                        key={`${s.brandId}|${s.outletId}`}
                        onClick={() => {
                          setStorePickerOpen(false)
                          if (active) return
                          const list = staffForStore(data, s.brandId, s.outletId)
                          updateVisit.mutate(
                            { visitId: openF.id, brandId: s.brandId, outletId: s.outletId, staffId: list[0]?.id ?? null },
                            { onError: (e) => alert(e.message) },
                          )
                        }}
                        style={chip(active)}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
                        {b.name} · {o.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
```

Note: `brandById`/`outletById` assume the id exists and use `!` internally — fine here since `openF.brandId`/`openF.outletId` are the visit's own store. The `expand_more`/`expand_less` Material Symbol names match the existing `Icon` usage convention.

- [ ] **Step 3: Verify the build and dev render**

Run: `npm run build`
Expected: PASS. Then `npm run dev`, open a visit: the header shows a single current-store button with a chevron; clicking it reveals the store chips; picking a different store re-points the visit (staff resets) and collapses; picking the current store just collapses; the header is compact when collapsed.

- [ ] **Step 4: Commit**

```bash
git add src/components/VisitDrawer.tsx
git commit -m "feat: collapse visit drawer store selector into a click-to-expand picker"
```

---

### Task 4: Import tasks from templates

**Files:**
- Modify: `src/components/VisitDrawer.tsx`

**Interfaces:**
- Consumes: `useImportVisitTasks` (Task 2), `importableTemplates` (Task 1), `useState`, `Icon`.
- Produces: an Import button + expandable multi-select panel that bulk-adds templates.

- [ ] **Step 1: Add imports, the mutation hook, and state**

In `src/components/VisitDrawer.tsx`:

Extend the mutations import (the line importing from `'../data/queries/useVisitMutations'`) to include `useImportVisitTasks`:

```typescript
import { useSetTaskStatus, useSetTaskRemark, useMarkAllSuccess, useUpdateVisit, useAddVisitTask, useRemoveVisitTask, useImportVisitTasks } from '../data/queries/useVisitMutations'
```

Extend the visitEdit import to include `importableTemplates`:

```typescript
import { taskHasResult, importableTemplates } from '../data/queries/visitEdit'
```

Add the hook and state near the other hooks/state (around lines 23–25):

```typescript
  const importTasks = useImportVisitTasks()
  const [importOpen, setImportOpen] = useState(false)
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([])
```

- [ ] **Step 2: Compute the importable list and an import handler**

After `const storeStaff = ...` (around line 33) and the `submitTask` definition, add:

```typescript
  const importable = importableTemplates(data.taskTemplates, openF.tasks)

  const toggleImport = (id: string) =>
    setSelectedImportIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const runImport = () => {
    const labels = importable.filter((t) => selectedImportIds.includes(t.id)).map((t) => t.label)
    if (!labels.length) return
    importTasks.mutate(
      { visitId: openF.id, labels },
      {
        onSuccess: () => {
          setSelectedImportIds([])
          setImportOpen(false)
        },
        onError: (err) => alert(err.message),
      },
    )
  }
```

- [ ] **Step 3: Add the Import button next to Add, and the expandable panel**

In the add-task row (the `<div style={{ display: 'flex', gap: 8, marginTop: 9 }}>` containing the task `<input>` and the `Add` button, around lines 243–281), add an **Import** button immediately after the closing `</button>` of the `Add` button (i.e. as the third child of that flex row, after Add):

```tsx
            <button
              type="button"
              onClick={() => setImportOpen((o) => !o)}
              disabled={importable.length === 0}
              aria-expanded={importOpen}
              title={importable.length === 0 ? 'No templates left to import' : 'Import saved tasks'}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                borderRadius: 8,
                padding: '9px 16px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13,
                fontWeight: 600,
                cursor: importable.length === 0 ? 'not-allowed' : 'pointer',
                opacity: importable.length === 0 ? 0.5 : 1,
              }}
            >
              Import
            </button>
```

Then, immediately AFTER the add-task row `</div>` (the one opened by `<div style={{ display: 'flex', gap: 8, marginTop: 9 }}>`), add the panel:

```tsx
          {importOpen && importable.length > 0 && (
            <div
              style={{
                marginTop: 9,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                borderRadius: 9,
                padding: '11px 13px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--dim)' }}>
                Import from saved tasks
              </div>
              {importable.map((t) => {
                const checked = selectedImportIds.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleImport(t.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                  >
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
                    <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{t.label}</span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={runImport}
                disabled={selectedImportIds.length === 0}
                style={{
                  alignSelf: 'flex-start',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontFamily: "'IBM Plex Sans'",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: selectedImportIds.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: selectedImportIds.length === 0 ? 0.5 : 1,
                }}
              >
                Import {selectedImportIds.length || ''}
              </button>
            </div>
          )}
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: PASS (no type or unused-locals errors).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS (includes the expanded `visitEdit.test.ts`).

- [ ] **Step 6: Dev render check**

Run `npm run dev`, open a visit: the Import button sits right of Add; it's disabled when no templates remain importable; clicking it expands a checkbox list of saved templates not already in the checklist; selecting some and clicking "Import N" adds them as pending tasks, the panel closes, the selection clears, and the resolved/total counter updates. Removing a checklist task whose label matches a template makes that template reappear in the import list.

- [ ] **Step 7: Commit**

```bash
git add src/components/VisitDrawer.tsx
git commit -m "feat: import saved task templates into a visit checklist"
```

---

## Self-Review Notes

- **Spec coverage:** Collapsed store button + expand-on-click (Task 3); store pick resets staff + collapses, current-store pick collapses only (Task 3); Import button right of Add, disabled when empty (Task 4); multi-select panel of templates not already in checklist (Task 4 + `importableTemplates` Task 1); "Import N" batched insert (Task 2 + Task 4); case-insensitive trimmed dedupe (Task 1); local state flags (Tasks 3–4); `importableTemplates` tested (Task 1). All spec sections map to a task.
- **Type consistency:** `useImportVisitTasks` `{ visitId, labels }` (Task 2) consumed in Task 4. `importableTemplates(templates, tasks)` (Task 1) consumed in Task 4 over `data.taskTemplates` (`{ id, label, sort }` — structurally satisfies `{ id, label }`) and `openF.tasks` (`{ label }`). `selectedImportIds: string[]` holds template ids; `runImport` maps ids → labels.
- **Placeholder scan:** No TBD/TODO; every code step shows full code.
