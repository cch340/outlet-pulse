import { useEffect, useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useMarkAllSuccess } from '../data/queries/useVisitMutations'
import { useVisitsPage, useVisitStatusCounts, fetchVisitsForExport, EXPORT_CAP } from '../data/queries/useVisitsPage'
import { visitVM, today, localDateStr, brandById, outletById, staffById, TASK_STATUS_COLOR } from '../data/derived'
import { resolveDateRange, pageCount, type DatePreset } from '../data/queries/visitsQuery'
import type { VisitFilter } from '../data/store'
import type { Task } from '../data/model'
import { card, pill } from '../theme'
import { Icon } from '../components/Icon'
import { ExportCsvButton } from '../components/ExportCsvButton'
import { useToast } from '../components/ToastProvider'
import { useConfirm } from '../components/ConfirmProvider'
import { visitRows, toCsv, exportFilename, CSV_BOM } from '../data/csvExport'
import { downloadTextFile } from '../data/download'
import { rowButtonProps } from '../components/useDialogA11y'

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

const chevronBtn = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--dim)',
  borderRadius: 7,
  width: 30,
  height: 30,
  padding: 0,
  cursor: 'pointer',
  flexShrink: 0,
} as const

const dateInput = {
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  borderRadius: 8,
  padding: '6px 9px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 12.5,
  color: 'var(--text)',
} as const

const selectStyle = {
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  borderRadius: 8,
  padding: '6px 9px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--text)',
  cursor: 'pointer',
} as const

export function Visits() {
  const { state, setVisitFilter, openVisit } = useStore()
  const { data } = useData()
  const markAllMutation = useMarkAllSuccess()
  const toast = useToast()
  const confirm = useConfirm()
  const S = state
  const isMobile = S.isMobile
  const [exporting, setExporting] = useState(false)

  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [outletFilter, setOutletFilter] = useState<string>('all')
  const [latestPerStore, setLatestPerStore] = useState(false)
  const [page, setPage] = useState(0)
  const [allExpanded, setAllExpanded] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  // Mobile-only: the visit id whose status tooltip is currently shown (one at a time).
  const [openStatusId, setOpenStatusId] = useState<string | null>(null)

  const t = today()
  const todayStr = localDateStr(t)
  const { from, to } = resolveDateRange(datePreset, customFrom, customTo, todayStr)
  const search = S.q.trim()
  const brand = brandFilter === 'all' ? null : brandFilter
  const outlet = outletFilter === 'all' ? null : outletFilter

  // Any filter change returns to the first page.
  useEffect(() => {
    setPage(0)
  }, [S.visitFilter, datePreset, customFrom, customTo, brandFilter, outletFilter, latestPerStore, search])

  // Collapse all detail views when the page or any filter changes.
  useEffect(() => {
    setAllExpanded(false)
    setExpandedIds(new Set())
  }, [page, S.visitFilter, datePreset, customFrom, customTo, brandFilter, outletFilter, latestPerStore, search])

  // Mobile status tooltip: dismiss on tap-outside or after a short timeout
  // (the badge tap itself stops propagation, so it doesn't self-close).
  useEffect(() => {
    if (!openStatusId) return
    const close = () => setOpenStatusId(null)
    const timer = setTimeout(close, 1500)
    window.addEventListener('click', close)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', close)
    }
  }, [openStatusId])

  const counts = useVisitStatusCounts({ today: todayStr, from, to, latest: latestPerStore, search, brand, outlet })
  const { visits, total } = useVisitsPage({
    today: todayStr,
    from,
    to,
    status: S.visitFilter,
    latest: latestPerStore,
    search,
    brand,
    outlet,
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

  const handleExport = async () => {
    if (exporting) return
    const filtersActive =
      S.visitFilter !== 'all' ||
      datePreset !== 'all' ||
      brandFilter !== 'all' ||
      outletFilter !== 'all' ||
      latestPerStore ||
      search !== ''
    const matchedNote = ` (currently ${total} visit${total === 1 ? '' : 's'})`
    const message = filtersActive
      ? `The CSV will contain the visits matching your current filters, up to ${EXPORT_CAP} records${matchedNote}.`
      : `No filters are applied — this will export ALL visits, up to ${EXPORT_CAP} records${matchedNote}.`
    const ok = await confirm({ title: 'Export CSV', message, confirmLabel: 'Export' })
    if (!ok) return
    setExporting(true)
    try {
      const { visits: all, total: matched } = await fetchVisitsForExport({
        today: todayStr,
        from,
        to,
        status: S.visitFilter,
        latest: latestPerStore,
        search,
        brand,
        outlet,
      })
      if (all.length === 0) {
        toast.error('No visits match this filter.')
        return
      }
      const matrix = visitRows(all, {
        brandName: (id) => brandById(data, id).name,
        outletName: (id) => outletById(data, id).name,
        staffName: (id) => (id ? staffById(data, id).name : ''),
        status: (v) => visitVM(data, v).statusLabel,
      })
      downloadTextFile(exportFilename('visits', todayStr), 'text/csv;charset=utf-8', CSV_BOM + toCsv(matrix))
      if (matched > all.length) {
        toast.error(`Exported first ${all.length} of ${matched} visits.`)
      } else {
        toast.success(`Exported ${all.length} visit${all.length === 1 ? '' : 's'}.`)
      }
    } catch {
      toast.error("Couldn't export visits.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* filter toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <select aria-label="Status" value={S.visitFilter} onChange={(e) => setVisitFilter(e.target.value as VisitFilter)} style={selectStyle}>
          {filterDefs.map(([k, label]) => (
            <option key={k} value={k}>
              {label} ({counts[k]})
            </option>
          ))}
        </select>
        <select aria-label="Date range" value={datePreset} onChange={(e) => setDatePreset(e.target.value as DatePreset)} style={selectStyle}>
          {PRESETS.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        {datePreset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" aria-label="From date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={dateInput} />
            <span style={{ color: 'var(--dim)', fontSize: 12 }}>→</span>
            <input type="date" aria-label="To date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={dateInput} />
          </div>
        )}
        <select aria-label="Brand" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} style={selectStyle}>
          <option value="all">All brands</option>
          {data.brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select aria-label="Outlet" value={outletFilter} onChange={(e) => setOutletFilter(e.target.value)} style={selectStyle}>
          <option value="all">All outlets</option>
          {data.outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={latestPerStore} onChange={(e) => setLatestPerStore(e.target.checked)} />
          Latest per store
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={allExpanded} onChange={toggleAll} />
          Expand all
        </label>
        <ExportCsvButton onClick={handleExport} busy={exporting} title="Export the filtered visits as CSV" />
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
            <div style={{ width: 30, flexShrink: 0 }} />
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
          const statusOpen = openStatusId === f.vm.id
          const chevron = (
            <button
              type="button"
              aria-label={expanded ? 'Collapse checklist' : 'Expand checklist'}
              aria-expanded={expanded}
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(f.vm.id)
              }}
              style={chevronBtn}
            >
              <Icon name={expanded ? 'expand_less' : 'expand_more'} size={20} />
            </button>
          )

          return (
            <div key={f.vm.id}>
              {!isMobile ? (
                <div style={{ display: 'flex', gap: 14, padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
                  {/* left column: chevron + date */}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexShrink: 0 }}>
                    <div style={{ width: 30, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{chevron}</div>
                    <div onClick={() => openVisit(f.vm.id)} style={{ width: 46, textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 17, fontWeight: 600, lineHeight: 1 }}>{f.day}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{f.mon}</div>
                    </div>
                  </div>

                  {/* vertical divider — extends down through the expanded checklist */}
                  <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', flexShrink: 0 }} />

                  {/* right column: header (clickable) + expanded checklist */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div {...rowButtonProps(() => openVisit(f.vm.id))} onClick={() => openVisit(f.vm.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
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

                    {/* horizontal divider (starts after the vertical divider) + checklist */}
                    {expanded && (
                      <div
                        onClick={() => openVisit(f.vm.id)}
                        style={{ borderTop: '1px solid var(--border)', marginTop: 11, paddingTop: 10, cursor: 'pointer' }}
                      >
                        <TaskLines tasks={f.tasks} />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, padding: '13px 15px', borderBottom: '1px solid var(--border)' }}>
                  {/* left column: chevron + date */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexShrink: 0 }}>
                    {chevron}
                    <div onClick={() => openVisit(f.vm.id)} style={{ width: 40, textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, fontWeight: 600, lineHeight: 1 }}>{f.day}</div>
                      <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{f.mon}</div>
                    </div>
                  </div>

                  {/* vertical divider — extends down through the expanded checklist */}
                  <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', flexShrink: 0 }} />

                  {/* right column: header (clickable) + expanded checklist */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div {...rowButtonProps(() => openVisit(f.vm.id))} onClick={() => openVisit(f.vm.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden', maxWidth: 120, display: 'flex' }}>
                            {f.vm.successT > 0 && <div style={{ width: `${(f.vm.successT / f.vm.total) * 100}%`, background: '#16a34a' }} />}
                            {f.vm.failedT > 0 && <div style={{ width: `${(f.vm.failedT / f.vm.total) * 100}%`, background: '#dc2626' }} />}
                          </div>
                          <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: 'var(--dim)', flexShrink: 0 }}>
                            {f.vm.resolvedT}/{f.vm.total}
                          </span>
                        </div>
                      </div>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          type="button"
                          aria-label={f.vm.statusLabel}
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenStatusId((cur) => (cur === f.vm.id ? null : f.vm.id))
                          }}
                          style={{
                            ...pill(f.vm.statusColor),
                            width: 34,
                            height: 34,
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {f.vm.statusLabel[0]}
                        </button>
                        {statusOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: 6,
                              background: 'var(--text)',
                              color: 'var(--surface)',
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '4px 8px',
                              borderRadius: 6,
                              whiteSpace: 'nowrap',
                              zIndex: 5,
                              boxShadow: '0 4px 12px rgba(0,0,0,.18)',
                            }}
                          >
                            {f.vm.statusLabel}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* horizontal divider (starts after the vertical divider) + checklist */}
                    {expanded && (
                      <div
                        onClick={() => openVisit(f.vm.id)}
                        style={{ borderTop: '1px solid var(--border)', marginTop: 11, paddingTop: 10, cursor: 'pointer' }}
                      >
                        <TaskLines tasks={f.tasks} />
                      </div>
                    )}
                  </div>
                </div>
              )}
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

// Compact task lines — label colored by status, remark inline (mirrors the Store page drawer).
function TaskLines({ tasks }: { tasks: Task[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {tasks.map((tk) => (
        <div key={tk.id ?? tk.label} style={{ fontSize: 12.5 }}>
          <span style={{ fontWeight: 600, color: TASK_STATUS_COLOR[tk.status] }}>{tk.label}</span>
          {tk.remark && <span style={{ color: 'var(--dim)' }}> — {tk.remark}</span>}
        </div>
      ))}
    </div>
  )
}

