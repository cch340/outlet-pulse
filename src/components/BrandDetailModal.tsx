import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { initials, outletById } from '../data/derived'
import { tint } from '../theme'
import { Icon } from './Icon'
import { DetailModal } from './DetailModal'

const sectionLabel = {
  fontSize: 11,
  letterSpacing: '.06em',
  textTransform: 'uppercase' as const,
  fontWeight: 600,
  color: 'var(--dim)',
}

export function BrandDetailModal() {
  const { state, closeBrandDetail } = useStore()
  const { data } = useData()
  const b = data.brands.find((x) => x.id === state.brandDetailId)
  if (!b) return null

  const outlets = data.stores
    .filter((s) => s.brandId === b.id)
    .map((s) => {
      const o = outletById(data, s.outletId)
      const staff = data.staff.filter((x) => x.brandId === b.id && x.outletId === o.id)
      return { ...o, staffCount: staff.length, staff }
    })

  const totalStaff = data.staff.filter((s) => s.brandId === b.id).length

  return (
    <DetailModal
      isMobile={state.isMobile}
      onClose={closeBrandDetail}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 11 }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: b.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {b.name.slice(0, 2).toUpperCase()}
          </span>
          {b.name}
        </span>
      }
      subtitle={`${b.category} · operates in ${outlets.length} outlets · ${totalStaff} staff`}
    >
      <div style={{ ...sectionLabel, marginBottom: 10 }}>Outlets &amp; on-site staff</div>
      {outlets.length === 0 && <div style={{ fontSize: 13, color: 'var(--dim)' }}>Not linked to any outlet yet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {outlets.map((o) => (
          <div key={o.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: o.staff.length ? 9 : 0 }}>
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
    </DetailModal>
  )
}
