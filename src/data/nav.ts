import type { Screen } from './store'

export interface NavDef {
  key: Screen
  label: string
  short: string
  icon: string
}

export const NAV: NavDef[] = [
  { key: 'dashboard', label: 'Dashboard', short: 'Home', icon: 'space_dashboard' },
  { key: 'brands', label: 'Brands', short: 'Brands', icon: 'sell' },
  { key: 'outlets', label: 'Outlets', short: 'Outlets', icon: 'storefront' },
  { key: 'staff', label: 'Staff', short: 'Staff', icon: 'groups' },
  { key: 'visits', label: 'Visits', short: 'Visits', icon: 'fact_check' },
]

export const TITLES: Record<Screen, [string, string]> = {
  dashboard: ['Summary', 'Year & month visit overview'],
  brands: ['Brand Management', 'Brands and the outlets they operate in'],
  outlets: ['Outlet Management', 'Malls and the brands hosted'],
  staff: ['Staff Management', 'Assignments and transfers'],
  visits: ['Visits', 'Scheduled store visits & checks'],
}
