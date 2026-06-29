import type { CSSProperties } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { brandById, outletById } from '../data/derived'
import { DEFAULT_TASKS } from '../data/model'
import { chip } from '../theme'
import { Icon } from './Icon'
import { useCreateFollowUp } from '../data/queries/useFollowUpMutations'

const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: 'var(--dim)',
  marginBottom: 9,
}

export function ScheduleModal() {
  const { state, closeAdd, setAf, toggleAfTask } = useStore()
  const create = useCreateFollowUp()
  const { data } = useData()
  const S = state
  if (!S.addOpen || !S.addForm) return null

  const af = S.addForm
  const selN = af.tasks.filter(Boolean).length
  const [sb, so] = af.storeKey.split('|')
  const bName = brandById(data, sb)?.name ?? '—'
  const oName = outletById(data, so)?.name ?? '—'
  const summary = `${bName} · ${oName} · ${selN} tasks`
  const ovPos = S.isMobile ? 'absolute' : 'fixed'

  return (
    <div
      onClick={closeAdd}
      style={{ position: ovPos, inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: '100%',
          maxHeight: '92vh',
          overflow: 'auto',
          background: 'var(--surface)',
          borderRadius: 14,
          boxShadow: '0 30px 80px rgba(0,0,0,.3)',
          animation: 'pop .18s ease',
        }}
      >
        {/* header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Schedule a follow-up</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>Plan a store visit and the checks to perform</div>
          </div>
          <button onClick={closeAdd} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <Icon name="close" size={22} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={fieldLabel}>Store (brand · outlet)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.stores.map((s) => {
                const b = brandById(data, s.brandId)
                const o = outletById(data, s.outletId)
                const key = `${s.brandId}|${s.outletId}`
                return (
                  <button key={key} onClick={() => setAf('storeKey', key)} style={chip(af.storeKey === key)}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
                    {b.name} · {o.name}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={fieldLabel}>Scheduled date</div>
              <input
                type="date"
                value={af.date}
                onChange={(e) => setAf('date', e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontFamily: "'IBM Plex Sans'",
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              />
            </div>
          </div>
          <div>
            <div style={fieldLabel}>Tasks to check</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DEFAULT_TASKS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => toggleAfTask(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    textAlign: 'left',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    borderRadius: 9,
                    padding: '10px 13px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1.5px solid ${af.tasks[i] ? 'var(--accent)' : 'var(--border)'}`,
                      background: af.tasks[i] ? 'var(--accent)' : 'transparent',
                    }}
                  >
                    {af.tasks[i] && <Icon name="check" size={15} color="#fff" />}
                  </span>
                  <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>{summary}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={closeAdd}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                borderRadius: 9,
                padding: '10px 18px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const [sb, so] = af.storeKey.split('|')
                const taskLabels = DEFAULT_TASKS.filter((_, i) => af.tasks[i])
                create.mutate(
                  { brandId: sb, outletId: so, staffId: af.staffId || null, date: af.date, taskLabels },
                  { onSuccess: () => closeAdd() },
                )
              }}
              style={{
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 9,
                padding: '10px 18px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
