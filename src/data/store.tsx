import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Brand, FollowUp, Outlet, Staff, Store } from './model'
import { DEFAULT_TASKS } from './model'
import { seedBrands, seedFollowups, seedOutlets, seedStaff, seedStores } from './seed'

export type Screen = 'dashboard' | 'brands' | 'outlets' | 'staff' | 'followups'
export type Period = 'month' | 'year'
export type StaffBrandFilter = 'all' | string
export type FuFilter = 'all' | 'pending' | 'overdue' | 'done'
export type ThemeMode = 'light' | 'dark'
export type Density = 'comfortable' | 'compact'

export interface TransferForm {
  brandId: string
  outletId: string
  reason: string
  date: string
}

export interface AddForm {
  storeKey: string
  date: string
  staffId: string
  tasks: boolean[]
}

export interface AppState {
  // collections
  brands: Brand[]
  outlets: Outlet[]
  stores: Store[]
  staff: Staff[]
  followups: FollowUp[]
  // navigation / view
  activeScreen: Screen
  isMobile: boolean
  period: Period
  q: string
  selectedBrandId: string
  selectedOutletId: string
  staffBrandFilter: StaffBrandFilter
  fuFilter: FuFilter
  // overlays
  openFuId: string | null
  transferStaffId: string | null
  transferForm: TransferForm | null
  addOpen: boolean
  addForm: AddForm | null
  // theme
  accent: string
  themeMode: ThemeMode
  density: Density
}

function seed(): AppState {
  return {
    brands: seedBrands,
    outlets: seedOutlets,
    stores: seedStores,
    staff: seedStaff,
    followups: seedFollowups,
    activeScreen: 'dashboard',
    isMobile: false,
    period: 'month',
    q: '',
    selectedBrandId: 'b1',
    selectedOutletId: 'o1',
    staffBrandFilter: 'all',
    fuFilter: 'all',
    openFuId: null,
    transferStaffId: null,
    transferForm: null,
    addOpen: false,
    addForm: null,
    accent: '#64748b',
    themeMode: 'light',
    density: 'comfortable',
  }
}

export interface StoreActions {
  go(s: Screen): void
  setPeriod(p: Period): void
  setSearch(q: string): void
  toggleView(): void
  selBrand(id: string): void
  selOutlet(id: string): void
  setStaffBrandFilter(id: StaffBrandFilter): void
  setFuFilter(f: FuFilter): void
  openFu(id: string): void
  closeFu(): void
  toggleTask(fuId: string, idx: number): void
  markDone(fuId: string): void
  toggleStatus(fuId: string): void
  openTransfer(id: string): void
  closeTransfer(): void
  setTf(k: keyof TransferForm, v: string): void
  confirmTransfer(): void
  openAdd(): void
  closeAdd(): void
  setAf<K extends keyof AddForm>(k: K, v: AddForm[K]): void
  toggleAfTask(i: number): void
  confirmAdd(): void
  setAccent(c: string): void
  setThemeMode(m: ThemeMode): void
  setDensity(d: Density): void
}

type StoreCtx = { state: AppState } & StoreActions

const Ctx = createContext<StoreCtx | null>(null)

// Production: derive "today" from the real clock (prototype used a fixed 2026-06-29).
const monthYear = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(seed)

  const actions = useMemo<StoreActions>(() => {
    const patch = (p: Partial<AppState>) => setState((s) => ({ ...s, ...p }))
    return {
      go: (activeScreen) => patch({ activeScreen, openFuId: null }),
      setPeriod: (period) => patch({ period }),
      setSearch: (q) => patch({ q }),
      toggleView: () => setState((s) => ({ ...s, isMobile: !s.isMobile })),
      selBrand: (selectedBrandId) => patch({ selectedBrandId }),
      selOutlet: (selectedOutletId) => patch({ selectedOutletId }),
      setStaffBrandFilter: (staffBrandFilter) => patch({ staffBrandFilter }),
      setFuFilter: (fuFilter) => patch({ fuFilter }),
      openFu: (openFuId) => patch({ openFuId }),
      closeFu: () => patch({ openFuId: null }),
      toggleTask: (fuId, idx) =>
        setState((s) => ({
          ...s,
          followups: s.followups.map((f) =>
            f.id === fuId
              ? { ...f, tasks: f.tasks.map((t, i) => (i === idx ? { ...t, done: !t.done } : t)) }
              : f,
          ),
        })),
      markDone: (fuId) =>
        setState((s) => ({
          ...s,
          followups: s.followups.map((f) =>
            f.id === fuId ? { ...f, status: 'done', tasks: f.tasks.map((t) => ({ ...t, done: true })) } : f,
          ),
        })),
      toggleStatus: (fuId) =>
        setState((s) => ({
          ...s,
          followups: s.followups.map((f) =>
            f.id === fuId ? { ...f, status: f.status === 'done' ? 'pending' : 'done' } : f,
          ),
        })),
      openTransfer: (id) =>
        setState((s) => {
          const st = s.staff.find((x) => x.id === id)!
          return {
            ...s,
            transferStaffId: id,
            transferForm: { brandId: st.brandId, outletId: st.outletId, reason: '', date: todayISO() },
          }
        }),
      closeTransfer: () => patch({ transferStaffId: null, transferForm: null }),
      setTf: (k, v) => setState((s) => ({ ...s, transferForm: { ...s.transferForm!, [k]: v } })),
      confirmTransfer: () =>
        setState((s) => {
          const id = s.transferStaffId
          const tf = s.transferForm
          if (!id || !tf) return s
          const stamp = monthYear(tf.date)
          return {
            ...s,
            staff: s.staff.map((x) => {
              if (x.id !== id) return x
              const hist = x.history.map((h) => (h.to ? h : { ...h, to: stamp }))
              return {
                ...x,
                brandId: tf.brandId,
                outletId: tf.outletId,
                history: [...hist, { brandId: tf.brandId, outletId: tf.outletId, from: stamp, reason: tf.reason }],
              }
            }),
            transferStaffId: null,
            transferForm: null,
          }
        }),
      openAdd: () =>
        patch({
          addOpen: true,
          addForm: { storeKey: 'b1|o1', date: '2026-07-01', staffId: '', tasks: [true, true, true, false, false] },
        }),
      closeAdd: () => patch({ addOpen: false, addForm: null }),
      setAf: (k, v) => setState((s) => ({ ...s, addForm: { ...s.addForm!, [k]: v } })),
      toggleAfTask: (i) =>
        setState((s) => ({
          ...s,
          addForm: { ...s.addForm!, tasks: s.addForm!.tasks.map((t, j) => (j === i ? !t : t)) },
        })),
      confirmAdd: () =>
        setState((s) => {
          const af = s.addForm!
          const [brandId, outletId] = af.storeKey.split('|')
          const tasks = DEFAULT_TASKS.map((label) => ({ label, done: false })).filter((_, i) => af.tasks[i])
          const id = 'f' + nextId()
          return {
            ...s,
            followups: [
              ...s.followups,
              { id, date: af.date, staffId: af.staffId || null, brandId, outletId, status: 'pending', tasks },
            ],
            addOpen: false,
            addForm: null,
            activeScreen: 'followups',
          }
        }),
      setAccent: (accent) => patch({ accent }),
      setThemeMode: (themeMode) => patch({ themeMode }),
      setDensity: (density) => patch({ density }),
    }
  }, [])

  return <Ctx.Provider value={{ state, ...actions }}>{children}</Ctx.Provider>
}

// monotonic id generator (avoids Date.now in render paths)
let _id = 1000
function nextId() {
  return ++_id
}

function todayISO() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function useStore(): StoreCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore must be used within StoreProvider')
  return v
}
