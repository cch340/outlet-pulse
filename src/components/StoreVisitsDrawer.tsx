import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useVisitsPage } from '../data/queries/useVisitsPage'
import { brandById, outletById, visitVM, today, localDateStr, TASK_STATUS_COLOR } from '../data/derived'
import { pill } from '../theme'
import { Icon } from './Icon'

export function StoreVisitsDrawer() {
  const { state, closeStoreVisits, openVisit } = useStore()
  const { data } = useData()
  const sv = state.storeVisits
  const ovPos = state.isMobile ? 'absolute' : 'fixed'
  const todayStr = localDateStr(today())

  // Full history for this store, most-recent-first (RPC orders by date desc).
  const { visits, isLoading } = useVisitsPage({
    today: todayStr,
    from: null,
    to: null,
    status: 'all',
    latest: false,
    search: '',
    brand: sv?.brandId ?? null,
    outlet: sv?.outletId ?? null,
    limit: 100,
    offset: 0,
  })

  if (!sv) return null
  const brand = brandById(data, sv.brandId)
  const outlet = outletById(data, sv.outletId)

  return (
    <div
      onClick={closeStoreVisits}
      style={{ position: ovPos, inset: 0, zIndex: 45, background: 'rgba(0,0,0,.42)', display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 430,
          maxWidth: '100%',
          height: '100%',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--border)',
          animation: 'slidein .22s ease',
        }}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: brand.color }} />
            {brand.name} · {outlet.name}
          </div>
          <button onClick={closeStoreVisits} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <Icon name="close" size={22} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isLoading ? (
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>Loading…</div>
          ) : visits.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>No visits recorded for this store yet.</div>
          ) : (
            visits.map((visit) => {
              const vm = visitVM(data, visit)
              return (
                <button
                  key={visit.id}
                  onClick={() => openVisit(visit.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    width: '100%',
                    textAlign: 'left',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    borderRadius: 9,
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{vm.dateLabel}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>{vm.staffName}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>{vm.total} tasks</div>
                    </div>
                    <span style={pill(vm.statusColor)}>{vm.statusLabel}</span>
                  </div>
                  {visit.tasks.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {visit.tasks.map((tk) => (
                        <div key={tk.id ?? tk.label} style={{ fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: TASK_STATUS_COLOR[tk.status] }}>{tk.label}</span>
                          {tk.remark && <span style={{ color: 'var(--dim)' }}> — {tk.remark}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
