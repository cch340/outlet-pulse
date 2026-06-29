import { useStore } from '../data/store'
import { brandById, initials } from '../data/derived'
import { card, cardSel, tint } from '../theme'
import { Icon } from '../components/Icon'

const sectionLabel = {
  fontSize: 11,
  letterSpacing: '.06em',
  textTransform: 'uppercase' as const,
  fontWeight: 600,
  color: 'var(--dim)',
}

export function Outlets() {
  const { state, selOutlet } = useStore()
  const S = state

  const selO = S.outlets.find((o) => o.id === S.selectedOutletId) ?? S.outlets[0]
  const detailBrands = S.stores
    .filter((s) => s.outletId === selO.id)
    .map((s) => {
      const b = brandById(S, s.brandId)
      const staff = S.staff.filter((x) => x.outletId === selO.id && x.brandId === b.id)
      return { ...b, staffCount: staff.length, staff }
    })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
      {/* left list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ ...sectionLabel, padding: 2 }}>All outlets</div>
        {S.outlets.map((o) => {
          const brandCount = S.stores.filter((s) => s.outletId === o.id).length
          const staffCount = S.staff.filter((s) => s.outletId === o.id).length
          return (
            <button key={o.id} onClick={() => selOutlet(o.id)} style={cardSel(o.id === S.selectedOutletId)}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: tint('var(--accent)', 13),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="storefront" size={22} color="var(--accent)" />
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{o.name}</div>
                <div style={{ fontSize: 12, color: 'var(--dim)' }}>{o.location}</div>
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 600 }}>{brandCount} brands</div>
                <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{staffCount} staff</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* right detail */}
      <div style={{ ...card, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 11,
              background: tint('var(--accent)', 13),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="storefront" size={24} color="var(--accent)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{selO.name}</div>
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>
              {selO.location} · hosts {S.stores.filter((s) => s.outletId === selO.id).length} brands ·{' '}
              {S.staff.filter((s) => s.outletId === selO.id).length} staff
            </div>
          </div>
        </div>
        <div style={{ ...sectionLabel, margin: '16px 0 10px' }}>Brands hosted here</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {detailBrands.map((b) => (
            <div key={b.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: b.color }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</span>
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, fontWeight: 600, color: 'var(--dim)' }}>{b.staffCount} staff</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {b.staff.map((p) => (
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
                        background: tint(b.color, 18),
                        color: b.color,
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
      </div>
    </div>
  )
}
