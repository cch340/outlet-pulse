import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

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
  openTransfer(id: string, brandId: string, outletId: string): void
  closeTransfer(): void
  setTf(k: keyof TransferForm, v: string): void
  openAdd(): void
  closeAdd(): void
  setAf<K extends keyof AddForm>(k: K, v: AddForm[K]): void
  toggleAfTask(i: number): void
  setAccent(c: string): void
  setThemeMode(m: ThemeMode): void
  setDensity(d: Density): void
}

type StoreCtx = { state: AppState } & StoreActions

const Ctx = createContext<StoreCtx | null>(null)

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
      openTransfer: (id, brandId, outletId) =>
        patch({
          transferStaffId: id,
          transferForm: { brandId, outletId, reason: '', date: todayISO() },
        }),
      closeTransfer: () => patch({ transferStaffId: null, transferForm: null }),
      setTf: (k, v) => setState((s) => ({ ...s, transferForm: { ...s.transferForm!, [k]: v } })),
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
      setAccent: (accent) => patch({ accent }),
      setThemeMode: (themeMode) => patch({ themeMode }),
      setDensity: (density) => patch({ density }),
    }
  }, [])

  return <Ctx.Provider value={{ state, ...actions }}>{children}</Ctx.Provider>
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
