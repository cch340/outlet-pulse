import type { Screen, ManageTab, VisitFilter } from './store'

/** The subset of UI state we mirror into the URL hash. Ephemeral overlays
 *  (modals, drawers, detail ids) are intentionally excluded. */
export interface UrlState {
  screen: Screen
  visitFilter: VisitFilter
  q: string
  manageTab: ManageTab
}

export const DEFAULT_URL_STATE: UrlState = {
  screen: 'dashboard',
  visitFilter: 'all',
  q: '',
  manageTab: 'brands',
}

const SCREENS: readonly Screen[] = ['dashboard', 'stores', 'visits', 'manage']
const VISIT_FILTERS: readonly VisitFilter[] = ['all', 'pending', 'attention', 'overdue', 'done']
const MANAGE_TABS: readonly ManageTab[] = ['brands', 'outlets', 'stores', 'staff', 'tasks']

/** Serialize UI state to a hash like `#/visits?status=overdue&q=abc`.
 *  Defaults are omitted, and params are only emitted for the screen they
 *  belong to. Always returns at least `#/<screen>`. */
export function toHash(s: UrlState): string {
  const params = new URLSearchParams()
  if (s.screen === 'visits') {
    if (s.visitFilter !== 'all') params.set('status', s.visitFilter)
    if (s.q !== '') params.set('q', s.q)
  } else if (s.screen === 'manage') {
    if (s.manageTab !== 'brands') params.set('tab', s.manageTab)
  }
  const query = params.toString()
  return `#/${s.screen}${query ? `?${query}` : ''}`
}

/** Parse a hash back into UI state. Tolerant of missing/garbage input:
 *  unknown values fall back to defaults, and params are only honored for
 *  the screen they belong to. Accepts the hash with or without a leading '#'. */
export function parseHash(hash: string): UrlState {
  let h = hash ?? ''
  if (h.startsWith('#')) h = h.slice(1)
  if (h.startsWith('/')) h = h.slice(1)

  const qIndex = h.indexOf('?')
  const path = qIndex === -1 ? h : h.slice(0, qIndex)
  const query = qIndex === -1 ? '' : h.slice(qIndex + 1)
  const params = new URLSearchParams(query)

  const screen: Screen = SCREENS.includes(path as Screen) ? (path as Screen) : 'dashboard'

  let visitFilter: VisitFilter = 'all'
  let q = ''
  let manageTab: ManageTab = 'brands'

  if (screen === 'visits') {
    const status = params.get('status')
    if (status && VISIT_FILTERS.includes(status as VisitFilter)) visitFilter = status as VisitFilter
    q = params.get('q') ?? ''
  } else if (screen === 'manage') {
    const tab = params.get('tab')
    if (tab && MANAGE_TABS.includes(tab as ManageTab)) manageTab = tab as ManageTab
  }

  return { screen, visitFilter, q, manageTab }
}
