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
