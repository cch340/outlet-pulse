import { useData } from '../data/queries/useData'
import { useStore } from '../data/store'
import { linked } from '../data/derived'
import { card, chip } from '../theme'
import { Icon } from './Icon'
import { useLinkStore, useUnlinkStore } from '../data/queries/useBrandMutations'

const emptyBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '8px 13px',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 13,
  fontWeight: 600,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
} as const

export function StoresPanel() {
  const { data } = useData()
  const { setManageTab } = useStore()
  const link = useLinkStore()
  const unlink = useUnlinkStore()

  const noBrands = data.brands.length === 0
  const noOutlets = data.outlets.length === 0

  if (noBrands || noOutlets) {
    return (
      <div style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Set up your first store</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
          A store is a brand linked to an outlet. Create{' '}
          {noBrands ? 'a brand' : ''}
          {noBrands && noOutlets ? ' and ' : ''}
          {noOutlets ? 'an outlet' : ''} first, then link them here.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {noBrands && (
            <button onClick={() => setManageTab('brands')} style={emptyBtn}>
              <Icon name="add" size={16} /> Add a brand
            </button>
          )}
          {noOutlets && (
            <button onClick={() => setManageTab('outlets')} style={emptyBtn}>
              <Icon name="add" size={16} /> Add an outlet
            </button>
          )}
        </div>
      </div>
    )
  }

  const toggle = (brandId: string, outletId: string, isLinked: boolean) => {
    if (isLinked) unlink.mutate({ brandId, outletId }, { onError: (e) => alert(e.message) })
    else link.mutate({ brandId, outletId }, { onError: (e) => alert(e.message) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
        Tap an outlet to link or unlink it from a brand. Highlighted = linked.
      </div>
      {data.brands.map((b) => {
        const linkedCount = data.stores.filter((s) => s.brandId === b.id).length
        return (
          <div key={b.id} style={{ ...card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: b.color }} />
              <span style={{ fontSize: 14.5, fontWeight: 700 }}>{b.name}</span>
              <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono'", fontSize: 12, color: 'var(--dim)' }}>
                {linkedCount} / {data.outlets.length} linked
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.outlets.map((o) => {
                const isLinked = linked(data, b.id, o.id)
                return (
                  <button key={o.id} onClick={() => toggle(b.id, o.id, isLinked)} style={chip(isLinked)}>
                    {isLinked && <Icon name="check" size={15} color="#fff" />}
                    {o.name}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
