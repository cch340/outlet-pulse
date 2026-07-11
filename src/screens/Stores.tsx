import { useState } from 'react'
import { useData } from '../data/queries/useData'
import { useStore } from '../data/store'
import { useLatestFailedTasks } from '../data/queries/useLatestFailedTasks'
import { buildStoreGroups, type StoreRow } from '../data/queries/storeRows'
import { today, fmt, localDateStr } from '../data/derived'
import { card, pill } from '../theme'
import { Icon } from '../components/Icon'
import { ExportCsvButton } from '../components/ExportCsvButton'
import { periodParams, yearOptions, MONTH_NAMES } from './dashboardPeriod'
import { useToast } from '../components/ToastProvider'
import { useConfirm } from '../components/ConfirmProvider'
import { failedTaskRows, toCsv, exportFilename, CSV_BOM } from '../data/csvExport'
import { downloadTextFile } from '../data/download'

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

export function Stores() {
  const { data } = useData()
  const { openStoreVisits } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const t = today()
  const [filterYear, setFilterYear] = useState(t.getFullYear())
  const [filterMonth, setFilterMonth] = useState(t.getMonth() + 1)
  const [showDetails, setShowDetails] = useState(false)
  const { month } = periodParams(filterYear, filterMonth)
  const years = yearOptions(t.getFullYear())
  const { rows: latestFailed, isError } = useLatestFailedTasks(month)

  const groups = buildStoreGroups(data, latestFailed)
  const failedCount = latestFailed.reduce((n, v) => n + v.failed.length, 0)

  const handleExport = async () => {
    if (failedCount === 0) return
    const period = `${MONTH_NAMES[filterMonth - 1]} ${filterYear}`
    const ok = await confirm({
      title: 'Export CSV',
      message: `The CSV will contain the ${failedCount} failed task${failedCount === 1 ? '' : 's'} from visits in ${period} (the selected period).`,
      confirmLabel: 'Export',
    })
    if (!ok) return
    const matrix = failedTaskRows(latestFailed)
    downloadTextFile(
      exportFilename('failed-tasks', localDateStr(t)),
      'text/csv;charset=utf-8',
      CSV_BOM + toCsv(matrix),
    )
    toast.success(`Exported ${failedCount} failed task${failedCount === 1 ? '' : 's'}.`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Last visit</span>
        <select aria-label="Month" value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} style={selectStyle}>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
        <select aria-label="Year" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} style={selectStyle}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--dim)',
            cursor: 'pointer',
          }}
        >
          <input type="checkbox" checked={showDetails} onChange={(e) => setShowDetails(e.target.checked)} />
          Show failed task details
        </label>
        <ExportCsvButton
          onClick={handleExport}
          disabled={failedCount === 0}
          disabledHint="No failed tasks this month"
          title="Export this month's failed tasks as CSV"
        />
      </div>

      {isError && <div style={{ fontSize: 12.5, color: '#dc2626' }}>Couldn't load latest visit status.</div>}

      {groups.length === 0 ? (
        <div style={{ ...card, padding: 22, fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
          No stores yet. Go to <strong style={{ color: 'var(--text)' }}>Manage → Stores</strong> to link a brand to an outlet.
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.brand.id} style={{ ...card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: g.brand.color }} />
              <span style={{ fontSize: 14.5, fontWeight: 700 }}>{g.brand.name}</span>
              <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono'", fontSize: 12, color: 'var(--dim)' }}>
                {g.rows.length} outlet{g.rows.length === 1 ? '' : 's'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {g.rows.map((row) => (
                <StoreRowItem
                  key={row.outletId}
                  row={row}
                  showDetails={showDetails}
                  onView={() => openStoreVisits(row.brandId, row.outletId)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function StoreRowItem({ row, showDetails, onView }: { row: StoreRow; showDetails: boolean; onView: () => void }) {
  const v = row.latest
  const statusPill = !v ? (
    <span style={pill('var(--dim)')}>No visit yet</span>
  ) : v.status === 'done' ? (
    <span style={pill('#16a34a')}>Success</span>
  ) : (
    <span style={pill('#dc2626')}>{v.failed.length} failed</span>
  )
  const hasFailures = !!v && v.status !== 'done' && v.failed.length > 0

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface2)', borderRadius: 9, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {row.outletName}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>
            {row.staffCount} staff{v ? ` · ${fmt(v.date)}` : ''}
          </div>
        </div>
        {statusPill}
        <button
          onClick={onView}
          title="View visits"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            borderRadius: 8,
            padding: '6px 10px',
            fontFamily: "'IBM Plex Sans'",
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="fact_check" size={16} /> Visits
        </button>
      </div>
      {showDetails && hasFailures && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 2 }}>
          {v!.failed.map((tk, i) => (
            <div key={i} style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>{tk.label}</span>
              {tk.remark && <span style={{ color: 'var(--dim)' }}> — {tk.remark}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
