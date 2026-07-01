import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ScheduleTaskItem } from './queries/scheduleTasks'

/** Viewport width (px) at or below which we render the mobile layout. */
export const MOBILE_BREAKPOINT = 768

function detectMobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
}

export type Screen = 'dashboard' | 'visits' | 'manage'
export type ManageTab = 'brands' | 'outlets' | 'staff' | 'tasks'
export type StaffBrandFilter = 'all' | string
export type VisitFilter = 'all' | 'pending' | 'attention' | 'overdue' | 'done'
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
  tasks: ScheduleTaskItem[]
}

export interface AppState {
  // navigation / view
  activeScreen: Screen
  manageTab: ManageTab
  isMobile: boolean
  q: string
  selectedBrandId: string
  selectedOutletId: string
  staffBrandFilter: StaffBrandFilter
  visitFilter: VisitFilter
  // overlays
  openVisitId: string | null
  transferStaffId: string | null
  transferForm: TransferForm | null
  addOpen: boolean
  addForm: AddForm | null
  brandModal: { mode: 'add' } | { mode: 'edit'; id: string } | null
  outletModal: { mode: 'add' } | { mode: 'edit'; id: string } | null
  staffModal: { mode: 'add' } | { mode: 'edit'; id: string } | null
  // theme
  accent: string
  themeMode: ThemeMode
  density: Density
}

function seed(): AppState {
  return {
    activeScreen: 'dashboard',
    manageTab: 'brands',
    isMobile: detectMobile(),
    q: '',
    selectedBrandId: '',
    selectedOutletId: '',
    staffBrandFilter: 'all',
    visitFilter: 'all',
    openVisitId: null,
    transferStaffId: null,
    transferForm: null,
    addOpen: false,
    addForm: null,
    brandModal: null,
    outletModal: null,
    staffModal: null,
    accent: '#64748b',
    themeMode: 'light',
    density: 'comfortable',
  }
}

export interface StoreActions {
  go(s: Screen): void
  setSearch(q: string): void
  selBrand(id: string): void
  selOutlet(id: string): void
  setStaffBrandFilter(id: StaffBrandFilter): void
  setVisitFilter(f: VisitFilter): void
  openVisit(id: string): void
  closeVisit(): void
  openTransfer(id: string, brandId: string, outletId: string): void
  closeTransfer(): void
  setTf(k: keyof TransferForm, v: string): void
  openAdd(): void
  closeAdd(): void
  setAf<K extends keyof AddForm>(k: K, v: AddForm[K]): void
  openBrandModal(payload: { mode: 'add' } | { mode: 'edit'; id: string }): void
  closeBrandModal(): void
  openOutletModal(payload: { mode: 'add' } | { mode: 'edit'; id: string }): void
  closeOutletModal(): void
  openStaffModal(payload: { mode: 'add' } | { mode: 'edit'; id: string }): void
  closeStaffModal(): void
  setManageTab(tab: ManageTab): void
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
      go: (activeScreen) => patch({ activeScreen, openVisitId: null }),
      setSearch: (q) => patch({ q }),
      selBrand: (selectedBrandId) => patch({ selectedBrandId }),
      selOutlet: (selectedOutletId) => patch({ selectedOutletId }),
      setStaffBrandFilter: (staffBrandFilter) => patch({ staffBrandFilter }),
      setVisitFilter: (visitFilter) => patch({ visitFilter }),
      openVisit: (openVisitId) => patch({ openVisitId }),
      closeVisit: () => patch({ openVisitId: null }),
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
          addForm: { storeKey: '', date: todayISO(), staffId: '', tasks: [] },
        }),
      closeAdd: () => patch({ addOpen: false, addForm: null }),
      setAf: (k, v) => setState((s) => ({ ...s, addForm: { ...s.addForm!, [k]: v } })),
      openBrandModal: (brandModal) => patch({ brandModal }),
      closeBrandModal: () => patch({ brandModal: null }),
      openOutletModal: (outletModal) => patch({ outletModal }),
      closeOutletModal: () => patch({ outletModal: null }),
      openStaffModal: (staffModal) => patch({ staffModal }),
      closeStaffModal: () => patch({ staffModal: null }),
      setManageTab: (manageTab) => patch({ manageTab }),
      setAccent: (accent) => patch({ accent }),
      setThemeMode: (themeMode) => patch({ themeMode }),
      setDensity: (density) => patch({ density }),
    }
  }, [])

  // Keep isMobile in sync with the actual viewport width.
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const onChange = () => setState((s) => (s.isMobile === mql.matches ? s : { ...s, isMobile: mql.matches }))
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
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
