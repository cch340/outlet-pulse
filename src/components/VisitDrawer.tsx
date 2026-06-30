import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { visitVM } from '../data/derived'
import { pill } from '../theme'
import { Icon } from './Icon'
import type { TaskStatus } from '../data/model'
import { useSetTaskStatus, useSetTaskRemark, useMarkAllSuccess } from '../data/queries/useVisitMutations'

const SEGMENTS: { value: TaskStatus; color: string; glyph: string; title: string }[] = [
  { value: 'pending', color: '#6b7280', glyph: '–', title: 'Pending' },
  { value: 'failed', color: '#dc2626', glyph: '✕', title: 'Failed' },
  { value: 'success', color: '#16a34a', glyph: '✓', title: 'Success' },
]

export function VisitDrawer() {
  const { state, closeVisit } = useStore()
  const setStatus = useSetTaskStatus()
  const setRemark = useSetTaskRemark()
  const markAll = useMarkAllSuccess()
  const { data } = useData()
  const S = state
  const openF = S.openVisitId ? data.visits.find((f) => f.id === S.openVisitId) : null
  if (!openF) return null

  const vm = visitVM(data, openF)
  const ovPos = S.isMobile ? 'absolute' : 'fixed'

  return (
    <div
      onClick={closeVisit}
      style={{ position: ovPos, inset: 0, zIndex: 50, background: 'rgba(0,0,0,.42)', display: 'flex', justifyContent: 'flex-end' }}
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
        {/* header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600, marginBottom: 5 }}>
              Visit · {vm.dateLabel}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: vm.brandColor }} />
              {vm.title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 4 }}>Staff on duty · {vm.staffName}</div>
          </div>
          <span style={pill(vm.statusColor)}>{vm.statusLabel}</span>
          <button onClick={closeVisit} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)', padding: 2 }}>
            <Icon name="close" size={22} />
          </button>
        </div>

        {/* checklist */}
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--dim)' }}>Checklist</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: 'var(--dim)' }}>
              {vm.resolvedT}/{vm.total} resolved
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {openF.tasks.map((t) => (
              <div
                key={t.id}
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  borderRadius: 9,
                  padding: '11px 13px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                }}
              >
                <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{t.label}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {SEGMENTS.map((seg) => {
                    const active = t.status === seg.value
                    return (
                      <button
                        key={seg.value}
                        type="button"
                        title={seg.title}
                        aria-label={`${t.label}: ${seg.title}`}
                        aria-pressed={active}
                        onClick={() =>
                          setStatus.mutate(
                            { taskId: t.id!, status: seg.value },
                            { onError: (e) => alert(e.message) },
                          )
                        }
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          borderRadius: 7,
                          border: `1px solid ${active ? seg.color : 'var(--border)'}`,
                          background: active ? seg.color : 'transparent',
                          color: active ? '#fff' : 'var(--dim)',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {seg.glyph}
                      </button>
                    )
                  })}
                </div>
                <input
                  defaultValue={t.remark}
                  aria-label={`${t.label} remark`}
                  placeholder="Add a remark…"
                  onBlur={(e) => {
                    const next = e.target.value
                    if (next !== t.remark)
                      setRemark.mutate(
                        { taskId: t.id!, remark: next },
                        { onError: (err) => alert(err.message) },
                      )
                  }}
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    borderRadius: 7,
                    padding: '8px 10px',
                    fontFamily: "'IBM Plex Sans'",
                    fontSize: 12.5,
                    color: 'var(--text)',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            disabled={vm.pendingT === 0}
            onClick={() =>
              markAll.mutate({ visitId: openF.id }, { onSuccess: () => closeVisit(), onError: (e) => alert(e.message) })
            }
            style={{
              width: '100%',
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              borderRadius: 9,
              padding: 12,
              fontFamily: "'IBM Plex Sans'",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: vm.pendingT === 0 ? 'not-allowed' : 'pointer',
              opacity: vm.pendingT === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            <Icon name="task_alt" size={18} />
            Mark pending as success
          </button>
          {vm.pendingT > 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--dim)', textAlign: 'center' }}>
              Sets the {vm.pendingT} pending {vm.pendingT === 1 ? 'task' : 'tasks'} to success · failed tasks are kept
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
