import type { Screen } from './store'

export interface NavDef {
  key: Screen
  label: string
  short: string
  icon: string
}

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
