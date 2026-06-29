import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { initials, outletById } from '../data/derived'
import { card, cardSel, tint } from '../theme'
import { Icon } from '../components/Icon'

const sectionLabel = {
  fontSize: 11,
  letterSpacing: '.06em',
  textTransform: 'uppercase' as const,
  fontWeight: 600,
  color: 'var(--dim)',
}

export function Brands() {
  const { state, selBrand } = useStore()
  const { data } = useData()
  const S = state

  const selB = data.brands.find((b) => b.id === S.selectedBrandId) ?? data.brands[0]
  const detailOutlets = selB
    ? data.stores
        .filter((s) => s.brandId === selB.id)
        .map((s) => {
          const o = outletById(data, s.outletId)
          const staff = data.staff.filter((x) => x.brandId === selB.id && x.outletId === o.id)
          return { ...o, staffCount: staff.length, staff }
        })
    : []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
      {/* left list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ ...sectionLabel, padding: 2 }}>All brands</div>
        {data.brands.map((b) => {
          const storeCount = data.stores.filter((s) => s.brandId === b.id).length
          const staffCount = data.staff.filter((s) => s.brandId === b.id).length
          return (
            <button key={b.id} onClick={() => selBrand(b.id)} style={cardSel(b.id === S.selectedBrandId)}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: b.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  flexShrink: 0,
                }}
              >
                {b.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{b.name}</div>
                <div style={{ fontSize: 12, color: 'var(--dim)' }}>{b.category}</div>
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 600 }}>{storeCount} outlets</div>
                <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{staffCount} staff</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* right detail */}
      {selB && <div style={{ ...card, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 11,
              background: selB.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            {selB.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{selB.name}</div>
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>
              {selB.category} · operates in {data.stores.filter((s) => s.brandId === selB.id).length} outlets ·{' '}
              {data.staff.filter((s) => s.brandId === selB.id).length} staff
            </div>
          </div>
        </div>
        <div style={{ ...sectionLabel, margin: '16px 0 10px' }}>Outlets &amp; on-site staff</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {detailOutlets.map((o) => (
            <div key={o.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="storefront" size={18} color="var(--dim)" />
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{o.name}</span>{' '}
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>· {o.location}</span>
                  </div>
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, fontWeight: 600, color: 'var(--dim)' }}>{o.staffCount} staff</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {o.staff.map((p) => (
                  <span
                    key={p.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 20,
                      padding: '4px 11px 4px 4px',
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: tint('var(--accent)', 16),
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'IBM Plex Mono'",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {initials(p.name)}
                    </span>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    <span style={{ color: 'var(--dim)' }}>{p.role}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>}
    </div>
  )
}
