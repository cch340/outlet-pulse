import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { brandById, fmt, initials, outletById, tenure } from '../data/derived'
import { buildStaffTimeline } from '../data/queries/staffTimeline'
import { actionBtn, tint } from '../theme'
import { Icon } from './Icon'
import { WhatsAppButton } from './WhatsAppButton'
import { DetailModal } from './DetailModal'

const sectionLabel = {
  fontSize: 11,
  letterSpacing: '.06em',
  textTransform: 'uppercase' as const,
  fontWeight: 600,
  color: 'var(--dim)',
}

const tag = (label: string, color: string) => (
  <span
    style={{
      fontSize: 9.5,
      fontWeight: 600,
      letterSpacing: '.03em',
      textTransform: 'uppercase',
      background: tint(color, 14),
      color,
      borderRadius: 5,
      padding: '2px 6px',
    }}
  >
    {label}
  </span>
)

export function StaffDetailModal() {
  const { state, closeStaffDetail, openTransfer, openStaffModal } = useStore()
  const { data } = useData()
  const s = data.staff.find((x) => x.id === state.staffDetailId)
  if (!s) return null

  const b = brandById(data, s.brandId)
  const o = outletById(data, s.outletId)
  const timeline = buildStaffTimeline(s.history, (e) => {
    const eb = brandById(data, e.brandId)
    return { brandName: eb.name, brandColor: eb.color, outletName: outletById(data, e.outletId).name }
  })

  return (
    <DetailModal
      isMobile={state.isMobile}
      onClose={closeStaffDetail}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 11 }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: tint('var(--accent)', 14),
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'IBM Plex Mono'",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {initials(s.name)}
          </span>
          {s.name}
        </span>
      }
      subtitle={s.role}
    >
      {/* Current posting + contact */}
      <div style={{ ...sectionLabel, marginBottom: 10 }}>Current posting</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: b.color }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</span>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>·</span>
          <Icon name="storefront" size={16} color="var(--dim)" />
          <span style={{ fontSize: 13.5 }}>{o.name}</span>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>{o.location}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 12.5, color: 'var(--dim)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="event" size={15} color="var(--dim)" />
            Joined {fmt(s.joined)}
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono'" }}>· {tenure(s.joined)} tenure</span>
          {s.phone && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="call" size={15} color="var(--dim)" />
              <span style={{ fontFamily: "'IBM Plex Mono'" }}>{s.phone}</span>
            </span>
          )}
          <WhatsAppButton phone={s.phone} compact />
        </div>
      </div>

      {/* Posting history timeline */}
      <div style={{ ...sectionLabel, margin: '18px 0 12px' }}>Posting history</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {timeline.map((t, i) => {
          const last = i === timeline.length - 1
          return (
            <div key={t.key} style={{ display: 'flex', gap: 12 }}>
              {/* rail: dot + connecting line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
                <span
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: t.isCurrent ? 'var(--accent)' : 'var(--surface)',
                    border: `2px solid ${t.isCurrent ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                />
                {!last && <span style={{ flex: 1, width: 2, background: 'var(--border)', marginTop: 2 }} />}
              </div>
              {/* content */}
              <div style={{ paddingBottom: last ? 0 : 16, minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: t.brandColor }} />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t.brandName}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>· {t.outletName}</span>
                  {t.isCurrent && tag('Current', 'var(--accent)')}
                  {t.isInitial && tag('Joined', '#2563eb')}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', fontFamily: "'IBM Plex Mono'", marginTop: 3 }}>{t.periodLabel}</div>
                {t.reason && (
                  <div style={{ fontSize: 12.5, color: 'var(--text)', marginTop: 5, display: 'flex', gap: 6 }}>
                    <Icon name="swap_horiz" size={15} color="var(--dim)" />
                    <span>{t.reason}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => {
            closeStaffDetail()
            openStaffModal({ mode: 'edit', id: s.id })
          }}
          style={actionBtn()}
        >
          <Icon name="edit" size={16} />
          Edit
        </button>
        <button
          onClick={() => {
            closeStaffDetail()
            openTransfer(s.id, s.brandId, s.outletId)
          }}
          style={{ ...actionBtn(), background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }}
        >
          <Icon name="swap_horiz" size={16} />
          Transfer
        </button>
      </div>
    </DetailModal>
  )
}
