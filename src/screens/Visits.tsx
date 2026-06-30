import { useEffect, useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useMarkAllSuccess } from '../data/queries/useVisitMutations'
import { useVisitsPage, useVisitStatusCounts } from '../data/queries/useVisitsPage'
import { visitVM, today, localDateStr, TASK_STATUS_COLOR } from '../data/derived'
import { resolveDateRange, pageCount, type DatePreset } from '../data/queries/visitsQuery'
import type { VisitFilter } from '../data/store'
import type { Task } from '../data/model'
import { card, chip, pill } from '../theme'
import { Icon } from '../components/Icon'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PAGE_SIZE = 25
const PRESETS: [DatePreset, string][] = [
  ['all', 'All time'],
  ['month', 'This month'],
  ['last30', 'Last 30 days'],
  ['last90', 'Last 90 days'],
  ['year', 'This year'],
  ['custom', 'Custom'],
]
const pad = (n: number) => String(n).padStart(2, '0')

const pagerBtn = (disabled: boolean) => ({
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  borderRadius: 7,
  padding: '5px 12px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
})

const dateInput = {
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  borderRadius: 8,
  padding: '6px 9px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 12.5,
  color: 'var(--text)',
} as const

export function Visits() {
  const { state, setVisitFilter, openVisit } = useStore()
  const { data } = useData()
  const markAllMutation = useMarkAllSuccess()
  const S = state
  const isMobile = S.isMobile

  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [latestPerStore, setLatestPerStore] = useState(false)
  const [page, setPage] = useState(0)
  const [allExpanded, setAllExpanded] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const t = today()
  const todayStr = localDateStr(t)
  const { from, to } = resolveDateRange(datePreset, customFrom, customTo, todayStr)
  const search = S.q.trim()

  // Any filter change returns to the first page.
  useEffect(() => {
    setPage(0)
  }, [S.visitFilter, datePreset, customFrom, customTo, latestPerStore, search])

  // Collapse all detail views when the page or any filter changes.
  useEffect(() => {
    setAllExpanded(false)
    setExpandedIds(new Set())
  }, [page, S.visitFilter, datePreset, customFrom, customTo, latestPerStore, search])

  const counts = useVisitStatusCounts({ today: todayStr, from, to, latest: latestPerStore, search })
  const { visits, total } = useVisitsPage({
    today: todayStr,
    from,
    to,
    status: S.visitFilter,
    latest: latestPerStore,
    search,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })

  const totalPages = pageCount(total, PAGE_SIZE)
  const filterDefs: [VisitFilter, string][] = [
    ['all', 'All'],
    ['pending', 'Pending'],
    ['attention', 'Attention'],
    ['overdue', 'Overdue'],
    ['done', 'Completed'],
  ]

  const rows = visits.map((f) => {
    const vm = visitVM(data, f)
    const d = new Date(f.date + 'T00:00:00')
    return { vm, tasks: f.tasks, day: pad(d.getDate()), mon: MON[d.getMonth()], canComplete: vm.pendingT > 0 }
  })

  const toggleExpand = (id: string) =>
    setExpandedIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      // Keep the "Expand all" checkbox in sync with the actual set.
      setAllExpanded(visits.length > 0 && next.size === visits.length)
      return next
    })

  const toggleAll = () => {
    if (allExpanded) {
      setAllExpanded(false)
      setExpandedIds(new Set())
    } else {
      setAllExpanded(true)
      setExpandedIds(new Set(visits.map((v) => v.id)))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* status chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
        {filterDefs.map(([k, label]) => (
          <button key={k} onClick={() => setVisitFilter(k)} style={chip(S.visitFilter === k)}>
            {label} <span style={{ fontFamily: "'IBM Plex Mono'", opacity: 0.7 }}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {/* filter toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {PRESETS.map(([k, label]) => (
            <button key={k} onClick={() => setDatePreset(k)} style={chip(datePreset === k)}>
              {label}
            </button>
          ))}
        </div>
        {datePreset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" aria-label="From date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={dateInput} />
            <span style={{ color: 'var(--dim)', fontSize: 12 }}>→</span>
            <input type="date" aria-label="To date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={dateInput} />
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={latestPerStore} onChange={(e) => setLatestPerStore(e.target.checked)} />
          Latest per store
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={allExpanded} onChange={toggleAll} />
          Expand all
        </label>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {rows.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>No visits match this filter.</div>
        )}

        {!isMobile && rows.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '9px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface2)',
              fontSize: 10.5,
              fontWeight: 600,
              color: 'var(--dim)',
              textTransform: 'uppercase',
              letterSpacing: '.05em',
            }}
          >
            <div style={{ width: 22, flexShrink: 0 }} />
            <div style={{ width: 46, textAlign: 'center', flexShrink: 0 }}>Date</div>
            <div style={{ width: 1, flexShrink: 0 }} />
            <div style={{ flex: 1.6, minWidth: 0 }}>Brand · Outlet</div>
            <div style={{ flex: 1, minWidth: 90 }}>Tasks</div>
            <div style={{ width: 116, textAlign: 'right', flexShrink: 0 }}>Action</div>
            <div style={{ width: 132, textAlign: 'right', flexShrink: 0 }}>Status</div>
          </div>
        )}

        {rows.map((f) => {
          const expanded = expandedIds.has(f.vm.id)
          const chevron = (
            <button
              type="button"
              aria-label={expanded ? 'Collapse checklist' : 'Expand checklist'}
              aria-expanded={expanded}
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(f.vm.id)
              }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
              <Icon name={expanded ? 'expand_less' : 'expand_more'} size={20} />
            </button>
          )

          return (
            <div key={f.vm.id}>
              {!isMobile ? (
                <div
                  onClick={() => openVisit(f.vm.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderBottom: expanded ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <div style={{ width: 22, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{chevron}</div>
                  <div style={{ width: 46, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 17, fontWeight: 600, lineHeight: 1 }}>{f.day}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{f.mon}</div>
                  </div>
                  <div style={{ width: 1, height: 34, background: 'var(--border)', flexShrink: 0 }} />
                  <div style={{ flex: 1.6, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: f.vm.brandColor, flexShrink: 0 }} />
                      {f.vm.brandName} · {f.vm.outletName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>{f.vm.staffName}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 90 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden', maxWidth: 90, display: 'flex' }}>
                        {f.vm.successT > 0 && <div style={{ width: `${(f.vm.successT / f.vm.total) * 100}%`, background: '#16a34a' }} />}
                        {f.vm.failedT > 0 && <div style={{ width: `${(f.vm.failedT / f.vm.total) * 100}%`, background: '#dc2626' }} />}
                      </div>
                      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: 'var(--dim)' }}>
                        {f.vm.resolvedT}/{f.vm.total}
                      </span>
                    </div>
                  </div>
                  <div style={{ width: 116, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                    {f.canComplete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          markAllMutation.mutate({ visitId: f.vm.id })
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
                        Pass pending
                      </button>
                    )}
                  </div>
                  <div style={{ width: 132, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <span style={pill(f.vm.statusColor)}>{f.vm.statusLabel}</span>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => openVisit(f.vm.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderBottom: expanded ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}
                >
                  {chevron}
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
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: f.vm.brandColor, flexShrink: 0 }} />
                      {f.vm.brandName} · {f.vm.outletName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.vm.staffName}
                    </div>
                  </div>
                  <span style={pill(f.vm.statusColor)}>{f.vm.statusLabel}</span>
                </div>
              )}

              {expanded && <ChecklistDetail tasks={f.tasks} />}
            </div>
          )
        })}

        {rows.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--dim)' }}>
            <span style={{ fontFamily: "'IBM Plex Mono'" }}>
              {total} visit{total === 1 ? '' : 's'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={pagerBtn(page <= 0)}>
                Prev
              </button>
              <span style={{ fontFamily: "'IBM Plex Mono'" }}>
                Page {page + 1} / {totalPages}
              </span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} style={pagerBtn(page >= totalPages - 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChecklistDetail({ tasks }: { tasks: Task[] }) {
  return (
    <div style={{ padding: '4px 16px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tasks.map((tk) => (
          <div
            key={tk.id ?? tk.label}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
          >
            <span title={tk.status} style={{ width: 9, height: 9, borderRadius: '50%', background: TASK_STATUS_COLOR[tk.status], flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{tk.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>{tk.remark || '—'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
