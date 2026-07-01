import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useDashboardSummary } from '../data/queries/useDashboardSummary'
import { useLatestFailedTasks } from '../data/queries/useLatestFailedTasks'
import type { LatestFailedVisit } from '../data/queries/dashboardSummary'
import { linked, staffCount, today, fmt, localDateStr, brandById, outletById } from '../data/derived'
import { card, mono, periodBtn, pill, tint } from '../theme'
import { useCardCollapse } from '../data/useCardCollapse'
import { CollapsibleCard } from '../components/CollapsibleCard'
import { Icon } from '../components/Icon'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CARD_IDS = [
  'latestFailedTasks',
  'overdue',
  'upcoming',
  'trend',
  'matrix',
  'visitsByBrand',
  'staffByOutlet',
]

export function Dashboard() {
  const { state, setPeriod, openVisit } = useStore()
  const { data } = useData()
  const S = state

  const t = today()
  const todayStr = localDateStr(t)
  const yr = todayStr.slice(0, 4)
  const mo = todayStr.slice(0, 7)
  const monthLabel = t.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const yearLabel = `Year ${yr}`

  const { summary, isLoading: sumLoading, isError: sumError } = useDashboardSummary({
    today: todayStr,
    year: yr,
    month: mo,
    listLimit: 20,
  })

  const { rows: latestFailed, isError: failedError } = useLatestFailedTasks()

  const collapse = useCardCollapse(CARD_IDS)

  const kpiSrc = S.period === 'month' ? summary.kpisMonth : summary.kpisYear
  const periodLabel = S.period === 'month' ? monthLabel : yearLabel
  const compRate = kpiSrc.total ? Math.round((kpiSrc.done / kpiSrc.total) * 100) : 0

  const stats = [
    { icon: 'sell', label: 'Brands', value: data.brands.length },
    { icon: 'storefront', label: 'Outlets', value: data.outlets.length },
    { icon: 'store', label: 'Active stores', value: data.stores.length },
    { icon: 'groups', label: 'Staff monitored', value: data.staff.length },
  ]

  const kpis = [
    { label: 'Visits', value: kpiSrc.total, sub: periodLabel, icon: 'fact_check', tone: 'var(--text)' },
    { label: 'Completion', value: `${compRate}%`, sub: `${kpiSrc.done} completed`, icon: 'task_alt', tone: '#16a34a' },
    { label: 'Pending', value: kpiSrc.pending, sub: 'awaiting completion', icon: 'pending', tone: '#d97706' },
    { label: 'Overdue', value: kpiSrc.overdue, sub: 'past scheduled date', icon: 'event_busy', tone: '#ea580c' },
  ]

  const mdata = summary.trend.map((pt) => {
    const idx = Number(pt.month.slice(5, 7)) - 1
    return { label: MONTHS[idx] ?? pt.month, done: pt.done, notDone: pt.total - pt.done }
  })
  const tmax = Math.max(1, ...mdata.map((m) => m.done + m.notDone))
  const H = 108

  const brandBreakdown = data.brands.map((b) => {
    const st = summary.brandBreakdown.find((x) => x.brandId === b.id)
    const done = st?.done ?? 0
    const total = st?.total ?? 0
    return { name: b.name, color: b.color, done, total, pct: total ? Math.round((done / total) * 100) : 0 }
  })

  const omax = Math.max(1, ...data.outlets.map((o) => staffCount(data, null, o.id)))
  const outletBreakdown = data.outlets.map((o) => {
    const staff = staffCount(data, null, o.id)
    const brands = data.stores.filter((s) => s.outletId === o.id).length
    return { name: o.name, location: o.location, staff, brands, pct: Math.round((staff / omax) * 100) }
  })

  const overdueList = summary.overdue
  const upcomingList = summary.upcoming

  const latestByStore = new Map<string, LatestFailedVisit>(
    latestFailed.map((r) => [`${r.brandId}:${r.outletId}`, r]),
  )
  const failedRows = data.stores
    .map((s) => {
      const brand = brandById(data, s.brandId)
      const outlet = outletById(data, s.outletId)
      return {
        key: `${s.brandId}:${s.outletId}`,
        brandName: brand.name,
        brandColor: brand.color,
        outletName: outlet.name,
        visit: latestByStore.get(`${s.brandId}:${s.outletId}`) ?? null,
      }
    })
    .sort((a, b) => a.brandName.localeCompare(b.brandName) || a.outletName.localeCompare(b.outletName))

  const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14 } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                background: tint('var(--accent)', 12),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name={s.icon} size={21} color="var(--accent)" />
            </div>
            <div>
              <div style={{ ...mono, fontSize: 23, fontWeight: 600, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', fontWeight: 500, marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* period toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)' }}>
          Visit performance — {periodLabel}
          {sumLoading && <span style={{ marginLeft: 8, fontWeight: 500 }}>· loading…</span>}
          {sumError && <span style={{ marginLeft: 8, fontWeight: 500, color: '#dc2626' }}>· couldn't load metrics</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={collapse.allOpen}
              onChange={(e) => collapse.setAll(e.target.checked)}
            />
            Expand all
          </label>
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 3,
              gap: 2,
            }}
          >
            <button onClick={() => setPeriod('month')} style={periodBtn(S.period === 'month')}>This month</button>
            <button onClick={() => setPeriod('year')} style={periodBtn(S.period === 'year')}>{yearLabel}</button>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: '15px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--dim)' }}>
                {k.label}
              </div>
              <Icon name={k.icon} size={18} color={k.tone} />
            </div>
            <div style={{ ...mono, fontSize: 30, fontWeight: 600, lineHeight: 1, marginTop: 10, color: k.tone }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 5 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* latest failed tasks */}
      <CollapsibleCard
        id="latestFailedTasks"
        title="Latest failed tasks by outlet"
        icon="rule"
        iconColor="#dc2626"
        open={collapse.isOpen('latestFailedTasks')}
        onToggle={collapse.toggle}
      >
        {failedError ? (
          <div style={{ fontSize: 12.5, color: '#dc2626' }}>Couldn't load latest failed tasks.</div>
        ) : failedRows.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>No brand × outlet pairs yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {failedRows.map((row) => (
              <FailedRow key={row.key} row={row} onOpen={openVisit} isMobile={state.isMobile} />
            ))}
          </div>
        )}
      </CollapsibleCard>

      {/* attention lists */}
      {(overdueList.length > 0 || upcomingList.length > 0) && (
        <div style={grid2}>
          {overdueList.length > 0 && (
            <CollapsibleCard
              id="overdue"
              gridItem
              title="Overdue visits"
              icon="warning"
              iconColor="#dc2626"
              accessory={
                <span style={{ ...mono, fontSize: 12, fontWeight: 600, background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '1px 8px' }}>
                  {summary.overdueTotal}
                </span>
              }
              open={collapse.isOpen('overdue')}
              onToggle={collapse.toggle}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {overdueList.map((f) => (
                  <AttentionRow key={f.id} dot="#dc2626" title={`${f.brandName} · ${f.outletName}`} sub={f.staffName ?? 'Unassigned'} date={fmt(f.date)} dateColor="#dc2626" onClick={() => openVisit(f.id)} />
                ))}
              </div>
            </CollapsibleCard>
          )}
          {upcomingList.length > 0 && (
            <CollapsibleCard
              id="upcoming"
              gridItem
              title="Upcoming visits"
              icon="event_upcoming"
              iconColor="#2563eb"
              open={collapse.isOpen('upcoming')}
              onToggle={collapse.toggle}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingList.map((f) => (
                  <AttentionRow key={f.id} dot="#2563eb" title={`${f.brandName} · ${f.outletName}`} sub={f.staffName ?? 'Unassigned'} date={fmt(f.date)} dateColor="var(--dim)" onClick={() => openVisit(f.id)} />
                ))}
              </div>
            </CollapsibleCard>
          )}
        </div>
      )}

      {/* trend + matrix */}
      <div style={grid2}>
        {/* trend */}
        <CollapsibleCard
          id="trend"
          gridItem
          title="Visits by month"
          open={collapse.isOpen('trend')}
          onToggle={collapse.toggle}
          accessory={
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--dim)', marginLeft: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--accent)' }} />Done
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: tint('var(--accent)', 22) }} />Open
              </span>
            </div>
          }
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 158, paddingTop: 18 }}>
            {mdata.map((m) => {
              const total = m.done + m.notDone
              return (
                <div
                  key={m.label}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}
                >
                  <div style={{ ...mono, fontSize: 11, fontWeight: 600, color: 'var(--dim)' }}>{total}</div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 30,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      borderRadius: 5,
                      overflow: 'hidden',
                      background: 'var(--surface2)',
                    }}
                  >
                    <div style={{ height: Math.round((m.notDone / tmax) * H), background: tint('var(--accent)', 22) }} />
                    <div style={{ height: Math.round((m.done / tmax) * H), background: 'var(--accent)' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 500 }}>{m.label}</div>
                </div>
              )
            })}
          </div>
        </CollapsibleCard>

        {/* matrix */}
        <CollapsibleCard
          id="matrix"
          gridItem
          title="Brand × Outlet coverage"
          open={collapse.isOpen('matrix')}
          onToggle={collapse.toggle}
        >
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 12 }}>Stores per location · number = staff on site</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 6, width: '100%' }}>
              <thead>
                <tr>
                  <th />
                  {data.outlets.map((o) => (
                    <th key={o.id} style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim)', textAlign: 'center', paddingBottom: 2 }}>
                      {o.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.brands.map((b) => (
                  <tr key={b.id}>
                    <td style={{ paddingRight: 8 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: b.color }} />
                        {b.name}
                      </span>
                    </td>
                    {data.outlets.map((o) => {
                      const isLinked = linked(data, b.id, o.id)
                      const cnt = staffCount(data, b.id, o.id)
                      return (
                        <td key={o.id}>
                          <div
                            style={{
                              height: 34,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 7,
                              ...mono,
                              fontSize: 13,
                              fontWeight: 600,
                              ...(isLinked
                                ? { background: tint(b.color, 14), color: b.color }
                                : { background: 'var(--surface2)', color: 'var(--border)' }),
                            }}
                          >
                            {isLinked ? String(cnt) : '–'}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
      </div>

      {/* breakdowns */}
      <div style={grid2}>
        <CollapsibleCard
          id="visitsByBrand"
          gridItem
          title="Visits by brand"
          open={collapse.isOpen('visitsByBrand')}
          onToggle={collapse.toggle}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {brandBreakdown.map((b) => (
              <div key={b.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: b.color }} />
                    {b.name}
                  </span>
                  <span style={{ ...mono, color: 'var(--dim)', fontSize: 12 }}>
                    {b.done}/{b.total} done
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 5, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${b.pct}%`, background: b.color, borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>
        <CollapsibleCard
          id="staffByOutlet"
          gridItem
          title="Staff distribution by outlet"
          open={collapse.isOpen('staffByOutlet')}
          onToggle={collapse.toggle}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {outletBreakdown.map((o) => (
              <div key={o.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>
                    {o.name} <span style={{ color: 'var(--dim)', fontWeight: 400 }}>· {o.location}</span>
                  </span>
                  <span style={{ ...mono, color: 'var(--dim)', fontSize: 12 }}>
                    {o.staff} staff · {o.brands} brands
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 5, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${o.pct}%`, background: 'var(--accent)', borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      </div>
    </div>
  )
}

function AttentionRow({
  dot,
  title,
  sub,
  date,
  dateColor,
  onClick,
}: {
  dot: string
  title: string
  sub: string
  date: string
  dateColor: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
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
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{sub}</div>
      </div>
      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, fontWeight: 600, color: dateColor, whiteSpace: 'nowrap' }}>{date}</span>
    </button>
  )
}

function FailedRow({
  row,
  onOpen,
  isMobile,
}: {
  row: {
    key: string
    brandName: string
    brandColor: string
    outletName: string
    visit: LatestFailedVisit | null
  }
  onOpen: (id: string) => void
  isMobile: boolean
}) {
  const v = row.visit
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: row.brandColor, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {row.brandName} · {row.outletName}
      </span>
    </div>
  )

  // No completed visit yet
  if (!v) {
    return (
      <div style={rowShell(false)}>
        {header}
        <span style={{ ...pill('var(--dim)'), marginLeft: 'auto' }}>No visit yet</span>
      </div>
    )
  }

  const meta = (
    <span style={{ fontSize: 11.5, color: 'var(--dim)', whiteSpace: 'nowrap' }}>
      {(v.staffName ?? 'Unassigned')} · {fmt(v.date)}
    </span>
  )
  // On mobile the staff · date drops to its own line below so the store name and
  // status pill can share one line without truncating.
  const metaBottom = isMobile ? <div style={{ paddingLeft: 18 }}>{meta}</div> : null

  // All success
  if (v.status === 'done') {
    return (
      <button
        onClick={() => onOpen(v.visitId)}
        style={isMobile ? { ...rowShell(true), flexDirection: 'column', alignItems: 'stretch', gap: 6 } : rowShell(true)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {header}
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isMobile && meta}
            <span style={pill('#16a34a')}>Success</span>
          </span>
        </div>
        {metaBottom}
      </button>
    )
  }

  // Has failures
  return (
    <button onClick={() => onOpen(v.visitId)} style={{ ...rowShell(true), flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {header}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isMobile && meta}
          <span style={pill('#dc2626')}>{v.failed.length} failed</span>
        </span>
      </div>
      {metaBottom}
      <div style={{ height: 1, background: 'var(--border)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 18 }}>
        {v.failed.map((t, i) => (
          <div key={i} style={{ fontSize: 12 }}>
            <span style={{ fontWeight: 600 }}>{t.label}</span>
            {t.remark && <span style={{ color: 'var(--dim)' }}> — {t.remark}</span>}
          </div>
        ))}
      </div>
    </button>
  )
}

function rowShell(clickable: boolean) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    width: '100%',
    textAlign: 'left' as const,
    color: 'var(--text)',
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    borderRadius: 9,
    padding: '10px 12px',
    cursor: clickable ? 'pointer' : 'default',
  }
}
