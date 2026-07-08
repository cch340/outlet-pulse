import { describe, it, expect } from 'vitest'
import { storeOptions, filterStores, groupByBrand, type StoreOption } from './storePicker'
import type { DataSnapshot } from './useData'

// Minimal DataSnapshot with just the fields storeOptions reads.
const snapshot = {
  brands: [
    { id: 'b-nike', name: 'Nike', color: '#111' },
    { id: 'b-adidas', name: 'Adidas', color: '#222' },
  ],
  outlets: [
    { id: 'o-klcc', name: 'Suria KLCC' },
    { id: 'o-mv', name: 'Mid Valley' },
    { id: 'o-pav', name: 'Pavilion' },
  ],
  stores: [
    { brandId: 'b-nike', outletId: 'o-mv' },
    { brandId: 'b-nike', outletId: 'o-klcc' },
    { brandId: 'b-adidas', outletId: 'o-pav' },
  ],
} as unknown as DataSnapshot

const opts = (): StoreOption[] => storeOptions(snapshot)

describe('storeOptions', () => {
  it('builds one option per store, sorted by brand then outlet', () => {
    expect(opts().map((o) => `${o.brandName} · ${o.outletName}`)).toEqual([
      'Adidas · Pavilion',
      'Nike · Mid Valley',
      'Nike · Suria KLCC',
    ])
  })

  it('sets key, ids and brand color', () => {
    const nikeKlcc = opts().find((o) => o.key === 'b-nike|o-klcc')!
    expect(nikeKlcc).toMatchObject({
      brandId: 'b-nike',
      outletId: 'o-klcc',
      brandName: 'Nike',
      outletName: 'Suria KLCC',
      brandColor: '#111',
    })
  })
})

describe('filterStores', () => {
  it('matches on the brand token, case-insensitively', () => {
    expect(filterStores(opts(), 'nik').map((o) => o.key)).toEqual([
      'b-nike|o-mv',
      'b-nike|o-klcc',
    ])
  })

  it('matches on the outlet token', () => {
    expect(filterStores(opts(), 'pavilion').map((o) => o.key)).toEqual(['b-adidas|o-pav'])
  })

  it('matches the combined "brand · outlet" string', () => {
    expect(filterStores(opts(), 'nike · mid').map((o) => o.key)).toEqual(['b-nike|o-mv'])
  })

  it('returns all options for an empty or whitespace query', () => {
    expect(filterStores(opts(), '')).toHaveLength(3)
    expect(filterStores(opts(), '   ')).toHaveLength(3)
  })
})

describe('groupByBrand', () => {
  it('groups options into ordered brand groups', () => {
    const groups = groupByBrand(opts())
    expect(groups.map((g) => g.brandName)).toEqual(['Adidas', 'Nike'])
    expect(groups[1]).toMatchObject({ brandColor: '#111' })
    expect(groups[1].options.map((o) => o.outletName)).toEqual(['Mid Valley', 'Suria KLCC'])
  })
})
