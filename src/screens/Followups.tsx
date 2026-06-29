import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useMarkFollowUpDone } from '../data/queries/useFollowUpMutations'
import { brandById, fuVM, isOverdue, outletById, staffById } from '../data/derived'
import type { FuFilter } from '../data/store'
import { card, chip, pill } from '../theme'
import { Icon } from '../components/Icon'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function Followups() {
  const { state, setFuFilter, openFu } = useStore()
  const { data } = useData()
  const markDoneMutation = useMarkFollowUpDone()
  const S = state
  const q = S.q.trim().toLowerCase()
  const isMobile = S.isMobile

  const allF = data.followups.slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  const counts = {
    all: allF.length,
    pending: allF.filter((f) => f.status === 'pending' && !isOverdue(f)).length,
    overdue: allF.filter(isOverdue).length,
    done: allF.filter((f) => f.status === 'done').length,
  }
  const filterDefs: [FuFilter, string][] = [
    ['all', 'All'],
    ['pending', 'Pending'],
    ['overdue', 'Overdue'],
    ['done', 'Completed'],
  ]

  let filtered = allF
  if (S.fuFilter === 'pending') filtered = allF.filter((f) => f.status === 'pending' && !isOverdue(f))
  else if (S.fuFilter === 'overdue') filtered = allF.filter(isOverdue)
  else if (S.fuFilter === 'done') filtered = allF.filter((f) => f.status === 'done')
  if (q) {
    filtered = filtered.filter((f) => {
      const b = brandById(data, f.brandId)
      const o = outletById(data, f.outletId)
      const st = f.staffId ? staffById(data, f.staffId) : null
      return `${b.name} ${o.name} ${st ? st.name : ''}`.toLowerCase().includes(q)
    })
  }

  const rows = filtered.map((f) => {
    const vm = fuVM(data, f)
    const d = new Date(f.date + 'T00:00:00')
    return { ...vm, day: String(d.getDate()).padStart(2, '0'), mon: MON[d.getMonth()], canComplete: vm.status !== 'done' }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
        {filterDefs.map(([k, label]) => (
          <button key={k} onClick={() => setFuFilter(k)} style={chip(S.fuFilter === k)}>
            {label} <span style={{ fontFamily: "'IBM Plex Mono'", opacity: 0.7 }}>{counts[k]}</span>
          </button>
        ))}
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {rows.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>No follow-ups match this filter.</div>
        )}

        {!isMobile &&
          rows.map((f) => (
            <div
              key={f.id}
              onClick={() => openFu(f.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <div style={{ width: 46, textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 17, fontWeight: 600, lineHeight: 1 }}>{f.day}</div>
                <div style={{ fontSize: 10.5, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{f.mon}</div>
              </div>
              <div style={{ width: 1, height: 34, background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1.6, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: f.brandColor, flexShrink: 0 }} />
                  {f.brandName} · {f.outletName}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>{f.staffName}</div>
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden', maxWidth: 90 }}>
                    <div style={{ height: '100%', width: `${f.progressPct}%`, background: f.statusColor }} />
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: 'var(--dim)' }}>
                    {f.doneT}/{f.total}
                  </span>
                </div>
              </div>
              <span style={pill(f.statusColor)}>{f.statusLabel}</span>
              {f.canComplete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    markDoneMutation.mutate({ followUpId: f.id })
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    border: '1px solid #16a34a',
                    background: 'color-mix(in srgb, #16a34a 8%, transparent)',
                    color: '#16a34a',
                    borderRadius: 7,
                    padding: '6px 10px',
                    fontFamily: "'IBM Plex Sans'",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="check" size={16} />
                  Done
                </button>
              )}
            </div>
          ))}

        {isMobile &&
          rows.map((f) => (
            <div
              key={f.id}
              onClick={() => openFu(f.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, fontWeight: 600, lineHeight: 1 }}>{f.day}</div>
                <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{f.mon}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: f.brandColor, flexShrink: 0 }} />
                  {f.brandName} · {f.outletName}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.staffName}
                </div>
              </div>
              <span style={pill(f.statusColor)}>{f.statusLabel}</span>
            </div>
          ))}
      </div>
    </div>
  )
}
