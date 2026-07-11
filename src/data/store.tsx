import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ScheduleTaskItem } from './queries/scheduleTasks'
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  parseSettings,
  serializeSettings,
  resolveTheme,
  type Settings,
  type ThemePref,
} from './settings'

/** Viewport width (px) at or below which we render the mobile layout. */
export const MOBILE_BREAKPOINT = 768

function detectMobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
}

function detectSystemDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readSettings(): Settings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS
  return parseSettings(localStorage.getItem(SETTINGS_STORAGE_KEY))
}

function persistSettings(s: Settings): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(SETTINGS_STORAGE_KEY, serializeSettings(s))
}

export type Screen = 'dashboard' | 'stores' | 'visits' | 'manage'
export type ManageTab = 'brands' | 'outlets' | 'stores' | 'staff' | 'tasks'
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
  brandDetailId: string | null
  outletDetailId: string | null
  staffDetailId: string | null
  staffBrandFilter: StaffBrandFilter
  visitFilter: VisitFilter
  // overlays
  openVisitId: string | null
  storeVisits: { brandId: string; outletId: string } | null
  transferStaffId: string | null
  transferForm: TransferForm | null
  addOpen: boolean
  addForm: AddForm | null
  brandModal: { mode: 'add' } | { mode: 'edit'; id: string } | null
  outletModal: { mode: 'add' } | { mode: 'edit'; id: string } | null
  staffModal: { mode: 'add' } | { mode: 'edit'; id: string } | null
  settingsOpen: boolean
  // theme
  accent: string
  /** User preference (light/dark/system); persisted. */
  themePref: ThemePref
  /** Resolved mode actually rendered by `rootStyle` (system → light/dark). */
  themeMode: ThemeMode
  density: Density
}

function seed(): AppState {
  const settings = readSettings()
  return {
    activeScreen: 'dashboard',
    manageTab: 'brands',
    isMobile: detectMobile(),
    q: '',
    brandDetailId: null,
    outletDetailId: null,
    staffDetailId: null,
    staffBrandFilter: 'all',
    visitFilter: 'all',
    openVisitId: null,
    storeVisits: null,
    transferStaffId: null,
    transferForm: null,
    addOpen: false,
    addForm: null,
    brandModal: null,
    outletModal: null,
    staffModal: null,
    settingsOpen: false,
    accent: settings.accent,
    themePref: settings.themePref,
    themeMode: resolveTheme(settings.themePref, detectSystemDark()),
    density: settings.density,
  }
}

export interface StoreActions {
  go(s: Screen): void
  openBrandDetail(id: string): void
  closeBrandDetail(): void
  openOutletDetail(id: string): void
  closeOutletDetail(): void
  openStaffDetail(id: string): void
  closeStaffDetail(): void
  setStaffBrandFilter(id: StaffBrandFilter): void
  setVisitFilter(f: VisitFilter): void
  openVisit(id: string): void
  closeVisit(): void
  openStoreVisits(brandId: string, outletId: string): void
  closeStoreVisits(): void
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
  setQ(q: string): void
  openSettings(): void
  closeSettings(): void
  setAccent(c: string): void
  setThemePref(p: ThemePref): void
  setDensity(d: Density): void
}

type StoreCtx = { state: AppState } & StoreActions

const Ctx = createContext<StoreCtx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(seed)

  const actions = useMemo<StoreActions>(() => {
    const patch = (p: Partial<AppState>) => setState((s) => ({ ...s, ...p }))
    // Write the persisted theme/accent/density subset whenever one changes.
    const persistFrom = (s: AppState) =>
      persistSettings({ themePref: s.themePref, accent: s.accent, density: s.density })
    return {
      // Clear the global search when leaving a screen — it's scoped to Visits.
      go: (activeScreen) => patch({ activeScreen, q: '', openVisitId: null, storeVisits: null }),
      openBrandDetail: (brandDetailId) => patch({ brandDetailId }),
      closeBrandDetail: () => patch({ brandDetailId: null }),
      openOutletDetail: (outletDetailId) => patch({ outletDetailId }),
      closeOutletDetail: () => patch({ outletDetailId: null }),
      openStaffDetail: (staffDetailId) => patch({ staffDetailId }),
      closeStaffDetail: () => patch({ staffDetailId: null }),
      setStaffBrandFilter: (staffBrandFilter) => patch({ staffBrandFilter }),
      setVisitFilter: (visitFilter) => patch({ visitFilter }),
      openVisit: (openVisitId) => patch({ openVisitId }),
      closeVisit: () => patch({ openVisitId: null }),
      openStoreVisits: (brandId, outletId) => patch({ storeVisits: { brandId, outletId } }),
      closeStoreVisits: () => patch({ storeVisits: null }),
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
      setQ: (q) => patch({ q }),
      openSettings: () => patch({ settingsOpen: true }),
      closeSettings: () => patch({ settingsOpen: false }),
      setAccent: (accent) =>
        setState((s) => {
          const next = { ...s, accent }
          persistFrom(next)
          return next
        }),
      setThemePref: (themePref) =>
        setState((s) => {
          const next = { ...s, themePref, themeMode: resolveTheme(themePref, detectSystemDark()) }
          persistFrom(next)
          return next
        }),
      setDensity: (density) =>
        setState((s) => {
          const next = { ...s, density }
          persistFrom(next)
          return next
        }),
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

  // When the preference is `system`, track OS light/dark changes live.
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () =>
      setState((s) => {
        if (s.themePref !== 'system') return s
        const themeMode = resolveTheme('system', mql.matches)
        return s.themeMode === themeMode ? s : { ...s, themeMode }
      })
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
