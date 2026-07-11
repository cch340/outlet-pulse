import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { brandById, initials } from '../data/derived'
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

export function OutletDetailModal() {
  const { state, closeOutletDetail } = useStore()
  const { data } = useData()
  const o = data.outlets.find((x) => x.id === state.outletDetailId)
  if (!o) return null

  const brands = data.stores
    .filter((s) => s.outletId === o.id)
    .map((s) => {
      const b = brandById(data, s.brandId)
      const staff = data.staff.filter((x) => x.outletId === o.id && x.brandId === b.id)
      return { ...b, staffCount: staff.length, staff }
    })

  const totalStaff = data.staff.filter((s) => s.outletId === o.id).length

  return (
    <DetailModal
      isMobile={state.isMobile}
      onClose={closeOutletDetail}
      label={o.name}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 11 }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: tint('var(--accent)', 13),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="storefront" size={20} color="var(--accent)" />
          </span>
          {o.name}
        </span>
      }
      subtitle={`${o.location} · hosts ${brands.length} brands · ${totalStaff} staff`}
    >
      <div style={{ ...sectionLabel, marginBottom: 10 }}>Brands hosted here</div>
      {brands.length === 0 && <div style={{ fontSize: 13, color: 'var(--dim)' }}>No brands linked to this outlet yet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {brands.map((b) => (
          <div key={b.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: b.staff.length ? 9 : 0 }}>
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
    </DetailModal>
  )
}
