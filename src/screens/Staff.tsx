import { useStore } from '../data/store'
import { brandById, initials, outletById, tenure } from '../data/derived'
import { card, chip, tint } from '../theme'
import { Icon } from '../components/Icon'

const transferredBadge = (label: string, small = false) => (
  <span
    style={{
      fontSize: small ? 9 : 9.5,
      fontWeight: 600,
      letterSpacing: '.03em',
      textTransform: 'uppercase',
      background: tint('#2563eb', 14),
      color: '#2563eb',
      borderRadius: 5,
      padding: '2px 6px',
    }}
  >
    {label}
  </span>
)

export function Staff() {
  const { state, setStaffBrandFilter, openTransfer } = useStore()
  const S = state
  const q = S.q.trim().toLowerCase()
  const isMobile = S.isMobile

  const filters = [{ id: 'all', label: 'All staff' }, ...S.brands.map((b) => ({ id: b.id, label: b.name }))]

  let list = S.staff.filter((s) => S.staffBrandFilter === 'all' || s.brandId === S.staffBrandFilter)
  if (q) {
    list = list.filter((s) => {
      const b = brandById(S, s.brandId)
      const o = outletById(S, s.outletId)
      return `${s.name} ${s.role} ${b.name} ${o.name}`.toLowerCase().includes(q)
    })
  }

  const rows = list.map((s) => {
    const b = brandById(S, s.brandId)
    const o = outletById(S, s.outletId)
    return {
      id: s.id,
      name: s.name,
      initials: initials(s.name),
      role: s.role,
      brandName: b.name,
      brandColor: b.color,
      outletName: o.name,
      tenure: tenure(s.joined),
      transferred: s.history.length > 1,
    }
  })

  const transferBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text)',
    borderRadius: 7,
    padding: '6px 11px',
    fontFamily: "'IBM Plex Sans'",
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {filters.map((f) => (
          <button key={f.id} onClick={() => setStaffBrandFilter(f.id)} style={chip(S.staffBrandFilter === f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {!isMobile && (
        <div style={{ ...card, overflowX: 'auto' }}>
          <div style={{ minWidth: 600 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                fontSize: 11,
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: 'var(--dim)',
              }}
            >
              <div style={{ flex: 2.4, minWidth: 140 }}>Staff member</div>
              <div style={{ flex: 1.4, minWidth: 90 }}>Brand</div>
              <div style={{ flex: 1.4, minWidth: 90 }}>Outlet</div>
              <div style={{ flex: 1, minWidth: 70 }}>Tenure</div>
              <div style={{ width: 120, textAlign: 'right' }}>Action</div>
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                style={{ display: 'flex', alignItems: 'center', padding: 'var(--rowpad)', paddingLeft: 16, paddingRight: 16, borderBottom: '1px solid var(--border)' }}
              >
                <div style={{ flex: 2.4, minWidth: 140, display: 'flex', alignItems: 'center', gap: 11 }}>
                  <Avatar initials={r.initials} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
                      {r.name}
                      {r.transferred && transferredBadge('Transferred')}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{r.role}</div>
                  </div>
                </div>
                <div style={{ flex: 1.4, minWidth: 90 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 500 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: r.brandColor }} />
                    {r.brandName}
                  </span>
                </div>
                <div style={{ flex: 1.4, minWidth: 90, fontSize: 12.5 }}>{r.outletName}</div>
                <div style={{ flex: 1, minWidth: 70, fontFamily: "'IBM Plex Mono'", fontSize: 12, color: 'var(--dim)' }}>{r.tenure}</div>
                <div style={{ width: 120, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => openTransfer(r.id)} style={transferBtn}>
                    <Icon name="swap_horiz" size={16} />
                    Transfer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Avatar initials={r.initials} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {r.name}
                    {r.transferred && transferredBadge('Moved', true)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--dim)' }}>{r.role}</div>
                </div>
                <button
                  onClick={() => openTransfer(r.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontFamily: "'IBM Plex Sans'",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="swap_horiz" size={16} />
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  fontSize: 12.5,
                  paddingTop: 10,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: r.brandColor }} />
                  {r.brandName}
                </span>
                <span style={{ color: 'var(--dim)' }}>· {r.outletName}</span>
                <span style={{ color: 'var(--dim)', fontFamily: "'IBM Plex Mono'", marginLeft: 'auto' }}>{r.tenure}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Avatar({ initials, size }: { initials: string; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: tint('var(--accent)', 14),
        color: 'var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'IBM Plex Mono'",
        fontSize: 12,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}
