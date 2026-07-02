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
